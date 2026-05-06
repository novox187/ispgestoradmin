<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { XIcon } from '@lucide/svelte';

  type ConnectionStatus = 'active' | 'maintenance' | 'suspended' | 'canceled';
  type Connection = {
    id: number;
    isp_id: number;
    bandwidth_down: number;
    bandwidth_up: number;
    ratio: string;
    contract_date: string;
    billing_day: number;
    billing_cycle: string;
    monthly_price: number;
    interface_name?: string;
    status: ConnectionStatus;
    price_per_mb: number;
  };

  const props = $props<{ open: boolean; connection: Connection | null; onClose: () => void }>();

  function statusClass(s: ConnectionStatus) {
    if (s === 'active') return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
    if (s === 'maintenance') return "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20";
    if (s === 'suspended') return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
    return "bg-gray-500/10 text-gray-300 hover:bg-gray-500/20";
  }
  function statusLabel(s: ConnectionStatus) {
    if (s === 'active') return 'Activo';
    if (s === 'maintenance') return 'Mantenimiento';
    if (s === 'suspended') return 'Suspendido';
    return 'Cancelado';
  }

  const animation = 'transition transition-discrete opacity-0 translate-y-[80px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[80px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} closeOnEscape closeOnInteractOutside onOpenChange={() => props.onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class={"card bg-surface-100-900 w-[560px] max-w-[95vw] max-h-[80vh] overflow-auto p-4 space-y-4 shadow-xl rounded-2xl " + animation}>
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Detalle de Conexión</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        {#if props.connection}
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="text-lg font-semibold">{props.connection.bandwidth_down}↓ / {props.connection.bandwidth_up}↑ Mbps</div>
              <span class={`px-3 py-1 rounded-full text-xs font-medium ${statusClass(props.connection.status)}`}>
                {statusLabel(props.connection.status)}
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Ratio</div>
                <div class="text-sm text-foreground">{props.connection.ratio || '-'}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Precio mensual</div>
                <div class="text-sm text-foreground">${props.connection.monthly_price.toFixed(2)}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Costo por Mb (bajada)</div>
                <div class="text-sm text-foreground">${props.connection.price_per_mb.toFixed(2)}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Fecha contrato</div>
                <div class="text-sm text-foreground">{props.connection.contract_date}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Día de pago</div>
                <div class="text-sm text-foreground">{props.connection.billing_day}</div>
              </div>
              <div class="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Ciclo</div>
                <div class="text-sm text-foreground">{props.connection.billing_cycle || '-'}</div>
              </div>
              <div class="md:col-span-2 bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
                <div class="text-xs text-muted-foreground">Interfaz</div>
                <div class="text-sm text-foreground">{props.connection.interface_name || '-'}</div>
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

