<script lang="ts">
	import { CheckCircleIcon, XCircleIcon } from '@lucide/svelte';
	import type { FirewallFilterRule, FirewallFilterAction, FirewallFilterChain, FirewallProtocol } from '$lib/types/mikrotik-firewall';
	import { hasErrors, protocolNeedsPorts, validateFilterRule } from '$lib/utils/mikrotik-firewall-validation';

	const props = $props<{
		initial?: Partial<FirewallFilterRule>;
		submitLabel: string;
		onSubmit: (payload: Omit<FirewallFilterRule, 'id' | 'createdAt' | 'updatedAt' | 'priority'>) => void;
		onCancel?: () => void;
	}>();

	const defaultDraft: Partial<FirewallFilterRule> = {
		kind: 'filter',
		enabled: true,
		chain: 'input',
		action: 'accept',
		protocol: 'tcp',
		log: false,
		comment: ''
	};

	let draft = $state<Partial<FirewallFilterRule>>({ ...defaultDraft, ...(props.initial ?? {}) });
	let touched = $state(false);

	const errors = $derived(validateFilterRule(draft));
	const invalid = $derived(hasErrors(errors));
	const showPorts = $derived(protocolNeedsPorts((draft.protocol ?? 'any') as FirewallProtocol));

	$effect(() => {
		draft = { ...defaultDraft, ...(props.initial ?? {}) };
		touched = false;
	});

	function submit() {
		touched = true;
		if (invalid) return;
		props.onSubmit({
			kind: 'filter',
			enabled: Boolean(draft.enabled ?? true),
			chain: (draft.chain ?? 'input') as FirewallFilterChain,
			action: (draft.action ?? 'accept') as FirewallFilterAction,
			protocol: (draft.protocol ?? 'any') as FirewallProtocol,
			srcAddress: (draft.srcAddress ?? '').trim() || undefined,
			srcAddressList: (draft.srcAddressList ?? '').trim() || undefined,
			dstAddress: (draft.dstAddress ?? '').trim() || undefined,
			srcPort: (draft.srcPort ?? '').trim() || undefined,
			dstPort: (draft.dstPort ?? '').trim() || undefined,
			inInterface: (draft.inInterface ?? '').trim() || undefined,
			outInterface: (draft.outInterface ?? '').trim() || undefined,
			comment: (draft.comment ?? '').trim() || undefined,
			log: Boolean(draft.log ?? false)
		});
	}

	function fieldClass(error?: string) {
		return `w-full px-4 py-2 border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0 bg-neutral-900 ${
			error ? 'border-red-500/40' : 'border-neutral-800'
		}`;
	}
</script>

