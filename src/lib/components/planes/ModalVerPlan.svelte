<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { XIcon, Wifi, Users } from '@lucide/svelte';
  import type { CapacitySnapshot } from '$lib/types/capacity';
  type Plan = {
    id: number;
    name: string;
    price: number;
    download: number;
    upload: number;
    status: 'active' | 'inactive';
    clients: number;
    revenue: number;
    description?: string;
    features?: { feature: string; order: number; highlighted: boolean }[];
  };
  const props = $props<{ open: boolean; plan: Plan | null; onClose: () => void; capacity?: CapacitySnapshot | null }>();
  const animation = 'transition transition-discrete opacity-0 translate-y-[80px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[80px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} closeOnEscape closeOnInteractOutside onOpenChange={() => props.onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class={"card bg-surface-100-900 w-[520px] max-w-[95vw] p-4 shadow-xl rounded-2xl overflow-auto  max-h-[80vh] " + animation}>
        <header class="flex justify-between items-center mb-2">
          <Dialog.Title class="text-lg font-bold">Detalle del Plan</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        {#if props.plan}
          <div class="rounded-2xl p-5">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-3">
                <div>
                  <Wifi class="w-5 h-5 text-gray-200" />
                </div>
                <h3 class="text-lg font-semibold tracking-tight">{props.plan.name}</h3>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-2">
              <div class="space-y-2">
                <div class="text-3xl font-bold tracking-tight">${props.plan.price.toFixed(2)}</div>
                <p class="text-sm text-gray-400 leading-relaxed">{props.plan.description || ''}</p>
                <div class="flex items-center gap-3 mt-3">
                  <span class={"text-xs px-3 py-1 rounded-full border " + (props.plan.status === 'active' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-rose-500/10 border-rose-500/20 text-rose-300")}>
                    {props.plan.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                  <div class="flex items-center gap-1.5 text-sm text-gray-400">
                    <Users class="w-4 h-4" />
                    <span>{props.plan.clients} clientes</span>
                  </div>
                </div>
              </div>
              <div class="mt-4 md:mt-0 md:text-right">
                <div class="text-right">
                  <div class="text-xl font-semibold tracking-tight">{props.plan.download} Mbps</div>
                  <div class="text-xs text-gray-400">{props.plan.download} / {props.plan.upload} Mbps</div>
                </div>
              </div>
            </div>

            {#if props.plan.features && props.plan.features.length}
              <div class="mt-5">
                <div class="text-sm font-semibold">Características:</div>
                <ul class="mt-2 space-y-2">
                  {#each [...props.plan.features].sort((a, b) => a.order - b.order) as f}
                    <li class="flex items-start gap-2 text-sm leading-relaxed {f.highlighted ? 'text-emerald-300' : 'text-gray-300'}">
                      <span class="mt-1 w-1.5 h-1.5 rounded-full bg-white/30"></span>
                      <span>{f.feature}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}

            <div class="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <span class="text-sm text-gray-400">Ingresos mensuales:</span>
              <span class="text-sm font-semibold tracking-tight">
                ${props.plan.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {#if props.capacity}
              <div class="mt-4 pt-4 border-t border-white/10">
                <div class="text-sm font-semibold">Uso del ISP (clientes activos)</div>
                <div class="text-xs text-gray-400 mt-1">
                  {Number(props.capacity.clients_percent_used_down ?? 0).toFixed(1)}% ↓ · {Number(props.capacity.clients_percent_used_up ?? 0).toFixed(1)}% ↑
                </div>
              </div>
            {/if}
          </div>
          <div class="flex justify-end mt-3">
            <button class="px-4 py-2 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700" onclick={() => props.onClose?.()}>Cerrar</button>
          </div>
        {:else}
          <div class="text-muted-foreground">Sin datos de plan.</div>
        {/if}
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
