import * as THREE from 'three';
import type { SceneManager } from './SceneManager';
import type { Room } from './Room';
import type { ProductDef, PlacedItemState } from '../types';
import { getProduct } from '../data/products';
import { instantiate, applyColor } from '../furniture/loader';

let UID = 0;

interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

export interface PlacedItem {
  uid: number;
  product: ProductDef;
  color: number;
  group: THREE.Group;
  overlap: boolean;
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

  onChange: () => void = () => {};
  onCommit: () => void = () => {};
  onSelect: (item: PlacedItem | null) => void = () => {};
  onCollision: () => void = () => {};

  constructor(sm: SceneManager, room: Room) {
    this.sm = sm;
    this.room = room;

    this.selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffb020);
    this.selectionBox.visible = false;
    sm.scene.add(this.selectionBox);

    const el = sm.renderer.domElement;
    el.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    el.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', () => this.onPointerUp());

    sm.onUpdate(() => {
      if (this.selected) this.selectionBox.update();
    });
  }

  // ————— geometria kolizji (analityczne AABB w rzucie XZ) —————

  private isSolid(item: PlacedItem): boolean {
    return item.product.size[1] >= 0.1; // dywany itp. nie kolidują
  }

  private isWall(item: PlacedItem): boolean {
    return item.product.mount === 'wall';
  }

  private yRange(product: ProductDef): [number, number] {
    const h = product.size[1];
    if (product.mount === 'wall') {
      const mh = product.mountHeight ?? 1.5;
      return [mh - h / 2, mh + h / 2];
    }
    return [0, h];
  }

  private aabbAt(product: ProductDef, x: number, z: number, ry: number): AABB {
    const [w, , d] = product.size;
    const c = Math.abs(Math.cos(ry));
    const s = Math.abs(Math.sin(ry));
    const hx = (c * w + s * d) / 2;
    const hz = (s * w + c * d) / 2;
    const [minY, maxY] = this.yRange(product);
    return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, minY, maxY };
  }

  private aabbOf(item: PlacedItem): AABB {
    return this.aabbAt(item.product, item.group.position.x, item.group.position.z, item.group.rotation.y);
  }

  private overlaps(a: AABB, b: AABB): boolean {
    const eps = 0.02;
    return (
      a.minX < b.maxX - eps && a.maxX > b.minX + eps &&
      a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps &&
      a.minY < b.maxY - eps && a.maxY > b.minY + eps
    );
  }

  private otherSolidBoxes(exclude: PlacedItem): AABB[] {
    return this.items.filter((i) => i !== exclude && this.isSolid(i)).map((i) => this.aabbOf(i));
  }

  private collidesBox(box: AABB, obstacles: AABB[]): boolean {
    return obstacles.some((o) => this.overlaps(box, o));
  }

  // ————— dodawanie / usuwanie / duplikowanie —————

  addProduct(product: ProductDef, color?: number, x = 0, z = 0, ry = 0): PlacedItem {
    const col = color ?? product.colors[0];
    const group = instantiate(product.model, col);
    group.position.set(x, 0, z);
    group.rotation.y = ry;
    const item: PlacedItem = { uid: ++UID, product, color: col, group, overlap: false };
    group.userData.item = item;
    this.sm.scene.add(group);
    this.items.push(item);
    if (this.isWall(item)) {
      this.snapWall(item, x, z);
      this.resolveWallSpawn(item);
    } else {
      this.clampToRoom(item);
      this.resolveSpawnPosition(item);
    }
    this.select(item);
    this.updateCollisions();
    this.onChange();
    this.onCommit();
    return item;
  }

  /** Szuka najbliższego wolnego miejsca przy dodawaniu (spirala po siatce). */
  private resolveSpawnPosition(item: PlacedItem): void {
    if (!this.isSolid(item)) return;
    const obstacles = this.otherSolidBoxes(item);
    const ry = item.group.rotation.y;
    const sx = item.group.position.x;
    const sz = item.group.position.z;
    if (!this.collidesBox(this.aabbAt(item.product, sx, sz, ry), obstacles)) return;

    const step = 0.5;
    for (let r = 1; r <= 10; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; // tylko obwód pierścienia
          const nx = sx + dx * step;
          const nz = sz + dz * step;
          const b = this.room.bounds;
          const half = this.aabbAt(item.product, 0, 0, ry);
          const hx = (half.maxX - half.minX) / 2;
          const hz = (half.maxZ - half.minZ) / 2;
          if (nx < b.minX + hx || nx > b.maxX - hx || nz < b.minZ + hz || nz > b.maxZ - hz) continue;
          if (!this.collidesBox(this.aabbAt(item.product, nx, nz, ry), obstacles)) {
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
    const [w, , d] = item.product.size;
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
    const [w] = item.product.size;
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
    this.addProduct(s.product, s.color, s.group.position.x + 0.4, s.group.position.z + 0.4, s.group.rotation.y);
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
      const { hx, hz } = this.halfExtents(item.product, ry);
      const b = this.room.bounds;
      const cx = THREE.MathUtils.clamp(item.group.position.x + dx * step, b.minX + hx, b.maxX - hx);
      const cz = THREE.MathUtils.clamp(item.group.position.z + dz * step, b.minZ + hz, b.maxZ - hz);
      if (this.collidesBox(this.aabbAt(item.product, cx, cz, ry), this.otherSolidBoxes(item))) return;
      item.group.position.x = cx;
      item.group.position.z = cz;
    }
    this.updateCollisions();
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
      return;
    }

    const ry = item.group.rotation.y;
    let nx = hit.x - this.dragOffset.x;
    let nz = hit.z - this.dragOffset.z;
    if (this.snap) {
      const g = 0.25;
      nx = Math.round(nx / g) * g;
      nz = Math.round(nz / g) * g;
    }
    // ogranicz do wnętrza pokoju
    const { hx, hz } = this.halfExtents(item.product, ry);
    const b = this.room.bounds;
    nx = THREE.MathUtils.clamp(nx, b.minX + hx, b.maxX - hx);
    nz = THREE.MathUtils.clamp(nz, b.minZ + hz, b.maxZ - hz);

    const curX = item.group.position.x;
    const curZ = item.group.position.z;

    if (!this.isSolid(item)) {
      item.group.position.set(nx, 0, nz);
    } else {
      // blokada kolizji z rozdzieleniem osi (ślizganie po przeszkodzie)
      const free = (x: number, z: number) => !this.collidesBox(this.aabbAt(item.product, x, z, ry), this.dragObstacles);
      if (free(nx, nz)) item.group.position.set(nx, 0, nz);
      else if (free(nx, curZ)) item.group.position.x = nx;
      else if (free(curX, nz)) item.group.position.z = nz;
      // else: całkowicie zablokowane — pozostaw
    }

    this.dragMoved = true;
    this.updateCollisions();
  }

  private onPointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.sm.controls.enabled = true;
    if (this.dragMoved) this.onCommit();
  }

  // ————— granice / kolizje —————

  private halfExtents(product: ProductDef, ry: number): { hx: number; hz: number } {
    const [w, , d] = product.size;
    const c = Math.abs(Math.cos(ry));
    const s = Math.abs(Math.sin(ry));
    return { hx: (c * w + s * d) / 2, hz: (s * w + c * d) / 2 };
  }

  private clampToRoom(item: PlacedItem): void {
    if (this.isWall(item)) {
      // utrzymaj mebel na jego ścianie po zmianie rozmiaru pokoju
      this.placeOnWall(item, item.group.position.x, item.group.position.z);
      return;
    }
    const { hx, hz } = this.halfExtents(item.product, item.group.rotation.y);
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

  /** Dodaje mebel w miejscu wskazanym na ekranie (drag&drop z katalogu). */
  addProductAtScreen(product: ProductDef, color: number | undefined, clientX: number, clientY: number): void {
    const rect = this.sm.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.sm.camera);
    const hit = this.floorPoint();
    this.addProduct(product, color, hit ? hit.x : 0, hit ? hit.z : 0);
  }

  // ————— zapis / odczyt —————

  serialize(): PlacedItemState[] {
    return this.items.map((i) => ({
      productId: i.product.id,
      x: +i.group.position.x.toFixed(3),
      z: +i.group.position.z.toFixed(3),
      ry: +i.group.rotation.y.toFixed(4),
      color: i.color,
    }));
  }

  load(states: PlacedItemState[]): void {
    this.clear(false);
    for (const st of states) {
      const product = getProduct(st.productId);
      if (!product) continue;
      const group = instantiate(product.model, st.color);
      const y = product.mount === 'wall' ? (product.mountHeight ?? 1.5) : 0;
      group.position.set(st.x, y, st.z);
      group.rotation.y = st.ry;
      const item: PlacedItem = { uid: ++UID, product, color: st.color, group, overlap: false };
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
