<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { Crosshair, Loader2, MapPin, Search, TriangleAlert, X } from '@lucide/svelte';
	import { ubicacionActual, mensajeErrorUbicacion } from '$lib/utils/geolocalizacion';

	/**
	 * Selector de ubicación sobre un mapa.
	 *
	 * Existe porque escribir latitud y longitud a mano no es una herramienta: el
	 * operador sabe dónde está la antena («la torre detrás del colegio»), no sus
	 * coordenadas. Aquí puede buscarla por dirección, pincharla en el mapa o
	 * arrastrar el marcador hasta el tejado exacto.
	 */

	type Props = {
		abierto: boolean;
		latitud: number | null;
		longitud: number | null;
		/** Dónde abrir el mapa cuando el equipo todavía no tiene coordenadas. */
		centroPorDefecto?: [number, number];
		onConfirmar: (lat: number, lng: number) => void;
		onCerrar: () => void;
	};

	let {
		abierto,
		latitud,
		longitud,
		centroPorDefecto = [4.711, -74.0721],
		onConfirmar,
		onCerrar
	}: Props = $props();

	let L: any = null;
	let mapa: any = null;
	let marcador: any = null;

	let contenedor = $state<HTMLDivElement | null>(null);
	let campoBusqueda = $state<HTMLInputElement | null>(null);

	let seleccion = $state<{ lat: number; lng: number } | null>(null);
	/** Precisión en metros cuando la posición viene del navegador. */
	let precision = $state<number | null>(null);

	let consulta = $state('');
	let resultados = $state<{ nombre: string; lat: number; lng: number }[]>([]);
	let buscando = $state(false);
	let sinResultados = $state(false);
	let errorBusqueda = $state<string | null>(null);
	let localizando = $state(false);
	let errorUbicacion = $state<string | null>(null);
	/** Nombre del sitio bajo el marcador; confirma que se pinchó donde se quería. */
	let etiquetaLugar = $state<string | null>(null);

	let temporizador: ReturnType<typeof setTimeout> | null = null;
	let controlador: AbortController | null = null;
	let temporizadorInverso: ReturnType<typeof setTimeout> | null = null;

	const reducirMovimiento =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	// Un pin dibujado en HTML: el icono por defecto de Leaflet carga imágenes del
	// paquete que el empaquetador no resuelve, y salen los cuadros rotos.
	function icono() {
		return L.divIcon({
			className: '',
			html: `<span class="block h-4 w-4 -translate-x-1/2 -translate-y-full rounded-full border-2 border-white bg-primary-500 shadow-lg shadow-black/50"></span>`,
			iconSize: [0, 0]
		});
	}

	function fijar(lat: number, lng: number, opciones: { centrar?: boolean; zoom?: number } = {}) {
		seleccion = { lat, lng };
		if (!mapa || !L) return;

		if (marcador) {
			marcador.setLatLng([lat, lng]);
		} else {
			marcador = L.marker([lat, lng], { draggable: true, icon: icono() }).addTo(mapa);
			marcador.on('dragend', () => {
				const p = marcador.getLatLng();
				precision = null;
				fijar(p.lat, p.lng);
			});
		}

		if (opciones.centrar !== false) {
			mapa.setView([lat, lng], opciones.zoom ?? Math.max(mapa.getZoom(), 16), {
				animate: !reducirMovimiento
			});
		}

		programarGeocodificacionInversa(lat, lng);
	}

	/**
	 * Nominatim pide como mucho una petición por segundo, así que la consulta
	 * inversa espera a que el marcador se quede quieto en lugar de dispararse en
	 * cada píxel del arrastre.
	 */
	function programarGeocodificacionInversa(lat: number, lng: number) {
		etiquetaLugar = null;
		if (temporizadorInverso) clearTimeout(temporizadorInverso);
		temporizadorInverso = setTimeout(async () => {
			try {
				const res = await fetch(
					`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&accept-language=es`
				);
				if (!res.ok) return;
				const cuerpo = await res.json();
				etiquetaLugar = cuerpo?.display_name ?? null;
			} catch {
				// El nombre del sitio es una ayuda, no un requisito: si el servicio
				// no responde, las coordenadas siguen siendo válidas.
			}
		}, 700);
	}

	function alBuscar() {
		if (temporizador) clearTimeout(temporizador);
		errorBusqueda = null;
		sinResultados = false;

		const texto = consulta.trim();
		if (texto.length < 3) {
			resultados = [];
			buscando = false;
			return;
		}

		// Si pegan un par de coordenadas, no hace falta preguntarle a nadie.
		const par = texto.match(/^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/);
		if (par) {
			resultados = [];
			buscando = false;
			precision = null;
			fijar(Number(par[1]), Number(par[2]), { zoom: 17 });
			return;
		}

		buscando = true;
		temporizador = setTimeout(() => buscar(texto), 600);
	}

	async function buscar(texto: string) {
		controlador?.abort();
		controlador = new AbortController();
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=es&q=${encodeURIComponent(texto)}`,
				{ signal: controlador.signal }
			);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const cuerpo = await res.json();
			resultados = (cuerpo ?? []).map((r: any) => ({
				nombre: r.display_name as string,
				lat: Number(r.lat),
				lng: Number(r.lon)
			}));
			sinResultados = resultados.length === 0;
		} catch (e) {
			if ((e as Error)?.name === 'AbortError') return;
			resultados = [];
			errorBusqueda = 'No se pudo consultar el buscador de direcciones.';
		} finally {
			buscando = false;
		}
	}

	function elegirResultado(r: { nombre: string; lat: number; lng: number }) {
		precision = null;
		fijar(r.lat, r.lng, { zoom: 17 });
		resultados = [];
		consulta = r.nombre;
	}

	async function usarMiUbicacion() {
		localizando = true;
		errorUbicacion = null;
		try {
			const pos = await ubicacionActual();
			precision = pos.accuracy;
			fijar(pos.latitude, pos.longitude, { zoom: 17 });
		} catch (e) {
			errorUbicacion = mensajeErrorUbicacion(e);
		} finally {
			localizando = false;
		}
	}

	function confirmar() {
		if (!seleccion) return;
		onConfirmar(seleccion.lat, seleccion.lng);
	}

	function alPulsarTecla(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onCerrar();
		}
	}

	async function montar() {
		// Leaflet toca `window` al importarse: se carga en el cliente y solo
		// cuando de verdad se abre el selector.
		L = (await import('leaflet')).default;
		await import('leaflet/dist/leaflet.css');
		await tick();
		if (!contenedor) return;

		const partida: [number, number] =
			latitud !== null && longitud !== null ? [latitud, longitud] : centroPorDefecto;

		mapa = L.map(contenedor, { zoomControl: true }).setView(
			partida,
			latitud !== null && longitud !== null ? 16 : 6
		);

		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '© OpenStreetMap'
		}).addTo(mapa);

		mapa.on('click', (e: any) => {
			precision = null;
			fijar(e.latlng.lat, e.latlng.lng, { centrar: false });
		});

		if (latitud !== null && longitud !== null) fijar(latitud, longitud, { centrar: false });

		// Leaflet mide el contenedor al crearse; dentro de un modal que acaba de
		// aparecer todavía puede valer cero y el mapa sale en gris.
		setTimeout(() => mapa?.invalidateSize(), 60);
		campoBusqueda?.focus();
	}

	function desmontar() {
		if (temporizador) clearTimeout(temporizador);
		if (temporizadorInverso) clearTimeout(temporizadorInverso);
		controlador?.abort();
		mapa?.remove();
		mapa = null;
		marcador = null;
		seleccion = null;
		precision = null;
		etiquetaLugar = null;
		consulta = '';
		resultados = [];
		errorBusqueda = null;
		errorUbicacion = null;
		sinResultados = false;
	}

	$effect(() => {
		if (abierto) montar();
		else desmontar();
	});

	onDestroy(desmontar);
</script>

<svelte:window onkeydown={abierto ? alPulsarTecla : undefined} />

{#if abierto}
	<!--
		z-[60]: por encima del modal de alta (z-50) del que se abre. Leaflet usa
		z-index internos de hasta 1000, pero quedan encerrados en el contexto de
		apilamiento que crea este contenedor posicionado.
	-->
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 sm:p-4">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="titulo-selector-ubicacion"
			class="flex h-full max-h-[46rem] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-neutral-800 bg-[#0f0f12]"
		>
			<div class="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
				<h2
					id="titulo-selector-ubicacion"
					class="flex items-center gap-2 text-sm font-semibold text-neutral-100"
				>
					<MapPin class="h-4 w-4 text-primary-500" />
					Ubicación de la antena
				</h2>
				<button
					onclick={onCerrar}
					aria-label="Cerrar el selector de ubicación"
					class="rounded p-1.5 text-neutral-500 hover:bg-neutral-800/60 hover:text-white"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<!--
				Buscador. El z-index alto no es decorativo: Leaflet sube sus paneles
				hasta z-index 1000, y sin esto la lista de resultados se dibujaba
				DETRÁS del mapa —existía en el DOM y no se veía—. Queda contenido en
				el contexto de apilamiento del modal, así que no se escapa a la página.
			-->
			<div class="relative z-[1100] border-b border-neutral-800 px-4 py-3">
				<div class="flex flex-col gap-2 sm:flex-row">
					<div class="relative flex-1">
						<Search
							class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500"
						/>
						<label for="buscador-ubicacion" class="sr-only">Buscar una dirección o un lugar</label>
						<input
							id="buscador-ubicacion"
							bind:this={campoBusqueda}
							bind:value={consulta}
							oninput={alBuscar}
							autocomplete="off"
							placeholder="Busca una dirección, un barrio o pega «lat, lng»"
							class="w-full rounded-lg border border-neutral-800 bg-neutral-900/60 py-2 pl-9 pr-9 text-xs text-neutral-100 placeholder-neutral-600 focus:border-primary-500/40 focus:outline-none"
						/>
						{#if buscando}
							<Loader2
								class="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-neutral-500"
							/>
						{/if}
					</div>

					<button
						onclick={usarMiUbicacion}
						disabled={localizando}
						class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-300 transition-colors hover:border-neutral-700 hover:text-white disabled:opacity-50"
					>
						{#if localizando}
							<Loader2 class="h-3.5 w-3.5 animate-spin" />
							Localizando…
						{:else}
							<Crosshair class="h-3.5 w-3.5" />
							Dónde estoy
						{/if}
					</button>
				</div>

				{#if resultados.length > 0}
					<ul
						class="absolute left-4 right-4 top-full z-10 -mt-1 max-h-56 overflow-y-auto rounded-lg border border-neutral-800 bg-[#141418] shadow-xl"
					>
						{#each resultados as r (r.nombre)}
							<li>
								<button
									onclick={() => elegirResultado(r)}
									class="flex w-full items-start gap-2 px-3 py-2 text-left text-xs text-neutral-300 hover:bg-neutral-800/60"
								>
									<MapPin class="mt-0.5 h-3 w-3 shrink-0 text-neutral-600" />
									<span>{r.nombre}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				{#if sinResultados}
					<p class="mt-2 text-[11px] text-neutral-500">
						Sin resultados. Prueba con el municipio o pincha directamente en el mapa.
					</p>
				{/if}
				{#if errorBusqueda}
					<p role="alert" class="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300">
						<TriangleAlert class="h-3 w-3 shrink-0" />
						{errorBusqueda} Puedes pincharla en el mapa igualmente.
					</p>
				{/if}
				{#if errorUbicacion}
					<p role="alert" class="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300">
						<TriangleAlert class="mt-0.5 h-3 w-3 shrink-0" />
						{errorUbicacion}
					</p>
				{/if}
			</div>

			<div bind:this={contenedor} class="min-h-0 flex-1 bg-neutral-900/40"></div>

			<!-- Pie: qué se ha elegido y confirmación -->
			<div
				class="flex flex-col gap-3 border-t border-neutral-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="min-w-0">
					{#if seleccion}
						<p class="font-mono text-xs tabular-nums text-neutral-200">
							{seleccion.lat.toFixed(6)}, {seleccion.lng.toFixed(6)}
						</p>
						{#if etiquetaLugar}
							<p class="mt-0.5 truncate text-[11px] text-neutral-500" title={etiquetaLugar}>
								{etiquetaLugar}
							</p>
						{:else if precision !== null}
							<p class="mt-0.5 text-[11px] text-neutral-500">
								Precisión aproximada: ±{Math.round(precision)} m
							</p>
						{/if}
					{:else}
						<p class="text-[11px] text-neutral-500">
							Pincha en el mapa, busca una dirección o usa «Dónde estoy». Después puedes arrastrar
							el marcador para afinar.
						</p>
					{/if}
				</div>

				<div class="flex shrink-0 items-center gap-2">
					<button
						onclick={onCerrar}
						class="rounded-lg px-3 py-2 text-xs text-neutral-400 hover:text-white"
					>
						Cancelar
					</button>
					<button
						onclick={confirmar}
						disabled={!seleccion}
						class="rounded-lg border border-primary-500/30 bg-primary-500/10 px-4 py-2 text-xs font-medium text-primary-300 transition-colors hover:bg-primary-500/20 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Usar esta ubicación
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
