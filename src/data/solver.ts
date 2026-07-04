// Zaawansowany solver rozmieszczenia mebli (symulowane wyżarzanie).
// Czysty, deterministyczny (ziarno), bez zależności DOM/Three.js — w pełni testowalny.
//
// Model: każdy mebel ma footprint (w×d) i STAŁĄ orientację (ry) narzuconą przez rolę
// (projektant decyduje, w którą stronę patrzy sofa). Solver optymalizuje pozycje (x,z),
// minimalizując funkcję kosztu: kolizje + wyjście poza pokój + dosunięcie do przypisanej
// ściany. Wynikiem jest układ bezkolizyjny i „przyklejony" do ścian tam, gdzie trzeba.

import { halfExtents, type AABB } from '../scene/geometry';

export type Anchor =
  | 'wall-back'
  | 'wall-front'
  | 'wall-left'
  | 'wall-right'
  | 'corner-bl'
  | 'corner-br'
  | 'corner-fl'
  | 'corner-fr'
  | 'center'
  | 'free';

export interface SolverItem {
  w: number;
  d: number;
  ry: number;
  anchor: Anchor;
}

export interface SolvedPos {
  x: number;
  z: number;
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function box(x: number, z: number, it: SolverItem): AABB {
  const { hx, hz } = halfExtents([it.w, 0, it.d], it.ry);
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, minY: 0, maxY: 1 };
}

/** Pole nakładania się dwóch prostokątów (0, gdy rozłączne). */
function overlapArea(a: AABB, b: AABB): number {
  const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
  return ox > 0 && oz > 0 ? ox * oz : 0;
}

const W_OVERLAP = 240;
const W_BOUNDS = 120;
const W_ANCHOR = 7;
const W_CENTER = 1.2;

function anchorCost(it: SolverItem, b: AABB, W: number, D: number): number {
  const back = (b.minZ + D / 2) ** 2;
  const front = (b.maxZ - D / 2) ** 2;
  const left = (b.minX + W / 2) ** 2;
  const right = (b.maxX - W / 2) ** 2;
  switch (it.anchor) {
    case 'wall-back': return back;
    case 'wall-front': return front;
    case 'wall-left': return left;
    case 'wall-right': return right;
    case 'corner-bl': return back + left;
    case 'corner-br': return back + right;
    case 'corner-fl': return front + left;
    case 'corner-fr': return front + right;
    case 'center': {
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      return (cx * cx + cz * cz) * (W_CENTER / W_ANCHOR);
    }
    default: return 0;
  }
}

function totalCost(items: SolverItem[], xs: number[], zs: number[], W: number, D: number): number {
  const boxes = items.map((it, i) => box(xs[i], zs[i], it));
  let c = 0;
  for (let i = 0; i < items.length; i++) {
    const b = boxes[i];
    // poza pokojem
    const ox = Math.max(0, -W / 2 - b.minX) + Math.max(0, b.maxX - W / 2);
    const oz = Math.max(0, -D / 2 - b.minZ) + Math.max(0, b.maxZ - D / 2);
    c += (ox + oz) * W_BOUNDS;
    // dosunięcie do ściany / środka
    c += anchorCost(items[i], b, W, D) * W_ANCHOR;
    // kolizje
    for (let j = i + 1; j < items.length; j++) c += overlapArea(b, boxes[j]) * W_OVERLAP;
  }
  return c;
}

/** Pozycja startowa wg kotwicy (dosunięta do ściany/narożnika/środka). */
function initialPos(it: SolverItem, W: number, D: number): SolvedPos {
  const { hx, hz } = halfExtents([it.w, 0, it.d], it.ry);
  const bx = -W / 2 + hx, fx = W / 2 - hx, bz = -D / 2 + hz, fz = D / 2 - hz;
  switch (it.anchor) {
    case 'wall-back': return { x: 0, z: bz };
    case 'wall-front': return { x: 0, z: fz };
    case 'wall-left': return { x: bx, z: 0 };
    case 'wall-right': return { x: fx, z: 0 };
    case 'corner-bl': return { x: bx, z: bz };
    case 'corner-br': return { x: fx, z: bz };
    case 'corner-fl': return { x: bx, z: fz };
    case 'corner-fr': return { x: fx, z: fz };
    default: return { x: 0, z: 0 };
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Optymalizuje pozycje mebli symulowanym wyżarzaniem. Zwraca pozycje (x,z) w tej
 * samej kolejności co `items`. Orientacja (ry) pozostaje stała.
 */
export function solveLayout(
  items: SolverItem[],
  W: number,
  D: number,
  seed = 0,
  iterations = 2600
): SolvedPos[] {
  const n = items.length;
  if (n === 0) return [];
  const rng = mulberry32(seed >>> 0);

  // rozłóż startowo wg kotwic, z niewielkim rozrzutem wzdłuż ściany (by nie startować w jednym punkcie)
  const xs = new Array<number>(n);
  const zs = new Array<number>(n);
  items.forEach((it, i) => {
    const p = initialPos(it, W, D);
    const horiz = it.anchor === 'wall-back' || it.anchor === 'wall-front';
    xs[i] = p.x + (horiz ? (rng() - 0.5) * W * 0.6 : 0);
    zs[i] = p.z + (!horiz ? (rng() - 0.5) * D * 0.6 : 0);
  });

  const limits = items.map((it) => {
    const { hx, hz } = halfExtents([it.w, 0, it.d], it.ry);
    return { hx, hz };
  });
  const clampItem = (i: number) => {
    xs[i] = clamp(xs[i], -W / 2 + limits[i].hx, W / 2 - limits[i].hx);
    zs[i] = clamp(zs[i], -D / 2 + limits[i].hz, D / 2 - limits[i].hz);
  };
  for (let i = 0; i < n; i++) clampItem(i);

  let cur = totalCost(items, xs, zs, W, D);
  const bestX = xs.slice(), bestZ = zs.slice();
  let best = cur;

  for (let k = 0; k < iterations; k++) {
    const t = 1 - k / iterations;
    const T = 0.6 * t * t + 0.0008;
    const step = 0.05 + 1.1 * t;
    const i = (rng() * n) | 0;
    const ox = xs[i], oz = zs[i];
    xs[i] += (rng() - 0.5) * step;
    zs[i] += (rng() - 0.5) * step;
    clampItem(i);
    const next = totalCost(items, xs, zs, W, D);
    const dC = next - cur;
    if (dC < 0 || rng() < Math.exp(-dC / T)) {
      cur = next;
      if (cur < best) {
        best = cur;
        for (let j = 0; j < n; j++) { bestX[j] = xs[j]; bestZ[j] = zs[j]; }
      }
    } else {
      xs[i] = ox;
      zs[i] = oz;
    }
  }

  return items.map((_, i) => ({ x: +bestX[i].toFixed(3), z: +bestZ[i].toFixed(3) }));
}

/** Diagnostyka: łączne pole kolizji w układzie (0 = brak nakładania). */
export function layoutOverlap(items: SolverItem[], pos: SolvedPos[]): number {
  const boxes = items.map((it, i) => box(pos[i].x, pos[i].z, it));
  let o = 0;
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) o += overlapArea(boxes[i], boxes[j]);
  return o;
}
