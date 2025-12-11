<script lang="ts">
  import { onMount } from "svelte";
  import Menu from "$lib/components/Menu.svelte";
  import Encabezado from "$lib/components/Encabezado.svelte";
  import MetricasCarta from "$lib/components/MetricasCarta.svelte";
  import Chart from "$lib/components/Chart.svelte";
  import TopUsuarios from "$lib/components/TopUsuarios.svelte";
  import EstadoRouter from "$lib/components/EstadoRouter.svelte";
  import Menuderecha from "$lib/components/Menuderecha.svelte";
  import { Users } from "@lucide/svelte";

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

  function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
  }
  
  function toggleNotifications() {
    isNotificationsOpen = !isNotificationsOpen;
  }

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
    console.log("Período seleccionado:", period);
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
          value="150"
          icon={Users}
          tipo="activo"
        />
        <MetricasCarta 
          title="USUARIOS CON DEUDA"
          value="5"
          icon={Users}
          tipo="deuda"
        />
        <MetricasCarta
          title="USUARIOS INACTIVOS"
          value="15"
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
        <EstadoRouter />
      </div>
    </div>
  </main>
</div>
