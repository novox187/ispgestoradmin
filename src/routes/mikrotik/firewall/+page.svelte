<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import ModalConfirmacion from '$lib/components/common/ModalConfirmacion.svelte';
	import FilterRuleForm from '$lib/components/mikrotik/firewall/FilterRuleForm.svelte';
	import FilterRuleList from '$lib/components/mikrotik/firewall/FilterRuleList.svelte';
	import NatRuleForm from '$lib/components/mikrotik/firewall/NatRuleForm.svelte';
	import NatRuleList from '$lib/components/mikrotik/firewall/NatRuleList.svelte';
	import RouterStatusBadge from '$lib/components/mikrotik/firewall/RouterStatusBadge.svelte';
	import ApplyDiffPreview from '$lib/components/mikrotik/firewall/ApplyDiffPreview.svelte';
	import ApplyLogPanel from '$lib/components/mikrotik/firewall/ApplyLogPanel.svelte';
	import { mikrotikFirewallState } from '$lib/stores/mikrotik-firewall.svelte';
	import { fetchMikrotikRouters, type MikrotikRouterSummary } from '$lib/api/mikrotik-routers';
	import type {
		FirewallFilterAction,
		FirewallFilterChain,
		FirewallFilterRule,
		FirewallNatAction,
		FirewallNatRule,
		ValidationIssue
	} from '$lib/types/mikrotik-firewall';
	import { analyzeFirewallConflicts, sortByPriority, type FirewallConflict } from '$lib/utils/mikrotik-firewall-ordering';
	import { AlertTriangle, CheckCircle } from '@lucide/svelte';

	const ROUTER_KEY = 'ispga_mikrotik_selected_router_id';

	let activeFilterChain = $state<FirewallFilterChain>('input');
	let activeSection     = $state<'filters' | 'nat'>('filters');

	// Routers
	let routers          = $state<MikrotikRouterSummary[]>([]);
	let selectedRouterId = $state<number | null>(null);
	let routersLoading   = $state(false);
	let applyReason      = $state('');

	// Filtros de búsqueda
	let filterText   = $state('');
	let filterAction = $state('');
	let natText      = $state('');
	let natAction    = $state('');

	// Modal eliminar
	let confirmOpen      = $state(false);
	let confirmTitle     = $state('');
	let confirmMessage   = $state('');
	let confirmSecondary = $state('');
	let confirmType      = $state<'danger' | 'warning' | 'info' | 'success'>('warning');
	let confirmLoading   = $state(false);
	let confirmError     = $state<string | null>(null);
	let pendingDelete: { kind: 'filter' | 'nat'; id: string } | null = $state(null);

	// Modal apply con validación + diff
	let applyModalOpen      = $state(false);
	let applyValidating     = $state(false);
	let validationCollapsed = $state(false);

	// Merge desde router
	let mergeModalOpen = $state(false);

	// Conflictos colapsables (colapsados por defecto)
	let conflictsFilterCollapsed = $state(true);
	let conflictsNatCollapsed    = $state(true);

	let editingFilterId = $state<string | null>(null);
	let editingNatId    = $state<string | null>(null);

	const fw = mikrotikFirewallState;
	const snapshot        = $derived(fw.snapshot);
	const filtersForChain = $derived(sortByPriority(snapshot.filters.filter((r) => r.chain === activeFilterChain)));
	const natSorted       = $derived(sortByPriority(snapshot.nat));
	const conflictsForChain = $derived(analyzeFirewallConflicts(filtersForChain));
	const conflictsNat      = $derived(analyzeFirewallConflicts(natSorted));
	const totalFilters   = $derived(snapshot.filters.length);
	const totalNat       = $derived(snapshot.nat.length);
	const enabledFilters = $derived(snapshot.filters.filter((r) => r.enabled).length);
	const enabledNat     = $derived(snapshot.nat.filter((r) => r.enabled).length);
	const canInteract    = $derived(selectedRouterId !== null);
	const diff           = $derived(fw.computeDiff());

	const editingFilter = $derived.by((): FirewallFilterRule | null =>
		editingFilterId ? snapshot.filters.find((r) => r.id === editingFilterId) ?? null : null
	);
	const editingNat = $derived.by((): FirewallNatRule | null =>
		editingNatId ? snapshot.nat.find((r) => r.id === editingNatId) ?? null : null
	);

	function formatTs(ts: number | null) {
		if (!ts) return '—';
		try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
	}

	onMount(async () => {
		routersLoading = true;
		try {
			routers = await fetchMikrotikRouters();
		} catch {
			toast.error('No se pudo obtener la lista de routers.');
		} finally {
			routersLoading = false;
		}

		const cached   = typeof localStorage !== 'undefined' ? localStorage.getItem(ROUTER_KEY) : null;
		const cachedId = cached ? Number(cached) : null;
		if (cachedId && routers.some((r) => r.id === cachedId)) {
			selectedRouterId = cachedId;
		} else if (routers.length === 1) {
			selectedRouterId = routers[0].id;
		}

		fw.loadFromStorage();

		if (selectedRouterId && !fw.snapshot.appliedAt) {
			await fw.loadFromApi(selectedRouterId);
		}
	});

	async function handleLoadFromApi() {
		if (!selectedRouterId) return;
		await fw.loadFromApi(selectedRouterId);
		if (fw.apiError) toast.error(fw.apiError);
		else toast.success('Snapshot cargado desde el backend.');
	}

	// ── Apply con validación previa ──────────────────────────────────────────

	async function openApplyModal() {
		if (!selectedRouterId) return;
		applyModalOpen  = true;
		applyValidating = true;
		try {
			await fw.validateSnapshot(selectedRouterId);
		} catch {
			// la validación es opcional — se muestra el modal igual
		} finally {
			applyValidating = false;
		}
	}

	async function confirmApply() {
		if (!selectedRouterId) return;
		applyModalOpen = false;
		try {
			await fw.applyToApi(selectedRouterId, applyReason);
			toast.success('Cambios aplicados al router.');
			applyReason = '';
			// Refrescar historial si está abierto
			if (selectedRouterId) fw.loadLogs(selectedRouterId, 1);
		} catch {
			toast.error(fw.apiError ?? 'Error al aplicar los cambios.');
		}
	}

	// ── Auto-corrección de advertencias ─────────────────────────────────────

	function canAutoFix(issue: ValidationIssue): boolean {
		return issue.field === 'protocol' || issue.field === 'toAddresses';
	}

	function autoFixLabel(issue: ValidationIssue): string {
		if (issue.field === 'protocol') return 'Establecer TCP';
		if (issue.field === 'toAddresses') return 'Editar regla';
		return 'Corregir';
	}

	async function applyFix(issue: ValidationIssue) {
		const isFilter = fw.snapshot.filters.some((r) => r.id === issue.ruleId);
		const isNat    = fw.snapshot.nat.some((r) => r.id === issue.ruleId);

		if (issue.field === 'protocol') {
			if (isFilter) fw.updateFilterRule(issue.ruleId, { protocol: 'tcp' });
			else if (isNat) fw.updateNatRule(issue.ruleId, { protocol: 'tcp' });
			// Re-validar después de corregir
			if (selectedRouterId) {
				applyValidating = true;
				try { await fw.validateSnapshot(selectedRouterId); }
				finally { applyValidating = false; }
			}
		} else if (issue.field === 'toAddresses') {
			// Navegar a editar la regla NAT
			applyModalOpen = false;
			activeSection  = 'nat';
			editingNatId   = issue.ruleId;
		}
	}

	// ── Merge desde router ───────────────────────────────────────────────────

	async function doMerge() {
		if (!selectedRouterId) return;
		mergeModalOpen = false;
		try {
			const { added } = await fw.mergeFromRouter(selectedRouterId);
			toast.success(`${added} regla(s) importada(s) desde el router.`);
		} catch {
			toast.error(fw.apiError ?? 'Error al importar desde el router.');
		}
	}

	// ── Eliminar ─────────────────────────────────────────────────────────────

	function requestDelete(kind: 'filter' | 'nat', id: string) {
		pendingDelete    = { kind, id };
		confirmTitle     = kind === 'filter' ? 'Eliminar regla de filtro' : 'Eliminar regla NAT';
		confirmMessage   = 'Esta acción elimina la regla del borrador actual.';
		confirmSecondary = 'Recuerda aplicar los cambios al router para que tengan efecto.';
		confirmType      = 'danger';
		confirmError     = null;
		confirmOpen      = true;
	}

	async function confirmDelete() {
		if (!pendingDelete || confirmLoading) return;
		confirmLoading = true;
		confirmError   = null;
		try {
			if (pendingDelete.kind === 'filter') fw.deleteFilterRule(pendingDelete.id);
			else fw.deleteNatRule(pendingDelete.id);
			toast.success('Regla eliminada.');
			confirmOpen   = false;
			pendingDelete = null;
		} catch (e) {
			confirmError = e instanceof Error ? e.message : 'Error inesperado';
		} finally {
			confirmLoading = false;
		}
	}

	// ── Conflictos ───────────────────────────────────────────────────────────

	function summarizeConflicts(conflicts: FirewallConflict[]): string {
		const dup  = conflicts.filter((c) => c.kind === 'duplicate').length;
		const con  = conflicts.filter((c) => c.kind === 'contradiction').length;
		const sha  = conflicts.filter((c) => c.kind === 'shadowed').length;
		const parts: string[] = [];
		if (dup)  parts.push(`${dup} duplicado${dup  > 1 ? 's' : ''}`);
		if (con)  parts.push(`${con} contradicción${con > 1 ? 'es' : ''}`);
		if (sha)  parts.push(`${sha} shadowing`);
		return parts.join(' · ');
	}

	function fixConflict(c: FirewallConflict, section: 'filter' | 'nat') {
		if (!c.secondaryRuleId) return;
		if (c.kind === 'duplicate') {
			if (section === 'filter') { fw.deleteFilterRule(c.secondaryRuleId); toast.success('Regla duplicada eliminada.'); }
			else                      { fw.deleteNatRule(c.secondaryRuleId);    toast.success('Regla NAT duplicada eliminada.'); }
		} else {
			if (section === 'filter') editingFilterId = c.secondaryRuleId;
			else                      editingNatId    = c.secondaryRuleId;
		}
	}

	function fixAllDuplicates(conflicts: FirewallConflict[], section: 'filter' | 'nat') {
		const dups = conflicts.filter((c) => c.kind === 'duplicate' && c.secondaryRuleId);
		for (const c of dups) {
			if (section === 'filter') fw.deleteFilterRule(c.secondaryRuleId!);
			else                      fw.deleteNatRule(c.secondaryRuleId!);
		}
		if (dups.length) toast.success(`${dups.length} regla(s) duplicada(s) eliminada(s).`);
	}

	async function exportSnapshot() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
			toast.success('Snapshot copiado al portapapeles.');
		} catch {
			toast.info('No se pudo copiar. Revisa permisos del navegador.');
		}
	}
