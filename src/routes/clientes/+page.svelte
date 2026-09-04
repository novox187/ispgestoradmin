<script lang="ts">
    import { onMount, onDestroy, setContext } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { toast } from 'svelte-sonner';
    import { API_BASE } from '$lib/config';
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

    import Encabezado from '$lib/components/Encabezado.svelte';
    import ClientsToolbar from '$lib/components/clientes/workspace/ClientsToolbar.svelte';
    import ClientList from '$lib/components/clientes/workspace/ClientList.svelte';
    import ClientWorkspace from '$lib/components/clientes/workspace/ClientWorkspace.svelte';
    import ModalCrearCliente from '$lib/components/clientes/ModalCrearCliente.svelte';
    import type { ClientStats, ClientRow } from '$lib/types/clientes';
    import { normalizeStatus } from '$lib/utils/client-status';

    import { Loader2, CheckCircleIcon, XCircleIcon } from '@lucide/svelte';

    function toggleSidebar() { appState.toggleSidebar(); }
    function toggleNotifications() { appState.toggleNotifications(); }

    // ── Estado del listado ────────────────────────────────────────────────────
    let clients = $state<ClientRow[]>([]);
    let stats = $state<ClientStats | null>(null);
    let loadingClients = $state(false);
    let searching = $state(false);
    let refreshing = $state(false);

    let searchTerm = $state('');
    let statusFilter = $state('all');
    let sort = $state('id');
    let dir = $state<'asc' | 'desc'>('asc');
    let page = $state(1);
    const PER_PAGE = 25;
    let lastPage = $state(1);
    let totalClients = $state(0);

    let hasFilters = $derived(searchTerm.trim() !== '' || statusFilter !== 'all');

    // ── Cliente seleccionado ──────────────────────────────────────────────────
    let selectedClientId = $state<number | null>(null);
    let selectedClient = $state<any>(null);
    let selectedClientMessages = $state<any[]>([]);
    let loadingClient = $state(false);
    let loadingMessages = $state(false);
    let unreadCount = $state(0);
    let isAdmin = $state(false);

    let activeTicketId = $state<number | null>(null);
    let activeTicketStatus = $state<string>('open');
    let activeClientIdForWs = $state<number | null>(null);
    let echoInstance: any = null;

    let showChatOnMobile = $derived(selectedClientId !== null);
    let showAddClient = $state(false);

    // ── Indicador de sincronización ───────────────────────────────────────────
    const CLIENTS_CACHE_STORAGE = 'ispga_clients_summary_v3';
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
        return errors[0]?.[1]?.message || '';
    });

    function setRequestState(key: string, next: { status: DashboardLoadStatus; endpoint: string; message?: string }) {
        requestStates = { ...requestStates, [key]: { ...next, updatedAt: Date.now() } };
    }

    const loadBus: DashboardLoadBus = {
        start: (key, endpoint) => setRequestState(key, { status: 'loading', endpoint }),
        success: (key) => setRequestState(key, { status: 'success', endpoint: requestStates[key]?.endpoint || '' }),
        error: (key, details) => setRequestState(key, { status: 'error', endpoint: details.endpoint, message: details.message })
    };

    setContext(DASHBOARD_LOAD_CONTEXT, loadBus);

    $effect(() => {
        if (indicatorHideTimer) { clearTimeout(indicatorHideTimer); indicatorHideTimer = null; }

        if (overallStatus === 'idle') { indicatorVisible = false; return; }
        indicatorVisible = true;

        if (overallStatus === 'success') {
            indicatorHideTimer = setTimeout(() => { if (overallStatus === 'success') indicatorVisible = false; }, 2500);
        } else if (overallStatus === 'error') {
            indicatorHideTimer = setTimeout(() => { if (overallStatus === 'error') indicatorVisible = false; }, 9000);
        }

        return () => {
            if (indicatorHideTimer) { clearTimeout(indicatorHideTimer); indicatorHideTimer = null; }
        };
    });

    // ── Carga del listado ─────────────────────────────────────────────────────
    function authHeaders(): Record<string, string> {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
    }

    async function loadClients(opts: { silent?: boolean } = {}) {
        if (inFlight) return;
        inFlight = true;
        if (clients.length === 0 && !opts.silent) loadingClients = true;

        try {
            const params = new URLSearchParams({
                page: String(page),
                per_page: String(PER_PAGE),
                search: searchTerm,
                status: statusFilter,
                sort,
                dir
            });
            const endpoint = `${API_BASE}/admin/clientes/summary?${params.toString()}`;

            loadBus.start('clients-list', endpoint);

            if (abortController) abortController.abort();
            abortController = new AbortController();

            const data = await fetchJsonWithRetry<any>(
                endpoint,
                { headers: authHeaders(), signal: abortController.signal },
                { attempts: 3, baseDelayMs: 700 }
            );

            clients = (data.data ?? []) as ClientRow[];
            totalClients = data.total ?? 0;
            lastPage = data.last_page ?? 1;
            stats = data.stats ?? null;

            // La página que se cachea es la primera sin filtros: es la que se
            // pinta al entrar, y cachear una vista filtrada la mostraría como
            // si fuera el listado completo.
            if (!searchTerm && statusFilter === 'all' && page === 1) {
                writeStorageCache(CLIENTS_CACHE_STORAGE, { clients, totalClients, lastPage, stats });
            }

            loadBus.success('clients-list');
        } catch (e: any) {
            if (e?.name === 'AbortError') return;
            console.error('Error cargando clientes:', e);
            const err = e as FetchErrorDetails;
            const message = typeof err?.message === 'string' && err.message ? err.message : 'No se pudo cargar el listado de clientes.';
            loadBus.error('clients-list', { endpoint: `${API_BASE}/admin/clientes/summary`, status: err?.status, message });
            toast.error(message);
        } finally {
            loadingClients = false;
            searching = false;
            refreshing = false;
            inFlight = false;
        }
    }

    // El listado se recarga tras una pausa de escritura: antes cada tecla
    // lanzaba una petición que la siguiente abortaba a medio camino.
    const SEARCH_DEBOUNCE_MS = 320;
    let searchTimer: ReturnType<typeof setTimeout> | null = null;

    function handleSearch(value: string) {
        searchTerm = value;
        searching = true;
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            page = 1;
            loadClients();
        }, SEARCH_DEBOUNCE_MS);
    }

    function handleFilter(value: string) {
        statusFilter = statusFilter === value && value !== 'all' ? 'all' : value;
        page = 1;
        loadClients();
    }

    function handleSort(value: string) {
        if (sort === value) {
            dir = dir === 'asc' ? 'desc' : 'asc';
        } else {
            sort = value;
            // La deuda interesa de mayor a menor; el resto en orden natural.
            dir = value === 'debt' ? 'desc' : 'asc';
        }
        page = 1;
        loadClients();
    }

    function handlePage(next: number) {
        if (next < 1 || next > lastPage || next === page) return;
        page = next;
        loadClients();
    }

    function handleRefresh() {
        refreshing = true;
        loadClients({ silent: true });
    }

    function clearFilters() {
        searchTerm = '';
        statusFilter = 'all';
        page = 1;
        loadClients();
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────
    async function initEcho() {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
        if (!token || echoInstance) return;

        try {
            const [{ default: Echo }, { default: Pusher }] = await Promise.all([
                import('laravel-echo'),
                import('pusher-js')
            ]);
            (window as any).Pusher = Pusher;

            const scheme = import.meta.env.VITE_REVERB_SCHEME ?? 'http';
            const tls = scheme === 'https';
            const port = Number(import.meta.env.VITE_REVERB_PORT ?? (tls ? 443 : 80));

            echoInstance = new Echo({
                broadcaster: 'reverb',
                key: import.meta.env.VITE_REVERB_APP_KEY ?? 'isp-chat-key',
                wsHost: import.meta.env.VITE_REVERB_HOST ?? 'localhost',
                wsPort: port,
                wssPort: port,
                forceTLS: tls,
                enabledTransports: ['ws', 'wss'],
                authEndpoint: `${API_BASE}/broadcasting/auth`,
                auth: { headers: { Authorization: `Bearer ${token}` } }
            });
        } catch (e) {
            console.warn('WebSocket no disponible', e);
        }
    }

    function subscribeToClient(clientId: number) {
        if (!echoInstance) return;
        echoInstance.private(`client.${clientId}`).listen('.client.event', (payload: any) => {
            if (selectedClientMessages.some((m: any) => String(m.id) === String(payload.id))) return;
            selectedClientMessages = mergeSorted(selectedClientMessages, [mapClientEvent(payload)]);
        });
        activeClientIdForWs = clientId;
    }

    function subscribeToTicket(ticketId: number) {
        if (!echoInstance) return;
        echoInstance.private(`ticket.${ticketId}`).listen('.message.sent', (payload: any) => {
            if (payload.sender !== 'user' && payload.sender !== 'system') return;
            if (selectedClientMessages.some((m: any) => String(m.id) === String(payload.id))) return;
            selectedClientMessages = mergeSorted(selectedClientMessages, [mapApiMessage(payload)]);
            unreadCount += 1;
        });
        activeTicketId = ticketId;
    }

    function leaveChannels() {
        if (!echoInstance) return;
        if (activeTicketId) echoInstance.leave(`ticket.${activeTicketId}`);
        if (activeClientIdForWs) echoInstance.leave(`client.${activeClientIdForWs}`);
    }

    function mapApiMessage(m: any) {
        return {
            id: m.id,
            ticket_id: m.ticket_id ?? null,
            text: m.text ?? m.message ?? '',
            sender: m.sender === 'agent' ? 'me' : (m.sender === 'system' ? 'system' : 'them'),
            time: m.formatted_datetime ?? new Date(m.timestamp ?? m.created_at).toLocaleString('es-EC'),
            timestamp: m.timestamp ?? m.created_at ?? '',
            event_type: m.event_type ?? null,
            metadata: m.metadata ?? null,
            attachments: (m.attachments ?? []).map((a: any) => ({
                name: a.original_name,
                url: a.file_url,
                type: a.type,
                file_url: a.file_url
            }))
        };
    }

    function mapClientEvent(e: any) {
        return {
            id: e.id,
            ticket_id: null as null,
            text: e.text ?? '',
            sender: 'system' as const,
            time: e.formatted_datetime ?? '',
            timestamp: e.timestamp ?? '',
            event_type: e.event_type ?? null,
            metadata: e.metadata ?? null,
            attachments: [] as any[]
        };
    }

    function mergeSorted(existing: any[], incoming: any[]) {
        const seen = new Set(existing.map((m: any) => String(m.id)));
        const deduped = incoming.filter((m: any) => !seen.has(String(m.id)));
        return [...existing, ...deduped].sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return ta - tb;
        });
    }

    // ── Selección de cliente ──────────────────────────────────────────────────
    async function selectClient(id: number) {
        leaveChannels();

        selectedClientId = id;
        loadingClient = true;
        loadingMessages = true;
        selectedClient = null;
        selectedClientMessages = [];
        activeTicketId = null;
        activeTicketStatus = 'open';
        activeClientIdForWs = null;
        unreadCount = 0;

        const headers = authHeaders();

        try {
            const clientRes = await fetch(`${API_BASE}/admin/clientes/full/${id}`, { headers });
            if (!clientRes.ok) throw new Error('No se pudo cargar la ficha del cliente.');
            const data = await clientRes.json();
            selectedClient = { ...data, status: normalizeStatus(data.status || data.service_status) };
        } catch (e) {
            console.error(e);
            toast.error('No se pudo cargar la ficha del cliente.');
            loadingClient = false;
            loadingMessages = false;
            return;
        }
        loadingClient = false;

        // La conversación se carga aparte: la ficha ya se puede leer mientras
        // llega, y un fallo del chat no debe dejar la pantalla vacía.
        try {
            await initEcho();
            subscribeToClient(id);

            const evtsRes = await fetch(`${API_BASE}/admin/chat/client/${id}/events`, { headers });
            if (evtsRes.ok) {
                const evtsData = await evtsRes.json();
                const evts = (evtsData.events ?? []).map(mapClientEvent);
                if (evts.length) selectedClientMessages = mergeSorted(selectedClientMessages, evts);
            }

            // Un único endpoint para el ticket del cliente. Antes se descargaban
            // 100 conversaciones y se buscaba la suya con un find() en el navegador.
            const ticketRes = await fetch(`${API_BASE}/admin/chat/client/${id}/ticket`, { headers });
            if (ticketRes.ok) {
                const { ticket } = await ticketRes.json();
                if (ticket) {
                    activeTicketId = ticket.ticket_id;
                    activeTicketStatus = ticket.status ?? 'open';
                    unreadCount = ticket.unread_count ?? 0;

                    const msgRes = await fetch(`${API_BASE}/admin/chat/${ticket.ticket_id}/messages?per_page=50`, { headers });
                    if (msgRes.ok) {
                        const msgData = await msgRes.json();
                        const msgs = (msgData.messages ?? []).reverse().map(mapApiMessage);
                        const evts = (msgData.events ?? []).map(mapClientEvent);
                        selectedClientMessages = mergeSorted(msgs, evts);
                        activeTicketStatus = msgData.ticket?.status ?? activeTicketStatus;
                        subscribeToTicket(ticket.ticket_id);
                    }
                }
            }
        } catch (e) {
            console.error(e);
            toast.error('No se pudo cargar la conversación del cliente.');
        } finally {
            loadingMessages = false;
        }
    }

    // ── Mensajería ────────────────────────────────────────────────────────────
    async function handleSendMessage(event: CustomEvent<string>) {
        const text = event.detail;
        if (!text.trim()) return;
        if (!activeTicketId) { toast.error('No hay un ticket abierto para este cliente.'); return; }

        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
        if (!token) { toast.error('Sesión no válida.'); return; }

        const tempMsg = {
            id: `temp-${Date.now()}`,
            ticket_id: activeTicketId,
            text,
            sender: 'me',
            time: new Date().toLocaleString('es-EC'),
            timestamp: new Date().toISOString(),
            event_type: null,
            metadata: null,
            attachments: []
        };
        selectedClientMessages = [...selectedClientMessages, tempMsg];

        try {
            const formData = new FormData();
            formData.append('message', text);

            const res = await fetch(`${API_BASE}/admin/chat/${activeTicketId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                body: formData
            });

            if (!res.ok) {
                selectedClientMessages = selectedClientMessages.filter(m => m.id !== tempMsg.id);
                const err = await res.json().catch(() => ({}));
                toast.error(err.message || 'No se pudo enviar el mensaje.');
                return;
            }

            const saved = await res.json();
            selectedClientMessages = selectedClientMessages.map(m => m.id === tempMsg.id ? mapApiMessage(saved) : m);
        } catch {
            selectedClientMessages = selectedClientMessages.filter(m => m.id !== tempMsg.id);
            toast.error('Error de red al enviar el mensaje.');
        }
    }

    async function handleCloseTicket() {
        if (!activeTicketId) return;
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
        if (!token) { toast.error('Sesión no válida.'); return; }

        try {
            const res = await fetch(`${API_BASE}/admin/chat/${activeTicketId}/status`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ status: 'closed' })
            });
            if (res.ok) {
                activeTicketStatus = 'closed';
                toast.success('Ticket cerrado correctamente.');
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.message || 'No se pudo cerrar el ticket.');
            }
        } catch {
            toast.error('Error de red al cerrar el ticket.');
        }
    }

    // ── Sincronización tras cambios ───────────────────────────────────────────
    function handleClientUpdated(event: CustomEvent<any>) {
        loadClients({ silent: true });
        const updated = event.detail?.client ?? event.detail;
        if (selectedClient && updated?.id === selectedClient.id) {
            selectedClient = {
                ...selectedClient,
                ...updated,
                status: normalizeStatus(updated.status || updated.service_status)
            };
        } else if (selectedClientId) {
            // Las acciones de servicio responden sin la ficha completa: se
            // recarga para que saldo, deuda y plan reflejen el nuevo estado.
            selectClient(selectedClientId);
        }
    }

    function handleCreated() {
        showAddClient = false;
        loadClients();
    }

    onMount(() => {
        const role = (localStorage.getItem('employee_role') || '').toLowerCase().trim();
        isAdmin = ['admin', 'administrador', 'super_admin', 'super admin'].includes(role);

        const cached = readStorageCache<{ clients: ClientRow[]; totalClients: number; lastPage: number; stats: ClientStats | null }>(CLIENTS_CACHE_STORAGE);
        if (cached?.data?.clients?.length) {
            clients = cached.data.clients;
            totalClients = cached.data.totalClients ?? clients.length;
            lastPage = cached.data.lastPage ?? 1;
            stats = cached.data.stats ?? null;
            loadingClients = false;
        }

        loadClients();
        initEcho();

        // Refresco de fondo: mantiene contadores y deuda al día sin que nadie
        // tenga que recargar la página en una jornada de soporte.
        const interval = setInterval(() => loadClients({ silent: true }), 60000);

        return () => {
            clearInterval(interval);
            if (searchTimer) clearTimeout(searchTimer);
            abortController?.abort();
        };
    });

    onDestroy(() => {
        if (echoInstance) {
            echoInstance.disconnect();
            echoInstance = null;
        }
    });
</script>

<div class="flex flex-col h-screen w-full overflow-hidden bg-surface-base">
    <Encabezado {toggleSidebar} {toggleNotifications} />

    <div class="{showChatOnMobile ? 'hidden md:block' : 'block'} shrink-0">
        <ClientsToolbar
            {stats}
            {statusFilter}
            {searchTerm}
            {searching}
            {refreshing}
            onSearch={handleSearch}
            onFilter={handleFilter}
            onRefresh={handleRefresh}
            onCreate={() => showAddClient = true}
        />
    </div>

    <div class="flex-1 flex min-h-0 overflow-hidden">
        <!-- Listado -->
        <div class="{showChatOnMobile ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full">
            <ClientList
                {clients}
                {selectedClientId}
                loading={loadingClients}
                {page}
                {lastPage}
                total={totalClients}
                perPage={PER_PAGE}
                {sort}
                {dir}
                {hasFilters}
                onSelect={selectClient}
                onPage={handlePage}
                onSort={handleSort}
                onClearFilters={clearFilters}
            />
        </div>

        <!-- Espacio de trabajo -->
        <div class="{!showChatOnMobile ? 'hidden md:flex' : 'flex'} flex-1 h-full min-w-0">
            <div class="flex-1 min-w-0">
                <ClientWorkspace
                    client={selectedClient}
                    messages={selectedClientMessages}
                    {loadingClient}
                    {loadingMessages}
                    {activeTicketId}
                    ticketStatus={activeTicketStatus}
                    {unreadCount}
                    {isAdmin}
                    on:sendMessage={handleSendMessage}
                    on:closeTicket={handleCloseTicket}
                    on:updated={handleClientUpdated}
                    on:back={() => { leaveChannels(); selectedClientId = null; selectedClient = null; }}
                />
            </div>
        </div>
    </div>

    {#if showAddClient}
        <ModalCrearCliente
            newClient={{ name: '', email: '', phone: '', plan: '', status: 'active' }}
            showAddClient
            handleAddClient={() => {}}
            on:close={() => showAddClient = false}
            on:created={handleCreated}
        />
    {/if}

    <!-- Estado de sincronización -->
    {#if indicatorVisible}
        <div class="fixed bottom-4 right-4 z-[60]" in:scale={{ duration: 140, start: 0.92 }} out:fade={{ duration: 140 }}>
            <button
                type="button"
                onclick={() => overallStatus === 'error' && loadClients()}
                aria-label={overallStatus === 'error' ? `Reintentar carga: ${overallMessage}` : 'Estado de sincronización'}
                class="flex items-center gap-2 max-w-[19rem] px-3 py-2.5 rounded-xl shadow-xl
                       bg-surface-overlay border border-white/[0.08] text-text-secondary
                       hover:bg-surface-hover transition-colors duration-150
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
                {#if overallStatus === 'loading'}
                    <Loader2 class="size-3.5 shrink-0 text-primary-400 animate-spin" aria-hidden="true" />
                    <span class="text-xs text-text-muted">Sincronizando…</span>
                {:else if overallStatus === 'success'}
                    <CheckCircleIcon class="size-3.5 shrink-0 text-success-400" aria-hidden="true" />
                    <span class="text-xs text-text-muted">Al día</span>
                {:else if overallStatus === 'error'}
                    <XCircleIcon class="size-3.5 shrink-0 text-danger-400" aria-hidden="true" />
                    <span class="text-xs text-danger-400 truncate">{overallMessage || 'Error de conexión'}</span>
                {/if}
            </button>
        </div>
    {/if}
</div>
