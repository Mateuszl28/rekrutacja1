import * as THREE from 'three';
import { instantiate } from './loader';
import type { ProductDef } from '../types';

/**
 * Renderuje miniaturę 3D każdego produktu (z wczytanych modeli .glb) do data URL,
 * używanego jako obrazek w kartach katalogu. Jednorazowy, offscreenowy renderer.
 */
export function renderThumbnails(products: ProductDef[], size = 200): Map<string, string> {
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
  const fov = (32 * Math.PI) / 180;

  const map = new Map<string, string>();
  const center = new THREE.Vector3();
  const sizeV = new THREE.Vector3();

  for (const p of products) {
    const g = instantiate(p.model, p.colors[0]);
    scene.add(g);

    const box = new THREE.Box3().setFromObject(g);
    box.getCenter(center);
    box.getSize(sizeV);
    const maxDim = Math.max(sizeV.x, sizeV.y, sizeV.z);
    const dist = (maxDim / 2 / Math.tan(fov / 2)) * 1.6;

    cam.position.set(center.x + dist * 0.75, center.y + dist * 0.55, center.z + dist * 0.9);
    cam.lookAt(center);
    renderer.render(scene, cam);
    map.set(p.id, renderer.domElement.toDataURL('image/png'));

    scene.remove(g);
  }

  renderer.dispose();
  return map;
}
