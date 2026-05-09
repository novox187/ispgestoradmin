<script lang="ts">
	import { CheckCircleIcon, XCircleIcon } from '@lucide/svelte';
	import type { FirewallNatRule, FirewallNatAction, FirewallNatChain, FirewallProtocol } from '$lib/types/mikrotik-firewall';
	import { hasErrors, protocolNeedsPorts, validateNatRule } from '$lib/utils/mikrotik-firewall-validation';

	const props = $props<{
		initial?: Partial<FirewallNatRule>;
		submitLabel: string;
		onSubmit: (payload: Omit<FirewallNatRule, 'id' | 'createdAt' | 'updatedAt' | 'priority'>) => void;
		onCancel?: () => void;
	}>();

	const defaultDraft: Partial<FirewallNatRule> = {
		kind: 'nat',
		enabled: true,
		chain: 'srcnat',
		action: 'masquerade',
		protocol: 'any',
		log: false,
		comment: ''
	};

	let draft = $state<Partial<FirewallNatRule>>({ ...defaultDraft, ...(props.initial ?? {}) });
	let touched = $state(false);

	const errors = $derived(validateNatRule(draft));
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
			kind: 'nat',
			enabled: Boolean(draft.enabled ?? true),
			chain: (draft.chain ?? 'srcnat') as FirewallNatChain,
			action: (draft.action ?? 'masquerade') as FirewallNatAction,
			protocol: (draft.protocol ?? 'any') as FirewallProtocol,
			srcAddress: (draft.srcAddress ?? '').trim() || undefined,
			srcAddressList: (draft.srcAddressList ?? '').trim() || undefined,
			dstAddress: (draft.dstAddress ?? '').trim() || undefined,
			srcPort: (draft.srcPort ?? '').trim() || undefined,
			dstPort: (draft.dstPort ?? '').trim() || undefined,
			outInterface: (draft.outInterface ?? '').trim() || undefined,
			toAddresses: (draft.toAddresses ?? '').trim() || undefined,
			toPorts: (draft.toPorts ?? '').trim() || undefined,
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
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-chain">Cadena</label>
			<select
				id="nat-chain"
				bind:value={draft.chain}
				class={fieldClass(touched ? errors.chain : undefined)}
				aria-invalid={touched && !!errors.chain}
			>
				<option value="srcnat">srcnat</option>
				<option value="dstnat">dstnat</option>
			</select>
			{#if touched && errors.chain}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.chain}</div>
			{/if}
		</div>

		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-action">Acción</label>
			<select
				id="nat-action"
				bind:value={draft.action}
				class={fieldClass(touched ? errors.action : undefined)}
				aria-invalid={touched && !!errors.action}
			>
				<option value="masquerade">masquerade</option>
				<option value="src-nat">src-nat</option>
				<option value="dst-nat">dst-nat</option>
				<option value="redirect">redirect</option>
			</select>
			{#if touched && errors.action}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.action}</div>
			{/if}
		</div>

		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-protocol">Protocolo</label>
			<select
				id="nat-protocol"
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
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-src">Origen (IP/CIDR)</label>
			<input
				id="nat-src"
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
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-src-list">Origen (Address-List)</label>
			<input
				id="nat-src-list"
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
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-dst">Destino (IP/CIDR)</label>
			<input
				id="nat-dst"
				type="text"
				placeholder="10.0.0.10"
				bind:value={draft.dstAddress}
				class={fieldClass(touched ? errors.dstAddress : undefined)}
				aria-invalid={touched && !!errors.dstAddress}
			/>
			{#if touched && errors.dstAddress}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.dstAddress}</div>
			{/if}
		</div>
	</div>

	{#if showPorts}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
			<div>
				<label class="block text-sm font-medium text-foreground mb-2" for="nat-srcport">Puerto origen</label>
				<input
					id="nat-srcport"
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
				<label class="block text-sm font-medium text-foreground mb-2" for="nat-dstport">Puerto destino</label>
				<input
					id="nat-dstport"
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
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-outif">Out-Interface</label>
			<input
				id="nat-outif"
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
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-comment">Comentario</label>
			<input
				id="nat-comment"
				type="text"
				placeholder="Descripción opcional"
				bind:value={draft.comment}
				class={fieldClass(undefined)}
			/>
		</div>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-toaddr">To-Addresses</label>
			<input
				id="nat-toaddr"
				type="text"
				placeholder="10.0.0.10"
				bind:value={draft.toAddresses}
				class={fieldClass(touched ? errors.toAddresses : undefined)}
				aria-invalid={touched && !!errors.toAddresses}
			/>
			{#if touched && errors.toAddresses}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.toAddresses}</div>
			{/if}
		</div>
		<div>
			<label class="block text-sm font-medium text-foreground mb-2" for="nat-toports">To-Ports</label>
			<input
				id="nat-toports"
				type="text"
				placeholder="80"
				bind:value={draft.toPorts}
				class={fieldClass(touched ? errors.toPorts : undefined)}
				aria-invalid={touched && !!errors.toPorts}
			/>
			{#if touched && errors.toPorts}
				<div class="text-xs text-red-400 mt-1" role="alert">{errors.toPorts}</div>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-4">
		<label class="flex items-center gap-2 text-sm text-muted-foreground">
			<input type="checkbox" bind:checked={draft.enabled} />
			Habilitada
		</label>
		<label class="flex items-center gap-2 text-sm text-muted-foreground">
			<input type="checkbox" bind:checked={draft.log} />
			Log
		</label>
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
