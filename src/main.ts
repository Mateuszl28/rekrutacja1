import './style.css';
import { SceneManager } from './scene/SceneManager';
import { Room, ROOM_LIMITS } from './scene/Room';
import { Planner } from './scene/Planner';
import { preloadModels } from './furniture/loader';
import { api, type OrderPayloadItem, type OrderSummary } from './api';
import { PRODUCTS } from './data/products';
import type { RoomKind, ProductDef, PlacedItemState } from './types';

const STORAGE_KEY = 'meblelab3d-projekt';
const CLOUD_ID_KEY = 'meblelab3d-cloud-id';
const WALL_COLORS = [0xe7ded3, 0xeef1f4, 0xd7e3dd, 0xe6d9d2, 0xdfe3ea, 0xcdd3da, 0x3b4a63, 0x2f3640];

const zl = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

// —————————————————————— SZKIELET UI ——————————————————————
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar">
    <div class="brand">
      <span class="logo">🛋️</span>
      <div>MebleLab 3D<small>sklep meblowy z planerem pomieszczeń</small></div>
    </div>
    <div class="seg" id="room-switch">
      <button data-room="living" class="active">🛋️ Salon</button>
      <button data-room="kitchen">🍳 Kuchnia</button>
    </div>
    <span class="spacer"></span>
    <span class="api-status offline" id="api-status" title="Status backendu koszyka">● API</span>
    <div class="tools">
      <button class="btn" id="btn-undo" title="Cofnij (Ctrl+Z)">↶</button>
      <button class="btn" id="btn-redo" title="Ponów (Ctrl+Y)">↷</button>
      <button class="btn" id="btn-view">⬜ Widok 2D</button>
      <button class="btn active" id="btn-snap">🧲 Siatka</button>
      <button class="btn" id="btn-reset" title="Reset kamery">🎯</button>
      <button class="btn" id="btn-shot" title="Zapisz zrzut PNG">📸</button>
      <button class="btn" id="btn-save">💾 Zapisz</button>
      <button class="btn" id="btn-load">📂 Wczytaj</button>
      <button class="btn" id="btn-orders" title="Historia zamówień (backend)">📋 Zamówienia</button>
      <button class="btn danger" id="btn-clear">🗑️</button>
    </div>
  </header>
  <div class="layout">
    <aside class="catalog">
      <div class="panel-head">Katalog</div>
      <div class="cat-tabs" id="cat-tabs">
        <button data-cat="living" class="active">Salon</button>
        <button data-cat="kitchen">Kuchnia</button>
      </div>
      <div class="cards" id="cards"></div>
      <div class="room-ctrl">
        <div class="panel-head" style="position:static;padding:0 0 8px">Pomieszczenie</div>
        <label class="ctrl">Szerokość <output id="out-w"></output>
          <input type="range" id="in-w" min="${ROOM_LIMITS.minW}" max="${ROOM_LIMITS.maxW}" step="0.5"></label>
        <label class="ctrl">Głębokość <output id="out-d"></output>
          <input type="range" id="in-d" min="${ROOM_LIMITS.minD}" max="${ROOM_LIMITS.maxD}" step="0.5"></label>
        <div class="area-info" id="area-info"></div>
        <div class="ctrl-label">Kolor ścian</div>
        <div class="wall-colors" id="wall-colors"></div>
      </div>
    </aside>
    <div class="viewport" id="viewport">
      <div class="hint" id="hint">Kliknij lub przeciągnij mebel z katalogu →</div>
      <div class="selpanel" id="selpanel"></div>
    </div>
    <aside class="cart">
      <div class="panel-head">Twój projekt / koszyk</div>
      <div class="cart-items" id="cart-items"></div>
      <div class="cart-foot">
        <div class="total-row"><span class="lbl">Razem</span><span class="val" id="total">0 zł</span></div>
        <button class="checkout" id="checkout" disabled>Zamów aranżację</button>
      </div>
    </aside>
  </div>
  <div class="toast" id="toast"></div>
  <div class="loading" id="loading">
    <div class="spinner"></div>
    <div id="loading-text">Ładowanie modeli 3D…</div>
  </div>
  <div class="modal-overlay" id="orders-modal">
    <div class="modal">
      <div class="modal-head"><span>📋 Historia zamówień</span><button class="modal-close" id="orders-close">✕</button></div>
      <div class="modal-body" id="orders-body"></div>
    </div>
  </div>
