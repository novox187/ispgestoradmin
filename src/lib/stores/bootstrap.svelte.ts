import { API_BASE } from '$lib/config';

/**
 * Estado de bootstrap del sistema. Indica si hay un router MikroTik primary
 * configurado. Mientras `primaryRouterConfigured=false`:
 *  - El layout renderiza el banner persistente con CTA.
 *  - Los enlaces a módulos dependientes (firewall, colas, sync) se deshabilitan.
 *  - Cualquier llamada al backend a esos endpoints retornaría 423 Locked.
 */
export class BootstrapState {
	primaryRouterConfigured = $state<boolean | null>(null);
	primaryRouter = $state<{
		id: number;
		name: string;
		host: string;
		port: number | null;
		is_active: boolean;
		connectivity_status: string | null;
		last_health_check_at: string | null;
	} | null>(null);
	routersTotal = $state(0);
	cta = $state({
		message: 'Configure el router principal para habilitar todas las funcionalidades.',
		redirect_to: '/mikrotik/dispositivos',
		label: 'Configurar router principal'
	});
	loading = $state(false);
	lastError = $state<string | null>(null);

	async refresh(): Promise<void> {
		if (typeof window === 'undefined') return;
		const token = localStorage.getItem('employee_token');
		if (!token) {
			this.primaryRouterConfigured = null;
			return;
		}

		this.loading = true;
		this.lastError = null;
		try {
			const res = await fetch(`${API_BASE}/admin/system-bootstrap`, {
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${token}`
				}
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = await res.json();
			this.primaryRouterConfigured = !!body.primary_router_configured;
			this.primaryRouter = body.primary_router ?? null;
			this.routersTotal = body.routers_total ?? 0;
			if (body.cta) this.cta = body.cta;
		} catch (e: any) {
			this.lastError = e?.message ?? 'No se pudo consultar el estado del sistema';
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Conjunto de prefijos de ruta que dependen del router primary. Útil para
	 * deshabilitar enlaces en el sidebar.
	 */
	static readonly ROUTER_DEPENDENT_PREFIXES = [
		'/mikrotik/firewall',
		'/mikrotik/colas',
		'/mikrotik/sincronizacion',
		'/mikrotik/monitoreo'
	];

	isRouteBlocked(path: string): boolean {
		if (this.primaryRouterConfigured !== false) return false;
		return BootstrapState.ROUTER_DEPENDENT_PREFIXES.some((p) => path.startsWith(p));
	}
}

export const bootstrap = new BootstrapState();
