<script lang="ts">
	import { Check, X, Loader2 } from '@lucide/svelte';
	import { PROVISIONING_STEPS, type ProvisioningSession } from '$lib/api/provisioning';

	let { session }: { session: ProvisioningSession } = $props();

	// Un alta que murió no debe pintar su paso como "en curso": lo marca en rojo
	// para que se vea de un golpe dónde se rompió.
	const failed = $derived(
		session.status === 'failed' ||
			session.status === 'rolled_back' ||
			session.status === 'cancelled'
	);
	const completed = $derived(session.status === 'completed');

	function stateOf(index: number): 'done' | 'current' | 'failed' | 'pending' {
		if (completed) return 'done';
		if (index < session.step_index) return 'done';
		if (index === session.step_index) return failed ? 'failed' : 'current';
		return 'pending';
	}
</script>

<div class="flex items-start gap-0 overflow-x-auto pb-1">
	{#each PROVISIONING_STEPS as step, index (step.label)}
		{@const state = stateOf(index)}
		<div class="flex items-start shrink-0">
			<div class="flex flex-col items-center gap-1.5 w-[92px]">
				<div
					class="w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-colors
						{state === 'done'
						? 'bg-green-500/15 border-green-500/40 text-green-400'
						: state === 'current'
							? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
							: state === 'failed'
								? 'bg-red-500/15 border-red-500/40 text-red-400'
								: 'bg-neutral-900 border-neutral-700 text-neutral-600'}"
					title={step.hint}
				>
					{#if state === 'done'}
						<Check class="w-3.5 h-3.5" />
					{:else if state === 'failed'}
						<X class="w-3.5 h-3.5" />
					{:else if state === 'current'}
						<Loader2 class="w-3.5 h-3.5 animate-spin" />
					{:else}
						<span class="text-[10px] font-mono">{index + 1}</span>
					{/if}
				</div>
				<span
					class="text-[10px] font-mono text-center leading-tight
						{state === 'pending' ? 'text-neutral-600' : 'text-gray-400'}"
				>
					{step.label}
				</span>
			</div>

			{#if index < PROVISIONING_STEPS.length - 1}
				<div
					class="h-px w-4 mt-3.5 shrink-0
						{index < session.step_index ? 'bg-green-500/40' : 'bg-neutral-700'}"
				></div>
			{/if}
		</div>
	{/each}
</div>
