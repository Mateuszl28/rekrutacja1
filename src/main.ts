import './style.css';
import { SceneManager } from './scene/SceneManager';
import { Room, ROOM_LIMITS } from './scene/Room';
import { Planner } from './scene/Planner';
import { preloadModels } from './furniture/loader';
import { renderThumbnails } from './furniture/thumbnails';
import { api, type OrderPayloadItem, type OrderSummary } from './api';
import { PRODUCTS, getProduct } from './data/products';
import { TEMPLATES } from './data/templates';
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
      <div class="tool-group">
        <button class="btn icon" id="btn-undo" title="Cofnij (Ctrl+Z)">↶</button>
        <button class="btn icon" id="btn-redo" title="Ponów (Ctrl+Y)">↷</button>
      </div>
      <div class="tool-group">
        <button class="btn" id="btn-view" title="Rzut z góry / 3D">⬜ 2D</button>
        <button class="btn active" id="btn-snap" title="Przyciąganie do siatki">🧲</button>
        <button class="btn icon" id="btn-reset" title="Reset kamery">🎯</button>
      </div>
      <button class="btn" id="btn-templates" title="Gotowe aranżacje">✨ Aranżacje</button>
      <div class="menu-wrap">
        <button class="btn" id="btn-menu" title="Więcej opcji">⋯ Menu</button>
        <div class="menu" id="menu" hidden>
          <button class="menu-item" id="btn-projects">📁 Moje projekty</button>
          <button class="menu-item" id="btn-orders">📋 Historia zamówień</button>
          <div class="menu-sep"></div>
          <button class="menu-item" id="btn-save">💾 Zapisz projekt</button>
          <button class="menu-item" id="btn-load">📂 Wczytaj projekt</button>
          <div class="menu-sep"></div>
          <button class="menu-item" id="btn-print">🧾 Podsumowanie / PDF</button>
          <button class="menu-item" id="btn-shot">📸 Zrzut ekranu PNG</button>
          <div class="menu-sep"></div>
          <button class="menu-item danger" id="btn-clear">🗑️ Wyczyść projekt</button>
        </div>
      </div>
    </div>
  </header>
  <div class="layout">
    <aside class="catalog">
      <div class="panel-head">Katalog</div>
      <div class="cat-tabs" id="cat-tabs">
        <button data-cat="living" class="active">Salon</button>
        <button data-cat="kitchen">Kuchnia</button>
      </div>
      <input class="cat-search" id="cat-search" type="search" placeholder="🔍 Szukaj mebla…" />
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
        <label class="ctrl" style="margin-top:12px">Pora dnia <output id="out-day"></output>
          <input type="range" id="in-day" min="0" max="1" step="0.02" value="0.85"></label>
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
  <div class="modal-overlay" id="projects-modal">
    <div class="modal">
      <div class="modal-head"><span>📁 Moje projekty</span><button class="modal-close" id="projects-close">✕</button></div>
      <div class="modal-body" id="projects-body"></div>
      <div class="modal-foot"><button class="checkout" id="project-saveas">💾 Zapisz bieżący jako…</button></div>
    </div>
  </div>
  <div class="modal-overlay" id="templates-modal">
    <div class="modal">
      <div class="modal-head"><span>✨ Gotowe aranżacje</span><button class="modal-close" id="templates-close">✕</button></div>
      <div class="modal-body" id="templates-body"></div>
    </div>
  </div>
  <div class="modal-overlay" id="checkout-modal">
    <div class="modal">
      <div class="modal-head"><span>🛒 Zamówienie</span><button class="modal-close" id="checkout-close">✕</button></div>
      <div class="stepper" id="stepper">
        <div class="step active" data-s="1"><b>1</b> Koszyk</div>
        <div class="step" data-s="2"><b>2</b> Dane i dostawa</div>
        <div class="step" data-s="3"><b>3</b> Potwierdzenie</div>
      </div>
      <div class="modal-body">
        <div class="cstep" id="cstep-1"></div>
        <div class="cstep" id="cstep-2" hidden>
          <div class="form-grid">
            <label class="fg-full">Imię i nazwisko *<input id="co-name" type="text" autocomplete="name" placeholder="Jan Kowalski"></label>
            <label>E-mail *<input id="co-email" type="email" autocomplete="email" placeholder="jan@example.com"></label>
            <label>Telefon<input id="co-phone" type="tel" autocomplete="tel" placeholder="600 000 000"></label>
            <div class="fg-full delivery">
              <span class="ctrl-label">Dostawa</span>
              <label class="radio"><input type="radio" name="co-del" value="Kurier" checked> 🚚 Kurier (0 zł)</label>
              <label class="radio"><input type="radio" name="co-del" value="Odbiór osobisty"> 🏬 Odbiór osobisty</label>
            </div>
            <label class="fg-full" id="co-addr-wrap">Adres dostawy *<input id="co-addr" type="text" autocomplete="street-address" placeholder="ul. Przykładowa 1, 00-000 Miasto"></label>
          </div>
          <div class="form-err" id="co-err" hidden></div>
        </div>
        <div class="cstep" id="cstep-3" hidden></div>
      </div>
      <div class="modal-foot" id="checkout-foot"></div>
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
let searchQuery = '';
let thumbs: Map<string, string> | null = null;

