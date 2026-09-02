<script lang="ts">
	import { onMount } from 'svelte';
	import {
		fetchNetworkDevices,
		STATUS_CLASSES,
		STATUS_LABELS,
		type NetworkDevice
	} from '$lib/api/network-devices';
	import { bootstrap } from '$lib/stores/bootstrap.svelte';
	import { ArrowRight, Check, TriangleAlert } from '@lucide/svelte';

	/**
	 * Resumen del parque.
	 *
	 * Antes esta pantalla era un índice: una rejilla de tarjetas que repetía el
	 * sub-sidebar y, debajo, la tabla completa de equipos, que es exactamente lo
	 * que muestra Dispositivos. Ninguna de las dos cosas respondía a la pregunta
	 * por la que se entra aquí —«¿hay algo roto?»—, así que ahora eso es lo único
	 * que hay: cifras, lo que necesita atención y el estado del router principal.
	 */

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
	const caidos = $derived(devices.filter((d) => d.connectivity_status === 'disconnected'));
	const sinDatos = $derived(devices.filter((d) => d.connectivity_status === 'stale'));
	const activos = $derived(devices.filter((d) => d.is_active).length);

	// Los caídos primero: son los que exigen ir a mirar.
	const requierenAtencion = $derived([...caidos, ...sinDatos]);

	const tarjetas = $derived([
		{ label: 'Equipos', valor: devices.length, clase: 'text-neutral-100' },
		{ label: 'Activos', valor: activos, clase: 'text-neutral-100' },
		{
			label: 'Caídos',
			valor: caidos.length,
			clase: caidos.length > 0 ? 'text-red-400' : 'text-neutral-100'
		},
		{
			label: 'Sin datos recientes',
			valor: sinDatos.length,
			clase: sinDatos.length > 0 ? 'text-amber-400' : 'text-neutral-100'
		}
	]);
</script>

<div class="space-y-6">
	{#if error}
		<div
			role="alert"
			class="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-300"
		>
			<TriangleAlert class="w-4 h-4 shrink-0 mt-0.5" />
			<span>{error}</span>
		</div>
	{/if}

	<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
		{#each tarjetas as t (t.label)}
			<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 px-4 py-3">
				<p class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{t.label}</p>
				<p class="mt-1 text-2xl font-semibold tabular-nums {t.clase}">
					{loading ? '—' : t.valor}
				</p>
			</div>
		{/each}
	</div>

	<div class="grid gap-4 lg:grid-cols-3">
		<!-- Lo accionable ocupa el espacio principal. -->
		<section class="lg:col-span-2 rounded-xl border border-neutral-800/60 bg-neutral-900/40">
			<div class="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
				<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
					Requieren atención
				</h2>
				<a
					href="/red/dispositivos"
					class="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-primary-400 transition-colors"
				>
					Ver inventario
					<ArrowRight class="w-3 h-3" />
				</a>
			</div>

			{#if loading}
				<p class="px-4 pb-4 text-xs text-neutral-600">Cargando…</p>
			{:else if devices.length === 0}
				<p class="px-4 pb-4 text-xs text-neutral-600">
					El inventario está vacío. Empieza dando de alta un equipo en
					<a href="/red/dispositivos" class="text-primary-400 hover:underline">Dispositivos</a>.
				</p>
			{:else if requierenAtencion.length === 0}
				<p class="flex items-center gap-2 px-4 pb-4 text-xs text-emerald-400">
					<Check class="w-3.5 h-3.5" />
					Los {devices.length} equipos del parque responden.
				</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<tbody>
							{#each requierenAtencion as d (d.id)}
								<tr class="border-t border-neutral-800/40">
									<td class="px-4 py-2 text-neutral-200">{d.name}</td>
									<td class="px-4 py-2 font-mono text-neutral-500">{d.host}</td>
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

				{#if sinDatos.length > 0}
					<p class="px-4 py-3 text-[11px] text-amber-300/80 border-t border-neutral-800/40">
						«Sin datos recientes» suele significar que el agente que sondea esos equipos está
						caído, no que los equipos lo estén.
					</p>
				{/if}
			{/if}
		</section>

		<div class="space-y-4">
			<!--
				El router principal es la única fuente de credenciales de RouterOS para
				todo el sistema. Antes solo se veía cuando faltaba, en forma de banner.
			-->
			<section class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4">
				<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2.5">
					Router principal
				</h2>
				{#if bootstrap.primaryRouter}
					<p class="text-sm text-neutral-200">{bootstrap.primaryRouter.name}</p>
					<p class="mt-0.5 font-mono text-[11px] text-neutral-500">
						{bootstrap.primaryRouter.host}{bootstrap.primaryRouter.port
							? `:${bootstrap.primaryRouter.port}`
							: ''}
					</p>
					<span
						class="mt-2 inline-block rounded border px-1.5 py-0.5 text-[10px]
							{STATUS_CLASSES[bootstrap.primaryRouter.connectivity_status ?? 'unknown']}"
					>
						{STATUS_LABELS[bootstrap.primaryRouter.connectivity_status ?? 'unknown']}
					</span>
				{:else if bootstrap.primaryRouterConfigured === false}
					<p class="text-xs text-amber-300 leading-relaxed">
						Sin router principal. Firewall y Sincronización quedan bloqueados hasta que se
						configure uno.
					</p>
					<a
						href="/red/dispositivos"
						class="mt-2 inline-flex items-center gap-1 text-[11px] text-primary-400 hover:text-primary-300"
					>
						Configurarlo
						<ArrowRight class="w-3 h-3" />
					</a>
				{:else}
					<p class="text-xs text-neutral-600">Comprobando…</p>
				{/if}
			</section>

			{#if porFabricante.length > 0}
				<section class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4">
					<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2.5">
						Por fabricante
					</h2>
					<ul class="space-y-1.5">
						{#each porFabricante as [fabricante, total] (fabricante)}
							<li class="flex items-baseline justify-between gap-3 text-xs">
								<span class="text-neutral-300">{fabricante}</span>
								<span class="font-mono tabular-nums text-neutral-500">{total}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	</div>
</div>
