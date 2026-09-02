import { API_BASE } from '$lib/config';

/** Fabricantes que el inventario sabe representar. Espeja `App\Enums\DeviceVendor`. */
export type DeviceVendor = 'mikrotik' | 'ubiquiti';

/** Papel del equipo en la red. Espeja `App\Enums\DeviceRole`. */
export type DeviceRole =
	| 'core_router'
	| 'edge_router'
	| 'backhaul_ap'
	| 'backhaul_station'
	| 'sector_ap'
	| 'cpe';

/**
 * Estado de conectividad.
 *
 * `stale` no es un sinónimo de `disconnected`: significa que nadie ha podido
 * preguntarle al equipo últimamente, casi siempre porque su agente está caído.
 * Pintarlos igual haría creer al operador que se le ha caído medio parque.
 */
export type ConnectivityStatus = 'connected' | 'disconnected' | 'stale' | 'unknown' | null;

export interface NetworkDevice {
	id: number;
	name: string;
	vendor: DeviceVendor | null;
	vendor_label: string | null;
	role: DeviceRole | null;
	role_label: string | null;
	driver: string | null;
	model: string | null;
	firmware_version: string | null;
	host: string;
	port: number | null;
	username: string | null;
	description: string | null;
	is_active: boolean;
	is_monitored: boolean;
	is_primary: boolean;
	mac_address: string | null;
	serial_number: string | null;
	latitude: string | null;
	longitude: string | null;
	agent_id: number | null;
	credential_profile_id: number | null;
	has_radio: boolean;
	connectivity_status: ConnectivityStatus;
	last_signal_dbm: number | null;
	last_ccq_percent: number | null;
	last_telemetry_at: string | null;
	/**
	 * Falso para los MikroTik: este endpoint no los escribe. La pantalla de
	 * Dispositivos los edita igualmente, despachando a `mikrotik-routers`.
	 */
	editable: boolean;
}

export interface DevicePayload {
	name: string;
	vendor: DeviceVendor;
	role: DeviceRole;
	host: string;
	port?: number | null;
	username?: string | null;
	password?: string | null;
	description?: string | null;
	is_active?: boolean;
	is_monitored?: boolean;
	mac_address?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	agent_id?: number | null;
}

export interface ProbeOutcome {
	ok: boolean;
	error: string | null;
	model: string | null;
	firmware: string | null;
}

export interface DeviceFilters {
	vendor?: DeviceVendor;
	role?: DeviceRole;
	only_infrastructure?: boolean;
}

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
		// Este módulo devuelve `{error:{code,message}}` en los rechazos de
		// negocio y `{message}` en los de validación de Laravel.
		throw new Error(body.error?.message ?? body.message ?? `Error ${res.status}`);
	}
	const json = await res.json();
	return json.data as T;
}

export async function fetchNetworkDevices(filters: DeviceFilters = {}): Promise<NetworkDevice[]> {
	const params = new URLSearchParams();
	if (filters.vendor) params.set('vendor', filters.vendor);
	if (filters.role) params.set('role', filters.role);
	if (filters.only_infrastructure) params.set('only_infrastructure', '1');

	const query = params.toString();
	const res = await fetch(`${API_BASE}/admin/network/devices${query ? `?${query}` : ''}`, {
		headers: authHeaders()
	});
	return handleResponse<NetworkDevice[]>(res);
}

export async function createNetworkDevice(payload: DevicePayload): Promise<NetworkDevice> {
	const res = await fetch(`${API_BASE}/admin/network/devices`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(payload)
	});
	return handleResponse<NetworkDevice>(res);
}

