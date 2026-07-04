import * as THREE from 'three';
import { instantiate } from './loader';
import type { ProductDef } from '../types';

/** Leniwie tworzony, współdzielony renderer offscreen (do miniatur na żądanie). */
let shared: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; size: number } | null = null;

function ensureRenderer(size: number) {
  if (shared && shared.size === size) return shared;
  if (shared) shared.renderer.dispose();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.5));
  const dir = new THREE.DirectionalLight(0xffffff, 2.2);
  dir.position.set(4, 6, 5);
  scene.add(dir);

  const cam = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  shared = { renderer, scene, cam, size };
  return shared;
}

const _center = new THREE.Vector3();
const _size = new THREE.Vector3();

/** Renderuje pojedynczą miniaturę produktu w zadanym kolorze do data URL. */
export function renderThumbnail(product: ProductDef, color: number, size = 200): string {
  const { renderer, scene, cam } = ensureRenderer(size);
  const fov = (32 * Math.PI) / 180;
  const g = instantiate(product.model, color);
  scene.add(g);

  const box = new THREE.Box3().setFromObject(g);
  box.getCenter(_center);
  box.getSize(_size);
  const maxDim = Math.max(_size.x, _size.y, _size.z);
  const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.6;

  cam.position.set(_center.x + dist * 0.75, _center.y + dist * 0.55, _center.z + dist * 0.9);
  cam.lookAt(_center);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');

  scene.remove(g);
  return url;
}

/**
 * Renderuje miniatury 3D wszystkich produktów (kolor domyślny) do data URL —
 * używane jako obrazki w kartach katalogu. Jednorazowo przy starcie.
 */
export function renderThumbnails(products: ProductDef[], size = 200): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of products) map.set(p.id, renderThumbnail(p, p.colors[0], size));
  return map;
}