`;

// —————————————————————— SCENA 3D ——————————————————————
const viewport = document.querySelector<HTMLDivElement>('#viewport')!;
const sm = new SceneManager(viewport);
const room = new Room(sm.scene);
const planner = new Planner(sm, room);

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// —————————————————————— HISTORIA (cofnij/ponów) ——————————————————————
interface Snapshot {
  room: { kind: RoomKind; width: number; depth: number; wallColor: number };
  items: PlacedItemState[];
}
let history: string[] = [];
let histIndex = -1;
let restoring = false;

const snapshot = (): Snapshot => ({
  room: { kind: room.kind, width: room.width, depth: room.depth, wallColor: room.wallColor },
  items: planner.serialize(),
});

function pushHistory(): void {
  if (restoring) return;
  history = history.slice(0, histIndex + 1);
  history.push(JSON.stringify(snapshot()));
  if (history.length > 60) history.shift();
  histIndex = history.length - 1;
  updateHistoryButtons();
}

function applyState(s: Snapshot): void {
  restoring = true;
  room.setKind(s.room.kind);
  room.setSize(s.room.width, s.room.depth);
  room.setWallColor(s.room.wallColor);
  planner.load(s.items);
  planner.reclampAll();
  syncRoomUI();
  restoring = false;
}

function undo(): void {
  if (histIndex <= 0) return;
  histIndex--;
  applyState(JSON.parse(history[histIndex]));
  updateHistoryButtons();
}
function redo(): void {
  if (histIndex >= history.length - 1) return;
  histIndex++;
  applyState(JSON.parse(history[histIndex]));
  updateHistoryButtons();
}
function updateHistoryButtons(): void {
  $<HTMLButtonElement>('#btn-undo').disabled = histIndex <= 0;
  $<HTMLButtonElement>('#btn-redo').disabled = histIndex >= history.length - 1;
}

planner.onCommit = pushHistory;

// —————————————————————— KATALOG ——————————————————————
const cardsEl = $<HTMLDivElement>('#cards');
const chosenColor = new Map<string, number>();
let currentCat: RoomKind = 'living';

function renderCatalog(cat: RoomKind): void {
  const list = PRODUCTS.filter((p) => p.category === cat);
  cardsEl.innerHTML = list
    .map((p) => {
      const active = chosenColor.get(p.id) ?? p.colors[0];
      const swatches = p.colors
        .map(
          (c) =>
            `<span class="swatch" data-color="${c}" title="Kolor"
              style="background:${hex(c)};${c === active ? 'outline:2px solid var(--accent);outline-offset:1px;' : ''}"></span>`
        )
        .join('');
      return `
        <div class="card" draggable="true" data-id="${p.id}">
          <div class="row"><span class="name">${p.name}</span><span class="price">${zl.format(p.price)}</span></div>
          <div class="desc">${p.description}</div>
          <div class="meta">
            <span class="dims">${p.size[0]}×${p.size[2]} m</span>
            <span class="swatches">${p.colors.length > 1 ? swatches : ''}</span>
            <span class="add">Dodaj +</span>
          </div>
        </div>`;
    })
    .join('');
}

cardsEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const card = target.closest<HTMLDivElement>('.card');
  if (!card) return;
  const product = PRODUCTS.find((p) => p.id === card.dataset.id)!;
  const sw = target.closest<HTMLElement>('.swatch');
  if (sw) {
    chosenColor.set(product.id, Number(sw.dataset.color));
    renderCatalog(currentCat);
    return;
  }
  planner.addProduct(product, chosenColor.get(product.id));
});

// drag&drop z katalogu na scenę
cardsEl.addEventListener('dragstart', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLDivElement>('.card');
  if (!card || !e.dataTransfer) return;
  const id = card.dataset.id!;
  e.dataTransfer.setData('text/plain', JSON.stringify({ id, color: chosenColor.get(id) }));
  e.dataTransfer.effectAllowed = 'copy';
});
viewport.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});
viewport.addEventListener('drop', (e) => {
  e.preventDefault();
  if (!e.dataTransfer) return;
  try {
    const { id, color } = JSON.parse(e.dataTransfer.getData('text/plain'));
    const product = PRODUCTS.find((p) => p.id === id);
    if (product) planner.addProductAtScreen(product, color, e.clientX, e.clientY);
  } catch { /* ignoruj */ }
});

// zakładki katalogu
const catTabs = $<HTMLDivElement>('#cat-tabs');
catTabs.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!btn) return;
  currentCat = btn.dataset.cat as RoomKind;
  catTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
  renderCatalog(currentCat);
});

// —————————————————————— PRZEŁĄCZNIK POKOJU ——————————————————————
const roomSwitch = $<HTMLDivElement>('#room-switch');
roomSwitch.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!btn) return;
  const kind = btn.dataset.room as RoomKind;
  if (kind === room.kind) return;
  room.setKind(kind);
  planner.reclampAll();
  currentCat = kind;
  syncRoomUI();
  renderCatalog(currentCat);
  pushHistory();
});

// —————————————————————— KONFIGURACJA POKOJU ——————————————————————
const inW = $<HTMLInputElement>('#in-w');
const inD = $<HTMLInputElement>('#in-d');
const outW = $<HTMLOutputElement>('#out-w');
const outD = $<HTMLOutputElement>('#out-d');
const wallColorsEl = $<HTMLDivElement>('#wall-colors');

wallColorsEl.innerHTML = WALL_COLORS.map(
  (c) => `<span class="swatch" data-color="${c}" style="background:${hex(c)}"></span>`
).join('');

wallColorsEl.addEventListener('click', (e) => {
  const sw = (e.target as HTMLElement).closest<HTMLElement>('.swatch');
  if (!sw) return;
  room.setWallColor(Number(sw.dataset.color));
  syncRoomUI();
  pushHistory();
});

const areaInfo = $<HTMLDivElement>('#area-info');
const updateArea = () => {
  areaInfo.textContent = `Powierzchnia: ${room.area.toFixed(1)} m²`;
};

const onSize = () => {
  room.setSize(Number(inW.value), Number(inD.value));
  planner.reclampAll();
  outW.textContent = room.width.toFixed(1) + ' m';
  outD.textContent = room.depth.toFixed(1) + ' m';
  updateArea();
};
inW.addEventListener('input', onSize);
inD.addEventListener('input', onSize);
inW.addEventListener('change', pushHistory);
inD.addEventListener('change', pushHistory);

/** Synchronizuje kontrolki UI ze stanem pokoju (po zmianie/cofnięciu). */
function syncRoomUI(): void {
  roomSwitch.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.room === room.kind));
  catTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.cat === currentCat));
  inW.value = String(room.width);
  inD.value = String(room.depth);
  outW.textContent = room.width.toFixed(1) + ' m';
  outD.textContent = room.depth.toFixed(1) + ' m';
  wallColorsEl.querySelectorAll<HTMLElement>('.swatch').forEach((s) =>
    s.classList.toggle('active', Number(s.dataset.color) === room.wallColor)
  );
  updateArea();
}

// —————————————————————— PASEK NARZĘDZI ——————————————————————
let is2D = false;
const btnView = $<HTMLButtonElement>('#btn-view');
btnView.addEventListener('click', () => {
  is2D = !is2D;
  if (is2D) { sm.setTopView(); btnView.textContent = '🧊 Widok 3D'; btnView.classList.add('active'); }
  else { sm.setPerspectiveView(); btnView.textContent = '⬜ Widok 2D'; btnView.classList.remove('active'); }
});

const btnSnap = $<HTMLButtonElement>('#btn-snap');
btnSnap.addEventListener('click', () => {
  planner.snap = !planner.snap;
  btnSnap.classList.toggle('active', planner.snap);
});

$<HTMLButtonElement>('#btn-undo').addEventListener('click', undo);
$<HTMLButtonElement>('#btn-redo').addEventListener('click', redo);

$<HTMLButtonElement>('#btn-reset').addEventListener('click', () => {
  is2D = false;
  btnView.textContent = '⬜ Widok 2D';
  btnView.classList.remove('active');
  sm.setPerspectiveView();
});

$<HTMLButtonElement>('#btn-shot').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = sm.captureScreenshot();
  a.download = 'aranzacja-meblelab3d.png';
  a.click();
  toast('📸 Zapisano zrzut PNG');
});

$<HTMLButtonElement>('#btn-clear').addEventListener('click', () => {
  if (planner.items.length && confirm('Usunąć wszystkie meble z projektu?')) planner.clear();
});

$<HTMLButtonElement>('#btn-save').addEventListener('click', async () => {
  const snap = snapshot();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  const res = await api.saveCart(snap);
  if (res) {
    localStorage.setItem(CLOUD_ID_KEY, res.id);
    toast(`💾 Zapisano w chmurze (#${res.id.slice(0, 6)})`);
  } else {
    toast('💾 Zapisano lokalnie');
  }
});

