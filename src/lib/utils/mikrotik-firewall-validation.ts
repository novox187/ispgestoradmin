import type {
	FirewallFilterRule,
	FirewallNatRule,
	FirewallProtocol
} from '$lib/types/mikrotik-firewall';

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

function isIntString(v: string) {
	return /^[0-9]+$/.test(v);
}

export function isValidPortSpec(value: string) {
	const v = value.trim();
	if (!v) return { ok: true as const };
	if (v.includes(',')) return { ok: false as const, error: 'Usa un puerto o un rango (ej: 80 o 1000-2000).' };
	const parts = v.split('-').map((p) => p.trim());
	if (parts.length > 2) return { ok: false as const, error: 'Formato inválido de rango.' };
	if (parts.some((p) => !p || !isIntString(p))) return { ok: false as const, error: 'El puerto debe ser numérico.' };
	const a = Number(parts[0]);
	const b = parts.length === 2 ? Number(parts[1]) : a;
	if (!Number.isFinite(a) || !Number.isFinite(b)) return { ok: false as const, error: 'Puerto inválido.' };
	if (a < 1 || a > 65535 || b < 1 || b > 65535) return { ok: false as const, error: 'Puerto fuera de rango (1-65535).' };
	if (b < a) return { ok: false as const, error: 'El rango debe ser ascendente.' };
	return { ok: true as const };
}

export function isValidIpv4OrCidr(value: string) {
	const v = value.trim();
	if (!v) return { ok: true as const };
	const [ip, maskRaw] = v.split('/');
	const parts = ip.split('.');
	if (parts.length !== 4) return { ok: false as const, error: 'IP inválida.' };
	for (const p of parts) {
		if (!isIntString(p)) return { ok: false as const, error: 'IP inválida.' };
		const n = Number(p);
		if (n < 0 || n > 255) return { ok: false as const, error: 'IP inválida.' };
	}
	if (maskRaw != null) {
		if (!isIntString(maskRaw)) return { ok: false as const, error: 'Máscara inválida.' };
		const mask = Number(maskRaw);
		if (mask < 0 || mask > 32) return { ok: false as const, error: 'Máscara fuera de rango (0-32).' };
	}
	return { ok: true as const };
}

export function protocolNeedsPorts(protocol: FirewallProtocol) {
	return protocol === 'tcp' || protocol === 'udp';
}

export function isValidAddressListName(value: string) {
	const v = value.trim();
	if (!v) return { ok: true as const };
	if (v.length > 64) return { ok: false as const, error: 'Address-list demasiado largo (máx 64).' };
	if (!/^[a-zA-Z0-9_.-]+$/.test(v)) {
		return { ok: false as const, error: 'Address-list inválido. Usa letras, números, _, ., -' };
	}
	return { ok: true as const };
}

export function validateFilterRule(rule: Partial<FirewallFilterRule>) {
	const errors: FieldErrors<
		| 'chain'
		| 'action'
		| 'protocol'
		| 'srcAddress'
		| 'srcAddressList'
		| 'dstAddress'
		| 'srcPort'
		| 'dstPort'
		| 'inInterface'
		| 'outInterface'
		| 'comment'
	> = {};

	if (!rule.chain) errors.chain = 'Selecciona una cadena.';
	if (!rule.action) errors.action = 'Selecciona una acción.';
	if (!rule.protocol) errors.protocol = 'Selecciona un protocolo.';

	const srcAddr = isValidIpv4OrCidr(rule.srcAddress ?? '');
	if (!srcAddr.ok) errors.srcAddress = srcAddr.error;
	const srcList = isValidAddressListName((rule as any).srcAddressList ?? '');
	if (!srcList.ok) errors.srcAddressList = srcList.error;
	const dstAddr = isValidIpv4OrCidr(rule.dstAddress ?? '');
	if (!dstAddr.ok) errors.dstAddress = dstAddr.error;

	if (protocolNeedsPorts(rule.protocol ?? 'any')) {
		const sp = isValidPortSpec(rule.srcPort ?? '');
		if (!sp.ok) errors.srcPort = sp.error;
		const dp = isValidPortSpec(rule.dstPort ?? '');
		if (!dp.ok) errors.dstPort = dp.error;
	} else {
		if ((rule.srcPort ?? '').trim()) errors.srcPort = 'El protocolo seleccionado no usa puertos.';
		if ((rule.dstPort ?? '').trim()) errors.dstPort = 'El protocolo seleccionado no usa puertos.';
	}

	if (rule.chain === 'input' && (rule.outInterface ?? '').trim()) {
		errors.outInterface = 'La cadena input normalmente no usa out-interface.';
	}
	if (rule.chain === 'output' && (rule.inInterface ?? '').trim()) {
		errors.inInterface = 'La cadena output normalmente no usa in-interface.';
	}

	return errors;
}

export function validateNatRule(rule: Partial<FirewallNatRule>) {
	const errors: FieldErrors<
		| 'chain'
		| 'action'
		| 'protocol'
		| 'srcAddress'
		| 'srcAddressList'
		| 'dstAddress'
		| 'srcPort'
		| 'dstPort'
		| 'outInterface'
		| 'toAddresses'
		| 'toPorts'
		| 'comment'
	> = {};

	if (!rule.chain) errors.chain = 'Selecciona una cadena.';
	if (!rule.action) errors.action = 'Selecciona una acción.';
	if (!rule.protocol) errors.protocol = 'Selecciona un protocolo.';

	const srcAddr = isValidIpv4OrCidr(rule.srcAddress ?? '');
	if (!srcAddr.ok) errors.srcAddress = srcAddr.error;
	const srcList = isValidAddressListName((rule as any).srcAddressList ?? '');
	if (!srcList.ok) errors.srcAddressList = srcList.error;
	const dstAddr = isValidIpv4OrCidr(rule.dstAddress ?? '');
	if (!dstAddr.ok) errors.dstAddress = dstAddr.error;

	if (protocolNeedsPorts(rule.protocol ?? 'any')) {
		const sp = isValidPortSpec(rule.srcPort ?? '');
		if (!sp.ok) errors.srcPort = sp.error;
		const dp = isValidPortSpec(rule.dstPort ?? '');
		if (!dp.ok) errors.dstPort = dp.error;
	} else {
		if ((rule.srcPort ?? '').trim()) errors.srcPort = 'El protocolo seleccionado no usa puertos.';
		if ((rule.dstPort ?? '').trim()) errors.dstPort = 'El protocolo seleccionado no usa puertos.';
	}

	const toAddr = isValidIpv4OrCidr(rule.toAddresses ?? '');
	if (!toAddr.ok) errors.toAddresses = toAddr.error;

	if ((rule.toPorts ?? '').trim()) {
		const tp = isValidPortSpec(rule.toPorts ?? '');
		if (!tp.ok) errors.toPorts = tp.error;
	}

	if (rule.action === 'masquerade') {
		if ((rule.toAddresses ?? '').trim()) errors.toAddresses = 'Masquerade no requiere to-addresses.';
		if ((rule.toPorts ?? '').trim()) errors.toPorts = 'Masquerade no requiere to-ports.';
	}

	return errors;
}

export function hasErrors(errors: Record<string, string | undefined>) {
	return Object.values(errors).some((v) => typeof v === 'string' && v.trim().length > 0);
}
