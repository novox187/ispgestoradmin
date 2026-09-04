<script lang="ts">
    import { Users, ChevronLeft, ChevronRight, ArrowUpDown, AlertOctagon, Check } from '@lucide/svelte';
    import { formatCurrency } from '$lib/utils/currency';
    import type { ClientRow } from '$lib/types/clientes';
    import { statusLabel, statusDot, statusAvatar } from '$lib/utils/client-status';

    let {
        clients = [],
        selectedClientId = null,
        loading = false,
        page = 1,
        lastPage = 1,
        total = 0,
        perPage = 25,
        sort = 'id',
        dir = 'asc',
        hasFilters = false,
        onSelect,
        onPage,
        onSort,
        onClearFilters
    }: {
        clients?: ClientRow[];
        selectedClientId?: number | null;
        loading?: boolean;
        page?: number;
        lastPage?: number;
        total?: number;
        perPage?: number;
        sort?: string;
        dir?: 'asc' | 'desc';
        hasFilters?: boolean;
        onSelect: (id: number) => void;
        onPage: (page: number) => void;
        onSort: (sort: string) => void;
        onClearFilters: () => void;
    } = $props();

    let listEl = $state<HTMLUListElement | null>(null);

    const SORTS = [
        { value: 'id',       label: 'Recientes' },
        { value: 'name',     label: 'Nombre'    },
        { value: 'debt',     label: 'Deuda'     },
        { value: 'contract', label: 'Antigüedad'},
    ] as const;

    function getInitials(name: string) {
        return (name || '?').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }

    // Flechas para recorrer la lista sin soltar el teclado: en un panel de
    // soporte se salta de cliente en cliente constantemente.
    function handleKeydown(e: KeyboardEvent, index: number) {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? index + 1 : index - 1;
        const buttons = listEl?.querySelectorAll<HTMLButtonElement>('button[data-row]');
        buttons?.[next]?.focus();
    }

    let rangeStart = $derived(total === 0 ? 0 : (page - 1) * perPage + 1);
    let rangeEnd = $derived(Math.min(page * perPage, total));
</script>

<aside
    class="flex flex-col h-full bg-surface-card border-r border-white/[0.06] w-full md:w-[21rem] lg:w-[24rem] shrink-0"
    aria-label="Listado de clientes"
