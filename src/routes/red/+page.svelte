<script lang="ts">
	import { onMount } from 'svelte';
	import { NETWORK_MODULES } from '$lib/red/modules';
	import {
		fetchNetworkDevices,
		STATUS_CLASSES,
		STATUS_LABELS,
		type NetworkDevice
	} from '$lib/api/network-devices';
	import { Lock, TriangleAlert } from '@lucide/svelte';

	let devices = $state<NetworkDevice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			devices = await fetchNetworkDevices();
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudo cargar el inventario.';
		} finally {
			loading = false;
		}
	});

	const porFabricante = $derived.by(() => {
		const grupos = new Map<string, number>();
		for (const d of devices) {
			const clave = d.vendor_label ?? 'Sin fabricante';
			grupos.set(clave, (grupos.get(clave) ?? 0) + 1);
		}
		return [...grupos.entries()].sort((a, b) => b[1] - a[1]);
	});

	/**
	 * Se cuentan por separado los caídos y los que no reportan.
	 *
	 * Mezclarlos daría una cifra alarmante cada vez que se cae un agente, y el
	 * operador aprendería a ignorarla — que es como se pierde la utilidad de un
	 * panel de estado.
	 */
	const caidos = $derived(devices.filter((d) => d.connectivity_status === 'disconnected').length);
	const sinDatos = $derived(devices.filter((d) => d.connectivity_status === 'stale').length);
	const activos = $derived(devices.filter((d) => d.is_active).length);
</script>

<div class="p-4 md:p-6 space-y-6">
	<header>
		<h1 class="text-lg font-semibold text-neutral-100">Red</h1>
		<p class="text-xs text-neutral-500 mt-1">
			Routers de gestión y antenas de enlace, en un solo inventario.
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

	<!-- Cifras -->
	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
		{#each [{ label: 'Equipos', valor: devices.length, clase: 'text-neutral-100' }, { label: 'Activos', valor: activos, clase: 'text-neutral-100' }, { label: 'Caídos', valor: caidos, clase: caidos > 0 ? 'text-red-400' : 'text-neutral-100' }, { label: 'Sin datos recientes', valor: sinDatos, clase: sinDatos > 0 ? 'text-amber-400' : 'text-neutral-100' }] as tarjeta}
			<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 px-4 py-3">
				<p class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
					{tarjeta.label}
				</p>
				<p class="mt-1 text-2xl font-semibold {tarjeta.clase}">
					{loading ? '—' : tarjeta.valor}
				</p>
			</div>
		{/each}
	</div>

	{#if sinDatos > 0}
		<div
			class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300"
		>
			<TriangleAlert class="w-4 h-4 shrink-0 mt-0.5" />
			<span>
				Hay {sinDatos}
				{sinDatos === 1 ? 'equipo' : 'equipos'} sin datos recientes. Suele significar que el agente que
				los sondea está caído, no que los equipos lo estén.
			</span>
		</div>
	{/if}

	<!-- Reparto por fabricante -->
	{#if porFabricante.length > 0}
		<section class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4">
			<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">
				Por fabricante
			</h2>
			<div class="flex flex-wrap gap-2">
				{#each porFabricante as [fabricante, total]}
					<span
						class="inline-flex items-center gap-2 rounded-lg border border-neutral-700/50 bg-neutral-800/40 px-3 py-1.5 text-xs text-neutral-300"
					>
						{fabricante}
						<span class="font-mono text-neutral-500">{total}</span>
					</span>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Módulos -->
	<section>
		<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-3">Módulos</h2>
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each NETWORK_MODULES.filter((m) => m.id !== 'overview') as m (m.id)}
				{@const bloqueado = m.status === 'coming_soon'}
				<svelte:element
					this={bloqueado ? 'div' : 'a'}
					href={bloqueado ? undefined : m.href}
					class="rounded-xl border p-4 transition-colors
						{bloqueado
						? 'border-neutral-800/60 bg-neutral-900/20 cursor-not-allowed'
						: 'border-neutral-800/60 bg-neutral-900/40 hover:border-primary-500/30 hover:bg-neutral-900/70'}"
				>
					<div class="flex items-center gap-2 mb-1.5">
						<m.icon class="w-4 h-4 {bloqueado ? 'text-neutral-600' : 'text-primary-500'}" />
						<span class="text-sm font-medium {bloqueado ? 'text-neutral-600' : 'text-neutral-200'}">
							{m.label}
						</span>
						{#if bloqueado}
							<Lock class="w-3 h-3 text-neutral-600 ml-auto" />
						{/if}
					</div>
					<p class="text-xs {bloqueado ? 'text-neutral-700' : 'text-neutral-500'}">
						{m.description}
					</p>
				</svelte:element>
			{/each}
		</div>
	</section>

	<!-- Estado por equipo -->
	{#if !loading && devices.length > 0}
		<section class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 overflow-hidden">
			<h2
				class="text-[10px] font-mono uppercase tracking-widest text-neutral-500 px-4 pt-4 pb-2"
			>
				Estado actual
			</h2>
			<div class="overflow-x-auto">
				<table class="w-full text-xs">
					<tbody>
						{#each devices as d (d.id)}
							<tr class="border-t border-neutral-800/40">
								<td class="px-4 py-2 text-neutral-200">{d.name}</td>
								<td class="px-4 py-2 text-neutral-500 font-mono">{d.host}</td>
								<td class="px-4 py-2 text-neutral-500">{d.role_label ?? '—'}</td>
								<td class="px-4 py-2">
									<span
										class="inline-block rounded border px-1.5 py-0.5 text-[10px]
											{STATUS_CLASSES[d.connectivity_status ?? 'unknown']}"
									>
										{STATUS_LABELS[d.connectivity_status ?? 'unknown']}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{:else if !loading}
		<p class="text-xs text-neutral-600">
			Todavía no hay equipos en el inventario. Empieza dando de alta una antena en
			<a href="/red/dispositivos" class="text-primary-400 hover:underline">Dispositivos</a>.
		</p>
	{/if}
</div>
