import { API_BASE } from '$lib/config';

export interface MikrotikRouter {
	id: number;
	name: string;
	host: string;
	port: number | null;
	username: string;
	description: string | null;
	is_active: boolean;
	is_primary: boolean;
	network_cidr: string | null;
	gateway: string | null;
	connectivity_status: string | null;
	last_health_check_at: number | null;
	last_connected_at: number | null;
	last_disconnected_at: number | null;
	consecutive_failures: number;
	last_loaded_at: number | null;
	last_applied_at: number | null;
	created_at: number | null;
}

export interface MikrotikRouterSummary {
	id: number;
	name: string;
	host: string;
	is_active: boolean;
	is_primary?: boolean;
}

export interface CreateRouterPayload {
	name: string;
	host: string;
	port?: number | null;
	username: string;
	password: string;
	description?: string | null;
	is_active?: boolean;
	is_primary?: boolean;
	network_cidr?: string | null;
	gateway?: string | null;
}

export interface UpdateRouterPayload {
	name?: string;
	host?: string;
	port?: number | null;
	username?: string;
	password?: string;
	description?: string | null;
	is_active?: boolean;
	is_primary?: boolean;
	network_cidr?: string | null;
	gateway?: string | null;
}

function authHeaders(): Record<string, string> {
	const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
	const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message ?? `Error ${res.status}`);
	}
	const json = await res.json();
	return json.data as T;
}

export async function fetchMikrotikRouters(): Promise<MikrotikRouter[]> {
	const res = await fetch(`${API_BASE}/admin/mikrotik-routers`, { headers: authHeaders() });
	return handleResponse<MikrotikRouter[]>(res);
}

export async function createMikrotikRouter(payload: CreateRouterPayload): Promise<MikrotikRouter> {
	const res = await fetch(`${API_BASE}/admin/mikrotik-routers`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(payload)
	});
	return handleResponse<MikrotikRouter>(res);
}

export async function updateMikrotikRouter(id: number, payload: UpdateRouterPayload): Promise<MikrotikRouter> {
	const res = await fetch(`${API_BASE}/admin/mikrotik-routers/${id}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify(payload)
	});
	return handleResponse<MikrotikRouter>(res);
}

export async function deleteMikrotikRouter(id: number): Promise<void> {
	const res = await fetch(`${API_BASE}/admin/mikrotik-routers/${id}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message ?? `Error ${res.status}`);
	}
}
