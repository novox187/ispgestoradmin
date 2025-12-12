<script lang="ts">
	import { XIcon } from '@lucide/svelte';
	import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { createEventDispatcher } from 'svelte';

	export let newClient;
	export let showAddClient: boolean;
	export let handleAddClient;

	const dispatch = createEventDispatcher();


	// The following animation is optional.
	// This may also be included inline.
	const animation =
		'transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={showAddClient} closeOnEscape closeOnInteractOutside onOpenChange={(details) => {dispatch('close', details)}}>
	<Portal>
		<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
		<Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
			<Dialog.Content class="card bg-surface-100-900 w-full max-w-xl p-4 space-y-4 shadow-xl rounded-xl {animation}">
				<header class="flex justify-between items-center">
					<Dialog.Title class="text-lg font-bold">Agregar Nuevo Cliente</Dialog.Title>
					<Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
						<XIcon class="size-4" />
					</Dialog.CloseTrigger>
				</header>
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-foreground mb-2" for="newClientName">Nombre</label>
						<input
							id="newClientName"
							type="text"
							placeholder="Nombre completo"
							bind:value={newClient.name}
							class="w-full px-4 py-2 bg-background border border-neutral-500 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0 "
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-foreground mb-2" for="newClientEmail">Email</label>
						<input
							id="newClientEmail"
							type="email"
							placeholder="email@example.com"
							bind:value={newClient.email}
							class="w-full px-4 py-2 bg-background border border-neutral-500 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-foreground mb-2" for="newClientPhone">Teléfono</label>
						<input
							id="newClientPhone"
							type="tel"
							placeholder="+34 XXX XXX XXX"
							bind:value={newClient.phone}
							class="w-full px-4 py-2 bg-background border border-neutral-500 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-foreground mb-2" for="newClientPlan">Plan</label>
						<select
							id="newClientPlan"
							bind:value={newClient.plan}
							class="w-full px-4 py-2 bg-background border border-neutral-500 rounded-lg text-foreground focus:outline-none focus:ring-0 bg-neutral-900"
						>
							<option value="">Seleccionar plan</option>
							<option value="Basic">Basic</option>
							<option value="Premium">Premium</option>
							<option value="Business">Business</option>
						</select>
					</div>
					<div>
						<label class="block text-sm font-medium text-foreground mb-2" for="newClientStatus">Estado</label>
						<select
							id="newClientStatus"
							bind:value={newClient.status}
							class="w-full px-4 py-2 bg-background border border-neutral-500 rounded-lg text-foreground focus:outline-none focus:ring-0 bg-neutral-900"
						>
							<option value="active">Activo</option>
							<option value="suspended">Suspendido</option>
							<option value="inactive">Inactivo</option>
						</select>
					</div>
				</div>
				<footer class="flex justify-end gap-2">
					<Dialog.CloseTrigger class="btn preset-tonal">Cancelar</Dialog.CloseTrigger>
					<button type="button" class="btn preset-filled" onclick={handleAddClient}>Agregar</button>
				</footer>
			</Dialog.Content>
		</Dialog.Positioner>
	</Portal>
</Dialog>