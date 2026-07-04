// Czysta logika cenowa koszyka: grupowanie pozycji, kody rabatowe i podsumowanie.
// Bez zależności od DOM/Three.js — w pełni testowalna.

export interface PromoDef {
  label: string;
  /** Rabat procentowy na wartość mebli. */
  percent?: number;
  /** Darmowa dostawa. */
  freeDelivery?: boolean;
}

/** Dostępne kody rabatowe (klucz = kod pisany wielkimi literami). */
export const PROMOS: Record<string, PromoDef> = {
  MEBLE10: { label: '−10% na meble', percent: 10 },
  GRATIS: { label: 'darmowa dostawa', freeDelivery: true },
};

/** Normalizuje wpisany kod (trim + wielkie litery). Zwraca kod, jeśli istnieje, inaczej null. */
export function normalizePromo(raw: string): string | null {
  const code = (raw || '').trim().toUpperCase();
  return PROMOS[code] ? code : null;
}

export interface CartItemInput {
  productId: string;
  variant?: string;
  name: string;
  price: number;
}

export interface CartLine extends CartItemInput {
  qty: number;
}

/** Grupuje pozycje po produkcie i wariancie (różne warianty = osobne linie). */
export function groupCart(items: CartItemInput[]): CartLine[] {
  const map = new Map<string, CartLine>();
  for (const it of items) {
    const key = `${it.productId}|${it.variant ?? ''}`;
    const line = map.get(key) ?? { productId: it.productId, variant: it.variant, name: it.name, price: it.price, qty: 0 };
    line.qty++;
    map.set(key, line);
  }
  return [...map.values()];
}

/** Suma wartości pozycji koszyka. */
export function cartSubtotal(items: { price: number }[]): number {
  return items.reduce((s, i) => s + i.price, 0);
}

export interface Totals {
  subtotal: number;
  deliveryCost: number;
  discount: number;
  final: number;
}

/**
 * Oblicza podsumowanie: rabat procentowy na meble, ewentualnie darmowa dostawa,
 * suma końcowa nigdy poniżej zera.
 */
export function computeTotals(subtotal: number, deliveryCost: number, promoCode?: string | null): Totals {
  const promo = promoCode ? PROMOS[promoCode] : undefined;
  const discount = promo?.percent ? Math.round((subtotal * promo.percent) / 100) : 0;
  const delivery = promo?.freeDelivery ? 0 : deliveryCost;
  const final = Math.max(0, subtotal + delivery - discount);
  return { subtotal, deliveryCost: delivery, discount, final };
}
