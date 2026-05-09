<script lang="ts">
	import { onMount } from 'svelte';
	import { Plus, Edit2, Trash2, Server, RefreshCw, CheckCircle, XCircle, X, Eye, EyeOff } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		fetchMikrotikRouters,
		createMikrotikRouter,
		updateMikrotikRouter,
		deleteMikrotikRouter,
		type MikrotikRouter,
		type CreateRouterPayload,
		type UpdateRouterPayload
	} from '$lib/api/mikrotik-routers';

	let routers = $state<MikrotikRouter[]>([]);
	let loading = $state(false);
	let saving = $state(false);
	let deleting = $state(false);

	let showModal = $state(false);
	let editingRouter = $state<MikrotikRouter | null>(null);
	let showPassword = $state(false);
	let confirmDeleteId = $state<number | null>(null);

	let form = $state({
		name: '',
		host: '',
		port: '' as string | number,
		username: '',
		password: '',
		description: '',
		is_active: true
	});

	async function loadRouters() {
		loading = true;
		try {
			routers = await fetchMikrotikRouters();
		} catch (e: any) {
			toast.error(e?.message ?? 'Error cargando routers');
		} finally {
			loading = false;
		}
	}

	function openCreate() {
		editingRouter = null;
		form = { name: '', host: '', port: 8728, username: 'admin', password: '', description: '', is_active: true };
		showPassword = false;
		showModal = true;
	}

	function openEdit(router: MikrotikRouter) {
		editingRouter = router;
		form = {
			name: router.name,
			host: router.host,
			port: router.port ?? '',
			username: router.username,
			password: '',
			description: router.description ?? '',
			is_active: router.is_active
		};
		showPassword = false;
		showModal = true;
	}

	async function saveRouter() {
		if (saving) return;
		saving = true;
		try {
			const portNum = form.port !== '' ? Number(form.port) : null;

			if (editingRouter) {
				const payload: UpdateRouterPayload = {
					name: form.name,
					host: form.host,
					port: portNum,
					username: form.username,
					description: form.description || null,
					is_active: form.is_active
				};
				if (form.password) payload.password = form.password;

				const updated = await updateMikrotikRouter(editingRouter.id, payload);
				routers = routers.map((r) => (r.id === editingRouter!.id ? updated : r));
				toast.success('Router actualizado');
			} else {
				const payload: CreateRouterPayload = {
					name: form.name,
					host: form.host,
					port: portNum,
					username: form.username,
					password: form.password,
					description: form.description || null,
					is_active: form.is_active
				};
				const created = await createMikrotikRouter(payload);
				routers = [...routers, created];
				toast.success('Router creado');
			}
			showModal = false;
		} catch (e: any) {
			toast.error(e?.message ?? 'Error guardando router');
		} finally {
			saving = false;
		}
	}

	async function executeDelete() {
		if (!confirmDeleteId || deleting) return;
		deleting = true;
		const id = confirmDeleteId;
		try {
			await deleteMikrotikRouter(id);
			routers = routers.filter((r) => r.id !== id);
			confirmDeleteId = null;
			toast.success('Router eliminado');
		} catch (e: any) {
			toast.error(e?.message ?? 'Error eliminando router');
		} finally {
			deleting = false;
		}
	}

	function formatDate(ts: number | null): string {
		if (!ts) return '—';
		return new Date(ts).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
	}

	onMount(() => loadRouters());
</script>

<!-- Toolbar -->
<div class="flex items-center justify-between mb-4">
	<p class="text-xs text-gray-500 font-mono">
		{routers.length} {routers.length === 1 ? 'router registrado' : 'routers registrados'}
	</p>
	<div class="flex items-center gap-2">
		<button
			onclick={() => loadRouters()}
			disabled={loading}
			class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-gray-400 hover:text-white hover:border-neutral-600 text-xs font-mono transition-colors disabled:opacity-40"
		>
			<RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
			Actualizar
		</button>
		<button
			onclick={() => openCreate()}
			class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold transition-colors"
		>
			<Plus class="w-3.5 h-3.5" />
			Nuevo router
		</button>
	</div>
</div>

