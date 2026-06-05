<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import {
        Send, Paperclip, MoreVertical, CreditCard,
        ArrowLeft, MessageSquare, UserCheck, UserX, Info,
        Wallet, CheckCircle, ExternalLink, LockKeyhole
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
        ticket_id?: number | string | null;
        text: string;
        sender: 'me' | 'them' | 'system';
        time: string;
        event_type?: string | null;
        metadata?: Record<string, any> | null;
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
        isDetailOpen = false,
        activeTicketId = null,
        ticketStatus = 'open',
    }: {
        client?: Client | null;
        messages?: Message[];
        loading?: boolean;
        isDetailOpen?: boolean;
        activeTicketId?: number | null;
        ticketStatus?: string;
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

    function toggleDropdown() { showDropdown = !showDropdown; }

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
        if (!client || !client.id) { toast.error("ID de cliente inválido."); return; }

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

            const res = await fetch(endpoint, { method: 'POST', headers });

            if (res.ok) {
                const data = await res.json();
                toast.success(`Cliente ${actionType === 'suspend' ? 'suspendido' : 'activado'} correctamente.`);
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
        if (showDropdown && !target.closest('.dropdown-container')) showDropdown = false;
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

    function toggleDetail() { dispatch('toggleDetail'); }
    function goBack() { dispatch('back'); }

    $effect(() => {
        if (messages.length && chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });

    function getInitials(name: string) {
        return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '';
    }

    function isClientActive(c: Client) {
        return c.status?.toUpperCase() === 'ACTIVE' || c.service_status?.toUpperCase() === 'ACTIVE';
    }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="flex flex-1 h-full bg-[#09090fbd] relative overflow-hidden">

    {#if !client}
        <!-- Estado vacío — selección de cliente -->
        <div class="flex-1 flex flex-col items-center justify-center p-8 select-none" role="status" aria-label="Ningún cliente seleccionado">
            <div class="relative mb-6">
                <div class="size-20 rounded-3xl bg-surface-elevated flex items-center justify-center border border-white/[0.06] shadow-xl">
                    <MessageSquare class="size-9 text-primary-600/60" aria-hidden="true" />
                </div>
                <div class="absolute -top-1 -right-1 size-5 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center">
                    <div class="size-2 rounded-full bg-primary-400/60"></div>
                </div>
            </div>
            <h3 class="text-base font-bold text-text-primary mb-2">Selecciona un cliente</h3>
            <p class="text-sm text-text-muted text-center max-w-[240px] leading-relaxed">
                Elige un cliente de la lista para ver su historial de soporte y gestionar su cuenta.
            </p>
        </div>

    {:else}
        <!-- Área principal de chat -->
        <div
            class="flex-1 flex flex-col min-w-0 chat-layer"
            class:chat-hidden={detailVisible}
            aria-hidden={detailVisible}
        >
            <!-- Barra superior -->
            <header class="h-14 border-b border-white/[0.06] flex items-center justify-between px-4 bg-[#0b0b0d] backdrop-blur-md sticky top-0 z-10">
                <div class="flex items-center gap-3">
                    <button
                        onclick={goBack}
                        aria-label="Volver a la lista"
                        class="md:hidden text-text-muted hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-hover transition-colors"
                    >
                        <ArrowLeft class="size-4" />
                    </button>

                    <button
                        onclick={toggleDetail}
                        class="flex items-center gap-3 p-1.5 rounded-lg transition-colors group text-left"
                        aria-label="Ver detalles de {client.name}"
                    >
                        <div
                            class="size-9 rounded-full bg-gradient-to-br from-primary-700 to-primary-900 flex items-center justify-center text-white text-xs font-bold shadow-md"
                            aria-hidden="true"
                        >
                            {getInitials(client.name)}
                        </div>
                        <div>
                            <h2 class="text-sm font-bold text-text-primary group-hover:text-primary-300 transition-colors">
                                {client.name}
                            </h2>
                            <span class="text-[11px] flex items-center gap-1.5">
                                <span
                                    class="size-1.5 rounded-full {isClientActive(client) ? 'bg-success-400' : 'bg-text-disabled'}"
                                    aria-hidden="true"
                                ></span>
                                <span class="text-text-muted">
                                    {isClientActive(client) ? 'Servicio activo' : 'Servicio inactivo'}
                                </span>
                            </span>
                        </div>
                    </button>
                </div>

                <!-- Menú de acciones -->
                <div class="relative dropdown-container">
                    <button
                        onclick={toggleDropdown}
                        disabled={actionLoading}
                        aria-label="Opciones del cliente"
                        aria-expanded={showDropdown}
                        aria-haspopup="menu"
                        class="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50"
                    >
                        {#if actionLoading}
                            <div class="size-4 border-2 border-text-muted border-t-text-primary rounded-full animate-spin"></div>
                        {:else}
                            <MoreVertical class="size-4" />
                        {/if}
                    </button>

                    {#if showDropdown}
                        <div
                            class="absolute top-full right-0 mt-2 w-52 bg-surface-overlay rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden z-50"
                            role="menu"
                            aria-label="Acciones del cliente"
                        >
                            <button
                                onclick={() => { showDropdown = false; toggleDetail(); }}
                                role="menuitem"
                                class="w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-hover
                                       hover:text-text-primary transition-colors flex items-center gap-2.5"
                            >
                                <Info class="size-3.5 text-primary-400" aria-hidden="true" />
                                Ver detalles
                            </button>

                            {#if isClientActive(client)}
                                <button
                                    onclick={() => handleActionClick('suspend')}
                                    role="menuitem"
                                    class="w-full text-left px-4 py-2.5 text-sm text-warning-400 hover:bg-warning-900/30
                                           transition-colors border-t border-white/[0.06] flex items-center gap-2.5"
                                >
                                    <UserX class="size-3.5" aria-hidden="true" />
                                    Suspender cliente
                                </button>
                            {:else}
                                <button
                                    onclick={() => handleActionClick('activate')}
                                    role="menuitem"
                                    class="w-full text-left px-4 py-2.5 text-sm text-success-400 hover:bg-success-900/30
                                           transition-colors border-t border-white/[0.06] flex items-center gap-2.5"
                                >
                                    <UserCheck class="size-3.5" aria-hidden="true" />
                                    Activar cliente
                                </button>
                            {/if}

                            {#if isAdmin}
                                <button
                                    onclick={() => { showDropdown = false; showAddFundsModal = true; }}
                                    role="menuitem"
                                    class="w-full text-left px-4 py-2.5 text-sm text-primary-400 hover:bg-primary-900/30
                                           transition-colors border-t border-white/[0.06] flex items-center gap-2.5"
                                >
                                    <CreditCard class="size-3.5" aria-hidden="true" />
                                    Agregar fondos
                                </button>
                            {/if}

                            {#if activeTicketId && ticketStatus !== 'closed'}
                                <button
                                    onclick={() => { showDropdown = false; dispatch('closeTicket'); }}
                                    role="menuitem"
                                    class="w-full text-left px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-900/30
                                           transition-colors border-t border-white/[0.06] flex items-center gap-2.5"
                                >
                                    <LockKeyhole class="size-3.5" aria-hidden="true" />
                                    Cerrar ticket
                                </button>
                            {/if}
                        </div>
                    {/if}
                </div>
            </header>

            <!-- Mensajes -->
            <div
                bind:this={chatContainer}
                class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-isp"
                role="log"
                aria-label="Historial de mensajes"
                aria-live="polite"
                aria-atomic="false"
            >
                {#if loading}
                    <div class="flex justify-center py-10" aria-busy="true" aria-label="Cargando mensajes...">
                        <div class="flex flex-col items-center gap-3 text-text-muted">
                            <div class="size-8 border-2 border-surface-elevated border-t-primary-500 rounded-full animate-spin"></div>
                            <span class="text-xs">Cargando historial...</span>
                        </div>
                    </div>
                {:else if messages.length === 0}
                    <div class="flex flex-col items-center justify-center py-16 text-center text-text-muted">
                        <MessageSquare class="size-8 opacity-25 mb-3" aria-hidden="true" />
                        <p class="text-sm font-medium text-text-secondary">Sin mensajes aún</p>
                        <p class="text-xs mt-1">Envía el primer mensaje para iniciar la conversación.</p>
                    </div>
                {:else}
                    {#each messages as msg, i (msg.id)}

                        <!-- ── Separador de ticket ── -->
                        {#if msg.ticket_id && messages[i - 1]?.ticket_id !== msg.ticket_id}
                            <div class="flex items-center gap-3 my-2 select-none">
                                <div class="flex-1 h-px bg-white/[0.06]"></div>
                                <span class="text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full border border-white/[0.08] bg-surface-elevated text-text-disabled">
                                    Ticket #{msg.ticket_id}
                                </span>
                                <div class="flex-1 h-px bg-white/[0.06]"></div>
                            </div>
                        {/if}

                        <!-- ── Evento del sistema: wallet_funded ── -->
                        {#if msg.event_type === 'wallet_funded' && msg.metadata}
                            {@const meta = msg.metadata}
                            <div class="flex justify-center my-1" role="article" aria-label="Recarga de billetera">
                                <div class="w-full max-w-xs rounded-2xl border border-emerald-700/30 bg-emerald-950/30 p-4 shadow-md">

                                    <div class="flex items-center gap-2 mb-2.5">
                                        <div class="rounded-full bg-emerald-500/20 p-1.5">
                                            <Wallet class="size-3.5 text-emerald-400" aria-hidden="true" />
                                        </div>
                                        <span class="text-xs font-semibold text-emerald-300">Recarga de billetera</span>
                                        <CheckCircle class="size-3.5 text-emerald-400 ml-auto" aria-hidden="true" />
                                    </div>

                                    <div class="text-xl font-bold text-emerald-400 mb-1">
                                        +${Number(meta.amount ?? 0).toFixed(2)}
                                        <span class="text-xs font-normal opacity-60">{meta.currency ?? 'USD'}</span>
                                    </div>

                                    {#if meta.description}
                                        <p class="text-xs text-text-muted mb-2">{meta.description}</p>
                                    {/if}

                                    {#if meta.receipt_url}
                                        <a
                                            href={meta.receipt_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="block rounded-xl overflow-hidden border border-emerald-700/20 mb-2 hover:opacity-90 transition-opacity"
                                            aria-label="Ver comprobante"
                                        >
                                            <img
                                                src={meta.receipt_url}
                                                alt="Comprobante de pago"
                                                class="w-full max-h-40 object-cover"
                                                loading="lazy"
                                            />
                                            <div class="flex items-center justify-center gap-1 bg-emerald-900/40 py-1 text-[10px] text-emerald-300">
                                                <ExternalLink class="size-3" aria-hidden="true" />
                                                Ver comprobante completo
                                            </div>
                                        </a>
                                    {/if}

                                    <div class="flex items-center justify-between">
                                        <span class="text-[10px] text-text-disabled">
                                            Por: {meta.actor_name ?? 'Administrador'}
                                        </span>
                                        <time class="text-[10px] text-text-disabled" datetime={msg.time}>
                                            {msg.time}
                                        </time>
                                    </div>
                                </div>
                            </div>

                        <!-- ── Mensajes normales ── -->
                        {:else}
                            <div
                                class="flex flex-col {msg.sender === 'me' ? 'items-end' : 'items-start'}"
                                role="article"
                                aria-label="Mensaje de {msg.sender === 'me' ? 'operador' : client.name}"
                            >
                                <div class="flex items-end gap-2 max-w-[80%] {msg.sender === 'me' ? 'flex-row-reverse' : 'flex-row'}">
                                    {#if msg.sender !== 'me'}
                                        <div
                                            class="size-6 rounded-full bg-gradient-to-br from-primary-700 to-primary-900 flex items-center justify-center text-[9px] text-white font-bold shrink-0 mb-4"
                                            aria-hidden="true"
                                        >
                                            {getInitials(client.name)}
                                        </div>
                                    {/if}

                                    <div>
                                        <div
                                            class="px-3.5 py-2 rounded-2xl text-sm leading-relaxed
                                                   {msg.sender === 'me'
                                                       ? 'bg-primary-600 text-white rounded-br-sm shadow-md shadow-primary-900/30'
                                                       : 'bg-surface-elevated text-text-primary rounded-bl-sm border border-white/[0.05]'}"
                                        >
                                            <p>{msg.text}</p>
                                            {#if msg.attachments?.length}
                                                <div class="mt-2 space-y-1">
                                                    {#each msg.attachments as file}
                                                        {#if file.url && (file.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) || file.type?.startsWith('image/'))}
                                                            <a href={file.url} target="_blank" rel="noopener noreferrer" class="block rounded-lg overflow-hidden border border-white/10 hover:opacity-90 transition-opacity">
                                                                <img src={file.url} alt={file.name} class="w-full max-h-40 object-cover" loading="lazy" />
                                                            </a>
                                                        {:else}
                                                            <div class="flex items-center gap-2 bg-black/20 p-2 rounded-lg text-xs">
                                                                <Paperclip class="size-3 shrink-0" aria-hidden="true" />
                                                                <span class="truncate max-w-[140px]">{file.name}</span>
                                                            </div>
                                                        {/if}
                                                    {/each}
                                                </div>
                                            {/if}
                                        </div>
                                        <time
                                            class="text-[10px] text-text-disabled mt-1 block {msg.sender === 'me' ? 'text-right' : 'text-left'}"
                                            datetime={msg.time}
                                        >
                                            {msg.time}
                                        </time>
                                    </div>
                                </div>
                            </div>
                        {/if}

                    {/each}
                {/if}
            </div>

            <!-- Área de entrada de mensaje -->
            <div class="p-3 bg-[#0b0b0d] border-t border-white/[0.06]">
                {#if ticketStatus === 'closed'}
                    <div class="flex items-center justify-center gap-2 py-3 text-text-muted text-xs">
                        <LockKeyhole class="size-3.5 text-rose-400" />
                        <span>Este ticket está <span class="text-rose-400 font-medium">cerrado</span>. El cliente puede dejar una calificación.</span>
                    </div>
                {:else}
                    <div
                        class="flex items-end gap-2 bg-[#0b0b0d] rounded-xl border border-white/[0.06]
                               focus-within:border-primary-600/40 focus-within:ring-1 focus-within:ring-primary-500/30 transition-all p-2"
                    >
                        <button
                            aria-label="Adjuntar archivo"
                            class="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                        >
                            <Paperclip class="size-4" />
                        </button>

                        <textarea
                            bind:value={newMessage}
                            onkeydown={handleKeyDown}
                            placeholder="Escribe un mensaje..."
                            aria-label="Mensaje para {client.name}"
                            class="flex-1 bg-transparent text-text-primary text-sm max-h-28 min-h-[36px] py-1.5
                                   resize-none focus:outline-none scrollbar-isp placeholder:text-text-disabled"
                            rows="1"
                        ></textarea>

                        <button
                            onclick={handleSendMessage}
                            disabled={!newMessage.trim()}
                            aria-label="Enviar mensaje"
                            class="p-2 rounded-lg transition-all duration-150 shrink-0
                                   {newMessage.trim()
                                       ? 'bg-primary-600 text-white hover:bg-primary-500 shadow-md shadow-primary-900/40'
                                       : 'bg-surface-hover text-text-disabled cursor-not-allowed'}"
                        >
                            <Send class="size-4" />
                        </button>
                    </div>
                    <p class="text-[10px] text-text-disabled text-center mt-1.5">
                        Enter para enviar · Shift+Enter para nueva línea
                    </p>
                {/if}
            </div>
        </div>

        <!-- Panel de detalle (deslizante) -->
        {#if detailMounted}
            <div
                class="detail-layer bg-surface-base flex flex-col"
                class:detail-open={detailVisible}
                aria-hidden={!detailVisible}
                role="complementary"
                aria-label="Detalles del cliente"
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
</style>
