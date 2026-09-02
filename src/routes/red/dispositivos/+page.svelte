<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import {
		createNetworkDevice,
		deleteNetworkDevice,
		fetchNetworkDevices,
		testNetworkDevice,
		updateNetworkDevice,
		STATUS_CLASSES,
		STATUS_LABELS,
		type DevicePayload,
		type DeviceRole,
		type DeviceVendor,
		type NetworkDevice
	} from '$lib/api/network-devices';
	import { Plug, Plus, Trash2, TriangleAlert, X } from '@lucide/svelte';

	const ROLES: { value: DeviceRole; label: string }[] = [
		{ value: 'backhaul_ap', label: 'Enlace troncal (AP)' },
		{ value: 'backhaul_station', label: 'Enlace troncal (estación)' },
		{ value: 'sector_ap', label: 'Sector de acceso' },
		{ value: 'cpe', label: 'Antena de cliente' },
		{ value: 'edge_router', label: 'Router de borde' },
		{ value: 'core_router', label: 'Router de núcleo' }
	];

	let devices = $state<NetworkDevice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let filtroVendor = $state<DeviceVendor | ''>('');

	let modalAbierto = $state(false);
	let editando = $state<NetworkDevice | null>(null);
	let guardando = $state(false);
	let probando = $state<number | null>(null);

	let form = $state<DevicePayload & { password: string }>(vacio());

	function vacio(): DevicePayload & { password: string } {
		return {
			name: '',
			vendor: 'ubiquiti',
			role: 'backhaul_ap',
			host: '',
			port: null,
			username: '',
			password: '',
			description: '',
			is_active: true,
			is_monitored: true
		};
	}

	const visibles = $derived(
		filtroVendor ? devices.filter((d) => d.vendor === filtroVendor) : devices
	);

	async function cargar() {
		loading = true;
		error = null;
		try {
			devices = await fetchNetworkDevices();
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudo cargar el inventario.';
		} finally {
			loading = false;
		}
	}

	onMount(cargar);

	function abrirAlta() {
		editando = null;
		form = vacio();
		modalAbierto = true;
	}

	function abrirEdicion(d: NetworkDevice) {
		editando = d;
		form = {
			name: d.name,
			vendor: (d.vendor ?? 'ubiquiti') as DeviceVendor,
			role: (d.role ?? 'backhaul_ap') as DeviceRole,
			host: d.host,
			port: d.port,
			username: d.username ?? '',
			// Nunca se precarga: el servidor no la devuelve, y dejar el campo
			// vacío significa «no la cambies».
			password: '',
			description: d.description ?? '',
			is_active: d.is_active,
			is_monitored: d.is_monitored
		};
		modalAbierto = true;
	}

	async function guardar() {
		guardando = true;
		try {
			if (editando) {
				await updateNetworkDevice(editando.id, form);
				toast.success(`«${form.name}» actualizado.`);
			} else {
				await createNetworkDevice(form);
				toast.success(`«${form.name}» dado de alta.`);
			}
			modalAbierto = false;
			await cargar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo guardar.');
		} finally {
			guardando = false;
		}
	}

	async function eliminar(d: NetworkDevice) {
		if (!confirm(`¿Eliminar «${d.name}» del inventario? Se perderán sus métricas.`)) return;

		try {
			await deleteNetworkDevice(d.id);
			toast.success(`«${d.name}» eliminado.`);
			await cargar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo eliminar.');
		}
	}

	/**
	 * Comprueba las credenciales sin esperar al primer ciclo del agente.
	 *
	 * Sirve para que un error de tecleo se vea al dar de alta y no al día
	 * siguiente en forma de alerta.
	 */
	async function probar(d: NetworkDevice) {
		probando = d.id;
		try {
			const r = await testNetworkDevice(d.id);
			if (r.ok) {
				toast.success(`«${d.name}» responde${r.model ? `: ${r.model}` : ''}.`);
			} else {
				toast.error(`«${d.name}» no responde: ${r.error ?? 'sin detalle'}`);
			}
			await cargar();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'No se pudo probar.');
		} finally {
			probando = null;
		}
	}
