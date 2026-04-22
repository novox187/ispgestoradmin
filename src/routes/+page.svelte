<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { fade, scale } from 'svelte/transition';
  import Encabezado from "$lib/components/Encabezado.svelte";
  import MetricasCarta from "$lib/components/MetricasCarta.svelte";
  import Chart from "$lib/components/Chart.svelte";
  import TopUsuarios from "$lib/components/TopUsuarios.svelte";
  import EstadoRouter from "$lib/components/EstadoRouter.svelte";
  import { Users, Loader2, CheckCircleIcon, XCircleIcon } from "@lucide/svelte";
  import { appState } from '$lib/stores/app.svelte';
  import { API_BASE } from '$lib/config';
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
  type Period = "WEEK" | "MONTH" | "YEAR";

  interface ChartDataset {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension: number;
    fill?: boolean;
  }

  interface ChartData {
    labels: string[];
    datasets: ChartDataset[];
  }

  type DashboardCacheData = {
    stats: {
      active_users: number;
      users_with_debt: number;
      inactive_users: number;
    };
    mikrotikStats: {
      online: boolean;
      activeClients: number;
      totalClients: number;
      cpuLoad: string;
      uptime: string;
    };
  };

  // Estado
  let selectedPeriod: Period = $state("WEEK");
  let isSidebarOpen = $state(false);
  let isNotificationsOpen = $state(false);
  let stats = $state({
    active_users: 0,
    users_with_debt: 0,
    inactive_users: 0
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
    stats.active_users = Number(next.stats.active_users || 0);
    stats.users_with_debt = Number(next.stats.users_with_debt || 0);
    stats.inactive_users = Number(next.stats.inactive_users || 0);

    mikrotikStats.online = Boolean(next.mikrotikStats.online);
    mikrotikStats.cpuLoad = String(next.mikrotikStats.cpuLoad || '0%');
    mikrotikStats.uptime = String(next.mikrotikStats.uptime || 'Offline');
    mikrotikStats.activeClients = Number(next.mikrotikStats.activeClients || 0);
    mikrotikStats.totalClients = Number(next.mikrotikStats.totalClients || 0);
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
          stats: {
            active_users: Number(data?.active_users ?? 0),
            users_with_debt: Number(data?.users_with_debt ?? 0),
            inactive_users: Number(data?.inactive_users ?? 0),
          },
          mikrotikStats: {
            online: Boolean(data?.mikrotik?.online ?? false),
            cpuLoad: String(data?.mikrotik?.cpu_load ?? '0%'),
            uptime: String(data?.mikrotik?.uptime ?? 'Offline'),
            activeClients: Number(data?.mikrotik?.active_clients ?? 0),
            totalClients: Number(data?.mikrotik?.total_clients ?? 0),
          }
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

  // Datos del gráfico
  const chartData: ChartData = {
    labels: ["Ene", "Feb", "Mar", "Abr", "May", "Jun"],
    datasets: [
      {
        label: "Gastos",
        data: [30, 40, 35, 50, 49, 60],
        borderColor: "#10B981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Ventas",
        data: [20, 25, 30, 35, 40, 45],
        borderColor: "#3B82F6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Café",
        data: [15, 20, 25, 30, 35, 40],
        borderColor: "#F59E0B",
        backgroundColor: "rgba(245, 158, 11, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  // Manejar cambio de período
  function handlePeriodChange(period: Period): void {
    selectedPeriod = period;
    // Aquí podrías agregar lógica para actualizar los datos según el período
  }
</script>

<div class="flex h-screen w-full bg-[#0f0f0f] text-gray-100 overflow-hidden">

  <main class="flex-1 overflow-y-auto">
    <Encabezado {toggleSidebar} {toggleNotifications} notificationCount={3} />

    <div class="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto w-full">

      <!-- Metric Cards -->
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
        >
          <MetricasCarta
            title="USUARIOS ACTIVOS"
            value={stats.active_users}
            icon={Users}
            tipo="activo"
          />
          <MetricasCarta 
            title="USUARIOS CON DEUDA"
            value={stats.users_with_debt}
            icon={Users}
            tipo="deuda"
          />
          <MetricasCarta
            title="USUARIOS INACTIVOS"
            value={stats.inactive_users}
            icon={Users}
            tipo="inactivo"
          />
        </div>

      <!-- Chart Section -->
        <div class="">
          <Chart />
        </div>

      <!-- Bottom Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <TopUsuarios />
          <EstadoRouter 
              online={mikrotikStats.online}
              activeClients={mikrotikStats.activeClients}
              totalClients={mikrotikStats.totalClients}
              cpuLoad={mikrotikStats.cpuLoad}
              uptime={mikrotikStats.uptime}
          />
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
