<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Loader2, Plug, RefreshCw, Radio, TriangleAlert, X } from '@lucide/svelte';
	import {
		ccqQuality,
		fetchDeviceLive,
		fetchDeviceMetrics,
		formatBytes,
		formatDistance,
		formatFrequency,
		formatThroughput,
		formatUptime,
		loadQuality,
		percentQuality,
		signalQuality,
		snrQuality,
		testNetworkDevice,
		QUALITY_BARS,
		QUALITY_CLASSES,
		STATUS_CLASSES,
		STATUS_LABELS,
		type DeviceMetrics,
		type DeviceTelemetry,
		type Quality
	} from '$lib/api/network-devices';
	import GraficoSerie from './GraficoSerie.svelte';

	/**
	 * Ficha a pantalla completa de un equipo.
	 *
	 * Enseña de una vez lo que hasta ahora obligaba a abrir la interfaz web de la
	 * antena: estado del enlace, carga del sistema, cómo está configurada la
	 * radio y qué ha hecho en las últimas horas. Todo eso ya lo leía el sistema.
	 *
	 * La tarjeta del listado enseña lo que se mira de un vistazo sobre cientos de
	 * equipos; esto es lo otro, lo que se mira sobre UNO cuando algo va mal, y por
	 * eso se pide aparte: cuesta varias consultas más, una contra la tabla de
	 * muestras.
	 */

	const { deviceId, onClose } = $props<{ deviceId: number; onClose: () => void }>();

	/**
	 * Ventanas de consulta. Las dos primeras las sirve el detalle a cinco
	 * minutos; a partir de ahí el servidor cambia al resumen horario, que es lo
	 * único que sobrevive a la poda del detalle.
	 */
	const RANGOS = [
		{ horas: 6, etiqueta: '6 h' },
		{ horas: 24, etiqueta: '24 h' },
		{ horas: 168, etiqueta: '7 d' },
		{ horas: 720, etiqueta: '30 d' }
	];

	/** La misma cadencia que el listado: los datos de fondo son de cinco minutos. */
	const INTERVALO = 30_000;

	let datos = $state<DeviceMetrics | null>(null);
	let horas = $state(24);
	let cargando = $state(true);
	let error = $state<string | null>(null);
	let sondeando = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Lectura en directo.
	 *
	 * El ciclo de fondo sondea cada pocos minutos, cadencia pensada para vigilar
	 * cientos de equipos a la vez; mirando UNO eso se ve como una pantalla
	 * congelada, que es justo la queja. Con la ficha abierta se le pregunta al
	 * equipo cada pocos segundos, como hace su propia interfaz web.
	 */
	const CADENCIA_DIRECTO = 5_000;

	let directo = $state(true);
	let enVivo = $state<DeviceTelemetry | null>(null);
	let motivoSinDirecto = $state<string | null>(null);
	let latido = $state(false);
	let timerDirecto: ReturnType<typeof setTimeout> | null = null;

	async function sondearEnVivo() {
		if (!directo) return;

		try {
			const lectura = await fetchDeviceLive(deviceId);

			if (lectura.ok) {
				enVivo = lectura.telemetry;
				motivoSinDirecto = null;
				// Un parpadeo corto por lectura: sin él no hay forma de distinguir
				// «va en directo» de «se quedó parado con datos buenos».
				latido = true;
				setTimeout(() => (latido = false), 400);
			} else {
				/*
				 * Que el servidor no llegue al equipo es lo normal en las antenas
				 * de la LAN del cliente. Se apaga el directo en vez de insistir
				 * cada cinco segundos contra algo inalcanzable, y se dice por qué.
				 */
				directo = false;
				motivoSinDirecto = lectura.error ?? 'el servidor no alcanza a este equipo';
			}
		} catch (e) {
			directo = false;
			motivoSinDirecto = e instanceof Error ? e.message : 'no se pudo leer en directo';
		} finally {
			if (timerDirecto) clearTimeout(timerDirecto);
			if (directo) timerDirecto = setTimeout(sondearEnVivo, CADENCIA_DIRECTO);
		}
	}

	function alternarDirecto() {
		directo = !directo;

		if (directo) {
			motivoSinDirecto = null;
			sondearEnVivo();
		} else if (timerDirecto) {
			clearTimeout(timerDirecto);
		}
	}

	async function cargar(silencioso = false) {
		if (!silencioso) cargando = true;

		try {
			datos = await fetchDeviceMetrics(deviceId, horas);
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudo cargar la ficha.';
		} finally {
			cargando = false;
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => cargar(true), INTERVALO);
		}
	}

	function cambiarRango(nuevas: number) {
		horas = nuevas;
		cargar();
	}

	/**
	 * Habla con el equipo ahora mismo, sin esperar al ciclo del agente.
	 *
	 * Solo llega si el servidor alcanza al equipo. En las antenas, que viven en la
	 * LAN del cliente, lo normal es que no y lo diga el error; se ofrece igual
	 * porque para los routers —a los que sí llega por el túnel— es la forma de
	 * confirmar en el momento que una avería ya terminó.
	 */
	async function sondear() {
		sondeando = true;

		try {
			const resultado = await testNetworkDevice(deviceId);

			if (resultado.ok) {
				toast.success('El equipo respondió.');
				await cargar(true);
			} else {
				toast.error(resultado.error ?? 'El equipo no respondió.');
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo sondear.');
		} finally {
			sondeando = false;
		}
	}

	function alTeclear(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	onMount(() => {
		cargar();
		sondearEnVivo();
	});

	onDestroy(() => {
		if (timer) clearTimeout(timer);
		// Importa apagarlo: si no, cerrar la ficha dejaría el navegador
		// interrogando a un equipo de tejado para siempre.
		directo = false;
		if (timerDirecto) clearTimeout(timerDirecto);
	});

	const equipo = $derived(datos?.device ?? null);
	/** Manda lo leído en directo; si no hay, lo último que guardó el sistema. */
	const t = $derived(enVivo ?? datos?.device.telemetry ?? null);

	/**
	 * airMAX es de Ubiquiti. En un MikroTik no es «cero» ni «desconocido»: es una
	 * métrica que no existe, y enseñarla vacía invita a buscar una avería donde
	 * no la hay.
	 */
	const esUbiquiti = $derived(equipo?.vendor === 'ubiquiti');

	/**
	 * ¿Ha informado el equipo esta métrica alguna vez en la ventana?
	 *
	 * Un gráfico permanentemente vacío no dice «no hay lecturas», dice «este
	 * equipo no publica esto» — y ocupa el mismo sitio que uno con información.
	 */
	function tieneDatos(campo: Parameters<typeof serie>[0]): boolean {
		return serie(campo).some((p) => p.v !== null);
	}
	const puntos = $derived(datos?.history.points ?? []);
	const esHorario = $derived(datos?.history.resolution === 'hourly');

	function serie(campo: 'signal' | 'ccq' | 'cpu' | 'snr' | 'airmax_quality' | 'tx_kbps' | 'rx_kbps') {
		return puntos.map((p) => ({
			t: p.t,
			v: campo === 'tx_kbps' || campo === 'rx_kbps' ? (p[campo] === null ? null : p[campo]! / 1000) : p[campo],
			min: campo === 'signal' ? p.signal_min : null,
			max: campo === 'signal' ? p.signal_max : null
		}));
	}

	/**
	 * Cuánto llenar la barra de señal.
	 *
	 * La escala va de -90 a -40 dBm y no de 0 a -100: ese es el tramo en el que
	 * vive un enlace real, y con la escala completa todas las antenas del parque
	 * se verían con la barra por la mitad, que no informa de nada.
	 */
	function rellenoSenal(dbm: number | null): number | null {
		if (dbm === null) return null;
		return ((dbm + 90) / 50) * 100;
	}

	function cuando(iso: string | null | undefined): string {
		if (!iso) return '—';
		return new Date(iso).toLocaleString('es', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:window onkeydown={alTeclear} />

<!-- Pantalla completa y no un modal: son cuatro bloques de datos y media docena
     de gráficos, y encajarlos en una caja centrada obligaría a hacer scroll
     dentro de un scroll. -->
<div class="fixed inset-0 z-50 overflow-y-auto bg-neutral-950">
	<div class="mx-auto max-w-7xl px-4 py-5 sm:px-6">
		<!-- ── Cabecera ─────────────────────────────────────────────────────── -->
		<header class="sticky top-0 z-10 -mx-4 mb-5 border-b border-neutral-800/60 bg-neutral-950/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<h1 class="truncate text-base font-semibold text-neutral-100">
							{equipo?.name ?? 'Cargando…'}
						</h1>
						{#if equipo}
							<span
								class="shrink-0 rounded border px-1.5 py-0.5 text-[10px] {STATUS_CLASSES[
									equipo.connectivity_status ?? 'unknown'
								]}"
							>
								{STATUS_LABELS[equipo.connectivity_status ?? 'unknown']}
							</span>
						{/if}
					</div>
					{#if equipo}
						<p class="mt-0.5 truncate text-[11px] font-mono text-neutral-500">
							{equipo.host}
							{#if equipo.model}· {equipo.model}{/if}
							{#if equipo.firmware_version}· {equipo.firmware_version}{/if}
						</p>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<div class="flex rounded-lg border border-neutral-800 p-0.5">
						{#each RANGOS as rango (rango.horas)}
							<button
								onclick={() => cambiarRango(rango.horas)}
								class="rounded px-2 py-1 text-[11px] transition-colors
									{horas === rango.horas
									? 'bg-neutral-800 text-neutral-100'
									: 'text-neutral-500 hover:text-neutral-300'}"
							>
								{rango.etiqueta}
							</button>
						{/each}
					</div>

					<button
						onclick={alternarDirecto}
						title={directo
							? 'Preguntando al equipo cada 5 segundos'
							: (motivoSinDirecto ?? 'Reanudar la lectura en directo')}
						class="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors
							{directo
							? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
							: 'border-neutral-800 text-neutral-500 hover:text-neutral-300'}"
					>
						<Radio class="w-3.5 h-3.5 {latido ? 'opacity-100' : 'opacity-50'}" />
						{directo ? 'En directo' : 'Directo'}
					</button>

					<button
						onclick={sondear}
						disabled={sondeando}
						class="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:border-neutral-700 disabled:opacity-50"
					>
						{#if sondeando}
							<Loader2 class="w-3.5 h-3.5 animate-spin" />
						{:else}
							<Plug class="w-3.5 h-3.5" />
						{/if}
						Sondear
					</button>

					<button
						onclick={() => cargar()}
						class="rounded-lg border border-neutral-800 p-1.5 text-neutral-400 hover:text-white"
						aria-label="Actualizar"
					>
						<RefreshCw class="w-3.5 h-3.5" />
					</button>

					<button
						onclick={onClose}
						class="rounded-lg border border-neutral-800 p-1.5 text-neutral-400 hover:text-white"
						aria-label="Cerrar"
					>
						<X class="w-4 h-4" />
					</button>
				</div>
			</div>
		</header>

		{#if error}
			<div class="mb-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-300">
				<TriangleAlert class="w-4 h-4 shrink-0 mt-0.5" />
				<span>{error}</span>
			</div>
		{/if}

		{#if cargando && !datos}
			<p class="text-xs text-neutral-600">Cargando ficha…</p>
		{:else if datos && equipo}
			{#if motivoSinDirecto}
				<!--
					No es una avería del enlace ni un fallo del panel: el servidor no
					llega a este equipo, que es lo normal en las antenas que viven en la
					LAN del cliente. La ficha sigue enseñando lo que trajo su agente.
				-->
				<div class="mb-4 flex items-start gap-2 rounded-lg border border-neutral-700/60 bg-neutral-800/30 px-3 py-2.5 text-xs text-neutral-400">
					<Radio class="w-4 h-4 shrink-0 mt-0.5" />
					<span>
						<!-- El motivo viene del driver y suele acabar en punto; encadenarlo
						     tal cual dejaba dos seguidos. -->
						Sin lectura en directo: {motivoSinDirecto.replace(/\.$/, '')}. Se muestran los datos
						del último sondeo, que se refrescan cada {Math.round(INTERVALO / 1000)} segundos.
					</span>
				</div>
			{/if}

			{#if t?.unparsed}
				<!-- Ni caído ni sano: respondió algo que el driver no sabe leer. Sin
				     este aviso, una ficha a medias parecería una avería. -->
				<div class="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300">
					<TriangleAlert class="w-4 h-4 shrink-0 mt-0.5" />
					<span>
						El equipo responde, pero su firmware devuelve un formato que todavía no sabemos
						interpretar. La respuesta queda guardada para darle soporte; mientras tanto, esta
						ficha se queda a medias. <strong>No es una avería del enlace.</strong>
					</span>
				</div>
			{/if}

			{#snippet medidor(
				etiqueta: string,
				valor: number | null,
				calidad: Quality,
				unidad: string,
				relleno: number | null
			)}
				<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-3">
					<p class="text-[10px] font-mono uppercase tracking-widest text-neutral-600">{etiqueta}</p>
					<p class="mt-1 text-2xl font-semibold {QUALITY_CLASSES[calidad]}">
						{valor ?? '—'}{#if valor !== null}<span class="text-xs font-normal text-neutral-600"
								>{unidad}</span
							>{/if}
					</p>
					<div class="mt-2 h-1 overflow-hidden rounded-full bg-neutral-800">
						<div
							class="h-full rounded-full transition-all {QUALITY_BARS[calidad]}"
							style="width: {relleno === null ? 0 : Math.min(100, Math.max(0, relleno))}%"
						></div>
					</div>
				</div>
			{/snippet}

			{#snippet dato(etiqueta: string, valor: string | number | null | undefined)}
				<div class="flex items-baseline justify-between gap-3 border-b border-neutral-800/40 py-1.5 last:border-b-0">
					<span class="text-[11px] text-neutral-500">{etiqueta}</span>
					<span class="text-right text-[11px] font-mono text-neutral-200">{valor ?? '—'}</span>
				</div>
			{/snippet}

			<!-- ── Indicadores ──────────────────────────────────────────────── -->
			<section class="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
				{#if equipo.has_radio}
					{@render medidor(
						'Señal',
						t?.signal_dbm ?? null,
						signalQuality(t?.signal_dbm ?? null),
						' dBm',
						rellenoSenal(t?.signal_dbm ?? null)
					)}
					{@render medidor(
						'SNR',
						t?.snr_db ?? null,
						snrQuality(t?.snr_db ?? null),
						' dB',
						t?.snr_db == null ? null : (t.snr_db / 40) * 100
					)}
					{@render medidor(
						'CCQ',
						t?.ccq_percent ?? null,
						ccqQuality(t?.ccq_percent ?? null),
						'%',
						t?.ccq_percent ?? null
					)}
					{#if esUbiquiti}
						{@render medidor(
							'Calidad airMAX',
							t?.airmax_quality_percent ?? null,
							percentQuality(t?.airmax_quality_percent ?? null),
							'%',
							t?.airmax_quality_percent ?? null
						)}
					{/if}
				{/if}

				{@render medidor(
					'CPU',
					t?.cpu_load_percent ?? null,
					loadQuality(t?.cpu_load_percent ?? null),
					'%',
					t?.cpu_load_percent ?? null
				)}
				{@render medidor(
					'Memoria',
					t?.memory_used_percent ?? null,
					loadQuality(t?.memory_used_percent ?? null),
					'%',
					t?.memory_used_percent ?? null
				)}

				{#if equipo.has_radio && esUbiquiti}
					{@render medidor(
						'Capacidad airMAX',
						t?.airmax_capacity_percent ?? null,
						percentQuality(t?.airmax_capacity_percent ?? null),
						'%',
						t?.airmax_capacity_percent ?? null
					)}
				{/if}

				<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-3">
					<p class="text-[10px] font-mono uppercase tracking-widest text-neutral-600">
						Tiempo activo
					</p>
					<p class="mt-1 text-2xl font-semibold text-neutral-200">
						{formatUptime(t?.uptime_seconds ?? null)}
					</p>
					<p class="mt-2 text-[10px] text-neutral-600">
						Última lectura {cuando(t?.sampled_at)}
					</p>
				</div>
			</section>

			<!-- ── Series ───────────────────────────────────────────────────── -->
			<section class="mb-5">
				<h2 class="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
					Historia
					<span class="ml-1 normal-case tracking-normal text-neutral-600">
						({esHorario ? 'media por hora, con el rango real de cada hora' : 'una lectura por sondeo'})
					</span>
				</h2>

				{#if puntos.length === 0}
					<!--
						Tres cajas vacías con «sin lecturas» harían pensar que el equipo
						lleva una semana mudo. Lo que pasa casi siempre es lo otro: el
						resumen por hora lo construye un proceso periódico y todavía no ha
						agregado nada, aunque el detalle de las últimas horas sí exista.
					-->
					<div
						class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 px-4 py-6 text-center"
					>
						<p class="text-xs text-neutral-400">
							{esHorario
								? 'Todavía no hay resumen por hora de este equipo.'
								: 'No hay lecturas de este equipo en este periodo.'}
						</p>
						<p class="mx-auto mt-1 max-w-lg text-[11px] leading-relaxed text-neutral-600">
							{#if esHorario}
								Los periodos largos se sirven de un resumen que agrega un proceso periódico; el
								detalle al minuto solo se conserva unas semanas. Mientras ese resumen se
								construye, usa <button
									class="text-primary-400 hover:underline"
									onclick={() => cambiarRango(24)}>las últimas 24 horas</button
								>.
							{:else}
								La serie se llena con cada sondeo del monitoreo. Si el equipo se acaba de dar de
								alta, aún no ha dado tiempo.
							{/if}
						</p>
					</div>
				{:else}
					<!--
						Cada gráfico se dibuja solo si el equipo publica esa métrica. Un
						MikroTik no informa caudal ni calidad airMAX, y cuatro cajas con
						«sin lecturas» hacen pensar en una avería donde solo hay un
						fabricante que no publica ese dato.
					-->
					<div class="grid gap-3 lg:grid-cols-2">
						{#if tieneDatos('signal')}
							<GraficoSerie
								puntos={serie('signal')}
								titulo="Señal (dBm)"
								unidad=" dBm"
								color="#38bdf8"
							/>
						{/if}
						{#if tieneDatos('ccq')}
							<GraficoSerie
								puntos={serie('ccq')}
								titulo="CCQ (%)"
								unidad="%"
								color="#a3e635"
								dominio={[0, 100]}
							/>
						{/if}
						{#if tieneDatos('snr')}
							<GraficoSerie puntos={serie('snr')} titulo="SNR (dB)" unidad=" dB" color="#c084fc" />
						{/if}

						{#if tieneDatos('cpu')}
							<GraficoSerie
								puntos={serie('cpu')}
								titulo="CPU (%)"
								unidad="%"
								color="#f59e0b"
								dominio={[0, 100]}
							/>
						{/if}

						<!-- El caudal solo lo publican las airOS y solo vive en la serie
						     al detalle: el resumen horario no lo agrega. -->
						{#if tieneDatos('tx_kbps')}
							<GraficoSerie
								puntos={serie('tx_kbps')}
								titulo="Tráfico TX (Mbps)"
								unidad=" Mbps"
								color="#f87171"
								decimales={2}
							/>
						{/if}
						{#if tieneDatos('rx_kbps')}
							<GraficoSerie
								puntos={serie('rx_kbps')}
								titulo="Tráfico RX (Mbps)"
								unidad=" Mbps"
								color="#60a5fa"
								decimales={2}
							/>
						{/if}
					</div>
				{/if}
			</section>

			<!-- ── Especificaciones ─────────────────────────────────────────── -->
			<section class="grid gap-3 lg:grid-cols-3">
				{#if equipo.has_radio}
					<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4">
						<h3 class="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
							Radio
						</h3>
						{@render dato('SSID', equipo.ssid)}
						{@render dato('Modo inalámbrico', equipo.wireless_mode_label)}
						{@render dato('Seguridad', equipo.security)}
						{@render dato('Canal / ancho', formatFrequency(t?.frequency_mhz ?? null, t?.channel_width_mhz ?? null))}
						{@render dato('Potencia de TX', t?.tx_power_dbm != null ? `${t.tx_power_dbm} dBm` : null)}
						{@render dato('Ruido de fondo', t?.noise_floor_dbm != null ? `${t.noise_floor_dbm} dBm` : null)}
						{@render dato(
							'Velocidad TX/RX',
							t?.tx_rate_mbps != null || t?.rx_rate_mbps != null
								? `${t?.tx_rate_mbps ?? '—'} / ${t?.rx_rate_mbps ?? '—'} Mbps`
								: null
						)}
						{@render dato(
							'Caudal TX/RX',
							`${formatThroughput(t?.tx_throughput_kbps ?? null)} / ${formatThroughput(t?.rx_throughput_kbps ?? null)}`
						)}
						{@render dato('Distancia', formatDistance(t?.distance_m ?? null))}
						{@render dato('Estaciones asociadas', t?.station_count)}
						{@render dato('MAC del otro extremo', equipo.remote_mac)}
					</div>
				{/if}

				<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4">
					<h3 class="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
						Sistema
					</h3>
					{@render dato('Modelo', equipo.model)}
					{@render dato('Firmware', equipo.firmware_version)}
					{@render dato('Tiempo activo', formatUptime(t?.uptime_seconds ?? null))}
					{@render dato('CPU', t?.cpu_load_percent != null ? `${t.cpu_load_percent} %` : null)}
					{@render dato(
						'Memoria libre',
						t?.memory_total_bytes != null
							? `${formatBytes(t.memory_free_bytes)} de ${formatBytes(t.memory_total_bytes)}`
							: null
					)}
					{@render dato('Última lectura', cuando(t?.sampled_at))}
					{@render dato('Última conexión correcta', cuando(equipo.last_telemetry_at))}
				</div>

				<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-4">
					<h3 class="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
						Inventario
					</h3>
					{@render dato('Fabricante', equipo.vendor_label)}
					{@render dato('Papel en la red', equipo.role_label)}
					{@render dato('Dirección', `${equipo.host}${equipo.port ? `:${equipo.port}` : ''}`)}
					{@render dato('MAC', equipo.mac_address)}
					{@render dato('Número de serie', equipo.serial_number)}
					{@render dato('Abonado', datos.context.client?.name)}
					{@render dato('Sitio', datos.context.site?.name)}
					{@render dato('Sondeado por', datos.context.agent?.name ?? 'El servidor')}
					{@render dato('Monitorizado', equipo.is_monitored ? 'Sí' : 'No')}
				</div>
			</section>

			<!-- ── Vecinos ──────────────────────────────────────────────────── -->
			{#if datos.peers.length > 0}
				<section class="mt-3">
					<h2 class="mb-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
						Al otro lado del enlace
					</h2>
					<div class="overflow-x-auto rounded-xl border border-neutral-800/60 bg-neutral-900/40">
						<table class="w-full text-xs">
							<tbody>
								{#each datos.peers as vecino (vecino.link_id)}
									<tr class="border-t border-neutral-800/40 first:border-t-0">
										<td class="px-4 py-2.5 text-neutral-200">{vecino.name}</td>
										<td class="px-4 py-2.5 font-mono text-neutral-500">{vecino.host}</td>
										<td class="px-4 py-2.5 text-neutral-500">{vecino.role_label ?? '—'}</td>
										<td class="px-4 py-2.5">
											<span
												class="inline-block rounded border px-1.5 py-0.5 text-[10px] {STATUS_CLASSES[
													vecino.connectivity_status ?? 'unknown'
												]}"
											>
												{STATUS_LABELS[vecino.connectivity_status ?? 'unknown']}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>
			{/if}
		{/if}
	</div>
</div>
