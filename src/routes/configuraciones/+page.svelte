<script lang="ts">
  import { Settings, Database, Shield, Bell } from '@lucide/svelte';
  import Encabezado from '$lib/components/Encabezado.svelte';
  import { appState } from '$lib/stores/app.svelte';

  function toggleSidebar() {
    appState.toggleSidebar();
  }
</script>

<main class="flex-1 overflow-y-auto bg-[#09090f] text-gray-100">
  <Encabezado {toggleSidebar} />

<div class="container mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
      <Settings class="w-8 h-8 text-blue-600 dark:text-blue-400" />
      Configuraciones del Sistema
    </h1>
    <p class="text-gray-600 dark:text-gray-400 mt-2">Administra las preferencias generales y herramientas del sistema.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <!-- Tarjeta de Importación de Datos -->
    <a href="/configuraciones/importacion" class="group block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-500/50">
      <div class="flex items-center justify-between mb-4">
        <div class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
          <Database class="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <span class="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">Herramienta</span>
      </div>
      <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Importación de Datos</h3>
      <p class="text-gray-500 dark:text-gray-400 text-sm">
        Gestiona la carga masiva de información mediante plantillas Excel. Importa clientes, planes y facturas.
      </p>
    </a>

    <!-- Placeholder para otras configuraciones -->
    <div class="group block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 opacity-60 cursor-not-allowed">
      <div class="flex items-center justify-between mb-4">
        <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Shield class="w-6 h-6 text-gray-400 dark:text-gray-500" />
        </div>
        <span class="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-full">Próximamente</span>
      </div>
      <h3 class="text-lg font-semibold text-gray-400 dark:text-gray-500 mb-2">Seguridad y Permisos</h3>
      <p class="text-gray-400 dark:text-gray-500 text-sm">
        Configura roles, permisos de usuarios y políticas de acceso al sistema.
      </p>
    </div>

    <div class="group block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 opacity-60 cursor-not-allowed">
      <div class="flex items-center justify-between mb-4">
        <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <Bell class="w-6 h-6 text-gray-400 dark:text-gray-500" />
        </div>
        <span class="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-full">Próximamente</span>
      </div>
      <h3 class="text-lg font-semibold text-gray-400 dark:text-gray-500 mb-2">Notificaciones</h3>
      <p class="text-gray-400 dark:text-gray-500 text-sm">
        Personaliza las plantillas de correo y alertas del sistema.
      </p>
    </div>
  </div>
</div>
</main>
