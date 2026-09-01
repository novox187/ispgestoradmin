<script lang="ts">
	import { Cpu, AlertTriangle, CheckCircle2, Undo2, XCircle, ShieldCheck } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import ProvisioningStepper from './ProvisioningStepper.svelte';
	import {
		approveSession,
		cancelSession,
		rollbackSession,
		type ProvisioningSession
	} from '$lib/api/provisioning';

	let {
		session,
		onChanged
	}: { session: ProvisioningSession; onChanged?: () => void } = $props();

	let busy = $state(false);

	const device = $derived(
		session.device.identity ||
			session.device.board_name ||
			session.device.mac_address ||
			`Sesión #${session.id}`
	);

	const failed = $derived(session.status === 'failed' || session.status === 'rolled_back');

	async function act(
		action: () => Promise<unknown>,
		success: string
	): Promise<void> {
		busy = true;
		try {
			await action();
			toast.success(success);
			onChanged?.();
		} catch (e: any) {
			toast.error(e?.message ?? 'La operación no se pudo completar');
		} finally {
			busy = false;
		}
	}
</script>

<div
	class="bg-neutral-900 border rounded-xl p-4
		{session.status === 'completed'
		? 'border-green-500/25'
		: failed
			? 'border-red-500/25'
			: 'border-neutral-800'}"
>
	<div class="flex items-start justify-between gap-4 mb-4">
		<div class="min-w-0">
			<div class="flex items-center gap-2">
				<Cpu class="w-4 h-4 text-gray-500 shrink-0" />
				<span class="font-medium text-gray-100 truncate">{device}</span>
				<span class="text-[10px] font-mono text-neutral-600">#{session.id}</span>
			</div>

			<p class="text-xs font-mono text-gray-500 mt-1 truncate">
				{session.device.board_name ?? 'modelo desconocido'}
				{#if session.device.routeros_version}
					· RouterOS {session.device.routeros_version}
				{/if}
				{#if session.device.link_interface}
					· vía {session.device.link_interface}
				{/if}
			</p>
		</div>

		<span
			class="shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border
				{session.status === 'completed'
				? 'bg-green-500/10 text-green-400 border-green-500/20'
				: failed
					? 'bg-red-500/10 text-red-400 border-red-500/20'
					: session.status === 'awaiting_approval'
						? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
						: 'bg-blue-500/10 text-blue-400 border-blue-500/20'}"
		>
			{session.status_label}
		</span>
	</div>

	<ProvisioningStepper {session} />

	{#if session.vpn.assigned_ip}
		<div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-mono">
			<div class="text-gray-500">Dirección en la VPN</div>
			<div class="text-gray-300">{session.vpn.assigned_ip}</div>

			{#if session.vpn.endpoint}
				<div class="text-gray-500">Endpoint</div>
				<div class="text-gray-300 truncate">{session.vpn.endpoint}</div>
			{/if}

			{#if session.device.serial_number}
				<div class="text-gray-500">Serie</div>
				<div class="text-gray-300">{session.device.serial_number}</div>
			{/if}
		</div>
	{/if}

	{#if session.error_message}
		<div
			class="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20"
		>
			<AlertTriangle class="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
			<div class="min-w-0">
				{#if session.error_code}
					<p class="text-[11px] font-mono text-red-400">{session.error_code}</p>
				{/if}
				<p class="text-xs text-gray-400 mt-0.5 break-words">{session.error_message}</p>
			</div>
		</div>
	{/if}

	{#if session.status === 'completed' && session.router_id}
		<div
			class="mt-4 flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20"
		>
			<CheckCircle2 class="w-4 h-4 text-green-400 shrink-0" />
			<p class="text-xs text-gray-400">
				Registrado y alcanzable desde la aplicación. Falta asignarle a mano la subred de
				clientes y el gateway, que el alta automática no puede deducir.
			</p>
		</div>
	{/if}

	{#if !session.is_terminal}
		<div class="mt-4 flex items-center gap-2 flex-wrap">
			{#if session.status === 'awaiting_approval'}
				<button
					disabled={busy}
					onclick={() => act(() => approveSession(session.id), 'Alta aprobada')}
					class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold transition-colors disabled:opacity-40"
				>
					<ShieldCheck class="w-3.5 h-3.5" />
					Aprobar alta
				</button>
			{/if}

			<button
				disabled={busy}
				onclick={() =>
					act(() => cancelSession(session.id, 'Cancelada desde el panel.'), 'Alta cancelada')}
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-gray-400 hover:text-white hover:border-neutral-600 text-xs font-mono transition-colors disabled:opacity-40"
			>
				<XCircle class="w-3.5 h-3.5" />
				Cancelar
			</button>

			<button
				disabled={busy}
				onclick={() =>
					act(
						() => rollbackSession(session.id, 'Reversión forzada desde el panel.'),
						'Reversión iniciada'
					)}
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-gray-400 hover:text-amber-300 hover:border-amber-500/40 text-xs font-mono transition-colors disabled:opacity-40"
				title="Deshace lo aplicado en el router y en el hosting. Útil si un agente murió sin reportar."
			>
				<Undo2 class="w-3.5 h-3.5" />
				Forzar reversión
			</button>
		</div>
	{/if}
</div>