function renderCatalog(cat: RoomKind): void {
  const q = searchQuery.trim().toLowerCase();
  const list = PRODUCTS.filter(
    (p) => p.category === cat && (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
  );
  if (list.length === 0) {
    cardsEl.innerHTML = `<div class="cart-empty">Brak mebli dla „${searchQuery}”.</div>`;
    return;
  }
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
      const thumb = thumbs?.get(p.id);
      return `
        <div class="card" draggable="true" data-id="${p.id}">
          ${thumb ? `<img class="thumb" src="${thumb}" alt="${p.name}" draggable="false">` : ''}
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

// wyszukiwarka katalogu
$<HTMLInputElement>('#cat-search').addEventListener('input', (e) => {
  searchQuery = (e.target as HTMLInputElement).value;
  renderCatalog(currentCat);
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

// pora dnia (oświetlenie sceny)
const inDay = $<HTMLInputElement>('#in-day');
const outDay = $<HTMLOutputElement>('#out-day');
const dayLabel = (v: number) => (v < 0.25 ? '🌙 noc' : v < 0.55 ? '🌆 zmierzch' : v < 0.82 ? '⛅ popołudnie' : '☀️ dzień');
const onDay = () => {
  const v = Number(inDay.value);
  sm.setDaylight(v);
  outDay.textContent = dayLabel(v);
};
inDay.addEventListener('input', onDay);
onDay();

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
        <div class="cart-item" data-id="${product.id}" title="Kliknij, aby wyśrodkować w scenie">
          <div><div class="ci-name"><span class="qty-badge">${qty}×</span>${product.name}</div>
          <div class="ci-sub">${zl.format(product.price)} / szt.</div></div>
          <div class="ci-right">
            <span class="ci-price">${zl.format(product.price * qty)}</span>
            <button class="ci-remove" data-remove="${product.id}" title="Usuń jedną sztukę">−</button>
          </div>
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

cartItemsEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const removeId = target.dataset.remove;
  if (removeId) {
    e.stopPropagation();
    planner.removeOneOfProduct(removeId);
    return;
  }
  const row = target.closest<HTMLDivElement>('.cart-item');
  if (row?.dataset.id) planner.focusProduct(row.dataset.id);
});

// menu rozwijane („⋯ Menu")
const menuEl = $<HTMLDivElement>('#menu');
const btnMenu = $<HTMLButtonElement>('#btn-menu');
btnMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  const willOpen = menuEl.hidden;
  menuEl.hidden = !willOpen;
  btnMenu.classList.toggle('active', willOpen);
});
document.addEventListener('click', () => {
  if (!menuEl.hidden) { menuEl.hidden = true; btnMenu.classList.remove('active'); }
});

// —————————————————————— PROCES ZAMÓWIENIA (checkout) ——————————————————————
const checkoutModal = $<HTMLDivElement>('#checkout-modal');
const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const totalOf = () => planner.items.reduce((s, i) => s + i.product.price, 0);

function openCheckout(): void {
  if (!planner.items.length) { toast('Dodaj meble do projektu, aby zamówić'); return; }
  if (planner.hasOverlaps()) { toast('⚠ Popraw kolizje mebli przed zamówieniem'); return; }
  gotoStep(1);
  checkoutModal.classList.add('show');
}

function updateAddrVisibility(): void {
  const method = (document.querySelector('input[name="co-del"]:checked') as HTMLInputElement)?.value;
  $<HTMLElement>('#co-addr-wrap').hidden = method !== 'Kurier';
}

function gotoStep(n: number): void {
  for (const s of [1, 2, 3]) $<HTMLElement>(`#cstep-${s}`).hidden = s !== n;
  document.querySelectorAll<HTMLElement>('#stepper .step').forEach((el) => {
    const s = Number(el.dataset.s);
    el.classList.toggle('active', s === n);
    el.classList.toggle('done', s < n);
  });
  const foot = $<HTMLDivElement>('#checkout-foot');
  if (n === 1) {
    const items = orderItems();
    $<HTMLDivElement>('#cstep-1').innerHTML =
      `<div class="co-cart">${items
        .map((i) => `<div class="cart-item"><div><div class="ci-name"><span class="qty-badge">${i.qty}×</span>${i.name}</div><div class="ci-sub">${zl.format(i.price)} / szt.</div></div><div class="ci-price">${zl.format(i.price * i.qty)}</div></div>`)
        .join('')}</div><div class="co-total"><span>Razem</span><b>${zl.format(totalOf())}</b></div>`;
    foot.innerHTML = `<button class="btn" id="co-cancel">Anuluj</button><button class="checkout" id="co-next">Dalej: dane →</button>`;
    $<HTMLButtonElement>('#co-cancel').onclick = () => checkoutModal.classList.remove('show');
    $<HTMLButtonElement>('#co-next').onclick = () => gotoStep(2);
  } else if (n === 2) {
    foot.innerHTML = `<button class="btn" id="co-back">← Wstecz</button><button class="checkout" id="co-submit">Złóż zamówienie</button>`;
    $<HTMLButtonElement>('#co-back').onclick = () => gotoStep(1);
    $<HTMLButtonElement>('#co-submit').onclick = submitOrder;
    updateAddrVisibility();
  } else {
    foot.innerHTML = `<button class="checkout" id="co-done">Zamknij</button>`;
    $<HTMLButtonElement>('#co-done').onclick = () => checkoutModal.classList.remove('show');
  }
}

async function submitOrder(): Promise<void> {
  const val = (id: string) => ($<HTMLInputElement>(id).value || '').trim();
  const name = val('#co-name');
  const email = val('#co-email');
  const phone = val('#co-phone');
  const method = (document.querySelector('input[name="co-del"]:checked') as HTMLInputElement)?.value || 'Kurier';
  const address = val('#co-addr');
  const err = $<HTMLDivElement>('#co-err');
  const problems: string[] = [];
  if (name.length < 3) problems.push('imię i nazwisko');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push('poprawny e-mail');
  if (method === 'Kurier' && address.length < 5) problems.push('adres dostawy');
  if (problems.length) { err.hidden = false; err.textContent = 'Uzupełnij: ' + problems.join(', ') + '.'; return; }
  err.hidden = true;

  const submitBtn = $<HTMLButtonElement>('#co-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Wysyłanie…';
  const total = totalOf();
  const res = await api.placeOrder({
    items: orderItems(),
    total,
    room: room.kind,
    customer: { name, email, phone },
    delivery: { method, address: method === 'Kurier' ? address : '—' },
  });
  refreshApiStatus();
  const no = res ? `#${res.orderNo}` : '(offline)';
  $<HTMLDivElement>('#cstep-3').innerHTML =
    `<div class="co-confirm"><div class="co-check">✅</div><h3>Dziękujemy, ${escHtml(name)}!</h3>
    <p>Zamówienie <b>${no}</b> zostało przyjęte.</p>
    <p class="co-sub">${escHtml(method)}${method === 'Kurier' ? ' → ' + escHtml(address) : ''}<br>Potwierdzenie wyślemy na <b>${escHtml(email)}</b>.</p>
    <div class="co-total"><span>Wartość</span><b>${zl.format(total)}</b></div></div>`;
  gotoStep(3);
}

checkoutBtn.addEventListener('click', openCheckout);
$<HTMLButtonElement>('#checkout-close').addEventListener('click', () => checkoutModal.classList.remove('show'));
checkoutModal.addEventListener('click', (e) => { if (e.target === checkoutModal) checkoutModal.classList.remove('show'); });
document.querySelectorAll('input[name="co-del"]').forEach((r) => r.addEventListener('change', updateAddrVisibility));

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

// —————————————————————— MENEDŻER PROJEKTÓW (modal) ——————————————————————
const projectsModal = $<HTMLDivElement>('#projects-modal');
const projectsBody = $<HTMLDivElement>('#projects-body');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function openProjects(): Promise<void> {
  projectsBody.innerHTML = '<div class="orders-empty">Ładowanie…</div>';
  projectsModal.classList.add('show');
  const list = await api.listProjects();
  if (!list) {
    projectsBody.innerHTML = '<div class="orders-empty">Backend offline. Uruchom „npm run dev:full”, aby zapisywać projekty w chmurze.</div>';
    return;
  }
  if (list.length === 0) {
    projectsBody.innerHTML = '<div class="orders-empty">Brak projektów. Użyj „Zapisz bieżący jako…” poniżej.</div>';
    return;
  }
  projectsBody.innerHTML = list
    .map((p) => {
      const roomName = p.room === 'kitchen' ? 'Kuchnia' : p.room === 'living' ? 'Salon' : '—';
      return `<div class="order-row">
        <div><div class="order-no">${esc(p.name)}</div>
        <div class="order-meta">${dtFmt.format(new Date(p.savedAt))} · ${roomName} · ${p.count} mebli</div></div>
        <div class="proj-actions">
          <button class="btn" data-load="${p.id}">Wczytaj</button>
          <button class="btn danger" data-del="${p.id}">Usuń</button>
        </div>
      </div>`;
    })
    .join('');
}

$<HTMLButtonElement>('#btn-projects').addEventListener('click', openProjects);
$<HTMLButtonElement>('#projects-close').addEventListener('click', () => projectsModal.classList.remove('show'));
projectsModal.addEventListener('click', (e) => {
  if (e.target === projectsModal) projectsModal.classList.remove('show');
});

projectsBody.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  if (t.dataset.load) {
    const r = await api.loadProject(t.dataset.load);
    if (r?.snapshot) {
      applyState(r.snapshot);
      renderCatalog(currentCat);
      pushHistory();
      projectsModal.classList.remove('show');
      toast('📂 Wczytano projekt');
    } else {
      toast('Nie udało się wczytać projektu');
    }
  } else if (t.dataset.del) {
    if (confirm('Usunąć ten projekt?')) {
      await api.deleteProject(t.dataset.del);
      openProjects();
    }
  }
});

