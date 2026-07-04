import type { RoomKind } from '../types';

/** Pojedynczy mebel w zestawie — pozycja względem kotwicy (środka zestawu). */
export interface SetItem {
  productId: string;
  dx: number;
  dz: number;
  ry?: number;
  variant?: string;
}

/** Gotowy zestaw mebli dodawany jednym kliknięciem do bieżącego pokoju. */
export interface FurnitureSet {
  id: string;
  name: string;
  category: RoomKind;
  description: string;
  items: SetItem[];
}

const PI = Math.PI;

export const SETS: FurnitureSet[] = [
  {
    id: 'living-lounge',
    name: 'Strefa wypoczynku',
    category: 'living',
    description: 'Sofa, dwa fotele, ława, dywan i lampa — kompletny salon.',
    items: [
      { productId: 'rug', dx: 0, dz: 0.1 },
      { productId: 'sofa-3', dx: 0, dz: -0.95, ry: 0 },
      { productId: 'coffee-table', dx: 0, dz: 0.35 },
      { productId: 'armchair', dx: -1.45, dz: 0.5, ry: 0.7 },
      { productId: 'armchair', dx: 1.45, dz: 0.5, ry: -0.7 },
      { productId: 'floor-lamp', dx: -1.7, dz: -0.9 },
    ],
  },
  {
    id: 'living-tv',
    name: 'Kącik TV',
    category: 'living',
    description: 'Szafka RTV, regał i roślina — strefa multimedialna.',
    items: [
      { productId: 'tv-stand', dx: 0, dz: 0 },
      { productId: 'bookshelf', dx: -1.5, dz: 0 },
      { productId: 'plant', dx: 1.3, dz: 0 },
    ],
  },
  {
    id: 'kitchen-dining',
    name: 'Jadalnia dla 6',
    category: 'kitchen',
    description: 'Stół na 6 osób z sześcioma krzesłami dookoła.',
    items: [
      { productId: 'dining-table', dx: 0, dz: 0, variant: '6' },
      { productId: 'dining-chair', dx: -0.6, dz: -0.72, ry: 0 },
      { productId: 'dining-chair', dx: 0, dz: -0.72, ry: 0 },
      { productId: 'dining-chair', dx: 0.6, dz: -0.72, ry: 0 },
      { productId: 'dining-chair', dx: -0.6, dz: 0.72, ry: PI },
      { productId: 'dining-chair', dx: 0, dz: 0.72, ry: PI },
      { productId: 'dining-chair', dx: 0.6, dz: 0.72, ry: PI },
    ],
  },
  {
    id: 'kitchen-run',
    name: 'Ciąg roboczy',
    category: 'kitchen',
    description: 'Szafki dolne, zlew i kuchenka w jednej linii.',
    items: [
      { productId: 'base-cabinet', dx: -1.05, dz: 0, variant: 's60' },
      { productId: 'sink-unit', dx: -0.35, dz: 0 },
      { productId: 'stove', dx: 0.4, dz: 0 },
      { productId: 'base-cabinet', dx: 1.1, dz: 0, variant: 's60' },
    ],
  },
];
