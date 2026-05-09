<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { fade, scale } from 'svelte/transition';
  import Encabezado from "$lib/components/Encabezado.svelte";
  import Chart from "$lib/components/Chart.svelte";
  import TopUsuarios from "$lib/components/TopUsuarios.svelte";
  import EstadoRouter from "$lib/components/EstadoRouter.svelte";
  import KpiCards from "$lib/components/KpiCards.svelte";
  import CapacidadISP from "$lib/components/CapacidadISP.svelte";
  import { Loader2, CheckCircleIcon, XCircleIcon } from "@lucide/svelte";
  import { appState } from '$lib/stores/app.svelte';
  import { API_BASE } from '$lib/config';
  import type { CapacitySnapshot } from '$lib/types/capacity';
  import {
    DASHBOARD_LOAD_CONTEXT,
    fetchJsonWithRetry,
    readCookieCache,
    writeCookieCache,
    type DashboardLoadBus,
    type DashboardLoadStatus,
    type FetchErrorDetails,
  } from '$lib/utils/hybrid-cache';

  // Tipos e interfaces
  type DashboardCacheData = {
    mikrotikStats: {
      online: boolean;
      activeClients: number;
      totalClients: number;
      cpuLoad: string;
      uptime: string;
    };
    capacity: CapacitySnapshot;
    clients: {
      active: number;
      suspended: number;
      limited: number;
      total: number;
    };
    invoicesSummary: {
      pending_count: number;
      pending_amount: number;
      overdue_count: number;
      invoiced_this_month: number;
      paid_this_month: number;
    };
  };

  // Estado
  let isSidebarOpen = $state(false);
  let isNotificationsOpen = $state(false);

  let clients = $state({ active: 0, suspended: 0, limited: 0, total: 0 });
  let invoicesSummary = $state({
    pending_count: 0,
    pending_amount: 0,
    overdue_count: 0,
    invoiced_this_month: 0,
    paid_this_month: 0,
  });

  let capacity = $state<CapacitySnapshot>({
    total_down_mbps: 0,
    used_down_mbps: 0,
    remaining_down_mbps: 0,
    percent_used: 0,
    warn_80: false,
    reuse_ratio: 1
  });

  let mikrotikStats = $state({
    online: false,
    activeClients: 0,
    totalClients: 0, // Este valor podría venir de la DB o ser fijo por ahora
    cpuLoad: "0%",
    uptime: "Offline"
  });

  const DASHBOARD_FULL_STATS_COOKIE = 'ispga_dash_full_stats_v1';
  let requestStates = $state<Record<string, { status: DashboardLoadStatus; endpoint: string; message?: string; updatedAt: number }>>({});
  let indicatorVisible = $state(false);
  let indicatorHideTimer: ReturnType<typeof setTimeout> | null = null;

  const overallStatus = $derived.by((): DashboardLoadStatus => {
    const items = Object.values(requestStates);
    if (items.some(i => i.status === 'loading')) return 'loading';
    if (items.some(i => i.status === 'error')) return 'error';
    if (items.some(i => i.status === 'success')) return 'success';
    return 'idle';
  });

  const overallMessage = $derived.by((): string => {
    const errors = Object.entries(requestStates)
      .filter(([, v]) => v.status === 'error')
      .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0));
    const first = errors[0]?.[1];
    if (!first) return '';
    return first.message || 'No se pudo actualizar el dashboard';
  });

  function setRequestState(key: string, next: { status: DashboardLoadStatus; endpoint: string; message?: string }) {
    requestStates[key] = { ...next, updatedAt: Date.now() };
    requestStates = { ...requestStates };
  }

  const loadBus: DashboardLoadBus = {
    start: (key, endpoint) => setRequestState(key, { status: 'loading', endpoint }),
    success: (key) => {
      const prev = requestStates[key];
      setRequestState(key, { status: 'success', endpoint: prev?.endpoint || '' });
    },
    error: (key, details) => setRequestState(key, { status: 'error', endpoint: details.endpoint, message: details.message })
  };

  setContext(DASHBOARD_LOAD_CONTEXT, loadBus);

  $effect(() => {
    if (indicatorHideTimer) {
      clearTimeout(indicatorHideTimer);
      indicatorHideTimer = null;
    }

    if (overallStatus === 'idle') {
      indicatorVisible = false;
      return;
    }

    indicatorVisible = true;

    if (overallStatus === 'success') {
      indicatorHideTimer = setTimeout(() => {
        if (overallStatus === 'success') indicatorVisible = false;
      }, 2500);
    }

    if (overallStatus === 'error') {
      indicatorHideTimer = setTimeout(() => {
        if (overallStatus === 'error') indicatorVisible = false;
      }, 9000);
    }

    return () => {
      if (indicatorHideTimer) {
        clearTimeout(indicatorHideTimer);
        indicatorHideTimer = null;
      }
    };
  });

  function toggleSidebar() {
    appState.toggleSidebar();
  }
  
  function toggleNotifications() {
    appState.toggleNotifications();
  }

  function applyDashboardData(next: DashboardCacheData) {
    mikrotikStats.online = Boolean(next.mikrotikStats.online);
    mikrotikStats.cpuLoad = String(next.mikrotikStats.cpuLoad || '0%');
    mikrotikStats.uptime = String(next.mikrotikStats.uptime || 'Offline');
    mikrotikStats.activeClients = Number(next.mikrotikStats.activeClients || 0);
    mikrotikStats.totalClients = Number(next.mikrotikStats.totalClients || 0);

    capacity.total_down_mbps = Number(next.capacity.total_down_mbps || 0);
    capacity.used_down_mbps = Number(next.capacity.used_down_mbps || 0);
    capacity.remaining_down_mbps = Number(next.capacity.remaining_down_mbps || 0);
    capacity.percent_used = Number(next.capacity.percent_used || 0);
    capacity.total_up_mbps = Number((next.capacity as any).total_up_mbps || 0);
    capacity.used_up_mbps = Number((next.capacity as any).used_up_mbps || 0);
    capacity.remaining_up_mbps = Number((next.capacity as any).remaining_up_mbps || 0);
    capacity.percent_used_down = Number((next.capacity as any).percent_used_down || 0);
    capacity.percent_used_up = Number((next.capacity as any).percent_used_up || 0);
    capacity.warn_80 = Boolean(next.capacity.warn_80);
    capacity.reuse_ratio = Number(next.capacity.reuse_ratio || 1) || 1;

    if (next.clients) {
      clients.active    = Number(next.clients.active    ?? 0);
      clients.suspended = Number(next.clients.suspended ?? 0);
      clients.limited   = Number(next.clients.limited   ?? 0);
      clients.total     = Number(next.clients.total     ?? 0);
    }
    if (next.invoicesSummary) {
      invoicesSummary.pending_count       = Number(next.invoicesSummary.pending_count       ?? 0);
      invoicesSummary.pending_amount      = Number(next.invoicesSummary.pending_amount      ?? 0);
      invoicesSummary.overdue_count       = Number(next.invoicesSummary.overdue_count       ?? 0);
      invoicesSummary.invoiced_this_month = Number(next.invoicesSummary.invoiced_this_month ?? 0);
      invoicesSummary.paid_this_month     = Number(next.invoicesSummary.paid_this_month     ?? 0);
    }
  }

  let dashboardAbort: AbortController | null = null;
  let dashboardInFlight = false;

  async function loadDashboardData() {
    if (dashboardInFlight) return;
    dashboardInFlight = true;

    const endpoint = `${API_BASE}/admin/dashboard/full-stats`;
    loadBus.start('full-stats', endpoint);

    if (dashboardAbort) dashboardAbort.abort();
    dashboardAbort = new AbortController();

    try {
        const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const data = await fetchJsonWithRetry<any>(
          endpoint,
          { headers, signal: dashboardAbort.signal },
          {
            attempts: 3,
            baseDelayMs: 700,
            onRetry: (d) => {
              loadBus.start('full-stats', endpoint);
              setRequestState('full-stats', { status: 'loading', endpoint, message: `Reintentando (${d.attempt + 1}/${d.attempts})...` });
            }
          }
        );

        const next: DashboardCacheData = {
          mikrotikStats: {
            online: Boolean(data?.mikrotik?.online ?? false),
            cpuLoad: String(data?.mikrotik?.cpu_load ?? '0%'),
            uptime: String(data?.mikrotik?.uptime ?? 'Offline'),
            activeClients: Number(data?.mikrotik?.active_clients ?? 0),
            totalClients: Number(data?.mikrotik?.total_clients ?? 0),
          },
          capacity: {
            total_down_mbps: Number(data?.capacity?.total_down_mbps ?? 0),
            used_down_mbps: Number(data?.capacity?.used_down_mbps ?? 0),
            remaining_down_mbps: Number(data?.capacity?.remaining_down_mbps ?? 0),
            percent_used: Number(data?.capacity?.percent_used ?? 0),
            total_up_mbps: Number(data?.capacity?.total_up_mbps ?? 0),
            used_up_mbps: Number(data?.capacity?.used_up_mbps ?? 0),
            remaining_up_mbps: Number(data?.capacity?.remaining_up_mbps ?? 0),
            percent_used_down: Number(data?.capacity?.percent_used_down ?? 0),
            percent_used_up: Number(data?.capacity?.percent_used_up ?? 0),
            warn_80: Boolean(data?.capacity?.warn_80 ?? false),
            reuse_ratio: Number(data?.capacity?.reuse_ratio ?? 1) || 1
          },
          clients: {
            active:    Number(data?.clients?.active    ?? 0),
            suspended: Number(data?.clients?.suspended ?? 0),
            limited:   Number(data?.clients?.limited   ?? 0),
            total:     Number(data?.clients?.total     ?? 0),
          },
          invoicesSummary: {
            pending_count:        Number(data?.invoices_summary?.pending_count        ?? 0),
            pending_amount:       Number(data?.invoices_summary?.pending_amount       ?? 0),
            overdue_count:        Number(data?.invoices_summary?.overdue_count        ?? 0),
            invoiced_this_month:  Number(data?.invoices_summary?.invoiced_this_month  ?? 0),
            paid_this_month:      Number(data?.invoices_summary?.paid_this_month      ?? 0),
          },
        };

        applyDashboardData(next);
        writeCookieCache(DASHBOARD_FULL_STATS_COOKIE, next, { maxAgeSeconds: 60 * 60 * 24 });
        loadBus.success('full-stats');
    } catch (e: any) {
        if (e?.name === 'AbortError') return;
        const err = e as FetchErrorDetails;
        const message = typeof err?.message === 'string' && err.message ? err.message : 'No se pudo actualizar el dashboard';
        loadBus.error('full-stats', { endpoint, status: err?.status, message });
        mikrotikStats.online = false;
    }
    finally {
      dashboardInFlight = false;
    }
  }

  onMount(() => {
    const cached = readCookieCache<DashboardCacheData>(DASHBOARD_FULL_STATS_COOKIE);
    if (cached?.data) {
      applyDashboardData(cached.data);
    }

    loadDashboardData();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(loadDashboardData, 30000);
    return () => {
      clearInterval(interval);
      if (dashboardAbort) dashboardAbort.abort();
    };
  });


