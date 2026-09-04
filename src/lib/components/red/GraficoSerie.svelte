<script lang="ts">
	/**
	 * Gráfico de una métrica en el tiempo.
	 *
	 * Es un SVG a mano y no una biblioteca de gráficos porque el panel no tiene
	 * ninguna, y meter una —con su tema, su tipografía y su paleta— para dibujar
	 * cuatro líneas costaría más en peso y en desajuste visual de lo que ahorra.
	 *
	 * ## Los huecos se dibujan como huecos
	 *
	 * Una lectura que falta NO se une con la siguiente por una recta. Ese tramo
	 * es justo el momento en que el equipo no respondió, que es lo que se está
	 * buscando cuando alguien abre esta pantalla; interpolarlo lo borraría del
	 * gráfico y dejaría una línea sana sobre una caída real.
	 */

	type Punto = {
		t: string | null;
		v: number | null;
		/** Solo en resolución horaria: el rango real dentro de esa hora. */
		min?: number | null;
		max?: number | null;
	};

	const {
		puntos,
		titulo,
		unidad = '',
		color = '#38bdf8',
		dominio = null,
		decimales = 0
	} = $props<{
		puntos: Punto[];
		titulo: string;
		unidad?: string;
		color?: string;
		/** Fuerza la escala vertical. Útil en porcentajes, donde el 0-100 fijo
		 *  evita que una variación de dos puntos parezca un desplome. */
		dominio?: [number, number] | null;
		decimales?: number;
	}>();

	const ALTO = 150;
	const MARGEN = { arriba: 10, derecha: 8, abajo: 18, izquierda: 38 };

	let ancho = $state(600);
	let indiceActivo = $state<number | null>(null);

	const conValor = $derived(puntos.filter((p: Punto) => p.v !== null));

	/**
	 * Escala vertical. Si no se fuerza, se ajusta a los datos con un margen del
	 * 10 %: una señal que se mueve entre -68 y -72 dBm tiene que verse moverse, y
	 * con una escala de 0 a -100 sería una raya plana.
	 */
	const rango = $derived.by(() => {
		if (dominio) return dominio;
		if (conValor.length === 0) return [0, 1] as [number, number];

		const valores = conValor.flatMap((p: Punto) =>
			[p.v, p.min, p.max].filter((v): v is number => v !== null && v !== undefined)
		);

		const min = Math.min(...valores);
		const max = Math.max(...valores);
		const holgura = (max - min) * 0.1 || Math.abs(max * 0.1) || 1;

		// La holgura no puede empujar el suelo por debajo de cero en una métrica
		// que no admite negativos: un eje que empieza en «-0,02 Mbps» de caudal
		// hace dudar del dato entero.
		const suelo = min >= 0 ? Math.max(0, min - holgura) : min - holgura;

		return [suelo, max + holgura] as [number, number];
	});

	const anchoUtil = $derived(Math.max(1, ancho - MARGEN.izquierda - MARGEN.derecha));
	const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;

	function x(i: number): number {
		const paso = puntos.length > 1 ? anchoUtil / (puntos.length - 1) : 0;
		return MARGEN.izquierda + i * paso;
	}

	function y(valor: number): number {
		const [min, max] = rango;
		const proporcion = max === min ? 0.5 : (valor - min) / (max - min);
		return MARGEN.arriba + altoUtil - proporcion * altoUtil;
	}

	/**
	 * Trazado partido en tramos: cada corte es una lectura que falta.
	 *
	 * El relleno se cierra contra el suelo de SU tramo y no del gráfico entero,
	 * porque si no un hueco de tres horas quedaría pintado igual que un tramo con
	 * datos.
	 */
	const tramos = $derived.by(() => {
		const salida: { linea: string; area: string }[] = [];
		let actual: { x: number; y: number }[] = [];
		const suelo = MARGEN.arriba + altoUtil;

		const cerrar = () => {
			if (actual.length < 2) {
				actual = [];
				return;
			}
			const linea = actual.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
			const primero = actual[0];
			const ultimo = actual[actual.length - 1];
			salida.push({ linea, area: `${linea} L${ultimo.x},${suelo} L${primero.x},${suelo} Z` });
			actual = [];
		};

		puntos.forEach((p: Punto, i: number) => {
			if (p.v === null) {
				cerrar();
				return;
			}
			actual.push({ x: Number(x(i).toFixed(1)), y: Number(y(p.v).toFixed(1)) });
		});

		cerrar();

		return salida;
	});

	/** Banda min-max de la resolución horaria: donde de verdad estuvo el enlace. */
	const banda = $derived.by(() => {
		const conBanda = puntos
			.map((p: Punto, i: number) => ({ p, i }))
			.filter(({ p }: { p: Punto }) => p.min !== null && p.min !== undefined && p.max !== null);

		if (conBanda.length < 2) return null;

		const arriba = conBanda.map(({ p, i }: { p: Punto; i: number }) => `${x(i).toFixed(1)},${y(p.max as number).toFixed(1)}`);
		const abajo = [...conBanda]
			.reverse()
			.map(({ p, i }: { p: Punto; i: number }) => `${x(i).toFixed(1)},${y(p.min as number).toFixed(1)}`);

		return `M${arriba.join(' L')} L${abajo.join(' L')} Z`;
	});

	const marcas = $derived.by(() => {
		const [min, max] = rango;
		return [max, (max + min) / 2, min].map((v) => ({ v, y: y(v) }));
	});

	function alMover(e: MouseEvent) {
		const caja = (e.currentTarget as SVGElement).getBoundingClientRect();
		const relativo = ((e.clientX - caja.left) / caja.width) * ancho;
		const paso = puntos.length > 1 ? anchoUtil / (puntos.length - 1) : 1;
		const i = Math.round((relativo - MARGEN.izquierda) / paso);

		indiceActivo = i >= 0 && i < puntos.length ? i : null;
	}

	function hora(iso: string | null): string {
		if (!iso) return '';
		return new Date(iso).toLocaleString('es', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	const activo = $derived(indiceActivo === null ? null : puntos[indiceActivo]);
	const id = `grad-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-3">
	<div class="flex items-baseline justify-between gap-2 mb-1">
		<h4 class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{titulo}</h4>
		{#if activo && activo.v !== null}
			<span class="text-[10px] font-mono text-neutral-400">
				{hora(activo.t)} · <span style="color:{color}">{activo.v.toFixed(decimales)}{unidad}</span>
			</span>
		{/if}
	</div>

	{#if conValor.length === 0}
		<!-- Sin datos no se dibuja un cero: sería una línea plana en el suelo, que
		     se lee como un enlace muerto y no como una serie vacía. -->
		<p class="flex h-[150px] items-center justify-center text-[11px] text-neutral-600">
			Sin lecturas en este periodo
		</p>
	{:else}
		<div bind:clientWidth={ancho}>
			<svg
				viewBox="0 0 {ancho} {ALTO}"
				width="100%"
				height={ALTO}
				role="img"
				aria-label={titulo}
				onmousemove={alMover}
				onmouseleave={() => (indiceActivo = null)}
			>
				<defs>
					<linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color={color} stop-opacity="0.25" />
						<stop offset="100%" stop-color={color} stop-opacity="0" />
					</linearGradient>
				</defs>

				{#each marcas as marca (marca.v)}
					<line
						x1={MARGEN.izquierda}
						x2={ancho - MARGEN.derecha}
						y1={marca.y}
						y2={marca.y}
						stroke="#2a2a2e"
						stroke-width="1"
					/>
					<text x="4" y={marca.y + 3} fill="#6a6a70" font-size="9" font-family="monospace">
						{marca.v.toFixed(decimales)}
					</text>
				{/each}

				{#if banda}
					<path d={banda} fill={color} fill-opacity="0.12" />
				{/if}

				{#each tramos as tramo, i (i)}
					<path d={tramo.area} fill="url(#{id})" />
					<path
						d={tramo.linea}
						fill="none"
						stroke={color}
						stroke-width="1.5"
						stroke-linejoin="round"
					/>
				{/each}

				{#if activo && activo.v !== null && indiceActivo !== null}
					<line
						x1={x(indiceActivo)}
						x2={x(indiceActivo)}
						y1={MARGEN.arriba}
						y2={MARGEN.arriba + altoUtil}
						stroke="#45454b"
						stroke-width="1"
					/>
					<circle cx={x(indiceActivo)} cy={y(activo.v)} r="3" fill={color} />
				{/if}
			</svg>
		</div>
	{/if}
</div>
