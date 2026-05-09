import {
	fetchFirewallSnapshot,
	applyFirewallSnapshot,
	syncFirewallFromRouter,
	mergeFirewallFromRouter,
	validateFirewallSnapshot,
	fetchApplyLogs,
	rollbackApplyLog,
	fetchRouterStatus
} from '$lib/api/firewall';
import type {
	ApplyLog,
	FirewallSnapshot,
	FirewallFilterRule,
	FirewallNatRule,
	ValidationResult,
	SnapshotDiff
} from '$lib/types/mikrotik-firewall';
import {
	moveRuleByDelta,
	normalizePriorities,
	setRulePriority,
	sortByPriority,
	swapPriorities
} from '$lib/utils/mikrotik-firewall-ordering';

const STORAGE_KEY = 'ispga_mikrotik_firewall_snapshot_v1';
const ROUTER_KEY  = 'ispga_mikrotik_selected_router_id';

function now() {
	return Date.now();
}

function safeParseJson<T>(raw: string | null): T | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

function newId() {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
	return `${now()}_${Math.random().toString(16).slice(2)}`;
}

function seed(): FirewallSnapshot {
	const t = now();
	const base = { enabled: true, priority: 1, createdAt: t, updatedAt: t };
	const filters: FirewallFilterRule[] = [
		{
			...base,
			id: newId(),
			kind: 'filter',
			chain: 'input',
			action: 'accept',
			protocol: 'tcp',
			dstPort: '22',
			srcAddress: '192.168.88.0/24',
			comment: 'Permitir SSH desde LAN',
			log: false
		},
		{
			...base,
			priority: 2,
			id: newId(),
			kind: 'filter',
			chain: 'input',
			action: 'drop',
			protocol: 'any',
			comment: 'Bloquear input por defecto (proto)',
			log: false
		}
	];
	const nat: FirewallNatRule[] = [
		{
			...base,
			id: newId(),
			kind: 'nat',
			priority: 1,
			chain: 'srcnat',
			action: 'masquerade',
			protocol: 'any',
			outInterface: 'WAN',
			comment: 'Salida a internet (proto)',
			log: false
		}
	];
	return {
		routerId: null,
		loadedAt: t,
		appliedAt: null,
		filters,
		nat
	};
}

function migrateSnapshot(raw: FirewallSnapshot): FirewallSnapshot {
	const t = now();
	const ensureState = <T extends { id: string; enabled: boolean; createdAt: number; updatedAt: number; priority?: number }>(
		r: T,
		fallbackPriority: number
	) => {
		const createdAt = Number.isFinite(r.createdAt) ? r.createdAt : t;
		const updatedAt = Number.isFinite(r.updatedAt) ? r.updatedAt : createdAt;
		const priority = Number.isFinite(r.priority) ? Math.max(1, Math.floor(r.priority as number)) : fallbackPriority;
		return { ...r, createdAt, updatedAt, priority };
	};

	const filtersByChain: Record<string, FirewallFilterRule[]> = {};
	for (let i = 0; i < raw.filters.length; i++) {
		const r = ensureState(raw.filters[i] as any, i + 1) as FirewallFilterRule;
		const key = r.chain;
		filtersByChain[key] = filtersByChain[key] ? [...filtersByChain[key], r] : [r];
	}

	const migratedFilters: FirewallFilterRule[] = [];
	for (const chain of Object.keys(filtersByChain)) {
		const normalized = normalizePriorities(sortByPriority(filtersByChain[chain]));
		migratedFilters.push(...normalized);
	}

	const migratedNat = normalizePriorities(
		sortByPriority(
			raw.nat.map((r, i) => ensureState(r as any, i + 1) as FirewallNatRule)
		)
	);

	return {
		...raw,
		loadedAt: raw.loadedAt ?? t,
		filters: migratedFilters,
		nat: migratedNat
	};
}

export class MikrotikFirewallState {
	snapshot         = $state<FirewallSnapshot>(seed());
	appliedSnapshot  = $state<FirewallSnapshot | null>(null);
	loaded           = $state(false);
	loading          = $state(false);
	applying         = $state(false);
	apiError         = $state<string | null>(null);

