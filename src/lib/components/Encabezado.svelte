<script>
  // Tu código Svelte existente
  let { toggleSidebar, toggleNotifications, notificationCount = 2 } = $props();

  // Obtener la ruta actual (pathname)
  // Asume que este componente se renderiza en un entorno de navegador.
  // Si estás usando un router específico (ej: SvelteKit), lo ideal es importar su store de ruta.
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : "/";

  // Función para determinar el título
  /**
   * @param {string} path
   */
  function getHeaderTitle(path) {
    // Eliminar barras iniciales o finales para aislar el nombre de la ruta
    let routeName = path.replace(/^\/+|\/+$/g, "");

    // Si la ruta está vacía (es la raíz '/'), retornar 'DASHBOARD'
    if (routeName === "") {
      return "DASHBOARD";
    }

    // Si no es la raíz, convertir la primera parte de la ruta a mayúsculas
    // Ejemplo: /users/123 -> USERS
    // Ejemplo: /settings -> SETTINGS
    const firstSegment = routeName.split("/")[0];
    return firstSegment.toUpperCase();
  }

  // Calcular el título reactivamente
  // En un componente Svelte real, podrías querer hacer que `currentPath` sea reactivo
  // importándolo de un store de router, pero para el ejemplo simple es suficiente.
  const headerTitle = getHeaderTitle(currentPath);
</script>

<header class="bg-[#0d0d0d] border-b border-gray-800 px-4 md:px-6 py-4">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button
        class="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
        onclick={toggleSidebar}
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

      <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
        <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
          <path
            fill-rule="evenodd"
            d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
      <h1 class="text-lg md:text-2xl font-bold tracking-wider">
        {headerTitle}
      </h1>
    </div>
    <div class="flex items-center gap-3">
      <!--             <div class="text-gray-400 text-xs md:text-sm font-mono hidden sm:block">
                ultima actualizacion  12:05
            </div>
 -->
      <button
        class="xl:hidden relative p-2 hover:bg-gray-800 rounded-lg transition-colors"
        onclick={toggleNotifications}
        aria-label="Toggle notifications"
      >
        <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path
            d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"
          />
        </svg>
        {#if notificationCount > 0}
          <span
            class="absolute top-1 right-1 w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center"
          >
            {notificationCount}
          </span>
        {/if}
      </button>
    </div>
  </div>
</header>
