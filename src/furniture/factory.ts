import * as THREE from 'three';

/**
 * Proceduralna fabryka mebli. Każdy builder zwraca THREE.Group, którego
 * układ jest tak dobrany, że y=0 leży na podłodze (mebel „stoi” na Y=0).
 * Dzięki temu ustawienie mebla w pokoju sprowadza się do zmiany position.x/z.
 */

function mat(color: number, opts: { rough?: number; metal?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.85,
    metalness: opts.metal ?? 0.0,
  });
}

function box(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rTop: number, rBot: number, h: number, material: THREE.Material, seg = 20): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const METAL = mat(0x3a3d42, { rough: 0.4, metal: 0.8 });
const HANDLE = mat(0x9aa0a6, { rough: 0.3, metal: 0.9 });

// ————————————————————— SALON —————————————————————

function sofa(color = 0x8a8f98): THREE.Group {
  const g = new THREE.Group();
  const fabric = mat(color, { rough: 0.95 });
  const W = 2.1, D = 0.95;

  const base = box(W, 0.32, D, fabric);
  base.position.y = 0.22;
  g.add(base);

  const back = box(W, 0.5, 0.18, fabric);
  back.position.set(0, 0.55, -D / 2 + 0.09);
  g.add(back);

  for (const sx of [-1, 1]) {
    const arm = box(0.2, 0.5, D, fabric);
    arm.position.set(sx * (W / 2 - 0.1), 0.42, 0);
    g.add(arm);
  }

  // poduchy siedziska
  for (const cx of [-0.52, 0, 0.52]) {
    const cushion = box(0.62, 0.16, D - 0.24, fabric);
    cushion.position.set(cx, 0.46, 0.02);
    g.add(cushion);
  }

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = cyl(0.03, 0.03, 0.1, METAL, 8);
    leg.position.set(sx * (W / 2 - 0.18), 0.05, sz * (D / 2 - 0.18));
    g.add(leg);
  }
  return g;
}

function armchair(color = 0xc9a24b): THREE.Group {
  const g = new THREE.Group();
  const fabric = mat(color, { rough: 0.95 });
  const W = 0.85, D = 0.9;
  const base = box(W, 0.3, D, fabric);
  base.position.y = 0.25;
  g.add(base);
  const cushion = box(W - 0.2, 0.14, D - 0.2, fabric);
  cushion.position.y = 0.47;
  g.add(cushion);
  const back = box(W, 0.55, 0.16, fabric);
  back.position.set(0, 0.55, -D / 2 + 0.08);
  g.add(back);
  for (const sx of [-1, 1]) {
    const arm = box(0.14, 0.4, D - 0.1, fabric);
    arm.position.set(sx * (W / 2 - 0.07), 0.45, 0);
    g.add(arm);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = cyl(0.025, 0.025, 0.12, METAL, 8);
    leg.position.set(sx * (W / 2 - 0.12), 0.06, sz * (D / 2 - 0.12));
    g.add(leg);
  }
  return g;
}

function coffeeTable(color = 0x6b4f3a): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(color);
  const top = box(1.1, 0.08, 0.6, wood);
  top.position.y = 0.4;
  g.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = box(0.06, 0.4, 0.06, METAL);
    leg.position.set(sx * 0.47, 0.2, sz * 0.24);
    g.add(leg);
  }
  return g;
}

function tvStand(color = 0xeef0f2): THREE.Group {
  const g = new THREE.Group();
  const body = mat(color);
  const W = 1.6, H = 0.45, D = 0.4;
  const cab = box(W, H, D, body);
  cab.position.y = H / 2 + 0.05;
  g.add(cab);
  // szuflady — linie frontów
  for (const dx of [-0.4, 0.4]) {
    const front = box(0.7, H - 0.1, 0.02, mat(color, { rough: 0.6 }));
    front.position.set(dx, H / 2 + 0.05, D / 2 + 0.001);
    g.add(front);
    const h = box(0.18, 0.02, 0.02, HANDLE);
    h.position.set(dx, H / 2 + 0.05, D / 2 + 0.02);
    g.add(h);
  }
  for (const sx of [-1, 1]) {
    const leg = box(0.05, 0.05, 0.05, METAL);
    leg.position.set(sx * (W / 2 - 0.1), 0.025, 0);
    g.add(leg);
  }
  return g;
}

function bookshelf(color = 0xb08d57): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(color);
  const W = 1.0, H = 1.8, D = 0.35, t = 0.04;
  for (const sx of [-1, 1]) {
    const side = box(t, H, D, wood);
    side.position.set(sx * (W / 2 - t / 2), H / 2, 0);
    g.add(side);
  }
  const back = box(W, H, t / 2, mat(color, { rough: 0.95 }));
  back.position.set(0, H / 2, -D / 2 + t / 4);
  g.add(back);
  const shelves = 5;
  for (let i = 0; i <= shelves; i++) {
    const shelf = box(W - t * 2, t, D, wood);
    shelf.position.set(0, (H / shelves) * i, 0);
    g.add(shelf);
  }
  return g;
}

