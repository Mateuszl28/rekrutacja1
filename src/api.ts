// Klient backendu koszyka. Każde wywołanie jest odporne na brak serwera —
// przy błędzie zwraca null, dzięki czemu aplikacja działa też w trybie offline
// (frontend uruchomiony samodzielnie przez `npm run dev`).

import type { PlacedItemState, RoomKind } from './types';

export interface OrderPayloadItem {
  productId: string;
  name: string;
  price: number;
  qty: number;
}

export interface OrderResult {
  orderNo: number;
  createdAt: string;
}

export interface Customer {
  name: string;
  email: string;
  phone: string;
}

export interface OrderPayload {
  items: OrderPayloadItem[];
  total: number;
  room: RoomKind;
  customer?: Customer;
  delivery?: { method: string; address: string };
}

export interface Snapshot {
  room: { kind: RoomKind; width: number; depth: number; wallColor: number };
  items: PlacedItemState[];
}

async function req<T>(url: string, opts?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function post<T>(url: string, body: unknown): Promise<T | null> {
  return req<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface OrderSummary {
  orderNo: number;
  createdAt: string;
  room: RoomKind | null;
  total: number;
  count: number;
  status?: string;
  customer?: Customer | null;
  delivery?: { method: string; address: string } | null;
  items?: OrderPayloadItem[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  savedAt: string;
  count: number;
  room: RoomKind | null;
}

async function del<T>(url: string): Promise<T | null> {
  return req<T>(url, { method: 'DELETE' });
}

export const api = {
  health: () => req<{ ok: boolean; orders: number }>('/api/health'),
  placeOrder: (payload: OrderPayload) => post<OrderResult>('/api/orders', payload),
  listOrders: () => req<OrderSummary[]>('/api/orders'),
  updateOrderStatus: (orderNo: number, status: string) =>
    req<{ ok: boolean; status: string }>(`/api/orders/${orderNo}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  saveCart: (snapshot: Snapshot) => post<{ id: string }>('/api/cart', { snapshot }),
  loadCart: (id: string) => req<{ snapshot: Snapshot }>(`/api/cart/${id}`),
  listProjects: () => req<ProjectSummary[]>('/api/projects'),
  saveProject: (name: string, snapshot: Snapshot) => post<{ id: string }>('/api/projects', { name, snapshot }),
  loadProject: (id: string) => req<{ snapshot: Snapshot }>(`/api/projects/${id}`),
  deleteProject: (id: string) => del<{ ok: boolean }>(`/api/projects/${id}`),
};
