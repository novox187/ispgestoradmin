<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import {
    XIcon, Wifi, Users, RefreshCw, Zap, Star,
    Calendar, CheckCircle2, Circle, ArrowDown, ArrowUp,
    Activity, Package, BadgePercent, Building2
  } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { API_BASE } from '$lib/config';
  import type { CapacitySnapshot } from '$lib/types/capacity';
  import { formatMbps, parsePlanRatioDivisor } from '$lib/utils/plan-calculations';

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

  const props = $props<{ open: boolean; plan: Plan | null; onClose: () => void; capacity?: CapacitySnapshot | null }>();

  // ── IVA ───────────────────────────────────────────────────────────────────
  let taxRate = $state(0.15);

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
    } catch { /* fallback al 15% */ }
  });

  const priceBase = $derived(props.plan ? Number(props.plan.price) : 0);
  const ivaAmount = $derived(Math.round(priceBase * taxRate * 100) / 100);
  const totalWithIva = $derived(Math.round((priceBase + ivaAmount) * 100) / 100);

  // ── Disponibilidad de clientes (basado en ratio del plan) ────────────────
  // ratio 1:N → cada cliente recibe download/N Mbps garantizados
  // → caben N clientes máx. manteniendo garantía (download / (download/N) = N)
  const planRatioDivisor = $derived(parsePlanRatioDivisor(props.plan?.ratio));

  const guaranteedPerClient = $derived.by(() => {
    if (!props.plan || planRatioDivisor <= 0) return 0;
    return Math.round((Number(props.plan.download) / planRatioDivisor) * 100) / 100;
  });

  const maxClientsForPlan = $derived(planRatioDivisor > 1 ? planRatioDivisor : null);

  const estimatedSlots = $derived.by(() => {
    if (maxClientsForPlan === null || !props.plan) return null;
    return Math.max(0, maxClientsForPlan - Number(props.plan.clients));
  });

  const clientOccupancyPct = $derived.by(() => {
    if (!maxClientsForPlan || maxClientsForPlan <= 0 || !props.plan) return 0;
    return Math.min(100, Math.round((Number(props.plan.clients) / maxClientsForPlan) * 100));
  });

  // ── Consumo en tiempo real (MikroTik) ────────────────────────────────────
  type QueueStats = { name: string; rateDown: number; rateUp: number; bytesDown: number; bytesUp: number };
  let queueData = $state<QueueStats | null>(null);
  let queueLoading = $state(false);
  let queueError = $state<string | null>(null);
  let queueLastFetched = $state<Date | null>(null);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function parseRateMbps(raw: string): number {
    const n = parseInt(String(raw ?? '0').split('/')[0] ?? '0', 10) || 0;
    return Math.round((n * 8 / 1_000_000) * 100) / 100;
  }

  function parseRateUpMbps(raw: string): number {
    const parts = String(raw ?? '0/0').split('/');
    const n = parseInt(parts[1] ?? '0', 10) || 0;
    return Math.round((n * 8 / 1_000_000) * 100) / 100;
  }

  function parseBytes(raw: string): { down: number; up: number } {
    const parts = String(raw ?? '0/0').split('/');
    return { down: parseInt(parts[0] ?? '0', 10) || 0, up: parseInt(parts[1] ?? '0', 10) || 0 };
  }

  function formatBytes(b: number): string {
    if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(2)} GB`;
    if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${b} B`;
  }

  async function fetchQueueData() {
    const queueName = props.plan?.mikrotik_queue_name;
    if (!queueName) return;
    queueLoading = true;
    queueError = null;
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
      const res = await fetch(`${API_BASE}/mikrotik/queue-list`, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (!res.ok) { queueError = `Error HTTP ${res.status}`; return; }
      const json = await res.json();
      const queues: any[] = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
      const found = queues.find((q: any) => q.name === queueName);
      if (found) {
        const bytes = parseBytes(found.bytes ?? '0/0');
        queueData = {
          name: found.name,
          rateDown: parseRateMbps(found.rate ?? '0/0'),
          rateUp: parseRateUpMbps(found.rate ?? '0/0'),
          bytesDown: bytes.down,
          bytesUp: bytes.up,
        };
      } else {
        queueData = null;
        queueError = `Cola "${queueName}" no encontrada`;
      }
      queueLastFetched = new Date();
    } catch (e: any) {
      queueError = e?.message ?? 'Error al conectar con MikroTik';
    } finally {
      queueLoading = false;
    }
  }

  $effect(() => {
    if (props.open && props.plan?.mikrotik_queue_name) {
      fetchQueueData();
      pollInterval = setInterval(fetchQueueData, 30_000);
    } else {
      queueData = null;
      queueError = null;
      queueLoading = false;
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }
    return () => { if (pollInterval) { clearInterval(pollInterval); pollInterval = null; } };
  });

  // ── Features ordenadas y agrupadas ───────────────────────────────────────
  const sortedFeatures = $derived(
    [...(props.plan?.features ?? [])].sort((a, b) => a.order - b.order)
  );
  const highlightedFeatures = $derived(sortedFeatures.filter(f => f.highlighted));
  const regularFeatures = $derived(sortedFeatures.filter(f => !f.highlighted));

  // ── Helpers ───────────────────────────────────────────────────────────────
  function billingLabel(c?: string): string {
    return ({ monthly: 'Mensual', quarterly: 'Trimestral', yearly: 'Anual' } as Record<string, string>)[c ?? ''] ?? (c ?? '—');
  }

  function categoryLabel(c?: string): string {
    return ({ residential: 'Residencial', business: 'Empresarial' } as Record<string, string>)[c ?? ''] ?? (c ?? '—');
  }

  const animation = 'transition transition-discrete opacity-0 translate-y-[80px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[80px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} closeOnEscape closeOnInteractOutside onOpenChange={() => props.onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class={"card bg-surface-100-900 w-[600px] max-w-[95vw] max-h-[88vh] overflow-auto p-0 shadow-xl rounded-2xl " + animation}>

        {#if props.plan}
          <!-- ── Encabezado ───────────────────────────────────────────────── -->
          <header class="sticky top-0 z-10 bg-surface-100-900 flex justify-between items-start p-5 pb-4 border-b border-neutral-800">
            <div class="flex items-start gap-3">
              <div class="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 mt-0.5">
                <Wifi class="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <Dialog.Title class="text-lg font-bold leading-tight">{props.plan.name}</Dialog.Title>
                  {#if props.plan.is_featured}
                    <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                      <Star class="w-3 h-3" /> Destacado
                    </span>
                  {/if}
                  <span class={"px-2 py-0.5 rounded-full text-[10px] font-medium border " + (props.plan.status === 'active' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400")}>
                    {props.plan.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                  {#if props.plan.category}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
                      {categoryLabel(props.plan.category)}
                    </span>
                  {/if}
                </div>
                {#if props.plan.description}
                  <p class="text-xs text-muted-foreground mt-1 leading-relaxed">{props.plan.description}</p>
                {/if}
              </div>
            </div>
            <Dialog.CloseTrigger class="btn-icon hover:preset-tonal shrink-0 ml-2">
              <XIcon class="size-4" />
            </Dialog.CloseTrigger>
          </header>

          <div class="p-5 space-y-4">

            <!-- ── Desglose de precios ──────────────────────────────────── -->
            <section class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-3">
                <BadgePercent class="w-4 h-4 text-muted-foreground" />
                <span class="text-sm font-semibold">Precios</span>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between items-center">
                  <span class="text-sm text-muted-foreground">Precio base <span class="text-xs">(sin IVA)</span></span>
                  <span class="text-sm font-mono font-medium">${priceBase.toFixed(2)}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm text-muted-foreground">IVA ({(taxRate * 100).toFixed(0)}%)</span>
                  <span class="text-sm font-mono text-amber-400">+ ${ivaAmount.toFixed(2)}</span>
                </div>
                <div class="flex justify-between items-center border-t border-neutral-700 pt-2 mt-1">
                  <span class="text-sm font-semibold">Total con IVA</span>
                  <span class="text-lg font-bold font-mono text-emerald-300">${totalWithIva.toFixed(2)}</span>
                </div>
                {#if props.plan.setup_price && props.plan.setup_price > 0}
                  <div class="flex justify-between items-center border-t border-neutral-800 pt-2 mt-1">
                    <span class="text-xs text-muted-foreground">Instalación (pago único)</span>
                    <span class="text-sm font-mono text-neutral-300">${Number(props.plan.setup_price).toFixed(2)}</span>
                  </div>
                {:else}
                  <div class="flex justify-between items-center border-t border-neutral-800 pt-2 mt-1">
                    <span class="text-xs text-muted-foreground">Instalación</span>
                    <span class="text-xs text-emerald-400">Gratis</span>
                  </div>
                {/if}
              </div>
            </section>

            <!-- ── Velocidad y límites ──────────────────────────────────── -->
            <section class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-3">
                <Zap class="w-4 h-4 text-muted-foreground" />
                <span class="text-sm font-semibold">Velocidad y límites</span>
              </div>
              <div class="grid grid-cols-2 gap-x-6 gap-y-2">
                <div class="flex justify-between items-center col-span-2 sm:col-span-1">
                  <span class="text-xs text-muted-foreground flex items-center gap-1"><ArrowDown class="w-3 h-3 text-blue-400" /> Descarga máx.</span>
                  <span class="text-sm font-medium">{formatMbps(Number(props.plan.download))}</span>
                </div>
                <div class="flex justify-between items-center col-span-2 sm:col-span-1">
                  <span class="text-xs text-muted-foreground flex items-center gap-1"><ArrowUp class="w-3 h-3 text-purple-400" /> Subida máx.</span>
                  <span class="text-sm font-medium">{formatMbps(Number(props.plan.upload))}</span>
                </div>
                {#if props.plan.ratio}
                  <div class="flex justify-between items-center col-span-2 sm:col-span-1">
                    <span class="text-xs text-muted-foreground">Ratio contención</span>
                    <span class="text-sm font-medium">{props.plan.ratio}</span>
                  </div>
                {/if}
                <div class="flex justify-between items-center col-span-2 sm:col-span-1">
                  <span class="text-xs text-muted-foreground">Simétrico</span>
                  <span class="text-sm font-medium">{props.plan.symmetric ? 'Sí' : 'No'}</span>
                </div>
                {#if props.plan.download_limit}
                  <div class="flex justify-between items-center col-span-2 sm:col-span-1">
                    <span class="text-xs text-muted-foreground">Límite descarga (queue)</span>
                    <span class="text-sm font-mono">{props.plan.download_limit}</span>
                  </div>
                {/if}
                {#if props.plan.upload_limit}
                  <div class="flex justify-between items-center col-span-2 sm:col-span-1">
                    <span class="text-xs text-muted-foreground">Límite subida (queue)</span>
                    <span class="text-sm font-mono">{props.plan.upload_limit}</span>
                  </div>
                {/if}
                {#if props.plan.burst_limit}
                  <div class="flex justify-between items-center col-span-2">
                    <span class="text-xs text-muted-foreground">Burst limit</span>
                    <span class="text-sm font-mono">{props.plan.burst_limit}</span>
                  </div>
                {/if}
                {#if props.plan.mikrotik_queue_name}
                  <div class="flex justify-between items-center col-span-2">
                    <span class="text-xs text-muted-foreground">Cola MikroTik</span>
                    <span class="text-xs font-mono text-neutral-400">{props.plan.mikrotik_queue_name}</span>
                  </div>
                {/if}
              </div>
            </section>

            <!-- ── Clientes y disponibilidad ───────────────────────────── -->
            <section class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-3">
                <Users class="w-4 h-4 text-muted-foreground" />
                <span class="text-sm font-semibold">Clientes y disponibilidad</span>
              </div>
              <div class="grid grid-cols-2 gap-3 mb-3">
                <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
                  <div class="text-2xl font-bold">{props.plan.clients}</div>
                  <div class="text-xs text-muted-foreground mt-0.5">Clientes activos</div>
                  {#if maxClientsForPlan !== null}
                    <div class="text-[10px] text-muted-foreground mt-1">de {maxClientsForPlan} máx.</div>
                  {/if}
                </div>
                <div class="bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-center">
                  {#if estimatedSlots !== null}
                    <div class="text-2xl font-bold {estimatedSlots === 0 ? 'text-rose-400' : estimatedSlots <= 5 ? 'text-amber-400' : 'text-emerald-400'}">
                      {estimatedSlots}
                    </div>
                    <div class="text-xs text-muted-foreground mt-0.5">Espacios disponibles</div>
                  {:else}
                    <div class="text-xl font-bold text-neutral-500">—</div>
                    <div class="text-xs text-muted-foreground mt-0.5">Sin ratio definido</div>
                  {/if}
                </div>
              </div>
              {#if maxClientsForPlan !== null}
                <div>
                  <div class="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>Ocupación del plan ({props.plan.clients}/{maxClientsForPlan} clientes)</span>
                    <span>{clientOccupancyPct}%</span>
                  </div>
                  <div class="h-2 w-full bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      class="h-2 rounded-full transition-all duration-500 {clientOccupancyPct >= 90 ? 'bg-rose-500' : clientOccupancyPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}"
                      style="width: {clientOccupancyPct}%"
                    ></div>
                  </div>
                  <p class="text-[10px] text-muted-foreground mt-1">
                    Ratio {props.plan.ratio ?? '—'} · {guaranteedPerClient} Mbps garantizados por cliente · Capacidad total: {formatMbps(Number(props.plan.download))}
                  </p>
                </div>
              {/if}
            </section>

            <!-- ── Consumo en tiempo real ───────────────────────────────── -->
            {#if props.plan.mikrotik_queue_name}
              <section class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <Activity class="w-4 h-4 text-muted-foreground" />
                    <span class="text-sm font-semibold">Consumo en tiempo real</span>
                    {#if !queueLoading && queueLastFetched}
                      <span class="flex items-center gap-1 text-[10px] text-emerald-500">
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        EN VIVO
                      </span>
                    {/if}
                  </div>
                  <button
                    class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-muted-foreground transition-colors disabled:opacity-50"
                    disabled={queueLoading}
                    onclick={fetchQueueData}
                  >
                    <RefreshCw class="w-3 h-3 {queueLoading ? 'animate-spin' : ''}" />
                    {queueLoading ? 'Actualizando…' : 'Actualizar'}
                  </button>
                </div>

                {#if queueLoading && !queueData}
                  <div class="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <RefreshCw class="w-4 h-4 animate-spin" />
                    Obteniendo datos de MikroTik…
                  </div>
                {:else if queueError}
                  <p class="text-xs text-rose-400">{queueError}</p>
                {:else if queueData}
                  <div class="grid grid-cols-2 gap-3">
                    <div class="bg-neutral-900 border border-blue-500/20 rounded-lg p-3">
                      <div class="flex items-center gap-1.5 text-[10px] text-blue-400 mb-1">
                        <ArrowDown class="w-3 h-3" /> Descarga actual
                      </div>
                      <div class="text-xl font-bold">{queueData.rateDown.toFixed(2)} <span class="text-xs font-normal text-muted-foreground">Mbps</span></div>
                      <div class="text-[10px] text-muted-foreground mt-1">Total: {formatBytes(queueData.bytesDown)}</div>
                    </div>
                    <div class="bg-neutral-900 border border-purple-500/20 rounded-lg p-3">
                      <div class="flex items-center gap-1.5 text-[10px] text-purple-400 mb-1">
                        <ArrowUp class="w-3 h-3" /> Subida actual
                      </div>
                      <div class="text-xl font-bold">{queueData.rateUp.toFixed(2)} <span class="text-xs font-normal text-muted-foreground">Mbps</span></div>
                      <div class="text-[10px] text-muted-foreground mt-1">Total: {formatBytes(queueData.bytesUp)}</div>
                    </div>
                  </div>
                  {#if queueLastFetched}
                    <p class="text-[10px] text-muted-foreground mt-2">
                      Actualizado: {queueLastFetched.toLocaleTimeString('es-ES')} · Se refresca cada 30 s
                    </p>
                  {/if}
                {:else}
                  <p class="text-xs text-muted-foreground">Sin datos de cola disponibles aún.</p>
                {/if}
              </section>
            {/if}

            <!-- ── Facturación e información comercial ─────────────────── -->
            <section class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
              <div class="flex items-center gap-2 mb-3">
                <Calendar class="w-4 h-4 text-muted-foreground" />
                <span class="text-sm font-semibold">Facturación e información</span>
              </div>
              <div class="space-y-2">
                <div class="flex justify-between items-center">
                  <span class="text-xs text-muted-foreground">Ciclo de facturación</span>
                  <span class="text-sm font-medium">{billingLabel(props.plan.billing_cycle)}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-xs text-muted-foreground">Prioridad de cola</span>
                  <span class="text-sm font-medium">{props.plan.priority ?? '—'} <span class="text-xs text-muted-foreground">(1 = mayor prioridad)</span></span>
                </div>
                <div class="flex justify-between items-center border-t border-neutral-800 pt-2 mt-1">
                  <span class="text-xs text-muted-foreground">Ingresos mensuales totales</span>
                  <span class="text-sm font-semibold font-mono">
                    ${props.plan.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </section>

            <!-- ── Características del plan ────────────────────────────── -->
            {#if props.plan.features && props.plan.features.length}
              <section class="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
                <div class="flex items-center gap-2 mb-3">
                  <Package class="w-4 h-4 text-muted-foreground" />
                  <span class="text-sm font-semibold">Características del plan</span>
                </div>
                {#if highlightedFeatures.length}
                  <div class="mb-3">
                    <div class="text-[10px] text-emerald-500 font-medium uppercase tracking-wider mb-1.5">Destacadas</div>
                    <ul class="space-y-1.5">
                      {#each highlightedFeatures as f}
                        <li class="flex items-start gap-2 text-sm text-emerald-300">
                          <CheckCircle2 class="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                          <span>{f.feature}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
                {#if regularFeatures.length}
                  <div>
                    {#if highlightedFeatures.length}
                      <div class="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">Incluidas</div>
                    {/if}
                    <ul class="space-y-1.5">
                      {#each regularFeatures as f}
                        <li class="flex items-start gap-2 text-sm text-neutral-300">
                          <Circle class="w-3 h-3 mt-1 shrink-0 text-neutral-600 fill-neutral-600" />
                          <span>{f.feature}</span>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}
              </section>
            {/if}

          </div>

          <div class="sticky bottom-0 bg-surface-100-900 border-t border-neutral-800 flex justify-end p-4">
            <button class="px-4 py-2 rounded-lg bg-neutral-800 text-white hover:bg-neutral-700 text-sm transition-colors" onclick={() => props.onClose?.()}>
              Cerrar
            </button>
          </div>

        {:else}
          <div class="p-8 text-center text-muted-foreground text-sm">Sin datos de plan.</div>
        {/if}

      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
