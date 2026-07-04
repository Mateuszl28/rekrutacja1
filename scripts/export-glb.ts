/**
 * Eksportuje proceduralne meble (src/furniture/factory.ts) do prawdziwych
 * plików binarnych glTF (.glb) w katalogu public/models/.
 *
 * Uruchomienie:  npm run models
 *
 * Modele są następnie ładowane w aplikacji standardowym GLTFLoaderem
 * (src/furniture/loader.ts) — pełny pipeline glTF, w 100% offline.
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildModel } from '../src/furniture/factory.ts';
import { PRODUCTS } from '../src/data/products.ts';

// GLTFExporter (ścieżka binarna) używa przeglądarkowego FileReadera — minimalny polyfill dla Node.
(globalThis as any).FileReader = class {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
};

const models = [...new Set(PRODUCTS.map((p) => p.model))];
mkdirSync('public/models', { recursive: true });
const exporter = new GLTFExporter();

let total = 0;
for (const model of models) {
  const group = buildModel(model);
  const bytes: ArrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(group, (result) => resolve(result as ArrayBuffer), reject, { binary: true });
  });
  writeFileSync(`public/models/${model}.glb`, Buffer.from(bytes));
  total += bytes.byteLength;
  console.log(`  ✓ ${model}.glb  (${(bytes.byteLength / 1024).toFixed(1)} kB)`);
}
console.log(`\nWyeksportowano ${models.length} modeli, łącznie ${(total / 1024).toFixed(1)} kB → public/models/`);
