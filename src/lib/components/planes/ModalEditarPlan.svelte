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
    status: 'active' | 'inactive';
    clients: number;
    revenue: number;
    description?: string;
    features?: FeatureItem[];
  };
  const props = $props<{ open: boolean; plan: Plan | null; onClose: () => void; onSave?: (plan: Plan) => void }>();
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
  function save() {
    if (working) {
      working.features = [...featuresList];
      if (props.onSave) props.onSave(working);
    }
    props.onClose?.();
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
              <input class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.name} />
            </div>
            <div>
              <label for="plan-price" class="text-xs text-muted-foreground">Precio</label>
              <input type="number" step="0.01" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.price} />
            </div>
            <div>
              <label for="download" class="text-xs text-muted-foreground">Velocidad descarga</label>
              <input type="number" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.download} />
            </div>
            <div>
              <label for="upload" class="text-xs text-muted-foreground">Velocidad subida</label>
              <input type="number" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.upload} />
            </div>
            <div class="md:col-span-2">
              <label for="plan-description" class="text-xs text-muted-foreground">Descripción</label>
              <textarea rows="3" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.description}></textarea>
            </div>
            <div class="md:col-span-2">
              <label for="features-input" class="text-xs text-muted-foreground">Características</label>
              <div class="flex gap-2">
                <input class="flex-1 px-3 py-2 rounded-lg bg-neutral-900" placeholder="Agregar característica" bind:value={newFeature} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') addFeature() }} />
                <button class="px-3 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-400" onclick={addFeature}>Agregar</button>
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
          <div class="flex justify-end gap-3 pt-2">
            <button class="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-400" onclick={save}>Guardar</button>
          </div>
        {:else}
          <div class="text-muted-foreground">Sin datos de plan.</div>
        {/if}
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
