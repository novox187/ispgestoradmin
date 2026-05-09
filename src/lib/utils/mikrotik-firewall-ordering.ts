import type {
	FirewallFilterRule,
	FirewallNatRule
} from '$lib/types/mikrotik-firewall';

export type FirewallRule = FirewallFilterRule | FirewallNatRule;

export function sortByPriority<T extends FirewallRule>(rules: T[]) {
	return [...rules].sort((a, b) => {
		const pa = Number.isFinite(a.priority) ? a.priority : 0;
		const pb = Number.isFinite(b.priority) ? b.priority : 0;
		if (pa !== pb) return pa - pb;
		return (a.createdAt ?? 0) - (b.createdAt ?? 0);
	});
}

export function normalizePriorities<T extends FirewallRule>(rules: T[]) {
	const sorted = sortByPriority(rules);
	const next: T[] = [];
	let p = 1;
	for (const r of sorted) {
		next.push({ ...r, priority: p } as T);
		p += 1;
	}
	return next;
}

export function swapPriorities<T extends FirewallRule>(rules: T[], aId: string, bId: string) {
	const a = rules.find((r) => r.id === aId);
	const b = rules.find((r) => r.id === bId);
	if (!a || !b) return rules;
	const aP = a.priority;
	const bP = b.priority;
	return rules.map((r) => {
		if (r.id === aId) return { ...r, priority: bP } as T;
		if (r.id === bId) return { ...r, priority: aP } as T;
		return r;
	});
}

export function moveRuleByDelta<T extends FirewallRule>(rules: T[], id: string, delta: -1 | 1) {
	const sorted = sortByPriority(rules);
	const idx = sorted.findIndex((r) => r.id === id);
	if (idx === -1) return rules;
	const targetIdx = idx + delta;
	if (targetIdx < 0 || targetIdx >= sorted.length) return rules;
	const a = sorted[idx];
	const b = sorted[targetIdx];
	return swapPriorities(rules, a.id, b.id);
}

export function setRulePriority<T extends FirewallRule>(rules: T[], id: string, priority: number) {
	const clean = Number.isFinite(priority) ? Math.max(1, Math.floor(priority)) : 1;
	const target = rules.find((r) => r.id === id);
	if (!target) return rules;

	const others = rules.filter((r) => r.id !== id);
	const sortedOthers = sortByPriority(others);

	const desiredIndex = clean - 1;
	const out: T[] = [];
	let inserted = false;

	for (let i = 0; i < sortedOthers.length; i++) {
		if (!inserted && out.length === desiredIndex) {
			out.push({ ...(target as T) });
			inserted = true;
		}
		out.push({ ...(sortedOthers[i] as T) });
	}
	if (!inserted) out.push({ ...(target as T) });

	return out.map((r, i) => ({ ...r, priority: i + 1 } as T));
}

export type ConflictKind = 'duplicate' | 'contradiction' | 'shadowed';
export type ConflictSeverity = 'info' | 'warning' | 'danger';

export type FirewallConflict = {
	kind: ConflictKind;
	severity: ConflictSeverity;
	message: string;
	primaryRuleId: string;
	secondaryRuleId?: string;
};

function normalizeText(v: string | undefined) {
	return (v ?? '').trim().toLowerCase();
}

function ruleSignature(r: FirewallRule) {
	const common = [
		r.kind,
		r.protocol,
		normalizeText((r as any).srcAddress),
		normalizeText((r as any).srcAddressList),
		normalizeText((r as any).dstAddress),
		normalizeText((r as any).srcPort),
		normalizeText((r as any).dstPort),
		normalizeText((r as any).inInterface),
		normalizeText((r as any).outInterface)
	].join('|');

	if (r.kind === 'filter') {
		return ['filter', r.chain, r.action, common].join('|');
	}

	return [
		'nat',
		r.chain,
		r.action,
		common,
		normalizeText((r as any).toAddresses),
		normalizeText((r as any).toPorts)
	].join('|');
}

function sameMatch(a: FirewallRule, b: FirewallRule) {
	if (a.kind !== b.kind) return false;
	if (a.kind === 'filter' && b.kind === 'filter') {
		return (
			a.chain === b.chain &&
			a.protocol === b.protocol &&
			normalizeText(a.srcAddress) === normalizeText(b.srcAddress) &&
			normalizeText(a.srcAddressList) === normalizeText(b.srcAddressList) &&
			normalizeText(a.dstAddress) === normalizeText(b.dstAddress) &&
			normalizeText(a.srcPort) === normalizeText(b.srcPort) &&
			normalizeText(a.dstPort) === normalizeText(b.dstPort) &&
			normalizeText(a.inInterface) === normalizeText(b.inInterface) &&
			normalizeText(a.outInterface) === normalizeText(b.outInterface)
		);
	}

	if (a.kind === 'nat' && b.kind === 'nat') {
		return (
			a.chain === b.chain &&
			a.protocol === b.protocol &&
			normalizeText(a.srcAddress) === normalizeText(b.srcAddress) &&
			normalizeText(a.srcAddressList) === normalizeText(b.srcAddressList) &&
			normalizeText(a.dstAddress) === normalizeText(b.dstAddress) &&
			normalizeText(a.srcPort) === normalizeText(b.srcPort) &&
			normalizeText(a.dstPort) === normalizeText(b.dstPort) &&
			normalizeText(a.outInterface) === normalizeText(b.outInterface) &&
			normalizeText(a.toAddresses) === normalizeText(b.toAddresses) &&
			normalizeText(a.toPorts) === normalizeText(b.toPorts)
		);
	}

	return false;
}

