<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		adoptFinding,
		buscarClientes,
		fetchScan,
		fetchScans,
		FINDING_SOURCE_LABELS,
		requestScan,
		SCAN_STATUS_CLASSES,
		SCAN_STATUS_LABELS,
		type ClienteBuscado,
		type DeviceRole,
		type NetworkScan,
		type ScanDetail,
		type ScanFinding
	} from '$lib/api/network-devices';
	import { fetchAgents } from '$lib/api/provisioning';
	import { Radar, TriangleAlert, X } from '@lucide/svelte';

	const ROLES: { value: DeviceRole; label: string }[] = [
		{ value: 'backhaul_ap', label: 'Enlace troncal (AP)' },
		{ value: 'backhaul_station', label: 'Enlace troncal (estación)' },
		{ value: 'sector_ap', label: 'Sector de acceso' },
		{ value: 'cpe', label: 'Antena de cliente' }
	];

	let scans = $state<NetworkScan[]>([]);
	let agentes = $state<{ id: number; name: string; role: string }[]>([]);
	let detalle = $state<ScanDetail | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let cidr = $state('');
	let agenteId = $state<number | null>(null);
	let pidiendo = $state(false);

	let adoptando = $state<ScanFinding | null>(null);
	let form = $state({
		name: '',
		role: 'backhaul_ap' as DeviceRole,
		username: '',
		password: '',
		client_id: null as number | null
	});
	let guardando = $state(false);

	/**
	 * Solo un equipo de abonado pertenece a alguien. Una antena sectorial da
	 * servicio a muchos: atarla a uno haría creer que su avería afecta a una
	 * sola ficha.
	 */
	const pideCliente = $derived(form.role === 'cpe');

	let clienteBuscado = $state('');
	let clientes = $state<ClienteBuscado[]>([]);
	let buscandoClientes = $state(false);
	let debounceClientes: ReturnType<typeof setTimeout> | null = null;

	/** Nombre a mostrar del cliente elegido, venga de la sugerencia o del buscador. */
	const clienteElegido = $derived(
		form.client_id === null
			? null
			: (clientes.find((c) => c.id === form.client_id)?.full_name ??
				(form.client_id === adoptando?.suggested_client_id
					? adoptando?.suggested_client_name
					: null))
	);

	function buscarClientesDebounced(termino: string) {
		if (debounceClientes) clearTimeout(debounceClientes);

		if (termino.trim().length < 2) {
			clientes = [];
			return;
		}

		debounceClientes = setTimeout(async () => {
			buscandoClientes = true;
			try {
				clientes = await buscarClientes(termino.trim());
			} finally {
				buscandoClientes = false;
			}
		}, 350);
	}

	let timer: ReturnType<typeof setTimeout> | null = null;

	/** Mientras haya un barrido en marcha se refresca a menudo; si no, se deja en paz. */
	const hayBarridoActivo = $derived(
		scans.some((s) => s.status === 'pending' || s.status === 'running')
	);

	async function cargar() {
		try {
			scans = await fetchScans();
			if (detalle) detalle = await fetchScan(detalle.id);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudo cargar.';
		} finally {
			loading = false;
			timer = setTimeout(cargar, hayBarridoActivo ? 4000 : 30000);
		}
	}

	onMount(async () => {
		try {
			const todos = await fetchAgents();
			agentes = todos.filter((a: any) => a.role === 'monitor');
			if (agentes.length > 0) agenteId = agentes[0].id;
		} catch {
			// Sin agentes no se puede barrer, pero el listado histórico sí se ve.
		}
		await cargar();
	});

	onDestroy(() => timer && clearTimeout(timer));

	async function pedir() {
		if (!agenteId || !cidr.trim()) return;

		pidiendo = true;
		try {
			await requestScan(agenteId, cidr.trim());
			toast.success(`Barrido de ${cidr} encolado.`);
			cidr = '';
			await cargar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo pedir el barrido.');
		} finally {
			pidiendo = false;
		}
	}

	async function abrir(scan: NetworkScan) {
		try {
			detalle = await fetchScan(scan.id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo abrir el barrido.');
		}
	}

	function abrirAdopcion(f: ScanFinding) {
		adoptando = f;
		clienteBuscado = '';
		clientes = [];
		form = {
			// Se propone el nombre que el propio equipo declara: casi siempre es
			// el que el instalador le puso y el que el operador reconoce.
			name: f.hostname ?? f.essid ?? f.ip_address,
			// Si el servidor reconoció al abonado, es que el equipo es suyo: lo
			// más probable es que sea un CPE, así que se propone ese papel.
			role: f.suggested_client_id !== null ? 'cpe' : 'backhaul_ap',
			username: '',
			password: '',
			client_id: f.suggested_client_id
		};
	}

	async function adoptar() {
		if (!adoptando) return;

		guardando = true;
		try {
			const r = await adoptFinding(adoptando.id, {
				...form,
				// El servidor rechaza vincular un cliente a infraestructura, así
				// que se limpia al cambiar de papel en vez de dejar que falle.
				client_id: pideCliente ? form.client_id : null
			});

			toast.success(
				r.link_id
					? `«${form.name}» añadido, y su enlace registrado en el mapa.`
					: `«${form.name}» añadido al inventario.`
			);

			// La discordancia de IP no impide el alta pero hay que mirarla: es la
			// dirección con la que se le factura a ese abonado.
			if (r.ip_warning) toast.warning(r.ip_warning, { duration: 12000 });

			adoptando = null;
			await cargar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo dar de alta.');
		} finally {
			guardando = false;
		}
	}
</script>

<div class="space-y-5">
	{#if error}
		<div
			class="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-300"
		>
			<TriangleAlert class="w-4 h-4 shrink-0 mt-0.5" />
			<span>{error}</span>
		</div>
	{/if}

	<!-- Pedir un barrido -->
	<section class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4">
		{#if agentes.length === 0}
			<p class="text-xs text-neutral-500">
				No hay ningún agente de monitoreo enrolado. Un barrido lo ejecuta un agente desde dentro de
				la red del cliente: el servidor no alcanza esas direcciones.
			</p>
		{:else}
			<form
				onsubmit={(e) => {
					e.preventDefault();
					pedir();
				}}
				class="flex flex-wrap items-end gap-3"
			>
				<label class="flex-1 min-w-[12rem]">
					<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
						Rango a barrer
					</span>
					<input
						bind:value={cidr}
						required
						placeholder="10.9.0.0/24"
						class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs font-mono text-neutral-100 focus:border-primary-500/40 focus:outline-none"
					/>
				</label>

				<label class="min-w-[10rem]">
					<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
						Agente
					</span>
					<select
						bind:value={agenteId}
						class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
					>
						{#each agentes as a}
							<option value={a.id}>{a.name}</option>
						{/each}
					</select>
				</label>

				<button
					type="submit"
					disabled={pidiendo}
					class="inline-flex items-center gap-1.5 rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-2 text-xs font-medium text-primary-300 hover:bg-primary-500/20 disabled:opacity-50"
				>
					<Radar class="w-3.5 h-3.5" />
					{pidiendo ? 'Encolando…' : 'Barrer'}
				</button>
			</form>

			<p class="mt-3 text-[10px] text-neutral-600 leading-relaxed">
				El agente comprueba el rango contra <strong class="text-neutral-500">su propia</strong>
				lista de rangos permitidos, configurada en su máquina. Si lo rechaza, aparecerá aquí el motivo:
				es a propósito, para que ni el servidor pueda usarlo como escáner de redes ajenas.
			</p>
		{/if}
	</section>

	<!-- Historial -->
	{#if loading}
		<p class="text-xs text-neutral-600">Cargando…</p>
	{:else if scans.length === 0}
		<p class="text-xs text-neutral-600">Todavía no se ha pedido ningún barrido.</p>
	{:else}
		<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 overflow-x-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="text-left text-[10px] font-mono uppercase tracking-widest text-neutral-600">
						<th class="px-4 py-2.5 font-medium">Rango</th>
						<th class="px-4 py-2.5 font-medium">Agente</th>
						<th class="px-4 py-2.5 font-medium">Pedido por</th>
						<th class="px-4 py-2.5 font-medium">Estado</th>
						<th class="px-4 py-2.5 font-medium">Encontrados</th>
						<th class="px-4 py-2.5"></th>
					</tr>
				</thead>
				<tbody>
					{#each scans as s (s.id)}
						<tr class="border-t border-neutral-800/40 hover:bg-neutral-800/20">
							<td class="px-4 py-2.5 font-mono text-neutral-200">{s.cidr}</td>
							<td class="px-4 py-2.5 text-neutral-500">{s.agent ?? '—'}</td>
							<td class="px-4 py-2.5 text-neutral-500">{s.requested_by ?? '—'}</td>
							<td class="px-4 py-2.5">
								<span
									class="inline-block rounded border px-1.5 py-0.5 text-[10px] {SCAN_STATUS_CLASSES[
										s.status
									]}"
								>
									{SCAN_STATUS_LABELS[s.status]}
								</span>
								{#if s.error_message}
									<p class="mt-1 text-[10px] text-red-400/80 max-w-md">{s.error_message}</p>
								{/if}
							</td>
							<td class="px-4 py-2.5 font-mono text-neutral-400">{s.found_count}</td>
							<td class="px-4 py-2.5 text-right">
								{#if s.found_count > 0}
									<button
										onclick={() => abrir(s)}
										class="rounded px-2 py-1 text-[11px] text-primary-400 hover:bg-neutral-800/60"
									>
										Ver hallazgos
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- Hallazgos del barrido abierto -->
	{#if detalle}
		<section class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 overflow-hidden">
			<div class="flex items-center justify-between px-4 pt-4 pb-2">
				<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
					Encontrados en {detalle.cidr}
				</h2>
				<button
					onclick={() => (detalle = null)}
					class="rounded p-1 text-neutral-600 hover:text-white"
					aria-label="Cerrar"
				>
					<X class="w-3.5 h-3.5" />
				</button>
			</div>

			<div class="overflow-x-auto">
				<table class="w-full text-xs">
					<thead>
						<tr class="text-left text-[10px] font-mono uppercase tracking-widest text-neutral-600">
							<th class="px-4 py-2 font-medium">IP</th>
							<th class="px-4 py-2 font-medium">MAC</th>
							<th class="px-4 py-2 font-medium">Nombre</th>
							<th class="px-4 py-2 font-medium">Modelo</th>
							<th class="px-4 py-2 font-medium">Fabricante</th>
							<th class="px-4 py-2 font-medium">Cómo se vio</th>
							<th class="px-4 py-2 font-medium">Abonado</th>
							<th class="px-4 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each detalle.findings as f (f.id)}
							<tr class="border-t border-neutral-800/40">
								<td class="px-4 py-2.5 font-mono text-neutral-200">{f.ip_address}</td>
								<td class="px-4 py-2.5 font-mono text-neutral-600">{f.mac_address ?? '—'}</td>
								<td class="px-4 py-2.5 text-neutral-400">{f.hostname ?? '—'}</td>
								<td class="px-4 py-2.5 text-neutral-500">{f.model ?? '—'}</td>
								<td class="px-4 py-2.5 text-neutral-500">
									{f.vendor ?? ''}
								</td>
								<td class="px-4 py-2.5">
									<!--
										Saber qué fuente lo vio explica lo que falta: el barrido
										solo lo contestan los equipos airOS, y la tabla de vecinos
										solo recoge lo que es vecino de capa 2 de un router.
									-->
									<span
										class="rounded border px-1.5 py-0.5 text-[10px] whitespace-nowrap {f.source ===
										'both'
											? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
											: f.source === 'neighbor'
												? 'border-sky-500/20 bg-sky-500/10 text-sky-400'
												: 'border-neutral-600/30 bg-neutral-500/10 text-neutral-400'}"
										title={f.discovered_via
											? `Lo ve ${f.discovered_via}${f.remote_interface ? ` por ${f.remote_interface}` : ''}`
											: 'Respondió al barrido de la red'}
									>
										{FINDING_SOURCE_LABELS[f.source]}
									</span>
								</td>
								<td class="px-4 py-2.5 text-neutral-500">
									{#if f.suggested_client_name}
										<span
											class="text-[11px] text-amber-400/90"
											title={f.suggested_client_reason === 'ip'
												? 'Coincide con la IP con la que se le factura'
												: 'Coincide con el nombre del abonado; confírmalo'}
										>
											{f.suggested_client_name}
											{f.suggested_client_reason === 'name' ? '(por nombre)' : ''}
										</span>
									{:else}
										—
									{/if}
								</td>
								<td class="px-4 py-2.5 text-right">
									{#if f.known}
										<span class="text-[11px] text-neutral-600">
											Ya en inventario{f.known_as ? `: ${f.known_as}` : ''}
										</span>
									{:else}
										<button
											onclick={() => abrirAdopcion(f)}
											class="rounded border border-primary-500/30 bg-primary-500/10 px-2 py-1 text-[11px] text-primary-300 hover:bg-primary-500/20"
										>
											Dar de alta
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>

{#if adoptando}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="w-full max-w-md rounded-xl border border-neutral-800 bg-[#0f0f12] p-5">
			<div class="flex items-center justify-between mb-1">
				<h2 class="text-sm font-semibold text-neutral-100">Dar de alta</h2>
				<button
					onclick={() => (adoptando = null)}
					class="rounded p-1 text-neutral-500 hover:text-white"
					aria-label="Cerrar"
				>
					<X class="w-4 h-4" />
				</button>
			</div>
			<p class="text-[10px] font-mono text-neutral-600 mb-4">
				{adoptando.ip_address}{adoptando.model ? ` · ${adoptando.model}` : ''}
			</p>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					adoptar();
				}}
				class="space-y-3"
			>
				<label class="block">
					<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Nombre</span
					>
					<input
						bind:value={form.name}
						required
						class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
					/>
				</label>

				<label class="block">
					<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
						Papel en la red
					</span>
					<select
						bind:value={form.role}
						class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
					>
						{#each ROLES as r}
							<option value={r.value}>{r.label}</option>
						{/each}
					</select>
					<!-- El barrido no puede saberlo: por la red no se distingue un
					     enlace troncal de un sector, y de eso dependen las alertas. -->
					<span class="mt-1 block text-[10px] text-neutral-600">
						De esto dependen las alertas y el mapa: un enlace troncal caído es una incidencia; una
						antena de cliente, casi nunca.
					</span>
				</label>

				{#if pideCliente}
					<div class="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
						<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
							Abonado
						</span>

						{#if form.client_id !== null}
							<div class="mt-1.5 flex items-center justify-between gap-2">
								<span class="text-xs text-neutral-100">{clienteElegido ?? `#${form.client_id}`}</span>
								<button
									type="button"
									onclick={() => {
										form.client_id = null;
										clienteBuscado = '';
										clientes = [];
									}}
									class="text-[10px] text-neutral-500 hover:text-neutral-300"
								>
									Cambiar
								</button>
							</div>
							{#if adoptando.suggested_client_id === form.client_id}
								<!--
									Se dice POR QUÉ se propuso: la IP es exacta porque es con la
									que se le factura, el nombre es solo una pista que el
									instalador tecleó en la antena.
								-->
								<span class="mt-1 block text-[10px] text-neutral-600">
									{adoptando.suggested_client_reason === 'ip'
										? 'Propuesto porque su IP es la que consta en la ficha del abonado.'
										: 'Propuesto porque el nombre de la antena coincide. Confírmalo antes de guardar.'}
								</span>
							{/if}
						{:else}
							<input
								bind:value={clienteBuscado}
								oninput={() => buscarClientesDebounced(clienteBuscado)}
								placeholder="Buscar por nombre…"
								class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
							/>

							{#if buscandoClientes}
								<span class="mt-1 block text-[10px] text-neutral-600">Buscando…</span>
							{:else if clientes.length > 0}
								<ul class="mt-1.5 max-h-40 overflow-y-auto rounded-lg border border-neutral-800">
									{#each clientes as c (c.id)}
										<li>
											<button
												type="button"
												onclick={() => (form.client_id = c.id)}
												class="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-800/60"
											>
												<span>{c.full_name}</span>
												<span class="font-mono text-[10px] text-neutral-600">{c.ip ?? ''}</span>
											</button>
										</li>
									{/each}
								</ul>
							{:else if clienteBuscado.trim().length >= 2}
								<span class="mt-1 block text-[10px] text-neutral-600">Ningún abonado coincide.</span>
							{/if}

							<span class="mt-1.5 block text-[10px] text-neutral-600">
								Puedes dejarlo sin vincular y hacerlo más tarde.
							</span>
						{/if}
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
							Usuario
						</span>
						<input
							bind:value={form.username}
							placeholder="ubnt"
							class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
						/>
					</label>
					<label class="block">
						<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
							Contraseña
						</span>
						<input
							type="password"
							bind:value={form.password}
							class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
						/>
					</label>
				</div>

				<div class="flex justify-end gap-2 pt-2">
					<button
						type="button"
						onclick={() => (adoptando = null)}
						class="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={guardando}
						class="rounded-lg border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-xs font-medium text-primary-300 hover:bg-primary-500/20 disabled:opacity-50"
					>
						{guardando ? 'Guardando…' : 'Añadir'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
