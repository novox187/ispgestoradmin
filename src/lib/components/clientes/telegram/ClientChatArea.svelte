<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { 
        Send, Paperclip, MoreVertical, Phone, Mail, 
        MapPin, CreditCard, User, X, ArrowLeft
    } from '@lucide/svelte';
    import ClientDetailSidebar from './ClientDetailSidebar.svelte';
    import ModalConfirmacion from "$lib/components/common/ModalConfirmacion.svelte";
    import ModalAddFunds from "./ModalAddFunds.svelte";
    import { API_BASE } from '$lib/config';
    import { toast } from 'svelte-sonner';

    interface Attachment {
        name: string;
        url?: string;
    }

    interface Message {
        id: number | string;
        text: string;
        sender: 'me' | 'them';
        time: string;
        attachments?: Attachment[];
    }

    interface Client {
        id: number;
        name: string;
        status?: string;
        service_status?: string;
        [key: string]: any;
    }

    let { 
        client = null, 
        messages = [], 
        loading = false,
        isDetailOpen = false
    }: {
        client?: Client | null;
        messages?: Message[];
        loading?: boolean;
        isDetailOpen?: boolean;
    } = $props();

    const dispatch = createEventDispatcher();

    let newMessage = $state('');
    let chatContainer: HTMLDivElement;

    let showDropdown = $state(false);
    let showConfirmModal = $state(false);
    let actionType = $state<'suspend' | 'activate' | null>(null);
    let actionLoading = $state(false);
    
    let showAddFundsModal = $state(false);
    let isAdmin = $state(false);
    let detailMounted = $state(false);
    let detailVisible = $state(false);
    let detailUnmountTimer: ReturnType<typeof setTimeout> | null = null;

    $effect(() => {
        const role = (localStorage.getItem('employee_role') || '').toLowerCase().trim();
        isAdmin = role === 'admin' || role === 'administrador' || role === 'super_admin' || role === 'super admin';
    });

    $effect(() => {
        if (detailUnmountTimer) {
            clearTimeout(detailUnmountTimer);
            detailUnmountTimer = null;
        }

        if (isDetailOpen) {
            detailMounted = true;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    detailVisible = true;
                });
            });
            return;
        }

        detailVisible = false;

        if (detailMounted) {
            detailUnmountTimer = setTimeout(() => {
                detailMounted = false;
                detailUnmountTimer = null;
            }, 620);
        }
    });

    function toggleDropdown() {
        showDropdown = !showDropdown;
    }

    function handleActionClick(action: 'suspend' | 'activate') {
        showDropdown = false;
        actionType = action;
        showConfirmModal = true;
    }

    function closeConfirmModal() {
        showConfirmModal = false;
        actionType = null;
    }

    async function executeAction() {
        if (!client || !client.id) {
            toast.error("ID de cliente inválido.");
            return;
        }
        
        actionLoading = true;
        try {
            const token = localStorage.getItem('employee_token');
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const endpoint = actionType === 'suspend' 
                ? `${API_BASE}/admin/clientes/${client.id}/suspend`
                : `${API_BASE}/admin/clientes/${client.id}/activate`;
                
            const res = await fetch(endpoint, {
                method: 'POST',
                headers
            });
            
            if (res.ok) {
                const data = await res.json();
                toast.success(`Cliente ${actionType === 'suspend' ? 'suspendido' : 'activado'} correctamente.`);
                // actualizamos el estado local
                if (client) {
                    const newStatus = actionType === 'suspend' ? 'SUSPENDED' : 'ACTIVE';
                    if ('status' in client) client.status = newStatus;
                    if ('service_status' in client) client.service_status = newStatus;
                }
                dispatch('updated', data);
            } else {
                const errorData = await res.json().catch(() => ({}));
                toast.error(errorData.message || `Error al ${actionType === 'suspend' ? 'suspender' : 'activar'} el cliente.`);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error de red al procesar la solicitud.");
        } finally {
            actionLoading = false;
            showConfirmModal = false;
            actionType = null;
        }
    }

    function handleWindowClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (showDropdown && !target.closest('.dropdown-container')) {
            showDropdown = false;
        }
    }

    function handleSendMessage() {
        if (!newMessage.trim()) return;
        dispatch('sendMessage', newMessage);
        newMessage = '';
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }

    function toggleDetail() {
        dispatch('toggleDetail');
    }
    
    function goBack() {
        dispatch('back');
    }

    // Auto-scroll to bottom when messages change
    $effect(() => {
        if (messages.length && chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });

    function getInitials(name: string) {
        return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '';
    }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="flex flex-1 h-full bg-[#0f0f0f] relative overflow-hidden">
    {#if !client}
        <!-- Empty State -->
        <div class="flex-1 flex flex-col items-center justify-center text-neutral-500 p-8 select-none">
            <div class="bg-[#1c1c1e] p-4 rounded-full mb-4">
                <User class="size-12 opacity-50" />
            </div>
            <h3 class="text-lg font-medium text-white mb-2">Selecciona un cliente</h3>
            <p class="text-sm max-w-xs text-center">Elige un cliente de la lista para ver su historial de chat y detalles.</p>
        </div>
    {:else}
        <!-- Main Chat Area -->
        <div class="flex-1 flex flex-col min-w-0 chat-layer" class:chat-hidden={detailVisible} aria-hidden={detailVisible}>
            
            <!-- Header -->
            <header class="h-16 border-b border-neutral-800 flex items-center justify-between px-4 bg-[#1c1c1e]/50 backdrop-blur-md sticky top-0 z-10">
                <div class="flex items-center gap-3">
                    <button onclick={goBack} class="md:hidden text-neutral-400 hover:text-white mr-2">
                        <ArrowLeft class="size-5" />
                    </button>
                    
                    <button 
                        onclick={toggleDetail}
                        class="flex items-center gap-3 hover:bg-white/5 p-2 rounded-lg transition-colors group text-left"
                    >
                        <div class="size-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            {getInitials(client.name)}
                        </div>
                        <div>
                            <h2 class="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                                {client.name}
                            </h2>
                            <span class="text-xs flex items-center gap-1.5">
                                <span class="size-2 rounded-full {(client.status?.toUpperCase() === 'ACTIVE' || client.service_status?.toUpperCase() === 'ACTIVE') ? 'bg-green-500' : 'bg-red-500'}"></span>
                                <span class="text-neutral-400">{(client.status?.toUpperCase() === 'ACTIVE' || client.service_status?.toUpperCase() === 'ACTIVE') ? 'En línea' : 'Desconectado'}</span>
                            </span>
                        </div>
                    </button>
                </div>

                <div class="flex items-center gap-2 relative dropdown-container">
                    <button onclick={toggleDropdown} disabled={actionLoading} class="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-50" title="Opciones del cliente">
                        {#if actionLoading}
                            <div class="size-5 border-2 border-neutral-400 border-t-white rounded-full animate-spin"></div>
                        {:else}
                            <MoreVertical class="size-5" />
                        {/if}
                    </button>
                    
                    {#if showDropdown}
                        <div class="absolute top-full right-0 mt-2 w-48 bg-[#1c1c1e] rounded-xl border border-neutral-800 shadow-xl overflow-hidden z-50">
                            <button onclick={() => { showDropdown = false; toggleDetail(); }} class="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-white/5 transition-colors">
                                Ver Detalles
                            </button>
                            {#if (client?.status?.toUpperCase() === 'ACTIVE') || (client?.service_status?.toUpperCase() === 'ACTIVE')}
                                <button onclick={() => handleActionClick('suspend')} class="w-full text-left px-4 py-2 text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors border-t border-neutral-800">
                                    Suspender
                                </button>
                            {:else}
                                <button onclick={() => handleActionClick('activate')} class="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-green-500/10 transition-colors border-t border-neutral-800">
                                    Activar
                                </button>
                            {/if}
                            {#if isAdmin}
                                <button onclick={() => { showDropdown = false; showAddFundsModal = true; }} class="w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors border-t border-neutral-800 flex items-center gap-2">
                                    <CreditCard class="size-4" /> Agregar Fondos
                                </button>
                            {/if}
                        </div>
                    {/if}
                </div>
            </header>

            <!-- Messages -->
            <div 
                bind:this={chatContainer}
                class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
                {#if loading}
                    <div class="flex justify-center p-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                {:else if messages.length === 0}
                    <div class="text-center text-neutral-500 mt-10 text-sm">
                        <p>No hay mensajes en esta conversación.</p>
                        <p class="text-xs mt-1">Envía un mensaje para comenzar.</p>
                    </div>
                {:else}
                    {#each messages as msg (msg.id)}
                        <div class="flex flex-col {msg.sender === 'me' ? 'items-end' : 'items-start'} w-full">
                            <div class="flex items-end gap-2 max-w-[85%] {msg.sender === 'me' ? 'flex-row-reverse' : 'flex-row'}">
                                {#if msg.sender !== 'me'}
                                    <div class="size-6 rounded-full bg-neutral-700 flex items-center justify-center text-[10px] text-white shrink-0 mb-1">
                                        {getInitials(client.name)}
                                    </div>
                                {/if}
                                
                                <div class="relative group">
                                    <div class="px-4 py-2 rounded-2xl text-sm shadow-sm
                                        {msg.sender === 'me' 
                                            ? 'bg-blue-600 text-white rounded-br-none' 
                                            : 'bg-[#2c2c2e] text-white rounded-bl-none'}">
                                        <p>{msg.text}</p>
                                        {#if msg.attachments?.length}
                                            <div class="mt-2 space-y-1">
                                                {#each msg.attachments as file}
                                                    <div class="flex items-center gap-2 bg-black/20 p-2 rounded text-xs">
                                                        <Paperclip class="size-3" />
                                                        <span class="truncate max-w-[150px]">{file.name}</span>
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                    <span class="text-[10px] text-neutral-500 mt-1 block {msg.sender === 'me' ? 'text-right' : 'text-left'}">
                                        {msg.time}
                                    </span>
                                </div>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

            <!-- Input Area -->
            <div class="p-4 bg-[#1c1c1e] border-t border-neutral-800">
                <div class="flex items-end gap-3 bg-[#0f0f0f] p-2 rounded-xl border border-neutral-800 focus-within:border-blue-500/50 transition-colors">
                    <button class="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <Paperclip class="size-5" />
                    </button>
                    
                    <textarea 
                        bind:value={newMessage}
                        onkeydown={handleKeyDown}
                        placeholder="Escribe un mensaje..."
                        class="flex-1 bg-transparent text-white text-sm max-h-32 min-h-[40px] py-2 resize-none focus:outline-none custom-scrollbar placeholder-neutral-500"
                        rows="1"
                    ></textarea>

                    <button 
                        onclick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        class="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/20"
                    >
                        <Send class="size-5" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Detail Panel (Overlay/Sidebar) -->
        {#if detailMounted}
            <div
                class="detail-layer bg-[#0f0f0f] flex flex-col"
                class:detail-open={detailVisible}
                aria-hidden={!detailVisible}
            >
                <ClientDetailSidebar {client} onClose={toggleDetail} on:updated />
            </div>
        {/if}
    {/if}
</div>

<ModalConfirmacion
    open={showConfirmModal}
    title={actionType === 'suspend' ? 'Suspender Cliente' : 'Activar Cliente'}
    message={`¿Está seguro que desea ${actionType === 'suspend' ? 'suspender' : 'activar'} a ${client?.name || 'este cliente'} (ID: ${client?.id})?`}
    type={actionType === 'suspend' ? 'warning' : 'success'}
    confirmText={actionType === 'suspend' ? 'Sí, suspender' : 'Sí, activar'}
    loading={actionLoading}
    on:confirm={executeAction}
    on:cancel={closeConfirmModal}
/>

<ModalAddFunds 
    bind:open={showAddFundsModal} 
    {client}
    on:success={(e) => dispatch('updated', e.detail)}
/>

<style>
    :global(:root) {
        --detail-transition-ms: 600ms;
        --detail-ease: cubic-bezier(0.2, 0.9, 0.2, 1);
    }

    .chat-layer {
        position: relative;
        z-index: 10;
        opacity: 1;
        visibility: visible;
        transform-origin: left center;
        transform: translate3d(0, 0, 0) scaleX(1);
        will-change: transform, opacity;
        transition:
            opacity var(--detail-transition-ms) var(--detail-ease),
            transform var(--detail-transition-ms) var(--detail-ease),
            visibility 0ms linear 0ms;
    }

    .chat-layer.chat-hidden {
        opacity: 0;
        transform: translate3d(-18px, 0, 0) scaleX(0.02);
        pointer-events: none;
        visibility: hidden;
        transition:
            opacity var(--detail-transition-ms) var(--detail-ease),
            transform var(--detail-transition-ms) var(--detail-ease),
            visibility 0ms linear var(--detail-transition-ms);
    }

    .detail-layer {
        position: absolute;
        inset: 0;
        z-index: 30;
        transform: translate3d(100%, 0, 0);
        will-change: transform;
        transition: transform var(--detail-transition-ms) var(--detail-ease);
        pointer-events: none;
    }

    .detail-layer.detail-open {
        transform: translate3d(0, 0, 0);
        pointer-events: auto;
    }

    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #3f3f46;
        border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #52525b;
    }
</style>
