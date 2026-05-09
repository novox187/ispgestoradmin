import { API_BASE } from '$lib/config';

export interface MikrotikRouterSummary {
	id: number;
	name: string;
	host: string;
	is_active: boolean;
}

function authHeaders(): Record<string, string> {
	const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
	const headers: Record<string, string> = { Accept: 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
}

export async function fetchMikrotikRouters(): Promise<MikrotikRouterSummary[]> {
	const res = await fetch(`${API_BASE}/admin/mikrotik-routers`, {
		headers: authHeaders()
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message ?? `Error ${res.status}`);
	}
	const json = await res.json();
	return json.data as MikrotikRouterSummary[];
}
