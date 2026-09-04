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

/**
 * La última lectura de un equipo, tal como la sirve el servidor.
 *
 * Todos los campos son opcionales porque ningún fabricante los publica todos.
 * Un `null` significa «este equipo no lo informa», nunca «vale cero»: pintar un
 * cero en la señal es pintar un enlace muerto sobre uno que funciona.
 */
export interface DeviceTelemetry {
	sampled_at: string | null;
	uptime_seconds: number | null;
	cpu_load_percent: number | null;
	memory_free_bytes: number | null;
	memory_total_bytes: number | null;
	/** Lo calcula el servidor para que la tarjeta, la ficha y el mapa coincidan. */
	memory_used_percent: number | null;
	signal_dbm: number | null;
	noise_floor_dbm: number | null;
	snr_db: number | null;
	ccq_percent: number | null;
	/**
	 * Los dos indicadores propios de airMAX. No se derivan de la señal: un
	 * enlace puede ir a -55 dBm y estar dando el 11 % de su capacidad porque el
	 * sector está saturado, y eso no se ve en ninguna otra métrica.
	 */
	airmax_quality_percent: number | null;
	airmax_capacity_percent: number | null;
	/** Tasa negociada del enlace: a cuánto *podría* ir. */
	tx_rate_mbps: number | null;
	rx_rate_mbps: number | null;
	/** Caudal real cursado: a cuánto está yendo. */
	tx_throughput_kbps: number | null;
	rx_throughput_kbps: number | null;
	tx_power_dbm: number | null;
	frequency_mhz: number | null;
	channel_width_mhz: number | null;
	distance_m: number | null;
	station_count: number | null;
	/** El equipo respondió algo que el driver no supo leer. No es una caída. */
	unparsed: boolean;
}

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
	 * Cómo está configurado el enlace. Vive en la ficha del equipo y no en la
	 * serie porque no cambia entre una lectura y la siguiente.
	 */
	ssid: string | null;
	wireless_mode: string | null;
	wireless_mode_label: string | null;
	security: string | null;
	remote_mac: string | null;
	/** Nula mientras el equipo no haya reportado nada. */
	telemetry: DeviceTelemetry | null;
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
	/**
	 * Estado tras anotar el sondeo. Un equipo que acaba de responder deja de
	 * estar «Desconectado» al instante, sin esperar al ciclo del monitor.
	 */
	connectivity_status: ConnectivityStatus;
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

// ── Ficha de diagnóstico de un equipo ────────────────────────────────────────

/**
 * Un punto de la serie histórica.
 *
 * La forma es la misma en las dos resoluciones para que quien pinta el gráfico
 * no tenga que saber cuál está mirando. Lo que la resolución horaria no agrega
 * llega nulo — que es «esta resolución no lo guarda», no «valió cero».
 */
export interface MetricPoint {
	t: string | null;
	signal: number | null;
	/** Solo en resolución horaria: la media sola esconde los baches. */
	signal_min: number | null;
	signal_max: number | null;
	noise: number | null;
	snr: number | null;
	ccq: number | null;
	cpu: number | null;
	airmax_quality: number | null;
	airmax_capacity: number | null;
	tx_kbps: number | null;
	rx_kbps: number | null;
}

export interface DevicePeer {
	link_id: number;
	device_id: number;
	name: string;
	host: string;
	role_label: string | null;
	connectivity_status: ConnectivityStatus;
	type: LinkType;
	status: LinkStatus;
	discovery_source: string;
	last_seen_at: string | null;
}

export interface DeviceMetrics {
	device: NetworkDevice;
	history: {
		/** `sample` hasta 48 h; más atrás el detalle ya está podado. */
		resolution: 'sample' | 'hourly';
		points: MetricPoint[];
	};
	peers: DevicePeer[];
	context: {
		client: { id: number; name: string } | null;
		site: { id: number; name: string } | null;
		agent: { id: number; name: string; last_seen_at: string | null } | null;
	};
}

