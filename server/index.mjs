// Backend koszyka + serwer statyczny dla MebleLab 3D — bez zależności (wbudowany http Node).
// Trwałość: plik server/data.json.
//
// Tryby:
//   npm run server   → API (i statyczny build z dist/, jeśli istnieje) na porcie PORT (domyślnie 3031)
//   npm run deploy   → build + serwer (nadaje się do wystawienia na jednym porcie)
//
// API:
//   GET  /api/health              → { ok, orders }
//   GET  /api/orders              → lista zamówień
//   POST /api/orders              → złóż zamówienie { items, total, room } → { orderNo, createdAt }
//   POST /api/cart                → szybki zapis projektu { snapshot } → { id }
//   GET  /api/cart/:id            → wczytaj szybki zapis
//   GET  /api/projects            → lista nazwanych projektów
//   POST /api/projects            → zapisz nazwany projekt { name, snapshot } → { id }
//   GET  /api/projects/:id        → wczytaj nazwany projekt
//   DELETE /api/projects/:id      → usuń nazwany projekt

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';

const PORT = process.env.PORT || 3031;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = fileURLToPath(new URL('./data.json', import.meta.url));
const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url));

function load() {
  if (!existsSync(DATA_FILE)) return { seq: 1000, orders: [], carts: {}, projects: {} };
  try {
    const db = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
    db.projects ??= {};
    db.carts ??= {};
    db.orders ??= [];
    db.seq ??= 1000;
    return db;
  } catch {
    return { seq: 1000, orders: [], carts: {}, projects: {} };
  }
}
function persist(db) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = load();

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const randomId = () => 'c' + (db.seq++).toString(36) + Date.now().toString(36);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Serwuje statyczny build z dist/ (z fallbackiem do index.html — SPA). */
function serveStatic(req, res, pathname) {
  if (!existsSync(DIST_DIR)) {
    return json(res, 404, { error: 'Brak builda. Uruchom „npm run build” (lub „npm run deploy”).' });
  }
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  let file = normalize(join(DIST_DIR, rel));
  if (!file.startsWith(DIST_DIR)) return json(res, 403, { error: 'forbidden' });
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST_DIR, 'index.html');
  const type = MIME[extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(readFileSync(file));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') return json(res, 204, {});

  try {
    // ————— API —————
    if (pathname.startsWith('/api/')) {
      if (req.method === 'GET' && pathname === '/api/health') {
        return json(res, 200, { ok: true, orders: db.orders.length });
      }
      if (req.method === 'GET' && pathname === '/api/orders') {
        return json(res, 200, db.orders);
      }
      if (req.method === 'POST' && pathname === '/api/orders') {
        const body = await readBody(req);
        const items = Array.isArray(body.items) ? body.items : [];
        const orderNo = db.seq++;
        const createdAt = new Date().toISOString();
        db.orders.push({
          orderNo,
          createdAt,
          room: body.room ?? null,
          total: Number(body.total) || 0,
          count: items.reduce((s, i) => s + (i.qty || 1), 0),
          customer: body.customer ?? null,
          delivery: body.delivery ?? null,
          items,
        });
        persist(db);
        const who = body.customer?.name ? ` — ${body.customer.name}` : '';
        console.log(`[order] #${orderNo}  ${Number(body.total) || 0} zł${who}`);
        return json(res, 201, { orderNo, createdAt });
      }
      if (req.method === 'POST' && pathname === '/api/cart') {
        const body = await readBody(req);
        const id = randomId();
        db.carts[id] = { snapshot: body.snapshot ?? body, savedAt: new Date().toISOString() };
        persist(db);
        return json(res, 201, { id });
      }
      if (req.method === 'GET' && pathname.startsWith('/api/cart/')) {
        const cart = db.carts[pathname.slice('/api/cart/'.length)];
        return cart ? json(res, 200, cart) : json(res, 404, { error: 'not found' });
      }
      if (req.method === 'GET' && pathname === '/api/projects') {
        const list = Object.entries(db.projects).map(([id, p]) => ({
          id,
          name: p.name,
          savedAt: p.savedAt,
          count: p.snapshot?.items?.length ?? 0,
          room: p.snapshot?.room?.kind ?? null,
        }));
        return json(res, 200, list);
      }
      if (req.method === 'POST' && pathname === '/api/projects') {
        const body = await readBody(req);
        const id = randomId();
        db.projects[id] = {
          name: (body.name || 'Projekt').toString().slice(0, 60),
          snapshot: body.snapshot ?? null,
          savedAt: new Date().toISOString(),
        };
        persist(db);
        return json(res, 201, { id });
      }
      if (req.method === 'GET' && pathname.startsWith('/api/projects/')) {
        const p = db.projects[pathname.slice('/api/projects/'.length)];
        return p ? json(res, 200, { snapshot: p.snapshot }) : json(res, 404, { error: 'not found' });
      }
      if (req.method === 'DELETE' && pathname.startsWith('/api/projects/')) {
        const id = pathname.slice('/api/projects/'.length);
        if (db.projects[id]) {
          delete db.projects[id];
          persist(db);
          return json(res, 200, { ok: true });
        }
        return json(res, 404, { error: 'not found' });
      }
      return json(res, 404, { error: 'Nieznany endpoint' });
    }

    // ————— STATYCZNY FRONTEND —————
    if (req.method === 'GET') return serveStatic(req, res, pathname);
    return json(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, HOST, () =>
  console.log(`MebleLab 3D — serwer na http://${HOST}:${PORT}  (API: /api, frontend: dist/)`)
);
