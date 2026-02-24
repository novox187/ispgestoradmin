<script lang="ts">
  import { onMount } from "svelte";
  import Encabezado from "$lib/components/Encabezado.svelte";
  import MetricasCarta from "$lib/components/MetricasCarta.svelte";
  import Chart from "$lib/components/Chart.svelte";
  import TopUsuarios from "$lib/components/TopUsuarios.svelte";
  import EstadoRouter from "$lib/components/EstadoRouter.svelte";
  import { Users } from "@lucide/svelte";
  import { appState } from '$lib/stores/app.svelte';
  import { API_BASE } from '$lib/config';

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

  function toggleSidebar() {
    appState.toggleSidebar();
  }
  
  function toggleNotifications() {
    appState.toggleNotifications();
  }

  async function loadDashboardData() {
    try {
        const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        
        const res = await fetch(`${API_BASE}/admin/dashboard/full-stats`, { headers });
        if (res.ok) {
            const data = await res.json();
            
            // Actualizar estadísticas de usuarios
            stats.active_users = data.active_users;
            stats.users_with_debt = data.users_with_debt;
            stats.inactive_users = data.inactive_users;

            // Actualizar estadísticas de MikroTik
            if (data.mikrotik) {
                mikrotikStats.online = data.mikrotik.online;
                mikrotikStats.cpuLoad = data.mikrotik.cpu_load;
                mikrotikStats.uptime = data.mikrotik.uptime;
                mikrotikStats.activeClients = data.mikrotik.active_clients;
                mikrotikStats.totalClients = data.mikrotik.total_clients;
            }
        } else {
             console.error('Error fetching dashboard stats:', res.status, res.statusText);
        }
    } catch (e) {
        console.error('Error loading dashboard data:', e);
        mikrotikStats.online = false;
    }
  }

  onMount(() => {
    loadDashboardData();
    
    // Actualizar cada 30 segundos
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
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
</div>