>
    <!-- Orden y rango visible -->
    <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.06]">
        <p class="text-[11px] text-text-muted tabular-nums truncate" aria-live="polite">
            {#if total > 0}
                {rangeStart}–{rangeEnd} de {total.toLocaleString('es-EC')}
            {:else if loading}
                Cargando…
            {:else}
                Sin resultados
            {/if}
        </p>

        <div class="relative shrink-0">
            <label class="sr-only" for="client-sort">Ordenar listado</label>
            <ArrowUpDown class="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-text-disabled pointer-events-none" aria-hidden="true" />
            <select
                id="client-sort"
                value={sort}
                onchange={(e) => onSort((e.target as HTMLSelectElement).value)}
                class="appearance-none bg-surface-elevated border border-white/[0.06] rounded-md pl-6 pr-6 py-1
                       text-[11px] font-medium text-text-secondary cursor-pointer
                       hover:bg-surface-hover transition-colors duration-150
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
                {#each SORTS as s}
                    <option value={s.value}>{s.label}{s.value === sort ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}</option>
                {/each}
            </select>
        </div>
    </div>

    <!-- Filas -->
    <div class="flex-1 overflow-y-auto scrollbar-isp">
        {#if loading && clients.length === 0}
            <div aria-busy="true" role="status" aria-label="Cargando clientes">
                {#each Array.from({ length: 8 }, (_, i) => i) as i (i)}
                    <div class="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                        <div class="size-9 rounded-lg bg-surface-elevated shrink-0"></div>
                        <div class="flex-1 space-y-1.5">
                            <div class="h-2.5 bg-surface-elevated rounded-full w-3/5"></div>
                            <div class="h-2 bg-surface-elevated rounded-full w-2/5"></div>
                        </div>
                    </div>
                {/each}
            </div>

        {:else if clients.length === 0}
            <div class="flex flex-col items-center justify-center h-full p-8 text-center">
                <div class="size-12 rounded-xl bg-surface-elevated flex items-center justify-center mb-3 border border-white/[0.06]">
                    <Users class="size-5 text-text-disabled" aria-hidden="true" />
                </div>
                <p class="text-sm font-semibold text-text-secondary">Sin resultados</p>
                <p class="text-xs text-text-muted mt-1 max-w-[15rem] leading-relaxed">
                    {hasFilters
                        ? 'Ningún cliente coincide con la búsqueda o el filtro activo.'
                        : 'Todavía no hay clientes registrados.'}
                </p>
                {#if hasFilters}
                    <button
                        type="button"
                        onclick={onClearFilters}
                        class="mt-3 text-xs font-medium text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors duration-150"
                    >
                        Limpiar filtros
                    </button>
                {/if}
            </div>

        {:else}
            <ul bind:this={listEl} class="divide-y divide-white/[0.04]">
                {#each clients as client, i (client.id)}
                    {@const selected = selectedClientId === client.id}
                    {@const debt = client.debt_total ?? 0}
                    <li>
                        <button
                            type="button"
                            data-row
                            onclick={() => onSelect(client.id)}
                            onkeydown={(e) => handleKeydown(e, i)}
                            aria-current={selected ? 'true' : undefined}
                            aria-label="{client.name} · {statusLabel(client.status)}{debt > 0 ? ` · debe ${formatCurrency(debt)}` : ''}"
                            class="w-full px-3 py-2.5 flex items-center gap-2.5 text-left border-l-2 outline-none
                                   transition-colors duration-150
                                   focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500
                                   {selected
                                       ? 'bg-surface-selected border-primary-500'
                                       : 'border-transparent hover:bg-surface-hover'}"
                        >
                            <!-- Avatar con indicador de estado -->
                            <span class="relative shrink-0">
                                <span
                                    class="size-9 rounded-lg flex items-center justify-center text-[11px] font-bold
                                           ring-1 select-none {statusAvatar(client.status)}"
                                    aria-hidden="true"
                                >
                                    {getInitials(client.name)}
                                </span>
                                <span
                                    class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-surface-card {statusDot(client.status)}"
                                    aria-hidden="true"
                                ></span>
                            </span>

                            <!-- Identidad -->
                            <span class="flex-1 min-w-0">
                                <span class="flex items-center gap-1.5">
                                    <span class="text-[13px] font-semibold truncate {selected ? 'text-white' : 'text-text-primary'}">
                                        {client.name}
                                    </span>
                                </span>
                                <span class="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                                    <span class="truncate">{client.plan || 'Sin plan'}</span>
                                    {#if client.ip}
                                        <span class="text-text-disabled" aria-hidden="true">·</span>
                                        <span class="font-mono tabular-nums text-text-disabled truncate">{client.ip}</span>
                                    {/if}
                                </span>
                            </span>

                            <!-- Señal económica: lo único que justifica ocupar la
                                 columna derecha en una lista de este ancho. -->
                            <span class="shrink-0 text-right">
                                {#if debt > 0}
                                    <span class="flex items-center justify-end gap-1 text-[11px] font-bold text-danger-300 tabular-nums">
                                        <AlertOctagon class="size-3 shrink-0" aria-hidden="true" />
                                        {formatCurrency(debt)}
                                    </span>
                                    {#if (client.overdue_count ?? 0) > 0}
                                        <span class="mt-0.5 block text-[9px] font-semibold uppercase tracking-wide text-danger-400/80">
                                            {client.overdue_count} vencida{client.overdue_count === 1 ? '' : 's'}
                                        </span>
                                    {/if}
                                {:else}
                                    <span class="flex items-center justify-end gap-1 text-[11px] text-success-400/70" title="Sin facturas pendientes">
                                        <Check class="size-3" aria-hidden="true" />
                                        <span class="sr-only">Al día</span>
                                    </span>
                                {/if}
                            </span>
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>

    <!-- Paginación: el listado se pagina en el servidor y antes no había forma
         de alcanzar nada más allá de la primera página. -->
    {#if lastPage > 1}
        <nav class="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-white/[0.06] bg-surface-card"
             aria-label="Paginación del listado">
            <button
                type="button"
                onclick={() => onPage(page - 1)}
                disabled={page <= 1 || loading}
                class="h-9 px-2.5 inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-surface-elevated
                       text-xs font-medium text-text-secondary
                       hover:bg-surface-hover hover:text-text-primary
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-elevated
                       transition-colors duration-150
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
                <ChevronLeft class="size-3.5" aria-hidden="true" />
                Anterior
            </button>

            <span class="text-[11px] text-text-muted tabular-nums">
                Página {page} de {lastPage}
            </span>

            <button
                type="button"
                onclick={() => onPage(page + 1)}
                disabled={page >= lastPage || loading}
                class="h-9 px-2.5 inline-flex items-center gap-1 rounded-md border border-white/[0.06] bg-surface-elevated
                       text-xs font-medium text-text-secondary
                       hover:bg-surface-hover hover:text-text-primary
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-elevated
                       transition-colors duration-150
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
                Siguiente
                <ChevronRight class="size-3.5" aria-hidden="true" />
            </button>
        </nav>
    {/if}
</aside>
