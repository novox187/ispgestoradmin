<script lang="ts">
  import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    Info,
    Loader2
  } from '@lucide/svelte';
  import ModalConfirmacion from '$lib/components/common/ModalConfirmacion.svelte';
  import Toggle from '$lib/components/common/Toggle.svelte';
  import type { Component } from 'svelte';

  type NotifyPayload = { type: 'success' | 'error' | 'info'; message: string };
  type ActionResult = { ok: boolean; message: string };
  type Severity = 'info' | 'warning' | 'danger';

  const props = $props<{
    title: string;
    description: string;
    actionLabel: string;
    icon?: Component<any>;
    /** Etiqueta del flujo de datos, p. ej. { from: 'Base de datos', to: 'Router' } */
    direction?: { from: string; to: string };
    /** Si no se indica, se deriva de modalType. */
    severity?: Severity;
    requisitos?: string[];
    riesgos?: string[];
    flujo?: string[];
    modalTitle: string;
    modalMessage: string;
    modalDetailsTitle?: string;
    modalDetailsItems?: string[];
    modalSecondaryMessage?: string;
    confirmText?: string;
    cancelText?: string;
    modalType?: 'danger' | 'success' | 'warning' | 'info';
    acknowledgeLabel?: string;
    acknowledgeRequired?: boolean;
    actionDisabled?: boolean;
    validate?: () => string | null;
    onAction: (useAsync: boolean) => Promise<ActionResult>;
    onNotify?: (payload: NotifyPayload) => void;
    useAsync?: boolean;
  }>();

  let open = $state(false);
  let loading = $state(false);
  let actionError = $state<string | null>(null);
  let validationError = $state<string | null>(null);
  let acknowledged = $state(false);
  let detailsOpen = $state(false);
  let useAsync = $state(props.useAsync || false);

  const Icon = $derived(props.icon);

  const severity = $derived<Severity>(
    props.severity ??
      (props.modalType === 'danger' ? 'danger' : props.modalType === 'warning' ? 'warning' : 'info')
  );

  // Paleta por severidad, alineada al sistema visual del módulo MikroTik.
  const tone = $derived(
    severity === 'danger'
      ? {
          iconWrap: 'bg-red-500/10 border-red-500/20',
          iconText: 'text-red-300',
          chip: 'border-red-500/25 bg-red-500/10 text-red-300',
          chipLabel: 'Operación crítica'
        }
      : severity === 'warning'
        ? {
            iconWrap: 'bg-amber-500/10 border-amber-500/20',
            iconText: 'text-amber-300',
            chip: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
            chipLabel: 'Operación sensible'
          }
        : {
            iconWrap: 'bg-blue-500/10 border-blue-500/20',
            iconText: 'text-blue-300',
            chip: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
            chipLabel: 'Rutinaria'
          }
  );

  const hasDetails = $derived(
    (props.requisitos?.length ?? 0) > 0 ||
      (props.riesgos?.length ?? 0) > 0 ||
      (props.flujo?.length ?? 0) > 0
  );

  function validateBeforeOpen() {
    if (loading) return false;
    const customError = props.validate ? props.validate() : null;
    if (customError) {
      validationError = customError;
      return false;
    }
    if (props.acknowledgeRequired && !acknowledged) {
      validationError = 'Debe confirmar la validación requerida para continuar.';
      return false;
    }
    validationError = null;
    open = true;
    return true;
  }

  async function handleConfirm() {
    if (loading) return;
    actionError = null;
    loading = true;

    if (useAsync) {
      open = false; // Cierra el modal inmediatamente
      props.onNotify?.({ type: 'info', message: 'La tarea se está ejecutando en segundo plano.' });
      props
        .onAction(true)
        .then((result: ActionResult) => {
          if (result.ok) {
            props.onNotify?.({ type: 'success', message: result.message });
          } else {
            props.onNotify?.({ type: 'error', message: result.message || 'No se pudo completar la acción.' });
          }
        })
        .catch((e: unknown) => {
          const message = e instanceof Error ? e.message : 'Error inesperado';
          props.onNotify?.({ type: 'error', message });
        })
        .finally(() => {
          loading = false;
        });
    } else {
      try {
        const result = await props.onAction(false);
        if (result.ok) {
          open = false;
          props.onNotify?.({ type: 'success', message: result.message });
        } else {
          actionError = result.message || 'No se pudo completar la acción.';
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Error inesperado';
        actionError = message;
      } finally {
        loading = false;
      }
    }
  }
</script>

<div class="flex flex-col rounded-xl border border-neutral-800 bg-[#121214] overflow-hidden">
  <!-- Encabezado -->
  <div class="flex items-start gap-3 p-5 pb-4">
    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border {tone.iconWrap}">
      {#if Icon}
        <Icon class="h-5 w-5 {tone.iconText}" />
      {:else}
        <AlertTriangle class="h-5 w-5 {tone.iconText}" />
      {/if}
    </div>

    <div class="min-w-0 flex-1 space-y-2">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-sm font-semibold text-gray-100 leading-snug">{props.title}</h3>
        <span
          class="hidden shrink-0 sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono tracking-wide {tone.chip}"
        >
          {tone.chipLabel}
        </span>
      </div>

      <p class="text-xs leading-relaxed text-gray-400">{props.description}</p>

      {#if props.direction}
        <div
          class="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900/60 px-2 py-1 text-[10px] font-mono text-gray-400"
        >
          <span class="text-gray-300">{props.direction.from}</span>
          <ArrowRight class="h-3 w-3 text-gray-500" />
          <span class="text-gray-300">{props.direction.to}</span>
        </div>
      {/if}
    </div>
  </div>

  <!-- Detalles técnicos (desplegable) -->
  {#if hasDetails}
    <div class="border-t border-neutral-800/70">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 px-5 py-2.5 text-left text-xs font-medium text-gray-400 transition-colors hover:text-gray-200"
        onclick={() => (detailsOpen = !detailsOpen)}
        aria-expanded={detailsOpen}
      >
        <span class="font-mono tracking-wide">Detalles técnicos</span>
        <ChevronDown class="h-4 w-4 transition-transform duration-200 {detailsOpen ? 'rotate-180' : ''}" />
      </button>

      {#if detailsOpen}
        <div class="space-y-4 px-5 pb-4 pt-1">
          {#if props.requisitos?.length}
            <div>
              <div class="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                <CheckCircle2 class="h-3.5 w-3.5" /> Requisitos
              </div>
              <ul class="space-y-1 pl-1">
                {#each props.requisitos as item}
                  <li class="flex gap-2 text-xs leading-relaxed text-gray-400">
                    <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500/60"></span>
                    <span>{item}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if props.riesgos?.length}
            <div>
              <div
                class="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide {severity === 'danger' ? 'text-red-400' : 'text-amber-400'}"
              >
                <AlertTriangle class="h-3.5 w-3.5" /> Riesgos
              </div>
              <ul class="space-y-1 pl-1">
                {#each props.riesgos as item}
                  <li class="flex gap-2 text-xs leading-relaxed text-gray-400">
                    <span class="mt-1.5 h-1 w-1 shrink-0 rounded-full {severity === 'danger' ? 'bg-red-500/60' : 'bg-amber-500/60'}"></span>
                    <span>{item}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if props.flujo?.length}
            <div>
              <div class="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-400">
                <Info class="h-3.5 w-3.5" /> Flujo de ejecución
              </div>
              <ol class="space-y-1 pl-1">
                {#each props.flujo as item, i}
                  <li class="flex gap-2 text-xs leading-relaxed text-gray-400">
                    <span class="font-mono text-[10px] text-gray-600">{i + 1}.</span>
                    <span>{item}</span>
                  </li>
                {/each}
              </ol>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if props.acknowledgeLabel}
    <label class="flex items-center gap-2 px-5 pt-3 text-xs text-gray-300">
      <input type="checkbox" bind:checked={acknowledged} class="accent-blue-500" />
      <span>{props.acknowledgeLabel}</span>
    </label>
  {/if}

  {#if validationError}
    <div class="mx-5 mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">
      {validationError}
    </div>
  {/if}

  <!-- Pie de acción -->
  <div class="mt-auto flex flex-col gap-3 border-t border-neutral-800/70 bg-neutral-900/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
    <button
      type="button"
      class="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      onclick={validateBeforeOpen}
      disabled={loading || props.actionDisabled}
      aria-busy={loading}
    >
      {#if loading}
        <Loader2 class="h-4 w-4 animate-spin" />
      {/if}
      {props.actionLabel}
    </button>

    <label class="flex cursor-pointer items-center gap-2 text-xs text-gray-400 select-none">
      <Toggle bind:checked={useAsync} size="sm" ariaLabel="Ejecutar en segundo plano" />
      <span>Ejecutar en segundo plano</span>
    </label>
  </div>
</div>

<ModalConfirmacion
  bind:open
  title={props.modalTitle}
  message={props.modalMessage}
  secondaryMessage={props.modalSecondaryMessage || ''}
  confirmText={props.confirmText || 'Confirmar'}
  cancelText={props.cancelText || 'Cancelar'}
  type={props.modalType || 'warning'}
  loading={loading}
  error={actionError}
  detailsTitle={props.modalDetailsTitle || ''}
  detailsItems={props.modalDetailsItems || []}
  on:confirm={handleConfirm}
  on:cancel={() => {
    actionError = null;
  }}
/>
