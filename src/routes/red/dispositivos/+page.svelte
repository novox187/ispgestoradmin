<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { ChevronDown, Eye, EyeOff, Plug, Plus, RefreshCw, Trash2, X } from '@lucide/svelte';
	import { provisioning } from '$lib/stores/provisioning.svelte';
	import {
		createNetworkDevice,
		deleteNetworkDevice,
		fetchNetworkDevices,
		testNetworkDevice,
		updateNetworkDevice,
		STATUS_CLASSES,
		STATUS_LABELS,
		type DevicePayload,
		type DeviceRole,
		type DeviceVendor,
		type NetworkDevice
	} from '$lib/api/network-devices';
	import {
		createMikrotikRouter,
		deleteMikrotikRouter,
		fetchMikrotikRouters,
		updateMikrotikRouter,
		type MikrotikRouter,
		type UpdateRouterPayload
	} from '$lib/api/mikrotik-routers';
	import { bootstrap } from '$lib/stores/bootstrap.svelte';
	import ProvisioningPanel from '$lib/components/mikrotik/provisioning/ProvisioningPanel.svelte';
	import ModalConfirmacion from '$lib/components/common/ModalConfirmacion.svelte';
	import SelectorUbicacion from '$lib/components/red/SelectorUbicacion.svelte';

	/**
	 * Inventario único del parque.
	 *
	 * Antes había dos pantallas —una por fabricante— sobre la misma tabla
	 * `network_devices`, que se enlazaban entre sí para devolverse el trabajo: la
	 * de antenas mandaba «ver en MikroTik» y la de routers no sabía que existían
	 * antenas. Aquí la lista es una sola y lo que cambia por fabricante es a qué
	 * endpoint se escribe, que es donde la diferencia realmente existe:
	 * `NetworkDeviceController` rechaza los MikroTik porque el plano de control
	 * —credenciales, router principal, CIDR de clientes— vive en
	 * `MikrotikRouterController`.
	 */

	const ROLES: { value: DeviceRole; label: string }[] = [
		{ value: 'backhaul_ap', label: 'Enlace troncal (AP)' },
		{ value: 'backhaul_station', label: 'Enlace troncal (estación)' },
		{ value: 'sector_ap', label: 'Sector de acceso' },
		{ value: 'cpe', label: 'Antena de cliente' },
		{ value: 'edge_router', label: 'Router de borde' },
		{ value: 'core_router', label: 'Router de núcleo' }
	];

	const FILTROS: { valor: DeviceVendor | ''; etiqueta: string }[] = [
		{ valor: '', etiqueta: 'Todos' },
		{ valor: 'mikrotik', etiqueta: 'MikroTik' },
		{ valor: 'ubiquiti', etiqueta: 'Ubiquiti' }
	];

	type Formulario = {
		vendor: DeviceVendor;
		name: string;
		role: DeviceRole;
		host: string;
		/**
		 * Los tres campos numéricos son `string | number | null` a propósito:
		 * arrancan como cadena (valor por defecto o precarga) pero `bind:value`
		 * sobre un `input type="number"` los reescribe como número —o `null` al
		 * vaciarlos— en cuanto el operador los toca. Declararlos `string` hacía
		 * que `guardar()` reventara con «port.trim is not a function».
		 */
		port: string | number | null;
		username: string;
		password: string;
		description: string;
		is_active: boolean;
		is_monitored: boolean;
		is_primary: boolean;
		network_cidr: string;
		gateway: string;
		latitude: string | number | null;
		longitude: string | number | null;
	};

	let devices = $state<NetworkDevice[]>([]);
	/**
	 * Detalle del plano de control, indexado por id. El recurso de
	 * `network_devices` no expone `network_cidr` ni `gateway` —no significan nada
	 * para una antena—, así que el formulario de un MikroTik los saca de aquí.
	 */
	let detalleMikrotik = $state(new Map<number, MikrotikRouter>());
	let cargando = $state(true);
	let error = $state<string | null>(null);
	let filtroVendor = $state<DeviceVendor | ''>('');
	let probando = $state<number | null>(null);
	let panelAltaAbierto = $state(true);

	let modalAbierto = $state(false);
	let editando = $state<NetworkDevice | null>(null);
	let guardando = $state(false);
	let verPassword = $state(false);
	let form = $state<Formulario>(formularioVacio('ubiquiti'));

	let aEliminar = $state<NetworkDevice | null>(null);
	let confirmarAbierto = $state(false);
	let eliminando = $state(false);

	function pedirEliminar(d: NetworkDevice) {
		aEliminar = d;
		confirmarAbierto = true;
	}

	function cancelarEliminacion() {
		confirmarAbierto = false;
		aEliminar = null;
	}

	const visibles = $derived(
		filtroVendor ? devices.filter((d) => d.vendor === filtroVendor) : devices
	);
	const esMikrotik = $derived(form.vendor === 'mikrotik');

	/**
	 * Dónde abrir el mapa cuando el equipo todavía no tiene coordenadas.
	 *
	 * El centroide del parque ya ubicado: un ISP opera en una zona, así que la
	 * antena nueva casi siempre cae cerca de las que ya hay. Sin esto el mapa
	 * abriría en una vista de país y habría que navegar desde cero cada vez.
	 */
	const centroPorDefecto = $derived.by<[number, number] | undefined>(() => {
		const ubicados = devices.filter((d) => d.latitude !== null && d.longitude !== null);
		if (ubicados.length === 0) return undefined;

		const lat = ubicados.reduce((a, d) => a + Number(d.latitude), 0) / ubicados.length;
		const lng = ubicados.reduce((a, d) => a + Number(d.longitude), 0) / ubicados.length;
		return [lat, lng];
	});

	function formularioVacio(vendor: DeviceVendor): Formulario {
		const mikrotik = vendor === 'mikrotik';
		return {
			vendor,
			name: '',
			role: mikrotik ? 'edge_router' : 'backhaul_ap',
			host: '',
			// Puertos por defecto de cada plano de gestión: API de RouterOS y HTTP
			// de airOS. Se dejan editables porque no todo el parque los respeta.
			port: mikrotik ? '8728' : '',
			username: mikrotik ? 'admin' : '',
			password: '',
			description: '',
			is_active: true,
			is_monitored: true,
			// El primer router del sistema tiene que ser el principal: sin uno, el
			// resto del panel no puede operar.
			is_primary: mikrotik && devices.every((d) => d.vendor !== 'mikrotik'),
			network_cidr: '',
			gateway: '',
			latitude: '',
			longitude: ''
		};
	}

	/** Acepta lo que deje `bind:value`: cadena, número, vacío o `null`. */
	function aNumero(v: string | number | null): number | null {
		if (v === null || v === undefined) return null;
		if (typeof v === 'number') return Number.isFinite(v) ? v : null;
		const limpio = v.trim();
		return limpio === '' ? null : Number(limpio);
	}

	async function cargar() {
		cargando = true;
		error = null;
		try {
			// El detalle de MikroTik es complementario: si falla, la tabla sigue
			// siendo correcta y solo el formulario pierde el CIDR y el gateway.
			const [todos, routers] = await Promise.all([
				fetchNetworkDevices(),
				fetchMikrotikRouters().catch(() => [] as MikrotikRouter[])
			]);
			devices = todos;
			detalleMikrotik = new Map(routers.map((r) => [r.id, r]));
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudo cargar el inventario.';
		} finally {
			cargando = false;
		}
	}

	onMount(cargar);

	function abrirAlta(vendor: DeviceVendor) {
		editando = null;
		form = formularioVacio(vendor);
		verPassword = false;
		modalAbierto = true;
	}

	function abrirEdicion(d: NetworkDevice) {
		editando = d;
		const mk = detalleMikrotik.get(d.id);
		form = {
			vendor: (d.vendor ?? 'ubiquiti') as DeviceVendor,
			name: d.name,
			role: (d.role ?? 'backhaul_ap') as DeviceRole,
			host: d.host,
			port: d.port != null ? String(d.port) : '',
			username: d.username ?? '',
			// Nunca se precarga: el servidor no la devuelve, y dejar el campo vacío
			// significa «no la cambies».
			password: '',
			description: d.description ?? '',
			is_active: d.is_active,
			is_monitored: d.is_monitored,
			is_primary: d.is_primary,
			network_cidr: mk?.network_cidr ?? '',
			gateway: mk?.gateway ?? '',
			latitude: d.latitude ?? '',
			longitude: d.longitude ?? ''
		};
		verPassword = false;
		modalAbierto = true;
	}

	async function guardar() {
		if (guardando) return;
		guardando = true;
		const port = aNumero(form.port);
		// Vacío significa «sin ubicar», no cero: el mapa distingue una cosa de la
		// otra y `0,0` pondría el equipo en mitad del Atlántico.
		const latitude = aNumero(form.latitude);
		const longitude = aNumero(form.longitude);

		try {
			if (form.vendor === 'mikrotik') {
				const base = {
					name: form.name,
					host: form.host,
					port,
					username: form.username,
					description: form.description || null,
					is_active: form.is_active,
					is_primary: form.is_primary,
					network_cidr: form.network_cidr.trim() || null,
					gateway: form.gateway.trim() || null,
					latitude,
					longitude
				};

				if (editando) {
					const payload: UpdateRouterPayload = { ...base };
					if (form.password) payload.password = form.password;
					await updateMikrotikRouter(editando.id, payload);
				} else {
					await createMikrotikRouter({ ...base, password: form.password });
				}
			} else {
				const payload: DevicePayload = {
					name: form.name,
					vendor: 'ubiquiti',
					role: form.role,
					host: form.host,
					port,
					username: form.username || null,
					description: form.description || null,
					is_active: form.is_active,
					is_monitored: form.is_monitored,
					latitude,
					longitude
				};
				if (form.password) payload.password = form.password;

				if (editando) await updateNetworkDevice(editando.id, payload);
				else await createNetworkDevice(payload);
			}

			toast.success(editando ? `«${form.name}» actualizado.` : `«${form.name}» dado de alta.`);
			modalAbierto = false;
			await cargar();
			// El alta o la promoción de un router principal es lo que retira el
			// banner de bootstrap y desbloquea los módulos de RouterOS.
			bootstrap.refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo guardar.');
		} finally {
			guardando = false;
		}
	}

	async function confirmarEliminacion() {
		if (!aEliminar || eliminando) return;
		eliminando = true;
		const d = aEliminar;
		try {
			if (d.vendor === 'mikrotik') await deleteMikrotikRouter(d.id);
			else await deleteNetworkDevice(d.id);
			toast.success(`«${d.name}» eliminado del inventario.`);
			cancelarEliminacion();
			await cargar();
			bootstrap.refresh();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo eliminar.');
		} finally {
			eliminando = false;
		}
	}

	/**
	 * Comprueba las credenciales sin esperar al primer ciclo del agente, para que
	 * un error de tecleo se vea al dar de alta y no al día siguiente en forma de
	 * alerta. Vale para los dos fabricantes.
	 */
	async function probar(d: NetworkDevice) {
		probando = d.id;
		try {
			const r = await testNetworkDevice(d.id);
			if (r.ok) toast.success(`«${d.name}» responde${r.model ? `: ${r.model}` : ''}.`);
			else toast.error(`«${d.name}» no responde: ${r.error ?? 'sin detalle'}`);
			await cargar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo probar.');
		} finally {
			probando = null;
		}
	}

	const claseInput =
		'mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 focus:border-primary-500/40 focus:outline-none';
	const claseEtiqueta = 'text-[10px] font-mono uppercase tracking-widest text-neutral-500';
