<script lang="ts">
    import { onMount, setContext } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { API_BASE } from '$lib/config';
    import { Pagination } from '@skeletonlabs/skeleton-svelte';
    import { ArrowLeftIcon, ArrowRightIcon, Loader2, CheckCircleIcon, XCircleIcon, SparkleIcon, PlusIcon, ChevronDownIcon, CalendarIcon, CalendarRangeIcon } from '@lucide/svelte';
    import Encabezado from "$lib/components/Encabezado.svelte";
    import TablaFacturas from "$lib/components/facturas/TablaFacturas.svelte";
    import ModalCrearFactura from "$lib/components/facturas/ModalCrearFactura.svelte";
    import ModalVerFactura from "$lib/components/facturas/ModalVerFactura.svelte";
    import ModalConfigGuard, { type ConfigCheckResult } from "$lib/components/facturas/ModalConfigGuard.svelte";
    import { appState } from '$lib/stores/app.svelte';
    import {
        DASHBOARD_LOAD_CONTEXT,
        fetchJsonWithRetry,
        readStorageCache,
        writeStorageCache,
        type DashboardLoadBus,
        type DashboardLoadStatus,
        type FetchErrorDetails
    } from '$lib/utils/hybrid-cache';

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

    const INVOICES_CACHE_STORAGE = 'ispga_invoices_v1';
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

    async function loadInvoices() {
        if (inFlight) return;
        inFlight = true;
        if (invoices.length === 0) loading = true;
        try {
            const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
            
            let query = `?page=${page}&per_page=${pageSize}`;
            if (searchTerm) query += `&search=${searchTerm}`;
            if (statusFilter !== 'all') query += `&status=${statusFilter}`;
            if (dateFrom) query += `&date_from=${dateFrom}`;
            if (dateTo) query += `&date_to=${dateTo}`;

            const endpoint = `${API_BASE}/admin/invoices${query}`;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            loadBus.start('invoices-list', endpoint);

            if (abortController) abortController.abort();
            abortController = new AbortController();

            const data = await fetchJsonWithRetry<any>(
                endpoint,
                { headers, signal: abortController.signal },
                { attempts: 3, baseDelayMs: 700 }
            );

            invoices = data.data;
            totalInvoices = data.total;

            if (!searchTerm && statusFilter === 'all' && !dateFrom && !dateTo && page === 1) {
                writeStorageCache(INVOICES_CACHE_STORAGE, { invoices, totalInvoices });
            }
            loadBus.success('invoices-list');
        } catch (e: any) {
            if (e?.name === 'AbortError') return;
            console.error('Error cargando facturas:', e);
            const err = e as FetchErrorDetails;
            const message = typeof err?.message === 'string' && err.message ? err.message : 'Error cargando la lista de facturas';
            loadBus.error('invoices-list', { endpoint: `${API_BASE}/admin/invoices`, status: err?.status, message });
        } finally {
            loading = false;
            inFlight = false;
        }
    }

    async function openInvoiceById(invoiceId: number) {
        try {
            const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            const res = await fetch(`${API_BASE}/admin/invoices/${invoiceId}`, { headers });
            if (!res.ok) return;
            const data = await res.json();
            selectedInvoice = data?.data ?? data;
            showViewModal = true;
        } catch (e) {
            console.error('No se pudo abrir la factura', e);
        }
    }

    onMount(() => {
        const cached = readStorageCache<{invoices: Invoice[], totalInvoices: number}>(INVOICES_CACHE_STORAGE);
        if (cached?.data?.invoices && Array.isArray(cached.data.invoices) && cached.data.invoices.length > 0) {
            invoices = cached.data.invoices;
            totalInvoices = cached.data.totalInvoices || cached.data.invoices.length;
            loading = false;
        }

        loadInvoices();
        const interval = setInterval(loadInvoices, 60000); // 60s

        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const idStr = params.get('invoice');
            if (idStr) {
                const id = Number(idStr);
                if (Number.isFinite(id) && id > 0) openInvoiceById(id);
            }
        }

        return () => {
            clearInterval(interval);
            if (abortController) abortController.abort();
        };
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
    let showViewModal   = $state(false);
    let selectedInvoice = $state<Invoice | null>(null);

    // Config guard
    let configGuardOpen   = $state(false);
    let configGuardResult = $state<ConfigCheckResult | null>(null);
    // After guard is dismissed without fixing config, what action was intended?
    let pendingAction = $state<'create' | 'generate' | 'generate-contract' | null>(null);

    let generatingAuto = $state(false);
    let generatingByContract = $state(false);
    let generateMenuOpen = $state(false);
    let generateMenuEl: HTMLDivElement | null = $state(null);

    function toggleGenerateMenu() {
        generateMenuOpen = !generateMenuOpen;
    }

    function closeGenerateMenu() {
        generateMenuOpen = false;
    }

    $effect(() => {
        if (!generateMenuOpen) return;
        const onDocClick = (e: MouseEvent) => {
            if (generateMenuEl && !generateMenuEl.contains(e.target as Node)) {
                closeGenerateMenu();
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeGenerateMenu();
        };
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('click', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    });

    function getToken() {
        return typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
    }

    async function checkConfig(): Promise<ConfigCheckResult> {
        const token = getToken();
        const res = await fetch(`${API_BASE}/admin/invoices/config-check`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        return res.json();
    }

    async function handleGenerateAuto() {
        closeGenerateMenu();
        if (generatingAuto || generatingByContract) return;

        // Preflight config check
        const check = await checkConfig();
        if (!check.valid) {
            configGuardResult = check;
            pendingAction     = 'generate';
            configGuardOpen   = true;
            return;
        }

        generatingAuto = true;
        try {
            const token    = getToken();
            const endpoint = `${API_BASE}/admin/invoices/generate-auto`;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            loadBus.start('generate-auto', endpoint);

            const res  = await fetch(endpoint, { method: 'POST', headers });
            const data = await res.json().catch(() => ({ message: 'Respuesta inválida del servidor' }));

            if (!res.ok) {
                // Server-side validation also returns config errors in the same shape
                if (res.status === 422 && data.valid === false) {
                    configGuardResult = data;
                    pendingAction     = 'generate';
                    configGuardOpen   = true;
                    loadBus.error('generate-auto', { endpoint, message: 'Configuración incompleta' });
                    return;
                }
                throw new Error(data.error || data.message || 'Error generando facturas');
            }

            loadBus.success('generate-auto');
            loadInvoices();
            alert(`✅ ${data.message || 'Facturas generadas'}. Se generaron ${data.count || 0} facturas nuevas.`);

        } catch (e: any) {
            console.error('Error generando facturas automáticas:', e);
            const message = e.message || 'Error desconocido';
            loadBus.error('generate-auto', { endpoint: `${API_BASE}/admin/invoices/generate-auto`, message });
            alert(`❌ Error: ${message}`);
        } finally {
            generatingAuto = false;
        }
    }

    async function handleGenerateByContract() {
        closeGenerateMenu();
        if (generatingAuto || generatingByContract) return;

        const check = await checkConfig();
        if (!check.valid) {
            configGuardResult = check;
            pendingAction     = 'generate-contract';
            configGuardOpen   = true;
            return;
        }

        const confirmed = typeof window === 'undefined'
            ? true
            : window.confirm(
                'Se generarán facturas por cliente ancladas a la fecha de contrato.\n\n' +
                '• No se duplicarán facturas existentes.\n' +
                '• El proceso se detendrá si ocurre un error.\n\n' +
                '¿Deseas continuar?'
            );
        if (!confirmed) return;

        generatingByContract = true;
        try {
            const token    = getToken();
            const endpoint = `${API_BASE}/admin/invoices/generate-by-contract`;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;

            loadBus.start('generate-by-contract', endpoint);

            const res  = await fetch(endpoint, { method: 'POST', headers });
            const data = await res.json().catch(() => ({ message: 'Respuesta inválida del servidor' }));

            if (res.status === 422 && data.valid === false) {
                configGuardResult = data;
                pendingAction     = 'generate-contract';
                configGuardOpen   = true;
                loadBus.error('generate-by-contract', { endpoint, message: 'Configuración incompleta' });
                return;
            }

            if (!res.ok && res.status !== 207) {
                throw new Error(data.error || data.message || 'Error generando facturas por contrato');
            }

            const report = data.report ?? {};
            const generated = report.generated_count ?? data.count ?? 0;
            const skipped   = report.skipped_count ?? 0;
            const errors    = report.errors_count ?? 0;
            const aborted   = !!report.aborted;

            if (aborted) {
                loadBus.error('generate-by-contract', { endpoint, message: report.abort_reason || 'Proceso abortado' });
                alert(
                    `⚠️ El proceso se detuvo por un error.\n\n` +
                    `• Generadas: ${generated}\n` +
                    `• Omitidas (ya existían): ${skipped}\n` +
                    `• Errores: ${errors}\n\n` +
                    `Motivo: ${report.abort_reason || 'desconocido'}`
                );
            } else {
                loadBus.success('generate-by-contract');
                alert(
                    `✅ ${data.message || 'Facturas por contrato generadas'}.\n\n` +
                    `• Generadas: ${generated}\n` +
                    `• Omitidas (ya existían): ${skipped}\n` +
                    `• Clientes procesados: ${report.clients_total ?? 0}`
                );
            }

            loadInvoices();
        } catch (e: any) {
            console.error('Error generando facturas por contrato:', e);
            const message = e.message || 'Error desconocido';
            loadBus.error('generate-by-contract', { endpoint: `${API_BASE}/admin/invoices/generate-by-contract`, message });
            alert(`❌ Error: ${message}`);
        } finally {
            generatingByContract = false;
        }
    }

    async function handleCreate() {
        // Preflight config check before opening the form
        const check = await checkConfig();
        if (!check.valid) {
            configGuardResult = check;
            pendingAction     = 'create';
            configGuardOpen   = true;
            return;
        }
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

<main class="flex-1 overflow-y-auto bg-[#0b0b0d] text-gray-100">
    <Encabezado {toggleSidebar} {toggleNotifications} />
    <div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
        <div class="flex flex-col sm:flex-row gap-3 sm:justify-between mb-8">
            <div>
                <h1 class="text-xl md:text-4xl font-bold text-foreground mb-2">Gestión de Facturas</h1>
                <p class="sm:text-sm text-xs text-gray-400 leading-relaxed">Administra las facturas de tus clientes</p>
            </div>
            <div class="flex items-center gap-3 ">
                <div class="relative" bind:this={generateMenuEl}>
                    <button onclick={toggleGenerateMenu}
                        disabled={generatingAuto || generatingByContract || loading}
                        aria-haspopup="menu"
                        aria-expanded={generateMenuOpen}
                        class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold shadow-lg transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={(generatingAuto || generatingByContract) ? 'Procesando facturación...' : (loading ? 'Esperando datos del sistema...' : 'Generar facturas')}
                    >
                        {#if generatingAuto || generatingByContract}
                            <Loader2 class="w-4 h-4 animate-spin" />
                            Generando...
                        {:else}
                            <SparkleIcon class="w-4 h-4" fill="currentColor" />
                            Generar
                            <ChevronDownIcon class="w-4 h-4" />
                        {/if}
                    </button>

                    {#if generateMenuOpen}
                        <div
                            role="menu"
                            class="absolute right-0 mt-2 w-72 sm:w-80 rounded-xl bg-[#1a1a1d] border border-neutral-800 shadow-2xl z-50 overflow-hidden"
                            in:scale={{ duration: 120, start: 0.95 }}
                            out:fade={{ duration: 100 }}
                        >
                            <button
                                role="menuitem"
                                onclick={handleGenerateAuto}
                                class="w-full text-left px-4 py-3 hover:bg-neutral-800 transition-colors flex items-start gap-3 border-b border-neutral-800"
                            >
                                <CalendarIcon class="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div class="min-w-0">
                                    <div class="text-sm font-semibold text-gray-100">Facturas del mes actual</div>
                                    <div class="text-xs text-gray-400 leading-snug mt-0.5">
                                        Genera facturas mensuales para todos los planes activos.
                                    </div>
                                </div>
                            </button>
                            <button
                                role="menuitem"
                                onclick={handleGenerateByContract}
                                class="w-full text-left px-4 py-3 hover:bg-neutral-800 transition-colors flex items-start gap-3"
                            >
                                <CalendarRangeIcon class="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div class="min-w-0">
                                    <div class="text-sm font-semibold text-gray-100">Por fecha de contrato</div>
                                    <div class="text-xs text-gray-400 leading-snug mt-0.5">
                                        Genera factura por cliente según el aniversario de su contrato. No duplica registros existentes.
                                    </div>
                                </div>
                            </button>
                        </div>
                    {/if}
                </div>
                <button onclick={handleCreate}
                    class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-2 rounded-xl bg-gray-200 text-gray-900 text-xs sm:text-sm font-semibold shadow-lg transition-colors hover:bg-gray-300">
                    <PlusIcon size={20} strokeWidth={3} fill="currentColor" />

                    Nueva
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
                        <option value="failed">Pago fallido (saldo insuficiente)</option>
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

    <ModalConfigGuard
        bind:open={configGuardOpen}
        result={configGuardResult}
        onClose={() => { configGuardOpen = false; pendingAction = null; }}
    />

    <!-- Indicador de carga -->
    {#if indicatorVisible}
        <div class="fixed bottom-4 right-4 z-[60]" in:scale={{ duration: 140, start: 0.9 }} out:fade={{ duration: 140 }}>
            <button
                class="flex items-center gap-2 bg-[#1a1a1d] border border-gray-800 text-gray-200 px-3 py-2 rounded-lg shadow-lg max-w-[320px]"
                onclick={() => overallStatus === 'error' && loadInvoices()}
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

</main>
