<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		fetchNetworkMap,
		signalQuality,
		updateLinkStatus,
		LINK_STATUS_LABELS,
		QUALITY_CLASSES,
		STATUS_LABELS,
		type MapDevice,
		type NetworkLink,
		type NetworkMap,
		type Quality
	} from '$lib/api/network-devices';
	import { MapPin, TriangleAlert } from '@lucide/svelte';

	let datos = $state<NetworkMap | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let contenedor = $state<HTMLDivElement | null>(null);

	/* eslint-disable @typescript-eslint/no-explicit-any */
	let mapa: any = null;
	let capas: any = null;
	let L: any = null;

	const ubicados = $derived(datos?.devices.filter((d) => d.latitude && d.longitude) ?? []);
	const sinUbicar = $derived(datos?.devices.filter((d) => !d.latitude || !d.longitude) ?? []);
	const sinConfirmar = $derived(datos?.links.filter((l) => l.status === 'discovered') ?? []);

	/** Verde, ámbar o rojo según la peor señal del enlace; gris si no se sabe. */
	const COLOR_CALIDAD: Record<Quality, string> = {
		excelente: '#34d399',
		bueno: '#a3e635',
		regular: '#fbbf24',
		malo: '#f87171',
		// Gris y no rojo: no saber la calidad de un enlace no significa que esté
		// mal, y pintarlo de rojo mandaría a revisar algo que quizá funciona.
		desconocido: '#525252'
	};

	function colorEnlace(link: NetworkLink): string {
		return COLOR_CALIDAD[signalQuality(link.signal_dbm)];
	}

	function colorNodo(d: MapDevice): string {
		if (d.connectivity_status === 'disconnected') return '#f87171';
		if (d.connectivity_status === 'stale') return '#fbbf24';
		if (d.connectivity_status === 'connected') return '#34d399';
		return '#737373';
	}

	async function cargar() {
		try {
			datos = await fetchNetworkMap();
			error = null;
			pintar();
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudo cargar el mapa.';
		} finally {
			loading = false;
		}
	}

	function pintar() {
		if (!mapa || !L || !datos) return;

		capas.clearLayers();

		const porId = new Map(ubicados.map((d) => [d.id, d]));

		// Los enlaces se dibujan primero para que los nodos queden encima y se
		// puedan pinchar sin que la línea se lleve el clic.
		for (const link of datos.links) {
			const a = porId.get(link.a_device_id);
			const b = porId.get(link.b_device_id);
			if (!a || !b) continue;

			L.polyline(
				[
					[Number(a.latitude), Number(a.longitude)],
					[Number(b.latitude), Number(b.longitude)]
				],
				{
					color: colorEnlace(link),
					weight: link.status === 'confirmed' ? 3 : 2,
					// Los enlaces sin confirmar van punteados: se distinguen de un
					// vistazo de los que alguien ya dio por buenos.
					dashArray: link.status === 'confirmed' ? undefined : '6 6',
					opacity: 0.8
				}
			)
				.bindPopup(
					`<strong>${link.a_name ?? '?'} ↔ ${link.b_name ?? '?'}</strong><br>` +
						`${LINK_STATUS_LABELS[link.status]}` +
						(link.signal_dbm !== null ? `<br>Peor señal: ${link.signal_dbm} dBm` : '')
				)
				.addTo(capas);
		}

		for (const d of ubicados) {
			L.circleMarker([Number(d.latitude), Number(d.longitude)], {
				radius: d.role === 'cpe' ? 4 : 7,
				color: colorNodo(d),
				fillColor: colorNodo(d),
				fillOpacity: 0.85,
				weight: 2
			})
				.bindPopup(
					`<strong>${d.name}</strong><br>${d.role_label ?? ''}<br>` +
						`<code>${d.host}</code><br>${STATUS_LABELS[d.connectivity_status ?? 'unknown']}` +
						(d.last_signal_dbm !== null ? `<br>Señal: ${d.last_signal_dbm} dBm` : '') +
						(d.site_name ? `<br>En ${d.site_name}` : '')
				)
				.addTo(capas);
		}

		if (ubicados.length > 0) {
			mapa.fitBounds(
				ubicados.map((d) => [Number(d.latitude), Number(d.longitude)]),
				{ padding: [40, 40], maxZoom: 15 }
			);
		}
	}

	async function confirmar(link: NetworkLink) {
		try {
			await updateLinkStatus(link.id, 'confirmed');
			toast.success('Enlace confirmado.');
			await cargar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo confirmar.');
		}
	}

	async function archivar(link: NetworkLink) {
		try {
			await updateLinkStatus(link.id, 'archived');
			toast.success('Enlace archivado.');
			await cargar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo archivar.');
		}
	}

	onMount(async () => {
		// Leaflet toca `window` al importarse, así que se carga en el cliente y
		// no durante el renderizado en servidor.
		L = (await import('leaflet')).default;
		await import('leaflet/dist/leaflet.css');

		if (contenedor) {
			mapa = L.map(contenedor, { zoomControl: true }).setView([-0.18, -78.47], 12);

			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '© OpenStreetMap'
			}).addTo(mapa);

			capas = L.layerGroup().addTo(mapa);
		}

		await cargar();
	});

	onDestroy(() => {
		mapa?.remove();
		mapa = null;
	});
