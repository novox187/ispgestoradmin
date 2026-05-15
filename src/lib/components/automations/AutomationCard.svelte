<script lang="ts">
  import type { AutomationSetting, ScheduleType, ScheduleConfig } from '$lib/types/automation';
  import { SCHEDULE_TYPE_LABELS } from '$lib/types/automation';
  import {
    Bot, Power, Save, History, Play, Loader2, CheckCircle2, AlertTriangle,
    Clock, Sliders, Activity,
  } from '@lucide/svelte';
  import ScheduleSelector from './ScheduleSelector.svelte';
  import ParamsEditor from './ParamsEditor.svelte';

  interface Props {
    automation: AutomationSetting;
    onSave: (
      key: string,
      payload: {
        enabled: boolean;
        schedule_type: ScheduleType;
        schedule_config: ScheduleConfig;
        params: Record<string, any>;
      },
    ) => Promise<{ success: boolean; errors?: Record<string, string>; message?: string }>;
    onShowAudit: (key: string, name: string) => void;
    onRunNow: (key: string) => Promise<{ success: boolean; message: string }>;
  }

  let { automation, onSave, onShowAudit, onRunNow }: Props = $props();

  let enabled = $state(automation.enabled);
  let scheduleType = $state<ScheduleType>(automation.schedule_type);
  let scheduleConfig = $state<ScheduleConfig>({ ...(automation.schedule_config ?? {}) });
  let params = $state<Record<string, any>>({ ...(automation.params ?? {}) });

  let saving = $state(false);
  let savedSuccess = $state(false);
  let saveError = $state('');
  let fieldErrors = $state<Record<string, string>>({});

  let runningNow = $state(false);
  let runMessage = $state('');

  const isDirty = $derived(
    enabled !== automation.enabled
    || scheduleType !== automation.schedule_type
    || JSON.stringify(scheduleConfig) !== JSON.stringify(automation.schedule_config ?? {})
    || JSON.stringify(params) !== JSON.stringify(automation.params ?? {})
  );

  function describeSchedule(): string {
    const c = scheduleConfig;
    if (scheduleType === 'daily') return `Diariamente a las ${c.time ?? '02:00'}`;
    if (scheduleType === 'monthly') return `Mensualmente, día ${c.day ?? 1} a las ${c.time ?? '01:00'}`;
    if (scheduleType === 'cron') return `Cron: ${c.expression ?? '—'}`;
    return SCHEDULE_TYPE_LABELS[scheduleType];
  }

  async function handleSave() {
    saving = true;
    saveError = '';
    savedSuccess = false;
    fieldErrors = {};

    const result = await onSave(automation.key, {
      enabled,
      schedule_type: scheduleType,
      schedule_config: scheduleConfig,
      params,
    });

    saving = false;

    if (result.success) {
      savedSuccess = true;
      setTimeout(() => { savedSuccess = false; }, 3000);
    } else {
      fieldErrors = result.errors ?? {};
      saveError = result.message ?? 'Error al guardar';
    }
  }

  function handleReset() {
    enabled = automation.enabled;
    scheduleType = automation.schedule_type;
    scheduleConfig = { ...(automation.schedule_config ?? {}) };
    params = { ...(automation.params ?? {}) };
    fieldErrors = {};
    saveError = '';
  }

  async function handleRunNow() {
    runningNow = true;
    runMessage = '';
    const res = await onRunNow(automation.key);
    runningNow = false;
    runMessage = res.message;
    setTimeout(() => { runMessage = ''; }, 4000);
  }

  function onScheduleChange(t: ScheduleType, c: ScheduleConfig) {
    scheduleType = t;
    scheduleConfig = c;
  }

  function onParamsChange(p: Record<string, any>) {
    params = p;
  }

  function formatLastRun(iso: string | null): string {
    if (!iso) return 'Nunca';
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
</script>

<article
  class="rounded-xl border bg-surface-elevated transition-all duration-200
    {enabled ? 'border-neutral-800/70' : 'border-neutral-800/40 opacity-80'}"
>
  <!-- Header con toggle y status -->
  <header class="flex items-start justify-between gap-3 px-5 pt-5">
    <div class="flex items-start gap-3 min-w-0">
      <div class="p-2 rounded-lg {enabled ? 'bg-primary-500/10 border border-primary-500/20' : 'bg-neutral-800/60 border border-neutral-800'}">
        <Bot class="w-4 h-4 {enabled ? 'text-primary-400' : 'text-neutral-500'}" />
      </div>
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-neutral-100 mb-0.5">{automation.name}</h3>
        <p class="text-[11px] text-neutral-500 leading-relaxed">{automation.description ?? ''}</p>
      </div>
    </div>

    <!-- Toggle enabled -->
    <button
      type="button"
      onclick={() => { enabled = !enabled; }}
      class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors
        {enabled ? 'bg-primary-500' : 'bg-neutral-700'}"
      aria-label="Habilitar/deshabilitar"
      role="switch"
      aria-checked={enabled}
    >
      <span
        class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-200"
        style="transform: translateX({enabled ? '1.125rem' : '0.125rem'})"
      ></span>
    </button>
  </header>

  <!-- Status row -->
  <div class="px-5 mt-3 flex flex-wrap items-center gap-3 text-[11px]">
    <span class="flex items-center gap-1.5 text-neutral-500">
      <Activity class="w-3 h-3" />
      <span class="text-neutral-400">Última ejecución:</span>
      <span class="font-mono text-neutral-300">{formatLastRun(automation.last_run_at)}</span>
    </span>
    <span class="flex items-center gap-1.5 text-neutral-500">
      <Clock class="w-3 h-3" />
      <span class="text-neutral-400">Horario:</span>
      <span class="text-neutral-300">{describeSchedule()}</span>
    </span>
  </div>

  <!-- Configuración (collapse en disabled) -->
  <div class="px-5 py-5 mt-3 border-t border-neutral-800/60 space-y-5">
    <!-- Schedule -->
    <section>
      <p class="text-[10px] font-mono font-semibold text-neutral-600 uppercase tracking-widest mb-2.5">
        Programación
      </p>
      <ScheduleSelector
        scheduleType={scheduleType}
        scheduleConfig={scheduleConfig}
        errors={fieldErrors}
        onChange={onScheduleChange}
      />
    </section>

    <!-- Params -->
    {#if automation.params_schema && Object.keys(automation.params_schema).length > 0}
      <section>
        <p class="text-[10px] font-mono font-semibold text-neutral-600 uppercase tracking-widest mb-2.5">
          Parámetros
        </p>
        <ParamsEditor
          schema={automation.params_schema}
          params={params}
          errors={fieldErrors}
          onChange={onParamsChange}
        />
      </section>
    {/if}
  </div>

  <!-- Footer: acciones -->
  <footer class="px-5 py-3.5 border-t border-neutral-800/60 flex flex-wrap items-center justify-between gap-2 bg-neutral-900/30">
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => onShowAudit(automation.key, automation.name)}
        class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors"
      >
        <History class="w-3.5 h-3.5" />
        Historial
      </button>
      <button
        type="button"
        onclick={handleRunNow}
        disabled={!automation.enabled || runningNow}
        class="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {#if runningNow}
          <Loader2 class="w-3.5 h-3.5 animate-spin" />
        {:else}
          <Play class="w-3.5 h-3.5" />
        {/if}
        Ejecutar ahora
      </button>
    </div>

    <div class="flex items-center gap-2">
      {#if savedSuccess}
        <span class="flex items-center gap-1 text-[11px] text-emerald-400">
          <CheckCircle2 class="w-3.5 h-3.5" /> Guardado
        </span>
      {/if}
      {#if saveError}
        <span class="flex items-center gap-1 text-[11px] text-red-400">
          <AlertTriangle class="w-3.5 h-3.5" /> {saveError}
        </span>
      {/if}
      {#if runMessage}
        <span class="text-[11px] text-primary-400">{runMessage}</span>
      {/if}

      {#if isDirty}
        <button
          type="button"
          onclick={handleReset}
          class="text-xs px-3 py-1.5 rounded-lg text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 transition-colors"
        >
          Descartar
        </button>
      {/if}

      <button
        type="button"
        onclick={handleSave}
        disabled={!isDirty || saving}
        class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
          {isDirty && !saving
            ? 'bg-primary-500 text-white hover:bg-primary-600'
            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'}"
      >
        {#if saving}
          <Loader2 class="w-3.5 h-3.5 animate-spin" />
        {:else}
          <Save class="w-3.5 h-3.5" />
        {/if}
        Guardar
      </button>
    </div>
  </footer>
</article>
