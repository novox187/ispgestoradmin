<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { XIcon } from '@lucide/svelte';

  type ProviderStatus = 'active' | 'inactive';
  type Provider = {
    id: number;
    company_name: string;
    technical_support_contact?: string;
    support_phone?: string;
    support_email?: string;
    address?: string;
    payment_method?: string;
    account_number?: string;
    status: ProviderStatus;
    connections_count?: number;
  };

  const props = $props<{ open: boolean; isp: Provider | null; onClose: () => void }>();
  const animation = 'transition transition-discrete opacity-0 translate-y-[80px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[80px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} closeOnEscape closeOnInteractOutside onOpenChange={() => props.onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class={"card bg-surface-100-900 w-[560px] max-w-[95vw] max-h-[80vh] overflow-auto p-4 space-y-4 shadow-xl rounded-2xl " + animation}>
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Detalle del Proveedor</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        {#if props.isp}
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="text-xl font-semibold">{props.isp.company_name}</div>
              <span class={`px-3 py-1 rounded-full text-xs font-medium ${
                props.isp.status === 'active'
                  ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                  : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
              }`}>
                {props.isp.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Contacto técnico</div>
                <div class="text-sm text-foreground">{props.isp.technical_support_contact || '-'}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Teléfono soporte</div>
                <div class="text-sm text-foreground">{props.isp.support_phone || '-'}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Email soporte</div>
                <div class="text-sm text-foreground">{props.isp.support_email || '-'}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Conexiones registradas</div>
                <div class="text-sm text-foreground">{props.isp.connections_count ?? 0}</div>
              </div>
              <div class="md:col-span-2 bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Dirección</div>
                <div class="text-sm text-foreground">{props.isp.address || '-'}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Método de pago</div>
                <div class="text-sm text-foreground">{props.isp.payment_method || '-'}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Cuenta</div>
                <div class="text-sm text-foreground">{props.isp.account_number || '-'}</div>
              </div>
            </div>
          </div>
        {:else}
          <div class="text-muted-foreground">Sin datos</div>
        {/if}

        <div class="flex justify-end pt-2">
          <button class="px-4 py-2 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700" onclick={() => props.onClose?.()}>Cerrar</button>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>

