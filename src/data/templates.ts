import type { RoomKind } from '../types';

/** Pojedynczy mebel w gotowej aranżacji (kolor domyślny produktu). */
export interface TemplateItem {
  productId: string;
  x: number;
  z: number;
  ry: number;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  room: { kind: RoomKind; width: number; depth: number; wallColor: number };
  items: TemplateItem[];
}

const P2 = Math.PI / 2;
const PI = Math.PI;

/** Gotowe aranżacje — jednym kliknięciem umeblowany pokój. */
export const TEMPLATES: Template[] = [
  {
    id: 'salon-rodzinny',
    name: 'Salon rodzinny',
    description: 'Sofa, TV, stolik i regał — komplet wypoczynkowy.',
    room: { kind: 'living', width: 6, depth: 5, wallColor: 0xe7ded3 },
    items: [
      { productId: 'rug', x: 0, z: 0.4, ry: 0 },
      { productId: 'sofa-3', x: 0, z: 1.7, ry: PI },
      { productId: 'coffee-table', x: 0, z: 0.5, ry: 0 },
      { productId: 'tv-stand', x: 0, z: -2.2, ry: 0 },
      { productId: 'wall-tv', x: 0, z: -2.44, ry: 0 },
      { productId: 'armchair', x: 1.9, z: 1.1, ry: -P2 },
      { productId: 'bookshelf', x: -2.6, z: -1.0, ry: P2 },
      { productId: 'floor-lamp', x: -2.4, z: 1.9, ry: 0 },
      { productId: 'plant', x: 2.4, z: -1.9, ry: 0 },
      { productId: 'wall-art', x: 1.8, z: -2.455, ry: 0 },
    ],
  },
  {
    id: 'kuchnia-z-wyspa',
    name: 'Kuchnia z wyspą',
    description: 'Zabudowa pod ścianą, wyspa i hokery śniadaniowe.',
    room: { kind: 'kitchen', width: 5, depth: 4.2, wallColor: 0xeef1f4 },
    items: [
      { productId: 'tall-cabinet', x: -1.9, z: -1.75, ry: 0 },
      { productId: 'sink-unit', x: -0.9, z: -1.78, ry: 0 },
      { productId: 'stove', x: 0, z: -1.78, ry: 0 },
      { productId: 'base-cabinet', x: 0.7, z: -1.78, ry: 0 },
      { productId: 'fridge', x: 1.9, z: -1.72, ry: 0 },
      { productId: 'wall-cabinet', x: -0.9, z: -1.9, ry: 0 },
      { productId: 'wall-cabinet', x: 0, z: -1.9, ry: 0 },
      { productId: 'island', x: 0, z: 0.5, ry: 0 },
      { productId: 'bar-stool', x: -0.4, z: 1.2, ry: PI },
      { productId: 'bar-stool', x: 0.4, z: 1.2, ry: PI },
    ],
  },
  {
    id: 'jadalnia',
    name: 'Jadalnia',
    description: 'Stół na 6 osób z krzesłami i dekoracją.',
    room: { kind: 'kitchen', width: 5, depth: 4.2, wallColor: 0xe6d9d2 },
    items: [
      { productId: 'dining-table', x: 0, z: 0, ry: 0 },
      { productId: 'dining-chair', x: -0.7, z: 0.75, ry: PI },
      { productId: 'dining-chair', x: 0, z: 0.75, ry: PI },
      { productId: 'dining-chair', x: 0.7, z: 0.75, ry: PI },
      { productId: 'dining-chair', x: -0.7, z: -0.75, ry: 0 },
      { productId: 'dining-chair', x: 0, z: -0.75, ry: 0 },
      { productId: 'dining-chair', x: 0.7, z: -0.75, ry: 0 },
      { productId: 'wall-art', x: 0, z: -2.055, ry: 0 },
      { productId: 'plant', x: 2.1, z: 1.5, ry: 0 },
    ],
  },
];
