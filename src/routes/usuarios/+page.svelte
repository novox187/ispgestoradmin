<script lang="ts">
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { fade, scale } from 'svelte/transition';
    import { Pagination } from '@skeletonlabs/skeleton-svelte';
    import {
        ArrowLeftIcon, ArrowRightIcon, PlusIcon, RotateCcw,
        Search, Filter, Users, Shield, X, SlidersHorizontal
    } from '@lucide/svelte';

    import Encabezado from '$lib/components/Encabezado.svelte';
    import TablaUsuarios from '$lib/components/usuarios/TablaUsuarios.svelte';
    import ModalCrearUsuario from '$lib/components/usuarios/ModalCrearUsuario.svelte';
    import ModalEditarUsuario from '$lib/components/usuarios/ModalEditarUsuario.svelte';
    import ModalVerUsuario from '$lib/components/usuarios/ModalVerUsuario.svelte';
    import ModalConfirmacion from '$lib/components/common/ModalConfirmacion.svelte';
    import { appState } from '$lib/stores/app.svelte';
    import { usuariosStore } from '$lib/stores/usuarios.svelte';
    import { auth } from '$lib/stores/auth.svelte';

    function toggleSidebar() { appState.toggleSidebar(); }
    function toggleNotifications() { appState.toggleNotifications(); }

    // Modals state
    let showCreate = $state(false);
    let showEdit   = $state(false);
    let showView   = $state(false);
    let selectedId = $state<number | null>(null);

    // Delete confirm
    let confirmOpen    = $state(false);
    let confirmLoading = $state(false);
    let confirmError   = $state<string | null>(null);
    let confirmData    = $state({ title: '', message: '', action: 'delete' as 'delete' | 'restore', userId: 0 });

    // Restore confirm
    let restoreOpen    = $state(false);
    let restoreLoading = $state(false);
    let restoreError   = $state<string | null>(null);
    let restoreUserId  = $state(0);
    let restoreUserName = $state('');

    // Filters panel
    let filtersOpen = $state(false);

    // Search debounce
    let searchInput = $state('');
    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    function handleSearchInput() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            usuariosStore.setFilter('search', searchInput);
            usuariosStore.fetchEmployees();
        }, 350);
    }

    $effect(() => {
        handleSearchInput();
        return () => { if (searchTimer) clearTimeout(searchTimer); };
    });

    // Active filter count (excluding search, sort, per_page, page)
    const activeFilterCount = $derived(
        [
            usuariosStore.filters.status,
            usuariosStore.filters.role_id,
            usuariosStore.filters.date_from,
            usuariosStore.filters.date_to,
            usuariosStore.filters.trashed,
        ].filter(Boolean).length
    );

    function applyFilter<K extends keyof typeof usuariosStore.filters>(key: K, val: (typeof usuariosStore.filters)[K]) {
        usuariosStore.setFilter(key, val);
        usuariosStore.fetchEmployees();
    }

    function resetAllFilters() {
        searchInput = '';
        usuariosStore.resetFilters();
        usuariosStore.fetchEmployees();
    }

    function handleSort(col: typeof usuariosStore.filters.sort_by) {
        usuariosStore.setSort(col);
        usuariosStore.fetchEmployees();
    }

    function handlePageChange(event: { page: number }) {
        usuariosStore.setFilter('page', event.page);
        usuariosStore.fetchEmployees();
    }

    // View
    function openView(id: number) { selectedId = id; showView = true; }

    // Edit
    function openEdit(id: number) { selectedId = id; showEdit = true; }

    // Delete
    function openDelete(id: number) {
        const emp = usuariosStore.employees.find(e => e.id === id);
        confirmData = {
            title: 'Eliminar Usuario',
            message: `¿Estás seguro de eliminar a ${emp?.name ?? 'este usuario'}? Se moverá a la papelera.`,
            action: 'delete',
            userId: id,
        };
        confirmError = null;
        confirmOpen = true;
    }

    async function handleConfirmDelete() {
        confirmLoading = true;
        confirmError = null;
        try {
            await usuariosStore.deleteEmployee(confirmData.userId);
            toast.success('Usuario eliminado correctamente');
            confirmOpen = false;
        } catch (e: any) {
            confirmError = e.message ?? 'Error al eliminar';
            toast.error(confirmError!);
        } finally {
            confirmLoading = false;
        }
    }

    // Restore
    function openRestore(id: number) {
        const emp = usuariosStore.employees.find(e => e.id === id);
        restoreUserId   = id;
        restoreUserName = emp?.name ?? 'este usuario';
        restoreError    = null;
        restoreOpen     = true;
    }

    async function handleConfirmRestore() {
        restoreLoading = true;
        restoreError   = null;
        try {
            await usuariosStore.restoreEmployee(restoreUserId);
            toast.success('Usuario restaurado correctamente');
            restoreOpen = false;
        } catch (e: any) {
            restoreError = e.message ?? 'Error al restaurar';
            toast.error(restoreError!);
        } finally {
            restoreLoading = false;
        }
    }

    // Toggle status
    async function handleToggleStatus(id: number) {
        try {
            await usuariosStore.toggleStatus(id);
            const emp = usuariosStore.employees.find(e => e.id === id);
            toast.success(`Usuario ${emp?.status === 'active' ? 'activado' : 'desactivado'}`);
        } catch (e: any) {
            toast.error(e.message ?? 'Error al cambiar estado');
        }
    }

    onMount(() => {
        usuariosStore.fetchEmployees();
        usuariosStore.fetchRoles();
    });
