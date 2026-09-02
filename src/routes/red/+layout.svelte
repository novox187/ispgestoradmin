<script lang="ts">
	import Encabezado from '$lib/components/Encabezado.svelte';
	import { appState } from '$lib/stores/app.svelte';
	import { bootstrap } from '$lib/stores/bootstrap.svelte';
	import { page } from '$app/stores';
	import {
		NETWORK_GROUPS,
		NETWORK_MODULES,
		moduleForPath,
		type NetworkModule
	} from '$lib/red/modules';
	import { Lock, Network } from '@lucide/svelte';

	let { children } = $props();

	function toggleSidebar() {
		appState.toggleSidebar();
	}

	const activeModule = $derived(moduleForPath($page.url.pathname));

	/**
	 * Sin router principal, los módulos de RouterOS no tienen sobre qué operar.
	 * Se bloquean aquí en vez de dejar que la pantalla pida datos y reciba un
	 * 423, que es lo que hacía antes de que existiera el estado de bootstrap.
	 */
	function bloqueado(m: NetworkModule): boolean {
		if (m.status === 'coming_soon') return true;
		return !!m.requiresPrimaryRouter && bootstrap.primaryRouterConfigured === false;
	}

	function motivoBloqueo(m: NetworkModule): string {
		if (m.status === 'coming_soon') return 'Próximamente disponible';
		return 'Necesita un router principal configurado en Dispositivos';
	}

	const grupos = $derived(
		NETWORK_GROUPS.map((g) => ({
			...g,
			modules: NETWORK_MODULES.filter((m) => m.group === g.id)
		})).filter((g) => g.modules.length > 0)
	);
</script>

<main class="flex-1 overflow-hidden flex flex-col bg-[#0b0b0d] text-gray-100">
	<Encabezado {toggleSidebar} />

	<div class="flex flex-1 overflow-hidden">
		<!--
			Sub-navegación agrupada. Los grupos sustituyen a la antigua división en
			dos secciones del menú principal: siguen separando lo que vale para todo
			el parque de lo que solo aplica a RouterOS, pero sin obligar a salir de
			la sección para cruzar de un lado al otro.
		-->
		<aside
			class="w-56 shrink-0 border-r border-neutral-800/60 bg-[#0b0b0d] overflow-y-auto hidden md:flex flex-col py-3 px-2 gap-4"
			aria-label="Módulos de red"
		>
			<div class="px-2">
				<div class="flex items-center gap-2">
					<Network class="w-4 h-4 text-primary-500" />
					<span class="text-xs font-semibold text-neutral-200 tracking-wide">Red</span>
				</div>
				<p class="text-[10px] text-neutral-500 font-mono mt-0.5">Parque, RouterOS y altas</p>
			</div>

			{#each grupos as grupo (grupo.id)}
				<div>
					<div class="px-2 mb-1 flex items-baseline justify-between gap-2">
						<span
							class="text-[9px] font-mono font-semibold text-neutral-600 uppercase tracking-widest"
						>
							{grupo.label}
						</span>
						<span class="text-[9px] text-neutral-700 truncate">{grupo.hint}</span>
					</div>
					<ul class="space-y-0.5">
						{#each grupo.modules as m (m.id)}
							{@const activo = activeModule?.id === m.id}
							<li>
								{#if bloqueado(m)}
									<span
										class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-neutral-600 cursor-not-allowed select-none"
										title={motivoBloqueo(m)}
									>
										<m.icon class="w-3.5 h-3.5 shrink-0" />
										<span class="flex-1 truncate">{m.label}</span>
										<Lock
											class="w-3 h-3 shrink-0 {m.status === 'coming_soon'
												? ''
												: 'text-amber-500/70'}"
										/>
									</span>
								{:else}
									<a
										href={m.href}
										aria-current={activo ? 'page' : undefined}
										class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors duration-150
											{activo
											? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
											: 'text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent'}"
									>
										<m.icon class="w-3.5 h-3.5 shrink-0 {activo ? 'text-primary-400' : ''}" />
										<span class="flex-1 truncate">{m.label}</span>
										{#if m.status === 'prototype'}
											<span
												class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-warning-900/50 text-warning-400 border border-warning-700/40"
											>
												Proto
											</span>
										{/if}
										{#if activo}
											<div class="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0"></div>
										{/if}
									</a>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</aside>

		<div class="flex-1 overflow-y-auto">
			<!--
				En móvil el sub-sidebar no cabe, y antes simplemente desaparecía: se
				entraba a un módulo y no había forma de cambiar a otro sin volver al
				menú principal. Esta tira lo sustituye.
			-->
			<nav
				class="md:hidden border-b border-neutral-800/60 overflow-x-auto"
				aria-label="Módulos de red"
			>
				<ul class="flex gap-1 px-3 py-2 w-max">
					{#each NETWORK_MODULES as m (m.id)}
						{@const activo = activeModule?.id === m.id}
						<li>
							{#if bloqueado(m)}
								<span
									class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-neutral-600"
									title={motivoBloqueo(m)}
								>
									<m.icon class="w-3.5 h-3.5" />
									{m.label}
									<Lock class="w-3 h-3" />
								</span>
							{:else}
								<a
									href={m.href}
									aria-current={activo ? 'page' : undefined}
									class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors
										{activo
										? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
										: 'text-neutral-400 border border-transparent hover:bg-neutral-800/60'}"
								>
									<m.icon class="w-3.5 h-3.5" />
									{m.label}
								</a>
							{/if}
						</li>
					{/each}
				</ul>
			</nav>

			<!--
				Encabezado único de la sección. Antes cada pantalla repetía su propio
				`<h1>` y su bajada, y encima la migaja de pan decía lo mismo una
				tercera vez sobre una jerarquía de solo dos niveles.

				Va como `<h2>` porque el `<h1>` de la página lo pone `Encabezado`, que
				rotula la sección entera.
			-->
			{#if activeModule}
				{@const IconoActivo = activeModule.icon}
				<header class="px-4 md:px-6 pt-5 pb-1">
					<div class="flex items-center gap-2.5">
						<IconoActivo class="w-4 h-4 text-primary-500 shrink-0" />
						<h2 class="text-lg font-semibold text-neutral-100">{activeModule.label}</h2>
						{#if activeModule.group === 'routeros'}
							<span
								class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-400 border border-neutral-700/60"
								title="Este módulo solo opera sobre routers MikroTik"
							>
								RouterOS
							</span>
						{/if}
					</div>
					<p class="text-xs text-neutral-500 mt-1 max-w-2xl">{activeModule.description}</p>
				</header>
			{/if}

			<div class="p-4 md:p-6">
				{@render children?.()}
			</div>
		</div>
	</div>
</main>
