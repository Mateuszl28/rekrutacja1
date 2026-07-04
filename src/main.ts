import './style.css';
import { SceneManager } from './scene/SceneManager';
import { Room, ROOM_LIMITS } from './scene/Room';
import { Planner } from './scene/Planner';
import { preloadModels } from './furniture/loader';
import { renderThumbnails, renderThumbnail } from './furniture/thumbnails';
import { ProductPreview } from './furniture/preview';
import { api, type OrderPayloadItem, type OrderSummary } from './api';
import { PRODUCTS, getProduct, getVariant, effectiveSize, effectivePrice } from './data/products';
import { TEMPLATES } from './data/templates';
import { SETS } from './data/sets';
import type { RoomKind, ProductDef, PlacedItemState } from './types';

const STORAGE_KEY = 'meblelab3d-projekt';
const CLOUD_ID_KEY = 'meblelab3d-cloud-id';
const THEME_KEY = 'meblelab3d-theme';
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
      <button class="btn icon mobile-only" id="m-catalog" title="Katalog">🛒</button>
      <button class="btn icon mobile-only" id="m-cart" title="Koszyk">🧾</button>
      <div class="tool-group">
        <button class="btn icon" id="btn-undo" title="Cofnij (Ctrl+Z)">↶</button>
        <button class="btn icon" id="btn-redo" title="Ponów (Ctrl+Y)">↷</button>
      </div>
      <div class="tool-group">
        <button class="btn" id="btn-view" title="Rzut z góry / 3D">⬜ 2D</button>
        <button class="btn active" id="btn-snap" title="Przyciąganie do siatki">🧲</button>
        <button class="btn icon" id="btn-reset" title="Reset kamery">🎯</button>
        <button class="btn icon" id="btn-theme" title="Motyw jasny / ciemny">🌗</button>
        <button class="btn icon" id="btn-help" title="Pomoc / skróty">❓</button>
      </div>
      <button class="btn" id="btn-templates" title="Gotowe aranżacje">✨ Aranżacje</button>
      <div class="menu-wrap">
        <button class="btn" id="btn-menu" title="Więcej opcji">⋯ Menu</button>
        <div class="menu" id="menu" hidden>
          <button class="menu-item" id="btn-projects">📁 Moje projekty</button>
          <button class="menu-item" id="btn-orders">📋 Historia zamówień</button>
          <button class="menu-item" id="btn-admin">🛠️ Panel obsługi zamówień</button>
          <div class="menu-sep"></div>
          <button class="menu-item" id="btn-save">💾 Zapisz projekt</button>
          <button class="menu-item" id="btn-load">📂 Wczytaj projekt</button>
          <div class="menu-sep"></div>
          <button class="menu-item" id="btn-print">🧾 Podsumowanie / PDF</button>
          <button class="menu-item" id="btn-plan">📐 Rzut 2D z wymiarami</button>
          <button class="menu-item" id="btn-shot">📸 Zrzut ekranu PNG</button>
          <div class="menu-sep"></div>
          <button class="menu-item danger" id="btn-clear">🗑️ Wyczyść projekt</button>
        </div>
      </div>
    </div>
  </header>
  <div class="layout">
    <aside class="catalog" id="catalog-aside">
      <div class="panel-head">Katalog <button class="drawer-close mobile-only" data-drawer="catalog">✕</button></div>
      <div class="cat-tabs" id="cat-tabs">
        <button data-cat="living" class="active">Salon</button>
        <button data-cat="kitchen">Kuchnia</button>
      </div>
      <div class="cat-controls">
        <input class="cat-search" id="cat-search" type="search" placeholder="🔍 Szukaj…" />
        <select class="cat-sort" id="cat-sort" title="Sortowanie">
          <option value="default">Polecane</option>
          <option value="price-asc">Cena ↑</option>
          <option value="price-desc">Cena ↓</option>
          <option value="name">Nazwa A–Z</option>
        </select>
      </div>
      <div class="price-chips" id="price-chips">
        <button class="chip active" data-price="all">Każda cena</button>
        <button class="chip" data-price="0-500">do 500 zł</button>
        <button class="chip" data-price="500-1500">500–1500 zł</button>
        <button class="chip" data-price="1500-">1500+ zł</button>
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
        <label class="custom-color"><input type="color" id="wall-custom"><span>Własny kolor ścian</span></label>
        <label class="ctrl" style="margin-top:12px">Pora dnia <output id="out-day"></output>
          <input type="range" id="in-day" min="0" max="1" step="0.02" value="0.85"></label>
      </div>
    </aside>
    <div class="viewport" id="viewport">
      <div class="hint" id="hint">Kliknij lub przeciągnij mebel z katalogu →</div>
      <div class="measure-hud" id="measure-hud" hidden></div>
      <div class="selpanel" id="selpanel"></div>
    </div>
    <aside class="cart" id="cart-aside">
      <div class="panel-head">Twój projekt / koszyk <button class="drawer-close mobile-only" data-drawer="cart">✕</button></div>
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
  <div class="modal-overlay" id="product-modal">
    <div class="modal product-modal">
      <div class="modal-head"><span id="pm-title">Produkt</span><button class="modal-close" id="pm-close">✕</button></div>
      <div class="pm-body">
        <div class="pm-preview">
          <canvas id="pm-canvas"></canvas>
          <div class="pm-hint">↔ przeciągnij, aby obrócić</div>
        </div>
        <div class="pm-info">
          <p class="pm-desc" id="pm-desc"></p>
          <div class="pm-dims" id="pm-dims"></div>
          <div id="pm-variant-wrap"></div>
          <div class="pm-colors" id="pm-colors"></div>
          <div class="pm-foot">
            <span class="pm-price" id="pm-price"></span>
            <button class="checkout" id="pm-add">Dodaj do projektu +</button>
          </div>
        </div>
      </div>
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
              <label class="radio"><input type="radio" name="co-del" value="Kurier" data-cost="19" checked> 🚚 Kurier — 19 zł</label>
              <label class="radio"><input type="radio" name="co-del" value="Kurier ekspres" data-cost="39"> ⚡ Ekspres 24h — 39 zł</label>
              <label class="radio"><input type="radio" name="co-del" value="Odbiór osobisty" data-cost="0"> 🏬 Odbiór — 0 zł</label>
            </div>
            <label class="fg-full" id="co-addr-wrap">Adres dostawy *<input id="co-addr" type="text" autocomplete="street-address" placeholder="ul. Przykładowa 1, 00-000 Miasto"></label>
            <div class="fg-full promo-row">
              <input id="co-promo" type="text" placeholder="Kod rabatowy (MEBLE10, GRATIS)">
              <button class="btn" id="co-promo-apply" type="button">Zastosuj</button>
            </div>
          </div>
          <div class="co-summary" id="co-summary"></div>
          <div class="form-err" id="co-err" hidden></div>
        </div>
        <div class="cstep" id="cstep-3" hidden></div>
      </div>
      <div class="modal-foot" id="checkout-foot"></div>
    </div>
  </div>
  <div class="modal-overlay" id="help-modal">
    <div class="modal">
      <div class="modal-head"><span>❓ Jak to działa</span><button class="modal-close" id="help-close">✕</button></div>
      <div class="modal-body help-body">
        <h4>1. Dodaj meble</h4>
        <p>Kliknij kartę w katalogu lub przeciągnij ją wprost na scenę. Wiszące (TV, szafki górne, obraz) same przylegają do ściany.</p>
        <h4>2. Aranżuj</h4>
        <p>Przeciągaj meble po podłodze (przyciąganie do siatki i do sąsiadów). Zaznaczony mebel możesz obrócić, przemalować, zduplikować lub usunąć. Meble nie wchodzą na siebie.</p>
        <h4>3. Kamera</h4>
        <p>Obracaj scenę przeciągając tło, przybliżaj kółkiem. „⬜ 2D" to rzut z góry, „🎯" resetuje widok.</p>
        <h4>4. Zamów</h4>
        <p>To, co ustawisz w pokoju, jest Twoim koszykiem. „Zamów aranżację" prowadzi przez koszyk → dane → potwierdzenie.</p>
        <h4>Skróty klawiszowe</h4>
        <table class="help-keys">
          <tr><td>Obróć / Duplikuj</td><td><kbd>R</kbd> · <kbd>Ctrl</kbd>+<kbd>D</kbd></td></tr>
          <tr><td>Usuń / Odznacz</td><td><kbd>Delete</kbd> · <kbd>Esc</kbd></td></tr>
          <tr><td>Cofnij / Ponów</td><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> · <kbd>Ctrl</kbd>+<kbd>Y</kbd></td></tr>
          <tr><td>Precyzyjny ruch</td><td><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd></td></tr>
        </table>
      </div>
    </div>
  </div>
  <div class="modal-overlay welcome-overlay" id="welcome-modal">
    <div class="modal welcome-card">
      <div class="welcome-logo">🛋️</div>
      <h2>Witaj w MebleLab 3D</h2>
      <p>Zaprojektuj salon lub kuchnię w 3D — dodawaj meble, aranżuj na żywo i zamów całość jednym procesem.</p>
      <div class="welcome-actions">
        <button class="checkout" id="w-start">Zacznij projektować</button>
        <button class="btn" id="w-template">✨ Wstaw gotową aranżację</button>
        <button class="btn" id="w-help">Jak to działa?</button>
      </div>
    </div>
  </div>
  <div class="modal-overlay" id="admin-modal">
    <div class="modal modal-wide">
      <div class="modal-head"><span>🛠️ Panel obsługi zamówień</span><button class="modal-close" id="admin-close">✕</button></div>
      <div class="modal-body" id="admin-body"></div>
      <div class="modal-foot admin-foot">
        <button class="btn" id="admin-refresh">↻ Odśwież</button>
        <button class="btn" id="admin-csv">⬇️ Eksport CSV</button>
      </div>
    </div>
  </div>
  <div class="drawer-backdrop" id="drawer-backdrop"></div>
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
const chosenVariant = new Map<string, string>();
let currentCat: RoomKind = 'living';
let searchQuery = '';
let sortMode = 'default';
let priceFilter = 'all';
let thumbs: Map<string, string> | null = null;
const thumbCache = new Map<string, string>(); // klucz `${id}|${color}` — miniatury w wybranym kolorze

