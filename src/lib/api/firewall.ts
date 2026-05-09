import { API_BASE } from '$lib/config';
import type { ApplyLog, FirewallSnapshot, ValidationResult } from '$lib/types/mikrotik-firewall';

function authHeaders(): Record<string, string> {
	const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/json'
	};
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
}

export async function fetchFirewallSnapshot(routerId: number): Promise<FirewallSnapshot> {
	const res = await fetch(`${API_BASE}/mikrotik/firewall/snapshot?router_id=${routerId}`, {
		headers: authHeaders()
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.message ?? `Error ${res.status}`);
	}
	const json = await res.json();
	return json.data as FirewallSnapshot;
}

export async function syncFirewallFromRouter(routerId: number): Promise<FirewallSnapshot> {
	const res = await fetch(`${API_BASE}/mikrotik/firewall/sync/from-router`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({ router_id: routerId })
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
	return json.data as FirewallSnapshot;
}

export async function mergeFirewallFromRouter(
	routerId: number
): Promise<{ added: number; data: FirewallSnapshot }> {
	const res = await fetch(`${API_BASE}/mikrotik/firewall/sync/merge-from-router`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({ router_id: routerId })
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
	return { added: json.data.added, data: json.data as FirewallSnapshot };
}

export async function applyFirewallSnapshot(
	routerId: number,
	snapshot: FirewallSnapshot,
	reason?: string
): Promise<{ applied_at: number }> {
	const res = await fetch(`${API_BASE}/mikrotik/firewall/apply`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({
			router_id: routerId,
			reason: reason?.trim() || null,
			snapshot
		})
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
	return json.data as { applied_at: number };
}

export async function validateFirewallSnapshot(
	routerId: number,
	snapshot: FirewallSnapshot
): Promise<ValidationResult> {
	const res = await fetch(`${API_BASE}/mikrotik/firewall/validate`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({ router_id: routerId, snapshot })
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
	return json.data as ValidationResult;
}

export async function fetchApplyLogs(
	routerId: number,
	page = 1,
	perPage = 10
): Promise<{ data: ApplyLog[]; meta: { currentPage: number; lastPage: number; total: number } }> {
	const res = await fetch(
		`${API_BASE}/mikrotik/firewall/apply-logs?router_id=${routerId}&page=${page}&per_page=${perPage}`,
		{ headers: authHeaders() }
	);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
	return json as { data: ApplyLog[]; meta: { currentPage: number; lastPage: number; total: number } };
}

export async function rollbackApplyLog(logId: number): Promise<FirewallSnapshot> {
	const res = await fetch(`${API_BASE}/mikrotik/firewall/apply-logs/${logId}/rollback`, {
		method: 'POST',
		headers: authHeaders()
	});
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json.message ?? `Error ${res.status}`);
	return json.data as FirewallSnapshot;
}

export async function fetchRouterStatus(
	routerId: number
): Promise<{ reachable: boolean; latency_ms: number | null; reason?: string }> {
	const res = await fetch(
		`${API_BASE}/mikrotik/firewall/router-status?router_id=${routerId}`,
		{ headers: authHeaders() }
	);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) return { reachable: false, latency_ms: null };
	return json.data as { reachable: boolean; latency_ms: number | null; reason?: string };
}
