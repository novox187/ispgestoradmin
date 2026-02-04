<script lang="ts">
    import ModalCrearCliente from "$lib/components/clientes/ModalCrearCliente.svelte";
    import TablaClientes from "$lib/components/clientes/TablaClientes.svelte";
    import TarjetasEstadisticas from "$lib/components/clientes/TarjetasEstadisticas.svelte";
    import {
        onMount
    } from 'svelte';
    import { API_BASE } from '$lib/config';
    import {
        Pagination
    } from '@skeletonlabs/skeleton-svelte';
    import {
        ArrowLeftIcon,
        ArrowRightIcon
    } from '@lucide/svelte';
    import ModalCliente from "$lib/components/clientes/ModalCliente.svelte";
    import Encabezado from "$lib/components/Encabezado.svelte";

      let isSidebarOpen = $state(false);
  let isNotificationsOpen = $state(false);
  function toggleSidebar() { isSidebarOpen = !isSidebarOpen }
  function toggleNotifications() { isNotificationsOpen = !isNotificationsOpen }

    interface Client {
        id: number;
        name: string;
        email: string;
        phone: string;
        plan: string;
        status: 'active' | 'suspended' | 'inactive';
        joinDate: string;
    }

    type NewClient = Omit < Client, 'id' | 'joinDate' > ;

    let searchTerm = $state('');
    let statusFilter = $state('all');
    let showAddClient = $state(false);
    let newClient = $state < NewClient > ({
        name: '',
        email: '',
        phone: '',
        plan: '',
        status: 'active'
    });

    let clients = $state < Client[] > ([]);
    let totalClients = $state(0);
    let clientStats = $state({ total: 0, active: 0, suspended: 0, inactive: 0 });

    let loadingClients = $state(false);

    async function loadClients() {
        loadingClients = true;
        try {
            const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: pageSize.toString(),
                search: searchTerm,
                status: statusFilter
            });

            const res = await fetch(`${API_BASE}/admin/clientes/summary?${params.toString()}`, {
                headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            
            // Handle paginated response
            const list = data.data || [];
            totalClients = data.total || 0;
            if (data.stats) {
                clientStats = data.stats;
            }

            clients = (list || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                email: c.email,
                phone: c.phone,
                plan: c.plan ?? '',
                status: ((s => {
                    if (!s) return 'inactive';
                    const up = String(s).toUpperCase();
                    if (up === 'ACTIVO' || up === 'ACTIVE') return 'active';
                    if (up === 'SUSPENDIDO' || up === 'LIMITADO' || up === 'SUSPENDED')
                        return 'suspended';
                    return 'inactive';
                })(c.status)),
                joinDate: ''
            }));
        } catch (e) {
            console.error('Error cargando clientes:', e);
        } finally {
            loadingClients = false;
        }
    }

    onMount(() => {
        loadClients();
    });

    // Pagination state
    let page = $state(1);
    let pageSize = $state(5);

    function handleSearch() {
        page = 1;
        loadClients();
    }


    function handleAddClient() {
        console.log('[v0] Adding client:', newClient);
        const newId = Math.max(...clients.map(c => c.id), 0) + 1;
        const newJoinDate = new Date().toISOString().split('T')[0];
        clients.push({
            ...newClient,
            id: newId,
            joinDate: newJoinDate
        });
        newClient = {
            name: '',
            email: '',
            phone: '',
            plan: '',
            status: 'active'
        };
        showAddClient = false;
    }

    function handleDeleteClient(id: number) {
        console.log('[v0] Deleting client:', id);
        const index = clients.findIndex(client => client.id === id);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    }

    function handleCloseModal() {
        showAddClient = false;
    }

    let showViewClient = $state(false);
    let selectedClientId = $state < number | null > (null);

    function handleViewClient(id: number) {
        selectedClientId = id;
        showViewClient = true;
    }

    function handleCloseView() {
        showViewClient = false;
        selectedClientId = null;
    }

    function handleCreated() {
        showAddClient = false;
        loadClients();
    }
</script>

<main class="flex-1 overflow-y-auto bg-[#0f0f0f] text-gray-100">
    
    <!-- Header -->
     <Encabezado {toggleSidebar} {toggleNotifications} />
     <div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-3xl md:text-4xl font-bold text-foreground mb-2">Gestión de Clientes</h1>
            <p class="text-muted-foreground">Administra todos tus clientes de internet</p>
        </div>
        <div class="flex items-end justify-center">
            <button onclick={()=> (showAddClient = true)}
                class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors">
                + Agregar Cliente
            </button>
        </div>
    </div>

    <!-- Stats Cards -->
    <TarjetasEstadisticas stats={clientStats} />

    <!-- Filters and Search -->
    <div class="bg-card border border-neutral-800 rounded-lg p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar
                    Cliente</label>
                <input id="searchTerm" type="text" placeholder="Nombre o email..." bind:value={searchTerm} oninput={handleSearch}
                    class="w-full px-4 py-2 border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
            </div>
            <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="statusFilter">Estado</label>
                <select id="statusFilter" bind:value={statusFilter} onchange={handleSearch}
                    class="w-full px-5 py-2 border border-neutral-800 rounded-lg focus:outline-none focus:ring-0 bg-neutral-900">
                    <option value="all">Todos</option>
                    <option value="active">Activo</option>
                    <option value="suspended">Suspendido</option>
                    <option value="inactive">Inactivo</option>
                </select>
            </div>
        </div>
    </div>

    <!-- Clients Table -->
    <TablaClientes filteredClients={clients} handleDeleteClient={handleDeleteClient}
        handleViewClient={handleViewClient} loading={loadingClients}/>

    <!-- Pagination Controls -->
    {#if totalClients > 0}
    <div class="flex justify-center items-center gap-4 w-full mt-4">
        <Pagination count={totalClients} {pageSize} {page} onPageChange={(event)=> { page = event.page; loadClients(); }}>
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

    <!-- Add Client Modal -->
    {#if showAddClient}
    <ModalCrearCliente
    {newClient}
 {showAddClient}
 {handleAddClient}
 on:close={handleCloseModal}
 on:created={handleCreated}
    />
    {/if}
    {#if showViewClient}
      <ModalCliente open={showViewClient} clientId={selectedClientId} onClose={handleCloseView} />
    {/if}
    </div>
</main>
