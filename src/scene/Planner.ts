import * as THREE from 'three';
import type { SceneManager } from './SceneManager';
import type { Room } from './Room';
import type { ProductDef, PlacedItemState } from '../types';
import { getProduct } from '../data/products';
import { buildModel } from '../furniture/factory';

let UID = 0;

export interface PlacedItem {
  uid: number;
  product: ProductDef;
  color: number;
  group: THREE.Group;
  overlap: boolean;
}

/**
 * Planer aranżacji: dodawanie mebli z katalogu, zaznaczanie kliknięciem,
 * przeciąganie po podłodze (z przyciąganiem do siatki), obrót, zmiana koloru,
 * duplikowanie, wykrywanie kolizji, usuwanie oraz zapis/odczyt projektu.
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
  private selectionBox: THREE.BoxHelper;

  /** Zmiany wpływające na koszyk (dodanie/usunięcie/wczytanie). */
  onChange: () => void = () => {};
  /** Dowolna zatwierdzona zmiana — używane do historii cofania. */
  onCommit: () => void = () => {};
  onSelect: (item: PlacedItem | null) => void = () => {};
  /** Wywoływane po każdym przeliczeniu kolizji (np. w trakcie przeciągania). */
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

  // ————— dodawanie / usuwanie / duplikowanie —————

  addProduct(product: ProductDef, color?: number, x = 0, z = 0, ry = 0): PlacedItem {
    const col = color ?? product.colors[0];
    const group = buildModel(product.model, col);
    group.position.set(x, 0, z);
    group.rotation.y = ry;
    const item: PlacedItem = { uid: ++UID, product, color: col, group, overlap: false };
    group.userData.item = item;
    this.sm.scene.add(group);
    this.items.push(item);
    this.clampToRoom(item);
    this.select(item);
    this.updateCollisions();
    this.onChange();
    this.onCommit();
    return item;
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
    if (!this.selected) return;
    this.selected.group.rotation.y += delta;
    this.clampToRoom(this.selected);
    this.updateCollisions();
    this.onCommit();
  }

  recolorSelected(color: number): void {
    if (!this.selected) return;
    const item = this.selected;
    const { x, z } = item.group.position;
    const ry = item.group.rotation.y;
    this.sm.scene.remove(item.group);
    disposeGroup(item.group);
    const group = buildModel(item.product.model, color);
    group.position.set(x, 0, z);
    group.rotation.y = ry;
    group.userData.item = item;
    item.group = group;
    item.color = color;
    this.sm.scene.add(group);
    this.select(item);
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
    let nx = hit.x - this.dragOffset.x;
    let nz = hit.z - this.dragOffset.z;
    if (this.snap) {
      const g = 0.25;
      nx = Math.round(nx / g) * g;
      nz = Math.round(nz / g) * g;
    }
    this.selected.group.position.x = nx;
    this.selected.group.position.z = nz;
    this.dragMoved = true;
    this.clampToRoom(this.selected);
    this.updateCollisions();
  }

  private onPointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.sm.controls.enabled = true;
    if (this.dragMoved) this.onCommit();
  }

  // ————— kolizje / granice pokoju —————

  /** Wykrywa nakładanie się mebli (w rzucie XZ) i koloruje ramkę zaznaczenia. */
  updateCollisions(): void {
    for (const it of this.items) it.overlap = false;
    const solid = this.items.filter((i) => i.product.size[1] >= 0.1); // dywany itp. nie kolidują
    const boxes = solid.map((i) => new THREE.Box3().setFromObject(i.group));
    const eps = 0.02;
    for (let a = 0; a < solid.length; a++) {
      for (let b = a + 1; b < solid.length; b++) {
        const A = boxes[a], B = boxes[b];
        const overlapX = A.min.x < B.max.x - eps && A.max.x > B.min.x + eps;
        const overlapZ = A.min.z < B.max.z - eps && A.max.z > B.min.z + eps;
        if (overlapX && overlapZ) {
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

  private clampToRoom(item: PlacedItem): void {
    const [w, , d] = item.product.size;
    const ry = item.group.rotation.y;
    const c = Math.abs(Math.cos(ry));
    const s = Math.abs(Math.sin(ry));
    const halfX = (c * w + s * d) / 2;
    const halfZ = (s * w + c * d) / 2;
    const b = this.room.bounds;
    const p = item.group.position;
    p.x = THREE.MathUtils.clamp(p.x, b.minX + halfX, b.maxX - halfX);
    p.z = THREE.MathUtils.clamp(p.z, b.minZ + halfZ, b.maxZ - halfZ);
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
      if (product) {
        const col = st.color;
        const group = buildModel(product.model, col);
        group.position.set(st.x, 0, st.z);
        group.rotation.y = st.ry;
        const item: PlacedItem = { uid: ++UID, product, color: col, group, overlap: false };
        group.userData.item = item;
        this.sm.scene.add(group);
        this.items.push(item);
      }
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
