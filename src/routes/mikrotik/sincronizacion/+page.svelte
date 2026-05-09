<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import MikroTikActionCard from '$lib/components/mikrotik/MikroTikActionCard.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import { API_BASE } from '$lib/config';
	import { mikrotikFirewallState } from '$lib/stores/mikrotik-firewall.svelte';
	import { fetchMikrotikRouters, type MikrotikRouterSummary } from '$lib/api/mikrotik-routers';
	import {
		AlertTriangle,
		ArrowDownToLine,
		ArrowUpFromLine,
		CheckCircle,
		Info,
		Wifi
	} from '@lucide/svelte';

	const ROUTER_KEY = 'ispga_mikrotik_selected_router_id';

	let online          = $state(true);
	let hasSession      = $state(false);
	let routers         = $state<MikrotikRouterSummary[]>([]);
	let selectedRouterId = $state<number | null>(null);
	let routersLoading  = $state(false);

	const fw = mikrotikFirewallState;

	function refreshRuntimeState() {
		online     = typeof navigator !== 'undefined' ? navigator.onLine : true;
		hasSession = typeof localStorage !== 'undefined' ? !!localStorage.getItem('employee_token') : false;
	}

	onMount(() => {
		refreshRuntimeState();
		const handleOnline = () => refreshRuntimeState();
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOnline);
		const interval = setInterval(refreshRuntimeState, 3000);

		(async () => {
			routersLoading = true;
			try {
				routers = await fetchMikrotikRouters();
				const cached   = typeof localStorage !== 'undefined' ? localStorage.getItem(ROUTER_KEY) : null;
				const cachedId = cached ? Number(cached) : null;
				if (cachedId && routers.some((r) => r.id === cachedId)) {
					selectedRouterId = cachedId;
				} else if (routers.length === 1) {
					selectedRouterId = routers[0].id;
				}
			} catch {
				toast.error('No se pudo obtener la lista de routers.');
			} finally {
				routersLoading = false;
			}
		})();

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOnline);
			clearInterval(interval);
		};
	});

	function handleNotify({ type, message }: { type: 'success' | 'error' | 'info'; message: string }) {
		toast[type](message);
	}

	function validateBase(): string | null {
		if (!online)     return 'Sin conexión a internet.';
		if (!hasSession) return 'Sesión expirada. Inicia sesión nuevamente.';
		return null;
	}

	function validateFirewall(): string | null {
		const base = validateBase();
		if (base) return base;
		if (!selectedRouterId) return 'Selecciona un router para continuar.';
		return null;
	}

	// ── Colas ────────────────────────────────────────────────────────────────

	async function syncQueues(_useAsync: boolean) {
		const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json'
		};
		if (token) headers.Authorization = `Bearer ${token}`;

		const res = await fetch(`${API_BASE}/mikrotik/sync/queues/cleanup`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ async: _useAsync })
		});
		const payload = await res.json().catch(() => null);
		if (!res.ok) return { ok: false, message: payload?.message ?? `Error ${res.status}` };
		return { ok: true, message: payload?.message ?? (_useAsync ? 'Tarea en cola.' : 'Sincronización completada.') };
	}

	// ── Firewall: Router → BD ────────────────────────────────────────────────

	async function syncFromRouter(_useAsync: boolean) {
		if (!selectedRouterId) return { ok: false, message: 'Sin router seleccionado.' };
		try {
			const result = await fw.syncFromRouter(selectedRouterId);
			return {
				ok: true,
				message: `Importadas ${result.filterCount} regla(s) de filtro y ${result.natCount} regla(s) NAT desde el router.`
			};
		} catch {
			return { ok: false, message: fw.apiError ?? 'Error al importar desde el router.' };
		}
	}

	// ── Firewall: BD → Router ────────────────────────────────────────────────

	async function applyToRouter(_useAsync: boolean) {
		if (!selectedRouterId) return { ok: false, message: 'Sin router seleccionado.' };
		try {
			await fw.applyToApi(selectedRouterId);
			return { ok: true, message: 'Reglas aplicadas al router correctamente.' };
		} catch {
			return { ok: false, message: fw.apiError ?? 'Error al aplicar al router.' };
		}
	}
</script>

