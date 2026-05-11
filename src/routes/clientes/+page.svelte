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
    
    // Components
    import Encabezado from "$lib/components/Encabezado.svelte";
    import ClientListSidebar from "$lib/components/clientes/telegram/ClientListSidebar.svelte";
    import ClientChatArea from "$lib/components/clientes/telegram/ClientChatArea.svelte";
    
    // Modals (Keep them for functionality)
    import ModalCrearCliente from "$lib/components/clientes/ModalCrearCliente.svelte";
    import ModalEditarCliente from "$lib/components/clientes/ModalEditarCliente.svelte";
    import ModalConfirmacion from "$lib/components/common/ModalConfirmacion.svelte";

    // Icons
    import { Plus, Pencil, Trash2, Loader2, CheckCircleIcon, XCircleIcon } from '@lucide/svelte';

    // State
    let isSidebarOpen = $state(false);
    let isNotificationsOpen = $state(false);
    function toggleSidebar() { appState.toggleSidebar() }
    function toggleNotifications() { appState.toggleNotifications() }

    // Client Data Types
    interface Client {
        id: number;
        name: string;
        email: string;
        phone: string;
        plan: string;
        status: 'active' | 'suspended' | 'inactive' | 'cancelled';
        joinDate: string;
        unreadCount?: number; // Mocked for now
    }

    // List State
    let clients = $state<Client[]>([]);
    let loadingClients = $state(false);
    let searchTerm = $state('');
    let statusFilter = $state('all');
    let page = $state(1);
    let pageSize = $state(50); // Increased for list view
    let totalClients = $state(0);

    // Selected Client State
    let selectedClientId = $state<number | null>(null);
    let selectedClient = $state<any>(null);
    let selectedClientMessages = $state<any[]>([]);
    let loadingMessages = $state(false);
    let isDetailOpen = $state(false);

    // Active ticket tracked for WebSocket subscription
    let activeTicketId = $state<number | null>(null);
    let activeTicketStatus = $state<string>('open');
    let activeClientIdForWs = $state<number | null>(null);
    let echoInstance: any = null;

    // Derived state for mobile view
    let showChatOnMobile = $derived(selectedClientId !== null);

    // Modal States
    let showAddClient = $state(false);
    let showEditClient = $state(false);
    let confirmModalOpen = $state(false);
    let confirmModalLoading = $state(false);
    let confirmModalError = $state<string | null>(null);
    let confirmModalData = $state({
        title: '',
        message: '',
        confirmText: '',
        cancelText: '',
        type: 'info' as 'danger' | 'success' | 'warning' | 'info',
        action: '' as 'suspend' | 'activate' | 'cancel',
        clientId: 0
    });

    let newClient = $state({
        name: '',
        email: '',
        phone: '',
        plan: '',
        status: 'active'
    });

    // --- Data Fetching ---

    const CLIENTS_CACHE_STORAGE = 'ispga_clients_summary_v2';
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

    async function loadClients() {
        if (inFlight) return;
        inFlight = true;
        if (clients.length === 0) loadingClients = true;
        try {
            const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: pageSize.toString(),
                search: searchTerm,
                status: statusFilter
            });
            const endpoint = `${API_BASE}/admin/clientes/summary?${params.toString()}`;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            
            loadBus.start('clients-list', endpoint);

            if (abortController) abortController.abort();
            abortController = new AbortController();

            const data = await fetchJsonWithRetry<any>(
                endpoint,
                { headers, signal: abortController.signal },
                { attempts: 3, baseDelayMs: 700 }
            );
            
            const list = data.data || [];
            totalClients = data.total || 0;

            clients = (list || []).map((c: any) => ({
                id: c.id,
                name: c.name,
                email: c.email,
                phone: c.phone,
                plan: c.plan ?? '',
                status: normalizeStatus(c.status),
                joinDate: '',
                unreadCount: 0 // Placeholder
            }));
            
            // Si no hay filtros aplicados, actualizamos el caché
            if (!searchTerm && statusFilter === 'all' && page === 1) {
                // Guardar toda la lista inicial en localStorage (hasta 5MB permitido)
                writeStorageCache(CLIENTS_CACHE_STORAGE, { clients, totalClients });
            }
            loadBus.success('clients-list');
        } catch (e: any) {
            if (e?.name === 'AbortError') return;
            console.error('Error cargando clientes:', e);
            const err = e as FetchErrorDetails;
            const message = typeof err?.message === 'string' && err.message ? err.message : 'Error cargando la lista de clientes';
            loadBus.error('clients-list', { endpoint: `${API_BASE}/admin/clientes/summary`, status: err?.status, message });
            toast.error(message);
        } finally {
            loadingClients = false;
            inFlight = false;
        }
    }

    function normalizeStatus(s: string) {
        if (!s) return 'inactive';
        const up = String(s).toUpperCase();
        if (up === 'ACTIVO' || up === 'ACTIVE') return 'active';
        if (up === 'SUSPENDIDO' || up === 'LIMITADO' || up === 'SUSPENDED') return 'suspended';
        if (up === 'CANCELLED' || up === 'CANCELADO') return 'cancelled';
        return 'inactive';
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    async function initEcho() {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
        if (!token || echoInstance) return;

        try {
            const [{ default: Echo }, { default: Pusher }] = await Promise.all([
                import('laravel-echo'),
                import('pusher-js'),
            ]);
            (window as any).Pusher = Pusher;

            const reverbScheme = import.meta.env.VITE_REVERB_SCHEME ?? 'http';
            const reverbTLS    = reverbScheme === 'https';
            const reverbPort   = Number(import.meta.env.VITE_REVERB_PORT ?? (reverbTLS ? 443 : 80));

            echoInstance = new Echo({
                broadcaster:       'reverb',
                key:               import.meta.env.VITE_REVERB_APP_KEY ?? 'isp-chat-key',
                wsHost:            import.meta.env.VITE_REVERB_HOST ?? 'localhost',
                wsPort:            reverbPort,
                wssPort:           reverbPort,
                forceTLS:          reverbTLS,
                enabledTransports: ['ws', 'wss'],
                authEndpoint:      `${API_BASE}/broadcasting/auth`,
                auth: { headers: { Authorization: `Bearer ${token}` } },
            });
        } catch (e) {
            console.warn('WebSocket no disponible', e);
        }
    }

    function subscribeToClient(clientId: number) {
        if (!echoInstance) return;
        echoInstance
            .private(`client.${clientId}`)
            .listen('.client.event', (payload: any) => {
                if (selectedClientMessages.some((m: any) => String(m.id) === String(payload.id))) return;
                selectedClientMessages = mergeSorted(selectedClientMessages, [mapClientEvent(payload)]);
            });
        activeClientIdForWs = clientId;
    }

    function subscribeToTicket(ticketId: number) {
        if (!echoInstance) return;
        echoInstance
            .private(`ticket.${ticketId}`)
            .listen('.message.sent', (payload: any) => {
                if (payload.sender !== 'user' && payload.sender !== 'system') return;
                if (selectedClientMessages.some((m: any) => String(m.id) === String(payload.id))) return;
                selectedClientMessages = mergeSorted(selectedClientMessages, [mapApiMessage(payload)]);
            });
        activeTicketId = ticketId;
    }

    function mapApiMessage(m: any) {
        return {
            id:         m.id,
            ticket_id:  m.ticket_id ?? null,
            text:       m.text ?? m.message ?? '',
            sender:     m.sender === 'agent' ? 'me' : (m.sender === 'system' ? 'system' : 'them'),
            time:       m.formatted_datetime ?? new Date(m.timestamp ?? m.created_at).toLocaleString('es'),
            timestamp:  m.timestamp ?? m.created_at ?? '',
            event_type: m.event_type ?? null,
            metadata:   m.metadata ?? null,
            attachments: (m.attachments ?? []).map((a: any) => ({
                name:     a.original_name,
                url:      a.file_url,
                type:     a.type,
                file_url: a.file_url,
            })),
        };
    }

    function mapClientEvent(e: any) {
        return {
            id:          e.id,
            ticket_id:   null as null,
            text:        e.text ?? '',
            sender:      'system' as const,
            time:        e.formatted_datetime ?? '',
            timestamp:   e.timestamp ?? '',
            event_type:  e.event_type ?? null,
            metadata:    e.metadata ?? null,
            attachments: [] as any[],
        };
    }

    function mergeSorted(msgs: any[], evts: any[]) {
        return [...msgs, ...evts].sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return ta - tb;
        });
    }

    // ── Carga de cliente y mensajes ────────────────────────────────────────────

    async function handleSelectClient(event: CustomEvent<number>) {
        const id = event.detail;

        // Dejar canales del cliente anterior antes de cambiar
        if (echoInstance) {
            if (activeTicketId) echoInstance.leave(`ticket.${activeTicketId}`);
            if (activeClientIdForWs) echoInstance.leave(`client.${activeClientIdForWs}`);
        }

        selectedClientId = id;
        loadingMessages = true;
        isDetailOpen = false;
        selectedClientMessages = [];
        activeTicketId = null;
        activeTicketStatus = 'open';
        activeClientIdForWs = null;

        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        try {
            // 1. Cargar datos completos del cliente
            const clientRes = await fetch(`${API_BASE}/admin/clientes/full/${id}`, { headers });
            if (!clientRes.ok) throw new Error('Error cargando detalles del cliente');
            const clientData = await clientRes.json();
            selectedClient = { ...clientData, status: normalizeStatus(clientData.status || clientData.service_status) };

            // Suscribirse al canal del cliente siempre (wallet_funded y otros eventos)
            await initEcho();
            subscribeToClient(id);

            // 2. Buscar el ticket activo del cliente en el nuevo endpoint de chat
            //    Cargamos las conversaciones y buscamos el ticket de este cliente
            const convRes = await fetch(`${API_BASE}/admin/chat/conversations?per_page=100`, { headers });
            if (convRes.ok) {
                const convData = await convRes.json();
                const ticket = (convData.data ?? []).find((t: any) => t.client?.id === id);

                if (ticket) {
                    activeTicketId = ticket.ticket_id;
                    activeTicketStatus = ticket.status ?? 'open';
                    const clientId: number | null = ticket.client?.id ?? null;

                    // 3. Cargar mensajes del ticket
                    const msgRes = await fetch(`${API_BASE}/admin/chat/${ticket.ticket_id}/messages?per_page=50`, { headers });
                    if (msgRes.ok) {
                        const msgData = await msgRes.json();
                        const msgs = (msgData.messages ?? []).reverse().map(mapApiMessage);
                        const evts = (msgData.events ?? []).map(mapClientEvent);
                        selectedClientMessages = mergeSorted(msgs, evts);
                        activeTicketStatus = msgData.ticket?.status ?? activeTicketStatus;

                        // 4. Suscribir al canal del ticket para mensajes de chat
                        subscribeToTicket(ticket.ticket_id);
                    }
                }
            }
        } catch (e) {
            console.error(e);
            toast.error('No se pudieron cargar los mensajes');
        } finally {
            loadingMessages = false;
        }
    }

    // --- Event Handlers ---

    function handleSearch(event: CustomEvent<string>) {
        searchTerm = event.detail;
        page = 1;
        loadClients();
    }

    function handleFilter(event: CustomEvent<string>) {
        statusFilter = event.detail;
        page = 1;
        loadClients();
    }

    async function handleSendMessage(event: CustomEvent<string>) {
        const text = event.detail;
        if (!text.trim() || !activeTicketId) {
            if (!activeTicketId) toast.error('No hay un ticket activo para este cliente.');
            return;
        }

        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
        if (!token) { toast.error('No autenticado.'); return; }

        // Optimistic update
        const tempMsg = {
            id:          `temp-${Date.now()}`,
            text,
            sender:      'me',
            time:        new Date().toLocaleString('es'),
            event_type:  null,
            metadata:    null,
            attachments: [],
        };
        selectedClientMessages = [...selectedClientMessages, tempMsg];

        try {
            const formData = new FormData();
            formData.append('message', text);

            const res = await fetch(`${API_BASE}/admin/chat/${activeTicketId}/messages`, {
                method:  'POST',
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                body:    formData,
            });

            if (!res.ok) {
                selectedClientMessages = selectedClientMessages.filter(m => m.id !== tempMsg.id);
                const errData = await res.json().catch(() => ({}));
                toast.error(errData.message || 'Error al enviar el mensaje.');
                return;
            }

            const saved = await res.json();
            // Reemplazar mensaje temporal con la respuesta real del servidor
            selectedClientMessages = selectedClientMessages.map(m =>
                m.id === tempMsg.id ? mapApiMessage(saved) : m
            );
        } catch (err) {
            selectedClientMessages = selectedClientMessages.filter(m => m.id !== tempMsg.id);
            toast.error('Error de red al enviar el mensaje.');
        }
    }

    async function handleCloseTicket() {
        if (!activeTicketId) return;
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
        if (!token) { toast.error('No autenticado.'); return; }
        try {
            const res = await fetch(`${API_BASE}/admin/chat/${activeTicketId}/status`, {
                method: 'PUT',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ status: 'closed' }),
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

    function handleToggleDetail() {
        isDetailOpen = !isDetailOpen;
    }

    function handleClientUpdated(event: CustomEvent<any>) {
        loadClients();
        const updatedData = event.detail.client || event.detail;
        if (selectedClient && selectedClient.id === updatedData.id) {
             selectedClient = {
                ...selectedClient,
                ...updatedData,
                status: normalizeStatus(updatedData.status || updatedData.service_status)
            };
        }
    }

    function handleCreated() {
        showAddClient = false;
        loadClients();
    }

    function handleCloseModal() {
        showAddClient = false;
    }

    onMount(() => {
        const cached = readStorageCache<{clients: Client[], totalClients: number}>(CLIENTS_CACHE_STORAGE);
        if (cached?.data?.clients && Array.isArray(cached.data.clients) && cached.data.clients.length > 0) {
            clients = cached.data.clients;
            totalClients = cached.data.totalClients || cached.data.clients.length;
            loadingClients = false;
        }

        loadClients();
        initEcho();
        const interval = setInterval(loadClients, 60000);

        return () => {
            clearInterval(interval);
            if (abortController) abortController.abort();
        };
    });

    onDestroy(() => {
        if (echoInstance) {
            echoInstance.disconnect();
            echoInstance = null;
        }
    });

</script>

<div class="flex flex-col h-screen bg-[#09090f] overflow-hidden w-full">
    <!-- Encabezado global -->
    <Encabezado {toggleSidebar} {toggleNotifications} />

    <!-- Área principal (vista dividida) -->
    <div class="flex-1 flex overflow-hidden relative">

        <!-- Sidebar de clientes -->
        <div class="{showChatOnMobile ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full">
            <ClientListSidebar
                {clients}
                {selectedClientId}
                {searchTerm}
                {statusFilter}
                loading={loadingClients}
                on:select={handleSelectClient}
                on:search={handleSearch}
                on:filter={handleFilter}
            />
        </div>

        <!-- Área de chat / detalle -->
        <div class="{!showChatOnMobile ? 'hidden md:flex' : 'flex'} flex-1 h-full min-w-0">
            <ClientChatArea
                client={selectedClient}
                messages={selectedClientMessages}
                loading={loadingMessages}
                {isDetailOpen}
                {activeTicketId}
                ticketStatus={activeTicketStatus}
                on:sendMessage={handleSendMessage}
                on:toggleDetail={handleToggleDetail}
                on:back={() => selectedClientId = null}
                on:updated={handleClientUpdated}
                on:closeTicket={handleCloseTicket}
            />
        </div>

        <!-- FAB — Agregar cliente -->
        <button
            type="button"
            onclick={() => showAddClient = true}
            aria-label="Agregar nuevo cliente"
            class="{showChatOnMobile ? 'hidden md:inline-flex' : 'inline-flex'}
                   absolute bottom-5 left-5 z-20 items-center justify-center
                   size-13 bg-primary-600 text-white rounded-full shadow-xl
                   hover:bg-primary-500 hover:scale-105 active:scale-95
                   transition-all duration-150 shadow-primary-900/40
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
        >
            <Plus class="size-5" />
        </button>

    </div>

    <!-- Modal de creación -->
    {#if showAddClient}
        <ModalCrearCliente
            newClient={{
                name: newClient.name,
                email: newClient.email,
                phone: newClient.phone,
                plan: newClient.plan,
                status: newClient.status === 'cancelled' ? undefined : newClient.status as 'active' | 'suspended' | 'inactive' | undefined
            }}
            {showAddClient}
            handleAddClient={() => {}}
            on:close={handleCloseModal}
            on:created={handleCreated}
        />
    {/if}

    <!-- Indicador de estado de carga -->
    {#if indicatorVisible}
        <div
            class="fixed bottom-5 right-5 z-[60]"
            in:scale={{ duration: 140, start: 0.9 }}
            out:fade={{ duration: 140 }}
        >
            <button
                class="flex items-center gap-2 bg-surface-overlay border border-white/[0.08] text-text-secondary
                       px-3.5 py-2.5 rounded-xl shadow-xl max-w-[300px] transition-colors
                       hover:bg-surface-hover"
                onclick={() => overallStatus === 'error' && loadClients()}
                aria-label={overallStatus === 'error' ? 'Reintentar carga — ' + overallMessage : 'Estado de sincronización'}
            >
                {#if overallStatus === 'loading'}
                    <Loader2 class="size-3.5 animate-spin text-primary-400 shrink-0" aria-hidden="true" />
                    <span class="text-xs text-text-muted">Sincronizando...</span>
                {:else if overallStatus === 'success'}
                    <CheckCircleIcon class="size-3.5 text-success-400 shrink-0" aria-hidden="true" />
                    <span class="text-xs text-text-muted">Al día</span>
                {:else if overallStatus === 'error'}
                    <XCircleIcon class="size-3.5 text-danger-400 shrink-0" aria-hidden="true" />
                    <span class="text-xs text-danger-400 truncate">{overallMessage || 'Error de conexión'}</span>
                {/if}
            </button>
        </div>
    {/if}
</div>