$<HTMLButtonElement>('#project-saveas').addEventListener('click', async () => {
  const name = prompt('Nazwa projektu:', currentCat === 'kitchen' ? 'Moja kuchnia' : 'Mój salon');
  if (!name) return;
  const res = await api.saveProject(name, snapshot());
  if (res) { toast('💾 Zapisano projekt w chmurze'); openProjects(); }
  else toast('Backend offline — nie zapisano');
});

// —————————————————————— GOTOWE ARANŻACJE (modal) ——————————————————————
const templatesModal = $<HTMLDivElement>('#templates-modal');
const templatesBody = $<HTMLDivElement>('#templates-body');
templatesBody.innerHTML = TEMPLATES.map(
  (t) => `
    <div class="order-row tpl-row" data-tpl="${t.id}">
      <div><div class="order-no">${t.name}</div><div class="order-meta">${t.description}</div></div>
      <button class="btn" data-tpl="${t.id}">Wstaw →</button>
    </div>`
).join('');

$<HTMLButtonElement>('#btn-templates').addEventListener('click', () => templatesModal.classList.add('show'));
$<HTMLButtonElement>('#templates-close').addEventListener('click', () => templatesModal.classList.remove('show'));
templatesModal.addEventListener('click', (e) => {
  if (e.target === templatesModal) templatesModal.classList.remove('show');
});
templatesBody.addEventListener('click', (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-tpl]')?.dataset.tpl;
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return;
  const snap = {
    room: t.room,
    items: t.items.map((i) => ({ productId: i.productId, x: i.x, z: i.z, ry: i.ry, color: getProduct(i.productId)?.colors[0] ?? 0xcccccc })),
  };
  currentCat = t.room.kind;
  applyState(snap);
  renderCatalog(currentCat);
  pushHistory();
  templatesModal.classList.remove('show');
  toast(`✨ Wstawiono aranżację „${t.name}”`);
});

