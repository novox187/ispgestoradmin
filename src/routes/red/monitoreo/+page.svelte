<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		ccqQuality,
		fetchNetworkDevices,
		formatThroughput,
		formatUptime,
		loadQuality,
		percentQuality,
		signalQuality,
		snrQuality,
		QUALITY_BARS,
		QUALITY_CLASSES,
		STATUS_CLASSES,
		STATUS_LABELS,
		type NetworkDevice,
		type Quality
	} from '$lib/api/network-devices';
	import FichaEquipo from '$lib/components/red/FichaEquipo.svelte';
	import { TriangleAlert } from '@lucide/svelte';

	let devices = $state<NetworkDevice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;

	/** Equipo cuya ficha está abierta a pantalla completa. */
	let fichaAbierta = $state<number | null>(null);

	/**
	 * Sondea en lugar de suscribirse por WebSocket porque es el patrón vigente
	 * en todo el panel y porque no existe un canal de Reverb para dispositivos;
	 * montarlo solo para esta pantalla no compensa. La cadencia es holgada: los
	 * datos de fondo se refrescan cada cinco minutos, así que pedirlos más a
	 * menudo solo cargaría la API para mostrar lo mismo.
	 */
	const INTERVALO = 30_000;

	async function cargar() {
		try {
			devices = await fetchNetworkDevices();
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudo cargar el estado.';
		} finally {
			loading = false;
			timer = setTimeout(cargar, INTERVALO);
		}
	}

	onMount(cargar);
	onDestroy(() => timer && clearTimeout(timer));

	const conRadio = $derived(devices.filter((d) => d.has_radio));
	const sinRadio = $derived(devices.filter((d) => !d.has_radio));

	const agentesCaidos = $derived(devices.some((d) => d.connectivity_status === 'stale'));

	/** «hace 3 min», o la marca de que el dato ya no es de fiar. */
	function antiguedad(iso: string | null): string {
		if (!iso) return 'nunca';

		const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
		if (minutos < 1) return 'ahora';
		if (minutos < 60) return `hace ${minutos} min`;

		const horas = Math.floor(minutos / 60);
		if (horas < 24) return `hace ${horas} h`;

		return `hace ${Math.floor(horas / 24)} d`;
	}

	/**
	 * Un dato viejo se marca aunque el equipo figure como conectado: mostrar una
	 * señal de hace tres horas como si fuera la de ahora es peor que no mostrar
	 * nada, porque invita a decidir sobre información falsa.
	 */
	function esViejo(iso: string | null): boolean {
		if (!iso) return true;
		return Date.now() - new Date(iso).getTime() > 15 * 60_000;
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

	{#if agentesCaidos}
		<div
			class="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300"
		>
			<TriangleAlert class="w-4 h-4 shrink-0 mt-0.5" />
			<span>
				Algunos equipos aparecen <strong>sin datos recientes</strong>. Cuando le pasa a varios a la
				vez, casi siempre es que el agente que los sondea está caído — no los equipos.
			</span>
		</div>
	{/if}

	<!--
		Una barra por métrica, como en la interfaz de la propia antena. El color no
		lo elige la barra: lo dicta la escala de calidad compartida, para que un
		enlace regular se vea igual de ámbar aquí, en la ficha y en el mapa.
	-->
	{#snippet barra(etiqueta: string, texto: string, calidad: Quality, relleno: number | null)}
		<div>
			<div class="flex items-baseline justify-between gap-2">
				<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-600"
					>{etiqueta}</span
				>
				<span class="text-[11px] font-mono {QUALITY_CLASSES[calidad]}">{texto}</span>
			</div>
			<div class="mt-1 h-1 overflow-hidden rounded-full bg-neutral-800">
				<div
					class="h-full rounded-full transition-all {QUALITY_BARS[calidad]}"
					style="width: {relleno === null ? 0 : Math.min(100, Math.max(0, relleno))}%"
				></div>
			</div>
		</div>
	{/snippet}

	{#if loading}
		<p class="text-xs text-neutral-600">Cargando…</p>
	{:else if conRadio.length === 0}
		<p class="text-xs text-neutral-600">
			No hay equipos con radio en el inventario. Da de alta una antena en
			<a href="/red/dispositivos" class="text-primary-400 hover:underline">Dispositivos</a>.
		</p>
	{:else}
		<section class="space-y-2">
			<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Enlaces</h2>

			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each conRadio as d (d.id)}
					{@const t = d.telemetry}
					{@const calidadSenal = signalQuality(d.last_signal_dbm)}
					{@const viejo = esViejo(d.last_telemetry_at)}

					<!--
						La tarjeta entera abre la ficha. Es el gesto que ya intenta
						cualquiera al ver una antena con la señal en rojo, y hasta ahora
						no llevaba a ninguna parte.
					-->
					<button
						type="button"
						onclick={() => (fichaAbierta = d.id)}
						class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-900/70 focus:outline-none focus-visible:border-primary-500/50"
					>
						<div class="flex items-start justify-between gap-2 mb-3">
							<div class="min-w-0">
								<p class="truncate text-sm text-neutral-200">{d.name}</p>
								<p class="truncate text-[10px] font-mono text-neutral-600">
									{d.host}
									{#if d.ssid}· {d.ssid}{/if}
								</p>
							</div>
							<span
								class="shrink-0 rounded border px-1.5 py-0.5 text-[10px]
									{STATUS_CLASSES[d.connectivity_status ?? 'unknown']}"
							>
								{STATUS_LABELS[d.connectivity_status ?? 'unknown']}
							</span>
						</div>

						<!-- Señal y CCQ siguen siendo lo primero: son lo que decide si hay
						     que ir a mirar el enlace. Lo demás explica por qué. -->
						<div class="grid grid-cols-2 gap-3">
							<div>
								<p class="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
									Señal
								</p>
								<p class="text-xl font-semibold {QUALITY_CLASSES[calidadSenal]}">
									{d.last_signal_dbm ?? '—'}
									{#if d.last_signal_dbm !== null}<span
											class="text-xs font-normal text-neutral-600">dBm</span
										>{/if}
								</p>
								<p class="text-[10px] {QUALITY_CLASSES[calidadSenal]}">{calidadSenal}</p>
							</div>

							<div>
								<p class="text-[10px] font-mono uppercase tracking-widest text-neutral-600">CCQ</p>
								<p class="text-xl font-semibold {QUALITY_CLASSES[ccqQuality(d.last_ccq_percent)]}">
									{d.last_ccq_percent ?? '—'}
									{#if d.last_ccq_percent !== null}<span
											class="text-xs font-normal text-neutral-600">%</span
										>{/if}
								</p>
								<p class="text-[10px] {QUALITY_CLASSES[ccqQuality(d.last_ccq_percent)]}">
									{ccqQuality(d.last_ccq_percent)}
								</p>
							</div>
						</div>

						{#if t}
							<div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
								{@render barra(
									'CPU',
									t.cpu_load_percent !== null ? `${t.cpu_load_percent} %` : '—',
									loadQuality(t.cpu_load_percent),
									t.cpu_load_percent
								)}
								{@render barra(
									'Memoria',
									t.memory_used_percent !== null ? `${t.memory_used_percent} %` : '—',
									loadQuality(t.memory_used_percent),
									t.memory_used_percent
								)}
								{@render barra(
									'SNR',
									t.snr_db !== null ? `${t.snr_db} dB` : '—',
									snrQuality(t.snr_db),
									t.snr_db === null ? null : (t.snr_db / 40) * 100
								)}
								{@render barra(
									'airMAX',
									t.airmax_quality_percent !== null ? `${t.airmax_quality_percent} %` : '—',
									percentQuality(t.airmax_quality_percent),
									t.airmax_quality_percent
								)}
							</div>

							<div
								class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-neutral-500"
							>
								{#if t.frequency_mhz !== null}<span>{t.frequency_mhz} MHz</span>{/if}
								{#if t.tx_throughput_kbps !== null || t.rx_throughput_kbps !== null}
									<span>
										↑{formatThroughput(t.tx_throughput_kbps)} ↓{formatThroughput(
											t.rx_throughput_kbps
										)}
									</span>
								{/if}
								{#if t.station_count !== null && t.station_count > 0}
									<span>{t.station_count} estaciones</span>
								{/if}
								{#if t.uptime_seconds !== null}<span>activa {formatUptime(t.uptime_seconds)}</span
									>{/if}
							</div>
						{:else}
							<!-- Sin lectura no se pintan barras a cero: un cero en la señal se
							     lee como un enlace muerto, y aquí solo significa que el equipo
							     todavía no ha reportado. -->
							<p class="mt-3 text-[10px] text-neutral-600">
								Todavía no hay ninguna lectura de este equipo.
							</p>
						{/if}

						<p
							class="mt-3 text-[10px] font-mono {viejo ? 'text-amber-500/80' : 'text-neutral-600'}"
						>
							{viejo ? '⚠ ' : ''}Última lectura {antiguedad(d.last_telemetry_at)}
						</p>
					</button>
				{/each}
			</div>
		</section>
	{/if}

	{#if sinRadio.length > 0}
		<section class="space-y-2">
			<h2 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
				Equipos sin radio
			</h2>
			<!-- Sin métricas de señal a propósito: un router de núcleo no tiene
			     radio, y mostrar «— dBm» invitaría a leerlo como un enlace caído.
			     CPU y memoria sí aplican, y son las que dicen si va ahogado. -->
			<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 overflow-x-auto">
				<table class="w-full text-xs">
					<tbody>
						{#each sinRadio as d (d.id)}
							<tr
								class="border-t border-neutral-800/40 first:border-t-0 hover:bg-neutral-900/60 cursor-pointer"
								onclick={() => (fichaAbierta = d.id)}
							>
								<td class="px-4 py-2.5 text-neutral-200">{d.name}</td>
								<td class="px-4 py-2.5 font-mono text-neutral-500">{d.host}</td>
								<td class="px-4 py-2.5 text-neutral-500">{d.role_label ?? '—'}</td>
								<td class="px-4 py-2.5 font-mono text-neutral-500">
									{#if d.telemetry?.cpu_load_percent !== null && d.telemetry?.cpu_load_percent !== undefined}
										<span class={QUALITY_CLASSES[loadQuality(d.telemetry.cpu_load_percent)]}>
											CPU {d.telemetry.cpu_load_percent} %
										</span>
									{:else}
										—
									{/if}
								</td>
								<td class="px-4 py-2.5 font-mono text-neutral-500">
									{#if d.telemetry?.memory_used_percent !== null && d.telemetry?.memory_used_percent !== undefined}
										<span class={QUALITY_CLASSES[loadQuality(d.telemetry.memory_used_percent)]}>
											RAM {d.telemetry.memory_used_percent} %
										</span>
									{:else}
										—
									{/if}
								</td>
								<td class="px-4 py-2.5">
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
	{/if}
</div>

{#if fichaAbierta !== null}
	<FichaEquipo deviceId={fichaAbierta} onClose={() => (fichaAbierta = null)} />
{/if}
