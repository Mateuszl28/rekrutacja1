// Prosty backend koszyka dla MebleLab 3D — bez zależności (wbudowany http Node).
// Trwałość: plik server/data.json. Uruchomienie: npm run server (port 3001).
//
// API:
//   GET  /api/health            → { ok, orders }
//   GET  /api/orders            → lista zamówień (podsumowania)
//   POST /api/orders            → złóż zamówienie { items, total, room } → { orderNo, createdAt }
//   POST /api/cart              → zapisz projekt w chmurze { snapshot } → { id }
//   GET  /api/cart/:id          → wczytaj projekt → { snapshot }

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PORT || 3031;
const DATA_FILE = fileURLToPath(new URL('./data.json', import.meta.url));

function load() {
  if (!existsSync(DATA_FILE)) return { seq: 1000, orders: [], carts: {} };
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { seq: 1000, orders: [], carts: {} };
  }
}
function save(db) {
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = load();

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
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

function randomId() {
  // deterministycznie „losowy” identyfikator bez zależności
  return 'c' + (db.seq++).toString(36) + Date.now().toString(36);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') return json(res, 204, {});

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return json(res, 200, { ok: true, orders: db.orders.length });
    }

    if (req.method === 'GET' && pathname === '/api/orders') {
      return json(res, 200, db.orders);
    }

    if (req.method === 'POST' && pathname === '/api/orders') {
      const body = await readBody(req);
      const order = {
        orderNo: db.seq++,
        createdAt: new Date().toISOString(),
        room: body.room ?? null,
        total: Number(body.total) || 0,
        items: Array.isArray(body.items) ? body.items : [],
      };
      db.orders.push({
        orderNo: order.orderNo,
        createdAt: order.createdAt,
        room: order.room,
        total: order.total,
        count: order.items.reduce((s, i) => s + (i.qty || 1), 0),
      });
      save(db);
      console.log(`[order] #${order.orderNo}  ${order.total} zł  (${order.items.length} pozycji)`);
      return json(res, 201, { orderNo: order.orderNo, createdAt: order.createdAt });
    }

    if (req.method === 'POST' && pathname === '/api/cart') {
      const body = await readBody(req);
      const id = randomId();
      db.carts[id] = { snapshot: body.snapshot ?? body, savedAt: new Date().toISOString() };
      save(db);
      return json(res, 201, { id });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/cart/')) {
      const id = pathname.slice('/api/cart/'.length);
      const cart = db.carts[id];
      if (!cart) return json(res, 404, { error: 'not found' });
      return json(res, 200, cart);
    }

    return json(res, 404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, () => console.log(`MebleLab 3D — backend koszyka na http://localhost:${PORT}`));
