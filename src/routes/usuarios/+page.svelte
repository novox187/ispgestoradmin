<script lang="ts">
    import ModalCrearUsuario from "$lib/components/usuarios/ModalCrearUsuario.svelte";
    import ModalEditarUsuario from "$lib/components/usuarios/ModalEditarUsuario.svelte";
    import ModalVerUsuario from "$lib/components/usuarios/ModalVerUsuario.svelte";
    import TablaUsuarios from "$lib/components/usuarios/TablaUsuarios.svelte";
    import ModalConfirmacion from "$lib/components/common/ModalConfirmacion.svelte";
    import { toast } from 'svelte-sonner';
    import { onMount, setContext } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { API_BASE } from '$lib/config';
    import { Pagination } from '@skeletonlabs/skeleton-svelte';
    import { ArrowLeftIcon, ArrowRightIcon, Loader2, CheckCircleIcon, XCircleIcon, PlusIcon } from '@lucide/svelte';
    import {
        DASHBOARD_LOAD_CONTEXT,
        fetchJsonWithRetry,
        readStorageCache,
        writeStorageCache,
        type DashboardLoadBus,
        type DashboardLoadStatus,
        type FetchErrorDetails
    } from '$lib/utils/hybrid-cache';
    import Encabezado from "$lib/components/Encabezado.svelte";
    import { appState } from '$lib/stores/app.svelte';

    let isSidebarOpen = $state(false);
    let isNotificationsOpen = $state(false);
    function toggleSidebar() { appState.toggleSidebar() }
    function toggleNotifications() { appState.toggleNotifications() }

    interface Employee {
        id: number;
        name: string;
        email: string;
        phone: string;
        role: string;
        status: string;
    }

    let searchTerm = $state('');
    let showAddUser = $state(false);
    
    let employees = $state<Employee[]>([]);
    let filteredEmployees = $state<Employee[]>([]);
    
    let loading = $state(false);

    // --- Data Fetching & Cache ---
    const EMPLOYEES_CACHE_STORAGE = 'ispga_employees_summary_v1';
    let inFlight = false;
    let abortController: AbortController | null = null;

    let requestStates = $state<Record<string, { status: DashboardLoadStatus; endpoint: string; message?: string; updatedAt: number }>>({});
    let indicatorVisible = $state(false);
    let indicatorHideTimer: ReturnType<typeof setTimeout> | null = null;

    const overallStatus = $derived.by((): DashboardLoadStatus => {
        const items = Object.values(requestStates);
        if (items.some(i => i.status === 'loading')) return 'loading';
        if (items.some(i => i.status === 'error')) return 'error';
        if (items.some(i => i.status === 'success')) return 'success';
        return 'idle';
    });

    const overallMessage = $derived.by((): string => {
        const errors = Object.entries(requestStates)
            .filter(([, v]) => v.status === 'error')
            .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0));
        const first = errors[0]?.[1];
        if (!first) return '';
        return first.message || 'Error de actualización';
    });

    function setRequestState(key: string, next: { status: DashboardLoadStatus; endpoint: string; message?: string }) {
        requestStates[key] = { ...next, updatedAt: Date.now() };
        requestStates = { ...requestStates };
    }

    const loadBus: DashboardLoadBus = {
        start: (key, endpoint) => setRequestState(key, { status: 'loading', endpoint }),
        success: (key) => {
            const prev = requestStates[key];
            setRequestState(key, { status: 'success', endpoint: prev?.endpoint || '' });
        },
        error: (key, details) => setRequestState(key, { status: 'error', endpoint: details.endpoint, message: details.message })
    };

    setContext(DASHBOARD_LOAD_CONTEXT, loadBus);

    $effect(() => {
        if (indicatorHideTimer) {
            clearTimeout(indicatorHideTimer);
            indicatorHideTimer = null;
        }

        if (overallStatus === 'idle') {
            indicatorVisible = false;
            return;
        }

        indicatorVisible = true;

        if (overallStatus === 'success') {
            indicatorHideTimer = setTimeout(() => {
                if (overallStatus === 'success') indicatorVisible = false;
            }, 2500);
        }

        if (overallStatus === 'error') {
            indicatorHideTimer = setTimeout(() => {
                if (overallStatus === 'error') indicatorVisible = false;
            }, 9000);
        }

        return () => {
            if (indicatorHideTimer) {
                clearTimeout(indicatorHideTimer);
                indicatorHideTimer = null;
            }
        };
    });

    async function loadEmployees() {
        if (inFlight) return;
        inFlight = true;
        if (employees.length === 0) loading = true;
        try {
            const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
            const endpoint = `${API_BASE}/admin/employees`;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            loadBus.start('employees-list', endpoint);

            if (abortController) abortController.abort();
            abortController = new AbortController();

            const data = await fetchJsonWithRetry<Employee[]>(
                endpoint,
                { headers, signal: abortController.signal },
                { attempts: 3, baseDelayMs: 700 }
            );

            employees = data || [];
            writeStorageCache(EMPLOYEES_CACHE_STORAGE, { employees });
            filterEmployees();
            
            loadBus.success('employees-list');
        } catch (e: any) {
            if (e?.name === 'AbortError') return;
            console.error('Error cargando usuarios:', e);
            const err = e as FetchErrorDetails;
            const message = typeof err?.message === 'string' && err.message ? err.message : 'Error cargando usuarios';
            loadBus.error('employees-list', { endpoint: `${API_BASE}/admin/employees`, status: err?.status, message });
            toast.error(message);
        } finally {
            loading = false;
            inFlight = false;
        }
    }

    function filterEmployees() {
        const term = searchTerm.toLowerCase();
        filteredEmployees = employees.filter(e => 
            e.name.toLowerCase().includes(term) || 
            e.email.toLowerCase().includes(term) ||
            e.role.toLowerCase().includes(term)
        );
    }

    onMount(() => {
        const cached = readStorageCache<{employees: Employee[]}>(EMPLOYEES_CACHE_STORAGE);
        if (cached?.data?.employees && Array.isArray(cached.data.employees) && cached.data.employees.length > 0) {
            employees = cached.data.employees;
            filterEmployees();
            loading = false;
        }

        loadEmployees();
        const interval = setInterval(loadEmployees, 60000);
        
        return () => {
            clearInterval(interval);
            if (abortController) abortController.abort();
        };
    });

    // Pagination (Client-side for now)
    let page = $state(1);
    let pageSize = $state(10);
    
    let paginatedEmployees = $derived(
        filteredEmployees.slice((page - 1) * pageSize, page * pageSize)
    );

    function handleSearch() {
        page = 1;
        filterEmployees();
    }

    // View
    let showViewUser = $state(false);

    function handleViewEmployee(id: number) {
        selectedUserId = id;
        showViewUser = true;
    }

    // Edit
    let showEditUser = $state(false);
    let selectedUserId = $state<number | null>(null);

    function handleEditEmployee(id: number) {
        selectedUserId = id;
        showEditUser = true;
    }

    function handleUpdated() {
        loadEmployees();
    }

    function handleCreated() {
        loadEmployees();
    }

    // Delete
    let confirmModalOpen = $state(false);
    let confirmModalLoading = $state(false);
    let confirmModalError = $state<string | null>(null);
    let confirmModalData = $state({
        title: '',
        message: '',
        confirmText: '',
        cancelText: '',
        type: 'danger' as 'danger' | 'success' | 'warning' | 'info',
        action: 'delete',
        userId: 0
    });

    function handleDeleteEmployee(id: number) {
        const user = employees.find(e => e.id === id);
        if (!user) return;

        confirmModalData = {
            title: 'Eliminar Usuario',
            message: `¿Estás seguro de eliminar el usuario ${user.name}? Esta acción no se puede deshacer.`,
            confirmText: 'Sí, Eliminar',
            cancelText: 'Cancelar',
            type: 'danger',
            action: 'delete',
            userId: id
        };
        confirmModalError = null;
        confirmModalOpen = true;
    }

    async function handleConfirmAction() {
        confirmModalLoading = true;
        confirmModalError = null;
        const id = confirmModalData.userId;
        
        try {
            const token = localStorage.getItem('employee_token');
            const res = await fetch(`${API_BASE}/admin/employees/${id}`, {
                method: 'DELETE',
                headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Error al eliminar');
            }
            
            toast.success('Usuario eliminado correctamente');
            confirmModalOpen = false;
            loadEmployees();
        } catch (e: any) {
            console.error(e);
            confirmModalError = e.message || 'Error de conexión';
            toast.error(confirmModalError || 'Error desconocido');
        } finally {
            confirmModalLoading = false;
        }
    }

</script>

<main class="flex-1 overflow-y-auto bg-[#09090f] text-gray-100 h-screen">
    
     <Encabezado {toggleSidebar} {toggleNotifications} />
     <div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-xl md:text-4xl font-bold text-foreground mb-2">Gestión de Usuarios</h1>
            <p class="sm:text-sm text-xs text-gray-400 leading-relaxed">Administra el personal y sus roles</p>
        </div>
        <div class="flex items-end justify-center">
            <button onclick={()=> (showAddUser = true)}
                    class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-xl bg-gray-200 text-gray-900 text-xs sm:text-sm font-semibold shadow-lg transition-colors hover:bg-gray-300">
                    <PlusIcon size={20} strokeWidth={3} fill="currentColor" />
                    Nuevo
            </button>
        </div>
    </div>

    <!-- Filters and Search -->
    <div class="bg-card border border-neutral-800 rounded-lg p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-3">
                <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar Usuario</label>
                <input id="searchTerm" type="text" placeholder="Nombre, email o rol..." bind:value={searchTerm} oninput={handleSearch}
                    class="w-full px-4 py-2 border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0 bg-neutral-900" />
            </div>
        </div>
    </div>

    <!-- Users Table -->
    <TablaUsuarios 
        filteredEmployees={paginatedEmployees} 
        handleDeleteEmployee={handleDeleteEmployee}
        handleEditEmployee={handleEditEmployee}
        handleViewEmployee={handleViewEmployee}
        loading={loading}
    />

    <!-- Pagination Controls -->
    {#if filteredEmployees.length > pageSize}
    <div class="flex justify-center items-center gap-4 w-full mt-4">
        <Pagination count={filteredEmployees.length} {pageSize} {page} onPageChange={(event)=> { page = event.page; }}>
            <Pagination.PrevTrigger>
                <ArrowLeftIcon class="size-4" />
            </Pagination.PrevTrigger>
            <Pagination.Context>
                {#snippet children(pagination)}
                    {#each pagination().pages as page, index (page)}
                        {#if page.type === 'page'}
                            <Pagination.Item {...page}>
                                {page.value}
                            </Pagination.Item>
                        {:else}
                            <Pagination.Ellipsis {index}>&#8230;</Pagination.Ellipsis>
                        {/if}
                    {/each}
                {/snippet}
            </Pagination.Context>
            <Pagination.NextTrigger>
                <ArrowRightIcon class="size-4" />
            </Pagination.NextTrigger>
        </Pagination>
    </div>
    {/if}

    <!-- Add User Modal -->
    {#if showAddUser}
    <ModalCrearUsuario
        {showAddUser}
        on:close={() => showAddUser = false}
        on:created={handleCreated}
    />
    {/if}

    <!-- Edit User Modal -->
    {#if showEditUser}
    <ModalEditarUsuario
        open={showEditUser}
        userId={selectedUserId}
        on:close={() => { showEditUser = false; selectedUserId = null; }}
        on:updated={handleUpdated}
    />
    {/if}

    <!-- View User Modal -->
    {#if showViewUser}
    <ModalVerUsuario
        open={showViewUser}
        userId={selectedUserId}
        on:close={() => { showViewUser = false; selectedUserId = null; }}
    />
    {/if}

    <!-- Confirmation Modal -->
    <ModalConfirmacion
        bind:open={confirmModalOpen}
        title={confirmModalData.title}
        message={confirmModalData.message}
        confirmText={confirmModalData.confirmText}
        cancelText={confirmModalData.cancelText}
        type={confirmModalData.type}
        loading={confirmModalLoading}
        error={confirmModalError}
        on:confirm={handleConfirmAction}
        on:cancel={() => confirmModalOpen = false}
    />

    <!-- Indicador de carga -->
    {#if indicatorVisible}
        <div class="fixed bottom-4 right-4 z-[60]" in:scale={{ duration: 140, start: 0.9 }} out:fade={{ duration: 140 }}>
            <button
                class="flex items-center gap-2 bg-[#141414] border border-gray-800 text-gray-200 px-3 py-2 rounded-lg shadow-lg max-w-[320px]"
                onclick={() => overallStatus === 'error' && loadEmployees()}
            >
                {#if overallStatus === 'loading'}
                    <Loader2 class="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
                {:else if overallStatus === 'success'}
                    <CheckCircleIcon class="w-4 h-4 text-green-500 flex-shrink-0" />
                {:else if overallStatus === 'error'}
                    <XCircleIcon class="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span class="text-xs truncate">{overallMessage}</span>
                {/if}
            </button>
        </div>
    {/if}

    </div>
</main>