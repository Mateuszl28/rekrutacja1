import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PRODUCTS } from '../data/products';

/**
 * Ładowanie i instancjonowanie mebli z prawdziwych plików .glb (public/models/).
 * Modele są generowane skryptem `npm run models` z proceduralnej fabryki, ale
 * w aplikacji trafiają przez pełny pipeline glTF: GLTFLoader → cache → klon.
 *
 * Aby podmienić model na własny/kupiony, wystarczy nadpisać plik
 * `public/models/<klucz>.glb` (klucze = pola `model` w src/data/products.ts).
 */

const cache = new Map<string, THREE.Group>();
const loader = new GLTFLoader();

function modelUrl(model: string): string {
  return `${import.meta.env.BASE_URL}models/${model}.glb`;
}

/** Wczytuje wszystkie modele do pamięci (raz, na starcie). */
export async function preloadModels(onProgress?: (loaded: number, total: number) => void): Promise<void> {
  const models = [...new Set(PRODUCTS.map((p) => p.model))];
  let loaded = 0;
  await Promise.all(
    models.map(
      (model) =>
        new Promise<void>((resolve, reject) => {
          loader.load(
            modelUrl(model),
            (gltf) => {
              const scene = gltf.scene;
              scene.traverse((o) => {
                const mesh = o as THREE.Mesh;
                if (mesh.isMesh) {
                  mesh.castShadow = true;
                  mesh.receiveShadow = true;
                }
              });
              cache.set(model, scene);
              onProgress?.(++loaded, models.length);
              resolve();
            },
            undefined,
            (err) => reject(err)
          );
        })
    )
  );
}

/** Zmienia kolor materiałów oznaczonych `primary` w danym poddrzewie. */
export function applyColor(root: THREE.Object3D, color: number): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial;
      if (std.name === 'primary' && std.color) std.color.setHex(color);
    }
  });
}

/** Tworzy niezależną instancję modelu (własne materiały) z zadanym kolorem. */
export function instantiate(model: string, color?: number): THREE.Group {
  const template = cache.get(model);
  if (!template) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xff00ff })));
    return g;
  }
  const clone = template.clone(true);
  // sklonuj materiały, aby zmiana koloru dotyczyła tylko tej instancji
  clone.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
    }
  });
  if (color !== undefined) applyColor(clone, color);
  return clone;
}