</script>

<div class="p-4 md:p-6 space-y-5">
	<header class="flex items-start justify-between gap-4 flex-wrap">
		<div>
			<h1 class="text-lg font-semibold text-neutral-100">Dispositivos</h1>
			<p class="text-xs text-neutral-500 mt-1">
				Todo el parque. Las antenas se dan de alta aquí; los routers MikroTik se gestionan desde
				<a href="/mikrotik/dispositivos" class="text-primary-400 hover:underline">su módulo</a>,
				que además decide cuál es el principal.
			</p>
		</div>

		<button
			onclick={abrirAlta}
			class="inline-flex items-center gap-1.5 rounded-lg border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-300 hover:bg-primary-500/20 transition-colors"
		>
			<Plus class="w-3.5 h-3.5" />
			Añadir antena
		</button>
	</header>

	<div class="flex gap-2">
		{#each [{ v: '', l: 'Todos' }, { v: 'mikrotik', l: 'MikroTik' }, { v: 'ubiquiti', l: 'Ubiquiti' }] as f}
			<button
				onclick={() => (filtroVendor = f.v as DeviceVendor | '')}
				class="rounded-lg border px-3 py-1 text-xs transition-colors
					{filtroVendor === f.v
					? 'border-primary-500/30 bg-primary-500/10 text-primary-300'
					: 'border-neutral-800/60 text-neutral-400 hover:text-neutral-200'}"
			>
				{f.l}
			</button>
		{/each}
	</div>

	{#if error}
		<div
			class="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-300"
		>
			<TriangleAlert class="w-4 h-4 shrink-0 mt-0.5" />
			<span>{error}</span>
		</div>
	{/if}

	{#if loading}
		<p class="text-xs text-neutral-600">Cargando…</p>
	{:else if visibles.length === 0}
		<p class="text-xs text-neutral-600">No hay equipos que mostrar.</p>
	{:else}
		<div class="rounded-xl border border-neutral-800/60 bg-neutral-900/40 overflow-x-auto">
			<table class="w-full text-xs">
				<thead>
					<tr class="text-left text-[10px] font-mono uppercase tracking-widest text-neutral-600">
						<th class="px-4 py-2.5 font-medium">Nombre</th>
						<th class="px-4 py-2.5 font-medium">Fabricante</th>
						<th class="px-4 py-2.5 font-medium">Papel</th>
						<th class="px-4 py-2.5 font-medium">Dirección</th>
						<th class="px-4 py-2.5 font-medium">Modelo</th>
						<th class="px-4 py-2.5 font-medium">Estado</th>
						<th class="px-4 py-2.5 font-medium text-right">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each visibles as d (d.id)}
						<tr class="border-t border-neutral-800/40 hover:bg-neutral-800/20">
							<td class="px-4 py-2.5">
								<span class="text-neutral-200">{d.name}</span>
								{#if d.is_primary}
									<span class="ml-1.5 text-[9px] font-mono text-primary-400">PRINCIPAL</span>
								{/if}
								{#if !d.is_monitored}
									<span class="ml-1.5 text-[9px] font-mono text-neutral-600">SIN SONDEO</span>
								{/if}
							</td>
							<td class="px-4 py-2.5 text-neutral-400">{d.vendor_label ?? '—'}</td>
							<td class="px-4 py-2.5 text-neutral-400">{d.role_label ?? '—'}</td>
							<td class="px-4 py-2.5 font-mono text-neutral-500">{d.host}</td>
							<td class="px-4 py-2.5 text-neutral-500">{d.model ?? '—'}</td>
							<td class="px-4 py-2.5">
								<span
									class="inline-block rounded border px-1.5 py-0.5 text-[10px]
										{STATUS_CLASSES[d.connectivity_status ?? 'unknown']}"
								>
									{STATUS_LABELS[d.connectivity_status ?? 'unknown']}
								</span>
							</td>
							<td class="px-4 py-2.5">
								<div class="flex items-center justify-end gap-1">
									<button
										onclick={() => probar(d)}
										disabled={probando === d.id}
										title="Comprobar credenciales ahora"
										class="rounded p-1.5 text-neutral-500 hover:text-primary-400 hover:bg-neutral-800/60 disabled:opacity-40"
									>
										<Plug class="w-3.5 h-3.5" />
									</button>
									{#if d.editable}
										<button
											onclick={() => abrirEdicion(d)}
											class="rounded px-2 py-1 text-[11px] text-neutral-400 hover:text-white hover:bg-neutral-800/60"
										>
											Editar
										</button>
										<button
											onclick={() => eliminar(d)}
											title="Eliminar del inventario"
											class="rounded p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800/60"
										>
											<Trash2 class="w-3.5 h-3.5" />
										</button>
									{:else}
										<a
											href="/mikrotik/dispositivos"
											class="rounded px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-300"
											title="Los routers MikroTik se gestionan en su propio módulo"
										>
											Ver en MikroTik
										</a>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if modalAbierto}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div
			class="w-full max-w-lg rounded-xl border border-neutral-800 bg-[#0f0f12] p-5 max-h-[90vh] overflow-y-auto"
		>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-sm font-semibold text-neutral-100">
					{editando ? `Editar «${editando.name}»` : 'Añadir antena'}
				</h2>
				<button
					onclick={() => (modalAbierto = false)}
					class="rounded p-1 text-neutral-500 hover:text-white"
					aria-label="Cerrar"
				>
					<X class="w-4 h-4" />
				</button>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					guardar();
				}}
				class="space-y-3"
			>
				<label class="block">
					<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Nombre</span
					>
					<input
						bind:value={form.name}
						required
						placeholder="Enlace Torre Norte"
						class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
					/>
				</label>

				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
							Papel en la red
						</span>
						<select
							bind:value={form.role}
							class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
						>
							{#each ROLES as r}
								<option value={r.value}>{r.label}</option>
							{/each}
						</select>
					</label>

					<label class="block">
						<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
							Dirección IP
						</span>
						<input
							bind:value={form.host}
							required
							placeholder="10.9.0.5"
							class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs font-mono text-neutral-100 focus:border-primary-500/40 focus:outline-none"
						/>
					</label>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
							Usuario
						</span>
						<input
							bind:value={form.username}
							placeholder="ubnt"
							class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
						/>
					</label>

					<label class="block">
						<span class="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
							Contraseña
						</span>
						<input
							type="password"
							bind:value={form.password}
							placeholder={editando ? 'Sin cambios' : '••••'}
							class="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-100 focus:border-primary-500/40 focus:outline-none"
						/>
					</label>
				</div>

				<p class="text-[10px] text-neutral-600 leading-relaxed">
					Si dejas usuario y contraseña vacíos, el equipo usará el perfil de credenciales que tenga
					asignado. Conviene un usuario de <strong class="text-neutral-500">solo lectura</strong> en
					airOS: el sistema no escribe nada en las antenas.
				</p>

				<div class="flex gap-4 pt-1">
					<label class="flex items-center gap-2 text-xs text-neutral-400">
						<input type="checkbox" bind:checked={form.is_active} class="accent-primary-500" />
						Activo
					</label>
					<label class="flex items-center gap-2 text-xs text-neutral-400">
						<input type="checkbox" bind:checked={form.is_monitored} class="accent-primary-500" />
						Sondear periódicamente
					</label>
				</div>

				<div class="flex justify-end gap-2 pt-3">
					<button
						type="button"
						onclick={() => (modalAbierto = false)}
						class="rounded-lg px-3 py-1.5 text-xs text-neutral-400 hover:text-white"
					>
						Cancelar
					</button>
					<button
						type="submit"
						disabled={guardando}
						class="rounded-lg border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-xs font-medium text-primary-300 hover:bg-primary-500/20 disabled:opacity-50"
					>
						{guardando ? 'Guardando…' : editando ? 'Guardar' : 'Añadir'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