export async function updateNetworkDevice(
	id: number,
	payload: Partial<DevicePayload>
): Promise<NetworkDevice> {
	const res = await fetch(`${API_BASE}/admin/network/devices/${id}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify(payload)
	});
	return handleResponse<NetworkDevice>(res);
}

export async function deleteNetworkDevice(id: number): Promise<void> {
	const res = await fetch(`${API_BASE}/admin/network/devices/${id}`, {
		method: 'DELETE',
		headers: authHeaders()
	});
	await handleResponse<unknown>(res);
}

/** Comprueba en el momento si el equipo responde con las credenciales guardadas. */
export async function testNetworkDevice(id: number): Promise<ProbeOutcome> {
	const res = await fetch(`${API_BASE}/admin/network/devices/${id}/test`, {
		method: 'POST',
		headers: authHeaders()
	});
	return handleResponse<ProbeOutcome>(res);
}

// ── Lectura de la calidad de un enlace ───────────────────────────────────────
//
// Los umbrales son los que usa la propia herramienta de Ubiquiti y los que
// maneja cualquier instalador: por encima de -65 dBm un enlace va sobrado, por
// debajo de -85 hay que ir a mirarlo.

export type Quality = 'excelente' | 'bueno' | 'regular' | 'malo' | 'desconocido';

export function signalQuality(dbm: number | null): Quality {
	if (dbm === null) return 'desconocido';
	if (dbm >= -65) return 'excelente';
	if (dbm >= -75) return 'bueno';
	if (dbm >= -85) return 'regular';
	return 'malo';
}

export function ccqQuality(percent: number | null): Quality {
	if (percent === null) return 'desconocido';
	if (percent >= 90) return 'excelente';
	if (percent >= 75) return 'bueno';
	if (percent >= 60) return 'regular';
	return 'malo';
}

export const QUALITY_CLASSES: Record<Quality, string> = {
	excelente: 'text-emerald-400',
	bueno: 'text-lime-400',
	regular: 'text-amber-400',
	malo: 'text-red-400',
	desconocido: 'text-neutral-600'
};

export const STATUS_LABELS: Record<string, string> = {
	connected: 'Conectado',
	disconnected: 'Desconectado',
	stale: 'Sin datos recientes',
	unknown: 'Sin comprobar'
};

export const STATUS_CLASSES: Record<string, string> = {
	connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
	disconnected: 'bg-red-500/10 text-red-400 border-red-500/20',
	// Ámbar y no rojo: «no lo sé» no es «está caído».
	stale: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
	unknown: 'bg-neutral-500/10 text-neutral-400 border-neutral-600/30'
};

// ── Barridos de descubrimiento ───────────────────────────────────────────────

export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface NetworkScan {
	id: number;
	cidr: string;
	status: ScanStatus;
	agent: string | null;
	agent_id: number;
	requested_by: string | null;
	started_at: string | null;
	finished_at: string | null;
	found_count: number;
	error_code: string | null;
	error_message: string | null;
	created_at: string | null;
}

export interface ScanFinding {
	id: number;
	ip_address: string;
	mac_address: string | null;
	vendor: string | null;
	model: string | null;
	firmware: string | null;
	hostname: string | null;
	essid: string | null;
	/** Ya está en el inventario: se muestra, pero no se ofrece dar de alta. */
	known: boolean;
	known_as: string | null;
}

export interface ScanDetail extends NetworkScan {
	findings: ScanFinding[];
}

export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
	pending: 'En cola',
	running: 'Barriendo…',
	completed: 'Terminado',
	failed: 'Falló',
	cancelled: 'Cancelado'
};

export const SCAN_STATUS_CLASSES: Record<ScanStatus, string> = {
	pending: 'bg-neutral-500/10 text-neutral-400 border-neutral-600/30',
	running: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
	completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
	failed: 'bg-red-500/10 text-red-400 border-red-500/20',
	cancelled: 'bg-neutral-500/10 text-neutral-500 border-neutral-600/30'
};

export async function fetchScans(): Promise<NetworkScan[]> {
	const res = await fetch(`${API_BASE}/admin/network/scans`, { headers: authHeaders() });
	return handleResponse<NetworkScan[]>(res);
}

export async function fetchScan(id: number): Promise<ScanDetail> {
	const res = await fetch(`${API_BASE}/admin/network/scans/${id}`, { headers: authHeaders() });
	return handleResponse<ScanDetail>(res);
}

export async function requestScan(agentId: number, cidr: string): Promise<NetworkScan> {
	const res = await fetch(`${API_BASE}/admin/network/scans`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify({ agent_id: agentId, cidr })
	});
	return handleResponse<NetworkScan>(res);
}

export async function adoptFinding(
	findingId: number,
	payload: { name: string; role: DeviceRole; username?: string; password?: string }
): Promise<{ device_id: number }> {
	const res = await fetch(`${API_BASE}/admin/network/scan-findings/${findingId}/adopt`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(payload)
	});
	return handleResponse<{ device_id: number }>(res);
}

// ── Topología y mapa ─────────────────────────────────────────────────────────

export type LinkStatus = 'discovered' | 'confirmed' | 'archived';
export type LinkType = 'wireless_ptp' | 'wireless_ptmp' | 'fiber' | 'utp' | 'vpn';

export interface NetworkSite {
	id: number;
	name: string;
	type: string;
	type_label: string;
	address: string | null;
	latitude: string | null;
	longitude: string | null;
	elevation_m: number | null;
	parent_site_id: number | null;
	notes: string | null;
	devices_count: number | null;
}

export interface MapDevice {
	id: number;
	name: string;
	vendor: DeviceVendor | null;
	role: DeviceRole | null;
	role_label: string | null;
	host: string;
	site_id: number | null;
	site_name: string | null;
	latitude: string | null;
	longitude: string | null;
	/** 'device' si tiene coordenadas propias, 'site' si las hereda, null si no tiene. */
	located_by: 'device' | 'site' | null;
	connectivity_status: ConnectivityStatus;
	last_signal_dbm: number | null;
	last_ccq_percent: number | null;
}

export interface NetworkLink {
	id: number;
	a_device_id: number;
	b_device_id: number;
	a_name: string | null;
	b_name: string | null;
	type: LinkType;
	status: LinkStatus;
	discovery_source: string;
	last_seen_at: string | null;
	expected_capacity_mbps: number | null;
	notes: string | null;
	/** Peor señal de los dos extremos: se deriva, no se guarda. */
	signal_dbm: number | null;
}

export interface NetworkMap {
	sites: NetworkSite[];
	devices: MapDevice[];
	links: NetworkLink[];
}

export const LINK_STATUS_LABELS: Record<LinkStatus, string> = {
	discovered: 'Sin confirmar',
	confirmed: 'Confirmado',
	archived: 'Archivado'
};

export async function fetchNetworkMap(): Promise<NetworkMap> {
	const res = await fetch(`${API_BASE}/admin/network/map`, { headers: authHeaders() });
	return handleResponse<NetworkMap>(res);
}

export async function fetchSites(): Promise<NetworkSite[]> {
	const res = await fetch(`${API_BASE}/admin/network/sites`, { headers: authHeaders() });
	return handleResponse<NetworkSite[]>(res);
}

export async function createSite(payload: Partial<NetworkSite>): Promise<NetworkSite> {
	const res = await fetch(`${API_BASE}/admin/network/sites`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(payload)
	});
	return handleResponse<NetworkSite>(res);
}

export async function updateLinkStatus(id: number, status: LinkStatus): Promise<NetworkLink> {
	const res = await fetch(`${API_BASE}/admin/network/links/${id}`, {
		method: 'PUT',
		headers: authHeaders(),
		body: JSON.stringify({ status })
	});
	return handleResponse<NetworkLink>(res);
}
