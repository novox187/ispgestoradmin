import { API_BASE } from '$lib/config';
import type {
  NotificationCatalog,
  ChannelState,
  EventRoute,
  NotificationLogRow,
  SendTestResult,
} from '$lib/types/notifications';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('employee_token') : null;
  return {
    Authorization: `Bearer ${token ?? ''}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as any).message || `Error ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function getNotificationCatalog(): Promise<NotificationCatalog> {
  const res = await fetch(`${API_BASE}/admin/notifications/catalog`, { headers: authHeaders() });
  return handle<NotificationCatalog>(res);
}

export async function listChannels(): Promise<{ channels: ChannelState[] }> {
  const res = await fetch(`${API_BASE}/admin/notifications/channels`, { headers: authHeaders() });
  return handle(res);
}

export interface UpdateChannelPayload {
  enabled?: boolean;
  credentials?: Record<string, string | null>;
  settings?: Record<string, string | null>;
}

export async function updateChannel(key: string, payload: UpdateChannelPayload): Promise<{ message: string; channel: any }> {
  const res = await fetch(`${API_BASE}/admin/notifications/channels/${key}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function listRoutes(): Promise<{ routes: EventRoute[] }> {
  const res = await fetch(`${API_BASE}/admin/notifications/routes`, { headers: authHeaders() });
  return handle(res);
}

export async function replaceRoutes(routes: EventRoute[]): Promise<{ message: string; count: number }> {
  const res = await fetch(`${API_BASE}/admin/notifications/routes`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ routes }),
  });
  return handle(res);
}

export async function sendTestNotification(key: string, address?: string): Promise<SendTestResult> {
  const res = await fetch(`${API_BASE}/admin/notifications/channels/${key}/test`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(address ? { address } : {}),
  });
  const data = await res.json().catch(() => ({}));
  // 5xx también devuelve JSON con detalle del error de envío — lo dejamos
  // pasar para que el frontend pueda mostrar el mensaje específico.
  if (res.ok || (res.status >= 400 && res.status < 600 && data?.message)) {
    return data as SendTestResult;
  }
  throw new Error(`Error ${res.status}`);
}

export async function listLogs(filters?: { channel?: string; status?: string; category?: string }): Promise<{ logs: NotificationLogRow[] }> {
  const params = new URLSearchParams();
  if (filters?.channel) params.set('channel', filters.channel);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.category) params.set('category', filters.category);
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/admin/notifications/logs${qs ? '?' + qs : ''}`, { headers: authHeaders() });
  return handle(res);
}