</script>

<main class="flex-1 overflow-y-auto bg-[#09090f] text-gray-100 h-screen">
    <Encabezado {toggleSidebar} {toggleNotifications} />

    <div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-5">

        <!-- Page header -->
        <div class="flex items-start justify-between">
            <div>
                <div class="flex items-center gap-3">
                    <Users class="size-6 text-blue-400" />
                    <h1 class="text-2xl md:text-3xl font-bold">Gestión de Usuarios</h1>
                </div>
                <p class="text-sm text-gray-400 mt-1">Administra el personal, sus roles y permisos</p>
            </div>
            <div class="flex items-center gap-2">
                {#if auth.isSuperAdmin}
                    <a href="/usuarios/roles"
                        class="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 hover:border-purple-500/50 text-purple-400 hover:bg-purple-500/5 text-sm font-medium transition-colors">
                        <Shield class="size-4" /> Roles
                    </a>
                {/if}
                {#if auth.can('usuarios', 'crear')}
                    <button
                        onclick={() => showCreate = true}
                        class="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors hover:bg-gray-300">
                        <PlusIcon class="size-4" strokeWidth={2.5} /> Nuevo
                    </button>
                {/if}
            </div>
        </div>

        <!-- Stats bar -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-card border border-neutral-800 rounded-xl px-4 py-3">
                <p class="text-2xl font-bold">{usuariosStore.meta.total}</p>
                <p class="text-xs text-neutral-400">Total empleados</p>
            </div>
            <div class="bg-card border border-neutral-800 rounded-xl px-4 py-3">
                <p class="text-2xl font-bold text-green-400">{usuariosStore.employees.filter(e => e.status === 'active' && !e.deleted_at).length}</p>
                <p class="text-xs text-neutral-400">Activos (pág.)</p>
            </div>
            <div class="bg-card border border-neutral-800 rounded-xl px-4 py-3">
                <p class="text-2xl font-bold text-yellow-400">{usuariosStore.employees.filter(e => e.status === 'inactive').length}</p>
                <p class="text-xs text-neutral-400">Inactivos (pág.)</p>
            </div>
            <div class="bg-card border border-neutral-800 rounded-xl px-4 py-3">
                <p class="text-2xl font-bold text-neutral-400">{usuariosStore.roles.length}</p>
                <p class="text-xs text-neutral-400">Roles definidos</p>
            </div>
        </div>

        <!-- Search + Filters bar -->
        <div class="bg-card border border-neutral-800 rounded-xl p-4 space-y-3">
            <div class="flex gap-2">
                <!-- Search -->
                <div class="relative flex-1">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email o teléfono..."
                        bind:value={searchInput}
                        class="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder-neutral-600"
                    />
                    {#if searchInput}
                        <button onclick={() => { searchInput = ''; usuariosStore.setFilter('search', ''); usuariosStore.fetchEmployees(); }}
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">
                            <X class="size-3.5" />
                        </button>
                    {/if}
                </div>

                <!-- Filters toggle -->
                <button
                    onclick={() => filtersOpen = !filtersOpen}
                    class="flex items-center gap-2 px-3 py-2.5 rounded-lg border {filtersOpen || activeFilterCount > 0 ? 'border-blue-500 bg-blue-500/5 text-blue-400' : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'} text-sm transition-colors"
                >
                    <SlidersHorizontal class="size-4" />
                    Filtros
                    {#if activeFilterCount > 0}
                        <span class="size-5 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-bold">{activeFilterCount}</span>
                    {/if}
                </button>

                {#if activeFilterCount > 0 || searchInput}
                    <button onclick={resetAllFilters}
                        class="flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm text-neutral-400 hover:text-white border border-neutral-700 hover:border-neutral-600 transition-colors">
                        <RotateCcw class="size-3.5" /> Limpiar
                    </button>
                {/if}
            </div>

            <!-- Advanced filters panel -->
            {#if filtersOpen}
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-neutral-800" transition:fade={{ duration: 120 }}>
                    <!-- Status -->
                    <div>
                        <label class="block text-xs text-neutral-400 mb-1">Estado</label>
                        <select
                            value={usuariosStore.filters.status}
                            onchange={(e) => applyFilter('status', (e.target as HTMLSelectElement).value as any)}
                            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white"
                        >
                            <option value="">Todos</option>
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                        </select>
                    </div>

                    <!-- Role -->
                    <div>
                        <label class="block text-xs text-neutral-400 mb-1">Rol</label>
                        <select
                            value={usuariosStore.filters.role_id}
                            onchange={(e) => applyFilter('role_id', (e.target as HTMLSelectElement).value)}
                            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white"
                        >
                            <option value="">Todos los roles</option>
                            {#each usuariosStore.roles as role}
                                <option value={String(role.id)}>{role.nombre}</option>
                            {/each}
                        </select>
                    </div>

                    <!-- Date from -->
                    <div>
                        <label class="block text-xs text-neutral-400 mb-1">Desde</label>
                        <input type="date"
                            value={usuariosStore.filters.date_from}
                            onchange={(e) => applyFilter('date_from', (e.target as HTMLInputElement).value)}
                            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white" />
                    </div>

                    <!-- Date to -->
                    <div>
                        <label class="block text-xs text-neutral-400 mb-1">Hasta</label>
                        <input type="date"
                            value={usuariosStore.filters.date_to}
                            onchange={(e) => applyFilter('date_to', (e.target as HTMLInputElement).value)}
                            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white" />
                    </div>

                    <!-- Trashed -->
                    <div>
                        <label class="block text-xs text-neutral-400 mb-1">Eliminados</label>
                        <select
                            value={usuariosStore.filters.trashed}
                            onchange={(e) => applyFilter('trashed', (e.target as HTMLSelectElement).value as any)}
                            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white"
                        >
                            <option value="">Solo activos</option>
                            <option value="with">Incluir eliminados</option>
                            <option value="only">Solo eliminados</option>
                        </select>
                    </div>

                    <!-- Per page -->
                    <div>
                        <label class="block text-xs text-neutral-400 mb-1">Por página</label>
                        <select
                            value={usuariosStore.filters.per_page}
                            onchange={(e) => applyFilter('per_page', Number((e.target as HTMLSelectElement).value) as any)}
                            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-white"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>
            {/if}
        </div>

        <!-- Table -->
        <TablaUsuarios
            employees={usuariosStore.employees}
            loading={usuariosStore.loading}
            sortBy={usuariosStore.filters.sort_by}
            sortDir={usuariosStore.filters.sort_dir}
            showTrashed={usuariosStore.filters.trashed !== ''}
            canEdit={auth.can('usuarios', 'editar')}
            canDelete={auth.can('usuarios', 'eliminar')}
            onSort={handleSort}
            onView={openView}
            onEdit={openEdit}
            onDelete={openDelete}
            onRestore={openRestore}
            onToggleStatus={handleToggleStatus}
        />

        <!-- Pagination -->
        {#if usuariosStore.meta.last_page > 1}
            <div class="flex flex-col sm:flex-row justify-between items-center gap-3 mt-2">
                <p class="text-xs text-neutral-500">
                    Mostrando {usuariosStore.meta.from ?? 0}–{usuariosStore.meta.to ?? 0} de {usuariosStore.meta.total} empleados
                </p>
                <Pagination
                    count={usuariosStore.meta.total}
                    pageSize={usuariosStore.meta.per_page}
                    page={usuariosStore.meta.current_page}
                    onPageChange={handlePageChange}
                >
                    <Pagination.PrevTrigger><ArrowLeftIcon class="size-4" /></Pagination.PrevTrigger>
                    <Pagination.Context>
                        {#snippet children(pagination)}
                            {#each pagination().pages as p, index (p)}
                                {#if p.type === 'page'}
                                    <Pagination.Item {...p}>{p.value}</Pagination.Item>
                                {:else}
                                    <Pagination.Ellipsis {index}>&#8230;</Pagination.Ellipsis>
                                {/if}
                            {/each}
                        {/snippet}
                    </Pagination.Context>
                    <Pagination.NextTrigger><ArrowRightIcon class="size-4" /></Pagination.NextTrigger>
                </Pagination>
            </div>
        {:else if !usuariosStore.loading && usuariosStore.meta.total > 0}
            <p class="text-xs text-neutral-500 text-center mt-2">
                {usuariosStore.meta.total} empleado(s) encontrado(s)
            </p>
        {/if}

    </div>
</main>

<!-- Modals -->
{#if showCreate}
    <ModalCrearUsuario
        open={showCreate}
        on:close={() => showCreate = false}
        on:created={() => { showCreate = false; usuariosStore.fetchEmployees(); }}
    />
{/if}

{#if showEdit}
    <ModalEditarUsuario
        open={showEdit}
        userId={selectedId}
        on:close={() => { showEdit = false; selectedId = null; }}
        on:updated={() => { showEdit = false; selectedId = null; usuariosStore.fetchEmployees(); }}
    />
{/if}

{#if showView}
    <ModalVerUsuario
        open={showView}
        userId={selectedId}
        on:close={() => { showView = false; selectedId = null; }}
    />
{/if}

<!-- Delete confirmation -->
<ModalConfirmacion
    bind:open={confirmOpen}
    title={confirmData.title}
    message={confirmData.message}
    confirmText="Sí, eliminar"
    cancelText="Cancelar"
    type="danger"
    loading={confirmLoading}
    error={confirmError}
    on:confirm={handleConfirmDelete}
    on:cancel={() => confirmOpen = false}
/>

<!-- Restore confirmation -->
<ModalConfirmacion
    bind:open={restoreOpen}
    title="Restaurar Usuario"
    message="¿Restaurar al usuario {restoreUserName}? Volverá a estar disponible en el sistema."
    confirmText="Sí, restaurar"
    cancelText="Cancelar"
    type="success"
    loading={restoreLoading}
    error={restoreError}
    on:confirm={handleConfirmRestore}
    on:cancel={() => restoreOpen = false}
/>