$<HTMLButtonElement>('#btn-load').addEventListener('click', async () => {
  const cloudId = localStorage.getItem(CLOUD_ID_KEY);
  if (cloudId) {
    const r = await api.loadCart(cloudId);
    if (r?.snapshot) {
      applyState(r.snapshot);
      renderCatalog(currentCat);
      pushHistory();
      toast('📂 Wczytano z chmury');
      return;
    }
  }
  if (loadProject()) { pushHistory(); toast('📂 Wczytano lokalnie'); }
  else toast('Brak zapisanego projektu');
});

function loadProject(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    applyState(JSON.parse(raw) as Snapshot);
    renderCatalog(currentCat);
    return true;
  } catch {
    return false;
  }
}

// —————————————————————— PANEL ZAZNACZENIA ——————————————————————
const selpanel = $<HTMLDivElement>('#selpanel');
planner.onSelect = (item) => {
  if (!item) { selpanel.classList.remove('show'); return; }
  const [w, h, d] = item.product.size;
  const colors = item.product.colors
    .map((c) => `<span class="swatch ${c === item.color ? 'active' : ''}" data-color="${c}" style="background:${hex(c)}"></span>`)
    .join('');
  selpanel.innerHTML = `
    <div class="sel-info">
      <span class="title">${item.product.name}</span>
      <span class="sel-dims">${w}×${d}×${h} m · ${zl.format(item.product.price)}</span>
    </div>
    <span class="sel-warn" id="sp-warn">⚠ kolizja</span>
    ${item.product.colors.length > 1 ? `<div class="divider"></div><div class="colors">${colors}</div>` : ''}
    <div class="divider"></div>
    <button class="icon-btn" id="sp-rot" title="Obróć (R)">↻</button>
    <button class="icon-btn" id="sp-dup" title="Duplikuj (Ctrl+D)">⧉</button>
    <button class="icon-btn danger" id="sp-del" title="Usuń (Delete)">🗑️</button>
  `;
  selpanel.classList.add('show');
  selpanel.querySelectorAll<HTMLElement>('.colors .swatch').forEach((s) =>
    s.addEventListener('click', () => planner.recolorSelected(Number(s.dataset.color)))
  );
  $<HTMLButtonElement>('#sp-rot').addEventListener('click', () => planner.rotateSelected(Math.PI / 4));
  $<HTMLButtonElement>('#sp-dup').addEventListener('click', () => planner.duplicateSelected());
  $<HTMLButtonElement>('#sp-del').addEventListener('click', () => planner.deleteSelected());
  updateSelWarning();
};

