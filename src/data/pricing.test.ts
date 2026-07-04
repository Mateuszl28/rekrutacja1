import { describe, it, expect } from 'vitest';
import { PROMOS, normalizePromo, groupCart, cartSubtotal, computeTotals, type CartItemInput } from './pricing';

describe('normalizePromo', () => {
  it('akceptuje kod bez względu na wielkość liter i spacje', () => {
    expect(normalizePromo('  meble10 ')).toBe('MEBLE10');
    expect(normalizePromo('Gratis')).toBe('GRATIS');
  });
  it('zwraca null dla nieznanego lub pustego kodu', () => {
    expect(normalizePromo('NIEISTNIEJE')).toBeNull();
    expect(normalizePromo('')).toBeNull();
    expect(normalizePromo('   ')).toBeNull();
  });
});

describe('groupCart', () => {
  const items: CartItemInput[] = [
    { productId: 'sofa-3', variant: '3os', name: 'Sofa · 3-os', price: 2499 },
    { productId: 'sofa-3', variant: '3os', name: 'Sofa · 3-os', price: 2499 },
    { productId: 'sofa-3', variant: '2os', name: 'Sofa · 2-os', price: 1999 },
    { productId: 'plant', name: 'Roślina', price: 189 },
  ];

  it('grupuje po produkcie i wariancie', () => {
    const lines = groupCart(items);
    expect(lines).toHaveLength(3);
    expect(lines.find((l) => l.variant === '3os')?.qty).toBe(2);
    expect(lines.find((l) => l.variant === '2os')?.qty).toBe(1);
    expect(lines.find((l) => l.productId === 'plant')?.qty).toBe(1);
  });

  it('różne warianty tego samego produktu to osobne linie', () => {
    const sofaLines = groupCart(items).filter((l) => l.productId === 'sofa-3');
    expect(sofaLines).toHaveLength(2);
  });

  it('pusty koszyk → brak linii', () => {
    expect(groupCart([])).toEqual([]);
  });
});

describe('cartSubtotal', () => {
  it('sumuje ceny pozycji', () => {
    expect(cartSubtotal([{ price: 100 }, { price: 250 }, { price: 50 }])).toBe(400);
    expect(cartSubtotal([])).toBe(0);
  });
});

describe('computeTotals', () => {
  it('bez kodu: suma = produkty + dostawa', () => {
    const t = computeTotals(1000, 19);
    expect(t).toEqual({ subtotal: 1000, deliveryCost: 19, discount: 0, final: 1019 });
  });

  it('MEBLE10: 10% rabatu na meble (zaokrąglone), dostawa płatna', () => {
    const t = computeTotals(1000, 19, 'MEBLE10');
    expect(t.discount).toBe(100);
    expect(t.deliveryCost).toBe(19);
    expect(t.final).toBe(919);
  });

  it('MEBLE10: rabat zaokrąglany do pełnych złotych', () => {
    expect(computeTotals(2499, 0, 'MEBLE10').discount).toBe(250); // 249.9 → 250
  });

  it('GRATIS: darmowa dostawa, bez rabatu kwotowego', () => {
    const t = computeTotals(1000, 39, 'GRATIS');
    expect(t.deliveryCost).toBe(0);
    expect(t.discount).toBe(0);
    expect(t.final).toBe(1000);
  });

  it('nieznany kod jest ignorowany (jak brak kodu)', () => {
    expect(computeTotals(1000, 19, 'CZEGOS')).toEqual(computeTotals(1000, 19));
  });

  it('suma końcowa nigdy nie spada poniżej zera', () => {
    // sztuczny przypadek brzegowy: gdyby rabat przewyższył wartość
    expect(computeTotals(50, 0, 'MEBLE10').final).toBeGreaterThanOrEqual(0);
  });

  it('każdy zdefiniowany kod ma etykietę', () => {
    for (const code of Object.keys(PROMOS)) {
      expect(PROMOS[code].label.length).toBeGreaterThan(0);
    }
  });
});