function floorLamp(color = 0x2f3640): THREE.Group {
  const g = new THREE.Group();
  const metal = mat(color, { rough: 0.4, metal: 0.6 });
  const base = cyl(0.16, 0.18, 0.04, metal);
  base.position.y = 0.02;
  g.add(base);
  const pole = cyl(0.02, 0.02, 1.4, metal);
  pole.position.y = 0.72;
  g.add(pole);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf3e9d2, emissive: 0xffe9b0, emissiveIntensity: 0.6, roughness: 0.9 });
  const shade = cyl(0.14, 0.2, 0.28, shadeMat);
  shade.position.y = 1.5;
  g.add(shade);
  const bulb = new THREE.PointLight(0xffe9b0, 12, 6, 2);
  bulb.position.y = 1.45;
  g.add(bulb);
  return g;
}

function rug(color = 0xd9cbb8): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.03, 2.0), mat(color, { rough: 1.0 }));
  m.position.y = 0.015;
  m.receiveShadow = true;
  g.add(m);
  const border = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.031, 1.8), mat(0xffffff, { rough: 1.0 }));
  border.position.y = 0.016;
  g.add(border);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.032, 1.6), mat(color, { rough: 1.0 }));
  inner.position.y = 0.017;
  g.add(inner);
  return g;
}

function plant(color = 0x3f8f4f): THREE.Group {
  const g = new THREE.Group();
  const pot = cyl(0.2, 0.15, 0.35, mat(0xba6b46));
  pot.position.y = 0.175;
  g.add(pot);
  const soil = cyl(0.19, 0.19, 0.03, mat(0x2b2118));
  soil.position.y = 0.35;
  g.add(soil);
  const leafMat = mat(color, { rough: 0.8 });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), leafMat);
    leaf.scale.set(1, 1.6, 0.4);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.14, 0.7 + Math.random() * 0.35, Math.sin(a) * 0.14);
    leaf.rotation.set((Math.random() - 0.5) * 0.6, a, (Math.random() - 0.5) * 0.6);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

// ————————————————————— KUCHNIA —————————————————————

function cabinetBody(color: number, w: number, h: number, d: number, worktop = true): THREE.Group {
  const g = new THREE.Group();
  const body = mat(color, { rough: 0.7 });
  const carcass = box(w, h - (worktop ? 0.04 : 0), d, body);
  carcass.position.y = (h - (worktop ? 0.04 : 0)) / 2;
  g.add(carcass);
  if (worktop) {
    const top = box(w + 0.02, 0.04, d + 0.02, mat(0x39393d, { rough: 0.5 }));
    top.position.y = h - 0.02;
    g.add(top);
  }
  return g;
}

function baseCabinet(color = 0xeef0f2): THREE.Group {
  const g = cabinetBody(color, 0.6, 0.9, 0.6);
  const front = box(0.5, 0.5, 0.02, mat(color, { rough: 0.5 }));
  front.position.set(0, 0.55, 0.3);
  g.add(front);
  const handle = box(0.02, 0.15, 0.02, HANDLE);
  handle.position.set(0.18, 0.55, 0.32);
  g.add(handle);
  return g;
}

function tallCabinet(color = 0xeef0f2): THREE.Group {
  const g = cabinetBody(color, 0.6, 2.1, 0.6, false);
  for (const dy of [0.5, 1.55]) {
    const front = box(0.52, dy < 1 ? 0.9 : 1.0, 0.02, mat(color, { rough: 0.5 }));
    front.position.set(0, dy, 0.3);
    g.add(front);
    const handle = box(0.02, 0.18, 0.02, HANDLE);
    handle.position.set(0.2, dy, 0.32);
    g.add(handle);
  }
  return g;
}

function fridge(color = 0xc3c7cc): THREE.Group {
  const g = new THREE.Group();
  const steel = mat(color, { rough: 0.35, metal: 0.7 });
  const body = box(0.7, 1.9, 0.7, steel);
  body.position.y = 0.95;
  g.add(body);
  // linia podziału drzwi
  const split = box(0.72, 0.015, 0.72, mat(0x8a8d92, { metal: 0.6 }));
  split.position.y = 1.25;
  g.add(split);
  for (const dy of [0.55, 1.55]) {
    const handle = box(0.03, dy < 1 ? 0.5 : 0.7, 0.03, HANDLE);
    handle.position.set(-0.3, dy, 0.37);
    g.add(handle);
  }
  return g;
}

