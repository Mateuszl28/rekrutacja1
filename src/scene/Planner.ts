import * as THREE from 'three';
import type { SceneManager } from './SceneManager';
import type { Room } from './Room';
import type { ProductDef, PlacedItemState } from '../types';
import { getProduct, effectiveSize, effectivePrice, getVariant } from '../data/products';
import { instantiate, applyColor } from '../furniture/loader';
import { type AABB, aabbAt, halfExtents as halfExtentsOf2, overlaps as overlaps2 } from './geometry';
import { solveLayout, type SolverItem, type Anchor } from '../data/solver';

let UID = 0;

export interface PlacedItem {
  uid: number;
  product: ProductDef;
  color: number;
  group: THREE.Group;
  overlap: boolean;
  /** Efektywny gabaryt [w,h,d] (wariant lub bazowy) — używany do kolizji/granic. */
  size: [number, number, number];
  /** Efektywna cena (wariant lub bazowa). */
  price: number;
  /** Id wybranego wariantu rozmiarowego (jeśli produkt ma warianty). */
  variant?: string;
}

/**
 * Planer aranżacji: dodawanie mebli (.glb) z katalogu, zaznaczanie kliknięciem,
 * przeciąganie po podłodze z **blokadą kolizji** (mebel nie wjeżdża w inny),
 * przyciąganie do siatki, obrót, zmiana koloru, duplikowanie, usuwanie,
 * zapis/odczyt oraz automatyczne szukanie wolnego miejsca przy dodawaniu.
 */
export class Planner {
  items: PlacedItem[] = [];
  selected: PlacedItem | null = null;
  snap = true;

  private sm: SceneManager;
  private room: Room;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private dragging = false;
  private dragMoved = false;
  private dragOffset = new THREE.Vector3();
  private dragObstacles: AABB[] = [];
  private selectionBox: THREE.BoxHelper;
  private guideX!: THREE.Line;
  private guideZ!: THREE.Line;
  private arrangeTween: { items: PlacedItem[]; from: { x: number; z: number }[]; to: { x: number; z: number }[]; t: number } | null = null;

  onChange: () => void = () => {};
  onCommit: () => void = () => {};
  onSelect: (item: PlacedItem | null) => void = () => {};
  onCollision: () => void = () => {};
  /** Wywoływane przy zmianie pozycji/obrotu zaznaczonego mebla (aktualizacja HUD wymiarów). */
  onTransform: () => void = () => {};

  constructor(sm: SceneManager, room: Room) {
    this.sm = sm;
    this.room = room;

    this.selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffb020);
    this.selectionBox.visible = false;
    sm.scene.add(this.selectionBox);

