import * as THREE from 'three';

/**
 * Proceduralne tekstury podłóg generowane w canvasie (bez plików graficznych).
 * Dają podłogom realistyczny charakter (deski / płytki) zamiast płaskiego koloru.
 */

function makeCanvas(size = 512): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, x: c.getContext('2d')! };
}

function finalize(c: HTMLCanvasElement, repeat: number): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.repeat.set(repeat, repeat);
  return t;
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

/** Podłoga drewniana — deski z usłojeniem. */
export function woodTexture(baseColor: number, repeat = 4): THREE.CanvasTexture {
  const { c, x } = makeCanvas(512);
  x.fillStyle = hex(baseColor);
  x.fillRect(0, 0, 512, 512);
  const plankH = 512 / 6;
  for (let i = 0; i < 6; i++) {
    const y = i * plankH;
    // delikatne zróżnicowanie odcienia desek
    const v = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const shade = Math.floor((v - 0.5) * 24);
    x.fillStyle = `rgba(${shade < 0 ? 0 : 255},${shade < 0 ? 0 : 255},${shade < 0 ? 0 : 255},${Math.abs(shade) / 100})`;
    x.fillRect(0, y, 512, plankH);
    // usłojenie
    x.strokeStyle = 'rgba(60,40,25,0.10)';
    x.lineWidth = 1;
    for (let g = 0; g < 5; g++) {
      x.beginPath();
      const gy = y + 6 + g * (plankH / 6);
      x.moveTo(0, gy);
      x.bezierCurveTo(170, gy + (g % 2 ? 3 : -3), 340, gy + (g % 2 ? -3 : 3), 512, gy);
      x.stroke();
    }
    // spoina między deskami
    x.fillStyle = 'rgba(0,0,0,0.22)';
    x.fillRect(0, y, 512, 2);
  }
  return finalize(c, repeat);
}

/** Podłoga z płytek — regularna siatka ze spoinami. */
export function tileTexture(baseColor: number, repeat = 5): THREE.CanvasTexture {
  const { c, x } = makeCanvas(512);
  const tiles = 4;
  const t = 512 / tiles;
  for (let iy = 0; iy < tiles; iy++) {
    for (let ix = 0; ix < tiles; ix++) {
      const v = (Math.sin((ix * 7 + iy * 13) * 12.9898) * 43758.5453) % 1;
      const shade = Math.floor((v - 0.5) * 16);
      const r = ((baseColor >> 16) & 255) + shade;
      const g = ((baseColor >> 8) & 255) + shade;
      const b = (baseColor & 255) + shade;
      x.fillStyle = `rgb(${r},${g},${b})`;
      x.fillRect(ix * t, iy * t, t, t);
    }
  }
  // spoiny
  x.strokeStyle = 'rgba(120,120,125,0.55)';
  x.lineWidth = 3;
  for (let i = 0; i <= tiles; i++) {
    x.beginPath(); x.moveTo(i * t, 0); x.lineTo(i * t, 512); x.stroke();
    x.beginPath(); x.moveTo(0, i * t); x.lineTo(512, i * t); x.stroke();
  }
  return finalize(c, repeat);
}
