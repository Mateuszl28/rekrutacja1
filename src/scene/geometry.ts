// Czysta geometria kolizji (bez zależności od Three.js/DOM) — łatwa do testowania.
// Analityczne AABB w rzucie XZ z uwzględnieniem obrotu wokół osi Y oraz zakresu Y
// (meble podłogowe [0,h], wiszące wokół wysokości montażu).

export type Size = [number, number, number]; // [szerokość, wysokość, głębokość]

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

/** Połowy gabarytu w rzucie XZ po obrocie o `ry` (radiany). */
export function halfExtents(size: Size, ry: number): { hx: number; hz: number } {
  const [w, , d] = size;
  const c = Math.abs(Math.cos(ry));
  const s = Math.abs(Math.sin(ry));
  return { hx: (c * w + s * d) / 2, hz: (s * w + c * d) / 2 };
}

/** Zakres wysokości [minY, maxY] mebla (podłogowy vs wiszący). */
export function yRange(size: Size, mount?: 'floor' | 'wall', mountHeight = 1.5): [number, number] {
  const h = size[1];
  if (mount === 'wall') return [mountHeight - h / 2, mountHeight + h / 2];
  return [0, h];
}

/** AABB mebla o zadanym gabarycie w pozycji (x,z), obrocie `ry` i sposobie montażu. */
export function aabbAt(
  size: Size,
  x: number,
  z: number,
  ry: number,
  mount?: 'floor' | 'wall',
  mountHeight?: number
): AABB {
  const { hx, hz } = halfExtents(size, ry);
  const [minY, maxY] = yRange(size, mount, mountHeight);
  return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, minY, maxY };
}

/** Czy dwa AABB nachodzą na siebie we wszystkich trzech osiach (z marginesem `eps`). */
export function overlaps(a: AABB, b: AABB, eps = 0.02): boolean {
  return (
    a.minX < b.maxX - eps && a.maxX > b.minX + eps &&
    a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps &&
    a.minY < b.maxY - eps && a.maxY > b.minY + eps
  );
}
