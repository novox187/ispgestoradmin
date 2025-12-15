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

    let loadingClients = $state(false);

    async function loadClients() {
        loadingClients = true;
        try {
            const res = await fetch(`${API_BASE}/admin/clientes/summary`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = Array.isArray(data?.data) ? data.data : data;
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

    let filteredClients = $state < Client[] > ([]);

    $effect(() => {
        filteredClients = clients.filter(client => {
            const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    });

    // Pagination state and derived values
    let page = $state(1);
    let pageSize = $state(5);
    const start = $derived((page - 1) * pageSize);
    const end = $derived(start + pageSize);
    const paginatedClients = $derived(filteredClients.slice(start, end));

    // Clamp current page when filters or pageSize change
    $effect(() => {
        const total = filteredClients.length;
        const maxPage = Math.max(1, Math.ceil(total / pageSize));
        if (page > maxPage) page = maxPage;
        if (start >= total && total > 0) page = 1;
    });

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

<div class="w-full mx-auto p-10">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
        <div>
            <h1 class="text-3xl md:text-4xl font-bold text-foreground mb-2">Gestión de Clientes</h1>
            <p class="text-muted-foreground">Administra todos tus clientes de internet</p>
        </div>
        <div class="flex items-end justify-center">
            <button onclick={()=> (showAddClient = true)}
                class="w-full px-6 py-2  bg-white text-gray-800 hover:bg-white/90 cursor-pointer rounded-lg transition font-medium"
                >
                + Agregar Cliente
            </button>
        </div>
    </div>

    <!-- Stats Cards -->
    <TarjetasEstadisticas clients={clients} />

    <!-- Filters and Search -->
    <div class="bg-card border border-neutral-800 rounded-lg p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar
                    Cliente</label>
                <input id="searchTerm" type="text" placeholder="Nombre o email..." bind:value={searchTerm}
                    class="w-full px-4 py-2 border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
            </div>
            <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="statusFilter">Estado</label>
                <select id="statusFilter" bind:value={statusFilter}
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
    <TablaClientes filteredClients={paginatedClients} handleDeleteClient={handleDeleteClient}
        handleViewClient={handleViewClient} loading={loadingClients}/>

    <!-- Pagination Controls -->
    <div class="flex justify-center items-center gap-4 w-full mt-4">
        <Pagination count={filteredClients.length} {pageSize} {page} onPageChange={(event)=> (page = event.page)}>
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
