<script lang="ts">
    import { onMount } from 'svelte';
    import { API_BASE } from '$lib/config';
    import { Pagination } from '@skeletonlabs/skeleton-svelte';
    import { ArrowLeftIcon, ArrowRightIcon } from '@lucide/svelte';
    import Encabezado from "$lib/components/Encabezado.svelte";
    import TablaFacturas from "$lib/components/facturas/TablaFacturas.svelte";
    import ModalCrearFactura from "$lib/components/facturas/ModalCrearFactura.svelte";
    import ModalVerFactura from "$lib/components/facturas/ModalVerFactura.svelte";
    import { appState } from '$lib/stores/app.svelte';

    let isSidebarOpen = $state(false);
    let isNotificationsOpen = $state(false);
    function toggleSidebar() { appState.toggleSidebar() }
    function toggleNotifications() { appState.toggleNotifications() }

    interface Invoice {
        id: number;
        invoice_number: string;
        client_id: number;
        client_plan_id: number;
        issue_date: string;
        due_date: string;
        amount: number;
        tax_amount: number;
        total_amount: number;
        status: string;
        description?: string;
        payment_reference?: string;
        client?: { name: string; dni: string; email: string; address?: string };
        client_plan?: { plan?: { name: string } };
    }

    let invoices = $state<Invoice[]>([]);
    let loading = $state(false);
    let searchTerm = $state('');
    let statusFilter = $state('all');
    let dateFrom = $state('');
    let dateTo = $state('');

    // Pagination
    let page = $state(1);
    let pageSize = $state(5);
    let totalInvoices = $state(0);

    async function loadInvoices() {
        loading = true;
        try {
            const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
            
            let query = `?page=${page}&per_page=${pageSize}`;
            if (searchTerm) query += `&search=${searchTerm}`;
            if (statusFilter !== 'all') query += `&status=${statusFilter}`;
            if (dateFrom) query += `&date_from=${dateFrom}`;
            if (dateTo) query += `&date_to=${dateTo}`;

            const res = await fetch(`${API_BASE}/admin/invoices${query}`, {
                headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' }
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            invoices = data.data;
            totalInvoices = data.total;
        } catch (e) {
            console.error('Error cargando facturas:', e);
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        loadInvoices();
    });

    $effect(() => {
        // Reload when filters change (debouncing could be added here)
        // For now, we manually trigger search or rely on page change
    });

    function handleSearch() {
        page = 1;
        loadInvoices();
    }

    let showCreateModal = $state(false);
    let showViewModal = $state(false);
    let selectedInvoice = $state<Invoice | null>(null);

    function handleCreate() {
        showCreateModal = true;
    }

    function handleView(invoice: Invoice) {
        selectedInvoice = invoice;
        showViewModal = true;
    }

    function handleInvoiceCreated() {
        showCreateModal = false;
        loadInvoices();
    }

    function handleCloseView() {
        showViewModal = false;
        selectedInvoice = null;
    }

</script>

<main class="flex-1 overflow-y-auto bg-[#0f0f0f] text-gray-100">
    <Encabezado {toggleSidebar} {toggleNotifications} />
    <div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
        <div class="flex items-center justify-between mb-8">
            <div>
                <h1 class="text-3xl md:text-4xl font-bold text-foreground mb-2">Gestión de Facturas</h1>
                <p class="text-muted-foreground">Administra las facturas de tus clientes</p>
            </div>
            <div class="flex items-end justify-center">
                <button onclick={handleCreate}
                    class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors">
                    + Nueva Factura
                </button>
            </div>
        </div>

        <!-- Filters -->
        <div class="bg-card border border-neutral-800 rounded-lg p-6 mb-8">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar</label>
                    <input id="searchTerm" type="text" placeholder="Nº Factura, Cliente..." bind:value={searchTerm} oninput={handleSearch}
                        class="w-full px-4 py-2 border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0 bg-neutral-900" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-foreground mb-2" for="statusFilter">Estado</label>
                    <select id="statusFilter" bind:value={statusFilter} onchange={handleSearch}
                        class="w-full px-5 py-2 border border-neutral-800 rounded-lg focus:outline-none focus:ring-0 bg-neutral-900 text-gray-300">
                        <option value="all">Todos</option>
                        <option value="draft">Borrador</option>
                        <option value="pending">Pendiente</option>
                        <option value="paid">Pagada</option>
                        <option value="failed">Fallida</option>
                        <option value="cancelled">Cancelada</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-foreground mb-2" for="dateFrom">Desde</label>
                    <input id="dateFrom" type="date" bind:value={dateFrom} onchange={handleSearch}
                        class="w-full px-4 py-2 border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0 bg-neutral-900" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-foreground mb-2" for="dateTo">Hasta</label>
                    <input id="dateTo" type="date" bind:value={dateTo} onchange={handleSearch}
                        class="w-full px-4 py-2 border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0 bg-neutral-900" />
                </div>
            </div>
        </div>

        <!-- Table -->
        <TablaFacturas {invoices} {loading} onView={handleView} onDelete={loadInvoices} />

        <!-- Pagination -->
        {#if totalInvoices > 0}
        <div class="flex justify-center items-center gap-4 w-full mt-4">
            <Pagination count={totalInvoices} {pageSize} {page} onPageChange={(event)=> { page = event.page; loadInvoices(); }}>
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
    </div>

    {#if showCreateModal}
        <ModalCrearFactura open={showCreateModal} onClose={() => showCreateModal = false} onCreated={handleInvoiceCreated} />
    {/if}

    {#if showViewModal}
        <ModalVerFactura open={showViewModal} invoice={selectedInvoice} onClose={handleCloseView} />
    {/if}

</main>
