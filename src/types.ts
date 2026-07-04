// Wspólne typy domenowe dla całej aplikacji.

export type RoomKind = 'living' | 'kitchen';

/** Definicja produktu w katalogu sklepu. */
export interface ProductDef {
  id: string;
  name: string;
  category: RoomKind;
  price: number; // cena w PLN
  /** Klucz modelu 3D w fabryce mebli (src/furniture/factory.ts). */
  model: string;
  /** Gabaryt podstawy [szerokość, wysokość, głębokość] w metrach — używany do kolizji/przyciągania. */
  size: [number, number, number];
  /** Dostępne kolory (hex). Pierwszy jest domyślny. */
  colors: number[];
  description: string;
  /** Sposób montażu: podłogowy (domyślny) lub wiszący na ścianie. */
  mount?: 'floor' | 'wall';
  /** Wysokość środka mebla dla montażu ściennego (m). */
  mountHeight?: number;
}

/** Zserializowany stan pojedynczego mebla w projekcie (do zapisu/odczytu). */
export interface PlacedItemState {
  productId: string;
  x: number;
  z: number;
  ry: number; // obrót wokół osi Y w radianach
  color: number;
}
