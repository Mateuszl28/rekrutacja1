// Deterministyczny generator gotowych aranżacji (offline, bez zależności DOM/Three.js).
// Dobiera i rozstawia meble w zależności od pomieszczenia, stylu i budżetu.
// Wynik jest listą pozycji, które planer wstawia (z uwzględnieniem kolizji).

import type { RoomKind } from '../types';
import { getProduct, effectivePrice } from './products';
import { halfExtents } from '../scene/geometry';
import { solveLayout, type SolverItem, type Anchor } from './solver';

export type Style = 'minimal' | 'cozy' | 'modern';

export interface GenParams {
  kind: RoomKind;
  width: number;
  depth: number;
  style: Style;
  /** Maksymalny budżet w PLN (opcjonalnie). */
  budget?: number;
  /** Ziarno wariacji — to samo ziarno = ta sama aranżacja (różne = inne warianty/pozycje). */
  seed?: number;
}

/** Deterministyczny PRNG (mulberry32) — powtarzalna wariacja przy tym samym ziarnie. */
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenPlacement {
  productId: string;
  variant?: string;
  x: number;
  z: number;
  ry: number;
}

interface Cand extends GenPlacement {
  /** Czy pozycja jest opcjonalna (usuwana przy przekroczeniu budżetu). */
  optional: boolean;
  /** Priorytet zostawienia (wyższy = ważniejszy). */
  keep: number;
}

const PI = Math.PI;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Zwraca meble dla stylu (pełna lista; budżet i granice pokoju filtrują później). */
function livingCandidates(w: number, d: number, style: Style): Cand[] {
  const minX = -w / 2, maxX = w / 2, minZ = -d / 2, maxZ = d / 2;
  const c: Cand[] = [];
  // sofa przy tylnej ścianie, na wprost strefy
  c.push({ productId: 'sofa-3', x: 0, z: minZ + 0.6, ry: 0, optional: false, keep: 100 });
  c.push({ productId: 'rug', x: 0, z: minZ + 1.8, ry: 0, optional: true, keep: 60 });
  c.push({ productId: 'coffee-table', x: 0, z: minZ + 1.8, ry: 0, optional: true, keep: 70 });
  // strefa TV przy przeciwległej ścianie
  c.push({ productId: 'tv-stand', x: 0, z: maxZ - 0.3, ry: PI, optional: true, keep: 80 });
  c.push({ productId: 'wall-tv', x: 0, z: maxZ - 0.05, ry: 0, optional: true, keep: 50 });
  // rośliny i światło w narożnikach
  c.push({ productId: 'plant', x: maxX - 0.5, z: minZ + 0.5, ry: 0, optional: true, keep: 30 });
  c.push({ productId: 'floor-lamp', x: minX + 0.5, z: minZ + 0.5, ry: 0, optional: true, keep: 40 });
  if (style !== 'minimal') {
    c.push({ productId: 'armchair', x: minX + 0.8, z: minZ + 2.0, ry: 0.7, optional: true, keep: 55 });
    c.push({ productId: 'armchair', x: maxX - 0.8, z: minZ + 2.0, ry: -0.7, optional: true, keep: 45 });
  }
  if (style === 'cozy') {
    c.push({ productId: 'bookshelf', x: maxX - 0.25, z: 0, ry: -PI / 2, optional: true, keep: 35 });
    c.push({ productId: 'wall-art', x: 0, z: minZ + 0.05, ry: 0, optional: true, keep: 20 });
  }
  return c;
}

function kitchenCandidates(w: number, d: number, style: Style): Cand[] {
  const minX = -w / 2, maxX = w / 2, minZ = -d / 2, maxZ = d / 2;
  const c: Cand[] = [];
  // ciąg roboczy przy tylnej ścianie: lodówka, szafki, zlew, kuchenka
  let x = minX + 0.4;
  const zBack = minZ + 0.35;
  c.push({ productId: 'fridge', x, z: minZ + 0.4, ry: 0, optional: false, keep: 100 });
  x += 0.75;
  c.push({ productId: 'base-cabinet', x, z: zBack, ry: 0, optional: true, keep: 70 });
  x += 0.65;
  c.push({ productId: 'sink-unit', x, z: zBack, ry: 0, optional: false, keep: 90 });
  x += 0.75;
  c.push({ productId: 'stove', x, z: zBack, ry: 0, optional: false, keep: 90 });
  x += 0.65;
  c.push({ productId: 'base-cabinet', x, z: zBack, ry: 0, optional: true, keep: 60 });
  // szafki górne nad blatem
  c.push({ productId: 'wall-cabinet', x: minX + 1.2, z: minZ + 0.05, ry: 0, optional: true, keep: 40 });
  c.push({ productId: 'wall-cabinet', x: minX + 1.85, z: minZ + 0.05, ry: 0, optional: true, keep: 35 });
  // strefa jadalna na środku/przodzie, jeśli jest głębia
  if (d >= 3.5) {
    if (style === 'modern' && w >= 3.5) {
      c.push({ productId: 'island', x: 0, z: 0.2, ry: 0, optional: true, keep: 65 });
      c.push({ productId: 'bar-stool', x: -0.5, z: 0.95, ry: PI, optional: true, keep: 30 });
      c.push({ productId: 'bar-stool', x: 0.5, z: 0.95, ry: PI, optional: true, keep: 30 });
    } else {
      c.push({ productId: 'dining-table', x: 0, z: maxZ - 1.1, ry: 0, variant: '4', optional: true, keep: 65 });
      c.push({ productId: 'dining-chair', x: -0.5, z: maxZ - 1.75, ry: 0, optional: true, keep: 25 });
      c.push({ productId: 'dining-chair', x: 0.5, z: maxZ - 1.75, ry: 0, optional: true, keep: 25 });
      c.push({ productId: 'dining-chair', x: -0.5, z: maxZ - 0.55, ry: PI, optional: true, keep: 25 });
      c.push({ productId: 'dining-chair', x: 0.5, z: maxZ - 0.55, ry: PI, optional: true, keep: 25 });
    }
  }
  return c;
}

