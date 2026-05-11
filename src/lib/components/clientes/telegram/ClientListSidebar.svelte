<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Search, X, Users, Wifi } from '@lucide/svelte';

    interface ClientSummary {
        id: number;
        name: string;
        email?: string;
        plan?: string;
        status?: string;
        joinDate?: string;
        unreadCount?: number;
    }

    let {
        clients = [],
        selectedClientId = null,
        searchTerm = '',
        statusFilter = 'all',
        loading = false
    }: {
        clients?: ClientSummary[];
        selectedClientId?: number | null;
        searchTerm?: string;
        statusFilter?: string;
        loading?: boolean;
    } = $props();

    const dispatch = createEventDispatcher();

    let localSearchTerm = $state(searchTerm);

    const STATUS_FILTERS = [
        { value: 'all',       label: 'Todos'   },
        { value: 'active',    label: 'Activos' },
        { value: 'suspended', label: 'Susp.'   },
        { value: 'cancelled', label: 'Cancel.' },
    ] as const;

    function handleSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        localSearchTerm = value;
        dispatch('search', value);
    }

    function clearSearch() {
        localSearchTerm = '';
        dispatch('search', '');
    }

    function handleFilter(value: string) {
        dispatch('filter', value);
    }

    function selectClient(id: number) {
        dispatch('select', id);
    }

    function getInitials(name: string) {
        return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }

    type Status = ClientSummary['status'];

    function statusDot(s?: Status) {
        switch (s) {
            case 'active':    return 'bg-success-400';
            case 'suspended': return 'bg-warning-400';
            case 'cancelled': return 'bg-danger-400';
            default:          return 'bg-text-disabled';
        }
    }

    function statusLabel(s?: Status) {
        switch (s) {
            case 'active':    return 'Activo';
            case 'suspended': return 'Suspendido';
            case 'cancelled': return 'Cancelado';
            default:          return 'Inactivo';
        }
    }

    function avatarGradient(s?: Status) {
        switch (s) {
            case 'active':    return 'from-primary-700 to-primary-900';
            case 'suspended': return 'from-warning-700 to-warning-900';
            case 'cancelled': return 'from-danger-700 to-danger-900';
            default:          return 'from-surface-overlay to-surface-elevated';
        }
    }
</script>

<aside
    class="flex flex-col h-full bg-[#09090f] border-r border-white/[0.06] w-full md:w-80 lg:w-96 flex-shrink-0"
    aria-label="Panel de clientes"
