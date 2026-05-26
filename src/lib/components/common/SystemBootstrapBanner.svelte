<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { AlertTriangle, ArrowRight } from '@lucide/svelte';
	import { bootstrap } from '$lib/stores/bootstrap.svelte';

	// El banner es persistente — no se cierra. Desaparece solo cuando se
	// registra el primer router. Lo ocultamos si ya estamos en la propia
	// página de dispositivos para no estorbar el formulario de creación.
	const isOnDispositivos = $derived($page.url.pathname.startsWith('/mikrotik/dispositivos'));

	const visible = $derived(
		bootstrap.primaryRouterConfigured === false && !isOnDispositivos
	);

	function goToCta() {
		goto(bootstrap.cta.redirect_to);
	}
</script>

{#if visible}
	<div
		role="alert"
		class="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
	>
		<div class="mx-auto flex max-w-7xl items-center gap-3">
			<AlertTriangle class="h-5 w-5 shrink-0 text-amber-400" />
			<div class="flex-1">
				<strong class="font-semibold text-amber-100">Sistema sin router principal.</strong>
				<span class="ml-1 opacity-90">{bootstrap.cta.message}</span>
			</div>
			<button
				type="button"
				onclick={goToCta}
				class="inline-flex items-center gap-1.5 rounded-md bg-amber-500/20 px-3 py-1.5 font-medium text-amber-100 transition hover:bg-amber-500/30"
			>
				{bootstrap.cta.label}
				<ArrowRight class="h-4 w-4" />
			</button>
		</div>
	</div>
{/if}
