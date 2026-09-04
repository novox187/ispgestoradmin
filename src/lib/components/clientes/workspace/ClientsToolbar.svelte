<script lang="ts">
    import { Search, X, Plus, Loader2, RefreshCw, Users, CheckCircle2, PauseCircle, AlertOctagon, Wifi } from '@lucide/svelte';
    import { formatCurrency } from '$lib/utils/currency';
    import type { ClientStats } from '$lib/types/clientes';

    let {
        stats = null,
        statusFilter = 'all',
        searchTerm = '',
        searching = false,
        refreshing = false,
        onSearch,
        onFilter,
        onRefresh,
        onCreate
    }: {
        stats?: ClientStats | null;
        statusFilter?: string;
        searchTerm?: string;
        searching?: boolean;
        refreshing?: boolean;
        onSearch: (value: string) => void;
        onFilter: (value: string) => void;
        onRefresh: () => void;
        onCreate: () => void;
    } = $props();

    let localSearch = $state(searchTerm);
    let searchEl = $state<HTMLInputElement | null>(null);
    let cardsEl = $state<HTMLDivElement | null>(null);

    // La tira de tarjetas scrollea en móvil: si el filtro activo queda fuera de
    // pantalla, la lista aparece recortada sin que nada explique por qué.
    $effect(() => {
        statusFilter;
        if (!cardsEl) return;
        const activa = cardsEl.querySelector<HTMLElement>('[aria-pressed="true"]');
        activa?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });

    // El término se sincroniza desde fuera sólo cuando la página lo limpia
    // (p. ej. al pulsar «Limpiar filtros»), no en cada tecla del usuario.
    $effect(() => {
        if (searchTerm === '' && localSearch !== '') localSearch = '';
    });

    function handleInput(e: Event) {
        localSearch = (e.target as HTMLInputElement).value;
        onSearch(localSearch);
    }

    function clearSearch() {
        localSearch = '';
        onSearch('');
        searchEl?.focus();
    }

    // Las tarjetas son el filtro: pulsar «Suspendidos» filtra por suspendidos.
    // Evita duplicar la misma decisión en un contador y en una pastilla aparte.
    const CARDS = [
        { key: 'all',        label: 'Total',       icon: Users,        stat: 'total'        as const, tone: 'neutral' },
        { key: 'active',     label: 'Activos',     icon: CheckCircle2, stat: 'active'       as const, tone: 'success' },
        { key: 'suspended',  label: 'Suspendidos', icon: PauseCircle,  stat: 'suspended'    as const, tone: 'warning' },
        { key: 'with_debt',  label: 'Con deuda',   icon: AlertOctagon, stat: 'with_debt'    as const, tone: 'danger'  },
        { key: 'without_plan', label: 'Sin plan',  icon: Wifi,         stat: 'without_plan' as const, tone: 'info'    },
    ] as const;

    const TONE: Record<string, { icon: string; ring: string; value: string }> = {
        neutral: { icon: 'text-text-muted',     ring: 'ring-white/20',        value: 'text-text-primary'  },
        success: { icon: 'text-success-400',    ring: 'ring-success-500/50',  value: 'text-success-300'   },
        warning: { icon: 'text-warning-400',    ring: 'ring-warning-500/50',  value: 'text-warning-300'   },
        danger:  { icon: 'text-danger-400',     ring: 'ring-danger-500/50',   value: 'text-danger-300'    },
        info:    { icon: 'text-info-400',       ring: 'ring-info-500/50',     value: 'text-info-300'      },
    };
</script>

<div class="shrink-0 border-b border-white/[0.06] bg-surface-card">

    <!-- Tarjetas de cartera — cada una es un filtro -->
    <div
        bind:this={cardsEl}
        class="flex gap-2 px-3 pt-3 overflow-x-auto scrollbar-isp sm:overflow-visible sm:flex-wrap"
        role="group"
        aria-label="Filtrar clientes por segmento de cartera"
    >
        {#each CARDS as card}
            {@const active = statusFilter === card.key}
            {@const tone = TONE[card.tone]}
            <button
                type="button"
                onclick={() => onFilter(card.key)}
                aria-pressed={active}
                class="group shrink-0 min-w-[7.5rem] text-left rounded-lg border px-3 py-2 transition-colors duration-150
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
                       focus-visible:ring-offset-surface-card
                       {active
                           ? `bg-surface-selected border-transparent ring-1 ${tone.ring}`
                           : 'bg-surface-elevated border-white/[0.06] hover:bg-surface-hover hover:border-white/10'}"
            >
                <span class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                    <card.icon class="size-3 {tone.icon}" aria-hidden="true" />
                    {card.label}
                </span>
                <span class="mt-0.5 block text-lg font-bold leading-none tabular-nums {active ? tone.value : 'text-text-primary'}">
                    {#if stats}
                        {stats[card.stat].toLocaleString('es-EC')}
                    {:else}
                        <span class="inline-block h-[1.125rem] w-10 rounded bg-white/[0.06] animate-pulse align-middle"></span>
                    {/if}
                </span>
                {#if card.key === 'with_debt' && stats && stats.with_debt > 0}
                    <span class="mt-0.5 block text-[10px] text-danger-400/90 tabular-nums truncate">
                        {formatCurrency(stats.debt_amount)}
                    </span>
                {/if}
            </button>
        {/each}
    </div>

    <!-- Búsqueda y acciones -->
    <div class="flex items-center gap-2 px-3 py-3">
        <div class="relative flex-1 min-w-0">
            {#if searching}
                <Loader2 class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary-400 animate-spin pointer-events-none" aria-hidden="true" />
            {:else}
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-disabled pointer-events-none" aria-hidden="true" />
            {/if}
            <input
                bind:this={searchEl}
                type="search"
                value={localSearch}
                oninput={handleInput}
                placeholder="Buscar por nombre, cédula, email, teléfono o IP…"
                aria-label="Buscar clientes"
                autocomplete="off"
                class="w-full h-11 sm:h-9 bg-surface-elevated text-text-primary rounded-lg pl-9 pr-9 text-sm
                       border border-white/[0.06] transition-colors duration-150
                       placeholder:text-text-disabled
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                       focus-visible:ring-offset-1 focus-visible:ring-offset-surface-card"
            />
            {#if localSearch}
                <button
                    type="button"
                    onclick={clearSearch}
                    aria-label="Limpiar búsqueda"
                    class="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center rounded-md
                           text-text-disabled hover:text-text-primary hover:bg-surface-hover transition-colors duration-150"
                >
                    <X class="size-3.5" />
                </button>
            {/if}
        </div>

        <button
            type="button"
            onclick={onRefresh}
            disabled={refreshing}
            aria-label="Actualizar listado"
            title="Actualizar listado"
            class="size-11 sm:size-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-white/[0.06]
                   bg-surface-elevated text-text-muted hover:text-text-primary hover:bg-surface-hover
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
            <RefreshCw class="size-4 {refreshing ? 'animate-spin' : ''}" aria-hidden="true" />
        </button>

        <button
            type="button"
            onclick={onCreate}
            class="h-11 sm:h-9 shrink-0 inline-flex items-center gap-1.5 px-3 sm:px-4 rounded-lg bg-primary-600 text-white
                   text-sm font-semibold shadow-lg shadow-primary-900/40
                   hover:bg-primary-500 active:bg-primary-700 transition-colors duration-150
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400
                   focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card"
        >
            <Plus class="size-4" aria-hidden="true" />
            <span class="hidden sm:inline">Nuevo cliente</span>
            <span class="sr-only sm:hidden">Nuevo cliente</span>
        </button>
    </div>
</div>
