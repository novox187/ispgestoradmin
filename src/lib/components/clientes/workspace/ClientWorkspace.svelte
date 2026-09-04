<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import {
        ArrowLeft, MoreVertical, UserCheck, UserX, UserMinus, CreditCard,
        LockKeyhole, Users, Loader2, Wallet, Calendar, Gauge, AlertOctagon,
        LayoutList, MessageSquare, Receipt, History as HistoryIcon
    } from '@lucide/svelte';
    import { API_BASE } from '$lib/config';
    import { toast } from 'svelte-sonner';
    import { formatCurrency, toAmount } from '$lib/utils/currency';
    import { formatDate as formatDatePure } from '$lib/utils/date-format';
    import { normalizeStatus, serviceStatusLabel, statusDot, statusBadge } from '$lib/utils/client-status';

    import TabResumen from './TabResumen.svelte';
    import TabChat from './TabChat.svelte';
    import TabFacturas from './TabFacturas.svelte';
    import ClientHistoryDrawer from '../ClientHistoryDrawer.svelte';
    import ModalConfirmacion from '$lib/components/common/ModalConfirmacion.svelte';
    import ModalAddFunds from './ModalAddFunds.svelte';

    let {
        client = null,
        messages = [],
        loadingClient = false,
        loadingMessages = false,
        activeTicketId = null,
        ticketStatus = 'open',
        unreadCount = 0,
        isAdmin = false
    }: {
        client?: any | null;
        messages?: any[];
        loadingClient?: boolean;
        loadingMessages?: boolean;
        activeTicketId?: number | null;
        ticketStatus?: string;
        unreadCount?: number;
        isAdmin?: boolean;
    } = $props();

    const dispatch = createEventDispatcher();

    type TabId = 'resumen' | 'chat' | 'facturas' | 'historial';
    let activeTab = $state<TabId>('resumen');

    let showMenu = $state(false);
    let menuEl = $state<HTMLDivElement | null>(null);
    let showConfirm = $state(false);
    let actionType = $state<'suspend' | 'activate' | 'cancel' | null>(null);
    let actionLoading = $state(false);
    let showAddFunds = $state(false);

    // Al cambiar de cliente se vuelve al resumen: mantener la pestaña anterior
    // deja al operador leyendo el chat de alguien que no eligió abrir ahí.
    let lastClientId = $state<number | null>(null);
    $effect(() => {
        if (client?.id !== lastClientId) {
            lastClientId = client?.id ?? null;
            activeTab = 'resumen';
            showMenu = false;
        }
    });

    // ─── Datos derivados de la ficha ─────────────────────────────────────────
    let status = $derived(normalizeStatus(client?.status ?? client?.service_status));

    let walletBalance = $derived(toAmount(client?.wallet_balance ?? client?.balance ?? client?.wallet?.balance));

    let pendingInvoices = $derived.by(() =>
        ((client?.invoices ?? []) as any[]).filter(i => i && (i.status === 'pending' || i.status === 'failed'))
    );

    let debtTotal = $derived(pendingInvoices.reduce((sum, i) => sum + toAmount(i.total_amount), 0));

    let planName = $derived(
        client?.current_plan_name
        ?? client?.plan
        ?? client?.client_plans?.[0]?.plan?.name
        ?? null
    );

    let contractDate = $derived(client?.contract_date ? formatDatePure(client.contract_date) : '—');

    function getInitials(name?: string) {
        return (name || '?').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }

    let TABS = $derived([
        { id: 'resumen'   as const, label: 'Resumen',   icon: LayoutList,     badge: 0 },
        { id: 'chat'      as const, label: 'Chat',      icon: MessageSquare,  badge: unreadCount },
        { id: 'facturas'  as const, label: 'Facturas',  icon: Receipt,        badge: pendingInvoices.length },
        { id: 'historial' as const, label: 'Historial', icon: HistoryIcon,    badge: 0 },
    ]);

    // Flechas para moverse entre pestañas, como manda el patrón de tablist.
    function handleTabKeydown(e: KeyboardEvent, index: number) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = (index + delta + TABS.length) % TABS.length;
        activeTab = TABS[next].id;
        (e.currentTarget as HTMLElement).parentElement
            ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }

    // ─── Acciones sobre el servicio ──────────────────────────────────────────
    function requestAction(action: 'suspend' | 'activate' | 'cancel') {
        showMenu = false;
        actionType = action;
        showConfirm = true;
    }

    async function executeAction() {
        if (!client?.id || !actionType) { toast.error('Cliente no válido.'); return; }

        actionLoading = true;
        try {
            const token = localStorage.getItem('employee_token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const endpoints = {
                suspend:  `${API_BASE}/admin/clientes/${client.id}/suspend`,
                activate: `${API_BASE}/admin/clientes/${client.id}/activate`,
                cancel:   `${API_BASE}/admin/clientes/${client.id}/cancel`,
            } as const;
            const done = { suspend: 'suspendido', activate: 'activado', cancel: 'dado de baja' } as const;
            const inf  = { suspend: 'suspender', activate: 'activar', cancel: 'dar de baja a' } as const;

            const res = await fetch(endpoints[actionType], { method: 'POST', headers });

            if (res.ok) {
                const data = await res.json();
                toast.success(`Cliente ${done[actionType]} correctamente.`);
                dispatch('updated', data);
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.message || `No se pudo ${inf[actionType]} el cliente.`);
            }
        } catch (e) {
            console.error(e);
            toast.error('Error de red al procesar la solicitud.');
        } finally {
            actionLoading = false;
            showConfirm = false;
            actionType = null;
        }
    }

    function handleWindowClick(e: MouseEvent) {
        if (showMenu && !menuEl?.contains(e.target as Node)) showMenu = false;
    }

    function handleWindowKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && showMenu) showMenu = false;
    }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<div class="flex flex-col h-full min-w-0 bg-surface-base">

    {#if !client}
        <!-- Nada seleccionado -->
        <div class="flex-1 flex flex-col items-center justify-center p-8 text-center select-none" role="status">
            {#if loadingClient}
                <Loader2 class="size-7 text-primary-500 animate-spin mb-3" aria-hidden="true" />
                <p class="text-sm text-text-muted">Cargando cliente…</p>
            {:else}
                <div class="size-16 rounded-2xl bg-surface-elevated border border-white/[0.06] flex items-center justify-center mb-4">
                    <Users class="size-7 text-text-disabled" aria-hidden="true" />
                </div>
                <h2 class="text-base font-bold text-text-primary mb-1.5">Selecciona un cliente</h2>
                <p class="text-sm text-text-muted max-w-[20rem] leading-relaxed">
                    Elige un cliente de la lista para consultar su ficha, su estado de cuenta y su historial de soporte.
                </p>
            {/if}
        </div>

    {:else}
        <!-- ═══ Cabecera del cliente ═══ -->
        <header class="shrink-0 border-b border-white/[0.06] bg-surface-card">
            <div class="flex items-start gap-3 px-3 sm:px-4 pt-3 pb-2.5">
                <button
                    type="button"
                    onclick={() => dispatch('back')}
                    aria-label="Volver al listado"
                    class="md:hidden size-9 shrink-0 -ml-1 inline-flex items-center justify-center rounded-lg
                           text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors duration-150
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                    <ArrowLeft class="size-4" aria-hidden="true" />
                </button>

                <span class="relative shrink-0">
                    <span
                        class="size-11 rounded-xl bg-surface-overlay ring-1 ring-white/10 flex items-center justify-center
                               text-sm font-bold text-text-secondary select-none"
                        aria-hidden="true"
                    >
                        {getInitials(client.name || client.full_name)}
                    </span>
                    <span class="absolute -bottom-0.5 -right-0.5 size-3 rounded-full ring-2 ring-surface-card {statusDot(status)}" aria-hidden="true"></span>
                </span>

                <div class="flex-1 min-w-0">
                    <h1 class="text-base font-bold text-text-primary leading-tight truncate">
                        {client.name || client.full_name || 'Sin nombre'}
                    </h1>
                    <div class="mt-1 flex items-center gap-2 flex-wrap">
                        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium {statusBadge(status)}">
                            <span class="size-1.5 rounded-full {statusDot(status)}" aria-hidden="true"></span>
                            {serviceStatusLabel(status)}
                        </span>
                        <span class="text-[11px] text-text-disabled tabular-nums">#{client.id}</span>
                        {#if debtTotal > 0}
                            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-danger-300 tabular-nums">
                                <AlertOctagon class="size-3" aria-hidden="true" />
                                Debe {formatCurrency(debtTotal)}
                            </span>
                        {/if}
                    </div>
                </div>

                <!-- Acciones -->
                <div class="relative shrink-0" bind:this={menuEl}>
                    <button
                        type="button"
                        onclick={() => showMenu = !showMenu}
                        disabled={actionLoading}
                        aria-label="Acciones del cliente"
                        aria-expanded={showMenu}
                        aria-haspopup="menu"
                        class="size-9 inline-flex items-center justify-center rounded-lg border border-white/[0.06]
                               bg-surface-elevated text-text-muted
                               hover:text-text-primary hover:bg-surface-hover
                               disabled:opacity-50 transition-colors duration-150
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                        {#if actionLoading}
                            <Loader2 class="size-4 animate-spin" aria-hidden="true" />
                        {:else}
                            <MoreVertical class="size-4" aria-hidden="true" />
                        {/if}
                    </button>

                    {#if showMenu}
                        <div
                            class="absolute top-full right-0 mt-1.5 w-56 rounded-xl border border-white/[0.08]
                                   bg-surface-overlay shadow-2xl overflow-hidden z-50"
                            role="menu"
                            aria-label="Acciones del cliente"
                        >
            <!-- Un cliente limitado está a medio camino: admite tanto volver a
                 pleno servicio como cortarse del todo, así que ve las dos. -->
                            {#if status !== 'active' && status !== 'cancelled'}
                                <button
                                    type="button" role="menuitem" onclick={() => requestAction('activate')}
                                    class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-success-300
                                           hover:bg-success-950/50 transition-colors duration-150
                                           focus:outline-none focus-visible:bg-success-950/50"
                                >
                                    <UserCheck class="size-3.5 shrink-0" aria-hidden="true" />
                                    {status === 'limited' ? 'Restaurar servicio pleno' : 'Reactivar servicio'}
                                </button>
                            {/if}

                            {#if status === 'active' || status === 'limited'}
                                <button
                                    type="button" role="menuitem" onclick={() => requestAction('suspend')}
                                    class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-warning-300
                                           border-t border-white/[0.06] hover:bg-warning-950/50 transition-colors duration-150
                                           focus:outline-none focus-visible:bg-warning-950/50"
                                >
                                    <UserX class="size-3.5 shrink-0" aria-hidden="true" /> Suspender servicio
                                </button>
                            {/if}

                            {#if isAdmin}
                                <button
                                    type="button" role="menuitem" onclick={() => { showMenu = false; showAddFunds = true; }}
                                    class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-primary-300
                                           border-t border-white/[0.06] hover:bg-primary-950/50 transition-colors duration-150
                                           focus:outline-none focus-visible:bg-primary-950/50"
                                >
                                    <CreditCard class="size-3.5 shrink-0" aria-hidden="true" /> Acreditar fondos
                                </button>
                            {/if}

                            {#if activeTicketId && ticketStatus !== 'closed'}
                                <button
                                    type="button" role="menuitem" onclick={() => { showMenu = false; dispatch('closeTicket'); }}
                                    class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-text-secondary
                                           border-t border-white/[0.06] hover:bg-surface-hover hover:text-text-primary
                                           transition-colors duration-150 focus:outline-none focus-visible:bg-surface-hover"
                                >
                                    <LockKeyhole class="size-3.5 shrink-0" aria-hidden="true" /> Cerrar ticket abierto
                                </button>
                            {/if}

                            <!-- Dar de baja va al final y separada: es la única
                                 irreversible del menú. -->
                            {#if status !== 'cancelled'}
                                <button
                                    type="button" role="menuitem" onclick={() => requestAction('cancel')}
                                    class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-danger-300
                                           border-t-2 border-white/[0.08] hover:bg-danger-950/50 transition-colors duration-150
                                           focus:outline-none focus-visible:bg-danger-950/50"
                                >
                                    <UserMinus class="size-3.5 shrink-0" aria-hidden="true" /> Dar de baja
                                </button>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Indicadores de un vistazo -->
            <dl class="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] border-y border-white/[0.06]">
                <div class="bg-surface-card px-3 py-2">
                    <dt class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        <Wallet class="size-3" aria-hidden="true" /> Saldo
                    </dt>
                    <dd class="mt-0.5 text-sm font-bold tabular-nums truncate {walletBalance > 0 ? 'text-success-300' : 'text-text-primary'}">
                        {formatCurrency(walletBalance)}
                    </dd>
                </div>
                <div class="bg-surface-card px-3 py-2">
                    <dt class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        <AlertOctagon class="size-3" aria-hidden="true" /> Deuda
                    </dt>
                    <dd class="mt-0.5 text-sm font-bold tabular-nums truncate {debtTotal > 0 ? 'text-danger-300' : 'text-text-primary'}">
                        {debtTotal > 0 ? formatCurrency(debtTotal) : 'Al día'}
                    </dd>
                </div>
                <div class="bg-surface-card px-3 py-2">
                    <dt class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        <Gauge class="size-3" aria-hidden="true" /> Plan
                    </dt>
                    <dd class="mt-0.5 text-sm font-bold text-text-primary truncate" title={planName ?? 'Sin asignar'}>
                        {planName ?? 'Sin asignar'}
                    </dd>
                </div>
                <div class="bg-surface-card px-3 py-2">
                    <dt class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        <Calendar class="size-3" aria-hidden="true" /> Contrato
                    </dt>
                    <dd class="mt-0.5 text-sm font-bold text-text-primary tabular-nums truncate">{contractDate}</dd>
                </div>
            </dl>

            <!-- Pestañas -->
            <div class="flex gap-0.5 px-2 overflow-x-auto scrollbar-isp" role="tablist" aria-label="Secciones del cliente">
                {#each TABS as tab, i (tab.id)}
                    {@const selected = activeTab === tab.id}
                    <button
                        type="button"
                        role="tab"
                        id="tab-{tab.id}"
                        aria-selected={selected}
                        aria-controls="panel-{tab.id}"
                        tabindex={selected ? 0 : -1}
                        onclick={() => activeTab = tab.id}
                        onkeydown={(e) => handleTabKeydown(e, i)}
                        class="relative shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold
                               border-b-2 -mb-px transition-colors duration-150
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500
                               {selected
                                   ? 'border-primary-500 text-text-primary'
                                   : 'border-transparent text-text-muted hover:text-text-secondary hover:border-white/15'}"
                    >
                        <tab.icon class="size-3.5 {selected ? 'text-primary-400' : ''}" aria-hidden="true" />
                        {tab.label}
                        {#if tab.badge > 0}
                            <span
                                class="ml-0.5 min-w-[1.125rem] px-1 py-px rounded-full text-[9px] font-bold tabular-nums text-center
                                       {tab.id === 'facturas' ? 'bg-danger-500/20 text-danger-300' : 'bg-primary-500/20 text-primary-300'}"
                            >
                                {tab.badge}
                            </span>
                        {/if}
                    </button>
                {/each}
            </div>
        </header>

        <!-- ═══ Contenido de la pestaña ═══ -->
        <div class="flex-1 min-h-0">
            {#if activeTab === 'resumen'}
                <div id="panel-resumen" role="tabpanel" aria-labelledby="tab-resumen" class="h-full">
                    <TabResumen {client} on:updated />
                </div>

            {:else if activeTab === 'chat'}
                <div id="panel-chat" role="tabpanel" aria-labelledby="tab-chat" class="h-full">
                    <TabChat
                        {messages}
                        loading={loadingMessages}
                        clientName={client.name || client.full_name || ''}
                        {activeTicketId}
                        {ticketStatus}
                        onSend={(text) => dispatch('sendMessage', text)}
                    />
                </div>

            {:else if activeTab === 'facturas'}
                <div id="panel-facturas" role="tabpanel" aria-labelledby="tab-facturas" class="h-full">
                    <TabFacturas invoices={client.invoices ?? []} {walletBalance} />
                </div>

            {:else}
                <div id="panel-historial" role="tabpanel" aria-labelledby="tab-historial" class="h-full">
                    <ClientHistoryDrawer
                        embedded
                        open={true}
                        clientId={client.id}
                        clientName={client.name || client.full_name || ''}
                        onClose={() => {}}
                    />
                </div>
            {/if}
        </div>
    {/if}
</div>

<ModalConfirmacion
    open={showConfirm}
    title={actionType === 'suspend' ? 'Suspender servicio'
         : actionType === 'cancel'  ? 'Dar de baja al cliente'
         : 'Reactivar servicio'}
    message={actionType === 'cancel'
        ? `¿Dar de baja a ${client?.name ?? 'este cliente'} (#${client?.id})? Se conservan sus registros, pero queda excluido de la facturación y de todo proceso automático. Su servicio se corta de forma definitiva.`
        : actionType === 'suspend'
            ? `¿Suspender el servicio de ${client?.name ?? 'este cliente'} (#${client?.id})? Perderá la conexión hasta que se reactive.`
            : `¿Reactivar el servicio de ${client?.name ?? 'este cliente'} (#${client?.id})?`}
    type={actionType === 'activate' ? 'success' : actionType === 'cancel' ? 'danger' : 'warning'}
    confirmText={actionType === 'suspend' ? 'Sí, suspender' : actionType === 'cancel' ? 'Sí, dar de baja' : 'Sí, reactivar'}
    loading={actionLoading}
    on:confirm={executeAction}
    on:cancel={() => { showConfirm = false; actionType = null; }}
/>

<ModalAddFunds
    bind:open={showAddFunds}
    {client}
    on:success={(e) => dispatch('updated', e.detail)}
/>
