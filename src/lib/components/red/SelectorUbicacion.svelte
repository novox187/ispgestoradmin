<script lang="ts">
	import { Crosshair, Loader2, Map, MapPin, TriangleAlert, X } from '@lucide/svelte';
	import ModalMapaUbicacion from './ModalMapaUbicacion.svelte';
	import {
		mensajeErrorUbicacion,
		ubicacionActual,
		PRECISION_POBRE_M
	} from '$lib/utils/geolocalizacion';

	/**
	 * Ubicación de un equipo, por tres vías.
	 *
	 * Escribir coordenadas a mano era la única opción y no es una herramienta:
	 * nadie se sabe la latitud de una torre. Ahora se puede tomar la posición del
	 * equipo desde el que se da de alta —útil cuando el instalador está al pie de
	 * la antena—, marcarla en un mapa con buscador, o seguir tecleándola si viene
	 * de un GPS.
	 */

	type Props = {
		latitude: string | number | null;
		longitude: string | number | null;
		/** Dónde abrir el mapa cuando aún no hay coordenadas. */
		centroPorDefecto?: [number, number];
	};

	let {
		latitude = $bindable(),
		longitude = $bindable(),
		centroPorDefecto = undefined
	}: Props = $props();

	let mapaAbierto = $state(false);
	let localizando = $state(false);
	let aviso = $state<string | null>(null);
	let precision = $state<number | null>(null);

	function comoNumero(v: string | number | null): number | null {
		if (v === null || v === undefined) return null;
		const n = typeof v === 'number' ? v : v.trim() === '' ? NaN : Number(v);
		return Number.isFinite(n) ? n : null;
	}

	const lat = $derived(comoNumero(latitude));
	const lng = $derived(comoNumero(longitude));
	const tieneUbicacion = $derived(lat !== null && lng !== null);

	function establecer(nuevaLat: number, nuevaLng: number) {
		// Seis decimales son ~11 cm: de sobra para una torre, y evita arrastrar
		// los quince dígitos que devuelve el navegador.
		latitude = nuevaLat.toFixed(6);
		longitude = nuevaLng.toFixed(6);
	}

	function limpiar() {
		latitude = '';
		longitude = '';
		precision = null;
		aviso = null;
	}

	async function usarMiUbicacion() {
		localizando = true;
		aviso = null;
		try {
			const pos = await ubicacionActual();
			establecer(pos.latitude, pos.longitude);
			precision = pos.accuracy;
			// Una posición de ±3 km sirve para centrar el mapa, no para plantar una
			// antena. Decirlo evita que quede guardada como si fuera buena.
			if (pos.accuracy > PRECISION_POBRE_M) {
				aviso = `Posición aproximada (±${Math.round(pos.accuracy)} m). Afínala en el mapa antes de guardar.`;
			}
		} catch (e) {
			aviso = mensajeErrorUbicacion(e);
		} finally {
			localizando = false;
		}
	}

	/**
	 * Acepta un par «lat, lng» pegado de un tirón.
	 *
	 * Es como sale de Google Maps y de casi cualquier GPS, y obligar a partirlo a
	 * mano en dos campos es la clase de fricción por la que un equipo se queda
	 * sin ubicar para siempre.
	 */
	function pegarCoordenadas(e: ClipboardEvent) {
		const texto = e.clipboardData?.getData('text')?.trim() ?? '';
		const par = texto.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
		if (!par) return;

		e.preventDefault();
		latitude = par[1];
		longitude = par[2];
		precision = null;
	}

	const claseInput =
		'mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs font-mono text-neutral-100 placeholder-neutral-600 focus:border-primary-500/40 focus:outline-none';
</script>

<fieldset>
	<legend class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
		Ubicación en el mapa
	</legend>

	<!-- Las dos vías asistidas van primero: teclear coordenadas es el último recurso. -->
	<div class="mt-1.5 flex flex-wrap gap-2">
		<button
			type="button"
			onclick={() => (mapaAbierto = true)}
			class="inline-flex items-center gap-1.5 rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-2 text-xs font-medium text-primary-300 transition-colors hover:bg-primary-500/20"
		>
			<Map class="h-3.5 w-3.5" />
			Elegir en el mapa
		</button>

		<button
			type="button"
			onclick={usarMiUbicacion}
			disabled={localizando}
			title="Toma la posición de este equipo, no la de la antena"
			class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-300 transition-colors hover:border-neutral-700 hover:text-white disabled:opacity-50"
		>
			{#if localizando}
				<Loader2 class="h-3.5 w-3.5 animate-spin" />
				Localizando…
			{:else}
				<Crosshair class="h-3.5 w-3.5" />
				Estoy junto a la antena
			{/if}
		</button>

		{#if tieneUbicacion}
			<button
				type="button"
				onclick={limpiar}
				class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
			>
				<X class="h-3.5 w-3.5" />
				Quitar
			</button>
		{/if}
	</div>

	<!-- Confirmación de lo elegido, para no tener que leer dos campos numéricos. -->
	{#if tieneUbicacion}
		<p class="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-400">
			<MapPin class="h-3 w-3 shrink-0 text-primary-500" />
			<span class="font-mono tabular-nums">{lat?.toFixed(6)}, {lng?.toFixed(6)}</span>
			{#if precision !== null && precision <= PRECISION_POBRE_M}
				<span class="text-neutral-600">±{Math.round(precision)} m</span>
			{/if}
		</p>
	{/if}

	{#if aviso}
		<p role="alert" class="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-300">
			<TriangleAlert class="mt-0.5 h-3 w-3 shrink-0" />
			{aviso}
		</p>
	{/if}

	<!-- Entrada manual: se pliega para no competir con las dos vías de arriba. -->
	<details class="mt-2 group">
		<summary
			class="cursor-pointer list-none text-[11px] text-neutral-500 transition-colors hover:text-neutral-300"
		>
			<span class="group-open:hidden">Escribir las coordenadas a mano</span>
			<span class="hidden group-open:inline">Coordenadas</span>
		</summary>

		<div class="mt-1.5 grid grid-cols-2 gap-3">
			<label class="block">
				<span class="text-[10px] text-neutral-500">Latitud</span>
				<input
					bind:value={latitude}
					onpaste={pegarCoordenadas}
					type="number"
					step="any"
					min="-90"
					max="90"
					placeholder="6.2518"
					class={claseInput}
				/>
			</label>
			<label class="block">
				<span class="text-[10px] text-neutral-500">Longitud</span>
				<input
					bind:value={longitude}
					onpaste={pegarCoordenadas}
					type="number"
					step="any"
					min="-180"
					max="180"
					placeholder="-75.5636"
					class={claseInput}
				/>
			</label>
		</div>
		<p class="mt-1 text-[10px] leading-relaxed text-neutral-600">
			Puedes pegar el par «latitud, longitud» de Google Maps en cualquiera de los dos campos.
		</p>
	</details>

	{#if !tieneUbicacion}
		<p class="mt-2 text-[10px] leading-relaxed text-neutral-600">
			Sin ubicación el equipo aparecerá en «sin ubicar» del
			<a href="/red/mapa" class="text-neutral-500 hover:text-primary-400">mapa</a>.
		</p>
	{/if}
</fieldset>

<ModalMapaUbicacion
	abierto={mapaAbierto}
	latitud={lat}
	longitud={lng}
	centroPorDefecto={centroPorDefecto ?? [4.711, -74.0721]}
	onConfirmar={(nLat, nLng) => {
		establecer(nLat, nLng);
		precision = null;
		aviso = null;
		mapaAbierto = false;
	}}
	onCerrar={() => (mapaAbierto = false)}
/>
