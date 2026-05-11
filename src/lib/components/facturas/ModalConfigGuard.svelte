<script lang="ts">
  import { goto } from '$app/navigation';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { AlertTriangle, Settings, X, ChevronRight } from '@lucide/svelte';

  export interface ConfigCheckResult {
    valid: boolean;
    missing?: Record<string, Record<string, string>>;
    invalid?: Record<string, Record<string, string>>;
    messages?: string[];
  }

  // Props
  let {
    open       = $bindable(false),
    result     = null as ConfigCheckResult | null,
    onClose    = () => {},
  }: {
    open: boolean;
    result: ConfigCheckResult | null;
    onClose?: () => void;
  } = $props();

  const CONFIG_PATH = '/configuraciones/facturacion';

  // Group labels for display
  const GROUP_LABELS: Record<string, string> = {
    issuer:   'Datos del Emisor',
    tax:      'Impuestos',
    currency: 'Moneda',
    legal:    'Resolución Legal',
    billing:  'Parámetros de Cobro',
  };

  function handleGoToConfig() {
    open = false;
    onClose();
    goto(CONFIG_PATH);
  }

  function handleClose() {
    open = false;
    onClose();
  }

  const animation =
    'transition-discrete opacity-0 translate-y-4 ' +
    'starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-4 ' +
    'data-[state=open]:opacity-100 data-[state=open]:translate-y-0 duration-200';
</script>

<Dialog {open} closeOnEscape closeOnInteractOutside onOpenChange={(e) => { if (!e.open) handleClose(); }}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content class={"bg-neutral-950 border border-red-500/25 w-full max-w-lg shadow-2xl rounded-2xl flex flex-col " + animation}>

        <!-- Header -->
        <header class="flex items-start justify-between gap-3 px-5 py-4 border-b border-neutral-800">
          <div class="flex items-start gap-3">
            <div class="p-2 rounded-lg bg-red-500/15 border border-red-500/20 shrink-0 mt-0.5">
              <AlertTriangle class="size-4 text-red-400" />
            </div>
            <div>
              <Dialog.Title class="text-base font-bold text-white leading-tight">
                Configuración incompleta
              </Dialog.Title>
              <p class="text-xs text-neutral-500 mt-0.5">
                No es posible crear la factura hasta completar la configuración.
              </p>
            </div>
          </div>
          <Dialog.CloseTrigger
            onclick={handleClose}
            class="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X class="size-4 text-neutral-400" />
          </Dialog.CloseTrigger>
        </header>

        <!-- Body -->
        <div class="px-5 py-4 space-y-4 overflow-y-auto max-h-[60vh]">

          {#if result?.messages?.length}
            <!-- Plain message list when groups aren't available -->
            <ul class="space-y-2">
              {#each result.messages as msg}
                <li class="flex items-start gap-2 text-sm text-red-300">
                  <span class="mt-1 size-1.5 rounded-full bg-red-400 shrink-0"></span>
                  {msg}
                </li>
              {/each}
            </ul>
          {/if}

          <!-- Missing settings grouped -->
          {#if result?.missing && Object.keys(result.missing).length > 0}
            <div class="space-y-3">
              <p class="text-[10px] font-mono font-semibold text-neutral-500 uppercase tracking-widest">
                Configuraciones faltantes
              </p>
              {#each Object.entries(result.missing) as [group, keys]}
                <div class="rounded-lg border border-neutral-800 bg-neutral-900/60 overflow-hidden">
                  <div class="px-3 py-2 bg-neutral-800/50 text-xs font-semibold text-neutral-300">
                    {GROUP_LABELS[group] ?? group}
                  </div>
                  <ul class="divide-y divide-neutral-800/60">
                    {#each Object.entries(keys) as [key, label]}
                      <li class="flex items-center gap-2 px-3 py-2 text-xs text-neutral-400">
                        <span class="size-1.5 rounded-full bg-amber-400 shrink-0"></span>
                        <span class="font-medium text-neutral-300">{label}</span>
                        <span class="ml-auto font-mono text-neutral-600 text-[10px]">{key}</span>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Invalid settings grouped -->
          {#if result?.invalid && Object.keys(result.invalid).length > 0}
            <div class="space-y-3">
              <p class="text-[10px] font-mono font-semibold text-neutral-500 uppercase tracking-widest">
                Configuraciones inválidas
              </p>
              {#each Object.entries(result.invalid) as [group, keys]}
                <div class="rounded-lg border border-red-500/20 bg-neutral-900/60 overflow-hidden">
                  <div class="px-3 py-2 bg-red-500/10 text-xs font-semibold text-red-300">
                    {GROUP_LABELS[group] ?? group}
                  </div>
                  <ul class="divide-y divide-neutral-800/60">
                    {#each Object.entries(keys) as [key, reason]}
                      <li class="px-3 py-2">
                        <div class="flex items-center gap-2 text-xs">
                          <span class="size-1.5 rounded-full bg-red-400 shrink-0"></span>
                          <span class="font-mono text-neutral-400">{key}</span>
                        </div>
                        <p class="text-xs text-red-400 mt-0.5 pl-3.5">{reason}</p>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          {/if}

          <!-- CTA hint -->
          <div class="flex items-start gap-2 p-3 rounded-lg bg-primary-500/8 border border-primary-500/20">
            <Settings class="size-4 text-primary-400 shrink-0 mt-0.5" />
            <p class="text-xs text-neutral-400">
              Complete los valores requeridos en
              <strong class="text-primary-300">Configuraciones → Facturación</strong>
              y vuelva a intentarlo.
            </p>
          </div>

        </div>

        <!-- Footer -->
        <footer class="px-5 py-4 border-t border-neutral-800 flex flex-col sm:flex-row justify-end gap-2">
          <button
            type="button"
            onclick={handleClose}
            class="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onclick={handleGoToConfig}
            class="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-500 transition-colors text-sm font-semibold"
          >
            <Settings class="size-4" />
            Ir a Configuraciones
            <ChevronRight class="size-4" />
          </button>
        </footer>

      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