	// Historial
	logs             = $state<ApplyLog[]>([]);
	logsLoading      = $state(false);
	logsMeta         = $state<{ currentPage: number; lastPage: number; total: number } | null>(null);

	// Validación
	validation       = $state<ValidationResult | null>(null);
	validating       = $state(false);

	// Estado del router
	routerReachable  = $state<boolean | null>(null);
	routerLatency    = $state<number | null>(null);
	routerChecking   = $state(false);

	// ── localStorage (borrador local) ────────────────────────────────────────

	loadFromStorage() {
		if (typeof localStorage === 'undefined') return;
		const parsed = safeParseJson<FirewallSnapshot>(localStorage.getItem(STORAGE_KEY));
		if (parsed && typeof parsed === 'object') {
			this.snapshot = migrateSnapshot(parsed);
			this.loaded = true;
			return;
		}
		this.loaded = true;
	}

	persist() {
		if (typeof localStorage === 'undefined') return;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot));
	}

	// ── API ──────────────────────────────────────────────────────────────────

	/** Carga el snapshot desde el backend y lo aplica al estado local. */
	async loadFromApi(routerId: number): Promise<void> {
		this.loading  = true;
		this.apiError = null;
		try {
			const data = await fetchFirewallSnapshot(routerId);
			this.snapshot = migrateSnapshot({ ...data, routerId: String(routerId) });
			this.appliedSnapshot = { ...this.snapshot };
			this.loaded   = true;
			this.persist();
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(ROUTER_KEY, String(routerId));
			}
		} catch (e) {
			this.apiError = e instanceof Error ? e.message : 'Error al cargar desde el backend.';
		} finally {
			this.loading = false;
		}
	}

	/** Lee las reglas vivas del router MikroTik y las guarda en la BD y estado local. */
	async syncFromRouter(routerId: number): Promise<{ filterCount: number; natCount: number }> {
		this.loading  = true;
		this.apiError = null;
		try {
			const data = await syncFirewallFromRouter(routerId);
			this.snapshot = migrateSnapshot({ ...data, routerId: String(routerId) });
			this.appliedSnapshot = { ...this.snapshot };
			this.loaded   = true;
			this.persist();
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(ROUTER_KEY, String(routerId));
			}
			return { filterCount: data.filters.length, natCount: data.nat.length };
		} catch (e) {
			this.apiError = e instanceof Error ? e.message : 'Error al sincronizar desde el router.';
			throw e;
		} finally {
			this.loading = false;
		}
	}

	/** Importación parcial: solo añade reglas del router que no están en la BD. */
	async mergeFromRouter(routerId: number): Promise<{ added: number }> {
		this.loading  = true;
		this.apiError = null;
		try {
			const { added, data } = await mergeFirewallFromRouter(routerId);
			this.snapshot = migrateSnapshot({ ...data, routerId: String(routerId) });
			this.appliedSnapshot = { ...this.snapshot };
			this.loaded = true;
			this.persist();
			return { added };
		} catch (e) {
			this.apiError = e instanceof Error ? e.message : 'Error al importar desde el router.';
			throw e;
		} finally {
			this.loading = false;
		}
	}

	/** Envía el snapshot actual al backend para persistirlo y aplicarlo al router. */
	async applyToApi(routerId: number, reason?: string): Promise<void> {
		this.applying = true;
		this.apiError = null;
		try {
			const result = await applyFirewallSnapshot(routerId, this.snapshot, reason);
			this.snapshot.appliedAt = result.applied_at;
			this.snapshot = { ...this.snapshot };
			this.appliedSnapshot = { ...this.snapshot };
			this.persist();
		} catch (e) {
			this.apiError = e instanceof Error ? e.message : 'Error al aplicar los cambios.';
			throw e;
		} finally {
			this.applying = false;
		}
	}

	/** Valida el snapshot actual contra las reglas de consistencia del backend. */
	async validateSnapshot(routerId: number): Promise<ValidationResult> {
		this.validating = true;
		try {
			const result = await validateFirewallSnapshot(routerId, this.snapshot);
			this.validation = result;
			return result;
		} catch (e) {
			this.validation = null;
			throw e;
		} finally {
			this.validating = false;
		}
	}

	/** Carga el historial de applies para el router dado. */
	async loadLogs(routerId: number, page = 1): Promise<void> {
		this.logsLoading = true;
		try {
			const res = await fetchApplyLogs(routerId, page);
			this.logs    = res.data;
			this.logsMeta = res.meta;
		} catch {
			// silencioso — el panel simplemente no muestra datos
		} finally {
			this.logsLoading = false;
		}
	}

	/** Restaura el estado anterior del log indicado. */
	async rollbackLog(logId: number): Promise<void> {
		this.applying = true;
		this.apiError = null;
		try {
			const data = await rollbackApplyLog(logId);
			this.snapshot = migrateSnapshot({ ...data });
			this.appliedSnapshot = { ...this.snapshot };
			this.loaded = true;
			this.persist();
		} catch (e) {
			this.apiError = e instanceof Error ? e.message : 'Error al hacer rollback.';
			throw e;
		} finally {
			this.applying = false;
		}
	}

	/** Comprueba si el router es alcanzable vía API RouterOS. */
	async checkRouterStatus(routerId: number): Promise<void> {
		this.routerChecking = true;
		try {
			const res = await fetchRouterStatus(routerId);
			this.routerReachable = res.reachable;
			this.routerLatency   = res.latency_ms;
		} catch {
			this.routerReachable = false;
			this.routerLatency   = null;
		} finally {
			this.routerChecking = false;
		}
	}

	/** Calcula el diff entre el snapshot actual y el último aplicado. */
	computeDiff(): SnapshotDiff {
		const base = this.appliedSnapshot;
		if (!base) {
			return {
				addedFilters: this.snapshot.filters.length,
				modifiedFilters: 0,
				removedFilters: 0,
				addedNat: this.snapshot.nat.length,
				modifiedNat: 0,
				removedNat: 0,
				hasChanges: this.snapshot.filters.length > 0 || this.snapshot.nat.length > 0
			};
		}

		const baseFilterIds = new Set(base.filters.map((r) => r.id));
		const currFilterIds = new Set(this.snapshot.filters.map((r) => r.id));
		const addedFilters    = this.snapshot.filters.filter((r) => !baseFilterIds.has(r.id)).length;
		const removedFilters  = base.filters.filter((r) => !currFilterIds.has(r.id)).length;
		const modifiedFilters = this.snapshot.filters.filter((r) => {
			if (!baseFilterIds.has(r.id)) return false;
			const orig = base.filters.find((b) => b.id === r.id)!;
			return JSON.stringify(r) !== JSON.stringify(orig);
		}).length;

		const baseNatIds = new Set(base.nat.map((r) => r.id));
		const currNatIds = new Set(this.snapshot.nat.map((r) => r.id));
		const addedNat    = this.snapshot.nat.filter((r) => !baseNatIds.has(r.id)).length;
		const removedNat  = base.nat.filter((r) => !currNatIds.has(r.id)).length;
		const modifiedNat = this.snapshot.nat.filter((r) => {
			if (!baseNatIds.has(r.id)) return false;
			const orig = base.nat.find((b) => b.id === r.id)!;
			return JSON.stringify(r) !== JSON.stringify(orig);
		}).length;

		return {
			addedFilters, modifiedFilters, removedFilters,
			addedNat, modifiedNat, removedNat,
			hasChanges: addedFilters + modifiedFilters + removedFilters + addedNat + modifiedNat + removedNat > 0
		};
	}

	// ── helpers ──────────────────────────────────────────────────────────────

	setAppliedNow() {
		this.snapshot.appliedAt = now();
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	// ── filter rules ─────────────────────────────────────────────────────────

	addFilterRule(rule: Omit<FirewallFilterRule, 'id' | 'createdAt' | 'updatedAt' | 'priority'>) {
		const t = now();
		const chainRules = this.snapshot.filters.filter((r) => r.chain === rule.chain);
		const nextPriority = (sortByPriority(chainRules).at(-1)?.priority ?? 0) + 1;
		this.snapshot.filters = [...this.snapshot.filters, { ...rule, id: newId(), priority: nextPriority, createdAt: t, updatedAt: t }];
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	updateFilterRule(id: string, next: Partial<FirewallFilterRule>) {
		const t = now();
		const idx = this.snapshot.filters.findIndex((r) => r.id === id);
		if (idx === -1) return;
		const current = this.snapshot.filters[idx];
		const nextChain = (next.chain ?? current.chain) as FirewallFilterRule['chain'];
		this.snapshot.filters[idx] = { ...current, ...next, updatedAt: t };

		const chainRules = this.snapshot.filters.filter((r) => r.chain === nextChain);
		const other = this.snapshot.filters.filter((r) => r.chain !== nextChain);

		if (typeof next.priority === 'number') {
			const adjusted = setRulePriority(chainRules, id, next.priority);
			this.snapshot.filters = [...other, ...adjusted];
		} else {
			this.snapshot.filters = [...other, ...chainRules];
		}
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	deleteFilterRule(id: string) {
		const rule = this.snapshot.filters.find((r) => r.id === id);
		this.snapshot.filters = this.snapshot.filters.filter((r) => r.id !== id);
		if (rule) {
			const chainRules = this.snapshot.filters.filter((r) => r.chain === rule.chain);
			const other = this.snapshot.filters.filter((r) => r.chain !== rule.chain);
			this.snapshot.filters = [...other, ...normalizePriorities(sortByPriority(chainRules))];
		}
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	moveFilterRule(chain: FirewallFilterRule['chain'], id: string, delta: -1 | 1) {
		const chainRules = this.snapshot.filters.filter((r) => r.chain === chain);
		const other = this.snapshot.filters.filter((r) => r.chain !== chain);
		const moved = moveRuleByDelta(chainRules, id, delta);
		this.snapshot.filters = [...other, ...moved];
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	setFilterPriority(chain: FirewallFilterRule['chain'], id: string, priority: number) {
		const chainRules = this.snapshot.filters.filter((r) => r.chain === chain);
		const other = this.snapshot.filters.filter((r) => r.chain !== chain);
		this.snapshot.filters = [...other, ...setRulePriority(chainRules, id, priority)];
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	swapFilterRules(chain: FirewallFilterRule['chain'], aId: string, bId: string) {
		const chainRules = this.snapshot.filters.filter((r) => r.chain === chain);
		const other = this.snapshot.filters.filter((r) => r.chain !== chain);
		this.snapshot.filters = [...other, ...swapPriorities(chainRules, aId, bId)];
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	// ── nat rules ────────────────────────────────────────────────────────────

	addNatRule(rule: Omit<FirewallNatRule, 'id' | 'createdAt' | 'updatedAt' | 'priority'>) {
		const t = now();
		const nextPriority = (sortByPriority(this.snapshot.nat).at(-1)?.priority ?? 0) + 1;
		this.snapshot.nat = [...this.snapshot.nat, { ...rule, id: newId(), priority: nextPriority, createdAt: t, updatedAt: t }];
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	updateNatRule(id: string, next: Partial<FirewallNatRule>) {
		const t = now();
		const idx = this.snapshot.nat.findIndex((r) => r.id === id);
		if (idx === -1) return;
		this.snapshot.nat[idx] = { ...this.snapshot.nat[idx], ...next, updatedAt: t };
		if (typeof next.priority === 'number') {
			this.snapshot.nat = setRulePriority(this.snapshot.nat, id, next.priority);
		} else {
			this.snapshot.nat = [...this.snapshot.nat];
		}
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	deleteNatRule(id: string) {
		this.snapshot.nat = this.snapshot.nat.filter((r) => r.id !== id);
		this.snapshot.nat = normalizePriorities(sortByPriority(this.snapshot.nat));
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	moveNatRule(id: string, delta: -1 | 1) {
		this.snapshot.nat = moveRuleByDelta(this.snapshot.nat, id, delta);
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	setNatPriority(id: string, priority: number) {
		this.snapshot.nat = setRulePriority(this.snapshot.nat, id, priority);
		this.snapshot = { ...this.snapshot };
		this.persist();
	}

	swapNatRules(aId: string, bId: string) {
		this.snapshot.nat = swapPriorities(this.snapshot.nat, aId, bId);
		this.snapshot = { ...this.snapshot };
		this.persist();
	}
}

export const mikrotikFirewallState = new MikrotikFirewallState();