</script>

<div class="space-y-4">

	<!-- Header card -->
	<div class="bg-[#121214] border border-neutral-800 rounded-xl p-5 space-y-4">

		<div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
			<div class="space-y-1">
				<div class="text-xs font-mono text-gray-400 tracking-wide">MIKROTIK / FIREWALL</div>
				<h3 class="text-base md:text-lg font-semibold text-gray-100">Firewall MikroTik</h3>
				<p class="text-xs text-gray-400 leading-relaxed">
					Los cambios se guardan como borrador hasta que presiones <strong class="text-gray-300">Aplicar cambios</strong>.
				</p>
			</div>
			<div class="flex flex-col items-end gap-2">
				<RouterStatusBadge routerId={selectedRouterId} />
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-200 text-xs font-medium transition-colors"
						onclick={exportSnapshot}
					>
						Exportar JSON
					</button>
					<button
						type="button"
						disabled={!canInteract || fw.applying}
						class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
						onclick={openApplyModal}
					>
						{fw.applying ? 'Aplicando…' : 'Aplicar cambios'}
					</button>
				</div>
			</div>
		</div>

		<!-- Router + razón -->
		<div class="flex flex-col sm:flex-row gap-3">
			<div class="flex items-center gap-2 flex-1">
				<label class="text-xs font-mono text-gray-400 whitespace-nowrap" for="router-select">ROUTER</label>
				{#if routersLoading}
					<span class="text-xs text-gray-500">Cargando…</span>
				{:else if routers.length === 0}
					<span class="text-xs text-red-400">Sin routers registrados.</span>
				{:else}
					<select
						id="router-select"
						class="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none"
						bind:value={selectedRouterId}
						onchange={() => {
							if (selectedRouterId) {
								localStorage.setItem(ROUTER_KEY, String(selectedRouterId));
								fw.loadFromApi(selectedRouterId);
								fw.logs = [];
							}
						}}
					>
						<option value={null} disabled>Selecciona un router</option>
						{#each routers as r (r.id)}
							<option value={r.id}>{r.name} — {r.host}{r.is_active ? '' : ' (inactivo)'}</option>
						{/each}
					</select>
					<button
						type="button"
						disabled={!selectedRouterId || fw.loading}
						class="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-gray-100 text-xs font-medium transition-colors whitespace-nowrap"
						onclick={handleLoadFromApi}
					>
						{fw.loading ? 'Cargando…' : 'Recargar'}
					</button>
					<button
						type="button"
						disabled={!selectedRouterId || fw.loading}
						class="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-gray-100 text-xs font-medium transition-colors whitespace-nowrap"
						onclick={() => (mergeModalOpen = true)}
						title="Importar solo reglas del router que no existen en la BD"
					>
						Importar parcial
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-2 flex-1">
				<label class="text-xs font-mono text-gray-400 whitespace-nowrap" for="apply-reason">RAZÓN</label>
				<input
					id="apply-reason"
					type="text"
					placeholder="Motivo del cambio (opcional)"
					class="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none"
					bind:value={applyReason}
				/>
			</div>
		</div>

		{#if fw.apiError}
			<div class="border border-red-500/20 bg-red-500/10 rounded-lg px-4 py-3 text-xs text-red-300">
				{fw.apiError}
			</div>
		{/if}

		<!-- Stats -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
			<div class="border border-neutral-800 rounded-xl p-4 bg-neutral-900/30">
				<div class="text-xs font-mono text-gray-400 tracking-wide">FILTROS</div>
				<div class="text-lg font-semibold text-gray-100 mt-1">{enabledFilters}/{totalFilters}</div>
				<div class="text-[10px] text-gray-500">habilitadas</div>
			</div>
			<div class="border border-neutral-800 rounded-xl p-4 bg-neutral-900/30">
				<div class="text-xs font-mono text-gray-400 tracking-wide">NAT</div>
				<div class="text-lg font-semibold text-gray-100 mt-1">{enabledNat}/{totalNat}</div>
				<div class="text-[10px] text-gray-500">habilitadas</div>
			</div>
			<div class="border border-neutral-800 rounded-xl p-4 bg-neutral-900/30">
				<div class="text-xs font-mono text-gray-400 tracking-wide">CARGADO</div>
				<div class="text-xs text-gray-200 mt-1">{formatTs(snapshot.loadedAt)}</div>
			</div>
			<div class="border border-neutral-800 rounded-xl p-4 bg-neutral-900/30">
				<div class="text-xs font-mono text-gray-400 tracking-wide">ÚLTIMA APLICACIÓN</div>
				<div class="text-xs text-gray-200 mt-1">{formatTs(snapshot.appliedAt)}</div>
			</div>
		</div>

		<!-- Diff resumen (solo si hay cambios) -->
		{#if diff.hasChanges && fw.appliedSnapshot}
			<div class="border border-blue-500/20 bg-blue-500/5 rounded-xl px-4 py-3">
				<div class="text-[10px] font-mono text-blue-300/70 tracking-wide mb-2">CAMBIOS PENDIENTES</div>
				<ApplyDiffPreview {diff} />
			</div>
		{/if}
	</div>

	<!-- Nota de prioridad -->
	<div class="rounded-xl border border-neutral-800 bg-neutral-900/30 px-4 py-3 text-xs text-gray-400">
		Las reglas se procesan de arriba hacia abajo. Prioridad <span class="font-mono">1</span> tiene mayor precedencia.
		Arrastra filas para reordenar, o haz doble clic en una fila para editarla.
	</div>

	<!-- Reglas -->
	<div class="bg-[#121214] border border-neutral-800 rounded-xl p-5">
		<div class="flex items-center gap-2 mb-4">
			{#each [{ id: 'filters', label: 'Filtros' }, { id: 'nat', label: 'NAT' }] as tab (tab.id)}
				<button
					type="button"
					class="px-4 py-2 rounded-lg text-xs font-medium transition-colors border
					{activeSection === tab.id
						? 'bg-blue-500/10 border-blue-500/20 text-blue-200'
						: 'bg-neutral-900/40 border-neutral-800 text-gray-300 hover:bg-neutral-900/70'}"
					onclick={() => (activeSection = tab.id as 'filters' | 'nat')}
				>
					{tab.label}
				</button>
			{/each}
		</div>

		{#if activeSection === 'filters'}
			<div class="space-y-4">
				<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
					<div class="space-y-1">
						<h3 class="text-base font-semibold text-gray-100">Reglas de filtro</h3>
						<p class="text-xs text-gray-400">Reglas de entrada/salida/forward para la cadena seleccionada.</p>
					</div>
					<div class="flex items-center gap-2">
						<label class="text-xs text-gray-400 font-mono" for="active-filter-chain">CADENA</label>
						<select
							id="active-filter-chain"
							class="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none"
							bind:value={activeFilterChain}
						>
							<option value="input">input</option>
							<option value="output">output</option>
							<option value="forward">forward</option>
						</select>
					</div>
				</div>

				<FilterRuleList
					rules={filtersForChain}
					filterText={filterText}
					filterAction={filterAction as FirewallFilterAction | ''}
					onToggle={(id) => { const r = snapshot.filters.find((x) => x.id === id); if (r) fw.updateFilterRule(id, { enabled: !r.enabled }); }}
					onEdit={(id) => { editingFilterId = id; }}
					onDelete={(id) => requestDelete('filter', id)}
					onMove={(id, delta) => { fw.moveFilterRule(activeFilterChain, id, delta); toast.success('Orden actualizado.'); }}
					onSetPriority={(id, p) => { fw.setFilterPriority(activeFilterChain, id, p); toast.success('Prioridad actualizada.'); }}
					onSwap={(a, b) => { fw.swapFilterRules(activeFilterChain, a, b); toast.success('Orden actualizado.'); }}
					onFilterTextChange={(t) => (filterText = t)}
					onFilterActionChange={(a) => (filterAction = a)}
				/>

				{#if conflictsForChain.length > 0}
					{@const hasDanger = conflictsForChain.some((c) => c.severity === 'danger')}
					{@const hasDups   = conflictsForChain.some((c) => c.kind === 'duplicate')}
					<div class="rounded-xl border overflow-hidden {hasDanger ? 'border-red-500/20' : 'border-amber-500/20'}">
						<button
							type="button"
							class="w-full flex items-center justify-between px-4 py-3 text-left transition-colors
							{hasDanger ? 'bg-red-500/10 hover:bg-red-500/15' : 'bg-amber-500/10 hover:bg-amber-500/15'}"
							onclick={() => (conflictsFilterCollapsed = !conflictsFilterCollapsed)}
						>
							<span class="flex items-center gap-2 min-w-0">
								<AlertTriangle class="w-3.5 h-3.5 shrink-0 {hasDanger ? 'text-red-300' : 'text-amber-300'}" />
								<span class="text-xs font-mono tracking-wide {hasDanger ? 'text-red-200' : 'text-amber-200'}">ANÁLISIS DE CONFLICTOS</span>
								<span class="text-[10px] font-mono opacity-60 truncate {hasDanger ? 'text-red-300' : 'text-amber-300'}">{summarizeConflicts(conflictsForChain)}</span>
							</span>
							<div class="flex items-center gap-2 shrink-0 ml-2">
								{#if hasDups}
									<button
										type="button"
										class="text-[10px] px-2 py-1 rounded-lg border transition-colors border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 font-mono"
										onclick={(e) => { e.stopPropagation(); fixAllDuplicates(conflictsForChain, 'filter'); }}
									>
										Eliminar duplicados
									</button>
								{/if}
								<span class="text-[10px] font-mono opacity-50">{conflictsFilterCollapsed ? '▼ ver' : '▲ ocultar'}</span>
							</div>
						</button>
						{#if !conflictsFilterCollapsed}
							<div class="border-t {hasDanger ? 'border-red-500/10' : 'border-amber-500/10'} p-3 space-y-1.5 bg-neutral-900/30">
								{#each conflictsForChain as c (c.kind + c.primaryRuleId + (c.secondaryRuleId ?? ''))}
									<div class="flex items-start justify-between gap-3 rounded-lg px-3 py-2
										{c.severity === 'danger' ? 'bg-red-500/5' : c.severity === 'warning' ? 'bg-amber-500/5' : 'bg-neutral-900/40'}">
										<p class="text-xs leading-relaxed flex-1
											{c.severity === 'danger' ? 'text-red-200' : c.severity === 'warning' ? 'text-amber-200' : 'text-gray-400'}">
											{c.message}
										</p>
										{#if c.secondaryRuleId}
											<button
												type="button"
												class="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-colors
												{c.kind === 'duplicate'
													? 'border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20'
													: 'border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'}"
												onclick={() => fixConflict(c, 'filter')}
											>
												{c.kind === 'duplicate' ? 'Eliminar copia' : 'Editar regla'}
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<div class="border border-neutral-800 rounded-xl p-4 bg-neutral-900/30">
					<div class="flex items-center justify-between gap-3 mb-3">
						<div class="text-sm font-semibold text-gray-100">{editingFilter ? 'Editar regla' : 'Nueva regla'}</div>
						{#if editingFilter}
							<button type="button" class="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-100 text-xs font-medium transition-colors" onclick={() => (editingFilterId = null)}>
								Cancelar edición
							</button>
						{/if}
					</div>
					<FilterRuleForm
						initial={editingFilter ? editingFilter : { chain: activeFilterChain }}
						submitLabel={editingFilter ? 'Guardar cambios' : 'Agregar regla'}
						onSubmit={(payload) => {
							if (editingFilter) { fw.updateFilterRule(editingFilter.id, payload); toast.success('Regla actualizada.'); editingFilterId = null; return; }
							fw.addFilterRule(payload);
							toast.success('Regla agregada.');
						}}
					/>
				</div>
			</div>

		{:else}
			<div class="space-y-4">
				<div class="space-y-1">
					<h3 class="text-base font-semibold text-gray-100">Reglas NAT</h3>
					<p class="text-xs text-gray-400">Reglas srcnat/dstnat con filtros por IP, interfaz y puertos.</p>
				</div>

				<NatRuleList
					rules={natSorted}
					filterText={natText}
					filterAction={natAction as FirewallNatAction | ''}
					onToggle={(id) => { const r = snapshot.nat.find((x) => x.id === id); if (r) fw.updateNatRule(id, { enabled: !r.enabled }); }}
					onEdit={(id) => { editingNatId = id; }}
					onDelete={(id) => requestDelete('nat', id)}
					onMove={(id, delta) => { fw.moveNatRule(id, delta); toast.success('Orden actualizado.'); }}
					onSetPriority={(id, p) => { fw.setNatPriority(id, p); toast.success('Prioridad actualizada.'); }}
					onSwap={(a, b) => { fw.swapNatRules(a, b); toast.success('Orden actualizado.'); }}
					onFilterTextChange={(t) => (natText = t)}
					onFilterActionChange={(a) => (natAction = a)}
				/>

				{#if conflictsNat.length > 0}
					{@const hasDangerNat = conflictsNat.some((c) => c.severity === 'danger')}
					{@const hasDupsNat   = conflictsNat.some((c) => c.kind === 'duplicate')}
					<div class="rounded-xl border overflow-hidden {hasDangerNat ? 'border-red-500/20' : 'border-amber-500/20'}">
						<button
							type="button"
							class="w-full flex items-center justify-between px-4 py-3 text-left transition-colors
							{hasDangerNat ? 'bg-red-500/10 hover:bg-red-500/15' : 'bg-amber-500/10 hover:bg-amber-500/15'}"
							onclick={() => (conflictsNatCollapsed = !conflictsNatCollapsed)}
						>
							<span class="flex items-center gap-2 min-w-0">
								<AlertTriangle class="w-3.5 h-3.5 shrink-0 {hasDangerNat ? 'text-red-300' : 'text-amber-300'}" />
								<span class="text-xs font-mono tracking-wide {hasDangerNat ? 'text-red-200' : 'text-amber-200'}">ANÁLISIS DE CONFLICTOS</span>
								<span class="text-[10px] font-mono opacity-60 truncate {hasDangerNat ? 'text-red-300' : 'text-amber-300'}">{summarizeConflicts(conflictsNat)}</span>
							</span>
							<div class="flex items-center gap-2 shrink-0 ml-2">
								{#if hasDupsNat}
									<button
										type="button"
										class="text-[10px] px-2 py-1 rounded-lg border transition-colors border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 font-mono"
										onclick={(e) => { e.stopPropagation(); fixAllDuplicates(conflictsNat, 'nat'); }}
									>
										Eliminar duplicados
									</button>
								{/if}
								<span class="text-[10px] font-mono opacity-50">{conflictsNatCollapsed ? '▼ ver' : '▲ ocultar'}</span>
							</div>
						</button>
						{#if !conflictsNatCollapsed}
							<div class="border-t {hasDangerNat ? 'border-red-500/10' : 'border-amber-500/10'} p-3 space-y-1.5 bg-neutral-900/30">
								{#each conflictsNat as c (c.kind + c.primaryRuleId + (c.secondaryRuleId ?? ''))}
									<div class="flex items-start justify-between gap-3 rounded-lg px-3 py-2
										{c.severity === 'danger' ? 'bg-red-500/5' : c.severity === 'warning' ? 'bg-amber-500/5' : 'bg-neutral-900/40'}">
										<p class="text-xs leading-relaxed flex-1
											{c.severity === 'danger' ? 'text-red-200' : c.severity === 'warning' ? 'text-amber-200' : 'text-gray-400'}">
											{c.message}
										</p>
										{#if c.secondaryRuleId}
											<button
												type="button"
												class="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-colors
												{c.kind === 'duplicate'
													? 'border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20'
													: 'border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'}"
												onclick={() => fixConflict(c, 'nat')}
											>
												{c.kind === 'duplicate' ? 'Eliminar copia' : 'Editar regla'}
											</button>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<div class="border border-neutral-800 rounded-xl p-4 bg-neutral-900/30">
					<div class="flex items-center justify-between gap-3 mb-3">
						<div class="text-sm font-semibold text-gray-100">{editingNat ? 'Editar regla NAT' : 'Nueva regla NAT'}</div>
						{#if editingNat}
							<button type="button" class="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-100 text-xs font-medium transition-colors" onclick={() => (editingNatId = null)}>
								Cancelar edición
							</button>
						{/if}
					</div>
					<NatRuleForm
						initial={editingNat ?? {}}
						submitLabel={editingNat ? 'Guardar cambios' : 'Agregar regla NAT'}
						onSubmit={(payload) => {
							if (editingNat) { fw.updateNatRule(editingNat.id, payload); toast.success('Regla NAT actualizada.'); editingNatId = null; return; }
							fw.addNatRule(payload);
							toast.success('Regla NAT agregada.');
						}}
					/>
				</div>
			</div>
		{/if}
	</div>

	<!-- Historial de applies -->
	<ApplyLogPanel routerId={selectedRouterId} />

</div>

<!-- ── Modal de Apply con validación + diff ──────────────────────────── -->
{#if applyModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-[#121214] border border-neutral-700 rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
			<div class="space-y-1">
				<div class="text-sm font-semibold text-gray-100">Confirmar aplicación de cambios</div>
				<p class="text-xs text-gray-400">Se reemplazarán todas las reglas de filtro y NAT del router con el estado actual del borrador.</p>
			</div>

			<!-- Diff preview -->
			<div class="border border-neutral-800 bg-neutral-900/40 rounded-xl p-4 space-y-2">
				<div class="text-[10px] font-mono text-gray-400 tracking-wide">RESUMEN DE CAMBIOS</div>
				<ApplyDiffPreview {diff} />
			</div>

			<!-- Validación -->
			{#if applyValidating}
				<div class="text-xs text-gray-500 animate-pulse">Validando reglas…</div>
			{:else if fw.validation}
				{@const totalIssues = fw.validation.errors.length + fw.validation.warnings.length}
				{#if totalIssues === 0}
					<div class="flex items-center gap-2 text-xs text-emerald-300">
						<CheckCircle class="w-3.5 h-3.5" /> Sin problemas detectados.
					</div>
				{:else}
					<!-- Cabecera colapsable -->
					<button
						type="button"
						class="w-full flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors
						{fw.validation.errors.length > 0
							? 'border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/15'
							: 'border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15'}"
						onclick={() => (validationCollapsed = !validationCollapsed)}
					>
						<span class="flex items-center gap-2">
							<AlertTriangle class="w-3.5 h-3.5" />
							{fw.validation.errors.length > 0
								? `${fw.validation.errors.length} error(es)`
								: ''}
							{fw.validation.warnings.length > 0
								? `${fw.validation.warnings.length} advertencia(s)`
								: ''}
						</span>
						<span class="text-[10px] font-mono opacity-60">
							{validationCollapsed ? '▼ mostrar' : '▲ ocultar'}
						</span>
					</button>

					{#if !validationCollapsed}
						<div class="space-y-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
							{#each [...fw.validation.errors, ...fw.validation.warnings] as issue (issue.ruleId + issue.field + issue.message)}
								{@const isError = fw.validation.errors.includes(issue)}
								<div class="flex items-start justify-between gap-3 rounded-lg {isError ? 'bg-red-500/5' : 'bg-amber-500/5'} px-3 py-2">
									<p class="text-xs {isError ? 'text-red-200' : 'text-amber-200'} leading-relaxed flex-1">
										{issue.message}
									</p>
									{#if canAutoFix(issue)}
										<button
											type="button"
											class="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-lg border transition-colors
											{issue.field === 'toAddresses'
												? 'border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20'
												: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'}"
											onclick={() => applyFix(issue)}
										>
											{autoFixLabel(issue)}
										</button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			{/if}

			<div class="flex justify-end gap-2 pt-1">
				<button
					type="button"
					class="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-200 text-xs font-medium transition-colors"
					onclick={() => (applyModalOpen = false)}
				>
					Cancelar
				</button>
				<button
					type="button"
					disabled={fw.applying || applyValidating || (fw.validation?.errors.length ?? 0) > 0}
					class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
					onclick={confirmApply}
				>
					{fw.applying ? 'Aplicando…' : 'Confirmar y aplicar'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ── Modal Importación parcial ──────────────────────────────────────── -->
{#if mergeModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
		<div class="bg-[#121214] border border-neutral-700 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
			<div class="space-y-1">
				<div class="text-sm font-semibold text-gray-100">Importación parcial desde router</div>
				<p class="text-xs text-gray-400 leading-relaxed">
					Solo se importarán las reglas del router que <strong class="text-gray-300">no existen todavía en la base de datos</strong>
					(comparadas por ID externo). Las reglas actuales no se modifican ni eliminan.
				</p>
			</div>
			<div class="flex justify-end gap-2">
				<button type="button" class="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-200 text-xs font-medium transition-colors" onclick={() => (mergeModalOpen = false)}>Cancelar</button>
				<button type="button" disabled={fw.loading} class="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium transition-colors" onclick={doMerge}>
					{fw.loading ? 'Importando…' : 'Importar reglas nuevas'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ── Modal eliminar ─────────────────────────────────────────────────── -->
<ModalConfirmacion
	bind:open={confirmOpen}
	title={confirmTitle}
	message={confirmMessage}
	secondaryMessage={confirmSecondary}
	confirmText="Eliminar"
	cancelText="Cancelar"
	type={confirmType}
	loading={confirmLoading}
	error={confirmError}
	detailsTitle=""
	detailsItems={[]}
	on:confirm={confirmDelete}
	on:cancel={() => { confirmError = null; pendingDelete = null; }}
/>
