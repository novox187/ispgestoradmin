import { API_BASE } from '$lib/config';
import type {
  WhitelistEntry,
  WhitelistHistoryEntry,
  WhitelistCreatePayload,
  WhitelistUpdatePayload,
} from '$lib/types/whitelist';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('employee_token') : null;
  return {
    Authorization: `Bearer ${token ?? ''}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export interface ListFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}

export async function listWhitelist(filters: ListFilters = {}): Promise<WhitelistEntry[]> {
  const qs = new URLSearchParams();
  if (filters.search) qs.set('search', filters.search);
  if (filters.status) qs.set('status', filters.status);
  const res = await fetch(`${API_BASE}/admin/whitelist?${qs.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status} al listar lista blanca`);
  const json = await res.json();
  return json.data ?? [];
}

export async function getWhitelistEntry(id: number): Promise<WhitelistEntry> {
  const res = await fetch(`${API_BASE}/admin/whitelist/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status} al obtener inclusión`);
  const json = await res.json();
  return json.data;
}

export async function addClientToWhitelist(payload: WhitelistCreatePayload): Promise<WhitelistEntry> {
  const res = await fetch(`${API_BASE}/admin/whitelist`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return json.data;
}

export async function updateWhitelistEntry(
  id: number,
  payload: WhitelistUpdatePayload,
): Promise<WhitelistEntry> {
  const res = await fetch(`${API_BASE}/admin/whitelist/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return json.data;
}

export async function removeFromWhitelist(id: number, reason?: string): Promise<WhitelistEntry> {
  const res = await fetch(`${API_BASE}/admin/whitelist/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ reason: reason ?? null }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || `Error ${res.status}`;
    throw new Error(msg);
  }
  return json.data;
}

export async function listWhitelistHistory(clientId?: number): Promise<WhitelistHistoryEntry[]> {
  const qs = new URLSearchParams();
  if (clientId) qs.set('client_id', String(clientId));
  const res = await fetch(`${API_BASE}/admin/whitelist/history?${qs.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status} al obtener historial`);
  const json = await res.json();
  return json.data ?? [];
}

export function exportWhitelistCsvUrl(status: 'active' | 'inactive' | 'all' = 'active'): string {
  const token = typeof window !== 'undefined' ? localStorage.getItem('employee_token') : '';
  return `${API_BASE}/admin/whitelist/export?status=${status}&token=${encodeURIComponent(token ?? '')}`;
}

/**
 * Descarga el CSV usando fetch con el header de autorización (más seguro que
 * pasar el token por query string).
 */
export async function downloadWhitelistCsv(status: 'active' | 'inactive' | 'all' = 'active'): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/whitelist/export?status=${status}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status} al exportar CSV`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lista_blanca_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