</script>

<div class="p-4 md:p-6 space-y-5">
	<header>
		<h1 class="text-lg font-semibold text-neutral-100">Mapa</h1>
		<p class="text-xs text-neutral-500 mt-1">
			Equipos sobre el terreno y los enlaces entre ellos, coloreados por calidad.
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

	<div
		bind:this={contenedor}
		class="h-[28rem] w-full rounded-xl border border-neutral-800/60 overflow-hidden bg-neutral-900/40"
	></div>

	{#if !loading && ubicados.length === 0}
		<p class="text-xs text-neutral-600">
			Ningún equipo tiene coordenadas todavía. Ponles latitud y longitud en
			<a href="/red/dispositivos" class="text-primary-400 hover:underline">Dispositivos</a>, o
			agrúpalos en sitios con coordenadas.
		</p>
	{/if}

	<!-- Enlaces por confirmar -->
	{#if sinConfirmar.length > 0}
		<section class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 overflow-hidden">
			<div class="px-4 pt-4 pb-2">
				<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
					Enlaces por confirmar ({sinConfirmar.length})
				</h2>
				<p class="mt-1 text-[10px] text-neutral-600">
					El descubrimiento los encontró pero nadie los ha dado por buenos. Se dibujan punteados
					hasta que alguien decide.
				</p>
			</div>
			<div class="overflow-x-auto">
				<table class="w-full text-xs">
					<tbody>
						{#each sinConfirmar as l (l.id)}
							<tr class="border-t border-neutral-800/40">
								<td class="px-4 py-2.5 text-neutral-200">{l.a_name} ↔ {l.b_name}</td>
								<td class="px-4 py-2.5 font-mono text-neutral-600">{l.discovery_source}</td>
								<td class="px-4 py-2.5 {QUALITY_CLASSES[signalQuality(l.signal_dbm)]}">
									{l.signal_dbm !== null ? `${l.signal_dbm} dBm` : '—'}
								</td>
								<td class="px-4 py-2.5 text-right">
									<button
										onclick={() => confirmar(l)}
										class="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20"
									>
										Confirmar
									</button>
									<button
										onclick={() => archivar(l)}
										class="ml-1 rounded px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-300"
									>
										No es un enlace
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}

	<!-- Equipos sin ubicar -->
	{#if sinUbicar.length > 0}
		<section class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4">
			<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-2">
				Sin ubicar ({sinUbicar.length})
			</h2>
			<!-- Se enseñan en vez de esconderse: un equipo sin ubicar es algo que
			     hay que arreglar, no algo que ignorar. -->
			<div class="flex flex-wrap gap-2">
				{#each sinUbicar as d (d.id)}
					<span
						class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700/50 bg-neutral-800/40 px-2.5 py-1 text-[11px] text-neutral-400"
					>
						<MapPin class="w-3 h-3 text-neutral-600" />
						{d.name}
					</span>
				{/each}
			</div>
		</section>
	{/if}
</div>
