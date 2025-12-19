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
  const props = $props<{ open: boolean; onClose: () => void; onCreate?: (plan: Omit<Plan, 'id' | 'clients' | 'revenue'>) => void }>();
  let working = $state<Omit<Plan, 'id' | 'clients' | 'revenue'>>({
    name: '',
    price: 0,
    download: 0,
    upload: 0,
    status: 'active',
    description: '',
    features: [],
    symmetric: false,
    setup_price: 0,
    billing_cycle: 'monthly',
    category: 'residential',
    priority: 1,
    is_featured: false,
    mikrotik_queue_name: '',
    download_limit: '',
    upload_limit: '',
    burst_limit: ''
  });
  let featuresList = $state<FeatureItem[]>([]);
  let newFeature = $state('');
  function nextOrder() {
    return featuresList.length ? Math.max(...featuresList.map(x => x.order ?? 0)) + 1 : 0;
  }
  function addFeature() {
    const f = newFeature.trim();
    if (!f) return;
    featuresList.push({ feature: f, order: nextOrder(), highlighted: false });
    newFeature = '';
  }
  function removeFeature(i: number) {
    if (i >= 0 && i < featuresList.length) featuresList.splice(i, 1);
  }
  let isCreating = $state(false);
  let createOk = $state(false);
  let createErr = $state<string | null>(null);
  async function create() {
    createOk = false;
    createErr = null;
    isCreating = true;
    try {
      working.features = [...featuresList];
      if (props.onCreate) await props.onCreate(working);
      createOk = true;
    } catch (e) {
      createErr = 'Error al crear';
    } finally {
      isCreating = false;
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
          <Dialog.Title class="text-lg font-bold">Crear Plan</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="planName" class="text-xs text-muted-foreground">Nombre</label>
            <input id="planName" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.name} />
          </div>
          <div>
            <label for="planPrice" class="text-xs text-muted-foreground">Precio mensual</label>
            <input id="planPrice" type="number" step="0.01" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.price} />
          </div>
          <div>
            <label for="downloadSpeed" class="text-xs text-muted-foreground">Velocidad descarga</label>
            <input id="downloadSpeed" type="number" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.download} />
          </div>
          <div>
            <label for="uploadSpeed" class="text-xs text-muted-foreground">Velocidad subida</label>
            <input id="uploadSpeed" type="number" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.upload} />
          </div>
          <div class="md:col-span-2">
            <label class="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" bind:checked={working.symmetric} />


              Simétrico
            </label>
          </div>
          <div>
            <label for="planStatus" class="text-xs text-muted-foreground">Estado</label>
            <select id="planStatus" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.status}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label for="planDescription" class="text-xs text-muted-foreground">Descripción</label>
            <textarea id="planDescription" rows="3" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.description}></textarea>
          </div>
          <div>
            <label for="setupPrice" class="text-xs text-muted-foreground">Precio instalación</label>
            <input id="setupPrice" type="number" step="0.01" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.setup_price} />
          </div>
          <div>
            <label for="billingCycle" class="text-xs text-muted-foreground">Ciclo de facturación</label>
            <select id="billingCycle" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.billing_cycle}>
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>

          </div>
          <div>
            <label for="categorySelect" class="text-xs text-muted-foreground">Categoría</label>
            <select id="categorySelect" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.category}>
              <option value="residential">Residencial</option>
              <option value="business">Empresarial</option>
            </select>
          </div>
          <div>
            <label for="priorityInput" class="text-xs text-muted-foreground">Prioridad</label>
            <input id="priorityInput" type="number" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.priority} />
          </div>
          <div class="md:col-span-2">
            <label class="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" bind:checked={working.is_featured} />
              Destacado
            </label>
          </div>
          <div class="md:col-span-2">
            <label for="mikrotikQueueName" class="text-xs text-muted-foreground">Nombre de cola MikroTik</label>
            <input id="mikrotikQueueName" class="w-full px-3 py-2 rounded-lg bg-neutral-900" bind:value={working.mikrotik_queue_name} />
          </div>
          <div>
            <label for="downloadLimit" class="text-xs text-muted-foreground">Límite descarga</label>
            <input id="downloadLimit" class="w-full px-3 py-2 rounded-lg bg-neutral-900" placeholder="ej: 50M" bind:value={working.download_limit} />
          </div>
          <div>
            <label for="uploadLimit" class="text-xs text-muted-foreground">Límite subida</label>
            <input id="uploadLimit" class="w-full px-3 py-2 rounded-lg bg-neutral-900" placeholder="ej: 10M" bind:value={working.upload_limit} />
          </div>
          <div class="md:col-span-2">
            <label for="burstLimit" class="text-xs text-muted-foreground">Burst limit</label>
            <input id="burstLimit" class="w-full px-3 py-2 rounded-lg bg-neutral-900" placeholder="ej: 75M/15M" bind:value={working.burst_limit} />
          </div>
          <div class="md:col-span-2">
            <label for="featureInput" class="text-xs text-muted-foreground">Características</label>
            <div class="flex gap-2">
              <input id="featureInput" class="flex-1 px-3 py-2 rounded-lg bg-neutral-900" placeholder="Agregar característica" bind:value={newFeature} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') addFeature() }} />
              <button class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors" onclick={addFeature}>Agregar</button>
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
            {#if isCreating}
              <span class="text-muted-foreground">Creando...</span>
            {:else if createOk}
              <span class="text-emerald-400">Plan creado</span>
            {:else if createErr}
              <span class="text-rose-400">{createErr}</span>
            {/if}
          </div>
          <div class="flex gap-3">
            <button class="px-4 py-2 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700" onclick={() => props.onClose?.()}>Cerrar</button>
            <button class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors" disabled={isCreating} onclick={create}>{isCreating ? 'Creando...' : 'Crear'}</button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
