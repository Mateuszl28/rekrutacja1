import type { ProductDef } from '../types';

// Kolory wielokrotnego użytku
const FABRIC = { grey: 0x8a8f98, teal: 0x3f7d75, mustard: 0xc9a24b, navy: 0x3b4a63 };
const WOOD = { walnut: 0x6b4f3a, oak: 0xb08d57, white: 0xeef0f2 };
const STEEL = 0xc3c7cc;
const DARK = 0x2f3640;

/**
 * Katalog produktów sklepu. Modele 3D są generowane proceduralnie z brył
 * Three.js (src/furniture/factory.ts), dzięki czemu demo nie wymaga zewnętrznych
 * plików .glb i jest w pełni samowystarczalne.
 */
export const PRODUCTS: ProductDef[] = [
  // ——— SALON ———
  {
    id: 'sofa-3',
    name: 'Sofa 3-osobowa „Nord”',
    category: 'living',
    price: 2499,
    model: 'sofa',
    size: [2.1, 0.85, 0.95],
    colors: [FABRIC.grey, FABRIC.teal, FABRIC.mustard, FABRIC.navy],
    description: 'Wygodna sofa z miękkimi poduchami, tapicerka w 4 kolorach.',
  },
  {
    id: 'armchair',
    name: 'Fotel „Loft”',
    category: 'living',
    price: 1099,
    model: 'armchair',
    size: [0.85, 0.85, 0.9],
    colors: [FABRIC.mustard, FABRIC.grey, FABRIC.teal],
    description: 'Designerski fotel wypoczynkowy do kompletu z sofą.',
  },
  {
    id: 'coffee-table',
    name: 'Stolik kawowy „Slab”',
    category: 'living',
    price: 649,
    model: 'coffeeTable',
    size: [1.1, 0.42, 0.6],
    colors: [WOOD.walnut, WOOD.oak, DARK],
    description: 'Niski stolik z litego drewna na metalowych nogach.',
  },
  {
    id: 'tv-stand',
    name: 'Szafka RTV „Line”',
    category: 'living',
    price: 899,
    model: 'tvStand',
    size: [1.6, 0.45, 0.4],
    colors: [WOOD.white, WOOD.walnut, DARK],
    description: 'Niska szafka pod telewizor z szufladami.',
  },
  {
    id: 'bookshelf',
    name: 'Regał „Grid”',
    category: 'living',
    price: 1290,
    model: 'bookshelf',
    size: [1.0, 1.8, 0.35],
    colors: [WOOD.oak, WOOD.white, DARK],
    description: 'Wysoki regał z otwartymi półkami na książki i dekoracje.',
  },
  {
    id: 'floor-lamp',
    name: 'Lampa podłogowa „Arc”',
    category: 'living',
    price: 399,
    model: 'floorLamp',
    size: [0.4, 1.6, 0.4],
    colors: [DARK, STEEL],
    description: 'Stojąca lampa z regulowanym kloszem.',
  },
  {
    id: 'rug',
    name: 'Dywan „Soft” 200×300',
    category: 'living',
    price: 549,
    model: 'rug',
    size: [3.0, 0.03, 2.0],
    colors: [0xd9cbb8, FABRIC.grey, FABRIC.teal],
    description: 'Miękki dywan definiujący strefę wypoczynku.',
  },
  {
    id: 'plant',
    name: 'Roślina „Monstera”',
    category: 'living',
    price: 189,
    model: 'plant',
    size: [0.5, 1.3, 0.5],
    colors: [0x3f8f4f],
    description: 'Duża roślina doniczkowa ożywiająca wnętrze.',
  },

  // ——— KUCHNIA ———
  {
    id: 'base-cabinet',
    name: 'Szafka dolna „Kitch” 60',
    category: 'kitchen',
    price: 459,
    model: 'baseCabinet',
    size: [0.6, 0.9, 0.6],
    colors: [WOOD.white, DARK, WOOD.oak],
    description: 'Moduł dolny 60 cm z blatem roboczym i frontem.',
  },
  {
    id: 'tall-cabinet',
    name: 'Słupek wysoki „Kitch”',
    category: 'kitchen',
    price: 989,
    model: 'tallCabinet',
    size: [0.6, 2.1, 0.6],
    colors: [WOOD.white, DARK, WOOD.oak],
    description: 'Wysoka szafka słupkowa na zabudowę lub spiżarnię.',
  },
  {
    id: 'fridge',
    name: 'Lodówka „Cool” XL',
    category: 'kitchen',
    price: 2799,
    model: 'fridge',
    size: [0.7, 1.9, 0.7],
    colors: [STEEL, WOOD.white, DARK],
    description: 'Wolnostojąca lodówka z zamrażarką, stal nierdzewna.',
  },
  {
    id: 'stove',
    name: 'Kuchenka „Chef” 60',
    category: 'kitchen',
    price: 1599,
    model: 'stove',
    size: [0.6, 0.9, 0.6],
    colors: [STEEL, DARK],
    description: 'Kuchenka z piekarnikiem i płytą 4-palnikową.',
  },
  {
    id: 'sink-unit',
    name: 'Moduł ze zlewem „Aqua”',
    category: 'kitchen',
    price: 749,
    model: 'sink',
    size: [0.8, 0.9, 0.6],
    colors: [WOOD.white, DARK, WOOD.oak],
    description: 'Szafka zlewozmywakowa z blatem i baterią.',
  },
  {
    id: 'island',
    name: 'Wyspa kuchenna „Central”',
    category: 'kitchen',
    price: 2190,
    model: 'island',
    size: [1.6, 0.95, 0.9],
    colors: [DARK, WOOD.white, WOOD.oak],
    description: 'Wolnostojąca wyspa z blatem i miejscem do pracy.',
  },
  {
    id: 'bar-stool',
    name: 'Hoker „Perch”',
    category: 'kitchen',
    price: 249,
    model: 'barStool',
    size: [0.42, 0.9, 0.42],
    colors: [DARK, WOOD.oak, FABRIC.mustard],
    description: 'Hoker barowy do wyspy lub blatu śniadaniowego.',
  },
  {
    id: 'dining-table',
    name: 'Stół jadalny „Gather” 6os.',
    category: 'kitchen',
    price: 1490,
    model: 'diningTable',
    size: [1.8, 0.76, 0.9],
    colors: [WOOD.oak, WOOD.walnut, WOOD.white],
    description: 'Stół dla 6 osób do jadalni lub aneksu kuchennego.',
  },
  {
    id: 'dining-chair',
    name: 'Krzesło „Gather”',
    category: 'kitchen',
    price: 299,
    model: 'diningChair',
    size: [0.5, 0.9, 0.55],
    colors: [WOOD.oak, DARK, FABRIC.teal],
    description: 'Krzesło do kompletu ze stołem jadalnym.',
  },
];

export function getProduct(id: string): ProductDef | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
