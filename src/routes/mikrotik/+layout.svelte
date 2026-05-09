<script lang="ts">
	import Encabezado from '$lib/components/Encabezado.svelte';
	import MikrotikModuleNav from '$lib/components/mikrotik/MikrotikModuleNav.svelte';
	import { appState } from '$lib/stores/app.svelte';
	import { page } from '$app/stores';
	import { MIKROTIK_MODULES } from '$lib/mikrotik/modules';

	let { children } = $props();

	function toggleSidebar() {
		appState.toggleSidebar();
	}

	function toggleNotifications() {
		appState.toggleNotifications();
	}

	const current = $derived($page.url.pathname);
	const header = $derived.by(() => {
		const exact = MIKROTIK_MODULES.find((m) => m.href === current);
		if (exact) return exact;
		return MIKROTIK_MODULES.find((m) => m.href !== '/mikrotik' && current.startsWith(m.href)) ?? null;
	});
</script>

<main class="flex-1 overflow-y-auto bg-[#0f0f0f] text-gray-100">
	<Encabezado {toggleSidebar} {toggleNotifications} />

	<div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
		<div class="space-y-1">
			<h2 class="text-xl md:text-3xl font-semibold tracking-tight">MikroTik</h2>
			<p class="text-sm text-gray-400 leading-relaxed">
				{header?.description ?? 'Herramientas operativas y de configuración del router.'}
			</p>
		</div>

		<div class="flex flex-col lg:flex-row gap-4 md:gap-6">
			<div class="lg:w-[360px] w-full">
				<MikrotikModuleNav />
			</div>
			<section class="flex-1 min-w-0">
				{@render children?.()}
			</section>
		</div>
	</div>
</main>

