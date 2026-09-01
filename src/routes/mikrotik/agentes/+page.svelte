<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Plus,
		RefreshCw,
		Server,
		Copy,
		KeyRound,
		Power,
		Trash2,
		X,
		Circle,
		ShieldAlert
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		fetchAgents,
		createAgent,
		regenerateAgentToken,
		setAgentActive,
		deleteAgent,
		type ProvisioningAgent,
		type AgentRole,
		type EnrolledAgent
	} from '$lib/api/provisioning';

	let agents = $state<ProvisioningAgent[]>([]);
	let loading = $state(false);
	let saving = $state(false);

	let showCreate = $state(false);
	let form = $state<{ name: string; role: AgentRole }>({ name: '', role: 'provisioner' });

	// El token solo existe una vez: en cuanto se cierra este panel no hay forma
	// de recuperarlo, solo de regenerarlo.
	let issued = $state<EnrolledAgent | null>(null);

	const hasVpnHost = $derived(agents.some((a) => a.role === 'vpn_host' && a.is_active && a.enrolled));
	const offline = $derived(agents.filter((a) => a.enrolled && a.is_active && !a.is_online));

	async function load() {
		loading = true;
		try {
			agents = await fetchAgents();
		} catch (e: any) {
			toast.error(e?.message ?? 'Error cargando agentes');
		} finally {
			loading = false;
		}
	}

	async function submit() {
		if (!form.name.trim()) {
			toast.error('El nombre es obligatorio');
			return;
		}

		saving = true;
		try {
			issued = await createAgent(form.name.trim(), form.role);
			showCreate = false;
			await load();
		} catch (e: any) {
			toast.error(e?.message ?? 'No se pudo registrar el agente');
		} finally {
			saving = false;
		}
	}

	async function regenerate(agent: ProvisioningAgent) {
		try {
			issued = await regenerateAgentToken(agent.id);
			toast.success('Token regenerado; las credenciales anteriores ya no sirven');
			await load();
		} catch (e: any) {
			toast.error(e?.message ?? 'No se pudo regenerar el token');
		}
	}

	async function toggle(agent: ProvisioningAgent) {
		try {
			await setAgentActive(agent.id, !agent.is_active);
			toast.success(agent.is_active ? 'Agente revocado' : 'Agente reactivado');
			await load();
		} catch (e: any) {
			toast.error(e?.message ?? 'No se pudo cambiar el estado');
		}
	}

	async function remove(agent: ProvisioningAgent) {
		try {
			await deleteAgent(agent.id);
			toast.success('Agente eliminado');
			await load();
		} catch (e: any) {
			toast.error(e?.message ?? 'No se pudo eliminar');
		}
	}

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success('Copiado al portapapeles');
		} catch {
			toast.error('El navegador no permitió copiar');
		}
	}

	function relative(iso: string | null): string {
		if (!iso) return 'nunca';
		const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
		if (seconds < 60) return `hace ${seconds}s`;
		if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
		if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
		return `hace ${Math.floor(seconds / 86400)}d`;
	}

	onMount(() => {
		load();
		const timer = setInterval(load, 15_000);
		return () => clearInterval(timer);
	});
</script>

<div class="flex items-start justify-between mb-4 gap-4">
	<p class="text-xs text-gray-500 font-mono max-w-2xl">
		Demonios que corren fuera del contenedor y permiten dar de alta routers automáticamente.
		Se conectan hacia la API por HTTPS; no hay que abrir ningún puerto.
	</p>

	<div class="flex items-center gap-2 shrink-0">
		<button
			onclick={load}
			disabled={loading}
			class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-700 text-gray-400 hover:text-white hover:border-neutral-600 text-xs font-mono transition-colors disabled:opacity-40"
		>
			<RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
			Actualizar
		</button>
		<button
			onclick={() => {
				form = { name: '', role: 'provisioner' };
				showCreate = true;
			}}
			class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold transition-colors"
		>
			<Plus class="w-3.5 h-3.5" />
			Registrar agente
		</button>
	</div>
</div>

