<script lang="ts">
  // Tu código Svelte existente
  const props = $props<{
    toggleSidebar: () => void;
    toggleNotifications?: () => void;
    notificationCount?: number;
  }>();

  // Obtener la ruta actual (pathname)
  // Asume que este componente se renderiza en un entorno de navegador.
  // Si estás usando un router específico (ej: SvelteKit), lo ideal es importar su store de ruta.
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/";

  // Función para determinar el título
  /**
   * @param {string} path
   */
  const segmentLabels: Record<string, string> = {
    '': 'DASHBOARD',
    'clientes': 'CLIENTES',
    'planes': 'PLANES',
    'facturas': 'FACTURACIÓN',
    'proveedores': 'PROVEEDORES',
    'mikrotik': 'MIKROTIK',
    'usuarios': 'USUARIOS',
    'configuraciones': 'CONFIGURACIONES',
    'perfil': 'MI PERFIL',
  };

  function getHeaderTitle(path: string) {
    const routeName = path.replace(/^\/+|\/+$/g, '');
    if (routeName === '') return 'DASHBOARD';
    const firstSegment = routeName.split('/')[0];
    return segmentLabels[firstSegment] ?? firstSegment.toUpperCase();
  }

  // Calcular el título reactivamente
  // En un componente Svelte real, podrías querer hacer que `currentPath` sea reactivo
  // importándolo de un store de router, pero para el ejemplo simple es suficiente.
  const headerTitle = getHeaderTitle(currentPath);
</script>

<header class="bg-[#0b0b0d] border-b border-gray-800 px-4 md:px-6 py-4">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button
        class="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
        onclick={props.toggleSidebar}
        aria-label="Toggle menu"
      >
        <svg
          class="w-6 h-6 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <h1 class="text-lg md:text-2xl font-bold tracking-wider">
        {headerTitle}
      </h1>
    </div>
    <div class="flex items-center gap-3">
      <!--             <div class="text-gray-400 text-xs md:text-sm font-mono hidden sm:block">
                ultima actualizacion  12:05
            </div>
 -->
    </div>
  </div>
</header>
