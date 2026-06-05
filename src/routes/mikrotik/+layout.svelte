<script lang="ts">
	import Encabezado from '$lib/components/Encabezado.svelte';
	import { appState } from '$lib/stores/app.svelte';
	import { bootstrap } from '$lib/stores/bootstrap.svelte';
	import { page } from '$app/stores';
	import { MIKROTIK_MODULES, type MikrotikModule } from '$lib/mikrotik/modules';
	import { ChevronRight, Router, Lock } from '@lucide/svelte';

	let { children } = $props();

	function toggleSidebar() {
		appState.toggleSidebar();
	}

	function isActive(href: string) {
		const current = $page.url.pathname;
		if (href === '/mikrotik') return current === '/mikrotik';
		return current.startsWith(href);
	}

	const activeModule = $derived.by(() => {
		const current = $page.url.pathname;
		const exact = MIKROTIK_MODULES.find((m) => m.href === current);
		if (exact) return exact;
		return MIKROTIK_MODULES.find((m) => m.href !== '/mikrotik' && current.startsWith(m.href)) ?? null;
	});

	const breadcrumbs = $derived.by(() => {
		const crumbs = [{ label: 'MikroTik', path: '/mikrotik' }];
		if (activeModule && activeModule.href !== '/mikrotik') {
			crumbs.push({ label: activeModule.label, path: activeModule.href });
		}
		return crumbs;
	});
</script>

<main class="flex-1 overflow-hidden flex flex-col bg-[#0b0b0d] text-gray-100">
	<Encabezado {toggleSidebar} />

	<!-- Breadcrumb -->
	<div class="border-b border-neutral-800/60 bg-[#0b0b0d] px-4 md:px-6 py-2.5">
		<nav class="flex items-center gap-1 text-xs" aria-label="Breadcrumb">
			{#each breadcrumbs as crumb, i}
				{#if i > 0}
					<ChevronRight class="w-3 h-3 text-neutral-600 shrink-0" />
				{/if}
				{#if i < breadcrumbs.length - 1}
					<a href={crumb.path} class="text-neutral-400 hover:text-white transition-colors">
						{crumb.label}
					</a>
				{:else}
					<span class="text-neutral-200 font-medium">{crumb.label}</span>
				{/if}
			{/each}
		</nav>
	</div>

	<!-- Contenido con sub-sidebar -->
	<div class="flex flex-1 overflow-hidden">

		<!-- Sub-sidebar -->
		<aside class="w-56 shrink-0 border-r border-neutral-800/60 bg-[#0b0b0d] overflow-y-auto hidden md:flex flex-col py-3 px-2 gap-4">
			<!-- Header del panel -->
			<div class="px-2 mb-1">
				<div class="flex items-center gap-2 mb-1">
					<Router class="w-4 h-4 text-primary-500" />
					<span class="text-xs font-semibold text-neutral-200 tracking-wide">MikroTik</span>
				</div>
				<p class="text-[10px] text-neutral-500 font-mono">Herramientas del router</p>
			</div>

			<div>
				<div class="px-2 mb-1">
					<span class="text-[9px] font-mono font-semibold text-neutral-600 uppercase tracking-widest">
						Módulos
					</span>
				</div>
				<ul class="space-y-0.5">
					{#each MIKROTIK_MODULES as m (m.id)}
						{@const blockedByBootstrap =
							m.requiresPrimaryRouter && bootstrap.primaryRouterConfigured === false}
						<li>
							{#if m.status === 'coming_soon'}
								<span
									class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-neutral-600 cursor-not-allowed select-none"
									title="Próximamente disponible"
								>
									<m.icon class="w-3.5 h-3.5 shrink-0" />
									<span class="flex-1 truncate">{m.label}</span>
									<Lock class="w-3 h-3 shrink-0" />
								</span>
							{:else if blockedByBootstrap}
								<span
									class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-neutral-600 cursor-not-allowed select-none"
									title="Configure el router principal en Dispositivos para habilitar este módulo"
								>
									<m.icon class="w-3.5 h-3.5 shrink-0" />
									<span class="flex-1 truncate">{m.label}</span>
									<Lock class="w-3 h-3 shrink-0 text-amber-500/70" />
								</span>
							{:else}
								<a
									href={m.href}
									class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150
										{isActive(m.href)
											? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
											: 'text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent'}"
								>
									<m.icon class="w-3.5 h-3.5 shrink-0 {isActive(m.href) ? 'text-primary-400' : ''}" />
									<span class="flex-1 truncate">{m.label}</span>
									{#if m.status === 'prototype'}
										<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning-900/50 text-warning-400 border border-warning-700/40">
											Proto
										</span>
									{/if}
									{#if isActive(m.href)}
										<div class="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0"></div>
									{/if}
								</a>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		</aside>

		<!-- Área de contenido -->
		<div class="flex-1 overflow-y-auto p-1 ms:p-5">
			{@render children?.()}
		</div>
	</div>
</main>
