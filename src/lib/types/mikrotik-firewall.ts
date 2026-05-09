export type FirewallProtocol = 'any' | 'tcp' | 'udp' | 'icmp';

export type FirewallFilterChain = 'input' | 'output' | 'forward';
export type FirewallFilterAction = 'accept' | 'drop' | 'reject';

export type FirewallNatChain = 'srcnat' | 'dstnat';
export type FirewallNatAction = 'masquerade' | 'src-nat' | 'dst-nat' | 'redirect';

export type FirewallRuleState = {
	id: string;
	enabled: boolean;
	priority: number;
	createdAt: number;
	updatedAt: number;
};

export type FirewallFilterRule = FirewallRuleState & {
	kind: 'filter';
	chain: FirewallFilterChain;
	action: FirewallFilterAction;
	protocol: FirewallProtocol;
	srcAddress?: string;
	srcAddressList?: string;
	dstAddress?: string;
	srcPort?: string;
	dstPort?: string;
	inInterface?: string;
	outInterface?: string;
	comment?: string;
	log?: boolean;
};

export type FirewallNatRule = FirewallRuleState & {
	kind: 'nat';
	chain: FirewallNatChain;
	action: FirewallNatAction;
	protocol: FirewallProtocol;
	srcAddress?: string;
	srcAddressList?: string;
	dstAddress?: string;
	srcPort?: string;
	dstPort?: string;
	outInterface?: string;
	toAddresses?: string;
	toPorts?: string;
	comment?: string;
	log?: boolean;
};

export type FirewallSnapshot = {
	routerId: string | null;
	loadedAt: number | null;
	appliedAt: number | null;
	filters: FirewallFilterRule[];
	nat: FirewallNatRule[];
};

export type ApplyLog = {
	id: number;
	routerId: number;
	employeeId: number | null;
	reason: string | null;
	status: 'success' | 'failed' | 'rolled_back';
	errorMessage: string | null;
	filterCount: number;
	natCount: number;
	appliedAt: number;
	hasBefore: boolean;
};

export type ValidationIssue = {
	ruleId: string;
	field: string;
	message: string;
};

export type ValidationResult = {
	valid: boolean;
	errors: ValidationIssue[];
	warnings: ValidationIssue[];
};

export type SnapshotDiff = {
	addedFilters: number;
	modifiedFilters: number;
	removedFilters: number;
	addedNat: number;
	modifiedNat: number;
	removedNat: number;
	hasChanges: boolean;
};
