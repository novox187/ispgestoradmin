<script lang="ts">
	import type { Component } from 'svelte';

	type Accent = 'blue' | 'amber' | 'green' | 'red' | 'neutral';

	const { title, subtitle, icon: Icon, accent, children } = $props<{
		title: string;
		subtitle?: string;
		icon?: Component<any>;
		accent?: Accent;
		children?: any;
	}>();

	function accentClasses(accentValue: Accent) {
		if (accentValue === 'green') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
		if (accentValue === 'amber') return 'bg-amber-500/10 border-amber-500/20 text-amber-200';
		if (accentValue === 'red') return 'bg-red-500/10 border-red-500/20 text-red-200';
		if (accentValue === 'neutral') return 'bg-neutral-800/40 border-neutral-700 text-gray-200';
		return 'bg-blue-500/10 border-blue-500/20 text-blue-200';
	}
</script>

<section class="rounded-2xl border border-white/10 bg-gradient-to-b from-[#141414] to-[#0d0d0d] shadow-xl overflow-hidden">
	<div class="p-5 sm:p-6 border-b border-white/10">
		<div class="flex items-start gap-3">
			<div class="w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 {accentClasses(accent ?? 'blue')}">
				{#if Icon}
					<Icon class="w-5 h-5" />
				{/if}
			</div>
			<div class="min-w-0">
				<h3 class="text-base sm:text-lg font-semibold text-gray-100 truncate">{title}</h3>
				{#if subtitle}
					<p class="text-xs sm:text-sm text-gray-400 leading-relaxed mt-1">{subtitle}</p>
				{/if}
			</div>
		</div>
	</div>
	<div class="p-5 sm:p-6">
		{@render children?.()}
	</div>
</section>