function inPriceRange(price: number): boolean {
  if (priceFilter === '0-500') return price < 500;
  if (priceFilter === '500-1500') return price >= 500 && price <= 1500;
  if (priceFilter === '1500-') return price > 1500;
  return true;
}

function renderCatalog(cat: RoomKind): void {
  const q = searchQuery.trim().toLowerCase();
  const list = PRODUCTS.filter(
    (p) =>
      p.category === cat &&
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) &&
      inPriceRange(effectivePrice(p, chosenVariant.get(p.id)))
  );
  if (sortMode === 'price-asc') list.sort((a, b) => a.price - b.price);
  else if (sortMode === 'price-desc') list.sort((a, b) => b.price - a.price);
  else if (sortMode === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  if (list.length === 0) {
    const why = searchQuery ? `dla „${searchQuery}”` : 'dla wybranych filtrów';
    cardsEl.innerHTML = `<div class="cart-empty">Brak mebli ${why}.</div>`;
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
      const thumb = thumbCache.get(`${p.id}|${active}`) ?? thumbs?.get(p.id);
      const vId = chosenVariant.get(p.id);
      const size = effectiveSize(p, vId);
      const price = effectivePrice(p, vId);
      const variantSel = p.variants
        ? `<select class="variant-sel" data-id="${p.id}" title="Wariant rozmiaru">${p.variants
            .map((v) => `<option value="${v.id}"${v.id === (vId ?? p.variants![0].id) ? ' selected' : ''}>${v.label}</option>`)
            .join('')}</select>`
        : '';
      return `
        <div class="card" draggable="true" data-id="${p.id}">
          <div class="thumb-wrap">
            ${thumb ? `<img class="thumb" src="${thumb}" alt="${p.name}" draggable="false">` : '<div class="thumb thumb-ph"></div>'}
            <button class="qv-btn" data-qv title="Szybki podgląd">⤢</button>
          </div>
          <div class="row"><span class="name">${p.name}</span><span class="price">${zl.format(price)}</span></div>
          <div class="desc">${p.description}</div>
          ${variantSel ? `<div class="variant-row">${variantSel}</div>` : ''}
          <div class="meta">
            <span class="dims">${size[0]}×${size[2]} m</span>
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
  if (target.closest('.variant-sel')) return; // interakcja z selektorem wariantu
  const product = PRODUCTS.find((p) => p.id === card.dataset.id)!;
  if (target.closest('[data-qv]')) { openProduct(product); return; }
  const sw = target.closest<HTMLElement>('.swatch');
  if (sw) {
    const color = Number(sw.dataset.color);
    chosenColor.set(product.id, color);
    const key = `${product.id}|${color}`;
    if (!thumbCache.has(key)) {
      try { thumbCache.set(key, renderThumbnail(product, color)); } catch { /* WebGL niedostępny — zostaw domyślną */ }
    }
    renderCatalog(currentCat);
    return;
  }
  planner.addProduct(product, chosenColor.get(product.id), 0, 0, 0, chosenVariant.get(product.id));
});

cardsEl.addEventListener('change', (e) => {
  const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('.variant-sel');
  if (!sel || !sel.dataset.id) return;
  chosenVariant.set(sel.dataset.id, sel.value);
  renderCatalog(currentCat);
});

// drag&drop z katalogu na scenę
cardsEl.addEventListener('dragstart', (e) => {
  const card = (e.target as HTMLElement).closest<HTMLDivElement>('.card');
  if (!card || !e.dataTransfer) return;
  const id = card.dataset.id!;
  e.dataTransfer.setData('text/plain', JSON.stringify({ id, color: chosenColor.get(id), variant: chosenVariant.get(id) }));
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
    const { id, color, variant } = JSON.parse(e.dataTransfer.getData('text/plain'));
    const product = PRODUCTS.find((p) => p.id === id);
    if (product) planner.addProductAtScreen(product, color, e.clientX, e.clientY, variant);
  } catch { /* ignoruj */ }
});

// wyszukiwarka i sortowanie katalogu
$<HTMLInputElement>('#cat-search').addEventListener('input', (e) => {
  searchQuery = (e.target as HTMLInputElement).value;
  renderCatalog(currentCat);
});
$<HTMLSelectElement>('#cat-sort').addEventListener('change', (e) => {
  sortMode = (e.target as HTMLSelectElement).value;
  renderCatalog(currentCat);
});
const priceChips = $<HTMLDivElement>('#price-chips');
priceChips.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
  if (!btn) return;
  priceFilter = btn.dataset.price ?? 'all';
  priceChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === btn));
  renderCatalog(currentCat);
});

// —————————————————————— SZYBKI PODGLĄD PRODUKTU ——————————————————————
const productModal = $<HTMLDivElement>('#product-modal');
const pmCanvas = $<HTMLCanvasElement>('#pm-canvas');
const pmTitle = $<HTMLSpanElement>('#pm-title');
const pmDesc = $<HTMLParagraphElement>('#pm-desc');
const pmDims = $<HTMLDivElement>('#pm-dims');
const pmVariantWrap = $<HTMLDivElement>('#pm-variant-wrap');
const pmColorsEl = $<HTMLDivElement>('#pm-colors');
const pmPrice = $<HTMLSpanElement>('#pm-price');
let preview: ProductPreview | null = null;
let pmProduct: ProductDef | null = null;
let pmColor = 0xffffff;
let pmVariant: string | undefined;

function renderPmInfo(): void {
  if (!pmProduct) return;
  const size = effectiveSize(pmProduct, pmVariant);
  pmDims.textContent = `Wymiary: ${size[0]}×${size[2]}×${size[1]} m (szer.×gł.×wys.)`;
  pmPrice.textContent = zl.format(effectivePrice(pmProduct, pmVariant));
  pmVariantWrap.innerHTML = pmProduct.variants
    ? `<label class="pm-vlabel">Rozmiar <select id="pm-variant">${pmProduct.variants
        .map((v) => `<option value="${v.id}"${v.id === pmVariant ? ' selected' : ''}>${v.label} · ${zl.format(v.price)}</option>`)
        .join('')}</select></label>`
    : '';
  pmColorsEl.innerHTML =
    (pmProduct.colors.length > 1 ? '<span class="pm-clabel">Kolor</span>' : '') +
    pmProduct.colors
      .map((c) => `<span class="swatch ${c === pmColor ? 'active' : ''}" data-color="${c}" style="background:${hex(c)}" title="Kolor"></span>`)
      .join('');
}

function openProduct(product: ProductDef): void {
  pmProduct = product;
  pmColor = chosenColor.get(product.id) ?? product.colors[0];
  pmVariant = chosenVariant.get(product.id) ?? product.variants?.[0].id;
  pmTitle.textContent = product.name;
  pmDesc.textContent = product.description;
  renderPmInfo();
  if (!preview) preview = new ProductPreview(pmCanvas);
  preview.setProduct(product, pmColor, pmVariant);
  productModal.classList.add('show');
  requestAnimationFrame(() => { preview!.resize(); preview!.start(); });
}

function closeProduct(): void {
  productModal.classList.remove('show');
  preview?.stop();
}

pmVariantWrap.addEventListener('change', (e) => {
  const sel = (e.target as HTMLElement).closest<HTMLSelectElement>('#pm-variant');
  if (!sel) return;
  pmVariant = sel.value;
  preview?.setVariant(pmVariant);
  renderPmInfo();
});
pmColorsEl.addEventListener('click', (e) => {
  const sw = (e.target as HTMLElement).closest<HTMLElement>('.swatch');
  if (!sw) return;
  pmColor = Number(sw.dataset.color);
  preview?.setColor(pmColor);
  renderPmInfo();
});
$<HTMLButtonElement>('#pm-add').addEventListener('click', () => {
  if (!pmProduct) return;
  chosenColor.set(pmProduct.id, pmColor);
  if (pmVariant) chosenVariant.set(pmProduct.id, pmVariant);
  planner.addProduct(pmProduct, pmColor, 0, 0, 0, pmVariant);
  renderCatalog(currentCat);
  closeProduct();
  toast(`➕ Dodano „${pmProduct.name}”`);
});
$<HTMLButtonElement>('#pm-close').addEventListener('click', closeProduct);
productModal.addEventListener('click', (e) => { if (e.target === productModal) closeProduct(); });
window.addEventListener('resize', () => { if (productModal.classList.contains('show')) preview?.resize(); });

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

const wallCustom = $<HTMLInputElement>('#wall-custom');
wallCustom.addEventListener('input', () => {
  room.setWallColor(parseInt(wallCustom.value.slice(1), 16));
  syncRoomUI();
});
wallCustom.addEventListener('change', () => pushHistory());

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
  wallCustom.value = hex(room.wallColor);
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

// przełącznik motywu jasny / ciemny (zapisywany)
const btnTheme = $<HTMLButtonElement>('#btn-theme');
function syncThemeBtn(): void {
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  btnTheme.textContent = light ? '🌙' : '☀️';
  btnTheme.title = light ? 'Włącz tryb ciemny' : 'Włącz tryb jasny';
}
syncThemeBtn();
btnTheme.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* brak localStorage */ }
  syncThemeBtn();
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
  updateHud();
  if (!item) { selpanel.classList.remove('show'); return; }
  const [w, h, d] = item.size;
  const colors = item.product.colors
    .map((c) => `<span class="swatch ${c === item.color ? 'active' : ''}" data-color="${c}" style="background:${hex(c)}"></span>`)
    .join('');
  const curVar = getVariant(item.product, item.variant);
  const variantSel = item.product.variants
    ? `<div class="divider"></div><select class="sel-variant" id="sp-variant" title="Rozmiar">${item.product.variants
        .map((v) => `<option value="${v.id}"${v.id === curVar?.id ? ' selected' : ''}>${v.label} · ${zl.format(v.price)}</option>`)
        .join('')}</select>`
    : '';
  selpanel.innerHTML = `
    <div class="sel-info">
      <span class="title">${item.product.name}</span>
      <span class="sel-dims">${w}×${d}×${h} m · ${zl.format(item.price)}</span>
    </div>
    <span class="sel-warn" id="sp-warn">⚠ kolizja</span>
    ${variantSel}
    <div class="divider"></div><div class="colors">${item.product.colors.length > 1 ? colors : ''}<label class="custom-color sel-cc" title="Własny kolor"><input type="color" id="sp-custom" value="${hex(item.color)}"></label></div>
    <div class="divider"></div>
    <button class="icon-btn" id="sp-rot" title="Obróć (R)">↻</button>
    <button class="icon-btn" id="sp-dup" title="Duplikuj (Ctrl+D)">⧉</button>
    <button class="icon-btn danger" id="sp-del" title="Usuń (Delete)">🗑️</button>
  `;
  selpanel.classList.add('show');
  selpanel.querySelectorAll<HTMLElement>('.colors .swatch').forEach((s) =>
    s.addEventListener('click', () => planner.recolorSelected(Number(s.dataset.color)))
  );
  const spCustom = selpanel.querySelector<HTMLInputElement>('#sp-custom');
  spCustom?.addEventListener('input', () => planner.recolorSelected(parseInt(spCustom.value.slice(1), 16)));
  const spVariant = selpanel.querySelector<HTMLSelectElement>('#sp-variant');
  spVariant?.addEventListener('change', () => planner.setSelectedVariant(spVariant.value));
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

// HUD z wymiarami i odległościami od ścian
const measureHud = $<HTMLDivElement>('#measure-hud');
function updateHud(): void {
  const info = planner.getSelectedInfo();
  if (!info) { measureHud.hidden = true; return; }
  const m = (v: number) => v.toFixed(2);
  measureHud.hidden = false;
  measureHud.innerHTML = `<b>${info.w}×${info.d} m</b> <span>ściany —</span> L ${m(info.gapLeft)} · P ${m(info.gapRight)} · tył ${m(info.gapBack)} · przód ${m(info.gapFront)} m`;
}
planner.onTransform = updateHud;

// —————————————————————— KOSZYK ——————————————————————
const cartItemsEl = $<HTMLDivElement>('#cart-items');
const totalEl = $<HTMLSpanElement>('#total');
const checkoutBtn = $<HTMLButtonElement>('#checkout');
const hint = $<HTMLDivElement>('#hint');

/** Nazwa pozycji z etykietą wariantu (jeśli wybrany). */
function itemLabel(product: ProductDef, variant?: string): string {
  const v = getVariant(product, variant);
  return v ? `${product.name} · ${v.label}` : product.name;
}

interface CartGroup { product: ProductDef; variant?: string; name: string; price: number; qty: number; }

/** Grupuje meble po produkcie i wariancie (różne warianty = osobne pozycje). */
function cartGroups(): CartGroup[] {
  const map = new Map<string, CartGroup>();
  for (const it of planner.items) {
    const key = `${it.product.id}|${it.variant ?? ''}`;
    const g = map.get(key) ?? { product: it.product, variant: it.variant, name: itemLabel(it.product, it.variant), price: it.price, qty: 0 };
    g.qty++;
    map.set(key, g);
  }
  return [...map.values()];
}

planner.onChange = () => {
  const groups = cartGroups();
  hint.style.display = planner.items.length ? 'none' : '';
  if (groups.length === 0) {
    cartItemsEl.innerHTML = `<div class="cart-empty">Koszyk jest pusty.<br>Dodaj meble z katalogu, a pojawią się tutaj.</div>`;
  } else {
    cartItemsEl.innerHTML = groups
      .map(
        ({ product, variant, name, price, qty }) => `
        <div class="cart-item" data-id="${product.id}" data-variant="${variant ?? ''}" title="Kliknij, aby wyśrodkować w scenie">
          <div><div class="ci-name"><span class="qty-badge">${qty}×</span>${name}</div>
          <div class="ci-sub">${zl.format(price)} / szt.</div></div>
          <div class="ci-right">
            <span class="ci-price">${zl.format(price * qty)}</span>
            <button class="ci-remove" data-remove="${product.id}" data-variant="${variant ?? ''}" title="Usuń jedną sztukę">−</button>
          </div>
        </div>`
      )
      .join('');
  }
  const total = planner.items.reduce((s, i) => s + i.price, 0);
  totalEl.textContent = zl.format(total);
  checkoutBtn.disabled = planner.items.length === 0;
};

function orderItems(): OrderPayloadItem[] {
  return cartGroups().map((g) => ({ productId: g.product.id, name: g.name, price: g.price, qty: g.qty }));
}

cartItemsEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const removeBtn = target.closest<HTMLElement>('.ci-remove');
  if (removeBtn?.dataset.remove) {
    e.stopPropagation();
    planner.removeOneOfProduct(removeBtn.dataset.remove, removeBtn.dataset.variant || undefined);
    return;
  }
  const row = target.closest<HTMLDivElement>('.cart-item');
  if (row?.dataset.id) planner.focusProduct(row.dataset.id, row.dataset.variant || undefined);
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
const totalOf = () => planner.items.reduce((s, i) => s + i.price, 0);

function openCheckout(): void {
  if (!planner.items.length) { toast('Dodaj meble do projektu, aby zamówić'); return; }
  if (planner.hasOverlaps()) { toast('⚠ Popraw kolizje mebli przed zamówieniem'); return; }
  planner.select(null); // czysta miniatura sceny (bez ramki zaznaczenia)
  promoCode = null;
  const pin = document.querySelector<HTMLInputElement>('#co-promo');
  if (pin) pin.value = '';
  gotoStep(1);
  checkoutModal.classList.add('show');
}

const PROMOS: Record<string, { label: string; percent?: number; freeDelivery?: boolean }> = {
  MEBLE10: { label: '−10% na meble', percent: 10 },
  GRATIS: { label: 'darmowa dostawa', freeDelivery: true },
};
let promoCode: string | null = null;

function selectedDelivery(): { method: string; cost: number } {
  const el = document.querySelector('input[name="co-del"]:checked') as HTMLInputElement | null;
  return { method: el?.value ?? 'Kurier', cost: Number(el?.dataset.cost ?? 19) };
}

function computeTotals() {
  const subtotal = totalOf();
  const { method, cost } = selectedDelivery();
  const promo = promoCode ? PROMOS[promoCode] : undefined;
  const discount = promo?.percent ? Math.round((subtotal * promo.percent) / 100) : 0;
  const deliveryCost = promo?.freeDelivery ? 0 : cost;
  const final = Math.max(0, subtotal + deliveryCost - discount);
  return { subtotal, method, deliveryCost, discount, final };
}

function renderSummary(): void {
  const t = computeTotals();
  const promo = promoCode ? PROMOS[promoCode] : undefined;
  $<HTMLDivElement>('#co-summary').innerHTML =
    `<div class="sum-row"><span>Produkty</span><span>${zl.format(t.subtotal)}</span></div>
     <div class="sum-row"><span>Dostawa (${t.method})</span><span>${t.deliveryCost === 0 ? 'gratis' : zl.format(t.deliveryCost)}</span></div>
     ${t.discount ? `<div class="sum-row discount"><span>Rabat ${promo?.label ?? ''}</span><span>−${zl.format(t.discount)}</span></div>` : ''}
     <div class="sum-row total"><span>Razem</span><span>${zl.format(t.final)}</span></div>`;
}

function updateAddrVisibility(): void {
  const method = selectedDelivery().method;
  $<HTMLElement>('#co-addr-wrap').hidden = method === 'Odbiór osobisty';
  renderSummary();
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
  const { method } = selectedDelivery();
  const needsAddr = method !== 'Odbiór osobisty';
  const address = val('#co-addr');
  const err = $<HTMLDivElement>('#co-err');
  const problems: string[] = [];
  if (name.length < 3) problems.push('imię i nazwisko');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push('poprawny e-mail');
  if (needsAddr && address.length < 5) problems.push('adres dostawy');
  if (problems.length) { err.hidden = false; err.textContent = 'Uzupełnij: ' + problems.join(', ') + '.'; return; }
  err.hidden = true;

  const submitBtn = $<HTMLButtonElement>('#co-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Wysyłanie…';
  const t = computeTotals();
  const res = await api.placeOrder({
    items: orderItems(),
    total: t.final,
    room: room.kind,
    customer: { name, email, phone },
    delivery: { method, address: needsAddr ? address : '—', cost: t.deliveryCost, promo: promoCode ?? undefined },
    thumb: sm.captureThumbnail(),
  });
  refreshApiStatus();
  const no = res ? `#${res.orderNo}` : '(offline)';
  $<HTMLDivElement>('#cstep-3').innerHTML =
    `<div class="co-confirm"><div class="co-check">✅</div><h3>Dziękujemy, ${escHtml(name)}!</h3>
    <p>Zamówienie <b>${no}</b> zostało przyjęte.</p>
    <p class="co-sub">${escHtml(method)}${needsAddr ? ' → ' + escHtml(address) : ''}${t.discount ? '<br>Rabat: −' + zl.format(t.discount) : ''}<br>Potwierdzenie wyślemy na <b>${escHtml(email)}</b>.</p>
    <div class="co-total"><span>Do zapłaty</span><b>${zl.format(t.final)}</b></div></div>`;
  gotoStep(3);
}

checkoutBtn.addEventListener('click', openCheckout);
$<HTMLButtonElement>('#checkout-close').addEventListener('click', () => checkoutModal.classList.remove('show'));
checkoutModal.addEventListener('click', (e) => { if (e.target === checkoutModal) checkoutModal.classList.remove('show'); });
document.querySelectorAll('input[name="co-del"]').forEach((r) => r.addEventListener('change', updateAddrVisibility));
$<HTMLButtonElement>('#co-promo-apply').addEventListener('click', () => {
  const code = ($<HTMLInputElement>('#co-promo').value || '').trim().toUpperCase();
  if (!code) { promoCode = null; renderSummary(); return; }
  if (PROMOS[code]) { promoCode = code; toast(`✅ Kod „${code}" — ${PROMOS[code].label}`); }
  else { promoCode = null; toast('❌ Nieprawidłowy kod rabatowy'); }
  renderSummary();
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
const roomTag = (k: RoomKind) => (k === 'kitchen' ? '🍳 kuchnia' : '🛋️ salon');
templatesBody.innerHTML = `
  <div class="tpl-group-title">Całe aranżacje <span>— zastępują zawartość pokoju</span></div>
  ${TEMPLATES.map(
    (t) => `
    <div class="order-row tpl-row" data-tpl="${t.id}">
      <div><div class="order-no">${t.name}</div><div class="order-meta">${t.description}</div></div>
      <button class="btn" data-tpl="${t.id}">Wstaw →</button>
    </div>`
  ).join('')}
  <div class="tpl-group-title">Zestawy mebli <span>— dodają się do bieżącego pokoju</span></div>
  ${SETS.map(
    (s) => `
    <div class="order-row tpl-row" data-set="${s.id}">
      <div><div class="order-no">${s.name} <span class="tpl-badge">${roomTag(s.category)}</span></div><div class="order-meta">${s.description}</div></div>
      <button class="btn" data-set="${s.id}">Dodaj +</button>
    </div>`
  ).join('')}`;

$<HTMLButtonElement>('#btn-templates').addEventListener('click', () => templatesModal.classList.add('show'));
$<HTMLButtonElement>('#templates-close').addEventListener('click', () => templatesModal.classList.remove('show'));
templatesModal.addEventListener('click', (e) => {
  if (e.target === templatesModal) templatesModal.classList.remove('show');
});
templatesBody.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  const setId = el.closest<HTMLElement>('[data-set]')?.dataset.set;
  if (setId) {
    const set = SETS.find((s) => s.id === setId);
    if (!set) return;
    const defs: { product: ProductDef; variant?: string; dx: number; dz: number; ry?: number }[] = [];
    for (const i of set.items) {
      const product = getProduct(i.productId);
      if (product) defs.push({ product, variant: i.variant, dx: i.dx, dz: i.dz, ry: i.ry });
    }
    planner.addSet(defs); // jedna operacja historii (onCommit → pushHistory)
    templatesModal.classList.remove('show');
    toast(`🧩 Dodano zestaw „${set.name}” (${defs.length} elem.)`);
    return;
  }
  const id = el.closest<HTMLElement>('[data-tpl]')?.dataset.tpl;
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
  const groups = cartGroups();
  const total = planner.items.reduce((s, i) => s + i.price, 0);
  const rows = groups
    .map(({ name, price, qty }) => `<tr><td>${name}</td><td class="c">${qty}</td><td class="r">${zl.format(price)}</td><td class="r">${zl.format(price * qty)}</td></tr>`)
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

// —————————————————————— RZUT 2D Z WYMIARAMI ——————————————————————
const rgba = (n: number, a: number) =>
  `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

/** Buduje schematyczny rzut 2D pomieszczenia (SVG) z gabarytami mebli i wymiarami ścian. */
function buildFloorPlanSVG(): string {
  const b = room.bounds;
  const W = room.width;
  const D = room.depth;
  const scale = Math.max(26, Math.min(96, 620 / W, 800 / D));
  const pad = 64;
  const planW = W * scale;
  const planD = D * scale;
  const svgW = planW + pad * 2;
  const svgH = planD + pad * 2;
  const fx = (x: number) => pad + (x - b.minX) * scale;
  const fy = (z: number) => pad + (z - b.minZ) * scale;

  // siatka co 1 m
  let grid = '';
  for (let x = Math.ceil(b.minX); x < b.maxX; x++) grid += `<line x1="${fx(x).toFixed(1)}" y1="${pad}" x2="${fx(x).toFixed(1)}" y2="${pad + planD}"/>`;
  for (let z = Math.ceil(b.minZ); z < b.maxZ; z++) grid += `<line x1="${pad}" y1="${fy(z).toFixed(1)}" x2="${pad + planW}" y2="${fy(z).toFixed(1)}"/>`;

  // meble
  let shapes = '';
  let labels = '';
  planner.items.forEach((it, idx) => {
    const n = idx + 1;
    const cx = fx(it.group.position.x);
    const cy = fy(it.group.position.z);
    const w = it.size[0] * scale;
    const d = it.size[2] * scale;
    const deg = (-it.group.rotation.y * 180) / Math.PI;
    const wall = it.product.mount === 'wall';
    const fill = rgba(it.color, wall ? 0.35 : 0.8);
    shapes +=
      `<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${deg.toFixed(1)})">` +
      `<rect x="${(-w / 2).toFixed(1)}" y="${(-d / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${d.toFixed(1)}" rx="3" ` +
      `fill="${fill}" stroke="#1a2029" stroke-width="1.2"${wall ? ' stroke-dasharray="4 3"' : ''}/></g>`;
    labels +=
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="10" fill="#fff" stroke="#1a2029" stroke-width="1.2"/>` +
      `<text x="${cx.toFixed(1)}" y="${(cy + 3.5).toFixed(1)}" text-anchor="middle" class="num">${n}</text>`;
  });

  // linie wymiarowe (szerokość u góry, głębokość po lewej)
  const dimW =
    `<line class="dim" x1="${pad}" y1="${pad - 26}" x2="${pad + planW}" y2="${pad - 26}"/>` +
    `<line class="dim" x1="${pad}" y1="${pad - 31}" x2="${pad}" y2="${pad - 21}"/>` +
    `<line class="dim" x1="${pad + planW}" y1="${pad - 31}" x2="${pad + planW}" y2="${pad - 21}"/>` +
    `<text x="${(pad + planW / 2).toFixed(1)}" y="${pad - 32}" text-anchor="middle" class="dimt">${W.toFixed(1)} m</text>`;
  const dimD =
    `<line class="dim" x1="${pad - 26}" y1="${pad}" x2="${pad - 26}" y2="${pad + planD}"/>` +
    `<line class="dim" x1="${pad - 31}" y1="${pad}" x2="${pad - 21}" y2="${pad}"/>` +
    `<line class="dim" x1="${pad - 31}" y1="${pad + planD}" x2="${pad - 21}" y2="${pad + planD}"/>` +
    `<text x="${pad - 32}" y="${(pad + planD / 2).toFixed(1)}" text-anchor="middle" class="dimt" transform="rotate(-90 ${pad - 32} ${(pad + planD / 2).toFixed(1)})">${D.toFixed(1)} m</text>`;

  return `<svg viewBox="0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" class="plan">
    <g class="grid">${grid}</g>
    <rect x="${pad}" y="${pad}" width="${planW.toFixed(1)}" height="${planD.toFixed(1)}" fill="none" stroke="#1a2029" stroke-width="2.5"/>
    ${shapes}${labels}${dimW}${dimD}
  </svg>`;
}

$<HTMLButtonElement>('#btn-plan').addEventListener('click', () => {
  if (!planner.items.length) { toast('Dodaj meble, aby wygenerować rzut'); return; }
  const svg = buildFloorPlanSVG();
  const legend = planner.items
    .map((it, i) => `<li><span class="lc" style="background:${rgba(it.color, it.product.mount === 'wall' ? 0.35 : 0.8)}"></span><b>${i + 1}.</b> ${escHtml(itemLabel(it.product, it.variant))} <span class="lp">${it.size[0]}×${it.size[2]} m · ${zl.format(it.price)}</span></li>`)
    .join('');
  const roomName = room.kind === 'kitchen' ? 'Kuchnia' : 'Salon';
  const date = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  const total = planner.items.reduce((s, i) => s + i.price, 0);
  const w = window.open('', '_blank', 'width=980,height=1100');
  if (!w) { toast('Zezwól na wyskakujące okna, aby wydrukować'); return; }
  w.document.write(`<!doctype html><html lang="pl"><head><meta charset="utf-8">
  <title>MebleLab 3D — rzut 2D</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1a2029;margin:32px;max-width:900px}
    header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #ffb020;padding-bottom:12px;margin-bottom:18px}
    h1{margin:0;font-size:22px}.sub{color:#666;font-size:13px}
    .meta{color:#666;font-size:13px;margin-bottom:14px}
    .plan{width:100%;height:auto;border:1px solid #ddd;border-radius:10px;background:#fafafa}
    .plan .grid line{stroke:#e2e5ea;stroke-width:1}
    .plan .dim{stroke:#8a8f98;stroke-width:1}
    .plan .dimt{fill:#555;font-size:12px;font-weight:600}
    .plan .num{fill:#1a2029;font-size:11px;font-weight:700}
    ol{list-style:none;padding:0;margin:16px 0 0;columns:2;column-gap:26px;font-size:13px}
    li{margin:0 0 6px;break-inside:avoid;display:flex;align-items:center;gap:7px}
    .lc{width:13px;height:13px;border-radius:3px;border:1px solid #1a2029;display:inline-block;flex:none}
    .lp{color:#888;margin-left:auto;white-space:nowrap}
    .tot{margin-top:14px;text-align:right;font-weight:700;font-size:16px;border-top:2px solid #333;padding-top:10px}
    @media print{body{margin:0}}
  </style></head><body>
    <header><div><h1>🛋️ MebleLab 3D</h1><div class="sub">Rzut 2D pomieszczenia z wymiarami</div></div>
    <div class="sub">${date}</div></header>
    <div class="meta">Pomieszczenie: <b>${roomName}</b> ${room.width.toFixed(1)}×${room.depth.toFixed(1)} m (${room.area.toFixed(1)} m²) · elementów: <b>${planner.items.length}</b> · widok z góry, skala zachowana</div>
    ${svg}
    <ol>${legend}</ol>
    <div class="tot">Razem: ${zl.format(total)}</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),350)</script>
  </body></html>`);
  w.document.close();
});

// —————————————————————— PANEL OBSŁUGI (admin) ——————————————————————
const STATUSES = ['nowe', 'w realizacji', 'wysłane', 'zrealizowane', 'anulowane'];
const statusKey = (s: string) =>
  ({ nowe: 'nowe', 'w realizacji': 'realizacja', wysłane: 'wyslane', zrealizowane: 'gotowe', anulowane: 'anulowane' } as Record<string, string>)[s] || 'nowe';
const adminModal = $<HTMLDivElement>('#admin-modal');
const adminBody = $<HTMLDivElement>('#admin-body');

function renderAdminOrder(o: OrderSummary): string {
  const st = o.status || 'nowe';
  const cust = o.customer
    ? `${esc(o.customer.name)} · ${esc(o.customer.email)}${o.customer.phone ? ' · ' + esc(o.customer.phone) : ''}`
    : 'brak danych';
  const del = o.delivery ? `${esc(o.delivery.method)}${o.delivery.address && o.delivery.address !== '—' ? ' → ' + esc(o.delivery.address) : ''}` : '';
  const items = (o.items || []).map((i) => `${i.qty}× ${esc(i.name)}`).join(', ');
  const opts = STATUSES.map((s) => `<option value="${s}"${s === st ? ' selected' : ''}>${s}</option>`).join('');
  return `<div class="admin-order">
    <div class="ao-top">
      <div><span class="ao-no">#${o.orderNo}</span> <span class="ao-date">${dtFmt.format(new Date(o.createdAt))}</span></div>
      <div class="ao-right"><span class="ao-total">${zl.format(o.total)}</span>
      <select class="ao-status s-${statusKey(st)}" data-no="${o.orderNo}">${opts}</select></div>
    </div>
    <div class="ao-flex">
      ${o.thumb ? `<img class="ao-thumb" src="${o.thumb}" alt="Aranżacja">` : ''}
      <div class="ao-info">
        <div class="ao-line">👤 ${cust}</div>
        ${del ? `<div class="ao-line">🚚 ${del}</div>` : ''}
        <div class="ao-line">📦 ${items || '—'}</div>
      </div>
    </div>
  </div>`;
}

function statsHtml(orders: OrderSummary[]): string {
  const count = orders.length;
  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const avg = count ? revenue / count : 0;
  const byStatus = new Map<string, number>();
  for (const o of orders) { const st = o.status || 'nowe'; byStatus.set(st, (byStatus.get(st) || 0) + 1); }
  const rev = new Map<string, number>();
  for (const o of orders) for (const it of o.items || []) rev.set(it.name, (rev.get(it.name) || 0) + it.price * (it.qty || 1));
  const top = [...rev.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top.length ? top[0][1] : 1;
  const revTotal = [...rev.values()].reduce((s, v) => s + v, 0) || 1;
  const badges = STATUSES.filter((s) => byStatus.get(s)).map((s) => `<span class="stat-badge s-${statusKey(s)}">${s}: ${byStatus.get(s)}</span>`).join('');
  // wykres magnitudy: poziome słupki, jedna barwa, wartości w kolorze tekstu; tooltip = udział w obrocie
  const chart = top.length
    ? top
        .map(([n, v]) => {
          const share = Math.round((v / revTotal) * 100);
          const tip = `${n} — ${zl.format(v)} (${share}% obrotu)`;
          return (
            `<div class="chart-row" title="${esc(tip)}"><span class="chart-label" title="${esc(n)}">${esc(n)}</span>` +
            `<span class="chart-track"><span class="chart-bar" style="width:${Math.max(4, Math.round((v / max) * 100))}%"></span></span>` +
            `<span class="chart-val">${zl.format(v)}</span></div>`
          );
        })
        .join('')
    : '<div class="ao-line">—</div>';
  return `<div class="admin-stats">
    <div class="stat-tiles">
      <div class="stat-tile"><span>Zamówień</span><b>${count}</b></div>
      <div class="stat-tile"><span>Sprzedaż</span><b>${zl.format(revenue)}</b></div>
      <div class="stat-tile"><span>Śr. wartość</span><b>${zl.format(Math.round(avg))}</b></div>
    </div>
    ${badges ? `<div class="stat-badges">${badges}</div>` : ''}
    <div class="stat-chart"><span class="ctrl-label">Top produkty wg sprzedaży</span>${chart}</div>
  </div>`;
}

let adminOrders: OrderSummary[] = [];
let adminFilter = 'wszystkie';
let adminSort = 'new';

function renderAdmin(): void {
  let list = adminOrders.slice();
  if (adminFilter !== 'wszystkie') list = list.filter((o) => (o.status || 'nowe') === adminFilter);
  if (adminSort === 'new') list.sort((a, b) => b.orderNo - a.orderNo);
  else if (adminSort === 'old') list.sort((a, b) => a.orderNo - b.orderNo);
  else if (adminSort === 'val-desc') list.sort((a, b) => b.total - a.total);
  else if (adminSort === 'val-asc') list.sort((a, b) => a.total - b.total);
  const opt = (v: string, cur: string, label: string) => `<option value="${v}"${v === cur ? ' selected' : ''}>${label}</option>`;
  const controls = `<div class="admin-controls">
    <select id="admin-filter">${opt('wszystkie', adminFilter, 'Wszystkie statusy')}${STATUSES.map((s) => opt(s, adminFilter, s)).join('')}</select>
    <select id="admin-sort">${opt('new', adminSort, 'Najnowsze')}${opt('old', adminSort, 'Najstarsze')}${opt('val-desc', adminSort, 'Wartość ↓')}${opt('val-asc', adminSort, 'Wartość ↑')}</select>
    <span class="admin-count">${list.length} z ${adminOrders.length}</span>
  </div>`;
  adminBody.innerHTML =
    statsHtml(adminOrders) + controls +
    (list.length ? list.map(renderAdminOrder).join('') : '<div class="orders-empty">Brak zamówień o tym statusie.</div>');
}

async function openAdmin(): Promise<void> {
  adminBody.innerHTML = '<div class="orders-empty">Ładowanie…</div>';
  adminModal.classList.add('show');
  const orders = await api.listOrders();
  adminOrders = orders ?? [];
  if (!orders) { adminBody.innerHTML = '<div class="orders-empty">Backend offline. Uruchom „npm run dev:full".</div>'; return; }
  if (orders.length === 0) { adminBody.innerHTML = '<div class="orders-empty">Brak zamówień. Złóż pierwsze przez „Zamów aranżację".</div>'; return; }
  renderAdmin();
}

function ordersToCsv(orders: OrderSummary[]): string {
  const head = ['Nr', 'Data', 'Status', 'Klient', 'E-mail', 'Telefon', 'Dostawa', 'Adres', 'Pozycje', 'Wartość'];
  const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = orders.map((o) =>
    [o.orderNo, o.createdAt, o.status || 'nowe', o.customer?.name || '', o.customer?.email || '', o.customer?.phone || '',
     o.delivery?.method || '', o.delivery?.address || '', (o.items || []).map((i) => `${i.qty}x ${i.name}`).join('; '), o.total]
      .map(cell).join(',')
  );
  return [head.join(','), ...rows].join('\n');
}

function exportOrdersCsv(): void {
  if (!adminOrders.length) { toast('Brak zamówień do eksportu'); return; }
  const csv = '﻿' + ordersToCsv(adminOrders); // BOM → poprawne polskie znaki w Excelu
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'zamowienia.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('⬇️ Wyeksportowano CSV');
}

$<HTMLButtonElement>('#btn-admin').addEventListener('click', openAdmin);
$<HTMLButtonElement>('#admin-close').addEventListener('click', () => adminModal.classList.remove('show'));
$<HTMLButtonElement>('#admin-refresh').addEventListener('click', openAdmin);
$<HTMLButtonElement>('#admin-csv').addEventListener('click', exportOrdersCsv);
adminModal.addEventListener('click', (e) => { if (e.target === adminModal) adminModal.classList.remove('show'); });
adminBody.addEventListener('change', async (e) => {
  const sel = e.target as HTMLSelectElement;
  if (sel.id === 'admin-filter') { adminFilter = sel.value; renderAdmin(); return; }
  if (sel.id === 'admin-sort') { adminSort = sel.value; renderAdmin(); return; }
  if (!sel.dataset.no) return;
  const no = Number(sel.dataset.no);
  const r = await api.updateOrderStatus(no, sel.value);
  if (r) {
    const local = adminOrders.find((o) => o.orderNo === no);
    if (local) local.status = sel.value;
    toast(`#${no} → ${sel.value}`);
    renderAdmin();
  } else toast('Nie udało się zmienić statusu');
});

// —————————————————————— POMOC ——————————————————————
const helpModal = $<HTMLDivElement>('#help-modal');
$<HTMLButtonElement>('#btn-help').addEventListener('click', () => helpModal.classList.add('show'));
$<HTMLButtonElement>('#help-close').addEventListener('click', () => helpModal.classList.remove('show'));
helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.remove('show'); });

// —————————————————————— PANELE WYSUWANE (mobile) ——————————————————————
const backdrop = $<HTMLDivElement>('#drawer-backdrop');
const catalogAside = $<HTMLElement>('#catalog-aside');
const cartAside = $<HTMLElement>('#cart-aside');
function openDrawer(which: 'catalog' | 'cart' | null): void {
  catalogAside.classList.toggle('open', which === 'catalog');
  cartAside.classList.toggle('open', which === 'cart');
  backdrop.classList.toggle('show', which !== null);
}
function closeDrawers(): void {
  catalogAside.classList.remove('open');
  cartAside.classList.remove('open');
  backdrop.classList.remove('show');
}
$<HTMLButtonElement>('#m-catalog').addEventListener('click', () => openDrawer(catalogAside.classList.contains('open') ? null : 'catalog'));
$<HTMLButtonElement>('#m-cart').addEventListener('click', () => openDrawer(cartAside.classList.contains('open') ? null : 'cart'));
backdrop.addEventListener('click', closeDrawers);
document.querySelectorAll<HTMLButtonElement>('.drawer-close').forEach((b) => b.addEventListener('click', closeDrawers));

// —————————————————————— POWITANIE (pierwsze wejście) ——————————————————————
const welcomeModal = $<HTMLDivElement>('#welcome-modal');
function closeWelcome(): void {
  welcomeModal.classList.remove('show');
  localStorage.setItem('meblelab3d-seen', '1');
}
$<HTMLButtonElement>('#w-start').addEventListener('click', closeWelcome);
$<HTMLButtonElement>('#w-template').addEventListener('click', () => { closeWelcome(); templatesModal.classList.add('show'); });
$<HTMLButtonElement>('#w-help').addEventListener('click', () => { closeWelcome(); helpModal.classList.add('show'); });

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
    if (welcomeModal.classList.contains('show')) closeWelcome();
    else if (productModal.classList.contains('show')) closeProduct();
    else if (checkoutModal.classList.contains('show')) checkoutModal.classList.remove('show');
    else if (helpModal.classList.contains('show')) helpModal.classList.remove('show');
    else if (adminModal.classList.contains('show')) adminModal.classList.remove('show');
    else if (ordersModal.classList.contains('show')) ordersModal.classList.remove('show');
    else if (projectsModal.classList.contains('show')) projectsModal.classList.remove('show');
    else if (templatesModal.classList.contains('show')) templatesModal.classList.remove('show');
    else if (catalogAside.classList.contains('open') || cartAside.classList.contains('open')) closeDrawers();
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
  if (!localStorage.getItem('meblelab3d-seen')) welcomeModal.classList.add('show');
})();
