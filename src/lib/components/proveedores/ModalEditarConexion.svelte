<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { XIcon } from '@lucide/svelte';
  import type { Connection } from '$lib/types/proveedores';

  const props = $props<{ open: boolean; connection: Connection | null; onClose: () => void; onSave?: (c: Connection) => Promise<Connection | void> }>();

  let working = $state<Connection | null>(null);
  $effect(() => {
    working = props.connection ? { ...props.connection } : null;
  });

  let saving = $state(false);
  let saveOk = $state(false);
  let saveErr = $state<string | null>(null);

  async function save() {
    if (!working || saving) return;
    saveOk = false;
    saveErr = null;
    saving = true;
    try {
      const payload: Connection = {
        ...working,
        bandwidth_down: Number(working.bandwidth_down),
        bandwidth_up: Number(working.bandwidth_up),
        ratio: (working.ratio || '1:1').trim(),
        billing_day: Number(working.billing_day),
        billing_cycle: (working.billing_cycle || 'monthly').trim(),
        monthly_price: Number(working.monthly_price),
        interface_name: (working.interface_name || '').trim(),
      };
      if (props.onSave) await props.onSave(payload);
      saveOk = true;
    } catch (e: any) {
      saveErr = 'Error al guardar';
    } finally {
      saving = false;
    }
  }

  const animation = 'transition transition-discrete opacity-0 translate-y-[80px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[80px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';

  let touched = $state({
    bandwidth_down: false,
    bandwidth_up: false,
    billing_day: false,
    contract_date: false,
    monthly_price: false,
  });

  const bdValid = $derived(!!working && Number(working.bandwidth_down) > 0);
  const buValid = $derived(!!working && Number(working.bandwidth_up) > 0);
  const billingDayValid = $derived(!!working && Number(working.billing_day) >= 1 && Number(working.billing_day) <= 31);
  const contractDateValid = $derived(!!working && !!working.contract_date);
  const priceValid = $derived(!!working && Number(working.monthly_price) >= 0);
  const ratioTrim = $derived((working?.ratio || '1:1').trim());
  const ifaceTrim = $derived((working?.interface_name || '').trim());
  const pricePerMbPreview = $derived(bdValid && working ? Number(working.monthly_price) / Number(working.bandwidth_down) : 0);

  const canSave = $derived(!!working && bdValid && buValid && billingDayValid && contractDateValid && priceValid);
</script>

