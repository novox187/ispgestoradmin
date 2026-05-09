<script lang="ts">
  import { AlertTriangle, Loader2 } from '@lucide/svelte';
  import ModalConfirmacion from '$lib/components/common/ModalConfirmacion.svelte';
  import type { Component } from 'svelte';

  type NotifyPayload = { type: 'success' | 'error' | 'info'; message: string };
  type ActionResult = { ok: boolean; message: string };

  const props = $props<{
    title: string;
    description: string;
    actionLabel: string;
    icon?: Component<any>;
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
  let useAsync = $state(props.useAsync || false);
  const Icon = $derived(props.icon);

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
      props.onAction(true).then((result: ActionResult) => {
        if (result.ok) {
          props.onNotify?.({ type: 'success', message: result.message });
        } else {
          props.onNotify?.({ type: 'error', message: result.message || 'No se pudo completar la acción.' });
        }
      }).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'Error inesperado';
        props.onNotify?.({ type: 'error', message });
      }).finally(() => {
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

<!-- svelte-ignore slot_element_deprecated -->
<div class="rounded-2xl border border-white/10 bg-gradient-to-b from-[#141414] to-[#0d0d0d] p-6 shadow-xl">
  <div class="flex items-start justify-between gap-4">
    <div class="flex items-start gap-3 min-w-0">
      <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
        {#if Icon}
          <Icon class="w-5 h-5 text-blue-300" />
        {:else}
          <AlertTriangle class="w-5 h-5 text-blue-300" />
        {/if}
      </div>
      <div class="space-y-1 min-w-0">
        <h3 class="text-base sm:text-lg font-semibold text-gray-100 truncate">{props.title}</h3>
        <p class="text-xs sm:text-sm text-gray-400 leading-relaxed">
          {props.description}
        </p>
      </div>
    </div>

    <div class="hidden sm:flex items-center gap-2">
      <span class="text-[10px] font-mono tracking-wide px-2 py-1 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-200">
        Operación sensible
      </span>
    </div>
  </div>

  {#if props.acknowledgeLabel}
    <label class="flex items-center gap-2 text-xs text-gray-300 mt-4">
      <input type="checkbox" bind:checked={acknowledged} class="accent-blue-500" />
      <span>{props.acknowledgeLabel}</span>
    </label>
  {/if}

  <div class="mt-4">
    <slot />
  </div>

  {#if validationError}
    <div class="mt-4 text-xs text-red-200 bg-red-600/10 border border-red-500/20 rounded-xl px-4 py-3" role="alert">
      {validationError}
    </div>
  {/if}

  <div class="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2 shadow-lg shadow-blue-900/20"
        onclick={validateBeforeOpen}
        disabled={loading || props.actionDisabled}
        aria-busy={loading}
      >
        {#if loading}
          <Loader2 class="size-4 animate-spin" />
        {/if}
        {props.actionLabel}
      </button>
    </div>
    <label class="flex items-center gap-2 text-xs sm:text-sm text-gray-300">
      <input type="checkbox" bind:checked={useAsync} class="accent-blue-500" />
      Ejecutar en segundo plano
      <span class="text-[10px] sm:text-xs text-gray-500">(recomendado fuera de horas pico)</span>
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
  on:cancel={() => { actionError = null; }}
/>