function matchesSuperset(earlier: FirewallRule, later: FirewallRule) {
	if (earlier.kind !== later.kind) return false;
	if (earlier.kind === 'filter' && later.kind === 'filter') {
		if (earlier.chain !== later.chain) return false;
		const eqOrAny = (a: string | undefined, b: string | undefined) => !normalizeText(a) || normalizeText(a) === normalizeText(b);
		const protoOk = earlier.protocol === 'any' || earlier.protocol === later.protocol;
		return (
			protoOk &&
			eqOrAny(earlier.srcAddress, later.srcAddress) &&
			eqOrAny(earlier.srcAddressList, later.srcAddressList) &&
			eqOrAny(earlier.dstAddress, later.dstAddress) &&
			eqOrAny(earlier.srcPort, later.srcPort) &&
			eqOrAny(earlier.dstPort, later.dstPort) &&
			eqOrAny(earlier.inInterface, later.inInterface) &&
			eqOrAny(earlier.outInterface, later.outInterface)
		);
	}

	if (earlier.kind === 'nat' && later.kind === 'nat') {
		if (earlier.chain !== later.chain) return false;
		const eqOrAny = (a: string | undefined, b: string | undefined) => !normalizeText(a) || normalizeText(a) === normalizeText(b);
		const protoOk = earlier.protocol === 'any' || earlier.protocol === later.protocol;
		return (
			protoOk &&
			eqOrAny(earlier.srcAddress, later.srcAddress) &&
			eqOrAny(earlier.srcAddressList, later.srcAddressList) &&
			eqOrAny(earlier.dstAddress, later.dstAddress) &&
			eqOrAny(earlier.srcPort, later.srcPort) &&
			eqOrAny(earlier.dstPort, later.dstPort) &&
			eqOrAny(earlier.outInterface, later.outInterface)
		);
	}

	return false;
}

export function analyzeFirewallConflicts(rules: FirewallRule[]): FirewallConflict[] {
	const sorted = sortByPriority(rules);
	const conflicts: FirewallConflict[] = [];

	const bySig = new Map<string, FirewallRule[]>();
	for (const r of sorted) {
		const sig = ruleSignature(r);
		const list = bySig.get(sig) ?? [];
		list.push(r);
		bySig.set(sig, list);
	}

	for (const [, list] of bySig.entries()) {
		if (list.length <= 1) continue;
		for (let i = 1; i < list.length; i++) {
			conflicts.push({
				kind: 'duplicate',
				severity: 'info',
				message: 'Regla duplicada: misma condición y acción.',
				primaryRuleId: list[0].id,
				secondaryRuleId: list[i].id
			});
		}
	}

	for (let i = 0; i < sorted.length; i++) {
		const a = sorted[i];
		for (let j = i + 1; j < sorted.length; j++) {
			const b = sorted[j];
			if (a.kind !== b.kind) continue;

			if (a.kind === 'filter' && b.kind === 'filter') {
				if (a.chain !== b.chain) continue;
				if (sameMatch(a, b) && a.action !== b.action) {
					conflicts.push({
						kind: 'contradiction',
						severity: 'danger',
						message: 'Contradicción: misma condición con acción diferente.',
						primaryRuleId: a.id,
						secondaryRuleId: b.id
					});
				} else if (matchesSuperset(a, b)) {
					conflicts.push({
						kind: 'shadowed',
						severity: a.enabled ? 'warning' : 'info',
						message: 'Posible shadowing: una regla superior puede capturar tráfico antes que esta.',
						primaryRuleId: a.id,
						secondaryRuleId: b.id
					});
				}
			}

			if (a.kind === 'nat' && b.kind === 'nat') {
				if (a.chain !== b.chain) continue;
				if (sameMatch(a, b) && a.action !== b.action) {
					conflicts.push({
						kind: 'contradiction',
						severity: 'danger',
						message: 'Contradicción: misma condición con acción diferente.',
						primaryRuleId: a.id,
						secondaryRuleId: b.id
					});
				} else if (matchesSuperset(a, b)) {
					conflicts.push({
						kind: 'shadowed',
						severity: a.enabled ? 'warning' : 'info',
						message: 'Posible shadowing: una regla superior puede aplicarse antes que esta.',
						primaryRuleId: a.id,
						secondaryRuleId: b.id
					});
				}
			}
		}
	}

	const seen = new Set<string>();
	return conflicts.filter((c) => {
		const key = `${c.kind}|${c.primaryRuleId}|${c.secondaryRuleId ?? ''}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}