function stove(color = 0xc3c7cc): THREE.Group {
  const g = new THREE.Group();
  const steel = mat(color, { rough: 0.4, metal: 0.6 });
  const body = box(0.6, 0.85, 0.6, steel);
  body.position.y = 0.425;
  g.add(body);
  const cooktop = box(0.6, 0.03, 0.6, mat(0x1c1c1e, { rough: 0.3 }));
  cooktop.position.y = 0.865;
  g.add(cooktop);
  for (const bx of [-1, 1]) for (const bz of [-1, 1]) {
    const burner = cyl(0.08, 0.08, 0.01, mat(0x2b2b2e), 24);
    burner.position.set(bx * 0.15, 0.882, bz * 0.15);
    g.add(burner);
  }
  const oven = box(0.5, 0.4, 0.02, mat(0x101012, { rough: 0.2, metal: 0.3 }));
  oven.position.set(0, 0.42, 0.3);
  g.add(oven);
  const handle = box(0.42, 0.03, 0.04, HANDLE);
  handle.position.set(0, 0.62, 0.32);
  g.add(handle);
  return g;
}

function sink(color = 0xeef0f2): THREE.Group {
  const g = cabinetBody(color, 0.8, 0.9, 0.6);
  const basin = box(0.5, 0.12, 0.4, mat(0x9aa0a6, { rough: 0.3, metal: 0.7 }));
  basin.position.set(0, 0.86, 0);
  g.add(basin);
  const inner = box(0.44, 0.1, 0.34, mat(0x2b2b2e, { rough: 0.4 }));
  inner.position.set(0, 0.9, 0);
  g.add(inner);
  const tapBase = cyl(0.02, 0.02, 0.2, HANDLE);
  tapBase.position.set(0, 0.98, -0.2);
  g.add(tapBase);
  const spout = box(0.02, 0.02, 0.18, HANDLE);
  spout.position.set(0, 1.07, -0.12);
  g.add(spout);
  return g;
}

function island(color = 0x2f3640): THREE.Group {
  const g = cabinetBody(color, 1.6, 0.9, 0.9);
  const top = box(1.7, 0.05, 1.0, mat(0xe6e2da, { rough: 0.4 }));
  top.position.y = 0.9;
  g.add(top);
  for (const dx of [-0.4, 0.4]) {
    const front = box(0.5, 0.5, 0.02, mat(color, { rough: 0.5 }));
    front.position.set(dx, 0.55, 0.45);
    g.add(front);
    const handle = box(0.15, 0.02, 0.02, HANDLE);
    handle.position.set(dx, 0.78, 0.47);
    g.add(handle);
  }
  return g;
}

function barStool(color = 0x2f3640): THREE.Group {
  const g = new THREE.Group();
  const m = mat(color, { rough: 0.6 });
  const seat = cyl(0.2, 0.2, 0.05, m, 24);
  seat.position.y = 0.72;
  g.add(seat);
  const pole = cyl(0.03, 0.03, 0.7, METAL);
  pole.position.y = 0.37;
  g.add(pole);
  const foot = cyl(0.22, 0.22, 0.02, METAL, 24);
  foot.position.y = 0.02;
  g.add(foot);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 24), METAL);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);
  return g;
}

function diningTable(color = 0xb08d57): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(color);
  const top = box(1.8, 0.06, 0.9, wood);
  top.position.y = 0.74;
  g.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = box(0.08, 0.72, 0.08, wood);
    leg.position.set(sx * 0.8, 0.36, sz * 0.38);
    g.add(leg);
  }
  return g;
}

function diningChair(color = 0xb08d57): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(color);
  const seat = box(0.45, 0.05, 0.45, wood);
  seat.position.y = 0.46;
  g.add(seat);
  const back = box(0.45, 0.45, 0.05, wood);
  back.position.set(0, 0.7, -0.2);
  g.add(back);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = box(0.05, 0.46, 0.05, wood);
    leg.position.set(sx * 0.18, 0.23, sz * 0.18);
    g.add(leg);
  }
  return g;
}

// ————————————————————— REJESTR —————————————————————

const builders: Record<string, (color?: number) => THREE.Group> = {
  sofa, armchair, coffeeTable, tvStand, bookshelf, floorLamp, rug, plant,
  baseCabinet, tallCabinet, fridge, stove, sink, island, barStool, diningTable, diningChair,
};

function placeholder(color = 0xff00ff): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.5, 0.5, 0.5, mat(color)));
  return g;
}

/** Buduje model 3D dla podanego klucza z opcjonalnym kolorem. */
export function buildModel(model: string, color?: number): THREE.Group {
  const builder = builders[model] ?? placeholder;
  return builder(color);
}
