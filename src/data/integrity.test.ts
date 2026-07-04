import { describe, it, expect } from 'vitest';
import { getProduct, getVariant } from './products';
import { SETS } from './sets';
import { TEMPLATES } from './templates';

describe('zestawy (SETS)', () => {
  it('każdy element wskazuje istniejący produkt', () => {
    for (const set of SETS) {
      for (const item of set.items) {
        expect(getProduct(item.productId), `${set.id} → ${item.productId}`).toBeDefined();
      }
    }
  });

  it('warianty użyte w zestawach istnieją w produkcie', () => {
    for (const set of SETS) {
      for (const item of set.items) {
        if (!item.variant) continue;
        const p = getProduct(item.productId)!;
        expect(getVariant(p, item.variant)?.id, `${set.id} → ${item.productId}/${item.variant}`).toBe(item.variant);
      }
    }
  });

  it('id zestawów są unikalne', () => {
    const ids = SETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('gotowe aranżacje (TEMPLATES)', () => {
  it('każdy element wskazuje istniejący produkt', () => {
    for (const t of TEMPLATES) {
      for (const item of t.items) {
        expect(getProduct(item.productId), `${t.id} → ${item.productId}`).toBeDefined();
      }
    }
  });

  it('id aranżacji są unikalne', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
