<script lang="ts">
  import { Loader2 } from '@lucide/svelte';
  import ModalConfirmacion from '$lib/components/common/ModalConfirmacion.svelte';

  type NotifyPayload = { type: 'success' | 'error' | 'info'; message: string };
  type ActionResult = { ok: boolean; message: string };

  const props = $props<{
    title: string;
    description: string;
    actionLabel: string;
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
<div class="card bg-surface-100-900 border border-neutral-800 rounded-xl p-5 space-y-4">
  <div class="space-y-1">
    <h3 class="text-lg font-semibold text-foreground">{props.title}</h3>
    <p class="text-sm text-muted-foreground leading-relaxed">{props.description}</p>
  </div>

  {#if props.acknowledgeLabel}
    <label class="flex items-center gap-2 text-xs text-muted-foreground">
      <input type="checkbox" bind:checked={acknowledged} />
      <span>{props.acknowledgeLabel}</span>
    </label>
  {/if}

  <slot />

  {#if validationError}
    <div class="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2" role="alert">
      {validationError}
    </div>
  {/if}

  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-4">
      <button
        type="button"
        class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center gap-2"
        onclick={validateBeforeOpen}
        disabled={loading || props.actionDisabled}
        aria-busy={loading}
      >
        {#if loading}
          <Loader2 class="size-4 animate-spin" />
        {/if}
        {props.actionLabel}
      </button>
      <label class="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" bind:checked={useAsync} />
        Ejecutar en segundo plano
      </label>
    </div>
    <span class="text-xs text-muted-foreground">Recomendado fuera de horas pico.</span>
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