>
    <!-- Encabezado del panel -->
    <div class="px-4 pt-4 pb-3 space-y-3 border-b border-white/[0.06]">

        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <Users class="size-4 text-primary-400" aria-hidden="true" />
                <h1 class="text-sm font-bold text-text-primary tracking-tight">Clientes</h1>
            </div>
            {#if clients.length > 0}
                <span
                    class="text-[10px] font-semibold text-text-muted bg-surface-elevated px-2 py-0.5 rounded-full tabular-nums"
                    aria-label="{clients.length} clientes cargados"
                >
                    {clients.length.toLocaleString('es')}
                </span>
            {/if}
        </div>

        <!-- Búsqueda -->
        <div class="relative">
            <Search
                class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none"
                aria-hidden="true"
            />
            <input
                type="search"
                placeholder="Buscar por nombre o email..."
                aria-label="Buscar clientes"
                autocomplete="off"
                value={localSearchTerm}
                oninput={handleSearch}
                class="w-full bg-surface-elevated text-text-primary rounded-lg pl-9 pr-8 py-2 text-xs
                       border border-transparent transition-all duration-150
                       placeholder:text-text-disabled
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                       focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card
                       focus-visible:border-primary-600/40"
            />
            {#if localSearchTerm}
                <button
                    onclick={clearSearch}
                    aria-label="Limpiar búsqueda"
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-disabled
                           hover:text-text-primary hover:bg-surface-hover transition-colors duration-100"
                >
                    <X class="size-3" />
                </button>
            {/if}
        </div>

        <!-- Filtros de estado — pastillas accesibles -->
        <div class="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar clientes por estado">
            {#each STATUS_FILTERS as f}
                <button
                    onclick={() => handleFilter(f.value)}
                    aria-pressed={statusFilter === f.value}
                    class="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-150
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                           focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card
                           {statusFilter === f.value
                               ? 'bg-primary-600 text-white shadow-sm shadow-primary-900/50'
                               : 'bg-surface-elevated text-text-muted hover:bg-surface-hover hover:text-text-secondary'}"
                >
                    {f.label}
                </button>
            {/each}
        </div>
    </div>

    <!-- Lista de clientes -->
    <div class="flex-1 overflow-y-auto pb-20 scrollbar-isp" role="list" aria-label="Listado de clientes">

        {#if loading && clients.length === 0}
            <!-- Esqueleto de carga -->
            <div aria-busy="true" aria-label="Cargando clientes..." role="status">
                {#each Array(7) as _}
                    <div class="flex items-center gap-3 px-4 py-3 animate-pulse" role="listitem">
                        <div class="size-10 rounded-full bg-surface-elevated shrink-0"></div>
                        <div class="flex-1 space-y-1.5">
                            <div class="h-3 bg-surface-elevated rounded-full w-3/5"></div>
                            <div class="h-2.5 bg-surface-elevated rounded-full w-2/5"></div>
                            <div class="h-2.5 bg-surface-elevated rounded-full w-4/5"></div>
                        </div>
                    </div>
                {/each}
            </div>

        {:else if clients.length === 0}
            <!-- Estado vacío -->
            <div class="flex flex-col items-center justify-center h-full p-8 text-center">
                <div class="size-14 rounded-2xl bg-surface-elevated flex items-center justify-center mb-4 border border-white/[0.06]">
                    <Users class="size-6 text-text-disabled" aria-hidden="true" />
                </div>
                <p class="text-sm font-semibold text-text-secondary">Sin resultados</p>
                <p class="text-xs text-text-muted mt-1 max-w-[180px]">
                    {localSearchTerm
                        ? 'Intenta con otro término de búsqueda'
                        : 'No hay clientes registrados aún'}
                </p>
                {#if localSearchTerm}
                    <button
                        onclick={clearSearch}
                        class="mt-3 text-xs text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
                    >
                        Limpiar búsqueda
                    </button>
                {/if}
            </div>

        {:else}
            <ul class="divide-y divide-white/[0.04]">
                {#each clients as client (client.id)}
                    <li role="listitem">
                        <button
                            onclick={() => selectClient(client.id)}
                            aria-current={selectedClientId === client.id ? 'page' : undefined}
                            aria-label="{client.name}, estado: {statusLabel(client.status)}"
                            class="w-full px-4 py-3 flex items-center gap-3 text-left outline-none
                                   transition-colors duration-150 border-l-2
                                   focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500
                                   {selectedClientId === client.id
                                       ? 'bg-surface-selected border-primary-500'
                                       : 'border-transparent hover:bg-surface-hover'}"
                        >
                            <!-- Avatar con degradado y punto de estado -->
                            <div class="relative shrink-0">
                                <div
                                    class="size-10 rounded-full bg-gradient-to-br {avatarGradient(client.status)}
                                           flex items-center justify-center text-white text-xs font-bold shadow-md select-none"
                                    aria-hidden="true"
                                >
                                    {getInitials(client.name)}
                                </div>
                                <div
                                    class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full {statusDot(client.status)}
                                           ring-2 ring-surface-card"
                                    role="img"
                                    aria-label="Estado: {statusLabel(client.status)}"
                                ></div>
                            </div>

                            <!-- Información del cliente -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center justify-between mb-0.5">
                                    <span
                                        class="text-[13px] font-semibold truncate pr-2 transition-colors
                                               {selectedClientId === client.id ? 'text-white' : 'text-text-primary'}"
                                    >
                                        {client.name}
                                    </span>
                                    {#if client.unreadCount && client.unreadCount > 0}
                                        <span
                                            class="bg-primary-500 text-white text-[9px] font-bold px-1.5 py-0.5
                                                   rounded-full min-w-[18px] text-center tabular-nums shrink-0"
                                            aria-label="{client.unreadCount} mensajes sin leer"
                                        >
                                            {client.unreadCount}
                                        </span>
                                    {/if}
                                </div>

                                {#if client.plan}
                                    <div class="flex items-center gap-1 mb-0.5">
                                        <Wifi class="size-2.5 text-primary-400/70 shrink-0" aria-hidden="true" />
                                        <span class="text-[10px] font-medium text-primary-400/80 truncate">{client.plan}</span>
                                    </div>
                                {/if}

                                <p class="text-[11px] text-text-muted truncate">{client.email ?? '—'}</p>
                            </div>
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</aside>
