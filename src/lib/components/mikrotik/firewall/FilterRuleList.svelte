<script lang="ts">
	import {
		ArrowRight,
		ArrowDown,
		ArrowUp,
		GitBranch,
		GripVertical,
		MessageSquare,
		Network,
		Pencil,
		Power,
		Hash,
		Search,
		SlidersHorizontal,
		Trash2
	} from '@lucide/svelte';
	import type { FirewallFilterAction, FirewallFilterRule } from '$lib/types/mikrotik-firewall';
	import { sortByPriority } from '$lib/utils/mikrotik-firewall-ordering';

	const props = $props<{
		rules: FirewallFilterRule[];
		filterText?: string;
		filterAction?: FirewallFilterAction | '';
		onToggle: (id: string) => void;
		onEdit: (id: string) => void;
		onDelete: (id: string) => void;
		onMove: (id: string, delta: -1 | 1) => void;
		onSetPriority: (id: string, priority: number) => void;
		onSwap: (aId: string, bId: string) => void;
		onFilterTextChange?: (text: string) => void;
		onFilterActionChange?: (action: string) => void;
	}>();

	let draggingId    = $state<string | null>(null);
	let dragOverId    = $state<string | null>(null);
	let priorityDrafts = $state<Record<string, string>>({});

	const sorted = $derived(sortByPriority<FirewallFilterRule>(props.rules));

	const visible = $derived.by(() => {
		const text   = (props.filterText ?? '').toLowerCase().trim();
		const action = props.filterAction ?? '';
		return sorted.filter((r) => {
			if (action && r.action !== action) return false;
			if (!text) return true;
			return (
				r.comment?.toLowerCase().includes(text) ||
				matchText(r).toLowerCase().includes(text) ||
				r.chain.includes(text) ||
				r.action.includes(text) ||
				r.protocol.includes(text)
			);
		});
	});

	function startDrag(id: string, e: DragEvent) {
		draggingId = id;
		try {
			e.dataTransfer?.setData('text/plain', id);
			e.dataTransfer?.setDragImage(new Image(), 0, 0);
		} catch {}
	}

	function handleDrop(targetId: string, e: DragEvent) {
		e.preventDefault();
		const source = e.dataTransfer?.getData('text/plain') || draggingId;
		if (!source || source === targetId) return;
		props.onSwap(source, targetId);
		draggingId = null;
		dragOverId = null;
	}

	function commitPriority(id: string) {
		const raw = (priorityDrafts[id] ?? '').trim();
		if (!raw) { priorityDrafts = { ...priorityDrafts, [id]: '' }; return; }
		const n = Number(raw);
		if (!Number.isFinite(n)) return;
		props.onSetPriority(id, Math.floor(n));
	}

	function matchText(r: FirewallFilterRule) {
		const parts: string[] = [];
		if (r.srcAddress)     parts.push(`src=${r.srcAddress}`);
		if (r.srcAddressList) parts.push(`srcList=${r.srcAddressList}`);
		if (r.dstAddress)     parts.push(`dst=${r.dstAddress}`);
		if (r.inInterface)    parts.push(`in=${r.inInterface}`);
		if (r.outInterface)   parts.push(`out=${r.outInterface}`);
		if (r.srcPort)        parts.push(`sport=${r.srcPort}`);
		if (r.dstPort)        parts.push(`dport=${r.dstPort}`);
		return parts.length ? parts.join(' · ') : 'sin filtros';
	}

	const actionColor: Record<string, string> = {
		accept: 'text-emerald-300',
		drop:   'text-red-300',
		reject: 'text-amber-300'
	};
</script>

