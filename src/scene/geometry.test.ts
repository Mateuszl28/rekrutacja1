import { describe, it, expect } from 'vitest';
import { halfExtents, yRange, aabbAt, overlaps, type Size } from './geometry';

const SOFA: Size = [2, 1, 1]; // szer. 2, wys. 1, gł. 1

describe('halfExtents', () => {
  it('bez obrotu = połowa gabarytu', () => {
    expect(halfExtents(SOFA, 0)).toEqual({ hx: 1, hz: 0.5 });
  });

  it('obrót o 90° zamienia osie X/Z', () => {
    const h = halfExtents(SOFA, Math.PI / 2);
    expect(h.hx).toBeCloseTo(0.5, 6);
    expect(h.hz).toBeCloseTo(1, 6);
  });

  it('obrót o 45° powiększa obie połowy (obwiednia)', () => {
    const h = halfExtents(SOFA, Math.PI / 4);
    expect(h.hx).toBeCloseTo((Math.SQRT2 * (2 + 1)) / 4, 6);
    expect(h.hx).toBeCloseTo(h.hz, 9);
  });
});

describe('yRange', () => {
  it('mebel podłogowy stoi na podłodze [0, h]', () => {
    expect(yRange([1, 2, 1], 'floor')).toEqual([0, 2]);
    expect(yRange([1, 2, 1])).toEqual([0, 2]);
  });

  it('mebel wiszący jest wyśrodkowany na wysokości montażu', () => {
    expect(yRange([1, 0.6, 0.3], 'wall', 1.75)).toEqual([1.45, 2.05]);
  });
});

describe('aabbAt', () => {
  it('centruje AABB na pozycji', () => {
    const b = aabbAt(SOFA, 3, -2, 0);
    expect(b).toMatchObject({ minX: 2, maxX: 4, minZ: -2.5, maxZ: -1.5, minY: 0, maxY: 1 });
  });
});

describe('overlaps', () => {
  const a = aabbAt([1, 1, 1], 0, 0, 0);

  it('wykrywa nachodzenie', () => {
    expect(overlaps(a, aabbAt([1, 1, 1], 0.5, 0, 0))).toBe(true);
  });

  it('rozłączne w osi X nie kolidują', () => {
    expect(overlaps(a, aabbAt([1, 1, 1], 2, 0, 0))).toBe(false);
  });

  it('stykające się krawędziami nie kolidują (margines eps)', () => {
    expect(overlaps(a, aabbAt([1, 1, 1], 1, 0, 0))).toBe(false);
  });

  it('mebel wiszący (górny) nie koliduje z podłogowym o tym samym rzucie', () => {
    const floor = aabbAt([1, 0.9, 0.6], 0, 0, 0, 'floor');
    const wall = aabbAt([1, 0.7, 0.35], 0, 0, 0, 'wall', 1.75);
    expect(overlaps(floor, wall)).toBe(false); // różny zakres Y
  });

  it('dwa meble wiszące na tej samej wysokości kolidują', () => {
    const w1 = aabbAt([0.6, 0.7, 0.35], 0, 0, 0, 'wall', 1.75);
    const w2 = aabbAt([0.6, 0.7, 0.35], 0.3, 0, 0, 'wall', 1.75);
    expect(overlaps(w1, w2)).toBe(true);
  });
});