function updateSelWarning(): void {
  const warn = document.querySelector<HTMLElement>('#sp-warn');
  if (warn) warn.style.display = planner.selected?.overlap ? 'inline-block' : 'none';
}
planner.onCollision = updateSelWarning;

// —————————————————————— KOSZYK ——————————————————————
const cartItemsEl = $<HTMLDivElement>('#cart-items');
const totalEl = $<HTMLSpanElement>('#total');
const checkoutBtn = $<HTMLButtonElement>('#checkout');
const hint = $<HTMLDivElement>('#hint');

planner.onChange = () => {
  const groups = new Map<string, { product: ProductDef; qty: number }>();
  for (const item of planner.items) {
    const g = groups.get(item.product.id) ?? { product: item.product, qty: 0 };
    g.qty++;
    groups.set(item.product.id, g);
  }
  hint.style.display = planner.items.length ? 'none' : '';
  if (groups.size === 0) {
    cartItemsEl.innerHTML = `<div class="cart-empty">Koszyk jest pusty.<br>Dodaj meble z katalogu, a pojawią się tutaj.</div>`;
  } else {
    cartItemsEl.innerHTML = [...groups.values()]
      .map(
        ({ product, qty }) => `
        <div class="cart-item">
          <div><div class="ci-name"><span class="qty-badge">${qty}×</span>${product.name}</div>
          <div class="ci-sub">${zl.format(product.price)} / szt.</div></div>
          <div class="ci-price">${zl.format(product.price * qty)}</div>
        </div>`
      )
      .join('');
  }
  const total = planner.items.reduce((s, i) => s + i.product.price, 0);
  totalEl.textContent = zl.format(total);
  checkoutBtn.disabled = planner.items.length === 0;
};

function orderItems(): OrderPayloadItem[] {
  const map = new Map<string, OrderPayloadItem>();
  for (const it of planner.items) {
    const e = map.get(it.product.id) ?? { productId: it.product.id, name: it.product.name, price: it.product.price, qty: 0 };
    e.qty++;
    map.set(it.product.id, e);
  }
  return [...map.values()];
}

