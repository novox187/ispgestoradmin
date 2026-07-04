<script lang="ts">
  import { untrack } from 'svelte';
  import {
    X, History, Loader2, AlertTriangle, User, Calendar, ArrowRight,
    ChevronLeft, ChevronRight, ChevronDown, Globe,
  } from '@lucide/svelte';
  import { fetchClientAudits, type AuditEntry } from '$lib/api/audits';
  import {
    operationLabels, operationStyles, tableLabels,
    formatAuditDate, formatAuditValue,
  } from '$lib/constants/audit';

  interface Props {
    open: boolean;
    clientId: number | null;
    clientName: string;
    onClose: () => void;
  }

  let { open, clientId, clientName, onClose }: Props = $props();

  let audits = $state<AuditEntry[]>([]);
  let loading = $state(false);
  let error = $state('');
  let expandedId = $state<number | null>(null);

  let page = $state(1);
  let lastPage = $state(1);
  let total = $state(0);
  let filterTable = $state('');

  // Tablas ofrecidas como filtro en el historial del cliente
  const filterableTables = [
    'clients', 'client_plans', 'invoices', 'transactions',
    'wallets', 'client_whitelists', 'tickets',
  ];

  async function load() {
    if (!clientId) return;
    loading = true;
    error = '';
    expandedId = null;
    try {
      const res = await fetchClientAudits(clientId, {
        page,
        per_page: 20,
        ...(filterTable ? { table_name: filterTable } : {}),
      });
      audits = res.data;
      lastPage = res.last_page;
      total = res.total;
    } catch (e: any) {
      error = e?.message ?? 'Error cargando el historial';
    } finally {
      loading = false;
    }
  }

  // Recargar solo al abrir el drawer o al cambiar de cliente. untrack evita
  // que page/filterTable (leídos dentro de load) se vuelvan dependencias del
  // efecto: sin él, cada cambio de página o filtro re-ejecutaba el efecto y
  // reseteaba el estado a página 1 sin filtro.
  $effect(() => {
    if (open && clientId) {
      untrack(() => {
        page = 1;
        filterTable = '';
        load();
      });
    }
  });

  function applyTableFilter(table: string) {
    filterTable = filterTable === table ? '' : table;
    page = 1;
    load();
  }

  function goToPage(p: number) {
    if (p < 1 || p > lastPage || p === page) return;
    page = p;
    load();
  }

  function toggleExpand(id: number) {
    expandedId = expandedId === id ? null : id;
  }

  function changedFields(audit: AuditEntry): string[] {
    const keys = new Set<string>([
      ...Object.keys(audit.new_values ?? {}),
      ...Object.keys(audit.old_values ?? {}),
    ]);
    return [...keys];
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="button"
    tabindex="-1"
    aria-label="Cerrar historial"
  ></div>

  <aside
    class="fixed top-0 right-0 z-50 h-full w-full sm:w-[520px] bg-[#0b0b0d] border-l border-neutral-800 shadow-2xl overflow-hidden flex flex-col"
    aria-label="Historial del cliente"
  >
    <header class="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
      <div class="flex items-center gap-2.5">
        <div class="p-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20">
          <History class="w-4 h-4 text-primary-400" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-neutral-100">Historial del cliente</h3>
          <p class="text-[11px] text-neutral-500">{clientName}</p>
        </div>
      </div>
      <button
        onclick={onClose}
        class="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800/60 transition-colors"
        aria-label="Cerrar"
      >
        <X class="w-4 h-4" />
      </button>
    </header>

    <!-- Filtros por tabla -->
    <div class="flex flex-wrap gap-1.5 px-5 py-3 border-b border-neutral-800/70">
      {#each filterableTables as table}
        <button
          onclick={() => applyTableFilter(table)}
          class="text-[10px] font-mono px-2 py-1 rounded-full border transition-colors
            {filterTable === table
              ? 'bg-primary-500/15 text-primary-400 border-primary-500/30'
              : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700'}"
        >
          {tableLabels[table] ?? table}
        </button>
      {/each}
    </div>

    <div class="flex-1 overflow-y-auto px-5 py-4">
      {#if loading}
        <div class="flex items-center justify-center py-12">
          <Loader2 class="w-5 h-5 text-neutral-500 animate-spin" />
        </div>
      {:else if error}
        <div class="flex items-center gap-2 p-3 rounded-lg border border-red-500/25 bg-red-500/10 text-xs text-red-400">
          <AlertTriangle class="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      {:else if audits.length === 0}
        <div class="text-center py-10">
          <History class="w-8 h-8 text-neutral-700 mx-auto mb-2" />
          <p class="text-xs text-neutral-500">
            {filterTable ? 'Sin eventos para este filtro' : 'No hay eventos registrados todavía'}
          </p>
        </div>
      {:else}
        <ol class="space-y-3">
          {#each audits as audit (audit.id)}
            <li class="rounded-lg border border-neutral-800/70 bg-surface-elevated">
              <button
                onclick={() => toggleExpand(audit.id)}
                class="w-full text-left p-3.5"
              >
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border {operationStyles[audit.operation] ?? 'bg-neutral-800 text-neutral-400 border-neutral-700'}">
                      {operationLabels[audit.operation] ?? audit.operation}
                    </span>
                    <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800/80 text-neutral-500">
                      {tableLabels[audit.table_name] ?? audit.table_name}
                    </span>
                  </div>
                  <span class="flex items-center gap-1 text-[10px] text-neutral-500 whitespace-nowrap">
                    <Calendar class="w-2.5 h-2.5" />
                    {formatAuditDate(audit.created_at)}
                    <ChevronDown class="w-3 h-3 ml-1 text-neutral-600 transition-transform {expandedId === audit.id ? 'rotate-180' : ''}" />
                  </span>
                </div>

                <div class="flex items-center gap-3 text-[11px] text-neutral-400">
                  {#if audit.user_name}
                    <span class="flex items-center gap-1.5">
                      <User class="w-3 h-3" />
                      <span class="font-medium text-neutral-300">{audit.user_name}</span>
                    </span>
                  {:else if audit.user_id}
                    <span class="flex items-center gap-1.5">
                      <User class="w-3 h-3" />
                      Usuario #{audit.user_id}
                    </span>
                  {:else}
                    <span class="text-neutral-600 italic">Sistema</span>
                  {/if}
                  {#if audit.ip_address}
                    <span class="flex items-center gap-1 text-neutral-600 font-mono text-[10px]">
                      <Globe class="w-2.5 h-2.5" />
                      {audit.ip_address}
                    </span>
                  {/if}
                </div>
              </button>

              {#if expandedId === audit.id}
                <div class="px-3.5 pb-3.5 border-t border-neutral-800/50 pt-3">
                  {#if changedFields(audit).length > 0}
                    <div class="space-y-1.5">
                      {#each changedFields(audit) as field}
                        <div class="text-[11px] grid grid-cols-[110px_1fr] gap-2 items-start">
                          <span class="text-neutral-500 font-mono truncate" title={field}>{field}</span>
                          <div class="flex items-start gap-1.5 min-w-0">
                            {#if audit.old_values && field in audit.old_values}
                              <span class="text-neutral-600 line-through break-all whitespace-pre-wrap">
                                {formatAuditValue(audit.old_values[field])}
                              </span>
                              <ArrowRight class="w-2.5 h-2.5 text-neutral-700 shrink-0 mt-0.5" />
                            {/if}
                            <span class="text-neutral-200 break-all whitespace-pre-wrap">
                              {formatAuditValue(audit.new_values?.[field])}
                            </span>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-[11px] text-neutral-600 italic">Sin detalle de valores</p>
                  {/if}
                </div>
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    </div>

    <!-- Paginación -->
    {#if !loading && !error && total > 0}
      <footer class="flex items-center justify-between px-5 py-3 border-t border-neutral-800">
        <span class="text-[11px] text-neutral-500 font-mono">
          {total} evento{total === 1 ? '' : 's'} · página {page} de {lastPage}
        </span>
        <div class="flex items-center gap-1">
          <button
            onclick={() => goToPage(page - 1)}
            disabled={page <= 1}
            class="p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
          </button>
          <button
            onclick={() => goToPage(page + 1)}
            disabled={page >= lastPage}
            class="p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Página siguiente"
          >
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    {/if}
  </aside>
{/if}
