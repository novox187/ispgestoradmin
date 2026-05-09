<script lang="ts">
	import { Wifi, WifiOff, Loader } from '@lucide/svelte';
	import { mikrotikFirewallState } from '$lib/stores/mikrotik-firewall.svelte';

	const props = $props<{ routerId: number | null }>();
	const fw = mikrotikFirewallState;

	async function check() {
		if (!props.routerId) return;
		await fw.checkRouterStatus(props.routerId);
	}

	$effect(() => {
		if (props.routerId) check();
	});
</script>

<div class="flex items-center gap-2">
	{#if !props.routerId}
		<span class="text-[10px] font-mono tracking-wide px-3 py-1 rounded-full border border-neutral-700 bg-neutral-900/40 text-gray-500">
			Sin router
		</span>
	{:else if fw.routerChecking}
		<span class="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wide px-3 py-1 rounded-full border border-neutral-700 bg-neutral-900/40 text-gray-400">
			<Loader class="w-3 h-3 animate-spin" /> Comprobando…
		</span>
	{:else if fw.routerReachable === true}
		<span class="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wide px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
			<Wifi class="w-3 h-3" /> Conectado{fw.routerLatency !== null ? ` · ${fw.routerLatency}ms` : ''}
		</span>
	{:else if fw.routerReachable === false}
		<span class="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wide px-3 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-300">
			<WifiOff class="w-3 h-3" /> Sin conexión
		</span>
	{/if}

	{#if props.routerId}
		<button
			type="button"
			disabled={fw.routerChecking}
			class="text-[10px] font-mono text-gray-500 hover:text-gray-300 disabled:opacity-40 transition-colors"
			onclick={check}
		>
			↺
		</button>
	{/if}
</div>