<Dialog open={props.open} closeOnEscape closeOnInteractOutside onOpenChange={() => props.onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class={"card bg-surface-100-900 w-[620px] max-w-[95vw] max-h-[80vh] overflow-auto p-4 space-y-4 shadow-xl rounded-2xl " + animation}>
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Editar Conexión</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        {#if working}
          <div class="space-y-4">
            <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div class="text-sm font-semibold text-foreground">Recursos de red</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs text-muted-foreground flex items-center gap-2" for="bd">
                    Bajada (Mbps)
                    <span class="text-rose-400 text-[10px]">Requerido</span>
                  </label>
                  <input
                    id="bd"
                    type="number"
                    step="0.01"
                    min="0"
                    class={`w-full px-3 py-2 rounded-lg bg-neutral-900 border ${touched.bandwidth_down && !bdValid ? 'border-red-500/40' : 'border-neutral-800'} focus:outline-none`}
                    placeholder="Ej: 200"
                    bind:value={working.bandwidth_down}
                    onblur={() => (touched.bandwidth_down = true)}
                  />
                  <p class="text-[11px] text-muted-foreground mt-1">Capacidad real contratada (no nominal).</p>
                  {#if touched.bandwidth_down && !bdValid}
                    <p class="text-[11px] text-rose-400 mt-1">Debe ser mayor a 0.</p>
                  {/if}
                </div>
                <div>
                  <label class="text-xs text-muted-foreground flex items-center gap-2" for="bu">
                    Subida (Mbps)
                    <span class="text-rose-400 text-[10px]">Requerido</span>
                  </label>
                  <input
                    id="bu"
                    type="number"
                    step="0.01"
                    min="0"
                    class={`w-full px-3 py-2 rounded-lg bg-neutral-900 border ${touched.bandwidth_up && !buValid ? 'border-red-500/40' : 'border-neutral-800'} focus:outline-none`}
                    placeholder="Ej: 200"
                    bind:value={working.bandwidth_up}
                    onblur={() => (touched.bandwidth_up = true)}
                  />
                  <p class="text-[11px] text-muted-foreground mt-1">Si es simétrico, suele ser igual a bajada.</p>
                  {#if touched.bandwidth_up && !buValid}
                    <p class="text-[11px] text-rose-400 mt-1">Debe ser mayor a 0.</p>
                  {/if}
                </div>
                <div>
                  <label class="text-xs text-muted-foreground" for="ratio">Ratio</label>
                  <input id="ratio" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" placeholder="Ej: 1:1, 10:1" bind:value={working.ratio} />
                  <p class="text-[11px] text-muted-foreground mt-1">Útil para diferenciar dedicado vs residencial.</p>
                </div>
                <div>
                  <label class="text-xs text-muted-foreground" for="status">Estado</label>
                  <select id="status" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" bind:value={working.status}>
                    <option value="active">Activo</option>
                    <option value="maintenance">Mantenimiento</option>
                    <option value="suspended">Suspendido</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                  <p class="text-[11px] text-muted-foreground mt-1">Activo cuenta para capacidad; mantenimiento te permite identificar incidentes.</p>
                </div>
                <div class="md:col-span-2">
                  <label class="text-xs text-muted-foreground" for="iface">Interfaz (Router/MikroTik)</label>
                  <input id="iface" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" placeholder="Ej: ether1-wan, sfp1-uplink" bind:value={working.interface_name} />
                  <p class="text-[11px] text-muted-foreground mt-1">Opcional. Identificador técnico para correlación con tu router.</p>
                </div>
              </div>
            </div>

            <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
              <div class="text-sm font-semibold text-foreground">Contrato y pagos</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="text-xs text-muted-foreground flex items-center gap-2" for="contractDate">
                    Fecha de contrato
                    <span class="text-rose-400 text-[10px]">Requerido</span>
                  </label>
                  <input
                    id="contractDate"
                    type="date"
                    class={`w-full px-3 py-2 rounded-lg bg-neutral-900 border ${touched.contract_date && !contractDateValid ? 'border-red-500/40' : 'border-neutral-800'} focus:outline-none`}
                    bind:value={working.contract_date}
                    onblur={() => (touched.contract_date = true)}
                  />
                  <p class="text-[11px] text-muted-foreground mt-1">Inicio del contrato o última renovación.</p>
                  {#if touched.contract_date && !contractDateValid}
                    <p class="text-[11px] text-rose-400 mt-1">Selecciona una fecha.</p>
                  {/if}
                </div>
                <div>
                  <label class="text-xs text-muted-foreground flex items-center gap-2" for="billingDay">
                    Día de pago
                    <span class="text-rose-400 text-[10px]">Requerido</span>
                  </label>
                  <input
                    id="billingDay"
                    type="number"
                    min="1"
                    max="31"
                    class={`w-full px-3 py-2 rounded-lg bg-neutral-900 border ${touched.billing_day && !billingDayValid ? 'border-red-500/40' : 'border-neutral-800'} focus:outline-none`}
                    placeholder="1 - 31"
                    bind:value={working.billing_day}
                    onblur={() => (touched.billing_day = true)}
                  />
                  <p class="text-[11px] text-muted-foreground mt-1">Cada mes, el día {Number.isFinite(Number(working.billing_day)) ? working.billing_day : 1}.</p>
                  {#if touched.billing_day && !billingDayValid}
                    <p class="text-[11px] text-rose-400 mt-1">Debe estar entre 1 y 31.</p>
                  {/if}
                </div>
                <div>
                  <label class="text-xs text-muted-foreground" for="billingCycle">Ciclo</label>
                  <select id="billingCycle" class="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 focus:outline-none" bind:value={working.billing_cycle}>
                    <option value="monthly">Mensual</option>
                    <option value="bimonthly">Bimestral</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                  </select>
                  <p class="text-[11px] text-muted-foreground mt-1">Cómo se repite el cobro.</p>
                </div>
                <div>
                  <label class="text-xs text-muted-foreground flex items-center gap-2" for="price">
                    Precio mensual
                    <span class="text-rose-400 text-[10px]">Requerido</span>
                  </label>
                  <input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    class={`w-full px-3 py-2 rounded-lg bg-neutral-900 border ${touched.monthly_price && !priceValid ? 'border-red-500/40' : 'border-neutral-800'} focus:outline-none`}
                    placeholder="Ej: 250.00"
                    bind:value={working.monthly_price}
                    onblur={() => (touched.monthly_price = true)}
                  />
                  <p class="text-[11px] text-muted-foreground mt-1">Se usa para costo/megabit.</p>
                  {#if touched.monthly_price && !priceValid}
                    <p class="text-[11px] text-rose-400 mt-1">Debe ser 0 o mayor.</p>
                  {/if}
                </div>
              </div>
            </div>

            <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
              <div class="text-sm font-semibold text-foreground mb-3">Resumen</div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div class="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
                  <div class="text-[11px] text-muted-foreground">Capacidad</div>
                  <div class="text-sm text-foreground">{Number(working.bandwidth_down) || 0}↓ / {Number(working.bandwidth_up) || 0}↑ Mbps</div>
                </div>
                <div class="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
                  <div class="text-[11px] text-muted-foreground">Ratio / Interfaz</div>
                  <div class="text-sm text-foreground">{ratioTrim || '1:1'} {ifaceTrim ? `• ${ifaceTrim}` : ''}</div>
                </div>
                <div class="bg-neutral-950/40 border border-neutral-800 rounded-lg p-3">
                  <div class="text-[11px] text-muted-foreground">Costo por Mb (bajada)</div>
                  <div class="text-sm text-foreground">${(Number.isFinite(pricePerMbPreview) ? pricePerMbPreview : 0).toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <div class="flex justify-between items-center gap-3 pt-2">
          <div class="text-sm">
            {#if saving}
              <span class="text-muted-foreground">Guardando...</span>
            {:else if saveOk}
              <span class="text-emerald-400">Guardado</span>
            {:else if saveErr}
              <span class="text-rose-400">{saveErr}</span>
            {/if}
          </div>
          <div class="flex gap-3">
            <button class="px-4 py-2 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700" onclick={() => props.onClose?.()}>Cerrar</button>
            <button class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors" disabled={saving || !canSave} onclick={save}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>

