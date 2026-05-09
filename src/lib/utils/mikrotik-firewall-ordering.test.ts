import { describe, expect, it } from 'vitest';
import type { FirewallFilterRule } from '../types/mikrotik-firewall';
import {
	analyzeFirewallConflicts,
	moveRuleByDelta,
	normalizePriorities,
	setRulePriority,
	sortByPriority
} from './mikrotik-firewall-ordering';

function mkFilter(id: string, priority: number, partial?: Partial<FirewallFilterRule>): FirewallFilterRule {
	const t = 1700000000000;
	return {
		id,
		kind: 'filter',
		enabled: true,
		priority,
		createdAt: t + priority,
		updatedAt: t + priority,
		chain: 'input',
		action: 'accept',
		protocol: 'tcp',
		...partial
	};
}

describe('mikrotik-firewall-ordering', () => {
	it('sortByPriority orders ascending (1 is higher precedence)', () => {
		const rules = [mkFilter('a', 3), mkFilter('b', 1), mkFilter('c', 2)];
		expect(sortByPriority(rules).map((r) => r.id)).toEqual(['b', 'c', 'a']);
	});

	it('normalizePriorities makes priorities sequential starting at 1', () => {
		const rules = [mkFilter('a', 10), mkFilter('b', 10), mkFilter('c', 1)];
		const out = normalizePriorities(rules);
		expect(sortByPriority(out).map((r) => r.priority)).toEqual([1, 2, 3]);
	});

	it('moveRuleByDelta swaps priorities with neighbor in sorted order', () => {
		const rules = [mkFilter('a', 1), mkFilter('b', 2), mkFilter('c', 3)];
		const moved = moveRuleByDelta(rules, 'b', -1);
		expect(sortByPriority(moved).map((r) => r.id)).toEqual(['b', 'a', 'c']);
	});

	it('setRulePriority keeps unique priorities by shifting duplicates', () => {
		const rules = [mkFilter('a', 1), mkFilter('b', 2), mkFilter('c', 3)];
		const out = setRulePriority(rules, 'c', 2);
		const sorted = sortByPriority(out);
		expect(sorted.map((r) => r.priority)).toEqual([1, 2, 3]);
		expect(sorted.map((r) => r.id)).toEqual(['a', 'c', 'b']);
	});

	it('analyzeFirewallConflicts detects duplicates and contradictions', () => {
		const r1 = mkFilter('a', 1, { srcAddress: '10.0.0.1', dstPort: '80', action: 'accept' });
		const r2 = mkFilter('b', 2, { srcAddress: '10.0.0.1', dstPort: '80', action: 'accept' });
		const r3 = mkFilter('c', 3, { srcAddress: '10.0.0.1', dstPort: '80', action: 'drop' });
		const conflicts = analyzeFirewallConflicts([r1, r2, r3]);
		expect(conflicts.some((c) => c.kind === 'duplicate')).toBe(true);
		expect(conflicts.some((c) => c.kind === 'contradiction')).toBe(true);
	});

	it('analyzeFirewallConflicts flags possible shadowing', () => {
		const broad = mkFilter('a', 1, { protocol: 'any', action: 'drop' });
		const specific = mkFilter('b', 2, { protocol: 'tcp', dstPort: '22', action: 'accept' });
		const conflicts = analyzeFirewallConflicts([broad, specific]);
		expect(conflicts.some((c) => c.kind === 'shadowed')).toBe(true);
	});
});