{#if agents.length > 0 && !hasVpnHost}
	<div
		class="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25"
	>
		<ShieldAlert class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
		<p class="text-xs text-gray-400">
			No hay ningún agente <span class="font-mono text-amber-300">vpn_host</span> activo en el
			hosting. Mientras siga así ningún alta podrá completarse: no habría quien registre el peer
			del túnel.
		</p>
	</div>
{/if}

{#if offline.length > 0}
	<div class="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/25">
		<ShieldAlert class="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
		<p class="text-xs text-gray-400">
			{offline.length === 1 ? 'Un agente lleva' : `${offline.length} agentes llevan`} sin reportar
			más tiempo del admitido. Un agente caído no rompe nada de forma visible: simplemente deja de
			haber altas.
		</p>
	</div>
{/if}

<div class="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
	{#if loading && agents.length === 0}
		<div class="flex items-center justify-center py-16 gap-2 text-gray-500">
			<RefreshCw class="w-4 h-4 animate-spin" />
			<span class="text-sm font-mono">Cargando...</span>
		</div>
	{:else if agents.length === 0}
		<div class="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
			<Server class="w-8 h-8 opacity-20" />
			<p class="text-sm font-mono">No hay agentes registrados</p>
			<p class="text-xs text-neutral-600 max-w-md text-center">
				Hacen falta dos: uno en la oficina donde se enchufan los routers y otro en el servidor
				del hosting, junto al WireGuard.
			</p>
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-neutral-800">
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Agente</th>
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Rol</th>
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Estado</th>
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Ú. contacto</th>
						<th class="text-left px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider font-normal">Versión</th>
						<th class="px-4 py-3 w-28"></th>
					</tr>
				</thead>
				<tbody>
					{#each agents as agent (agent.id)}
						<tr class="border-b border-neutral-800/50 hover:bg-neutral-800/40 transition-colors last:border-0">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<Server class="w-3.5 h-3.5 text-gray-500 shrink-0" />
									<span class="font-medium text-gray-100">{agent.name}</span>
								</div>
								{#if agent.capabilities.endpoint_host}
									<p class="text-[11px] font-mono text-neutral-600 ml-5.5 mt-0.5">
										{agent.capabilities.endpoint_host}:{agent.capabilities.endpoint_port}
									</p>
								{:else if agent.capabilities.interfaces}
									<p class="text-[11px] font-mono text-neutral-600 ml-5.5 mt-0.5">
										NIC: {(agent.capabilities.interfaces as string[]).join(', ')}
									</p>
								{/if}
							</td>

							<td class="px-4 py-3">
								<span class="font-mono text-xs text-gray-400">{agent.role}</span>
							</td>

							<td class="px-4 py-3">
								{#if !agent.is_active}
									<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-neutral-800 text-gray-500 border border-neutral-700">
										Revocado
									</span>
								{:else if agent.pending_enrollment}
									<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-amber-500/10 text-amber-300 border border-amber-500/25">
										Sin enrolar
									</span>
								{:else if agent.is_online}
									<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-green-500/10 text-green-400 border border-green-500/20">
										<Circle class="w-2 h-2 fill-current" />
										En línea
									</span>
								{:else}
									<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-red-500/10 text-red-400 border border-red-500/20">
										<Circle class="w-2 h-2 fill-current" />
										Sin conexión
									</span>
								{/if}
							</td>

							<td class="px-4 py-3 font-mono text-xs text-gray-400">{relative(agent.last_seen_at)}</td>
							<td class="px-4 py-3 font-mono text-xs text-gray-500">{agent.agent_version ?? '—'}</td>

							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1">
									<button
										onclick={() => regenerate(agent)}
										class="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-neutral-800 transition-colors"
										title="Regenerar token de enrolamiento (invalida las credenciales actuales)"
									>
										<KeyRound class="w-3.5 h-3.5" />
									</button>
									<button
										onclick={() => toggle(agent)}
										class="p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-neutral-800 transition-colors"
										title={agent.is_active ? 'Revocar acceso' : 'Reactivar'}
									>
										<Power class="w-3.5 h-3.5" />
									</button>
									<button
										onclick={() => remove(agent)}
										class="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-neutral-800 transition-colors"
										title="Eliminar (solo si no tiene historial)"
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

<!-- Alta de agente -->
{#if showCreate}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md">
			<div class="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
				<h3 class="text-sm font-mono text-gray-200">Registrar agente</h3>
				<button onclick={() => (showCreate = false)} class="text-gray-500 hover:text-white">
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="p-5 space-y-4">
				<div>
					<label for="agent-name" class="block text-xs font-mono text-gray-500 mb-1.5">Nombre</label>
					<input
						id="agent-name"
						bind:value={form.name}
						placeholder="Bench oficina Quito"
						class="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="agent-role" class="block text-xs font-mono text-gray-500 mb-1.5">Rol</label>
					<select
						id="agent-role"
						bind:value={form.role}
						class="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
					>
						<option value="provisioner">provisioner — oficina, donde se enchufan los routers</option>
						<option value="vpn_host">vpn_host — servidor del hosting, junto al WireGuard</option>
					</select>
					<p class="text-[11px] text-neutral-600 mt-1.5">
						El rol acota lo que el agente puede hacer y a qué secretos llega: un
						<span class="font-mono">provisioner</span> nunca recibe claves del servidor, y un
						<span class="font-mono">vpn_host</span> nunca recibe credenciales de un router.
					</p>
				</div>
			</div>

			<div class="flex justify-end gap-2 px-5 py-4 border-t border-neutral-800">
				<button
					onclick={() => (showCreate = false)}
					class="px-3 py-1.5 rounded-lg border border-neutral-700 text-gray-400 hover:text-white text-xs font-mono transition-colors"
				>
					Cancelar
				</button>
				<button
					onclick={submit}
					disabled={saving}
					class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold transition-colors disabled:opacity-40"
				>
					{saving ? 'Registrando...' : 'Registrar'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Token de enrolamiento: se muestra una sola vez -->
{#if issued}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl">
			<div class="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
				<h3 class="text-sm font-mono text-gray-200">Enrolar «{issued.name}»</h3>
				<button onclick={() => (issued = null)} class="text-gray-500 hover:text-white">
					<X class="w-4 h-4" />
				</button>
			</div>

			<div class="p-5 space-y-4">
				<div class="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25">
					<ShieldAlert class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
					<p class="text-xs text-gray-400">
						Este token se muestra <strong>una sola vez</strong> y caduca en 30 minutos. No queda
						guardado en claro: si lo pierdes, hay que regenerarlo.
					</p>
				</div>

				<div>
					<div class="text-xs font-mono text-gray-500 mb-1.5">
						Ejecuta esto en la máquina del agente
					</div>
					<div class="relative">
						<pre class="p-3 pr-11 rounded-lg bg-neutral-950 border border-neutral-700 text-[11px] font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">{issued.enroll_command}</pre>
						<button
							onclick={() => copy(issued!.enroll_command)}
							class="absolute top-2 right-2 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-neutral-800 transition-colors"
							title="Copiar"
						>
							<Copy class="w-3.5 h-3.5" />
						</button>
					</div>
				</div>

				{#if issued.role === 'provisioner'}
					<p class="text-[11px] text-neutral-600">
						Añade <span class="font-mono text-gray-400">--interfaces &lt;NIC&gt;</span> con la
						tarjeta de red donde se enchufarán los routers. Solo se admitirán equipos vistos por
						ahí.
					</p>
				{:else}
					<p class="text-[11px] text-neutral-600">
						Añade <span class="font-mono text-gray-400">--endpoint-host &lt;dominio&gt;</span> con
						la dirección a la que marcarán los routers. La clave pública del servidor la lee el
						propio agente de la interfaz.
					</p>
				{/if}
			</div>

			<div class="flex justify-end px-5 py-4 border-t border-neutral-800">
				<button
					onclick={() => (issued = null)}
					class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold transition-colors"
				>
					Ya lo he copiado
				</button>
			</div>
		</div>
	</div>
{/if}
