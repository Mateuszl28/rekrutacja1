import { describe, it, expect } from 'vitest';
import { generateLayout, layoutCost, type GenParams } from './generator';
import { getProduct } from './products';

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

  it('mały pokój odrzuca meble, które się nie mieszczą', () => {
    const small = generateLayout({ kind: 'living', width: 2.5, depth: 2.5, style: 'cozy' });
    for (const p of small) {
      const prod = getProduct(p.productId)!;
      if (prod.mount === 'wall') continue;
      const half = Math.max(prod.size[0], prod.size[2]) / 2;
      expect(Math.abs(p.x) + half).toBeLessThanOrEqual(2.5 / 2 + 0.31);
    }
  });
});
