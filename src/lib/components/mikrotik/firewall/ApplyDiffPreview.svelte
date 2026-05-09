<script lang="ts">
	import { Plus, Minus, Pencil } from '@lucide/svelte';
	import type { SnapshotDiff } from '$lib/types/mikrotik-firewall';

	const props = $props<{ diff: SnapshotDiff }>();

	function chip(
		count: number,
		label: string,
		color: 'green' | 'red' | 'yellow'
	): { count: number; label: string; color: string } | null {
		if (count === 0) return null;
		const colors = {
			green:  'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
			red:    'border-red-500/20 bg-red-500/10 text-red-300',
			yellow: 'border-amber-500/20 bg-amber-500/10 text-amber-300'
		};
		return { count, label, color: colors[color] };
	}

	const filterChips = $derived([
		chip(props.diff.addedFilters,    'nuevo',      'green'),
		chip(props.diff.modifiedFilters, 'modificado', 'yellow'),
		chip(props.diff.removedFilters,  'eliminado',  'red'),
	].filter(Boolean));

	const natChips = $derived([
		chip(props.diff.addedNat,    'nuevo',      'green'),
		chip(props.diff.modifiedNat, 'modificado', 'yellow'),
		chip(props.diff.removedNat,  'eliminado',  'red'),
	].filter(Boolean));
</script>

{#if !props.diff.hasChanges}
	<div class="text-xs text-gray-500 italic">Sin cambios respecto al último apply.</div>
{:else}
	<div class="space-y-2">
		{#if filterChips.length > 0}
			<div class="flex items-center gap-2 flex-wrap">
				<span class="text-[10px] font-mono text-gray-400 w-14 shrink-0">FILTROS</span>
				{#each filterChips as c (c!.label)}
					<span class="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border {c!.color}">
						{c!.count} {c!.label}{c!.count !== 1 ? 's' : ''}
					</span>
				{/each}
			</div>
		{/if}
		{#if natChips.length > 0}
			<div class="flex items-center gap-2 flex-wrap">
				<span class="text-[10px] font-mono text-gray-400 w-14 shrink-0">NAT</span>
				{#each natChips as c (c!.label)}
					<span class="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border {c!.color}">
						{c!.count} {c!.label}{c!.count !== 1 ? 's' : ''}
					</span>
				{/each}
			</div>
		{/if}
	</div>
{/if}
