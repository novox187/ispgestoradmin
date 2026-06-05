<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import MikroTikActionCard from '$lib/components/mikrotik/MikroTikActionCard.svelte';
	import RouterStatusBadge from '$lib/components/mikrotik/firewall/RouterStatusBadge.svelte';
	import { API_BASE } from '$lib/config';
	import { mikrotikFirewallState } from '$lib/stores/mikrotik-firewall.svelte';
	import { fetchMikrotikRouters, type MikrotikRouterSummary } from '$lib/api/mikrotik-routers';
	import {
		ArrowDownToLine,
		ArrowLeftRight,
		ArrowUpFromLine,
		Gauge,
		Server,
		Shield
	} from '@lucide/svelte';

	const ROUTER_KEY = 'ispga_mikrotik_selected_router_id';

	let online           = $state(true);
	let hasSession       = $state(false);
	let routers          = $state<MikrotikRouterSummary[]>([]);
	let selectedRouterId = $state<number | null>(null);
	let routersLoading   = $state(false);

	const fw = mikrotikFirewallState;

	const selectedRouter = $derived(routers.find((r) => r.id === selectedRouterId) ?? null);

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

<div class="space-y-5">

	<!-- ── Encabezado ──────────────────────────────────────────────────────── -->
	<div class="rounded-xl border border-neutral-800 bg-[#121214] p-5">
		<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
			<div class="flex items-start gap-3">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
					<ArrowLeftRight class="h-5 w-5 text-blue-300" />
				</div>
				<div class="space-y-1">
					<div class="text-[10px] font-mono uppercase tracking-widest text-gray-500">Mikrotik / Sincronización</div>
					<h3 class="text-base font-semibold text-gray-100 md:text-lg">Sincronización</h3>
					<p class="max-w-2xl text-xs leading-relaxed text-gray-400">
						Mantén alineadas las colas de ancho de banda y las reglas de firewall entre la base de datos y el router MikroTik.
					</p>
				</div>
			</div>

			<!-- Estado del entorno -->
			<div class="flex items-center gap-5 rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-2.5">
				<div class="flex items-center gap-2">
					<span class="relative flex h-2 w-2">
						{#if online}
							<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
						{/if}
						<span class="relative inline-flex h-2 w-2 rounded-full {online ? 'bg-emerald-400' : 'bg-red-400'}"></span>
					</span>
					<div class="leading-tight">
						<div class="text-[9px] font-mono uppercase tracking-wide text-gray-500">Internet</div>
						<div class="text-xs font-medium {online ? 'text-emerald-300' : 'text-red-300'}">
							{online ? 'En línea' : 'Sin conexión'}
						</div>
					</div>
				</div>

				<div class="h-7 w-px bg-neutral-800"></div>

				<div class="flex items-center gap-2">
					<span class="inline-flex h-2 w-2 rounded-full {hasSession ? 'bg-blue-400' : 'bg-amber-400'}"></span>
					<div class="leading-tight">
						<div class="text-[9px] font-mono uppercase tracking-wide text-gray-500">Sesión</div>
						<div class="text-xs font-medium {hasSession ? 'text-blue-300' : 'text-amber-300'}">
							{hasSession ? 'Activa' : 'Expirada'}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- ── Router activo ───────────────────────────────────────────────────── -->
	<div class="rounded-xl border border-neutral-800 bg-[#121214] p-4">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex flex-1 items-center gap-3">
				<div class="flex items-center gap-2 text-xs font-mono uppercase tracking-wide text-gray-400">
					<Server class="h-4 w-4 text-gray-500" />
					Router
				</div>
				{#if routersLoading}
					<span class="text-xs text-gray-500">Cargando…</span>
				{:else if routers.length === 0}
					<a href="/mikrotik/dispositivos" class="text-xs text-amber-400 hover:text-amber-300">
						Sin routers registrados — Configurar dispositivo →
					</a>
				{:else}
					<select
						class="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-gray-100 transition-colors focus:border-blue-500 focus:outline-none sm:max-w-xs"
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
			</div>

			{#if selectedRouter}
				<RouterStatusBadge routerId={selectedRouterId} />
			{/if}
		</div>
		<p class="mt-3 border-t border-neutral-800/70 pt-3 text-[11px] leading-relaxed text-gray-500">
			El router seleccionado se usa para las operaciones de <span class="text-gray-400">firewall</span>.
			La sincronización de <span class="text-gray-400">colas</span> opera siempre sobre el router principal del sistema.
		</p>
	</div>

	<!-- ── Sección: Colas ──────────────────────────────────────────────────── -->
	<section class="space-y-3">
		<div class="flex items-center gap-3 px-1">
			<Gauge class="h-4 w-4 text-gray-500" />
			<h4 class="text-xs font-mono uppercase tracking-widest text-gray-400">Colas de ancho de banda</h4>
			<div class="h-px flex-1 bg-neutral-800"></div>
		</div>

		<MikroTikActionCard
			icon={Gauge}
			title="Sincronizar colas con limpieza"
			description="Crea y actualiza las colas padre (por plan) e hijas (por cliente con IP válida), y elimina las colas huérfanas que ya no existen en la base de datos."
			direction={{ from: 'Base de datos', to: 'Router' }}
			severity="warning"
			actionLabel="Sincronizar colas"
			requisitos={[
				'Sesión activa con permisos de operador',
				'Router principal accesible con credenciales correctas',
				'Clientes con IP válida y planes activos asignados'
			]}
			riesgos={[
				'Cambios concurrentes en el router: ejecuta fuera de hora pico',
				'Ante errores de conectividad, usa el modo en segundo plano',
				'Las colas huérfanas se eliminan de forma permanente'
			]}
			flujo={[
				'Calcula las colas padre a partir de los planes activos',
				'Crea o actualiza una cola hija por cada cliente activo con IP',
				'Elimina las colas que ya no existen en la base de datos',
				'Devuelve el resultado y el estado de la operación'
			]}
			modalTitle="Confirmar sincronización de colas"
			modalMessage="Se crearán o actualizarán colas de planes y clientes, y se eliminarán colas huérfanas."
			modalSecondaryMessage="Afecta /queue/simple en el router principal."
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
		/>
	</section>

	<!-- ── Sección: Firewall ───────────────────────────────────────────────── -->
	<section class="space-y-3">
		<div class="flex items-center gap-3 px-1">
			<Shield class="h-4 w-4 text-gray-500" />
			<h4 class="text-xs font-mono uppercase tracking-widest text-gray-400">Firewall</h4>
			<div class="h-px flex-1 bg-neutral-800"></div>
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">

			<!-- Router → BD -->
			<MikroTikActionCard
				icon={ArrowDownToLine}
				title="Importar reglas desde el router"
				description="Lee las reglas actuales del router MikroTik y las guarda en la base de datos. Útil para importar una configuración preexistente."
				direction={{ from: 'Router', to: 'Base de datos' }}
				severity="warning"
				actionLabel="Importar"
				requisitos={[
					'Router seleccionado con credenciales válidas en la BD',
					'Sesión activa de empleado'
				]}
				riesgos={[
					'Sobrescribe todas las reglas guardadas en la BD para este router',
					'Las reglas pendientes de aplicar se perderán',
					'Úsalo solo para importación inicial o resincronización completa'
				]}
				flujo={[
					'Conecta al router con las credenciales guardadas',
					'Lee /ip/firewall/filter y /ip/firewall/nat',
					'Reemplaza las reglas en la base de datos',
					'Actualiza la marca de tiempo de carga'
				]}
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
			/>

			<!-- BD → Router -->
			<MikroTikActionCard
				icon={ArrowUpFromLine}
				title="Aplicar reglas al router"
				description="Aplica las reglas guardadas en la base de datos al router MikroTik, respetando el orden de prioridad definido."
				direction={{ from: 'Base de datos', to: 'Router' }}
				severity="danger"
				actionLabel="Aplicar"
				requisitos={[
					'Router seleccionado con credenciales válidas',
					'Reglas guardadas y revisadas en el módulo Firewall'
				]}
				riesgos={[
					'Reemplaza TODAS las reglas de filtro y NAT del router',
					'Sin rollback automático si falla a mitad del proceso',
					'Las reglas manuales existentes en el router se perderán'
				]}
				flujo={[
					'Lee las reglas de la BD ordenadas por prioridad',
					'Elimina todas las reglas actuales del router',
					'Inserta las nuevas reglas en orden',
					'Actualiza la marca de tiempo de aplicación'
				]}
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
			/>
		</div>
	</section>

</div>