</script>

<div class="flex h-screen w-full bg-[#09090f] text-gray-100 overflow-hidden">

  <main class="flex-1 overflow-y-auto">
    <Encabezado {toggleSidebar} {toggleNotifications} notificationCount={3} />

    <div class="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto w-full">

      <!-- KPI Cards -->
      <KpiCards
        activeClients={clients.active}
        suspendedClients={clients.suspended}
        invoicedThisMonth={invoicesSummary.invoiced_this_month}
        paidThisMonth={invoicesSummary.paid_this_month}
        pendingCount={invoicesSummary.pending_count}
        pendingAmount={invoicesSummary.pending_amount}
      />

      <!-- Gráfico financiero -->
      <Chart />

      <!-- TopUsuarios + columna derecha -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <TopUsuarios />
        <div class="flex flex-col gap-4">
          <EstadoRouter
            online={mikrotikStats.online}
            activeClients={mikrotikStats.activeClients}
            totalClients={mikrotikStats.totalClients}
            cpuLoad={mikrotikStats.cpuLoad}
            uptime={mikrotikStats.uptime}
          />
          <CapacidadISP {capacity} />
        </div>
      </div>

    </div>
  </main>

  {#if indicatorVisible}
    <div class="fixed bottom-4 right-4 z-50" in:scale={{ duration: 140, start: 0.9 }} out:fade={{ duration: 140 }}>
      <button
        class="flex items-center gap-2 bg-[#141414] border border-gray-800 text-gray-200 px-3 py-2 rounded-lg shadow-lg max-w-[320px]"
        onclick={() => overallStatus === 'error' && loadDashboardData()}
      >
        {#if overallStatus === 'loading'}
          <Loader2 class="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
        {:else if overallStatus === 'success'}
          <CheckCircleIcon class="w-4 h-4 text-green-500 flex-shrink-0" />
        {:else if overallStatus === 'error'}
          <XCircleIcon class="w-4 h-4 text-red-500 flex-shrink-0" />
          <span class="text-xs truncate">{overallMessage}</span>
        {/if}
      </button>
    </div>
  {/if}
</div>
