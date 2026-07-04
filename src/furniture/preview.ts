import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { instantiate, applyColor } from './loader';
import { getVariant } from '../data/products';
import type { ProductDef } from '../types';

/**
 * Interaktywny podgląd 3D pojedynczego produktu (modal „szybki podgląd").
 * Auto-obrót + przeciąganie myszą, zmiana koloru i wariantu na żywo.
 * Własny, lekki renderer — tworzony leniwie, sprzątany przy zamknięciu.
 */
export class ProductPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private pivot: THREE.Group | null = null;
  private model: THREE.Object3D | null = null;
  private raf = 0;
  private running = false;
  private autoRotate = true;
  private dragging = false;
  private lastX = 0;
  private product: ProductDef | null = null;
  private color = 0xffffff;
  private variant?: string;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x556, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.8);
    dir.position.set(4, 6, 5);
    this.scene.add(dir);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);

    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.autoRotate = false;
      this.lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging || !this.pivot) return;
      this.pivot.rotation.y += (e.clientX - this.lastX) * 0.01;
      this.lastX = e.clientX;
    });
    const end = () => { this.dragging = false; this.autoRotate = true; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  /** Ładuje produkt do podglądu (kolor i wariant początkowy). */
  setProduct(product: ProductDef, color: number, variant?: string): void {
    this.product = product;
    this.color = color;
    this.variant = variant;
    this.rebuild();
  }

  setColor(color: number): void {
    this.color = color;
    if (this.model) applyColor(this.model, color);
  }

  setVariant(variant?: string): void {
    this.variant = variant;
    this.rebuild();
  }

  private rebuild(): void {
    if (!this.product) return;
    if (this.pivot) {
      this.scene.remove(this.pivot);
      disposeGroup(this.pivot);
      this.pivot = null;
      this.model = null;
    }
    const model = instantiate(this.product.model, this.color);
    const [bw, bh, bd] = this.product.size;
    const size = getVariant(this.product, this.variant)?.size ?? this.product.size;
    model.scale.set(size[0] / bw, size[1] / bh, size[2] / bd);

    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    const dim = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(dim);
    model.position.sub(center); // wyśrodkuj w pivocie, by obracał się „w miejscu"

    const pivot = new THREE.Group();
    pivot.add(model);
    pivot.rotation.y = -0.5;
    this.scene.add(pivot);
    this.pivot = pivot;
    this.model = model;

    const fov = (this.camera.fov * Math.PI) / 180;
    const maxDim = Math.max(dim.x, dim.y, dim.z);
    const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.9;
    this.camera.position.set(0, dim.y * 0.12, dist);
    this.camera.lookAt(0, 0, 0);
  }

  resize(): void {
    const w = this.canvas.clientWidth || 360;
    const h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.resize();
    const loop = () => {
      if (!this.running) return;
      if (this.autoRotate && this.pivot) this.pivot.rotation.y += 0.008;
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
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