/** Czy środek mebla mieści się w pokoju (z grubsza, po połowie gabarytu). */
function fitsInRoom(cand: Cand, w: number, d: number): boolean {
  const p = getProduct(cand.productId);
  if (!p) return false;
  if (p.mount === 'wall') return true; // wiszące przystaną do ściany
  const { hx, hz } = halfExtents(p.size, cand.ry);
  return Math.abs(cand.x) + hx <= w / 2 + 0.01 && Math.abs(cand.z) + hz <= d / 2 + 0.01;
}

/**
 * Generuje aranżację: filtruje pozycje do granic pokoju i przycina do budżetu
 * (usuwając najpierw najmniej istotne opcjonalne meble).
 */
export function generateLayout(params: GenParams): GenPlacement[] {
  const { kind, width, depth, style, budget } = params;
  const rng = mulberry32((params.seed ?? 0) >>> 0);
  let cands = (kind === 'kitchen' ? kitchenCandidates : livingCandidates)(width, depth, style).filter((c) =>
    fitsInRoom(c, width, depth)
  );

  // wariacja: losowy wariant dywanu oraz lekkie odsunięcie dekoracji (deterministycznie wg ziarna)
  const rugVariants = ['l', 's', 'xl'];
  cands = cands.map((c) => {
    let { x, z, variant } = c;
    if (c.productId === 'rug') variant = rugVariants[Math.floor(rng() * rugVariants.length)];
    if (c.optional && getProduct(c.productId)?.mount !== 'wall') {
      x += (rng() - 0.5) * 0.3;
      z += (rng() - 0.5) * 0.3;
    }
    return { ...c, x, z, variant };
  });

  // opcjonalny akcent: druga roślina w wolnym narożniku (tylko style bogatsze)
  if (style !== 'minimal' && kind === 'living' && rng() > 0.5) {
    cands.push({ productId: 'plant', x: -width / 2 + 0.5, z: depth / 2 - 0.5, ry: 0, optional: true, keep: 25 });
  }

  // zaciśnij pozycje do wnętrza pokoju (bezpieczny margines) i odrzuć te, które po jitterze wypadły
  const mx = width / 2 - 0.3, mz = depth / 2 - 0.3;
  cands = cands.filter((c) => fitsInRoom(c, width, depth)).map((c) => ({ ...c, x: clamp(c.x, -mx, mx), z: clamp(c.z, -mz, mz) }));

  if (budget && budget > 0) {
    const price = (c: Cand) => effectivePrice(getProduct(c.productId)!, c.variant);
    let total = cands.reduce((s, c) => s + price(c), 0);
    // usuwaj opcjonalne o najniższym priorytecie, aż zmieścisz się w budżecie
    const removable = cands.filter((c) => c.optional).sort((a, b) => a.keep - b.keep);
    for (const c of removable) {
      if (total <= budget) break;
      cands = cands.filter((x) => x !== c);
      total -= price(c);
    }
  }
  // rozmieszczenie: meble podłogowe optymalizuje solver (bezkolizyjnie, przy ścianach),
  // meble wiszące zostają przy swojej ścianie (planer je do niej przyklei)
  const floor: Cand[] = [];
  const wall: Cand[] = [];
  for (const c of cands) (getProduct(c.productId)?.mount === 'wall' ? wall : floor).push(c);

  const solverItems: SolverItem[] = floor.map((c) => {
    const p = getProduct(c.productId)!;
    return { w: p.size[0], d: p.size[2], ry: c.ry, anchor: anchorOf(c, width, depth) };
  });
  const solved = solveLayout(solverItems, width, depth, ((params.seed ?? 0) ^ 0x9e3779b9) >>> 0);

  const floorPlacements: GenPlacement[] = floor.map((c, i) => ({ productId: c.productId, variant: c.variant, x: solved[i].x, z: solved[i].z, ry: c.ry }));
  const wallPlacements: GenPlacement[] = wall.map((c) => ({ productId: c.productId, variant: c.variant, x: c.x, z: c.z, ry: c.ry }));
  return [...floorPlacements, ...wallPlacements];
}

/** Wyprowadza kotwicę (przy której ścianie/narożniku ma stać mebel) z jego roli/pozycji. */
function anchorOf(c: Cand, w: number, d: number): Anchor {
  const nearBack = c.z < -d / 2 + 1.3;
  const nearFront = c.z > d / 2 - 1.3;
  const nearLeft = c.x < -w / 2 + 1.3;
  const nearRight = c.x > w / 2 - 1.3;
  if (nearBack && nearLeft) return 'corner-bl';
  if (nearBack && nearRight) return 'corner-br';
  if (nearFront && nearLeft) return 'corner-fl';
  if (nearFront && nearRight) return 'corner-fr';
  if (nearBack) return 'wall-back';
  if (nearFront) return 'wall-front';
  if (nearLeft) return 'wall-left';
  if (nearRight) return 'wall-right';
  return 'center';
}

/** Szacowany koszt wygenerowanej aranżacji. */
export function layoutCost(placements: GenPlacement[]): number {
  return placements.reduce((s, p) => {
    const prod = getProduct(p.productId);
    return prod ? s + effectivePrice(prod, p.variant) : s;
  }, 0);
}
