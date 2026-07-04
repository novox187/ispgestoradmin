import { API_BASE } from '$lib/config';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('employee_token') : null;
  return {
    Authorization: `Bearer ${token ?? ''}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export interface AuditEntry {
  id: number;
  table_name: string;
  operation: string;
  record_id: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  user_id: number | null;
  user_type: string | null;
  user_name: string | null;
  user_email: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditPage {
  data: AuditEntry[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AuditFilters {
  tables: string[];
  operations: string[];
}

export interface AuditQuery {
  table_name?: string;
  operation?: string;
  record_id?: string;
  user_id?: number;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

export async function fetchAudits(query: AuditQuery = {}): Promise<AuditPage> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  }
  const res = await fetch(`${API_BASE}/admin/audits?${qs}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status} al cargar la auditoría`);
  return res.json();
}

export async function fetchAuditFilters(): Promise<AuditFilters> {
  const res = await fetch(`${API_BASE}/admin/audits/filters`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status} al cargar los filtros de auditoría`);
  return res.json();
}

export async function fetchClientAudits(
  clientId: number,
  query: { operation?: string; page?: number; per_page?: number } = {},
): Promise<AuditPage> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
  }
  const res = await fetch(`${API_BASE}/admin/clientes/${clientId}/audits?${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Error ${res.status} al cargar el historial del cliente`);
  return res.json();
}
