<script lang="ts">
    import ModalCrearUsuario from "$lib/components/usuarios/ModalCrearUsuario.svelte";
    import ModalEditarUsuario from "$lib/components/usuarios/ModalEditarUsuario.svelte";
    import ModalVerUsuario from "$lib/components/usuarios/ModalVerUsuario.svelte";
    import TablaUsuarios from "$lib/components/usuarios/TablaUsuarios.svelte";
    import ModalConfirmacion from "$lib/components/common/ModalConfirmacion.svelte";
    import { toast } from 'svelte-sonner';
    import { onMount } from 'svelte';
    import { API_BASE } from '$lib/config';
    import { Pagination } from '@skeletonlabs/skeleton-svelte';
    import { ArrowLeftIcon, ArrowRightIcon } from '@lucide/svelte';
    import Encabezado from "$lib/components/Encabezado.svelte";

    let isSidebarOpen = $state(false);
    let isNotificationsOpen = $state(false);
    function toggleSidebar() { isSidebarOpen = !isSidebarOpen }
    function toggleNotifications() { isNotificationsOpen = !isNotificationsOpen }

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

    async function loadEmployees() {
        loading = true;
        try {
            const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
            const res = await fetch(`${API_BASE}/admin/employees`, {
                headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            employees = data || [];
            filterEmployees();
        } catch (e) {
            console.error('Error cargando usuarios:', e);
            toast.error('Error cargando usuarios');
        } finally {
            loading = false;
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
        loadEmployees();
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

<main class="flex-1 overflow-y-auto bg-[#0f0f0f] text-gray-100 h-screen">
    
     <Encabezado {toggleSidebar} {toggleNotifications} />
     <div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-3xl md:text-4xl font-bold text-foreground mb-2">Gestión de Usuarios</h1>
            <p class="text-muted-foreground">Administra el personal y sus roles</p>
        </div>
        <div class="flex items-end justify-center">
            <button onclick={()=> (showAddUser = true)}
                class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors hover:bg-white">
                + Agregar Usuario
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

    </div>
</main>