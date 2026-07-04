<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ScrollText, Loader2, AlertTriangle, ChevronLeft, ChevronRight,
    ChevronDown, User, Search, RotateCcw, ArrowRight,
  } from '@lucide/svelte';
  import { fetchAudits, fetchAuditFilters, type AuditEntry } from '$lib/api/audits';
  import {
    operationLabels, operationStyles,
    formatAuditDate as formatDate, formatAuditValue as formatValue,
  } from '$lib/constants/audit';

  let audits = $state<AuditEntry[]>([]);
  let loading = $state(true);
  let error = $state('');
  let expandedId = $state<number | null>(null);

  // Paginación
  let page = $state(1);
  let lastPage = $state(1);
  let total = $state(0);

  // Filtros
  let tables = $state<string[]>([]);
  let operations = $state<string[]>([]);
  let filterTable = $state('');
  let filterOperation = $state('');
  let filterRecordId = $state('');
  let filterDateFrom = $state('');
  let filterDateTo = $state('');

  async function load() {
    loading = true;
    error = '';
    expandedId = null;
    try {
      const res = await fetchAudits({
        table_name: filterTable || undefined,
        operation: filterOperation || undefined,
        record_id: filterRecordId.trim() || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        page,
        per_page: 25,
      });
      audits = res.data;
      lastPage = res.last_page;
      total = res.total;
    } catch (e: any) {
      error = e?.message ?? 'Error cargando la auditoría';
    } finally {
      loading = false;
    }
  }

  async function loadFilters() {
    try {
      const res = await fetchAuditFilters();
      tables = res.tables;
      operations = res.operations;
    } catch {
      // Los filtros son opcionales: el visor funciona sin ellos
    }
  }

  function applyFilters() {
    page = 1;
    load();
  }

  function resetFilters() {
    filterTable = '';
    filterOperation = '';
    filterRecordId = '';
    filterDateFrom = '';
    filterDateTo = '';
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

  onMount(() => {
    load();
    loadFilters();
  });
</script>

<div class="p-4 md:p-6 max-w-6xl mx-auto space-y-4">

  <!-- Header -->
  <div class="flex items-center gap-3">
    <div class="p-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
      <ScrollText class="w-5 h-5 text-primary-400" />
    </div>
    <div>
      <h1 class="text-base font-semibold text-neutral-100">Auditoría del Sistema</h1>
      <p class="text-xs text-neutral-500">
        Registro inmutable de operaciones: cambios de datos, cortes de servicio, reactivaciones y bajas
      </p>
    </div>
  </div>

  <!-- Filtros -->
  <div class="rounded-xl border border-neutral-800/70 bg-surface-elevated p-3.5">
    <div class="grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Tabla</span>
        <select
          bind:value={filterTable}
          class="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-primary-500/50"
        >
          <option value="">Todas</option>
          {#each tables as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Operación</span>
        <select
          bind:value={filterOperation}
          class="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-primary-500/50"
        >
          <option value="">Todas</option>
          {#each operations as op}
            <option value={op}>{operationLabels[op] ?? op}</option>
          {/each}
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">ID registro</span>
        <input
          type="text"
          bind:value={filterRecordId}
          placeholder="ej: 42"
          class="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-primary-500/50"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Desde</span>
        <input
          type="date"
          bind:value={filterDateFrom}
          class="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-primary-500/50"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Hasta</span>
        <input
          type="date"
          bind:value={filterDateTo}
          class="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-primary-500/50"
        />
      </label>

      <div class="flex gap-1.5">
        <button
          onclick={applyFilters}
          class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/15 border border-primary-500/25 text-primary-400 text-xs font-medium hover:bg-primary-500/25 transition-colors"
        >
          <Search class="w-3.5 h-3.5" />
          Filtrar
        </button>
        <button
          onclick={resetFilters}
          title="Limpiar filtros"
          class="p-1.5 rounded-lg border border-neutral-800 text-neutral-500 hover:text-white hover:bg-neutral-800/60 transition-colors"
        >
          <RotateCcw class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>

  <!-- Listado -->
  <div class="rounded-xl border border-neutral-800/70 bg-surface-elevated overflow-hidden">
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <Loader2 class="w-5 h-5 text-neutral-500 animate-spin" />
      </div>
    {:else if error}
      <div class="flex items-center gap-2 m-4 p-3 rounded-lg border border-red-500/25 bg-red-500/10 text-xs text-red-400">
        <AlertTriangle class="w-4 h-4 shrink-0" />
        <span>{error}</span>
      </div>
    {:else if audits.length === 0}
      <div class="text-center py-16">
        <ScrollText class="w-8 h-8 text-neutral-700 mx-auto mb-2" />
        <p class="text-xs text-neutral-500">No hay registros de auditoría con estos filtros</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-neutral-800/70 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
              <th class="text-left px-4 py-2.5 font-medium">Fecha</th>
              <th class="text-left px-4 py-2.5 font-medium">Operación</th>
              <th class="text-left px-4 py-2.5 font-medium">Tabla</th>
              <th class="text-left px-4 py-2.5 font-medium">Registro</th>
              <th class="text-left px-4 py-2.5 font-medium">Ejecutor</th>
              <th class="text-left px-4 py-2.5 font-medium">IP</th>
              <th class="px-2"></th>
            </tr>
          </thead>
          <tbody>
            {#each audits as audit (audit.id)}
              <tr
                class="border-b border-neutral-800/40 hover:bg-neutral-800/30 cursor-pointer transition-colors"
                onclick={() => toggleExpand(audit.id)}
              >
                <td class="px-4 py-2.5 text-neutral-400 whitespace-nowrap font-mono text-[11px]">
                  {formatDate(audit.created_at)}
                </td>
                <td class="px-4 py-2.5">
                  <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap {operationStyles[audit.operation] ?? 'bg-neutral-800 text-neutral-400 border-neutral-700'}">
                    {operationLabels[audit.operation] ?? audit.operation}
                  </span>
                </td>
                <td class="px-4 py-2.5 text-neutral-300 font-mono">{audit.table_name}</td>
                <td class="px-4 py-2.5 text-neutral-400 font-mono">#{audit.record_id}</td>
                <td class="px-4 py-2.5">
                  {#if audit.user_name}
                    <span class="flex items-center gap-1.5 text-neutral-300">
                      <User class="w-3 h-3 text-neutral-500 shrink-0" />
                      {audit.user_name}
                    </span>
                  {:else if audit.user_id}
                    <span class="text-neutral-500">Usuario #{audit.user_id}</span>
                  {:else}
                    <span class="text-neutral-600 italic">Sistema</span>
                  {/if}
                </td>
                <td class="px-4 py-2.5 text-neutral-500 font-mono text-[11px]">{audit.ip_address ?? '—'}</td>
                <td class="px-2 py-2.5">
                  <ChevronDown class="w-3.5 h-3.5 text-neutral-600 transition-transform {expandedId === audit.id ? 'rotate-180' : ''}" />
                </td>
              </tr>

              {#if expandedId === audit.id}
                <tr class="border-b border-neutral-800/40 bg-neutral-900/40">
                  <td colspan="7" class="px-6 py-3">
                    {#if changedFields(audit).length > 0}
                      <div class="space-y-1.5 max-w-3xl">
                        {#each changedFields(audit) as field}
                          <div class="text-[11px] grid grid-cols-[140px_1fr] gap-3 items-start">
                            <span class="text-neutral-500 font-mono truncate" title={field}>{field}</span>
                            <div class="flex items-start gap-1.5 min-w-0">
                              {#if audit.old_values && field in audit.old_values}
                                <span class="text-neutral-600 line-through break-all whitespace-pre-wrap">
                                  {formatValue(audit.old_values[field])}
                                </span>
                                <ArrowRight class="w-2.5 h-2.5 text-neutral-700 shrink-0 mt-0.5" />
                              {/if}
                              <span class="text-neutral-200 break-all whitespace-pre-wrap">
                                {formatValue(audit.new_values?.[field])}
                              </span>
                            </div>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <p class="text-[11px] text-neutral-600 italic">Sin detalle de valores</p>
                    {/if}
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Paginación -->
      <div class="flex items-center justify-between px-4 py-2.5 border-t border-neutral-800/70">
        <span class="text-[11px] text-neutral-500 font-mono">
          {total} registro{total === 1 ? '' : 's'} · página {page} de {lastPage}
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
      </div>
    {/if}
  </div>
</div>
