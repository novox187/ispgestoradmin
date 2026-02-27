<script lang="ts">
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { API_BASE } from '$lib/config';
    import { appState } from '$lib/stores/app.svelte';
    
    // Components
    import Encabezado from "$lib/components/Encabezado.svelte";
    import ClientListSidebar from "$lib/components/clientes/telegram/ClientListSidebar.svelte";
    import ClientChatArea from "$lib/components/clientes/telegram/ClientChatArea.svelte";
    
    // Modals (Keep them for functionality)
    import ModalCrearCliente from "$lib/components/clientes/ModalCrearCliente.svelte";
    import ModalEditarCliente from "$lib/components/clientes/ModalEditarCliente.svelte";
    import ModalConfirmacion from "$lib/components/common/ModalConfirmacion.svelte";

    // Icons
    import { Plus, Pencil, Trash2 } from '@lucide/svelte';

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
    let selectedClient = $state<any>(null); // Full client data
    let selectedClientMessages = $state<any[]>([]);
    let loadingMessages = $state(false);
    let isDetailOpen = $state(false);

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
        } catch (e) {
            console.error('Error cargando clientes:', e);
            toast.error('Error cargando la lista de clientes');
        } finally {
            loadingClients = false;
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

    async function handleSelectClient(event: CustomEvent<number>) {
        const id = event.detail;
        selectedClientId = id;
        loadingMessages = true;
        isDetailOpen = false; // Close detail on new selection
        selectedClientMessages = [];

        try {
            const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
            const res = await fetch(`${API_BASE}/admin/clientes/full/${id}`, {
                headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' }
            });

            if (!res.ok) throw new Error('Error cargando detalles del cliente');
            
            const data = await res.json();
            
            // Transform data for the view
            // The API returns the client object directly
            selectedClient = {
                ...data,
                status: normalizeStatus(data.status || data.estado)
            };

            // Process tickets/messages
            // The API includes 'soportes' relation
            const tickets = data.soportes || data.tickets || [];
            
            // Flatten messages from tickets
            let allMessages: any[] = [];
            tickets.forEach((ticket: any) => {
                if (ticket.messages && Array.isArray(ticket.messages)) {
                    const ticketMsgs = ticket.messages.map((m: any) => ({
                        id: m.id,
                        text: m.message,
                        sender: m.user_id ? 'me' : 'them', // Logic depends on backend structure. Assuming user_id means employee? Or check against client_id?
                        // Usually: if message.user_id matches client.user_id, it's 'them'. If it matches current admin, it's 'me'.
                        // For simplicity: if m.sender_type === 'App\Models\User' (Admin) -> 'me', 'App\Models\Client' -> 'them'
                        time: new Date(m.created_at).toLocaleString(),
                        attachments: m.attachments || []
                    }));
                    allMessages = [...allMessages, ...ticketMsgs];
                }
            });

            // Sort by date
            selectedClientMessages = allMessages.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

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

    function handleSendMessage(event: CustomEvent<string>) {
        // Mock sending for now
        const text = event.detail;
        selectedClientMessages = [...selectedClientMessages, {
            id: Date.now(),
            text,
            sender: 'me',
            time: new Date().toLocaleTimeString(),
            attachments: []
        }];
        toast.success('Mensaje enviado (Simulado)');
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
        loadClients();
    });

</script>

<div class="flex flex-col h-screen bg-[#0f0f0f] overflow-hidden w-full">
    <!-- Global Header -->
    <Encabezado {toggleSidebar} {toggleNotifications} />
    
    <!-- Main Content Area (Split View) -->
    <div class="flex-1 flex overflow-hidden relative">
        
        <!-- Sidebar -->
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

        <!-- Chat Area -->
        <div class="{!showChatOnMobile ? 'hidden md:flex' : 'flex'} flex-1 h-full min-w-0">
            <ClientChatArea 
                client={selectedClient}
                messages={selectedClientMessages}
                loading={loadingMessages}
                {isDetailOpen}
                on:sendMessage={handleSendMessage}
                on:toggleDetail={handleToggleDetail}
                on:back={() => selectedClientId = null}
                on:updated={handleClientUpdated}
            />
        </div>
        
    </div>

    <!-- Modals -->
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

    <!-- Add Client Button (Floating or integrated) -->
    <button 
        onclick={() => showAddClient = true}
        class="absolute bottom-6 left-6 md:left-72 z-50 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-105"
        title="Nuevo Cliente"
    >
        <Plus class="size-6" />
    </button>
</div>
