<script lang="ts">
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { fade } from 'svelte/transition';
    import { API_BASE } from '$lib/config';
    import { PERMISSION_MODULES, ALL_ACTIONS } from '$lib/config/permissions';
    import { auth } from '$lib/stores/auth.svelte';
    import ModalConfirmacion from '$lib/components/common/ModalConfirmacion.svelte';
    import ModalCrearRol from '$lib/components/usuarios/roles/ModalCrearRol.svelte';
    import ModalEditarRol from '$lib/components/usuarios/roles/ModalEditarRol.svelte';
    import {
        PlusIcon, Pencil, Trash2, Shield, Users, Lock, Key, Info
    } from '@lucide/svelte';
    import type { RoleOption, Permission } from '$lib/stores/usuarios.svelte';

    let activeTab = $state<'roles' | 'mapa'>('roles');

    let roles          = $state<RoleOption[]>([]);
    let allPermissions = $state<Permission[]>([]);
    let rolesLoading   = $state(true);

    function getToken() { return typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null; }
    function headers()  { const t = getToken(); return { Accept: 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) }; }

    // ── Roles ────────────────────────────────────────────────────────────────────
    let showCreate = $state(false);
    let showEdit   = $state(false);
    let editRoleId = $state<number | null>(null);

    let confirmOpen    = $state(false);
    let confirmLoading = $state(false);
    let confirmError   = $state<string | null>(null);
    let pendingDeleteRoleId   = $state<number | null>(null);
    let pendingDeleteRoleName = $state('');

    async function fetchRoles() {
        rolesLoading = true;
        try {
            const res = await fetch(`${API_BASE}/admin/roles`, { headers: headers() });
            if (res.ok) { const j = await res.json(); roles = j.data ?? []; }
            else toast.error('Error al cargar roles');
        } catch { toast.error('Error de conexión'); }
        finally { rolesLoading = false; }
    }

    async function fetchPermissions() {
        try {
            const res = await fetch(`${API_BASE}/admin/roles/permissions`, { headers: headers() });
            if (res.ok) { const j = await res.json(); allPermissions = j.data ?? j ?? []; }
        } catch {}
    }

    function openDeleteRole(role: RoleOption) {
        pendingDeleteRoleId = role.id; pendingDeleteRoleName = role.nombre;
        confirmError = null; confirmOpen = true;
    }

    async function handleConfirmDeleteRole() {
        if (!pendingDeleteRoleId) return;
        confirmLoading = true; confirmError = null;
        try {
            const res = await fetch(`${API_BASE}/admin/roles/${pendingDeleteRoleId}`, { method: 'DELETE', headers: headers() });
            if (res.ok) { toast.success('Rol eliminado'); confirmOpen = false; fetchRoles(); }
            else { const d = await res.json(); confirmError = d.message ?? 'Error'; toast.error(confirmError!); }
        } catch { confirmError = 'Error de conexión'; }
        finally { confirmLoading = false; }
    }

    const totalPerms = $derived(PERMISSION_MODULES.reduce((s, m) => s + m.actions.length, 0));

    onMount(() => { fetchRoles(); fetchPermissions(); });
</script>

