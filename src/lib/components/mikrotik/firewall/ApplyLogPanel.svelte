<script lang="ts">
	import { ChevronDown, ChevronUp, RotateCcw, CheckCircle, XCircle, RefreshCw } from '@lucide/svelte';
	import { mikrotikFirewallState } from '$lib/stores/mikrotik-firewall.svelte';
	import { toast } from 'svelte-sonner';

	const props = $props<{ routerId: number | null }>();
	const fw = mikrotikFirewallState;

	let open         = $state(false);
	let currentPage  = $state(1);
	let rollbackId   = $state<number | null>(null);
	let confirmOpen  = $state(false);

	async function load(page = 1) {
		if (!props.routerId) return;
		currentPage = page;
		await fw.loadLogs(props.routerId, page);
	}

	$effect(() => {
		if (open && props.routerId && fw.logs.length === 0) load(1);
	});

	async function doRollback() {
		if (rollbackId === null) return;
		try {
			await fw.rollbackLog(rollbackId);
			toast.success('Rollback aplicado correctamente.');
			await load(currentPage);
		} catch {
			toast.error(fw.apiError ?? 'Error al hacer rollback.');
		} finally {
			confirmOpen = false;
			rollbackId  = null;
		}
	}

	function requestRollback(id: number) {
		rollbackId  = id;
		confirmOpen = true;
	}

	function formatTs(ms: number) {
		try { return new Date(ms).toLocaleString(); } catch { return String(ms); }
	}

	const statusClass: Record<string, string> = {
		success:      'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
		failed:       'border-red-500/20 bg-red-500/10 text-red-300',
		rolled_back:  'border-amber-500/20 bg-amber-500/10 text-amber-300'
	};
	const statusLabel: Record<string, string> = {
		success:     'Exitoso',
		failed:      'Fallido',
		rolled_back: 'Revertido'
	};
</script>

<div class="rounded-xl border border-neutral-800 bg-neutral-900/20">
	<!-- Cabecera colapsable -->
	<button
		type="button"
		class="w-full flex items-center justify-between px-4 py-3 text-left"
		onclick={() => { open = !open; }}
	>
		<div class="flex items-center gap-2">
			<span class="text-xs font-mono text-gray-400 tracking-wide">HISTORIAL DE APLICACIONES</span>
			{#if fw.logsMeta}
				<span class="text-[10px] font-mono px-2 py-0.5 rounded-full border border-neutral-700 text-gray-500">
					{fw.logsMeta.total}
				</span>
			{/if}
		</div>
		{#if open}
			<ChevronUp class="w-4 h-4 text-gray-500" />
		{:else}
			<ChevronDown class="w-4 h-4 text-gray-500" />
		{/if}
	</button>

	{#if open}
		<div class="border-t border-neutral-800 p-4 space-y-3">
			<!-- Toolbar -->
			<div class="flex items-center justify-between gap-2">
				<span class="text-xs text-gray-500">
					{#if fw.logsMeta}
						Página {fw.logsMeta.currentPage} de {fw.logsMeta.lastPage} · {fw.logsMeta.total} registros
					{/if}
				</span>
				<button
					type="button"
					disabled={fw.logsLoading}
					class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors"
					onclick={() => load(currentPage)}
				>
					<RefreshCw class="w-3.5 h-3.5 {fw.logsLoading ? 'animate-spin' : ''}" />
					Actualizar
				</button>
			</div>

			{#if fw.logsLoading}
				<div class="text-xs text-gray-500 py-4 text-center">Cargando historial…</div>
			{:else if fw.logs.length === 0}
				<div class="text-xs text-gray-500 py-4 text-center">Sin registros de apply para este router.</div>
			{:else}
				<div class="overflow-x-auto rounded-xl border border-neutral-800">
					<table class="min-w-[700px] w-full text-xs">
						<thead class="bg-[#121214] text-gray-400">
							<tr>
								<th class="text-left px-4 py-2.5 font-medium">Fecha</th>
								<th class="text-left px-4 py-2.5 font-medium">Estado</th>
								<th class="text-left px-4 py-2.5 font-medium">Filtros</th>
								<th class="text-left px-4 py-2.5 font-medium">NAT</th>
								<th class="text-left px-4 py-2.5 font-medium">Razón</th>
								<th class="text-right px-4 py-2.5 font-medium">Acciones</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-neutral-800 bg-[#0b0b0d]">
							{#each fw.logs as log (log.id)}
								<tr class="hover:bg-neutral-900/40 transition-colors">
									<td class="px-4 py-2.5 text-gray-300 font-mono whitespace-nowrap">
										{formatTs(log.appliedAt)}
									</td>
									<td class="px-4 py-2.5">
										<span class="px-2 py-0.5 rounded-full border font-mono {statusClass[log.status] ?? ''}">
											{statusLabel[log.status] ?? log.status}
										</span>
									</td>
									<td class="px-4 py-2.5 text-gray-400">{log.filterCount}</td>
									<td class="px-4 py-2.5 text-gray-400">{log.natCount}</td>
									<td class="px-4 py-2.5 text-gray-400 max-w-[200px] truncate">
										{log.reason ?? '—'}
									</td>
									<td class="px-4 py-2.5 text-right">
										{#if log.hasBefore}
											<button
												type="button"
												class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 text-xs font-medium transition-colors"
												onclick={() => requestRollback(log.id)}
											>
												<RotateCcw class="w-3 h-3" /> Restaurar
											</button>
										{:else}
											<span class="text-gray-600 text-xs">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Paginación -->
				{#if fw.logsMeta && fw.logsMeta.lastPage > 1}
					<div class="flex items-center justify-center gap-2 pt-1">
						<button
							type="button"
							disabled={currentPage <= 1 || fw.logsLoading}
							class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 text-xs text-gray-300 disabled:opacity-40 transition-colors"
							onclick={() => load(currentPage - 1)}
						>
							← Anterior
						</button>
						<span class="text-xs text-gray-500">{currentPage} / {fw.logsMeta.lastPage}</span>
						<button
							type="button"
							disabled={currentPage >= fw.logsMeta.lastPage || fw.logsLoading}
							class="px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 text-xs text-gray-300 disabled:opacity-40 transition-colors"
							onclick={() => load(currentPage + 1)}
						>
							Siguiente →
						</button>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<!-- Modal de confirmación de rollback -->
{#if confirmOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-[#121214] border border-neutral-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
			<div class="flex items-start gap-3">
				<div class="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
					<RotateCcw class="w-4 h-4 text-amber-400" />
				</div>
				<div>
					<div class="text-sm font-semibold text-gray-100">Restaurar estado anterior</div>
					<div class="text-xs text-gray-400 mt-1 leading-relaxed">
						Se reemplazarán todas las reglas actuales con las del snapshot previo y se aplicarán al router.
						Esta acción también quedará registrada en el historial.
					</div>
				</div>
			</div>
			<div class="flex justify-end gap-2 pt-1">
				<button
					type="button"
					class="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-200 text-xs font-medium transition-colors"
					onclick={() => { confirmOpen = false; rollbackId = null; }}
				>
					Cancelar
				</button>
				<button
					type="button"
					disabled={fw.applying}
					class="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
					onclick={doRollback}
				>
					{fw.applying ? 'Restaurando…' : 'Sí, restaurar'}
				</button>
			</div>
		</div>
	</div>
{/if}
