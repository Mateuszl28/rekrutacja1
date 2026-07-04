import { describe, it, expect } from 'vitest';
import { generateLayout, layoutCost, type GenParams } from './generator';
import { getProduct } from './products';
import { halfExtents } from '../scene/geometry';

const base: GenParams = { kind: 'living', width: 5, depth: 4, style: 'cozy' };

describe('generateLayout', () => {
  it('zwraca niepustą aranżację dla salonu i kuchni', () => {
    expect(generateLayout(base).length).toBeGreaterThan(0);
    expect(generateLayout({ ...base, kind: 'kitchen' }).length).toBeGreaterThan(0);
  });

  it('wszystkie pozycje wskazują istniejące produkty', () => {
    for (const kind of ['living', 'kitchen'] as const) {
      for (const p of generateLayout({ ...base, kind })) {
        expect(getProduct(p.productId), p.productId).toBeDefined();
      }
    }
  });

  it('meble podłogowe mieszczą się w granicach pokoju', () => {
    const w = 5, d = 4;
    for (const p of generateLayout({ kind: 'living', width: w, depth: d, style: 'cozy' })) {
      const prod = getProduct(p.productId)!;
      if (prod.mount === 'wall') continue;
      expect(Math.abs(p.x)).toBeLessThanOrEqual(w / 2);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(d / 2);
    }
  });

  it('styl minimal daje nie więcej mebli niż cozy', () => {
    const minimal = generateLayout({ ...base, style: 'minimal' }).length;
    const cozy = generateLayout({ ...base, style: 'cozy' }).length;
    expect(minimal).toBeLessThanOrEqual(cozy);
  });

  it('respektuje budżet (usuwa opcjonalne meble)', () => {
    const budget = 3000;
    const layout = generateLayout({ ...base, budget });
    expect(layoutCost(layout)).toBeLessThanOrEqual(budget);
    // element wymagany (sofa) zostaje mimo ciasnego budżetu
    expect(layout.some((p) => p.productId === 'sofa-3')).toBe(true);
  });

  it('bez budżetu zwraca pełną aranżację (droższą niż z ciasnym budżetem)', () => {
    const full = layoutCost(generateLayout(base));
    const tight = layoutCost(generateLayout({ ...base, budget: 3000 }));
    expect(full).toBeGreaterThanOrEqual(tight);
  });

  it('to samo ziarno daje identyczną aranżację (determinizm)', () => {
    const a = generateLayout({ ...base, seed: 42 });
    const b = generateLayout({ ...base, seed: 42 });
    expect(a).toEqual(b);
  });

  it('różne ziarna mogą dać różne aranżacje (wariacja)', () => {
    const seeds = [1, 2, 3, 4, 5].map((s) => JSON.stringify(generateLayout({ ...base, seed: s })));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('w małym pokoju rozmieszczone meble mieszczą się w granicach (AABB)', () => {
    const w = 2.5, d = 2.5;
    for (const p of generateLayout({ kind: 'living', width: w, depth: d, style: 'cozy', seed: 3 })) {
      const prod = getProduct(p.productId)!;
      if (prod.mount === 'wall') continue;
      const { hx, hz } = halfExtents(prod.size, p.ry);
      expect(Math.abs(p.x) + hx).toBeLessThanOrEqual(w / 2 + 0.05);
      expect(Math.abs(p.z) + hz).toBeLessThanOrEqual(d / 2 + 0.05);
    }
  });
});
