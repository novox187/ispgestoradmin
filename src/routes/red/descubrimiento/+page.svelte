<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		adoptFinding,
		fetchScan,
		fetchScans,
		requestScan,
		SCAN_STATUS_CLASSES,
		SCAN_STATUS_LABELS,
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
	let form = $state({ name: '', role: 'backhaul_ap' as DeviceRole, username: '', password: '' });
	let guardando = $state(false);

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
		form = {
			// Se propone el nombre que el propio equipo declara: casi siempre es
			// el que el instalador le puso y el que el operador reconoce.
			name: f.hostname ?? f.essid ?? f.ip_address,
			role: 'backhaul_ap',
			username: '',
			password: ''
		};
	}

	async function adoptar() {
		if (!adoptando) return;

		guardando = true;
		try {
			await adoptFinding(adoptando.id, form);
			toast.success(`«${form.name}» añadido al inventario.`);
			adoptando = null;
			await cargar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo dar de alta.');
		} finally {
			guardando = false;
		}
	}
</script>

<div class="p-4 md:p-6 space-y-5">
	<header>
		<h1 class="text-lg font-semibold text-neutral-100">Descubrimiento</h1>
		<p class="text-xs text-neutral-500 mt-1">
			Barre un rango de la red de gestión y ofrece dar de alta lo que encuentre.
		</p>
	</header>

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