<div class="space-y-3">
	{#if props.rules.length === 0}
		<div class="border border-neutral-800 rounded-xl p-4 bg-neutral-900/30 text-sm text-gray-400">
			No hay reglas en esta sección.
		</div>
	{:else}
		<!-- Barra de filtros -->
		<div class="flex flex-wrap items-center gap-2">
			<div class="relative flex-1 min-w-[180px] max-w-xs">
				<Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
				<input
					type="text"
					placeholder="Buscar en reglas…"
					value={props.filterText ?? ''}
					oninput={(e) => props.onFilterTextChange?.((e.currentTarget as HTMLInputElement).value)}
					class="w-full pl-8 pr-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-0"
				/>
			</div>
			<select
				value={props.filterAction ?? ''}
				onchange={(e) => props.onFilterActionChange?.((e.currentTarget as HTMLSelectElement).value)}
				class="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-gray-100 focus:outline-none"
			>
				<option value="">Todas las acciones</option>
				<option value="accept">accept</option>
				<option value="drop">drop</option>
				<option value="reject">reject</option>
			</select>
			{#if visible.length !== sorted.length}
				<span class="text-[10px] font-mono text-gray-500">{visible.length}/{sorted.length} visibles</span>
			{/if}
		</div>

		<div class="overflow-x-auto border border-neutral-800 rounded-xl">
			<table class="min-w-[900px] w-full text-sm">
				<thead class="bg-[#101010] text-gray-300">
					<tr>
						<th class="text-left px-4 py-3 font-medium">
							<span class="inline-flex items-center gap-2"><Hash class="w-4 h-4 text-gray-400" /> Prioridad</span>
						</th>
						<th class="text-left px-4 py-3 font-medium">
							<span class="inline-flex items-center gap-2"><Power class="w-4 h-4 text-gray-400" /> Estado</span>
						</th>
						<th class="text-left px-4 py-3 font-medium">
							<span class="inline-flex items-center gap-2"><GitBranch class="w-4 h-4 text-gray-400" /> Cadena</span>
						</th>
						<th class="text-left px-4 py-3 font-medium">
							<span class="inline-flex items-center gap-2"><ArrowRight class="w-4 h-4 text-gray-400" /> Acción</span>
						</th>
						<th class="text-left px-4 py-3 font-medium">
							<span class="inline-flex items-center gap-2"><Network class="w-4 h-4 text-gray-400" /> Proto</span>
						</th>
						<th class="text-left px-4 py-3 font-medium">
							<span class="inline-flex items-center gap-2"><SlidersHorizontal class="w-4 h-4 text-gray-400" /> Match</span>
						</th>
						<th class="text-left px-4 py-3 font-medium">
							<span class="inline-flex items-center gap-2"><MessageSquare class="w-4 h-4 text-gray-400" /> Comentario</span>
						</th>
						<th class="text-right px-4 py-3 font-medium">
							<span class="inline-flex items-center gap-2 justify-end"><Pencil class="w-4 h-4 text-gray-400" /> Acciones</span>
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-neutral-800 bg-[#0f0f0f]">
					{#if visible.length === 0}
						<tr>
							<td colspan="8" class="px-4 py-6 text-center text-xs text-gray-500">
								Ninguna regla coincide con el filtro aplicado.
							</td>
						</tr>
					{/if}
					{#each visible as r (r.id)}
						<tr
							class="hover:bg-neutral-900/40 transition-colors {dragOverId === r.id ? 'bg-blue-500/5' : ''} {!r.enabled ? 'opacity-50' : ''}"
							draggable="true"
							ondblclick={() => props.onEdit(r.id)}
							ondragstart={(e) => startDrag(r.id, e)}
							ondragover={(e) => { e.preventDefault(); dragOverId = r.id; }}
							ondragleave={() => { if (dragOverId === r.id) dragOverId = null; }}
							ondrop={(e) => handleDrop(r.id, e)}
						>
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<button
										type="button"
										class="p-2 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/70 text-gray-200 cursor-grab active:cursor-grabbing"
										title="Arrastrar para reordenar"
										onclick={(e) => e.preventDefault()}
									>
										<GripVertical class="w-4 h-4 text-gray-400" />
									</button>
									<div class="flex items-center gap-2">
										<input
											type="number"
											min="1"
											class="w-16 px-2 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 text-gray-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
											value={priorityDrafts[r.id] ?? String(r.priority)}
											oninput={(e) => { priorityDrafts = { ...priorityDrafts, [r.id]: (e.currentTarget as HTMLInputElement).value }; }}
											onblur={() => commitPriority(r.id)}
										/>
										<div class="flex flex-col gap-0.5">
											<button type="button" class="p-1 rounded border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/70 text-gray-300" onclick={() => props.onMove(r.id, -1)}><ArrowUp class="w-3 h-3" /></button>
											<button type="button" class="p-1 rounded border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/70 text-gray-300" onclick={() => props.onMove(r.id, 1)}><ArrowDown class="w-3 h-3" /></button>
										</div>
									</div>
								</div>
							</td>
							<td class="px-4 py-3">
								<button
									type="button"
									class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border
									{r.enabled ? 'text-green-300 border-green-500/20 bg-green-500/10' : 'text-gray-400 border-neutral-700 bg-neutral-900/40'}"
									onclick={() => props.onToggle(r.id)}
								>
									<Power class="w-3 h-3" />
									{r.enabled ? 'ON' : 'OFF'}
								</button>
							</td>
							<td class="px-4 py-3">
								<span class="font-mono text-xs text-gray-300">{r.chain}</span>
							</td>
							<td class="px-4 py-3">
								<span class="font-mono text-xs font-semibold {actionColor[r.action] ?? 'text-gray-300'}">{r.action}</span>
							</td>
							<td class="px-4 py-3">
								<span class="font-mono text-xs text-gray-400">{r.protocol}</span>
							</td>
							<td class="px-4 py-3 text-xs text-gray-300">{matchText(r)}</td>
							<td class="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate" title={r.comment ?? ''}>{r.comment ?? '—'}</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1.5">
									<button
										type="button"
										class="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-100 text-xs font-medium transition-colors inline-flex items-center gap-1.5"
										onclick={() => props.onEdit(r.id)}
									>
										<Pencil class="w-3.5 h-3.5" /> Editar
									</button>
									<button
										type="button"
										class="px-2.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-medium transition-colors inline-flex items-center gap-1.5"
										onclick={() => props.onDelete(r.id)}
									>
										<Trash2 class="w-3.5 h-3.5" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
