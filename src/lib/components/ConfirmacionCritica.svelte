<script lang="ts">
	/**
	 * Confirmación de una acción que rompe algo y cuesta deshacer.
	 *
	 * Tres frenos, y los tres hacen falta:
	 *
	 * 1. **Contar qué va a pasar**, en concreto y no en abstracto. «¿Seguro?» no
	 *    informa de nada; «el agente dejará de responder y habrá que reinstalarlo
	 *    en la máquina donde vive» sí.
	 * 2. **La contraseña**, que además la exige el servidor. Aquí frena el clic
	 *    accidental; allí frena a quien se encuentre una sesión abierta.
	 * 3. **Nada preseleccionado ni enfocado en el botón peligroso**: el foco
	 *    entra en el campo de la contraseña, así que un Enter de más no ejecuta.
	 */
	import { TriangleAlert, X } from '@lucide/svelte';

	interface Props {
		/** Qué se va a hacer, en imperativo: «Eliminar el agente». */
		titulo: string;
		/** Sobre qué. Se muestra destacado para que no haya duda del objetivo. */
		objetivo: string;
		/** Qué ocurrirá. Una consecuencia por línea, concretas. */
		consecuencias: string[];
		/** Texto del botón que ejecuta. Repite el verbo, no dice «Aceptar». */
		etiquetaAccion: string;
		/** Si es irreversible se avisa aparte; si no, se dice cómo deshacerlo. */
		reversible?: string | null;
		ejecutando?: boolean;
		onconfirmar: (password: string) => void;
		oncancelar: () => void;
	}

	let {
		titulo,
		objetivo,
		consecuencias,
		etiquetaAccion,
		reversible = null,
		ejecutando = false,
		onconfirmar,
		oncancelar
	}: Props = $props();

	let password = $state('');
	let campo = $state<HTMLInputElement | null>(null);

	$effect(() => {
		campo?.focus();
	});
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="confirmacion-titulo"
>
	<div class="w-full max-w-md rounded-xl border border-red-500/25 bg-[#0f0f12] p-5">
		<div class="mb-3 flex items-start justify-between gap-3">
			<div class="flex items-start gap-2.5">
				<TriangleAlert class="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
				<div>
					<h2 id="confirmacion-titulo" class="text-sm font-semibold text-neutral-100">
						{titulo}
					</h2>
					<p class="mt-0.5 font-mono text-[11px] text-neutral-400">{objetivo}</p>
				</div>
			</div>
			<button
				onclick={oncancelar}
				disabled={ejecutando}
				class="rounded p-1 text-neutral-500 hover:text-white disabled:opacity-40"
				aria-label="Cancelar"
			>
				<X class="h-4 w-4" />
			</button>
		</div>

		<div class="rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3">
			<p class="text-[10px] font-mono uppercase tracking-widest text-red-400/80">Qué va a pasar</p>
			<ul class="mt-1.5 space-y-1">
				{#each consecuencias as c}
					<li class="flex gap-1.5 text-xs text-neutral-300">
						<span class="text-red-400/60">·</span>
						<span>{c}</span>
					</li>
				{/each}
			</ul>
		</div>

		{#if reversible}
			<p class="mt-2 text-[11px] text-neutral-500">{reversible}</p>
		{/if}

		<form
			onsubmit={(e) => {
				e.preventDefault();
				if (password) onconfirmar(password);
			}}
			class="mt-4"
		>
			<label class="block">
				<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
					Confirma con tu contraseña
				</span>
				<input
					bind:this={campo}
					bind:value={password}
					type="password"
					required
					autocomplete="current-password"
					disabled={ejecutando}
					class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-red-500/40 focus:outline-none disabled:opacity-50"
				/>
			</label>

			<div class="mt-4 flex justify-end gap-2">
				<button
					type="button"
					onclick={oncancelar}
					disabled={ejecutando}
					class="rounded-lg border border-neutral-800 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800/60 disabled:opacity-40"
				>
					Cancelar
				</button>
				<button
					type="submit"
					disabled={ejecutando || password.length === 0}
					class="rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-2 text-xs text-red-300 hover:bg-red-500/25 disabled:opacity-40"
				>
					{ejecutando ? 'Ejecutando…' : etiquetaAccion}
				</button>
			</div>
		</form>
	</div>
</div>