<div class="px-4 md:px-8 py-8 max-w-7xl space-y-6">

    <!-- Header de sección -->
    <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
            <div class="flex items-center gap-2.5 mb-2">
                <Shield class="w-5 h-5 text-primary-400" />
                <h2 class="text-lg font-semibold text-neutral-100">Seguridad y Permisos</h2>
            </div>
            <p class="text-sm text-neutral-500">Gestiona los roles, los permisos granulares y el control de acceso del sistema.</p>
        </div>
        {#if activeTab === 'roles' && auth.isSuperAdmin}
            <button onclick={() => showCreate = true}
                class="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-colors">
                <PlusIcon class="size-4" strokeWidth={2.5} /> Nuevo Rol
            </button>
        {/if}
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-4">
        <div class="bg-card border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
            <div class="p-3 bg-purple-500/10 rounded-xl"><Shield class="size-5 text-purple-400" /></div>
            <div><p class="text-2xl font-bold">{roles.length}</p><p class="text-xs text-neutral-400">Roles</p></div>
        </div>
        <div class="bg-card border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
            <div class="p-3 bg-green-500/10 rounded-xl"><Key class="size-5 text-green-400" /></div>
            <div><p class="text-2xl font-bold">{totalPerms}</p><p class="text-xs text-neutral-400">Permisos en el sistema</p></div>
        </div>
        <div class="bg-card border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
            <div class="p-3 bg-blue-500/10 rounded-xl"><Users class="size-5 text-blue-400" /></div>
            <div><p class="text-2xl font-bold">{roles.reduce((s, r) => s + (r.employees_count ?? 0), 0)}</p><p class="text-xs text-neutral-400">Empleados</p></div>
        </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 w-fit">
        <button
            onclick={() => activeTab = 'roles'}
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'roles' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400 hover:text-neutral-200'}"
        >
            <Shield class="size-4" /> Roles
        </button>
        <button
            onclick={() => activeTab = 'mapa'}
            class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'mapa' ? 'bg-neutral-700 text-white shadow' : 'text-neutral-400 hover:text-neutral-200'}"
        >
            <Key class="size-4" /> Mapa de permisos
        </button>
    </div>

    <!-- ─── TAB: ROLES ──────────────────────────────────────────────────────── -->
    {#if activeTab === 'roles'}
        <div transition:fade={{ duration: 120 }}>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {#if rolesLoading}
                    {#each Array(3) as _}
                        <div class="bg-card border border-neutral-800 rounded-xl p-5 space-y-4 animate-pulse">
                            <div class="h-5 w-32 bg-neutral-800 rounded"></div>
                            <div class="h-3 w-48 bg-neutral-800 rounded"></div>
                            <div class="flex gap-1 flex-wrap">{#each Array(4) as _}<div class="h-5 w-16 bg-neutral-800 rounded"></div>{/each}</div>
                        </div>
                    {/each}
                {:else if roles.length === 0}
                    <div class="col-span-full py-12 text-center text-neutral-500">
                        <Shield class="size-10 mx-auto mb-3 opacity-30" />
                        <p>No hay roles creados.</p>
                    </div>
                {:else}
                    {#each roles as role (role.id)}
                        <div class="bg-card border border-neutral-800 rounded-xl p-5 flex flex-col gap-4 hover:border-neutral-700 transition-colors">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <h3 class="text-base font-semibold truncate">{role.nombre}</h3>
                                    <p class="text-xs text-neutral-500 font-mono mt-0.5">{role.slug}</p>
                                    {#if role.descripcion}
                                        <p class="text-xs text-neutral-400 mt-1.5 line-clamp-2">{role.descripcion}</p>
                                    {/if}
                                </div>
                                {#if auth.isSuperAdmin}
                                    <div class="flex gap-1 flex-shrink-0">
                                        <button onclick={() => { editRoleId = role.id; showEdit = true; }}
                                            class="p-1.5 rounded-lg hover:bg-blue-500/10 text-neutral-500 hover:text-blue-400 transition-colors" title="Editar">
                                            <Pencil class="size-4" />
                                        </button>
                                        <button onclick={() => openDeleteRole(role)}
                                            class="p-1.5 rounded-lg hover:bg-red-500/10 text-neutral-500 hover:text-red-400 transition-colors" title="Eliminar">
                                            <Trash2 class="size-4" />
                                        </button>
                                    </div>
                                {/if}
                            </div>

                            <div class="flex items-center gap-3 text-xs text-neutral-500 border-t border-neutral-800 pt-3">
                                <span class="flex items-center gap-1"><Users class="size-3.5" /> {role.employees_count ?? 0} empleado(s)</span>
                                <span class="flex items-center gap-1"><Lock class="size-3.5" /> {role.permissions?.length ?? 0} permiso(s)</span>
                            </div>

                            {#if role.permissions && role.permissions.length > 0}
                                <div class="flex flex-wrap gap-1">
                                    {#each role.permissions.slice(0, 6) as perm}
                                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono">{perm.slug}</span>
                                    {/each}
                                    {#if (role.permissions?.length ?? 0) > 6}
                                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">+{(role.permissions?.length ?? 0) - 6}</span>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}

    <!-- ─── TAB: MAPA DE PERMISOS ──────────────────────────────────────────── -->
    {#if activeTab === 'mapa'}
        <div class="space-y-4" transition:fade={{ duration: 120 }}>

            <div class="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
                <Info class="size-4 mt-0.5 flex-shrink-0" />
                <p>
                    Los permisos están definidos en el código (<code class="font-mono text-xs bg-blue-500/10 px-1 rounded">src/lib/config/permissions.ts</code>).
                    Para agregar un nuevo módulo o acción, edita ese archivo y ejecuta
                    <code class="font-mono text-xs bg-blue-500/10 px-1 rounded">php artisan db:seed --class=PermissionSeeder</code>.
                </p>
            </div>

            <div class="bg-card border border-neutral-800 rounded-xl overflow-hidden">
                <div class="px-5 py-4 border-b border-neutral-800">
                    <h3 class="text-sm font-semibold text-neutral-300">Matriz de permisos del sistema</h3>
                    <p class="text-xs text-neutral-500 mt-0.5">{PERMISSION_MODULES.length} módulos · {totalPerms} permisos · formato <span class="font-mono">módulo.acción</span></p>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-xs">
                        <thead>
                            <tr class="bg-neutral-800/40 border-b border-neutral-800">
                                <th class="px-5 py-3 text-left font-semibold text-neutral-400 w-40">Módulo</th>
                                {#each ALL_ACTIONS as action}
                                    <th class="px-4 py-3 text-center font-semibold text-neutral-400 capitalize">{action}</th>
                                {/each}
                            </tr>
                        </thead>
                        <tbody>
                            {#each PERMISSION_MODULES as mod}
                                <tr class="border-b border-neutral-800 hover:bg-neutral-800/20 transition-colors">
                                    <td class="px-5 py-3 font-medium text-neutral-200">{mod.label}</td>
                                    {#each ALL_ACTIONS as action}
                                        <td class="px-4 py-3 text-center">
                                            {#if (mod.actions as readonly string[]).includes(action)}
                                                <span class="inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                    {mod.slug}.{action}
                                                </span>
                                            {:else}
                                                <span class="text-neutral-700">—</span>
                                            {/if}
                                        </td>
                                    {/each}
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    {/if}

</div>

<ModalCrearRol open={showCreate} {allPermissions}
    on:close={() => showCreate = false}
    on:created={() => { showCreate = false; fetchRoles(); }} />

<ModalEditarRol open={showEdit} roleId={editRoleId} {allPermissions}
    on:close={() => { showEdit = false; editRoleId = null; }}
    on:updated={() => { showEdit = false; editRoleId = null; fetchRoles(); }} />

<ModalConfirmacion bind:open={confirmOpen}
    title="Eliminar Rol" message="¿Eliminar el rol '{pendingDeleteRoleName}'? Esta acción no se puede deshacer."
    confirmText="Sí, eliminar" cancelText="Cancelar" type="danger"
    loading={confirmLoading} error={confirmError}
    on:confirm={handleConfirmDeleteRole} on:cancel={() => confirmOpen = false} />
