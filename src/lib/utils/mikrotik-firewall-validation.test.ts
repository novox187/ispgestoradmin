import { describe, expect, it } from 'vitest';
import { isValidAddressListName, isValidIpv4OrCidr, isValidPortSpec } from './mikrotik-firewall-validation';

describe('mikrotik-firewall-validation', () => {
	it('validates IPv4/CIDR', () => {
		expect(isValidIpv4OrCidr('192.168.1.1').ok).toBe(true);
		expect(isValidIpv4OrCidr('192.168.1.0/24').ok).toBe(true);
		expect(isValidIpv4OrCidr('999.1.1.1').ok).toBe(false);
		expect(isValidIpv4OrCidr('10.0.0.0/99').ok).toBe(false);
	});

	it('validates port spec', () => {
		expect(isValidPortSpec('80').ok).toBe(true);
		expect(isValidPortSpec('1000-2000').ok).toBe(true);
		expect(isValidPortSpec('0').ok).toBe(false);
		expect(isValidPortSpec('2000-1000').ok).toBe(false);
	});

	it('validates src-address-list name', () => {
		expect(isValidAddressListName('clientes_permitidos').ok).toBe(true);
		expect(isValidAddressListName('clientes permitidos').ok).toBe(false);
		expect(isValidAddressListName('a'.repeat(65)).ok).toBe(false);
	});
});

