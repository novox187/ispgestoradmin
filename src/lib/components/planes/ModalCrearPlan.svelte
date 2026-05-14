<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { XIcon } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { API_BASE } from '$lib/config';
  import type { CapacitySnapshot } from '$lib/types/capacity';
  import { formatMbps, pct, limitStringFromMbps, ratioDivisorFromMaxAndGuaranteed, ratioStringFromDivisor } from '$lib/utils/plan-calculations';
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
  const props = $props<{ open: boolean; onClose: () => void; onCreate?: (plan: Omit<Plan, 'id' | 'clients' | 'revenue'>) => void; capacity?: CapacitySnapshot | null }>();
  let working = $state<Omit<Plan, 'id' | 'clients' | 'revenue'>>({
    name: '',
    price: 0,
    download: 0,
    upload: 0,
    ratio: '1:1',
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
  let taxRate = $state(0.15);
  let priceIncludesIva = $state(false);

  onMount(async () => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
      const res = await fetch(`${API_BASE}/admin/settings?module=facturacion`, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const json = await res.json();
        const rows: any[] = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        const row = rows.find((r: any) => r.key === 'tax_rate');
        if (row) {
          const parsed = parseFloat(row.value);
          if (Number.isFinite(parsed) && parsed > 0) taxRate = parsed;
        }
      }
    } catch { /* fallback al 15% por defecto */ }
  });

  let isCreating = $state(false);
  let createOk = $state(false);
  let createErr = $state<string | null>(null);
  const nameTrim = $derived(working.name.trim());
  let guaranteedTargetDown = $state<number>(0);
  const downloadValid = $derived(Number.isFinite(working.download) && Number(working.download) > 0);
  const uploadValid = $derived(Number.isFinite(working.upload) && Number(working.upload) > 0);
  const priceValid = $derived(Number.isFinite(working.price) && Number(working.price) >= 0);

  const guaranteedTargetDownValid = $derived.by(() => {
    const d = Number(working.download);
    const g = Number(guaranteedTargetDown);
    if (!Number.isFinite(d) || d <= 0) return false;
    if (!Number.isFinite(g) || g <= 0) return false;
    return g <= d;
  });

  const ratioDivisor = $derived.by(() => {
    return ratioDivisorFromMaxAndGuaranteed(Number(working.download), Number(guaranteedTargetDown));
  });

  const computedRatio = $derived(ratioStringFromDivisor(ratioDivisor));

  const computedDownloadLimit = $derived.by(() => {
    return limitStringFromMbps(Number(working.download));
  });
  const computedUploadLimit = $derived.by(() => {
    return limitStringFromMbps(Number(working.upload));
  });

  const computedGuaranteedDown = $derived.by(() => {
    const d = Number(working.download);
    if (!Number.isFinite(d) || d <= 0) return 0;
    return Math.max(0, d / ratioDivisor);
  });
  const computedGuaranteedUp = $derived.by(() => {
    const u = Number(working.upload);
    if (!Number.isFinite(u) || u <= 0) return 0;
    return Math.max(0, u / ratioDivisor);
  });

  const ivaPreviewValid = $derived(priceValid && Number(working.price) > 0);
  const computedNetPrice = $derived(
    ivaPreviewValid
      ? (priceIncludesIva ? Number(working.price) / (1 + taxRate) : Number(working.price))
      : 0
  );
  const computedIvaAmount = $derived(
    ivaPreviewValid ? Math.round(computedNetPrice * taxRate * 100) / 100 : 0
  );
  const computedTotalWithIva = $derived(
    ivaPreviewValid ? Math.round((computedNetPrice + computedIvaAmount) * 100) / 100 : 0
  );

  const canCreate = $derived.by(() => {
    return nameTrim.length > 0 && downloadValid && uploadValid && guaranteedTargetDownValid && priceValid;
  });

  const totalDown = $derived(Number(props.capacity?.total_down_mbps ?? 0));
  const totalUp = $derived(Number(props.capacity?.total_up_mbps ?? 0));
  const remainingPlansDown = $derived(Number(props.capacity?.plans_remaining_down_mbps ?? props.capacity?.remaining_down_mbps ?? 0));
  const remainingPlansUp = $derived(Number(props.capacity?.plans_remaining_up_mbps ?? props.capacity?.remaining_up_mbps ?? 0));

  const exceedsPhysicalDown = $derived.by(() => totalDown > 0 && Number(working.download) > totalDown);
  const exceedsPhysicalUp = $derived.by(() => totalUp > 0 && Number(working.upload) > totalUp);
  const exceedsAvailableDown = $derived.by(() => totalDown > 0 && Number(working.download) > remainingPlansDown);
  const exceedsAvailableUp = $derived.by(() => totalUp > 0 && Number(working.upload) > remainingPlansUp);
  const capacityError = $derived.by(() => {
    if (exceedsAvailableDown) return `Capacidad insuficiente: tiene ${Math.round(remainingPlansDown)} megas disponibles de ${Math.round(totalDown)} totales`;
    if (exceedsAvailableUp) return `Capacidad insuficiente: tiene ${Math.round(remainingPlansUp)} megas disponibles de ${Math.round(totalUp)} totales`;
    return null;
  });
  const canCreateWithCapacity = $derived.by(() => canCreate && !exceedsPhysicalDown && !exceedsPhysicalUp && !exceedsAvailableDown && !exceedsAvailableUp);

  const planPctDown = $derived.by(() => pct(computedGuaranteedDown, Number(working.download)));
  const planPctUp = $derived.by(() => pct(computedGuaranteedUp, Number(working.upload)));

  function inputClass(invalid: boolean): string {
    return `w-full px-3 py-2 rounded-lg bg-neutral-900 border ${invalid ? 'border-red-500/40' : 'border-neutral-800'} focus:outline-none focus:ring-0`;
  }

  async function create() {
    if (isCreating) return;
    createOk = false;
    createErr = null;
    if (!canCreateWithCapacity) {
      createErr = capacityError || 'Completa los campos requeridos';
      return;
    }
    isCreating = true;
    try {
      working.features = [...featuresList];
      working.ratio = computedRatio;
      working.download_limit = computedDownloadLimit;
      working.upload_limit = computedUploadLimit;
      const priceToSend = (priceIncludesIva && ivaPreviewValid)
        ? Math.round(computedNetPrice * 100) / 100
        : working.price;
      if (props.onCreate) await props.onCreate({ ...working, price: priceToSend });
      createOk = true;
    } catch (e) {
      const msg = String((e as any)?.message ?? '');
      createErr = msg.includes('PLAN_SPEED_EXCEEDS_ISP_CAPACITY')
        ? 'La velocidad del plan supera la capacidad física del ISP'
        : msg.includes('ISP_CAPACITY_EXHAUSTED')
        ? (capacityError || 'Capacidad insuficiente')
        : 'Error al crear';
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

        <div class="space-y-4">
          <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div class="text-sm font-semibold text-foreground">Datos del plan</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <label for="planName" class="text-xs text-muted-foreground">Nombre</label>
                  <span class="text-rose-400 text-[10px]">Requerido</span>
                </div>
                <input id="planName" class={inputClass(nameTrim.length === 0)} placeholder="Ej: Residencial 50M" bind:value={working.name} />
                <div class="text-[11px] text-muted-foreground mt-1">Nombre visible en el listado de planes.</div>
                {#if nameTrim.length === 0}
                  <div class="text-[11px] text-rose-400 mt-1">El nombre es obligatorio.</div>
                {/if}
              </div>
              <div>
                <label for="planStatus" class="text-xs text-muted-foreground">Estado</label>
                <select id="planStatus" class={inputClass(false)} bind:value={working.status}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
                <div class="text-[11px] text-muted-foreground mt-1">Controla si se puede vender o asignar.</div>
              </div>
              <div class="md:col-span-2">
                <label for="planDescription" class="text-xs text-muted-foreground">Descripción</label>
                <textarea id="planDescription" rows="3" class={inputClass(false)} bind:value={working.description} placeholder="Opcional."></textarea>
                <div class="text-[11px] text-muted-foreground mt-1">Texto descriptivo para el equipo.</div>
              </div>
            </div>
          </div>

          <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div class="text-sm font-semibold text-foreground">Velocidad y ratio</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <label for="downloadSpeed" class="text-xs text-muted-foreground">Velocidad descarga (Mbps)</label>
                  <span class="text-rose-400 text-[10px]">Requerido</span>
                </div>
                <input id="downloadSpeed" type="number" class={inputClass(!downloadValid || exceedsPhysicalDown || exceedsAvailableDown)} bind:value={working.download} min="1" max={totalDown > 0 ? totalDown : undefined} />
                <div class="text-[11px] text-muted-foreground mt-1">Techo del plan (max-limit) por cliente.</div>
                {#if !downloadValid}
                  <div class="text-[11px] text-rose-400 mt-1">Debe ser mayor a 0.</div>
                {:else if exceedsPhysicalDown}
                  <div class="text-[11px] text-rose-400 mt-1">No puede superar la capacidad física ({formatMbps(totalDown)}).</div>
                {:else if exceedsAvailableDown}
                  <div class="text-[11px] text-rose-400 mt-1">{capacityError}</div>
                {/if}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <label for="uploadSpeed" class="text-xs text-muted-foreground">Velocidad subida (Mbps)</label>
                  <span class="text-rose-400 text-[10px]">Requerido</span>
                </div>
                <input id="uploadSpeed" type="number" class={inputClass(!uploadValid || exceedsPhysicalUp || exceedsAvailableUp)} bind:value={working.upload} min="1" max={totalUp > 0 ? totalUp : undefined} />
                <div class="text-[11px] text-muted-foreground mt-1">Techo del plan (max-limit) por cliente.</div>
                {#if !uploadValid}
                  <div class="text-[11px] text-rose-400 mt-1">Debe ser mayor a 0.</div>
                {:else if exceedsPhysicalUp}
                  <div class="text-[11px] text-rose-400 mt-1">No puede superar la capacidad física ({formatMbps(totalUp)}).</div>
                {:else if exceedsAvailableUp}
                  <div class="text-[11px] text-rose-400 mt-1">{capacityError}</div>
                {/if}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <label for="guaranteedDown" class="text-xs text-muted-foreground">Megas garantizadas (Mbps)</label>
                  <span class="text-rose-400 text-[10px]">Requerido</span>
                </div>
                <input id="guaranteedDown" type="number" class={inputClass(!guaranteedTargetDownValid)} bind:value={guaranteedTargetDown} min="1" max={downloadValid ? Number(working.download) : undefined} />
                <div class="text-[11px] text-muted-foreground mt-1">Garantizado por cliente (limit-at). El ratio se calcula automáticamente.</div>
                {#if !guaranteedTargetDownValid}
                  <div class="text-[11px] text-rose-400 mt-1">Debe ser mayor a 0 y no superar la descarga del plan.</div>
                {/if}
              </div>
              <div class="bg-neutral-900/50 border border-neutral-800 rounded-xl p-3">
                <div class="text-xs text-muted-foreground mb-2">Vista previa (por cliente)</div>
                <div class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <span class="text-foreground">Max descarga</span>
                    <span class="text-foreground font-semibold">{Number(working.download) || 0} Mbps</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-foreground">Max subida</span>
                    <span class="text-foreground font-semibold">{Number(working.upload) || 0} Mbps</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-foreground">Ratio</span>
                    <span class="text-foreground font-semibold">{computedRatio}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-foreground">Garantizado</span>
                    <span class="text-emerald-300 font-semibold">{computedGuaranteedDown.toFixed(2).replace(/\.00$/, '')}↓ / {computedGuaranteedUp.toFixed(2).replace(/\.00$/, '')}↑ Mbps</span>
                  </div>
                </div>
                <div class="mt-2 text-[11px] text-muted-foreground">Se calcula ratio = max-limit / megas garantizadas.</div>
              </div>
              <div class="md:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-xl p-3">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="text-xs text-muted-foreground">Asignación del plan (según max-limit)</div>
                    <div class="text-sm text-foreground font-semibold">
                      {formatMbps(Number(working.download))} ↓ · {formatMbps(Number(working.upload))} ↑
                    </div>
                    <div class="text-[11px] text-muted-foreground mt-1">
                      Garantizado por cliente: {formatMbps(computedGuaranteedDown)} ↓ · {formatMbps(computedGuaranteedUp)} ↑ · Ratio {computedRatio}
                    </div>
                  </div>
                  <div class="text-[11px] text-muted-foreground">
                    Uso del plan: {planPctDown.toFixed(1)}% ↓ · {planPctUp.toFixed(1)}% ↑
                  </div>
                </div>

                <div class="mt-3 space-y-2">
                  <div>
                    <div class="flex justify-between text-[11px] text-muted-foreground">
                      <span>Descarga (garantizado / max)</span>
                      <span>{planPctDown.toFixed(1)}%</span>
                    </div>
                    <div class="h-2 w-full bg-[#0f0f0f] rounded">
                      <div class="h-2 rounded bg-blue-500" style={`width: ${planPctDown}%`}></div>
                    </div>
                  </div>
                  <div>
                    <div class="flex justify-between text-[11px] text-muted-foreground">
                      <span>Subida (garantizado / max)</span>
                      <span>{planPctUp.toFixed(1)}%</span>
                    </div>
                    <div class="h-2 w-full bg-[#0f0f0f] rounded">
                      <div class="h-2 rounded bg-purple-500" style={`width: ${planPctUp}%`}></div>
                    </div>
                  </div>
                </div>

                {#if props.capacity}
                  <div class="mt-3 pt-3 border-t border-neutral-800">
                    <div class="flex items-start justify-between gap-4">
                      <div>
                        <div class="text-xs text-muted-foreground">Capacidad disponible para planes</div>
                        <div class="text-[11px] text-muted-foreground mt-1">
                          Disponible: {formatMbps(remainingPlansDown)} ↓ · {formatMbps(remainingPlansUp)} ↑
                        </div>
                      </div>
                    </div>
                    {#if capacityError}
                      <div class="text-[11px] text-rose-400 mt-2">{capacityError}</div>
                    {/if}
                  </div>
                {/if}
              </div>
              <div class="md:col-span-2">
                <label class="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" bind:checked={working.symmetric} />
                  Simétrico
                </label>
              </div>
            </div>
          </div>

          <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div class="text-sm font-semibold text-foreground">Facturación</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div class="flex items-center gap-2">
                  <label for="planPrice" class="text-xs text-muted-foreground">Precio mensual</label>
                  <span class="text-rose-400 text-[10px]">Requerido</span>
                </div>
                <input id="planPrice" type="number" step="0.01" class={inputClass(!priceValid)} bind:value={working.price} min="0" />
                <label class="flex items-center gap-2 mt-2 cursor-pointer w-fit">
                  <input type="checkbox" bind:checked={priceIncludesIva} />
                  <span class="text-xs text-muted-foreground">Con IVA{taxRate > 0 ? ` (${(taxRate * 100).toFixed(0)}%)` : ''}</span>
                </label>
                <div class="text-[11px] text-muted-foreground mt-1">
                  {priceIncludesIva ? 'El precio ingresado ya incluye IVA.' : 'Precio base del plan sin IVA.'}
                </div>
              </div>
              <div>
                <label for="setupPrice" class="text-xs text-muted-foreground">Precio instalación</label>
                <input id="setupPrice" type="number" step="0.01" class={inputClass(false)} bind:value={working.setup_price} min="0" />
                <div class="text-[11px] text-muted-foreground mt-1">Opcional, se cobra una sola vez.</div>
              </div>
              {#if ivaPreviewValid}
                <div class="md:col-span-2 bg-neutral-900/50 border border-neutral-800 rounded-xl p-3">
                  <div class="text-xs text-muted-foreground mb-2">Desglose de IVA ({(taxRate * 100).toFixed(0)}%)</div>
                  <div class="space-y-1 text-sm">
                    <div class="flex justify-between">
                      <span class="text-foreground">Precio neto (sin IVA)</span>
                      <span class="text-foreground font-semibold">{computedNetPrice.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-foreground">IVA ({(taxRate * 100).toFixed(0)}%)</span>
                      <span class="text-amber-400 font-semibold">+ {computedIvaAmount.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between border-t border-neutral-700 pt-1 mt-1">
                      <span class="text-foreground font-semibold">Total con IVA</span>
                      <span class="text-emerald-300 font-semibold">{computedTotalWithIva.toFixed(2)}</span>
                    </div>
                  </div>
                  {#if priceIncludesIva}
                    <div class="mt-2 text-[11px] text-blue-400">Se guardará el precio neto sin IVA: {computedNetPrice.toFixed(2)}</div>
                  {/if}
                </div>
              {/if}
              <div>
                <label for="billingCycle" class="text-xs text-muted-foreground">Ciclo de facturación</label>
                <select id="billingCycle" class={inputClass(false)} bind:value={working.billing_cycle}>
                  <option value="monthly">Mensual</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div>
                <label for="categorySelect" class="text-xs text-muted-foreground">Categoría</label>
                <select id="categorySelect" class={inputClass(false)} bind:value={working.category}>
                  <option value="residential">Residencial</option>
                  <option value="business">Empresarial</option>
                </select>
              </div>
              <div class="md:col-span-2">
                <label class="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" bind:checked={working.is_featured} />
                  Destacado
                </label>
              </div>
            </div>
          </div>

          <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div class="text-sm font-semibold text-foreground">MikroTik</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="priorityInput" class="text-xs text-muted-foreground">Prioridad</label>
                <input id="priorityInput" type="number" class={inputClass(false)} bind:value={working.priority} min="1" max="8" />
                <div class="text-[11px] text-muted-foreground mt-1">1 = más prioridad, 8 = menos prioridad.</div>
              </div>
              <div>
                <label for="mikrotikQueueName" class="text-xs text-muted-foreground">Nombre de cola (opcional)</label>
                <input id="mikrotikQueueName" class={inputClass(false)} bind:value={working.mikrotik_queue_name} placeholder="Dejar vacío para autogenerar" />
                <div class="text-[11px] text-muted-foreground mt-1">Si no se define, el sistema crea uno basado en el plan.</div>
              </div>
              <div>
                <label for="downloadLimit" class="text-xs text-muted-foreground">Límite descarga (calculado)</label>
                <input id="downloadLimit" class={inputClass(false)} value={computedDownloadLimit} disabled />
                <div class="text-[11px] text-muted-foreground mt-1">Se completa automáticamente con la velocidad del plan.</div>
              </div>
              <div>
                <label for="uploadLimit" class="text-xs text-muted-foreground">Límite subida (calculado)</label>
                <input id="uploadLimit" class={inputClass(false)} value={computedUploadLimit} disabled />
                <div class="text-[11px] text-muted-foreground mt-1">Se completa automáticamente con la velocidad del plan.</div>
              </div>
              <div class="md:col-span-2">
                <label for="burstLimit" class="text-xs text-muted-foreground">Burst limit</label>
                <input id="burstLimit" class={inputClass(false)} placeholder="Ej: 75M/15M" bind:value={working.burst_limit} />
                <div class="text-[11px] text-muted-foreground mt-1">Opcional. Acelera temporalmente según configuración.</div>
              </div>
            </div>
          </div>

          <div class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div class="text-sm font-semibold text-foreground">Características</div>
            <div class="space-y-2">
              <div class="flex gap-2">
                <input id="featureInput" class={inputClass(false) + ' flex-1'} placeholder="Agregar característica" bind:value={newFeature} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') addFeature() }} />
                <button class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-xs sm:text-sm font-semibold transition-colors" onclick={addFeature}>Agregar</button>
              </div>
              {#if featuresList.length}
                <ul class="mt-2 space-y-2">
                  {#each featuresList as item, i}
                    <li class="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <input class={inputClass(false) + ' md:col-span-2 text-sm'} bind:value={featuresList[i].feature} />
                      <input type="number" class={inputClass(false) + ' text-sm'} bind:value={featuresList[i].order} />
                      <label class="flex items-center gap-2 text-sm text-muted-foreground">
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
            <button class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed" disabled={isCreating || !canCreateWithCapacity} onclick={create}>{isCreating ? 'Creando...' : 'Crear'}</button>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