</script>

<div class="space-y-5">
	<!--
		Alta automática: el camino normal desde que existe el aprovisionamiento —el
		operador enchufa el equipo y lo ve aparecer—. Se pliega porque ocupa toda
		la primera pantalla y el uso más frecuente de esta vista es consultar el
		inventario, no dar de alta.
	-->
	<section class="rounded-xl border border-neutral-800/60 bg-neutral-900/30">
		<div class="flex items-center gap-2 px-4 py-3">
			<button
				onclick={() => (panelAltaAbierto = !panelAltaAbierto)}
				aria-expanded={panelAltaAbierto}
				class="flex flex-1 items-center gap-2 text-left min-w-0"
			>
				<ChevronDown
					class="w-3.5 h-3.5 shrink-0 text-neutral-500 transition-transform duration-150 {panelAltaAbierto
						? ''
						: '-rotate-90'}"
				/>
				<span class="text-xs font-medium text-neutral-200 shrink-0">Alta automática</span>
				{#if provisioning.active.length > 0}
					<span
						class="shrink-0 rounded border border-blue-500/30 bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-mono text-blue-300"
					>
						{provisioning.active.length} en curso
					</span>
				{/if}
				<span class="truncate text-[11px] text-neutral-500">
					Detecta el equipo conectado por cable y lo configura de los dos lados.
				</span>
			</button>

			<button
				onclick={() => provisioning.refresh()}
				disabled={provisioning.loading}
				aria-label="Actualizar altas en curso"
				class="shrink-0 rounded-lg border border-neutral-800/60 p-1.5 text-neutral-500 hover:text-white hover:border-neutral-700 transition-colors disabled:opacity-40"
			>
				<RefreshCw class="w-3 h-3 {provisioning.loading ? 'animate-spin' : ''}" />
			</button>
		</div>
		{#if panelAltaAbierto}
			<div class="border-t border-neutral-800/60 p-4">
				<ProvisioningPanel
					onCompleted={() => {
						cargar();
						bootstrap.refresh();
					}}
				/>
			</div>
		{/if}
	</section>

	<!-- Barra de herramientas del inventario -->
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-2">
			{#each FILTROS as f (f.valor)}
				{@const total = f.valor ? devices.filter((d) => d.vendor === f.valor).length : devices.length}
				<button
					onclick={() => (filtroVendor = f.valor)}
					aria-pressed={filtroVendor === f.valor}
					class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors
						{filtroVendor === f.valor
						? 'border-primary-500/30 bg-primary-500/10 text-primary-300'
						: 'border-neutral-800/60 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'}"
				>
					{f.etiqueta}
					<span class="font-mono text-[10px] text-neutral-500">{cargando ? '—' : total}</span>
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-2">
			<button
				onclick={cargar}
				disabled={cargando}
				class="flex items-center gap-1.5 rounded-lg border border-neutral-800/60 px-3 py-1.5 text-xs text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors disabled:opacity-40"
			>
				<RefreshCw class="w-3.5 h-3.5 {cargando ? 'animate-spin' : ''}" />
				Actualizar
			</button>
			<button
				onclick={() => abrirAlta('ubiquiti')}
				class="inline-flex items-center gap-1.5 rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-300 hover:bg-primary-500/20 transition-colors"
				title="Alta manual, para equipos que no pueden pasar por el banco de aprovisionamiento"
			>
				<Plus class="w-3.5 h-3.5" />
				Añadir equipo
			</button>
		</div>
	</div>

	{#if error}
		<div
			role="alert"
			class="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-300"
		>
			{error}
		</div>
	{/if}

	{#if cargando && devices.length === 0}
		<p class="text-xs text-neutral-600">Cargando inventario…</p>
	{:else if visibles.length === 0}
		<div
			class="rounded-xl border border-neutral-800/60 bg-neutral-900/30 px-4 py-10 text-center space-y-2"
		>
			<p class="text-xs text-neutral-500">
				{filtroVendor ? 'Ningún equipo de este fabricante.' : 'El inventario está vacío.'}
			</p>
			<button
				onclick={() => abrirAlta(filtroVendor === 'mikrotik' ? 'mikrotik' : 'ubiquiti')}
				class="text-xs text-primary-400 hover:text-primary-300"
			>
				Dar de alta el primero
			</button>
		</div>
	{:else}
		<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 overflow-x-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="text-left text-[10px] font-mono uppercase tracking-widest text-neutral-600">
						<th class="px-4 py-2.5 font-medium">Nombre</th>
						<th class="px-4 py-2.5 font-medium">Fabricante</th>
						<th class="px-4 py-2.5 font-medium">Papel</th>
						<th class="px-4 py-2.5 font-medium">Dirección</th>
						<th class="px-4 py-2.5 font-medium">Modelo</th>
						<th class="px-4 py-2.5 font-medium">Conectividad</th>
						<th class="px-4 py-2.5 font-medium text-right">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each visibles as d (d.id)}
						<tr class="border-t border-neutral-800/40 hover:bg-neutral-800/20">
							<td class="px-4 py-2.5">
								<div class="flex flex-wrap items-center gap-1.5">
									<span class="text-neutral-200">{d.name}</span>
									{#if d.is_primary}
										<span
											class="rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-mono text-amber-300"
											title="Router principal — lo usan por defecto firewall, sincronización, suspensiones y monitoreo"
										>
											PRINCIPAL
										</span>
									{/if}
									{#if !d.is_active}
										<span class="text-[9px] font-mono text-neutral-600">INACTIVO</span>
									{/if}
									{#if !d.is_monitored}
										<span class="text-[9px] font-mono text-neutral-600">SIN SONDEO</span>
									{/if}
									<!--
										Se marca aquí, que es donde se arregla. El mapa ya listaba los
										equipos sin ubicar, pero mandaba a una pantalla que hasta ahora
										no tenía dónde poner las coordenadas.
									-->
									{#if !d.latitude || !d.longitude}
										<span
											class="text-[9px] font-mono text-neutral-600"
											title="Sin coordenadas: no aparece en el mapa"
										>
											SIN UBICAR
										</span>
									{/if}
								</div>
								{#if d.description}
									<p class="mt-0.5 truncate max-w-[240px] text-[11px] text-neutral-600">
										{d.description}
									</p>
								{/if}
							</td>
							<td class="px-4 py-2.5 text-neutral-400">{d.vendor_label ?? '—'}</td>
							<td class="px-4 py-2.5 text-neutral-400">{d.role_label ?? '—'}</td>
							<td class="px-4 py-2.5 font-mono text-neutral-500">
								{d.host}{d.port ? `:${d.port}` : ''}
							</td>
							<td class="px-4 py-2.5 text-neutral-500">{d.model ?? '—'}</td>
							<td class="px-4 py-2.5">
								<span
									class="inline-block rounded border px-1.5 py-0.5 text-[10px]
										{STATUS_CLASSES[d.connectivity_status ?? 'unknown']}"
								>
									{STATUS_LABELS[d.connectivity_status ?? 'unknown']}
								</span>
							</td>
							<td class="px-4 py-2.5">
								<div class="flex items-center justify-end gap-1">
									<button
										onclick={() => probar(d)}
										disabled={probando === d.id}
										title="Comprobar credenciales ahora"
										aria-label="Comprobar «{d.name}»"
										class="rounded p-1.5 text-neutral-500 hover:text-primary-400 hover:bg-neutral-800/60 disabled:opacity-40"
									>
										<Plug class="w-3.5 h-3.5 {probando === d.id ? 'animate-pulse' : ''}" />
									</button>
									<button
										onclick={() => abrirEdicion(d)}
										class="rounded px-2 py-1 text-[11px] text-neutral-400 hover:text-white hover:bg-neutral-800/60"
									>
										Editar
									</button>
									<button
										onclick={() => pedirEliminar(d)}
										title="Eliminar del inventario"
										aria-label="Eliminar «{d.name}»"
										class="rounded p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800/60"
									>
										<Trash2 class="w-3.5 h-3.5" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if modalAbierto}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div
			class="w-full max-w-lg rounded-xl border border-neutral-800 bg-[#0f0f12] p-5 max-h-[90vh] overflow-y-auto"
		>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-sm font-semibold text-neutral-100">
					{editando ? `Editar «${editando.name}»` : 'Añadir equipo'}
				</h2>
				<button
					onclick={() => (modalAbierto = false)}
					class="rounded p-1 text-neutral-500 hover:text-white"
					aria-label="Cerrar"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					guardar();
				}}
				class="space-y-3"
			>
				<!--
					El fabricante decide a qué endpoint se escribe y qué campos tienen
					sentido, así que se elige primero y no se puede cambiar después: un
					equipo no cambia de fabricante a mitad de vida, y permitirlo dejaría
					las reglas de firewall apuntando a una fila que su clase ya no ve.
				-->
				{#if !editando}
					<fieldset>
						<legend class={claseEtiqueta}>Fabricante</legend>
						<div class="mt-1.5 grid grid-cols-2 gap-2">
							{#each [{ v: 'ubiquiti' as DeviceVendor, l: 'Ubiquiti', d: 'Antena airOS' }, { v: 'mikrotik' as DeviceVendor, l: 'MikroTik', d: 'Router RouterOS' }] as opcion (opcion.v)}
								<button
									type="button"
									onclick={() => (form = formularioVacio(opcion.v))}
									aria-pressed={form.vendor === opcion.v}
									class="rounded-lg border px-3 py-2 text-left transition-colors
										{form.vendor === opcion.v
										? 'border-primary-500/40 bg-primary-500/10'
										: 'border-neutral-800 hover:border-neutral-700'}"
								>
									<span
										class="block text-xs font-medium {form.vendor === opcion.v
											? 'text-primary-300'
											: 'text-neutral-300'}"
									>
										{opcion.l}
									</span>
									<span class="block text-[10px] text-neutral-500">{opcion.d}</span>
								</button>
							{/each}
						</div>
					</fieldset>
				{/if}

				<label class="block">
					<span class={claseEtiqueta}>Nombre</span>
					<input
						bind:value={form.name}
						required
						placeholder={esMikrotik ? 'Router Principal' : 'Enlace Torre Norte'}
						class={claseInput}
					/>
				</label>

				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class={claseEtiqueta}>Dirección IP</span>
						<input
							bind:value={form.host}
							required
							placeholder={esMikrotik ? '192.168.88.1' : '10.9.0.5'}
							class="{claseInput} font-mono"
						/>
					</label>

					<label class="block">
						<span class={claseEtiqueta}>Puerto</span>
						<input
							bind:value={form.port}
							type="number"
							min="1"
							max="65535"
							placeholder={esMikrotik ? '8728' : '80'}
							class="{claseInput} font-mono"
						/>
					</label>
				</div>

				<!--
					El papel solo se envía para Ubiquiti: `MikrotikRouterController` no
					lo acepta en su validación, y mandarlo haría fallar el alta.
				-->
				{#if !esMikrotik}
					<label class="block">
						<span class={claseEtiqueta}>Papel en la red</span>
						<select bind:value={form.role} class={claseInput}>
							{#each ROLES as r (r.value)}
								<option value={r.value}>{r.label}</option>
							{/each}
						</select>
					</label>
				{/if}

				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class={claseEtiqueta}>Usuario</span>
						<input
							bind:value={form.username}
							required={esMikrotik}
							placeholder={esMikrotik ? 'admin' : 'ubnt'}
							class={claseInput}
						/>
					</label>

					<label class="block">
						<span class={claseEtiqueta}>Contraseña</span>
						<div class="relative">
							<input
								bind:value={form.password}
								type={verPassword ? 'text' : 'password'}
								required={esMikrotik && !editando}
								placeholder={editando ? 'Sin cambios' : '••••••••'}
								class="{claseInput} pr-9"
							/>
							<button
								type="button"
								onclick={() => (verPassword = !verPassword)}
								aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
								class="absolute right-2.5 top-1/2 mt-0.5 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
							>
								{#if verPassword}
									<EyeOff class="w-3.5 h-3.5" />
								{:else}
									<Eye class="w-3.5 h-3.5" />
								{/if}
							</button>
						</div>
					</label>
				</div>

				<p class="text-[10px] text-neutral-600 leading-relaxed">
					{#if esMikrotik}
						Estas credenciales son la única fuente para conectarse a RouterOS: las usan el
						firewall, la sincronización de colas y las suspensiones.
					{:else}
						Si dejas usuario y contraseña vacíos, el equipo usará el perfil de credenciales que
						tenga asignado. Conviene un usuario de
						<strong class="text-neutral-500">solo lectura</strong> en airOS: el sistema no escribe
						nada en las antenas.
					{/if}
				</p>

				<label class="block">
					<span class={claseEtiqueta}>Descripción</span>
					<textarea
						bind:value={form.description}
						rows="2"
						placeholder="Ej: distribución zona norte"
						class="{claseInput} resize-none"
					></textarea>
				</label>

				<!--
					Ubicación. Tres vías —mapa con buscador, posición del equipo actual y
					entrada manual— porque el operador sabe dónde está la antena, no sus
					coordenadas. El mapa se abre centrado en el último equipo ubicado, que
					suele estar cerca del que se está dando de alta.
				-->
				<SelectorUbicacion
					bind:latitude={form.latitude}
					bind:longitude={form.longitude}
					{centroPorDefecto}
				/>

				{#if esMikrotik}
					<div class="grid grid-cols-2 gap-3">
						<label class="block">
							<span class={claseEtiqueta}>Red de clientes (CIDR)</span>
							<input
								bind:value={form.network_cidr}
								placeholder="192.168.20.0/24"
								class="{claseInput} font-mono"
							/>
							<span class="mt-1 block text-[10px] text-neutral-600">
								Bloque de IPs asignadas a clientes detrás de este router.
							</span>
						</label>

						<label class="block">
							<span class={claseEtiqueta}>Gateway</span>
							<input
								bind:value={form.gateway}
								placeholder="192.168.20.1"
								class="{claseInput} font-mono"
							/>
							<span class="mt-1 block text-[10px] text-neutral-600">
								IP del router en la subred de clientes.
							</span>
						</label>
					</div>
				{/if}

				<div class="space-y-2 pt-1">
					<label class="flex items-center gap-2 text-xs text-neutral-400">
						<input type="checkbox" bind:checked={form.is_active} class="accent-primary-500" />
						Activo
					</label>

					{#if esMikrotik}
						<label class="flex items-start gap-2 text-xs text-neutral-400">
							<input
								type="checkbox"
								bind:checked={form.is_primary}
								class="mt-0.5 accent-amber-500"
							/>
							<span>
								Router principal del sistema
								<span class="block text-[10px] text-neutral-600">
									Usado por defecto en firewall, sincronización, monitoreo y suspensiones. Solo uno
									puede serlo a la vez.
								</span>
							</span>
						</label>
					{:else}
						<label class="flex items-center gap-2 text-xs text-neutral-400">
							<input type="checkbox" bind:checked={form.is_monitored} class="accent-primary-500" />
							Sondear periódicamente
						</label>
					{/if}
				</div>

				<div class="flex justify-end gap-2 pt-3">
					<button
						type="button"
						onclick={() => (modalAbierto = false)}
						class="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={guardando}
						class="rounded-lg border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-xs font-medium text-primary-300 hover:bg-primary-500/20 disabled:opacity-50"
					>
						{guardando ? 'Guardando…' : editando ? 'Guardar' : 'Añadir'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<ModalConfirmacion
	bind:open={confirmarAbierto}
	type="danger"
	title="Eliminar del inventario"
	message={aEliminar
		? `«${aEliminar.name}» se eliminará junto con sus credenciales y sus métricas. No se puede deshacer.`
		: ''}
	confirmText="Eliminar"
	cancelText="Cancelar"
	loading={eliminando}
	on:confirm={confirmarEliminacion}
	on:cancel={cancelarEliminacion}
/>