// —————————————————————— WYDRUK / PDF ——————————————————————
$<HTMLButtonElement>('#btn-print').addEventListener('click', () => {
  const shot = sm.captureScreenshot();
  const groups = new Map<string, { product: ProductDef; qty: number }>();
  for (const it of planner.items) {
    const g = groups.get(it.product.id) ?? { product: it.product, qty: 0 };
    g.qty++;
    groups.set(it.product.id, g);
  }
  const total = planner.items.reduce((s, i) => s + i.product.price, 0);
  const rows = [...groups.values()]
    .map(({ product, qty }) => `<tr><td>${product.name}</td><td class="c">${qty}</td><td class="r">${zl.format(product.price)}</td><td class="r">${zl.format(product.price * qty)}</td></tr>`)
    .join('');
  const roomName = room.kind === 'kitchen' ? 'Kuchnia' : 'Salon';
  const date = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { toast('Zezwól na wyskakujące okna, aby wydrukować'); return; }
  w.document.write(`<!doctype html><html lang="pl"><head><meta charset="utf-8">
  <title>MebleLab 3D — podsumowanie aranżacji</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1a2029;margin:36px;max-width:800px}
    header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ffb020;padding-bottom:12px;margin-bottom:20px}
    h1{margin:0;font-size:22px}.sub{color:#666;font-size:13px}
    img{width:100%;border-radius:10px;border:1px solid #ddd;margin-bottom:20px}
    table{width:100%;border-collapse:collapse;font-size:14px}
    th,td{padding:9px 10px;border-bottom:1px solid #eee}
    th{text-align:left;color:#888;font-size:12px;text-transform:uppercase}
    td.c{text-align:center}td.r{text-align:right}
    tfoot td{font-weight:700;font-size:16px;border-top:2px solid #333;border-bottom:none}
    .meta{color:#666;font-size:13px;margin-bottom:16px}
  </style></head><body>
    <header><div><h1>🛋️ MebleLab 3D</h1><div class="sub">Podsumowanie aranżacji</div></div>
    <div class="sub">${date}</div></header>
    <div class="meta">Pomieszczenie: <b>${roomName}</b> ${room.width.toFixed(1)}×${room.depth.toFixed(1)} m (${room.area.toFixed(1)} m²) · pozycji: <b>${planner.items.length}</b></div>
    <img src="${shot}" alt="Aranżacja">
    <table><thead><tr><th>Produkt</th><th class="c">Ilość</th><th class="r">Cena</th><th class="r">Wartość</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4" style="color:#888">Brak mebli w projekcie.</td></tr>'}</tbody>
    <tfoot><tr><td colspan="3">Razem</td><td class="r">${zl.format(total)}</td></tr></tfoot></table>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`);
  w.document.close();
});

// —————————————————————— SKRÓTY KLAWISZOWE ——————————————————————
window.addEventListener('keydown', (e) => {
  // nie przechwytuj skrótów podczas pisania w polach tekstowych
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
    if (checkoutModal.classList.contains('show')) checkoutModal.classList.remove('show');
    else if (ordersModal.classList.contains('show')) ordersModal.classList.remove('show');
    else if (projectsModal.classList.contains('show')) projectsModal.classList.remove('show');
    else if (templatesModal.classList.contains('show')) templatesModal.classList.remove('show');
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
  loadingText.textContent = 'Generowanie miniatur…';
  thumbs = renderThumbnails(PRODUCTS);
  renderCatalog(currentCat);
  loadingEl.classList.add('hide');
  if (localStorage.getItem(STORAGE_KEY)) loadProject();
  pushHistory(); // stan początkowy w historii
  updateHistoryButtons();
  refreshApiStatus();
})();
