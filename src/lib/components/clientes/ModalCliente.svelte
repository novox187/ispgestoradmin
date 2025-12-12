<script lang="ts">
	import { XIcon } from '@lucide/svelte';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { onMount } from 'svelte';

	// Svelte 5 runes props
	const props = $props<{ open: boolean; clientId: number | null; onClose: () => void }>();

	let loading = $state(false);
	let errorMsg = $state<string | null>(null);
	let client: any = $state(null);

	const API_BASE = (typeof window !== 'undefined' && (window as any).__API_BASE__) || 'http://localhost:8000/api';

	function statusLabel(s?: string) {
		if (!s) return 'Desconocido';
		const up = s.toUpperCase();
		if (up === 'ACTIVE' || up === 'ACTIVO') return 'Activo';
		if (up === 'LIMITED' || up === 'LIMITADO') return 'Limitado';
		if (up === 'SUSPENDED' || up === 'SUSPENDIDO') return 'Suspendido';
		return s;
	}

	function statusClass(s?: string) {
		if (!s) return 'bg-neutral-500/10 text-neutral-300';
		const up = s.toUpperCase();
		if (up === 'ACTIVE' || up === 'ACTIVO') return 'bg-green-500/10 text-green-400';
		if (up === 'LIMITED' || up === 'LIMITADO') return 'bg-yellow-500/10 text-yellow-400';
		if (up === 'SUSPENDED' || up === 'SUSPENDIDO') return 'bg-red-500/10 text-red-400';
		return 'bg-neutral-500/10 text-neutral-300';
	}

	async function fetchClient() {
		if (!props.clientId) return;
		loading = true;
		errorMsg = null;
		try {
			const res = await fetch(`${API_BASE}/clientes/full/${props.clientId}`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			client = await res.json();
        
		} catch (e: any) {
			errorMsg = e?.message || 'Error cargando cliente';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (props.open && props.clientId) {
			fetchClient();
		}
	});

	const animation =
		'transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} closeOnEscape closeOnInteractOutside onOpenChange={() => props.onClose?.()}>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
		<Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
			<Dialog.Content class="card bg-surface-100-900 w-full max-w-2xl p-4 space-y-4 shadow-xl rounded-xl {animation}">
				<header class="flex justify-between items-center">
					<Dialog.Title class="text-lg font-bold">Detalle del Cliente</Dialog.Title>
					<Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
						<XIcon class="size-4" />
					</Dialog.CloseTrigger>
				</header>
				<div class="space-y-6">
					{#if loading}
						<!-- Skeleton de carga -->
						<div class="space-y-6 animate-pulse">
							<div class="flex items-center justify-between">
								<div class="space-y-2">
									<div class="h-6 w-48 bg-neutral-800 rounded"></div>
									<div class="h-4 w-32 bg-neutral-800 rounded"></div>
								</div>
								<div class="h-6 w-20 bg-neutral-800 rounded-full"></div>
							</div>
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								{#each Array(6) as _}
									<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4 space-y-2">
										<div class="h-3 w-28 bg-neutral-800 rounded"></div>
										<div class="h-4 w-40 bg-neutral-700 rounded"></div>
									</div>
								{/each}
							</div>
							<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4 space-y-3">
								<div class="h-4 w-28 bg-neutral-800 rounded"></div>
								<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
									{#each Array(3) as _}
										<div class="h-14 bg-neutral-800 rounded"></div>
									{/each}
								</div>
							</div>
							<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4">
								<div class="h-4 w-24 bg-neutral-800 rounded mb-3"></div>
								{#each Array(3) as _}
									<div class="h-10 bg-neutral-800 rounded mb-2"></div>
								{/each}
							</div>
						</div>
					{:else if errorMsg}
						<p class="text-red-400">{errorMsg}</p>
					{:else if client}
						<!-- Encabezado con nombre y estado -->
						<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
							<div>
								<h3 class="text-xl font-semibold text-foreground">{client.full_name}</h3>
								<p class="text-sm text-muted-foreground">Doc: {client.document_id}</p>
							</div>
							<span class={`px-3 py-1 rounded-full text-xs font-medium ${statusClass(client.service_status)}`}>
								{statusLabel(client.service_status)}
							</span>
						</div>

						<!-- Grid de datos principales -->
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4">
								<div class="text-sm text-muted-foreground">Email</div>
								<div class="text-foreground font-medium break-words">{client.email}</div>
							</div>
							<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4">
								<div class="text-sm text-muted-foreground">Teléfono</div>
								<div class="text-foreground font-medium">{client.contact_phone}</div>
							</div>
							<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4 md:col-span-2">
								<div class="text-sm text-muted-foreground">Dirección de instalación</div>
								<div class="text-foreground font-medium break-words">{client.installation_address}</div>
							</div>
							<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4">
								<div class="text-sm text-muted-foreground">Coordenadas GPS</div>
								<div class="text-foreground font-medium">{client.gps_coordinates}</div>
							</div>
							<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4">
								<div class="text-sm text-muted-foreground">IP</div>
								<div class="text-foreground font-medium">{client.ip}</div>
							</div>
							<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4">
								<div class="text-sm text-muted-foreground">Fecha de contrato</div>
								<div class="text-foreground font-medium">{client.contract_date}</div>
							</div>
							<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4 md:col-span-2">
								<div class="text-sm text-muted-foreground">Observaciones</div>
								<div class="text-foreground">{client.observations || '—'}</div>
							</div>
						</div>

						<!-- Plan activo -->
						<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4 space-y-2">
							<div class="flex items-center justify-between">
								<div class="text-sm font-semibold">Plan activo</div>
								{#if client.client_plans?.length}
									<span class="text-xs text-muted-foreground">Inicio: {client.client_plans[0].start_date}{#if client.client_plans[0].end_date} • Fin: {client.client_plans[0].end_date}{/if}</span>
								{/if}
							</div>
							{#if client.client_plans?.length}
								{#key client.client_plans[0].id}
									<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
										<div class="bg-background/40 rounded-lg p-3 border border-neutral-800">
											<div class="text-xs text-muted-foreground">Nombre</div>
											<div class="text-foreground font-medium">{client.client_plans[0].plan?.name || '—'}</div>
										</div>
										<div class="bg-background/40 rounded-lg p-3 border border-neutral-800">
											<div class="text-xs text-muted-foreground">Velocidad</div>
											<div class="text-foreground font-medium">
												{#if client.client_plans[0].plan}
													{client.client_plans[0].plan.download_speed}↓ / {client.client_plans[0].plan.upload_speed}↑ Mbps
												{:else}—{/if}
											</div>
										</div>
										<div class="bg-background/40 rounded-lg p-3 border border-neutral-800">
											<div class="text-xs text-muted-foreground">Precio mensual</div>
											<div class="text-foreground font-medium">${client.client_plans[0].plan?.monthly_price ?? client.client_plans[0].current_price ?? '—'}</div>
										</div>
									</div>
								{/key}
							{:else}
								<p class="text-muted-foreground">Sin plan activo.</p>
							{/if}
						</div>

						<!-- Soportes recientes -->
						<div class="card bg-surface-100-900 border border-neutral-800 rounded-lg p-4">
							<div class="text-sm font-semibold mb-2">Soportes</div>
							{#if client.soportes?.length}
								<ul class="space-y-2 max-h-48 overflow-auto pr-1">
									{#each client.soportes as t}
										<li class="flex items-center justify-between gap-3 border border-neutral-800 rounded p-3">
											<div class="text-sm text-foreground">{t.subject}</div>
											<span class="text-xs text-muted-foreground">{t.status}</span>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="text-muted-foreground">Sin tickets de soporte.</p>
							{/if}
						</div>
					{:else}
						<p class="text-muted-foreground">Selecciona un cliente.</p>
					{/if}
				</div>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>