    // prowadnice wyrównania (pokazywane przy przyciąganiu w trakcie przeciągania)
    const guideMat = new THREE.LineBasicMaterial({ color: 0x37b26a, transparent: true, opacity: 0.9 });
    const mkLine = () => new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), guideMat);
    this.guideX = mkLine();
    this.guideZ = mkLine();
    this.guideX.visible = false;
    this.guideZ.visible = false;
    sm.scene.add(this.guideX, this.guideZ);

    const el = sm.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    el.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', () => this.onPointerUp());

    sm.onUpdate(() => {
      this.stepArrangeTween();
      if (this.selected) this.selectionBox.update();
    });
  }

  /** Animacja przejścia do układu z solvera (auto-rozmieszczenie). */
  private stepArrangeTween(): void {
    const tw = this.arrangeTween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + 0.055);
    const e = tw.t < 0.5 ? 2 * tw.t * tw.t : 1 - Math.pow(-2 * tw.t + 2, 2) / 2; // easeInOutQuad
    for (let i = 0; i < tw.items.length; i++) {
      const p = tw.items[i].group.position;
      p.x = tw.from[i].x + (tw.to[i].x - tw.from[i].x) * e;
      p.z = tw.from[i].z + (tw.to[i].z - tw.from[i].z) * e;
    }
    this.updateCollisions();
    if (tw.t >= 1) {
      this.arrangeTween = null;
      this.onTransform();
      this.onCommit();
    }
  }

  /**
   * Automatycznie porządkuje meble stojące w pokoju: dosuwa je do najbliższych
   * ścian i usuwa kolizje (solver — symulowane wyżarzanie), z płynną animacją.
   * Zwraca liczbę przemieszczonych mebli.
   */
  autoArrange(seed = 0): number {
    const floor = this.items.filter((i) => this.isSolid(i) && !this.isWall(i));
    if (floor.length === 0) return 0;
    const b = this.room.bounds;
    const solverItems: SolverItem[] = floor.map((it) => ({
      w: it.size[0],
      d: it.size[2],
      ry: it.group.rotation.y,
      anchor: this.anchorFromPosition(it.group.position.x, it.group.position.z, b),
    }));
    const solved = solveLayout(solverItems, this.room.width, this.room.depth, seed >>> 0);
    this.arrangeTween = {
      items: floor,
      from: floor.map((it) => ({ x: it.group.position.x, z: it.group.position.z })),
      to: solved,
      t: 0,
    };
    return floor.length;
  }

  /** Wyprowadza kotwicę (najbliższa ściana/narożnik/środek) z bieżącej pozycji mebla. */
  private anchorFromPosition(x: number, z: number, b: { minX: number; maxX: number; minZ: number; maxZ: number }): Anchor {
    const dBack = z - b.minZ, dFront = b.maxZ - z, dLeft = x - b.minX, dRight = b.maxX - x;
    const near = 1.2;
    const backN = dBack < near, frontN = dFront < near, leftN = dLeft < near, rightN = dRight < near;
    if (backN && leftN) return 'corner-bl';
    if (backN && rightN) return 'corner-br';
    if (frontN && leftN) return 'corner-fl';
    if (frontN && rightN) return 'corner-fr';
    const m = Math.min(dBack, dFront, dLeft, dRight);
    if (m > 1.4) return 'center';
    if (m === dBack) return 'wall-back';
    if (m === dFront) return 'wall-front';
    if (m === dLeft) return 'wall-left';
    return 'wall-right';
  }

  // ————— geometria kolizji (analityczne AABB w rzucie XZ) —————

  private isSolid(item: PlacedItem): boolean {
    return item.size[1] >= 0.1; // dywany itp. nie kolidują
  }

  private isWall(item: PlacedItem): boolean {
    return item.product.mount === 'wall';
  }

  /** AABB mebla przy zadanej pozycji/obrocie (uwzględnia efektywny gabaryt wariantu). */
  private boxOf(item: PlacedItem, x: number, z: number, ry: number): AABB {
    return aabbAt(item.size, x, z, ry, item.product.mount, item.product.mountHeight ?? 1.5);
  }

  private aabbOf(item: PlacedItem): AABB {
    return this.boxOf(item, item.group.position.x, item.group.position.z, item.group.rotation.y);
  }

  private overlaps(a: AABB, b: AABB): boolean {
    return overlaps2(a, b);
  }

  private otherSolidBoxes(exclude: PlacedItem): AABB[] {
    return this.items.filter((i) => i !== exclude && this.isSolid(i)).map((i) => this.aabbOf(i));
  }

  private collidesBox(box: AABB, obstacles: AABB[]): boolean {
    return obstacles.some((o) => this.overlaps(box, o));
  }

  // ————— dodawanie / usuwanie / duplikowanie —————

  /** Skaluje model do efektywnego gabarytu wariantu (względem rozmiaru bazowego). */
  private applyVariantScale(item: PlacedItem): void {
    const [bw, bh, bd] = item.product.size;
    const [w, h, d] = item.size;
    item.group.scale.set(w / bw, h / bh, d / bd);
  }

  addProduct(product: ProductDef, color?: number, x = 0, z = 0, ry = 0, variantId?: string, autoPlace = true): PlacedItem {
    const col = color ?? product.colors[0];
    const variant = getVariant(product, variantId);
    const group = instantiate(product.model, col);
    group.position.set(x, 0, z);
    group.rotation.y = ry;
    const item: PlacedItem = {
      uid: ++UID,
      product,
      color: col,
      group,
      overlap: false,
      size: effectiveSize(product, variant?.id),
      price: effectivePrice(product, variant?.id),
      variant: variant?.id,
    };
    this.applyVariantScale(item);
    group.userData.item = item;
    this.sm.scene.add(group);
    this.items.push(item);
    if (this.isWall(item)) {
      this.snapWall(item, x, z);
      if (autoPlace) this.resolveWallSpawn(item);
    } else {
      this.clampToRoom(item);
      if (autoPlace) this.resolveSpawnPosition(item);
    }
    this.select(item);
    this.updateCollisions();
    this.onChange();
    this.onCommit();
    return item;
  }

  /** Dodaje zestaw mebli wokół kotwicy (ax,az), zachowując układ; jedna operacja historii. */
  addSet(defs: { product: ProductDef; variant?: string; dx: number; dz: number; ry?: number }[], ax = 0, az = 0): void {
    const commit = this.onCommit;
    this.onCommit = () => {}; // wstrzymaj zapis historii do końca zestawu
    let last: PlacedItem | null = null;
    for (const d of defs) {
      last = this.addProduct(d.product, undefined, ax + d.dx, az + d.dz, d.ry ?? 0, d.variant, false);
    }
    this.onCommit = commit;
    this.select(last);
    this.updateCollisions();
    this.onChange();
    this.onCommit();
  }

  /** Szuka najbliższego wolnego miejsca przy dodawaniu (spirala po siatce). */
  private resolveSpawnPosition(item: PlacedItem): void {
    if (!this.isSolid(item)) return;
    const obstacles = this.otherSolidBoxes(item);
    const ry = item.group.rotation.y;
    const sx = item.group.position.x;
    const sz = item.group.position.z;
    if (!this.collidesBox(this.boxOf(item, sx, sz, ry), obstacles)) return;

    const step = 0.5;
    for (let r = 1; r <= 10; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // tylko obwód pierścienia
          const nx = sx + dx * step;
          const nz = sz + dz * step;
          const b = this.room.bounds;
          const half = this.boxOf(item, 0, 0, ry);
          const hx = (half.maxX - half.minX) / 2;
          const hz = (half.maxZ - half.minZ) / 2;
          if (nx < b.minX + hx || nx > b.maxX - hx || nz < b.minZ + hz || nz > b.maxZ - hz) continue;
          if (!this.collidesBox(this.boxOf(item, nx, nz, ry), obstacles)) {
            item.group.position.set(nx, 0, nz);
            return;
          }
        }
      }
    }
    // brak wolnego miejsca — zostaw (zostanie oznaczone jako kolizja)
  }

  // ————— montaż ścienny —————

  /** Przystawia mebel wiszący do najbliższej ściany względem punktu (fx,fz). */
  private snapWall(item: PlacedItem, fx: number, fz: number): void {
    const b = this.room.bounds;
    const dBack = Math.abs(fz - b.minZ);
    const dLeft = Math.abs(fx - b.minX);
    const dRight = Math.abs(fx - b.maxX);
    const m = Math.min(dBack, dLeft, dRight);
    if (m === dLeft) item.group.rotation.y = Math.PI / 2;
    else if (m === dRight) item.group.rotation.y = -Math.PI / 2;
    else item.group.rotation.y = 0;
    this.placeOnWall(item, fx, fz);
  }

  /** Ustawia mebel na aktualnie wybranej ścianie (wg rotacji) i wysokości montażu. */
  private placeOnWall(item: PlacedItem, alongX: number, alongZ: number): void {
    const b = this.room.bounds;
    const [w, , d] = item.size;
    const mh = item.product.mountHeight ?? 1.5;
    const off = d / 2 + 0.02;
    const p = item.group.position;
    p.y = mh;
    const ry = item.group.rotation.y;
    if (Math.abs(ry) < 0.1) {
      // ściana tylna
      p.z = b.minZ + off;
      p.x = THREE.MathUtils.clamp(alongX, b.minX + w / 2, b.maxX - w / 2);
    } else if (ry > 0) {
      // ściana lewa
      p.x = b.minX + off;
      p.z = THREE.MathUtils.clamp(alongZ, b.minZ + w / 2, b.maxZ - w / 2);
    } else {
      // ściana prawa
      p.x = b.maxX - off;
      p.z = THREE.MathUtils.clamp(alongZ, b.minZ + w / 2, b.maxZ - w / 2);
    }
  }

  /** Szuka wolnego miejsca wzdłuż ściany przy dodawaniu mebla wiszącego. */
  private resolveWallSpawn(item: PlacedItem): void {
    const obstacles = this.otherSolidBoxes(item);
    if (!this.collidesBox(this.aabbOf(item), obstacles)) return;
    const b = this.room.bounds;
    const [w] = item.size;
    const ry = item.group.rotation.y;
    const backWall = Math.abs(ry) < 0.1;
    const start = backWall ? item.group.position.x : item.group.position.z;
    const lo = backWall ? b.minX + w / 2 : b.minZ + w / 2;
    const hi = backWall ? b.maxX - w / 2 : b.maxZ - w / 2;
    const step = 0.25;
    for (let k = 1; k <= 40; k++) {
      for (const dir of [1, -1]) {
        const along = start + dir * k * step;
        if (along < lo || along > hi) continue;
        if (backWall) item.group.position.x = along;
        else item.group.position.z = along;
        if (!this.collidesBox(this.aabbOf(item), obstacles)) return;
      }
    }
    // brak miejsca — przywróć start
    if (backWall) item.group.position.x = start;
    else item.group.position.z = start;
  }

  duplicateSelected(): void {
    const s = this.selected;
    if (!s) return;
    this.addProduct(s.product, s.color, s.group.position.x + 0.4, s.group.position.z + 0.4, s.group.rotation.y, s.variant);
  }

  /** Zmienia wariant rozmiarowy zaznaczonego mebla (skaluje model, aktualizuje cenę/kolizje). */
  setSelectedVariant(variantId: string): void {
    const item = this.selected;
    if (!item || !item.product.variants) return;
    const v = getVariant(item.product, variantId);
    if (!v) return;
    item.variant = v.id;
    item.size = v.size;
    item.price = v.price;
    this.applyVariantScale(item);
    if (this.isWall(item)) {
      this.placeOnWall(item, item.group.position.x, item.group.position.z);
      this.resolveWallSpawn(item);
    } else {
      this.clampToRoom(item);
      this.resolveSpawnPosition(item);
    }
    this.selectionBox.setFromObject(item.group);
    this.updateCollisions();
    this.onSelect(item); // odśwież panel (wymiary/cena/wybór)
    this.onTransform();
    this.onChange();
    this.onCommit();
  }

  deleteSelected(): void {
    if (this.selected) this.remove(this.selected);
  }

  private remove(item: PlacedItem): void {
    this.sm.scene.remove(item.group);
    disposeGroup(item.group);
    this.items = this.items.filter((i) => i !== item);
    if (this.selected === item) this.select(null);
    this.updateCollisions();
    this.onChange();
    this.onCommit();
  }

  clear(commit = true): void {
    for (const item of [...this.items]) {
      this.sm.scene.remove(item.group);
      disposeGroup(item.group);
    }
    this.items = [];
    this.select(null);
    this.onChange();
    if (commit) this.onCommit();
  }

  // ————— zaznaczenie / transformacje —————

  select(item: PlacedItem | null): void {
    this.selected = item;
    if (item) {
      this.selectionBox.setFromObject(item.group);
      this.selectionBox.visible = true;
      this.refreshSelectionColor();
    } else {
      this.selectionBox.visible = false;
    }
    this.onSelect(item);
  }

  rotateSelected(delta: number): void {
    const item = this.selected;
    if (!item) return;
    if (this.isWall(item)) return; // meble wiszące są zorientowane wg ściany
    const oldRy = item.group.rotation.y;
    const oldX = item.group.position.x;
    const oldZ = item.group.position.z;
    item.group.rotation.y = oldRy + delta;
    this.clampToRoom(item);
    // cofnij obrót, jeśli powoduje kolizję (blokada)
    if (this.isSolid(item)) {
      const box = this.aabbOf(item);
      if (this.collidesBox(box, this.otherSolidBoxes(item))) {
        item.group.rotation.y = oldRy;
        item.group.position.set(oldX, 0, oldZ);
        return;
      }
    }
    this.updateCollisions();
    this.onTransform();
    this.onCommit();
  }

  /** Przesuwa zaznaczony mebel o krok siatki (strzałki), z blokadą kolizji. */
  nudgeSelected(dx: number, dz: number): void {
    const item = this.selected;
    if (!item) return;
    const step = 0.25;
    if (this.isWall(item)) {
      const backWall = Math.abs(item.group.rotation.y) < 0.1;
      const prevX = item.group.position.x;
      const prevZ = item.group.position.z;
      if (backWall) item.group.position.x += dx * step;
      else item.group.position.z += dz * step;
      this.placeOnWall(item, item.group.position.x, item.group.position.z);
      if (this.collidesBox(this.aabbOf(item), this.otherSolidBoxes(item))) {
        item.group.position.set(prevX, item.group.position.y, prevZ);
        return;
      }
    } else {
      const ry = item.group.rotation.y;
      const { hx, hz } = this.halfExtentsOf(item, ry);
      const b = this.room.bounds;
      const cx = THREE.MathUtils.clamp(item.group.position.x + dx * step, b.minX + hx, b.maxX - hx);
      const cz = THREE.MathUtils.clamp(item.group.position.z + dz * step, b.minZ + hz, b.maxZ - hz);
      if (this.collidesBox(this.boxOf(item, cx, cz, ry), this.otherSolidBoxes(item))) return;
      item.group.position.x = cx;
      item.group.position.z = cz;
    }
    this.updateCollisions();
    this.onTransform();
    this.onCommit();
  }

  recolorSelected(color: number): void {
    const item = this.selected;
    if (!item) return;
    applyColor(item.group, color);
    item.color = color;
    this.onSelect(item); // odśwież aktywną próbkę w panelu
    this.onCommit();
  }

  // ————— interakcja wskaźnikiem —————

  private updatePointer(e: PointerEvent): void {
    const rect = this.sm.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.sm.camera);
  }

  private pickItem(): PlacedItem | null {
    const hits = this.raycaster.intersectObjects(this.items.map((i) => i.group), true);
    if (hits.length === 0) return null;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj) {
      if (obj.userData.item) return obj.userData.item as PlacedItem;
      obj = obj.parent;
    }
    return null;
  }

  private floorPoint(): THREE.Vector3 | null {
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.room.floorPlane, hit) ? hit : null;
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.updatePointer(e);
    const item = this.pickItem();
    if (item) {
      this.select(item);
      this.dragging = true;
      this.dragMoved = false;
      this.sm.controls.enabled = false;
      this.dragObstacles = this.otherSolidBoxes(item); // przeszkody są nieruchome w trakcie ciągnięcia
      const hit = this.floorPoint();
      if (hit) this.dragOffset.copy(hit).sub(item.group.position);
    } else {
      this.select(null);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.dragging || !this.selected) return;
    this.updatePointer(e);
    const hit = this.floorPoint();
    if (!hit) return;
    const item = this.selected;

    // meble wiszące — ślizgają się po najbliższej ścianie
    if (this.isWall(item)) {
      const prevX = item.group.position.x;
      const prevZ = item.group.position.z;
      const prevRy = item.group.rotation.y;
      this.snapWall(item, hit.x, hit.z);
      if (this.collidesBox(this.aabbOf(item), this.dragObstacles)) {
        item.group.position.set(prevX, item.group.position.y, prevZ);
        item.group.rotation.y = prevRy;
      }
      this.dragMoved = true;
      this.updateCollisions();
      this.hideGuides();
      this.onTransform();
      return;
    }

    const ry = item.group.rotation.y;
    let nx = hit.x - this.dragOffset.x;
    let nz = hit.z - this.dragOffset.z;
    let snapX = false, snapZ = false;
    if (this.snap) {
      const g = 0.25;
      nx = Math.round(nx / g) * g;
      nz = Math.round(nz / g) * g;
      const m = this.magnetSnap(item, nx, nz, ry); // przyciąganie do krawędzi sąsiadów/ścian
      nx = m.x;
      nz = m.z;
      snapX = m.sx;
      snapZ = m.sz;
    }
    // ogranicz do wnętrza pokoju
    const { hx, hz } = this.halfExtentsOf(item, ry);
    const b = this.room.bounds;
    nx = THREE.MathUtils.clamp(nx, b.minX + hx, b.maxX - hx);
    nz = THREE.MathUtils.clamp(nz, b.minZ + hz, b.maxZ - hz);

    const curX = item.group.position.x;
    const curZ = item.group.position.z;

    if (!this.isSolid(item)) {
      item.group.position.set(nx, 0, nz);
    } else {
      // blokada kolizji z rozdzieleniem osi (ślizganie po przeszkodzie)
      const free = (x: number, z: number) => !this.collidesBox(this.boxOf(item, x, z, ry), this.dragObstacles);
      if (free(nx, nz)) item.group.position.set(nx, 0, nz);
      else if (free(nx, curZ)) item.group.position.x = nx;
      else if (free(curX, nz)) item.group.position.z = nz;
      // else: całkowicie zablokowane — pozostaw
    }

    this.dragMoved = true;
    this.updateCollisions();
    this.updateGuides(snapX ? item.group.position.x : null, snapZ ? item.group.position.z : null);
    this.onTransform();
  }

  private onPointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.sm.controls.enabled = true;
    this.hideGuides();
    if (this.dragMoved) this.onCommit();
  }

  // ————— granice / kolizje —————

  private halfExtentsOf(item: PlacedItem, ry: number): { hx: number; hz: number } {
    return halfExtentsOf2(item.size, ry);
  }

  /** Magnetyczne wyrównanie do krawędzi/środków sąsiadów oraz do ścian. */
  private magnetSnap(item: PlacedItem, x: number, z: number, ry: number): { x: number; z: number; sx: boolean; sz: boolean } {
    const thr = 0.16;
    const { hx, hz } = this.halfExtentsOf(item, ry);
    const b = this.room.bounds;
    const xt: number[] = [b.minX + hx, b.maxX - hx];
    const zt: number[] = [b.minZ + hz, b.maxZ - hz];
    for (const o of this.items) {
      if (o === item || !this.isSolid(o)) continue;
      const ob = this.aabbOf(o);
      xt.push(ob.minX - hx, ob.maxX + hx, (ob.minX + ob.maxX) / 2);
      zt.push(ob.minZ - hz, ob.maxZ + hz, (ob.minZ + ob.maxZ) / 2);
    }
    let bx = x, dx = thr, sx = false;
    for (const t of xt) { const d = Math.abs(t - x); if (d < dx) { dx = d; bx = t; sx = true; } }
    let bz = z, dz = thr, sz = false;
    for (const t of zt) { const d = Math.abs(t - z); if (d < dz) { dz = d; bz = t; sz = true; } }
    return { x: bx, z: bz, sx, sz };
  }

  private updateGuides(x: number | null, z: number | null): void {
    const b = this.room.bounds;
    if (x !== null) {
      this.guideX.geometry.setFromPoints([new THREE.Vector3(x, 0.02, b.minZ), new THREE.Vector3(x, 0.02, b.maxZ)]);
      this.guideX.visible = true;
    } else this.guideX.visible = false;
    if (z !== null) {
      this.guideZ.geometry.setFromPoints([new THREE.Vector3(b.minX, 0.02, z), new THREE.Vector3(b.maxX, 0.02, z)]);
      this.guideZ.visible = true;
    } else this.guideZ.visible = false;
  }

  private hideGuides(): void {
    this.guideX.visible = false;
    this.guideZ.visible = false;
  }

  /** Zaznacza pierwszy mebel danego produktu (opcjonalnie wariantu) i centruje kamerę. */
  focusProduct(productId: string, variant?: string): void {
    const match = (i: PlacedItem) => i.product.id === productId && (variant === undefined || (i.variant ?? '') === variant);
    const item = this.items.find(match);
    if (!item) return;
    this.select(item);
    const center = new THREE.Vector3();
    new THREE.Box3().setFromObject(item.group).getCenter(center);
    this.sm.focusOn(center);
  }

  /** Usuwa jedną (ostatnio dodaną) sztukę danego produktu (opcjonalnie konkretnego wariantu). */
  removeOneOfProduct(productId: string, variant?: string): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.product.id === productId && (variant === undefined || (it.variant ?? '') === variant)) {
        this.remove(it);
        return;
      }
    }
  }

  private clampToRoom(item: PlacedItem): void {
    if (this.isWall(item)) {
      // utrzymaj mebel na jego ścianie po zmianie rozmiaru pokoju
      this.placeOnWall(item, item.group.position.x, item.group.position.z);
      return;
    }
    const { hx, hz } = this.halfExtentsOf(item, item.group.rotation.y);
    const b = this.room.bounds;
    const p = item.group.position;
    p.x = THREE.MathUtils.clamp(p.x, b.minX + hx, b.maxX - hx);
    p.z = THREE.MathUtils.clamp(p.z, b.minZ + hz, b.maxZ - hz);
  }

  /** Przelicza flagi nakładania się i koloruje ramkę zaznaczenia. */
  updateCollisions(): void {
    const solid = this.items.filter((i) => this.isSolid(i));
    for (const it of this.items) it.overlap = false;
    const boxes = solid.map((i) => this.aabbOf(i));
    for (let a = 0; a < solid.length; a++) {
      for (let b = a + 1; b < solid.length; b++) {
        if (this.overlaps(boxes[a], boxes[b])) {
          solid[a].overlap = true;
          solid[b].overlap = true;
        }
      }
    }
    this.refreshSelectionColor();
    this.onCollision();
  }

  private refreshSelectionColor(): void {
    const color = this.selected?.overlap ? 0xff4d4d : 0xffb020;
    (this.selectionBox.material as THREE.LineBasicMaterial).color.setHex(color);
  }

  reclampAll(): void {
    for (const item of this.items) this.clampToRoom(item);
    this.updateCollisions();
    if (this.selected) this.selectionBox.update();
  }

  hasOverlaps(): boolean {
    return this.items.some((i) => i.overlap);
  }

  /** Wymiary i odległości zaznaczonego mebla od ścian (do HUD). */
  getSelectedInfo(): { name: string; w: number; d: number; h: number; gapBack: number; gapFront: number; gapLeft: number; gapRight: number } | null {
    const it = this.selected;
    if (!it) return null;
    const b = this.room.bounds;
    const box = this.aabbOf(it);
    const [w, h, d] = it.size;
    return {
      name: it.product.name,
      w, d, h,
      gapBack: Math.max(0, box.minZ - b.minZ),
      gapFront: Math.max(0, b.maxZ - box.maxZ),
      gapLeft: Math.max(0, box.minX - b.minX),
      gapRight: Math.max(0, b.maxX - box.maxX),
    };
  }

  /** Dodaje mebel w miejscu wskazanym na ekranie (drag&drop z katalogu). */
  addProductAtScreen(product: ProductDef, color: number | undefined, clientX: number, clientY: number, variantId?: string): void {
    const rect = this.sm.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.sm.camera);
    const hit = this.floorPoint();
    this.addProduct(product, color, hit ? hit.x : 0, hit ? hit.z : 0, 0, variantId);
  }

  // ————— zapis / odczyt —————

  serialize(): PlacedItemState[] {
    return this.items.map((i) => ({
      productId: i.product.id,
      x: +i.group.position.x.toFixed(3),
      z: +i.group.position.z.toFixed(3),
      ry: +i.group.rotation.y.toFixed(4),
      color: i.color,
      variant: i.variant,
    }));
  }

  load(states: PlacedItemState[]): void {
    this.clear(false);
    for (const st of states) {
      const product = getProduct(st.productId);
      if (!product) continue;
      const variant = getVariant(product, st.variant);
      const group = instantiate(product.model, st.color);
      const y = product.mount === 'wall' ? (product.mountHeight ?? 1.5) : 0;
      group.position.set(st.x, y, st.z);
      group.rotation.y = st.ry;
      const item: PlacedItem = {
        uid: ++UID,
        product,
        color: st.color,
        group,
        overlap: false,
        size: effectiveSize(product, variant?.id),
        price: effectivePrice(product, variant?.id),
        variant: variant?.id,
      };
      this.applyVariantScale(item);
      group.userData.item = item;
      this.sm.scene.add(group);
      this.items.push(item);
    }
    this.select(null);
    this.updateCollisions();
    this.onChange();
  }
}

function disposeGroup(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}
