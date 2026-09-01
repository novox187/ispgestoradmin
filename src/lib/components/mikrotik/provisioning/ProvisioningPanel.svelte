<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Radar, RefreshCw, Cable } from '@lucide/svelte';
	import { provisioning } from '$lib/stores/provisioning.svelte';
	import ProvisioningSessionCard from './ProvisioningSessionCard.svelte';

	/**
	 * Panel de altas en curso.
	 *
	 * Vive en la pantalla de Dispositivos porque es donde el operador ya está
	 * mirando: enchufa el equipo y ve aparecer la sesión sin tener que navegar
	 * a otro sitio ni pulsar nada.
	 */

	let { onCompleted }: { onCompleted?: () => void } = $props();

	let lastCompleted = $state(0);

	onMount(() => {
		provisioning.start();
	});

	onDestroy(() => {
		provisioning.stop();
	});

	// Cuando un alta termina bien hay un router nuevo en la tabla de abajo: se
	// avisa al padre para que la recargue en vez de dejarla desactualizada.
	$effect(() => {
		const completed = provisioning.sessions.filter((s) => s.status === 'completed').length;
		if (completed > lastCompleted && lastCompleted !== 0) {
			onCompleted?.();
		}
		lastCompleted = completed;
	});

	const visible = $derived([
		...provisioning.active,
		...provisioning.recentFailures.slice(0, 2),
		...provisioning.sessions.filter((s) => s.status === 'completed').slice(0, 1)
	]);
</script>

<section class="mb-6">
	<div class="flex items-center justify-between mb-3">
		<div class="flex items-center gap-2">
			<Radar
				class="w-4 h-4 {provisioning.active.length > 0
					? 'text-blue-400 animate-pulse'
					: 'text-gray-600'}"
			/>
			<h2 class="text-sm font-mono text-gray-300">Alta automática de dispositivos</h2>
			{#if provisioning.active.length > 0}
				<span
					class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30"
				>
					{provisioning.active.length} en curso
				</span>
			{/if}
		</div>

		<button
			onclick={() => provisioning.refresh()}
			disabled={provisioning.loading}
			class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-700 text-gray-500 hover:text-white hover:border-neutral-600 text-[11px] font-mono transition-colors disabled:opacity-40"
		>
			<RefreshCw class="w-3 h-3 {provisioning.loading ? 'animate-spin' : ''}" />
			Actualizar
		</button>
	</div>

	{#if provisioning.lastError}
		<div
			class="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-300 font-mono"
		>
			{provisioning.lastError}
		</div>
	{:else if visible.length === 0}
		<div
			class="flex items-center gap-3 p-4 rounded-xl bg-neutral-900 border border-neutral-800 border-dashed"
		>
			<Cable class="w-5 h-5 text-neutral-700 shrink-0" />
			<div>
				<p class="text-xs font-mono text-gray-400">
					Conecta un router al puerto de aprovisionamiento y aparecerá aquí.
				</p>
				<p class="text-[11px] text-neutral-600 mt-0.5">
					La detección es automática; no hay que registrar nada a mano.
				</p>
			</div>
		</div>
	{:else}
		<div class="space-y-3">
			{#each visible as session (session.id)}
				<ProvisioningSessionCard {session} onChanged={() => provisioning.refresh()} />
			{/each}
		</div>
	{/if}
</section>
