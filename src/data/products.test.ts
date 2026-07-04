import { describe, it, expect } from 'vitest';
import { PRODUCTS, getProduct, getVariant, effectiveSize, effectivePrice } from './products';

describe('getProduct', () => {
  it('znajduje produkt po id', () => {
    expect(getProduct('sofa-3')?.name).toContain('Sofa');
  });
  it('zwraca undefined dla nieznanego id', () => {
    expect(getProduct('nie-ma-takiego')).toBeUndefined();
  });
});

describe('warianty', () => {
  const sofa = getProduct('sofa-3')!;

  it('getVariant zwraca wybrany wariant', () => {
    expect(getVariant(sofa, '2os')?.label).toBe('2-osobowa');
  });

  it('getVariant bez id (lub błędne id) zwraca domyślny variants[0]', () => {
    expect(getVariant(sofa)?.id).toBe(sofa.variants![0].id);
    expect(getVariant(sofa, 'brak')?.id).toBe(sofa.variants![0].id);
  });

  it('getVariant zwraca undefined dla produktu bez wariantów', () => {
    expect(getVariant(getProduct('plant')!)).toBeUndefined();
  });

  it('effectiveSize/Price używają wariantu, a bez wariantu — bazy', () => {
    expect(effectivePrice(sofa, 'naroznik')).toBe(3299);
    expect(effectiveSize(sofa, '2os')).toEqual([1.6, 0.85, 0.95]);
    const plant = getProduct('plant')!;
    expect(effectivePrice(plant, 'cokolwiek')).toBe(plant.price);
    expect(effectiveSize(plant)).toEqual(plant.size);
  });
});

describe('spójność danych wariantów', () => {
  it('variants[0] odpowiada bazowemu rozmiarowi i cenie produktu', () => {
    for (const p of PRODUCTS) {
      if (!p.variants) continue;
      expect(p.variants[0].size, `${p.id}: rozmiar bazowy`).toEqual(p.size);
      expect(p.variants[0].price, `${p.id}: cena bazowa`).toBe(p.price);
    }
  });

  it('id wariantów są unikalne w obrębie produktu', () => {
    for (const p of PRODUCTS) {
      if (!p.variants) continue;
      const ids = p.variants.map((v) => v.id);
      expect(new Set(ids).size, `${p.id}: unikalne id`).toBe(ids.length);
    }
  });

  it('każdy produkt ma dodatni koszt i przynajmniej jeden kolor', () => {
    for (const p of PRODUCTS) {
      expect(p.price, p.id).toBeGreaterThan(0);
      expect(p.colors.length, p.id).toBeGreaterThan(0);
    }
  });
});
