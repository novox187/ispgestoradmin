<script lang="ts">
  import type { AutomationAudit } from '$lib/types/automation';
  import { X, History, Loader2, AlertTriangle, User, Calendar, ArrowRight } from '@lucide/svelte';

  interface Props {
    open: boolean;
    automationName: string;
    audits: AutomationAudit[];
    loading: boolean;
    error: string;
    onClose: () => void;
  }

  let { open, automationName, audits, loading, error, onClose }: Props = $props();

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-EC', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  function formatValue(v: any): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  const operationStyles: Record<string, string> = {
    INSERT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    UPDATE: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
    DELETE: 'bg-red-500/10 text-red-400 border-red-500/25',
  };

  const operationLabels: Record<string, string> = {
    INSERT: 'Creado',
    UPDATE: 'Modificado',
    DELETE: 'Eliminado',
  };
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
    onclick={onClose}
    onkeydown={(e) => e.key === 'Escape' && onClose()}
    role="button"
    tabindex="-1"
    aria-label="Cerrar drawer"
  ></div>

  <aside
    class="fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-[#0f0f0f] border-l border-neutral-800 shadow-2xl overflow-hidden flex flex-col"
    aria-label="Historial de auditoría"
  >
    <header class="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
      <div class="flex items-center gap-2.5">
        <div class="p-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20">
          <History class="w-4 h-4 text-primary-400" />
        </div>
        <div>
          <h3 class="text-sm font-semibold text-neutral-100">Historial de cambios</h3>
          <p class="text-[11px] text-neutral-500">{automationName}</p>
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
          <p class="text-xs text-neutral-500">No hay cambios registrados todavía</p>
        </div>
      {:else}
        <ol class="space-y-3">
          {#each audits as audit}
            <li class="rounded-lg border border-neutral-800/70 bg-surface-elevated p-3.5">
              <div class="flex items-start justify-between gap-2 mb-2.5">
                <span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border {operationStyles[audit.operation] ?? 'bg-neutral-800 text-neutral-400 border-neutral-700'}">
                  {operationLabels[audit.operation] ?? audit.operation}
                </span>
                <span class="flex items-center gap-1 text-[10px] text-neutral-500">
                  <Calendar class="w-2.5 h-2.5" />
                  {formatDate(audit.created_at)}
                </span>
              </div>

              {#if audit.user_name || audit.user_email}
                <div class="flex items-center gap-1.5 text-[11px] text-neutral-400 mb-2.5">
                  <User class="w-3 h-3" />
                  <span class="font-medium text-neutral-300">{audit.user_name ?? 'Usuario'}</span>
                  {#if audit.user_email}
                    <span class="text-neutral-600">·</span>
                    <span class="text-neutral-500">{audit.user_email}</span>
                  {/if}
                </div>
              {:else}
                <p class="text-[11px] text-neutral-600 italic mb-2.5">Sistema</p>
              {/if}

              {#if audit.new_values && Object.keys(audit.new_values).length > 0}
                <div class="space-y-1">
                  {#each Object.keys(audit.new_values) as field}
                    <div class="text-[11px] grid grid-cols-[auto_1fr] gap-2 items-start">
                      <span class="text-neutral-500 font-mono">{field}</span>
                      <div class="flex items-center gap-1.5 min-w-0">
                        <span class="text-neutral-600 line-through truncate">
                          {formatValue(audit.old_values?.[field])}
                        </span>
                        <ArrowRight class="w-2.5 h-2.5 text-neutral-700 shrink-0" />
                        <span class="text-neutral-200 truncate">
                          {formatValue(audit.new_values[field])}
                        </span>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  </aside>
{/if}
