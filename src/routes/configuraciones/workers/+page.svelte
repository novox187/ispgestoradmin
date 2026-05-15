<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Bot, Loader2, AlertTriangle, RefreshCw, Info, Zap,
  } from '@lucide/svelte';
  import {
    listAutomations,
    updateAutomation,
    getAutomationAudits,
    runAutomationNow,
  } from '$lib/api/automations';
  import type { AutomationSetting, AutomationAudit } from '$lib/types/automation';
  import AutomationCard from '$lib/components/automations/AutomationCard.svelte';
  import AuditDrawer from '$lib/components/automations/AuditDrawer.svelte';

  let automations = $state<AutomationSetting[]>([]);
  let loading = $state(true);
  let loadError = $state('');

  let auditOpen = $state(false);
  let auditAutomationName = $state('');
  let audits = $state<AutomationAudit[]>([]);
  let auditLoading = $state(false);
  let auditError = $state('');

  async function load() {
    loading = true;
    loadError = '';
    try {
      automations = await listAutomations();
    } catch (e: any) {
      loadError = e.message || 'Error al cargar automatizaciones';
    } finally {
      loading = false;
    }
  }

  async function handleSave(
    key: string,
    payload: { enabled: boolean; schedule_type: any; schedule_config: any; params: any },
  ): Promise<{ success: boolean; errors?: Record<string, string>; message?: string }> {
    try {
      const result = await updateAutomation(key, payload);
      if ('errors' in result) {
        return { success: false, errors: result.errors, message: 'Validación fallida' };
      }
      const idx = automations.findIndex((a) => a.key === key);
      if (idx >= 0) {
        automations[idx] = result;
        automations = [...automations];
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message ?? 'Error de conexión' };
    }
  }

  async function handleShowAudit(key: string, name: string) {
    auditOpen = true;
    auditAutomationName = name;
    auditLoading = true;
    auditError = '';
    audits = [];
    try {
      audits = await getAutomationAudits(key);
    } catch (e: any) {
      auditError = e.message ?? 'Error al cargar auditoría';
    } finally {
      auditLoading = false;
    }
  }

  async function handleRunNow(key: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await runAutomationNow(key);
      const idx = automations.findIndex((a) => a.key === key);
      if (idx >= 0) {
        automations[idx] = { ...automations[idx], last_run_at: new Date().toISOString() };
        automations = [...automations];
      }
      return { success: true, message: res.message };
    } catch (e: any) {
      return { success: false, message: e.message ?? 'Error al ejecutar' };
    }
  }

  onMount(load);
</script>

<div class="px-4 md:px-8 py-8 max-w-4xl">

  <!-- Header -->
  <div class="mb-7">
    <div class="flex items-center gap-2.5 mb-1.5">
      <Bot class="w-5 h-5 text-primary-400" />
      <h2 class="text-lg font-semibold text-neutral-100">Workers Automáticos</h2>
    </div>
    <p class="text-sm text-neutral-500">
      Gestiona las tareas programadas del sistema: cortes automáticos, generación de facturas y sincronización
      con MikroTik. Los cambios se aplican <span class="text-neutral-300 font-medium">inmediatamente</span> y
      quedan registrados en el historial de auditoría.
    </p>
  </div>

  <!-- Info banner -->
  <div class="mb-6 flex items-start gap-2.5 p-3.5 rounded-xl border border-primary-500/20 bg-primary-500/5">
    <Info class="w-4 h-4 text-primary-400 shrink-0 mt-0.5" />
    <div class="text-xs text-neutral-400 leading-relaxed">
      Las automatizaciones se ejecutan en segundo plano dentro del servidor.
      Si una automatización está <span class="text-neutral-200 font-medium">deshabilitada</span>, el scheduler la omite por completo;
      sus parámetros se mantienen guardados pero no surten efecto hasta volver a habilitarla.
    </div>
  </div>

  {#if loading}
    <div class="space-y-4">
      {#each Array(3) as _}
        <div class="rounded-xl border border-neutral-800 bg-surface-elevated p-5 animate-pulse">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 bg-neutral-800 rounded-lg"></div>
            <div class="flex-1 space-y-2">
              <div class="h-3 w-1/3 bg-neutral-800 rounded"></div>
              <div class="h-2 w-2/3 bg-neutral-800 rounded"></div>
            </div>
            <div class="w-10 h-5 bg-neutral-800 rounded-full"></div>
          </div>
          <div class="mt-5 h-32 bg-neutral-800/40 rounded-lg"></div>
        </div>
      {/each}
    </div>

  {:else if loadError}
    <div class="flex items-center gap-3 p-4 rounded-xl border border-red-500/25 bg-red-500/10 text-sm text-red-400">
      <AlertTriangle class="w-4 h-4 shrink-0" />
      <span>{loadError}</span>
      <button onclick={load} class="ml-auto flex items-center gap-1 text-xs text-red-300 hover:text-red-200 transition-colors">
        <RefreshCw class="w-3.5 h-3.5" /> Reintentar
      </button>
    </div>

  {:else if automations.length === 0}
    <div class="text-center py-16">
      <Zap class="w-10 h-10 text-neutral-700 mx-auto mb-3" />
      <p class="text-sm text-neutral-400 mb-1">No hay automatizaciones configuradas</p>
      <p class="text-xs text-neutral-600">Ejecuta el seeder <span class="font-mono">AutomationSettingsSeeder</span> para poblarlas.</p>
    </div>

  {:else}
    <div class="space-y-4">
      {#each automations as automation (automation.id)}
        <AutomationCard
          {automation}
          onSave={handleSave}
          onShowAudit={handleShowAudit}
          onRunNow={handleRunNow}
        />
      {/each}
    </div>
  {/if}

  <AuditDrawer
    open={auditOpen}
    automationName={auditAutomationName}
    {audits}
    loading={auditLoading}
    error={auditError}
    onClose={() => { auditOpen = false; }}
  />
</div>
