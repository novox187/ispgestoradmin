import { API_BASE } from '$lib/config';

/**
 * Cliente del módulo de alta automática de dispositivos.
 *
 * El flujo es automático de punta a punta; estos endpoints existen para verlo
 * avanzar y para lo que se sale de lo normal: aprobar cuando la aprobación
 * automática está desactivada, cancelar un alta que no debía ocurrir y forzar
 * la reversión de una que quedó a medias.
 */

export type ProvisioningStatus =
	| 'detected'
	| 'identifying'
	| 'awaiting_approval'
	| 'provisioning_router'
	| 'provisioning_host'
	| 'verifying'
	| 'hardening'
	| 'completed'
	| 'failed'
	| 'rolled_back'
	| 'cancelled';

export interface ProvisioningTask {
	id: number;
	type: string;
	type_label: string;
	status: 'pending' | 'claimed' | 'succeeded' | 'failed' | 'expired';
	attempts: number;
	claimed_at: string | null;
	finished_at: string | null;
	error_code: string | null;
	error_message: string | null;
	logs: string[];
	created_at: string | null;
}

export interface AuditEntry {
	id: number;
	operation: string;
	new_values: Record<string, unknown> | null;
	user_name: string | null;
	created_at: string | null;
}

export interface ProvisioningSession {
	id: number;
	status: ProvisioningStatus;
	status_label: string;
	step_index: number;
	is_terminal: boolean;
	detection_method: string;
	agent: { id: number; name: string | null };
	device: {
		mac_address: string | null;
		identity: string | null;
		board_name: string | null;
		routeros_version: string | null;
		serial_number: string | null;
		link_interface: string | null;
		lan_ip: string | null;
	};
	vpn: {
		interface: string | null;
		assigned_ip: string | null;
		endpoint: string | null;
		public_key: string | null;
	};
	router_id: number | null;
	error_code: string | null;
	error_message: string | null;
	started_at: string | null;
	completed_at: string | null;
	created_at: string | null;
	tasks?: ProvisioningTask[];
	audit_trail?: AuditEntry[];
}

/**
 * Roles de agente. El `monitor` sondea el parque y ejecuta los barridos de
 * descubrimiento; va aparte del `provisioner` porque aquel corre un bucle de
 * tres segundos que no puede bloquearse sondeando cientos de antenas.
 */
export type AgentRole = 'provisioner' | 'vpn_host' | 'monitor';

export interface ProvisioningAgent {
	id: number;
	name: string;
	role: AgentRole;
	role_label: string;
	is_active: boolean;
	is_online: boolean;
	enrolled: boolean;
	pending_enrollment: boolean;
	agent_version: string | null;
	last_seen_at: string | null;
	last_ip: string | null;
	capabilities: Record<string, unknown>;
	created_at: string | null;
}

export interface EnrolledAgent extends ProvisioningAgent {
	/** Solo se devuelve una vez, al registrar o regenerar. No se puede recuperar. */
	enrollment_token: string;
	enrollment_expires: string | null;
	enroll_command: string;
	/** Orden única que instala, enrola y arranca el agente en la máquina destino. */
	installer_command: string;
}

/** Pasos del alta, en el orden en que los recorre la saga del servidor. */
export const PROVISIONING_STEPS = [
	{ label: 'Detectado', hint: 'Equipo visto en el puerto de aprovisionamiento' },
	{ label: 'Identificado', hint: 'Modelo, versión y compatibilidad comprobados' },
	{ label: 'VPN en el router', hint: 'Interfaz WireGuard creada en el equipo' },
	{ label: 'Peer en el hosting', hint: 'El servidor acepta al equipo' },
	{ label: 'Verificación', hint: 'Handshake confirmado en ambos extremos' },
	{ label: 'Credenciales', hint: 'Usuario propio y API cerrada al túnel' },
	{ label: 'Registrado', hint: 'Alcanzable desde la aplicación' }
] as const;

function authHeaders(): Record<string, string> {
	const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/json'
	};
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		// El backend devuelve {error:{code,message}} en los rechazos del módulo y
		// {message} en los de validación; se prefiere el detalle específico.
		throw new Error(body.error?.message ?? body.message ?? `Error ${res.status}`);
	}
	const json = await res.json();
	return json.data as T;
}

// ── Sesiones ────────────────────────────────────────────────────────────────

export async function fetchProvisioningSessions(
	options: { active?: boolean; perPage?: number } = {}
): Promise<ProvisioningSession[]> {
	const params = new URLSearchParams();
	if (options.active) params.set('active', '1');
	if (options.perPage) params.set('per_page', String(options.perPage));

	const res = await fetch(`${API_BASE}/admin/provisioning/sessions?${params}`, {
		headers: authHeaders()
	});
	return handleResponse<ProvisioningSession[]>(res);
}

export async function fetchProvisioningSession(id: number): Promise<ProvisioningSession> {
	const res = await fetch(`${API_BASE}/admin/provisioning/sessions/${id}`, {
		headers: authHeaders()
	});
	return handleResponse<ProvisioningSession>(res);
}

export async function approveSession(id: number): Promise<ProvisioningSession> {
	const res = await fetch(`${API_BASE}/admin/provisioning/sessions/${id}/approve`, {
		method: 'POST',
		headers: authHeaders()
	});
	return handleResponse<ProvisioningSession>(res);
}

export async function cancelSession(id: number, reason?: string): Promise<ProvisioningSession> {
	const res = await fetch(`${API_BASE}/admin/provisioning/sessions/${id}/cancel`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({ reason })
	});
	return handleResponse<ProvisioningSession>(res);
}

export async function rollbackSession(id: number, reason?: string): Promise<ProvisioningSession> {
	const res = await fetch(`${API_BASE}/admin/provisioning/sessions/${id}/rollback`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({ reason })
	});
	return handleResponse<ProvisioningSession>(res);
}

// ── Agentes ─────────────────────────────────────────────────────────────────

export async function fetchAgents(): Promise<ProvisioningAgent[]> {
	const res = await fetch(`${API_BASE}/admin/provisioning/agents`, { headers: authHeaders() });
	return handleResponse<ProvisioningAgent[]>(res);
}

export async function createAgent(name: string, role: AgentRole): Promise<EnrolledAgent> {
	const res = await fetch(`${API_BASE}/admin/provisioning/agents`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({ name, role })
	});
	return handleResponse<EnrolledAgent>(res);
}

export async function regenerateAgentToken(id: number): Promise<EnrolledAgent> {
	const res = await fetch(`${API_BASE}/admin/provisioning/agents/${id}/regenerate-token`, {
		method: 'POST',
		headers: authHeaders()
	});
	return handleResponse<EnrolledAgent>(res);
}

export async function setAgentActive(id: number, isActive: boolean): Promise<ProvisioningAgent> {
	const res = await fetch(`${API_BASE}/admin/provisioning/agents/${id}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify({ is_active: isActive })
	});
	return handleResponse<ProvisioningAgent>(res);
}

export async function deleteAgent(id: number): Promise<void> {
	const res = await fetch(`${API_BASE}/admin/provisioning/agents/${id}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error?.message ?? body.message ?? `Error ${res.status}`);
	}
}
