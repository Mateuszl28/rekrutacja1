import { describe, it, expect } from 'vitest';
import { solveLayout, layoutOverlap, type SolverItem } from './solver';

const items: SolverItem[] = [
  { w: 2.1, d: 0.95, ry: 0, anchor: 'wall-back' },
  { w: 1.6, d: 0.4, ry: Math.PI, anchor: 'wall-front' },
  { w: 1.1, d: 0.6, ry: 0, anchor: 'center' },
  { w: 0.5, d: 0.5, ry: 0, anchor: 'corner-bl' },
  { w: 0.5, d: 0.5, ry: 0, anchor: 'corner-fr' },
];

describe('solveLayout', () => {
  it('daje pozycję dla każdego mebla', () => {
    expect(solveLayout(items, 5, 4, 1)).toHaveLength(items.length);
  });

  it('w pokoju z zapasem miejsca układ jest bezkolizyjny', () => {
    const pos = solveLayout(items, 6, 5, 7);
    expect(layoutOverlap(items, pos)).toBeLessThan(0.02);
  });

  it('wszystkie meble mieszczą się w granicach pokoju', () => {
    const W = 5, D = 4;
    const pos = solveLayout(items, W, D, 2);
    items.forEach((it, i) => {
      const hx = Math.abs(Math.cos(it.ry)) * it.w / 2 + Math.abs(Math.sin(it.ry)) * it.d / 2;
      const hz = Math.abs(Math.sin(it.ry)) * it.w / 2 + Math.abs(Math.cos(it.ry)) * it.d / 2;
      expect(Math.abs(pos[i].x) + hx).toBeLessThanOrEqual(W / 2 + 1e-6);
      expect(Math.abs(pos[i].z) + hz).toBeLessThanOrEqual(D / 2 + 1e-6);
    });
  });

  it('mebel z kotwicą do tylnej ściany ląduje przy niej', () => {
    const one: SolverItem[] = [{ w: 2, d: 0.9, ry: 0, anchor: 'wall-back' }];
    const [p] = solveLayout(one, 5, 4, 1);
    // środek powinien być blisko tylnej ściany: z ≈ -D/2 + d/2 = -2 + 0.45 = -1.55
    expect(p.z).toBeLessThan(-1.3);
  });

  it('determinizm: to samo ziarno → identyczny wynik', () => {
    expect(solveLayout(items, 5, 4, 99)).toEqual(solveLayout(items, 5, 4, 99));
  });

  it('pusta lista → pusty wynik', () => {
    expect(solveLayout([], 5, 4, 1)).toEqual([]);
  });
});
