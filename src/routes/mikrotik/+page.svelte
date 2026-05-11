<script lang="ts">
	import { MIKROTIK_MODULES } from '$lib/mikrotik/modules';
	import { ChevronRight, Router, CheckCircle2, Lock } from '@lucide/svelte';

	const available = MIKROTIK_MODULES.filter((m) => m.id !== 'overview' && m.status !== 'coming_soon');
	const comingSoon = MIKROTIK_MODULES.filter((m) => m.id !== 'overview' && m.status === 'coming_soon');
</script>

<div class="px-4 md:px-8 py-8 max-w-5xl">

	<!-- Header de sección -->
	<div class="mb-8">
		<div class="flex items-center gap-2.5 mb-2">
			<Router class="w-5 h-5 text-primary-400" />
			<h2 class="text-lg font-semibold text-neutral-100">Panel MikroTik</h2>
		</div>
		<p class="text-sm text-neutral-500">
			Herramientas operativas para gestionar el router: firewall, sincronización de colas, dispositivos y monitoreo.
		</p>
	</div>

	<!-- Módulos disponibles -->
	{#if available.length > 0}
		<div class="mb-6">
			<p class="text-[10px] font-mono font-semibold text-neutral-600 uppercase tracking-widest mb-3">Disponible</p>
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{#each available as m (m.id)}
					<a
						href={m.href}
						class="group relative flex flex-col p-5 rounded-xl border bg-surface-elevated border-neutral-800/70
						       hover:border-primary-500/40 hover:bg-surface-overlay transition-all duration-200"
					>
						<div class="flex items-start justify-between mb-4">
							<div class="p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/15 group-hover:bg-primary-500/15 transition-colors">
								<m.icon class="w-5 h-5 text-primary-400" />
							</div>
							{#if m.status === 'prototype'}
								<span class="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-warning-900/40 text-warning-400 border border-warning-700/40">
									Prototipo
								</span>
							{/if}
						</div>

						<h3 class="text-sm font-semibold text-neutral-100 mb-1.5 group-hover:text-primary-300 transition-colors">
							{m.label}
						</h3>
						<p class="text-xs text-neutral-500 leading-relaxed flex-1 mb-4">
							{m.description}
						</p>

						<div class="flex items-center gap-1 text-xs font-medium text-primary-400 group-hover:text-primary-300 transition-colors mt-auto">
							Abrir módulo
							<ChevronRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Próximamente -->
	{#if comingSoon.length > 0}
		<div>
			<p class="text-[10px] font-mono font-semibold text-neutral-600 uppercase tracking-widest mb-3">Próximamente</p>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{#each comingSoon as m (m.id)}
					<div
						class="flex flex-col p-4 rounded-xl border border-neutral-800/50 bg-neutral-900/30 opacity-60 cursor-not-allowed"
						title="Este módulo estará disponible próximamente"
					>
						<div class="flex items-start justify-between mb-3">
							<div class="p-2 rounded-lg bg-neutral-800/60">
								<m.icon class="w-4 h-4 text-neutral-600" />
							</div>
							<Lock class="w-3.5 h-3.5 text-neutral-600 mt-0.5" />
						</div>
						<h3 class="text-xs font-semibold text-neutral-500 mb-1">{m.label}</h3>
						<p class="text-[11px] text-neutral-600 leading-relaxed">{m.description}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
