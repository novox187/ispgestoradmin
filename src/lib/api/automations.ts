import { API_BASE } from '$lib/config';
import type { AutomationSetting, AutomationAudit, ScheduleType, ScheduleConfig } from '$lib/types/automation';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('employee_token') : null;
  return {
    Authorization: `Bearer ${token ?? ''}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function listAutomations(): Promise<AutomationSetting[]> {
  const res = await fetch(`${API_BASE}/admin/automations`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status} al listar automatizaciones`);
  return res.json();
}

export async function getAutomation(key: string): Promise<AutomationSetting> {
  const res = await fetch(`${API_BASE}/admin/automations/${key}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status} al obtener la automatización`);
  return res.json();
}

export interface UpdateAutomationPayload {
  enabled?: boolean;
  schedule_type?: ScheduleType;
  schedule_config?: ScheduleConfig;
  params?: Record<string, any>;
}

export async function updateAutomation(
  key: string,
  payload: UpdateAutomationPayload,
): Promise<AutomationSetting | { errors: Record<string, string> }> {
  const res = await fetch(`${API_BASE}/admin/automations/${key}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 422 && data.errors) return { errors: data.errors };
    throw new Error(data.message || `Error ${res.status}`);
  }
  return data;
}

export async function getAutomationAudits(key: string): Promise<AutomationAudit[]> {
  const res = await fetch(`${API_BASE}/admin/automations/${key}/audits`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Error ${res.status} al cargar auditoría`);
  return res.json();
}

export async function runAutomationNow(key: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/admin/automations/${key}/run-now`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
  return data;
}
