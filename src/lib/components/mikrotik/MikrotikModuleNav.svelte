<script lang="ts">
	import { page } from '$app/stores';
	import { MIKROTIK_MODULES, type MikrotikModule } from '$lib/mikrotik/modules';
	import { goto } from '$app/navigation';

	function isActive(currentPath: string, href: string) {
		if (href === '/mikrotik') return currentPath === '/mikrotik';
		return currentPath.startsWith(href);
	}

	const current = $derived($page.url.pathname);
	const activeModule = $derived.by((): MikrotikModule | null => {
		const exact = MIKROTIK_MODULES.find((m) => m.href === current);
		if (exact) return exact;
		return MIKROTIK_MODULES.find((m) => m.href !== '/mikrotik' && current.startsWith(m.href)) ?? null;
	});
</script>

<nav aria-label="MikroTik" class="w-full">
	<div class="lg:hidden">
		<div class="flex items-center justify-between gap-3 mb-3">
			<div class="min-w-0">
				<div class="text-sm font-semibold truncate">{activeModule?.label ?? 'MikroTik'}</div>
				<div class="text-xs text-gray-400 truncate">{activeModule?.description ?? ''}</div>
			</div>
			<select
				class="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:ring-0"
				value={activeModule?.href ?? '/mikrotik'}
				onchange={(e) => goto((e.currentTarget as HTMLSelectElement).value)}
				aria-label="Seleccionar sección"
			>
				{#each MIKROTIK_MODULES as m (m.id)}
					<option value={m.href}>
						{m.label}
					</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="hidden lg:block">
		<div class="bg-[#111111] border border-neutral-800 rounded-xl p-3">
			<div class="px-3 pt-2 pb-3">
				<div class="text-xs font-mono text-gray-400 tracking-wide">MIKROTIK</div>
				<div class="text-lg font-semibold text-gray-100">Herramientas</div>
			</div>

			<ul class="space-y-1">
				{#each MIKROTIK_MODULES as m (m.id)}
					<li>
						<a
							href={m.href}
							aria-current={isActive(current, m.href) ? 'page' : undefined}
							class="group flex items-center gap-3 px-3 py-2 rounded-lg border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors
							{isActive(current, m.href)
								? 'bg-blue-500/10 text-blue-200 border-blue-500/20'
								: 'text-gray-300 hover:bg-neutral-800/50 hover:text-gray-100'}"
						>
							<m.icon class="w-4 h-4 opacity-90 group-hover:opacity-100" />
							<div class="min-w-0 flex-1">
								<div class="flex items-center justify-between gap-2">
									<span class="text-sm font-medium truncate">{m.label}</span>
									{#if m.status === 'prototype'}
										<span class="text-[10px] px-2 py-0.5 rounded-full border border-yellow-500/20 bg-yellow-500/10 text-yellow-200">
											Proto
										</span>
									{:else if m.status === 'coming_soon'}
										<span class="text-[10px] px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-900/50 text-gray-300">
											Pronto
										</span>
									{/if}
								</div>
								<span class="block text-[11px] text-gray-500 leading-snug line-clamp-2">
									{m.description}
								</span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</nav>