<form class="space-y-4" onsubmit={(e) => { e.preventDefault(); submit(); }}>
	<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="filter-chain">Cadena</label>
			<select
				id="filter-chain"
				bind:value={draft.chain}
				class={fieldClass(touched ? errors.chain : undefined)}
				aria-invalid={touched && !!errors.chain}
			>
				<option value="input">input</option>
				<option value="output">output</option>
				<option value="forward">forward</option>
			</select>
			{#if touched && errors.chain}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.chain}</div>
			{/if}
		</div>

		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="filter-action">Acción</label>
			<select
				id="filter-action"
				bind:value={draft.action}
				class={fieldClass(touched ? errors.action : undefined)}
				aria-invalid={touched && !!errors.action}
			>
				<option value="accept">accept</option>
				<option value="drop">drop</option>
				<option value="reject">reject</option>
			</select>
			{#if touched && errors.action}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.action}</div>
			{/if}
		</div>

		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="filter-protocol">Protocolo</label>
			<select
				id="filter-protocol"
				bind:value={draft.protocol}
				class={fieldClass(touched ? errors.protocol : undefined)}
				aria-invalid={touched && !!errors.protocol}
			>
				<option value="any">any</option>
				<option value="tcp">tcp</option>
				<option value="udp">udp</option>
				<option value="icmp">icmp</option>
			</select>
			{#if touched && errors.protocol}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.protocol}</div>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="filter-src">Origen (IP/CIDR)</label>
			<input
				id="filter-src"
				type="text"
				placeholder="192.168.88.0/24"
				bind:value={draft.srcAddress}
				class={fieldClass(touched ? errors.srcAddress : undefined)}
				aria-invalid={touched && !!errors.srcAddress}
			/>
			{#if touched && errors.srcAddress}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.srcAddress}</div>
			{/if}
		</div>
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="filter-src-list">Origen (Address-List)</label>
			<input
				id="filter-src-list"
				type="text"
				placeholder="clientes_permitidos"
				bind:value={draft.srcAddressList}
				class={fieldClass(touched ? errors.srcAddressList : undefined)}
				aria-invalid={touched && !!errors.srcAddressList}
			/>
			{#if touched && errors.srcAddressList}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.srcAddressList}</div>
			{/if}
		</div>
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="filter-dst">Destino (IP/CIDR)</label>
			<input
				id="filter-dst"
				type="text"
				placeholder="10.0.0.0/8"
				bind:value={draft.dstAddress}
				class={fieldClass(touched ? errors.dstAddress : undefined)}
				aria-invalid={touched && !!errors.dstAddress}
			/>
			{#if touched && errors.dstAddress}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.dstAddress}</div>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="filter-inif">In-Interface</label>
			<input
				id="filter-inif"
				type="text"
				placeholder="LAN"
				bind:value={draft.inInterface}
				class={fieldClass(touched ? errors.inInterface : undefined)}
				aria-invalid={touched && !!errors.inInterface}
			/>
			{#if touched && errors.inInterface}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.inInterface}</div>
			{/if}
		</div>
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="filter-outif">Out-Interface</label>
			<input
				id="filter-outif"
				type="text"
				placeholder="WAN"
				bind:value={draft.outInterface}
				class={fieldClass(touched ? errors.outInterface : undefined)}
				aria-invalid={touched && !!errors.outInterface}
			/>
			{#if touched && errors.outInterface}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.outInterface}</div>
			{/if}
		</div>
	</div>

	{#if showPorts}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<div>
				<label class="block text-sm font-medium text-foreground mb-2" for="filter-srcport">Puerto origen</label>
				<input
					id="filter-srcport"
					type="text"
					placeholder="1024-65535"
					bind:value={draft.srcPort}
					class={fieldClass(touched ? errors.srcPort : undefined)}
					aria-invalid={touched && !!errors.srcPort}
				/>
				{#if touched && errors.srcPort}
					<div class="text-xs text-red-400 mt-1" role="alert">{errors.srcPort}</div>
				{/if}
			</div>
			<div>
				<label class="block text-sm font-medium text-foreground mb-2" for="filter-dstport">Puerto destino</label>
				<input
					id="filter-dstport"
					type="text"
					placeholder="80 o 1000-2000"
					bind:value={draft.dstPort}
					class={fieldClass(touched ? errors.dstPort : undefined)}
					aria-invalid={touched && !!errors.dstPort}
				/>
				{#if touched && errors.dstPort}
					<div class="text-xs text-red-400 mt-1" role="alert">{errors.dstPort}</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="filter-comment">Comentario</label>
			<input
				id="filter-comment"
				type="text"
				placeholder="Descripción opcional"
				bind:value={draft.comment}
				class={fieldClass(undefined)}
			/>
		</div>
		<div class="flex items-center gap-4 pt-8">
			<label class="flex items-center gap-2 text-sm text-muted-foreground">
				<input type="checkbox" bind:checked={draft.enabled} />
				Habilitada
			</label>
			<label class="flex items-center gap-2 text-sm text-muted-foreground">
				<input type="checkbox" bind:checked={draft.log} />
				Log
			</label>
		</div>
	</div>

	<div class="flex items-center justify-between gap-3">
		<div class="text-xs text-gray-400">
			{#if touched && invalid}
				<span class="inline-flex items-center gap-2 text-red-400">
					<XCircleIcon class="w-4 h-4" />
					Revisa los campos marcados.
				</span>
			{:else if !invalid}
				<span class="inline-flex items-center gap-2 text-green-400">
					<CheckCircleIcon class="w-4 h-4" />
					Listo para guardar.
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			{#if props.onCancel}
				<button
					type="button"
					class="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-gray-100 text-xs sm:text-sm font-medium transition-colors"
					onclick={props.onCancel}
				>
					Cancelar
				</button>
			{/if}
			<button
				type="submit"
				class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
				disabled={invalid}
			>
				{props.submitLabel}
			</button>
		</div>
	</div>
</form>