/**
 * Ficha completa de un equipo: última lectura, historia y vecinos.
 *
 * Se pide solo al abrir la ficha, nunca en el listado: cuesta varias consultas
 * más y una de ellas va contra la tabla de muestras, que es la grande.
 */
export async function fetchDeviceMetrics(id: number, hours = 24): Promise<DeviceMetrics> {
	const res = await fetch(`${API_BASE}/admin/network/devices/${id}/metrics?hours=${hours}`, {
		headers: authHeaders()
	});
	return handleResponse<DeviceMetrics>(res);
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

/**
 * Calidad de un porcentaje en el que MÁS es mejor: CCQ, calidad airMAX.
 *
 * Se separa de `ccqQuality` porque comparten umbrales hoy pero no tienen por qué
 * mañana, y porque leerlo con nombre propio evita usar el de CCQ sobre un dato
 * que no lo es.
 */
export function percentQuality(percent: number | null): Quality {
	if (percent === null) return 'desconocido';
	if (percent >= 90) return 'excelente';
	if (percent >= 75) return 'bueno';
	if (percent >= 60) return 'regular';
	return 'malo';
}

/**
 * Calidad de una carga en la que MENOS es mejor: CPU y memoria.
 *
 * Los umbrales son deliberadamente altos. Una antena con la CPU al 60 % está
 * trabajando, no averiada; pintarla en ámbar enseñaría al operador a ignorar el
 * color, que es lo único que hace útil un panel con cientos de tarjetas.
 */
export function loadQuality(percent: number | null): Quality {
	if (percent === null) return 'desconocido';
	if (percent < 60) return 'excelente';
	if (percent < 80) return 'bueno';
	if (percent < 92) return 'regular';
	return 'malo';
}

/**
 * SNR en dB: la métrica que de verdad dice si un enlace va bien.
 *
 * Una señal de -70 dBm es excelente con un ruido de -95 y es inservible con uno
 * de -75, y solo la resta lo distingue.
 */
export function snrQuality(db: number | null): Quality {
	if (db === null) return 'desconocido';
	if (db >= 25) return 'excelente';
	if (db >= 18) return 'bueno';
	if (db >= 10) return 'regular';
	return 'malo';
}

/** «9 d 23 h», que es como lo cuenta el instalador. */
export function formatUptime(seconds: number | null): string {
	if (seconds === null) return '—';

	const dias = Math.floor(seconds / 86400);
	const horas = Math.floor((seconds % 86400) / 3600);
	const minutos = Math.floor((seconds % 3600) / 60);

	if (dias > 0) return `${dias} d ${horas} h`;
	if (horas > 0) return `${horas} h ${minutos} min`;
	return `${minutos} min`;
}

/**
 * Caudal en la unidad que se lea de un vistazo.
 *
 * Llega en kbps porque es como lo publica el equipo, y se convierte al mostrar y
 * no al guardar: redondear a Mbps en la base de datos borraría justo el tramo
 * bajo, que es donde vive el tráfico de una antena en reposo.
 */
export function formatThroughput(kbps: number | null): string {
	if (kbps === null) return '—';
	if (kbps >= 1000) return `${(kbps / 1000).toFixed(kbps >= 10000 ? 0 : 1)} Mbps`;
	return `${kbps} kbps`;
}

export function formatBytes(bytes: number | null): string {
	if (bytes === null) return '—';
	const mb = bytes / 1024 / 1024;
	return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/** «5805 MHz» con el ancho de canal cuando se conoce. */
export function formatFrequency(mhz: number | null, widthMhz: number | null): string {
	if (mhz === null) return '—';
	return widthMhz === null ? `${mhz} MHz` : `${mhz} MHz / ${widthMhz} MHz`;
}

export function formatDistance(meters: number | null): string {
	if (meters === null) return '—';
	return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters} m`;
}

export const QUALITY_CLASSES: Record<Quality, string> = {
	excelente: 'text-emerald-400',
	bueno: 'text-lime-400',
	regular: 'text-amber-400',
	malo: 'text-red-400',
	desconocido: 'text-neutral-600'
};

/** Relleno de las barras de medida, a juego con la escala de texto. */
export const QUALITY_BARS: Record<Quality, string> = {
	excelente: 'bg-emerald-400',
	bueno: 'bg-lime-400',
	regular: 'bg-amber-400',
	malo: 'bg-red-400',
	desconocido: 'bg-neutral-700'
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
	/**
	 * De dónde salió el hallazgo. Importa porque las dos fuentes ven cosas
	 * distintas: el barrido UDP solo lo contestan los equipos airOS, y la tabla
	 * de vecinos del router solo recoge lo que sea vecino suyo de capa 2. Saber
	 * cuál lo vio explica por qué falta lo que falta.
	 */
	source: 'sweep' | 'neighbor' | 'both';
	/** Equipo cuya tabla de vecinos lo reportó: el otro extremo del enlace. */
	discovered_via: string | null;
	discovered_via_device_id: number | null;
	remote_interface: string | null;
	/** Abonado propuesto. Es una sugerencia: la confirma el operador. */
	suggested_client_id: number | null;
	suggested_client_name: string | null;
	/** `ip` es exacta (coincide con la que factura); `name` es solo una pista. */
	suggested_client_reason: 'ip' | 'name' | null;
}

export const FINDING_SOURCE_LABELS: Record<ScanFinding['source'], string> = {
	sweep: 'Barrido',
	neighbor: 'Vecino del router',
	both: 'Barrido + vecino'
};

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

/** Lo mínimo para elegir un abonado al que vincular un equipo. */
export interface ClienteBuscado {
	id: number;
	full_name: string;
	ip: string | null;
}

/**
 * Busca abonados por nombre para el desplegable del alta.
 *
 * Va contra el listado que ya existe para la pantalla de clientes en vez de
 * abrir un endpoint nuevo: la cartera puede ser de miles y traerla entera para
 * rellenar un `<select>` sería absurdo.
 */
export async function buscarClientes(termino: string): Promise<ClienteBuscado[]> {
	const params = new URLSearchParams({ search: termino, per_page: '15' });
	const res = await fetch(`${API_BASE}/admin/clientes/summary?${params}`, {
		headers: authHeaders()
	});

	if (!res.ok) return [];

	const json = await res.json();
	// El listado de clientes es paginado y no comparte la envoltura `{data}` de
	// este módulo, así que se aceptan las dos formas.
	const filas = json.data?.data ?? json.data ?? [];

	return (Array.isArray(filas) ? filas : []).map((c: Record<string, unknown>) => ({
		id: Number(c.id),
		full_name: String(c.full_name ?? c.name ?? ''),
		ip: (c.ip as string) ?? null
	}));
}

export interface AdoptResult {
	device_id: number;
	/** Enlace creado a partir de quién reportó el vecino; null si no se supo. */
	link_id: number | null;
	/**
	 * La IP del equipo no coincide con la que tiene la ficha del cliente, que
	 * es con la que se le factura. No se corrige solo: hay que mirarlo.
	 */
	ip_warning: string | null;
}

export async function adoptFinding(
	findingId: number,
	payload: {
		name: string;
		role: DeviceRole;
		username?: string;
		password?: string;
		/** Solo válido cuando el rol es `cpe`: el abonado dueño del equipo. */
		client_id?: number | null;
	}
): Promise<AdoptResult> {
	const res = await fetch(`${API_BASE}/admin/network/scan-findings/${findingId}/adopt`, {
		method: 'POST',
		headers: authHeaders(),
		body: JSON.stringify(payload)
	});
	return handleResponse<AdoptResult>(res);
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