checkoutBtn.addEventListener('click', async () => {
  if (!planner.items.length) return;
  if (planner.hasOverlaps()) { toast('⚠ Popraw kolizje mebli przed zamówieniem'); return; }
  const total = planner.items.reduce((s, i) => s + i.product.price, 0);
  checkoutBtn.disabled = true;
  const res = await api.placeOrder({ items: orderItems(), total, room: room.kind });
  checkoutBtn.disabled = false;
  if (res) {
    toast(`✅ Zamówienie #${res.orderNo} przyjęte — ${zl.format(total)}`);
    refreshApiStatus();
  } else {
    toast(`✅ Zamówienie złożone (offline) — ${zl.format(total)}`);
  }
});

async function refreshApiStatus(): Promise<void> {
  const el = $<HTMLSpanElement>('#api-status');
  const h = await api.health();
  if (h) {
    el.textContent = `● API · ${h.orders} zam.`;
    el.classList.add('online');
    el.classList.remove('offline');
    el.title = 'Backend koszyka online';
  } else {
    el.textContent = '● API offline';
    el.classList.add('offline');
    el.classList.remove('online');
    el.title = 'Backend offline — uruchom „npm run dev:full”. Aplikacja działa lokalnie.';
  }
}

// —————————————————————— HISTORIA ZAMÓWIEŃ (modal) ——————————————————————
const ordersModal = $<HTMLDivElement>('#orders-modal');
const ordersBody = $<HTMLDivElement>('#orders-body');
const dtFmt = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' });

function renderOrder(o: OrderSummary): string {
  const roomName = o.room === 'kitchen' ? 'Kuchnia' : o.room === 'living' ? 'Salon' : '—';
  return `<div class="order-row">
    <div><div class="order-no">Zamówienie #${o.orderNo}</div>
    <div class="order-meta">${dtFmt.format(new Date(o.createdAt))} · ${roomName} · ${o.count} mebli</div></div>
    <div class="order-total">${zl.format(o.total)}</div>
  </div>`;
}

$<HTMLButtonElement>('#btn-orders').addEventListener('click', async () => {
  ordersBody.innerHTML = '<div class="orders-empty">Ładowanie…</div>';
  ordersModal.classList.add('show');
  const orders = await api.listOrders();
  if (!orders) {
    ordersBody.innerHTML = '<div class="orders-empty">Backend offline. Uruchom „npm run dev:full”, aby zapisywać i przeglądać zamówienia.</div>';
    return;
  }
  if (orders.length === 0) {
    ordersBody.innerHTML = '<div class="orders-empty">Brak zamówień. Złóż pierwsze przyciskiem „Zamów aranżację”.</div>';
    return;
  }
  ordersBody.innerHTML = orders.slice().reverse().map(renderOrder).join('');
});

$<HTMLButtonElement>('#orders-close').addEventListener('click', () => ordersModal.classList.remove('show'));
ordersModal.addEventListener('click', (e) => {
  if (e.target === ordersModal) ordersModal.classList.remove('show');
});

// —————————————————————— SKRÓTY KLAWISZOWE ——————————————————————
window.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); planner.duplicateSelected(); }
  else if (e.key === 'r' || e.key === 'R') planner.rotateSelected(Math.PI / 4);
  else if (e.key === 'Delete' || e.key === 'Backspace') planner.deleteSelected();
  else if (e.key === 'ArrowLeft') { e.preventDefault(); planner.nudgeSelected(-1, 0); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); planner.nudgeSelected(1, 0); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); planner.nudgeSelected(0, -1); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); planner.nudgeSelected(0, 1); }
  else if (e.key === 'Escape') {
    if (ordersModal.classList.contains('show')) ordersModal.classList.remove('show');
    else planner.select(null);
  }
});

// —————————————————————— TOAST ——————————————————————
const toastEl = $<HTMLDivElement>('#toast');
let toastTimer: number | undefined;
function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// —————————————————————— START ——————————————————————
const loadingEl = $<HTMLDivElement>('#loading');
const loadingText = $<HTMLDivElement>('#loading-text');

renderCatalog('living');
syncRoomUI();
planner.onChange();

(async () => {
  try {
    await preloadModels((loaded, total) => {
      loadingText.textContent = `Ładowanie modeli 3D… ${loaded}/${total}`;
    });
  } catch (e) {
    console.error('Błąd ładowania modeli .glb — uruchom „npm run models”.', e);
    loadingText.textContent = 'Błąd ładowania modeli. Uruchom „npm run models”.';
    return;
  }
  loadingEl.classList.add('hide');
  if (localStorage.getItem(STORAGE_KEY)) loadProject();
  pushHistory(); // stan początkowy w historii
  updateHistoryButtons();
  refreshApiStatus();
})();