<div class="space-y-6">

	<!-- Header -->
	<div class="rounded-2xl border border-white/10 bg-gradient-to-r from-blue-500/10 via-transparent to-transparent p-5 sm:p-6">
		<div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
			<div class="space-y-1">
				<div class="text-xs font-mono text-gray-400 tracking-wide">MIKROTIK / SINCRONIZACIÓN</div>
				<h3 class="text-lg sm:text-xl font-semibold text-gray-100">Sincronización</h3>
				<p class="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-2xl">
					Sincroniza colas de ancho de banda y reglas de firewall entre la base de datos y el router MikroTik.
				</p>
			</div>
			<div class="flex items-center gap-2 flex-wrap">
				<span
					class="text-[10px] font-mono tracking-wide px-3 py-1 rounded-full border
					{online
						? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
						: 'border-red-500/20 bg-red-500/10 text-red-200'}"
				>
					{online ? 'ONLINE' : 'OFFLINE'}
				</span>
				<span
					class="text-[10px] font-mono tracking-wide px-3 py-1 rounded-full border
					{hasSession
						? 'border-blue-500/20 bg-blue-500/10 text-blue-200'
						: 'border-amber-500/20 bg-amber-500/10 text-amber-200'}"
				>
					{hasSession ? 'Sesión activa' : 'Sin sesión'}
				</span>
			</div>
		</div>
	</div>

	<!-- Router selector (solo para firewall) -->
	<div class="rounded-xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 flex flex-wrap items-center gap-3">
		<span class="text-xs font-mono text-gray-400 shrink-0">ROUTER</span>
		{#if routersLoading}
			<span class="text-xs text-gray-500">Cargando…</span>
		{:else if routers.length === 0}
			<span class="text-xs text-red-400">Sin routers registrados.</span>
		{:else}
			<select
				class="flex-1 max-w-xs bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 focus:outline-none"
				bind:value={selectedRouterId}
				onchange={() => {
					if (selectedRouterId) localStorage.setItem(ROUTER_KEY, String(selectedRouterId));
				}}
			>
				<option value={null} disabled>Selecciona un router</option>
				{#each routers as r (r.id)}
					<option value={r.id}>{r.name} — {r.host}{r.is_active ? '' : ' (inactivo)'}</option>
				{/each}
			</select>
		{/if}
		<span class="text-xs text-gray-500">Requerido para sincronización de firewall.</span>
	</div>

	<!-- ── Sección: Colas ─────────────────────────────────────────────────── -->
	<div class="space-y-3">
		<h4 class="text-xs font-mono text-gray-400 tracking-wide px-1">COLAS DE ANCHO DE BANDA</h4>

		<MikroTikActionCard
			icon={Wifi}
			title="Sincronizar colas con limpieza"
			description="Actualiza colas padre e hijas en MikroTik usando los planes activos y clientes con IP válida. Elimina colas huérfanas."
			actionLabel="Sincronizar"
			modalTitle="Confirmar sincronización de colas"
			modalMessage="Se crearán o actualizarán colas de planes y clientes, y se eliminarán colas huérfanas."
			modalSecondaryMessage="Afecta /queue/simple en el router."
			modalDetailsTitle="Elementos afectados"
			modalDetailsItems={[
				'Colas padre asociadas a planes activos',
				'Colas hijas de clientes activos con IP válida',
				'Colas huérfanas que ya no existan en la BD (eliminación)'
			]}
			confirmText="Confirmar"
			modalType="warning"
			validate={validateBase}
			onAction={syncQueues}
			onNotify={handleNotify}
		>
			<div class="flex items-center gap-2 flex-wrap">
				<Tooltip text="Sesión activa y permisos de operador. Router accesible con credenciales correctas. Clientes con IP válida y planes activos asignados.">
					<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs cursor-default">
						<CheckCircle class="w-3 h-3" /> Requisitos
					</button>
				</Tooltip>
				<Tooltip text="Cambios concurrentes en el router: ejecutar fuera de hora pico. Errores de conectividad: usar modo background. Revisar planes y clientes antes de sincronizar.">
					<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs cursor-default">
						<AlertTriangle class="w-3 h-3" /> Riesgos
					</button>
				</Tooltip>
				<Tooltip text="1. Calcula colas padre (planes). 2. Crea/actualiza colas hijas por cliente activo. 3. Elimina colas huérfanas. 4. Devuelve resultado y estado.">
					<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300 text-xs cursor-default">
						<Info class="w-3 h-3" /> Flujo
					</button>
				</Tooltip>
			</div>
		</MikroTikActionCard>
	</div>

	<!-- ── Sección: Firewall ──────────────────────────────────────────────── -->
	<div class="space-y-3">
		<h4 class="text-xs font-mono text-gray-400 tracking-wide px-1">FIREWALL</h4>

		<div class="grid grid-cols-1 xl:grid-cols-2 gap-4">

			<!-- Router → BD -->
			<MikroTikActionCard
				icon={ArrowDownToLine}
				title="Importar desde router → BD"
				description="Lee las reglas actuales del router MikroTik y las guarda en la base de datos. Útil para importar una configuración preexistente."
				actionLabel="Importar"
				modalTitle="Importar reglas del router"
				modalMessage="Se leerán las reglas de /ip/firewall/filter y /ip/firewall/nat del router seleccionado."
				modalSecondaryMessage="Sobreescribe todas las reglas guardadas en la BD para este router."
				modalDetailsTitle="Qué se importará"
				modalDetailsItems={[
					'Reglas de /ip/firewall/filter (input, output, forward)',
					'Reglas de /ip/firewall/nat (srcnat, dstnat)',
					'IDs y orden preservados desde el router'
				]}
				confirmText="Importar reglas"
				modalType="warning"
				validate={validateFirewall}
				onAction={syncFromRouter}
				onNotify={handleNotify}
			>
				<div class="flex items-center gap-2 flex-wrap">
					<Tooltip text="Router seleccionado con credenciales válidas configuradas en la BD. Sesión activa de empleado.">
						<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs cursor-default">
							<CheckCircle class="w-3 h-3" /> Requisitos
						</button>
					</Tooltip>
					<Tooltip text="Sobreescribe todas las reglas en la BD. Las reglas pendientes de aplicar se perderán. Usar solo para importación inicial o resincronización completa.">
						<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs cursor-default">
							<AlertTriangle class="w-3 h-3" /> Riesgos
						</button>
					</Tooltip>
					<Tooltip text="1. Conecta al router con las credenciales guardadas. 2. Lee /ip/firewall/filter y /ip/firewall/nat. 3. Reemplaza reglas en la BD. 4. Actualiza el timestamp de carga.">
						<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300 text-xs cursor-default">
							<Info class="w-3 h-3" /> Flujo
						</button>
					</Tooltip>
				</div>
			</MikroTikActionCard>

			<!-- BD → Router -->
			<MikroTikActionCard
				icon={ArrowUpFromLine}
				title="Aplicar BD → router"
				description="Aplica las reglas guardadas en la base de datos al router MikroTik en el orden de prioridad definido."
				actionLabel="Aplicar"
				modalTitle="Aplicar reglas al router"
				modalMessage="Se aplicarán todas las reglas de filtro y NAT de la BD al router seleccionado."
				modalSecondaryMessage="Reemplaza TODAS las reglas de filtro y NAT en el router. Las reglas manuales existentes se perderán."
				modalDetailsTitle="Qué se aplicará"
				modalDetailsItems={[
					'Reglas de filtro (input / output / forward)',
					'Reglas NAT (srcnat / dstnat)',
					'En el orden de prioridad definido en la BD'
				]}
				confirmText="Aplicar al router"
				modalType="danger"
				validate={validateFirewall}
				onAction={applyToRouter}
				onNotify={handleNotify}
			>
				<div class="flex items-center gap-2 flex-wrap">
					<Tooltip text="Router seleccionado con credenciales válidas. Reglas guardadas y revisadas en el módulo Firewall.">
						<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs cursor-default">
							<CheckCircle class="w-3 h-3" /> Requisitos
						</button>
					</Tooltip>
					<Tooltip text="Reemplaza TODAS las reglas de filtro y NAT del router. Sin rollback automático si falla a mitad. Ejecutar fuera de horario de alto tráfico.">
						<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-300 text-xs cursor-default">
							<AlertTriangle class="w-3 h-3" /> Riesgos
						</button>
					</Tooltip>
					<Tooltip text="1. Lee reglas de la BD ordenadas por prioridad. 2. Elimina todas las reglas del router. 3. Inserta nuevas reglas en orden. 4. Actualiza timestamp de aplicación.">
						<button type="button" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300 text-xs cursor-default">
							<Info class="w-3 h-3" /> Flujo
						</button>
					</Tooltip>
				</div>
			</MikroTikActionCard>
		</div>
	</div>

</div>
