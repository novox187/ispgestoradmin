<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { XIcon } from '@lucide/svelte';
  type FeatureItem = { feature: string; order: number; highlighted: boolean };
  type Plan = {
    id: number;
    name: string;
    price: number;
    download: number;
    upload: number;
    ratio?: string;
    status: 'active' | 'inactive';
    clients: number;
    revenue: number;
    description?: string;
    features?: FeatureItem[];
    symmetric?: boolean;
    setup_price?: number;
    billing_cycle?: string;
    category?: string;
    priority?: number;
    is_featured?: boolean;
    mikrotik_queue_name?: string;
    download_limit?: string;
    upload_limit?: string;
    burst_limit?: string;
  };
  const props = $props<{ open: boolean; plan: Plan | null; onClose: () => void; onSave?: (plan: Plan) => Promise<Plan | void> }>();
  let working: Plan | null = $state(null);
  $effect(() => { working = props.plan ? { ...props.plan } : null });
  let featuresList = $state<FeatureItem[]>([]);
  let newFeature = $state('');
  function nextOrder() {
    return featuresList.length ? Math.max(...featuresList.map(x => x.order ?? 0)) + 1 : 0;
  }
  $effect(() => { featuresList = [...(working?.features || [])] });
  function addFeature() {
    const f = newFeature.trim();
    if (!f) return;
    if (!featuresList.find(x => x.feature === f)) featuresList.push({ feature: f, order: nextOrder(), highlighted: false });
    newFeature = '';
  }
  function removeFeature(i: number) {
    if (i >= 0 && i < featuresList.length) featuresList.splice(i, 1);
  }
  let isSaving = $state(false);
  let saveOk = $state(false);
  let saveErr = $state<string | null>(null);
  async function save() {
    saveOk = false;
    saveErr = null;
    if (!working) return;
    isSaving = true;
    try {
      working.features = [...featuresList];
      if (props.onSave) {
        const updated = await props.onSave(working);
        if (updated) {
          working = { ...updated };
          featuresList = [...(updated.features || [])];
        }
      }
      saveOk = true;
    } catch (e) {
      saveErr = 'Error al guardar';
    } finally {
      isSaving = false;
    }
  }
  const animation = 'transition transition-discrete opacity-0 translate-y-[80px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[80px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} closeOnEscape closeOnInteractOutside onOpenChange={() => props.onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class={"card bg-surface-100-900 w-[560px] max-w-[95vw] h-[80vh] max-h-dvh overflow-auto p-4 space-y-4 shadow-xl rounded-2xl " + animation}>
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Editar Plan</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        {#if working}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="plan-name" class="text-xs text-muted-foreground">Nombre</label>
              <input id="plan-name" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.name} />
            </div>
            <div>
              <label for="plan-price" class="text-xs text-muted-foreground">Precio</label>
              <input id="plan-price" type="number" step="0.01" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.price} />
            </div>
            <div>
              <label for="download" class="text-xs text-muted-foreground">Velocidad descarga</label>
              <input id="download" type="number" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.download} />
            </div>
            <div>
              <label for="upload" class="text-xs text-muted-foreground">Velocidad subida</label>
              <input id="upload" type="number" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.upload} />
            </div>
            <div>
              <label for="ratio" class="text-xs text-muted-foreground">Ratio</label>
              <input id="ratio" class="w-full px-3 py-2 rounded-lg bg-neutral-900" placeholder="ej: 1:4" bind:value={working.ratio} />
            </div>
            <div class="md:col-span-2">
              <label class="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" bind:checked={working.symmetric} />
                Simétrico
              </label>
            </div>
            <div class="md:col-span-2">
              <label for="plan-description" class="text-xs text-muted-foreground">Descripción</label>
              <textarea id="plan-description" rows="3" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.description}></textarea>
            </div>
            <div>
              <label for="setup-price" class="text-xs text-muted-foreground">Precio instalación</label>
              <input id="setup-price" type="number" step="0.01" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.setup_price} />
            </div>
            <div>
              <label for="billing-cycle" class="text-xs text-muted-foreground">Ciclo de facturación</label>
              <select id="billing-cycle" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.billing_cycle}>
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
            <div>
              <label for="category" class="text-xs text-muted-foreground">Categoría</label>
              <select id="category" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.category}>
                <option value="residential">Residencial</option>
                <option value="business">Empresarial</option>
              </select>
            </div>
            <div>
              <label for="priority" class="text-xs text-muted-foreground">Prioridad</label>
              <input id="priority" type="number" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.priority} />
            </div>
            <div class="md:col-span-2">
              <label class="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" bind:checked={working.is_featured} />
                Destacado
              </label>
            </div>
            <div class="md:col-span-2">
              <label for="mikrotik-queue" class="text-xs text-muted-foreground">Nombre de cola MikroTik</label>
              <input id="mikrotik-queue" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.mikrotik_queue_name} />
            </div>
            <div>
              <label for="download-limit" class="text-xs text-muted-foreground">Límite descarga</label>
              <input id="download-limit" class="w-full px-3 py-2 rounded-lg bg-neutral-900" placeholder="ej: 50M" bind:value={working.download_limit} />
            </div>
            <div>
              <label for="upload-limit" class="text-xs text-muted-foreground">Límite subida</label>
              <input id="upload-limit" class="w-full px-3 py-2 rounded-lg bg-neutral-900" placeholder="ej: 10M" bind:value={working.upload_limit} />
            </div>
            <div class="md:col-span-2">
              <label for="burst-limit" class="text-xs text-muted-foreground">Burst limit</label>
              <input id="burst-limit" class="w-full px-3 py-2 rounded-lg bg-neutral-900" placeholder="ej: 75M/15M" bind:value={working.burst_limit} />
            </div>
            <div class="md:col-span-2">
              <label for="features-input" class="text-xs text-muted-foreground">Características</label>
              <div class="flex gap-2">
                <input id="features-input" class="flex-1 px-3 py-2 rounded-lg bg-neutral-900" placeholder="Agregar característica" bind:value={newFeature} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') addFeature() }} />
                <button class="sm:px-4 sm:py-2 rounded-xl sm:hover:bg-gray-200  sm:hover:text-gray-900 text-xs sm:text-sm font-semibold  transition transform duration-300" onclick={addFeature}>Agregar</button>
              </div>
              {#if featuresList.length}
                <ul class="mt-2 space-y-2">
                  {#each featuresList as item, i}
                    <li class="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <input class="md:col-span-2 px-3 py-2 rounded-lg bg-neutral-900 text-sm" bind:value={featuresList[i].feature} />
                      <input type="number" class="px-3 py-2 rounded-lg bg-neutral-900 text-sm" bind:value={featuresList[i].order} />
                      <label class="flex items-center gap-2 text-sm">
                        <input type="checkbox" bind:checked={featuresList[i].highlighted} />
                        Destacado
                      </label>
                      <button class="px-2 py-1 rounded-lg bg-red-500/80 text-white text-xs hover:bg-red-500" onclick={() => removeFeature(i)}>Eliminar</button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>
          <div class="flex justify-between items-center gap-3 pt-2">
            <div class="text-sm">
              {#if isSaving}
                <span class="text-muted-foreground">Guardando...</span>
              {:else if saveOk}
                <span class="text-emerald-400">Cambios guardados</span>
              {:else if saveErr}
                <span class="text-rose-400">{saveErr}</span>
              {/if}
            </div>
            <div class="flex gap-3">
              <button class="px-4 py-2 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700" onclick={() => props.onClose?.()}>Cerrar</button>
              <button class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors" disabled={isSaving} onclick={save}>{isSaving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        {:else}
          <div class="text-muted-foreground">Sin datos de plan.</div>
        {/if}
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