<!-- Table -->
<div class="bg-[#111111] border border-neutral-800 rounded-xl overflow-hidden">
	{#if loading && routers.length === 0}
		<div class="flex items-center justify-center py-16 gap-2 text-gray-500">
			<RefreshCw class="w-4 h-4 animate-spin" />
			<span class="text-sm font-mono">Cargando...</span>
		</div>
	{:else if routers.length === 0}
		<div class="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
			<Server class="w-8 h-8 opacity-20" />
			<p class="text-sm font-mono">No hay routers registrados</p>
			<button
				onclick={() => openCreate()}
				class="text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
			>
				+ Agregar el primer router
			</button>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-neutral-800">
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Nombre</th>
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Host</th>
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Puerto</th>
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Usuario</th>
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Estado</th>
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Ú. Sync</th>
						<th class="px-4 py-3 w-20"></th>
					</tr>
				</thead>
				<tbody>
					{#each routers as router (router.id)}
						<tr class="border-b border-neutral-800/50 hover:bg-neutral-900/40 transition-colors last:border-0">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<Server class="w-3.5 h-3.5 text-gray-500 shrink-0" />
									<span class="font-medium text-gray-100">{router.name}</span>
								</div>
								{#if router.description}
									<p class="text-xs text-gray-500 ml-5.5 mt-0.5 truncate max-w-[200px]">{router.description}</p>
								{/if}
							</td>
							<td class="px-4 py-3 font-mono text-xs text-gray-300">{router.host}</td>
							<td class="px-4 py-3 font-mono text-xs text-gray-400">{router.port ?? 8728}</td>
							<td class="px-4 py-3 font-mono text-xs text-gray-400">{router.username}</td>
							<td class="px-4 py-3">
								{#if router.is_active}
									<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-green-500/10 text-green-400 border border-green-500/20">
										<CheckCircle class="w-3 h-3" />
										Activo
									</span>
								{:else}
									<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-neutral-800 text-gray-500 border border-neutral-700">
										<XCircle class="w-3 h-3" />
										Inactivo
									</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-xs text-gray-500 font-mono">{formatDate(router.last_loaded_at)}</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1 justify-end">
									<button
										onclick={() => openEdit(router)}
										class="p-1.5 rounded-md hover:bg-neutral-800 text-gray-500 hover:text-white transition-colors"
										title="Editar"
									>
										<Edit2 class="w-3.5 h-3.5" />
									</button>
									<button
										onclick={() => (confirmDeleteId = router.id)}
										class="p-1.5 rounded-md hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors"
										title="Eliminar"
									>
										<Trash2 class="w-3.5 h-3.5" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Create / Edit Modal -->
{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={() => (showModal = false)}
			onkeydown={(e) => e.key === 'Escape' && (showModal = false)}
			role="button"
			tabindex="-1"
			aria-label="Cerrar modal"
		></div>

		<div class="relative bg-[#111111] border border-neutral-800 rounded-xl w-full max-w-lg shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
				<div class="flex items-center gap-2.5">
					<Server class="w-4 h-4 text-blue-400" />
					<h3 class="font-semibold text-gray-100 text-sm">
						{editingRouter ? 'Editar router' : 'Nuevo router'}
					</h3>
				</div>
				<button
					onclick={() => (showModal = false)}
					class="p-1 rounded hover:bg-neutral-800 text-gray-500 hover:text-white transition-colors"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<!-- Form -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					saveRouter();
				}}
				class="p-5 space-y-4"
			>
				<div class="grid grid-cols-2 gap-4">
					<!-- Name -->
					<div class="col-span-2">
						<label class="block text-xs font-mono text-gray-400 mb-1.5">
							Nombre <span class="text-red-400">*</span>
						</label>
						<input
							bind:value={form.name}
							type="text"
							required
							placeholder="Router Principal"
							class="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
						/>
					</div>

					<!-- Host -->
					<div>
						<label class="block text-xs font-mono text-gray-400 mb-1.5">
							Host / IP <span class="text-red-400">*</span>
						</label>
						<input
							bind:value={form.host}
							type="text"
							required
							placeholder="192.168.88.1"
							class="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
						/>
					</div>

					<!-- Port -->
					<div>
						<label class="block text-xs font-mono text-gray-400 mb-1.5">Puerto</label>
						<input
							bind:value={form.port}
							type="number"
							min="1"
							max="65535"
							placeholder="8728"
							class="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
						/>
					</div>

					<!-- Username -->
					<div>
						<label class="block text-xs font-mono text-gray-400 mb-1.5">
							Usuario <span class="text-red-400">*</span>
						</label>
						<input
							bind:value={form.username}
							type="text"
							required
							placeholder="admin"
							class="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
						/>
					</div>

					<!-- Password -->
					<div>
						<label class="block text-xs font-mono text-gray-400 mb-1.5">
							Contraseña
							{#if !editingRouter}
								<span class="text-red-400">*</span>
							{:else}
								<span class="text-gray-600 text-[10px]">(vacío = sin cambio)</span>
							{/if}
						</label>
						<div class="relative">
							<input
								bind:value={form.password}
								type={showPassword ? 'text' : 'password'}
								required={!editingRouter}
								placeholder={editingRouter ? '••••••••' : 'Contraseña'}
								class="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 pr-9 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
							/>
							<button
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
							>
								{#if showPassword}
									<EyeOff class="w-3.5 h-3.5" />
								{:else}
									<Eye class="w-3.5 h-3.5" />
								{/if}
							</button>
						</div>
					</div>

					<!-- Description -->
					<div class="col-span-2">
						<label class="block text-xs font-mono text-gray-400 mb-1.5">Descripción</label>
						<textarea
							bind:value={form.description}
							rows="2"
							placeholder="Ej: Router de distribución zona norte"
							class="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
						></textarea>
					</div>

					<!-- Is Active toggle -->
					<div class="col-span-2">
						<label class="flex items-center gap-3 cursor-pointer group select-none">
							<div class="relative shrink-0">
								<input type="checkbox" bind:checked={form.is_active} class="sr-only" />
								<div
									class="w-9 h-5 rounded-full transition-colors {form.is_active
										? 'bg-blue-600'
										: 'bg-neutral-700'}"
								></div>
								<div
									class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform {form.is_active
										? 'translate-x-4'
										: ''}"
								></div>
							</div>
							<span class="text-sm text-gray-300 group-hover:text-white transition-colors">
								Router activo
							</span>
						</label>
					</div>
				</div>

				<!-- Footer -->
				<div class="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
					<button
						type="button"
						onclick={() => (showModal = false)}
						class="px-4 py-2 text-xs font-mono rounded-lg border border-neutral-700 text-gray-400 hover:text-white hover:border-neutral-600 transition-colors"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={saving}
						class="px-4 py-2 text-xs font-mono rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if saving}
							Guardando...
						{:else if editingRouter}
							Guardar cambios
						{:else}
							Crear router
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation -->
{#if confirmDeleteId !== null}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={() => (confirmDeleteId = null)}
			role="button"
			tabindex="-1"
			aria-label="Cancelar"
		></div>
		<div
			class="relative bg-[#111111] border border-red-900/30 rounded-xl w-full max-w-sm shadow-2xl p-5 space-y-4"
		>
			<div class="flex items-start gap-3">
				<div class="p-2 rounded-lg bg-red-900/20 shrink-0">
					<Trash2 class="w-4 h-4 text-red-400" />
				</div>
				<div>
					<h3 class="font-semibold text-gray-100 text-sm">Eliminar router</h3>
					<p class="text-xs text-gray-400 mt-1 leading-relaxed">
						Esta acción no se puede deshacer. El router y sus credenciales serán eliminados permanentemente.
					</p>
				</div>
			</div>
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => (confirmDeleteId = null)}
					class="px-3 py-1.5 text-xs font-mono rounded-lg border border-neutral-700 text-gray-400 hover:text-white transition-colors"
				>
					Cancelar
				</button>
				<button
					onclick={() => executeDelete()}
					disabled={deleting}
					class="px-3 py-1.5 text-xs font-mono rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50"
				>
					{deleting ? 'Eliminando...' : 'Eliminar'}
				</button>
			</div>
		</div>
	</div>
{/if}
