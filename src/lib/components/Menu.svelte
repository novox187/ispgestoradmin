<script>
  // @ts-ignore
  import { LayoutDashboard, FlaskConical, Smartphone, Shield, Mail, Settings, Lock, User, MoreVertical, Users, Wifi, CreditCard, Zap, Bell, UserCog } from '@lucide/svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { API_BASE } from '$lib/config';
  
  let { isOpen = $bindable(false) } = $props();
  
  const menuItems = [
    { label: 'DASHBOARD', icon: LayoutDashboard, path: '/' },
    { label: 'CLIENTES', icon: Users, path: '/clientes' },
    { label: 'PLANES', icon: Wifi, path: '/planes' },
    { label: 'FACTURACION', icon: CreditCard, path: '/facturas' },
    { label: 'MIKROTIK', icon: Settings, path: '/mikrotik', locked: false },
    { label: 'USUARIOS', icon: UserCog, path: '/usuarios', locked: false },
  ];
  
  function closeSidebar() {
    isOpen = false;
  }
  
  /** @param {string} path */
  function isActive(path) {
    const current = $page.url.pathname;
    return path === '/' ? current === '/' : current.startsWith(path);
  }

  let userMenuOpen = $state(false);
  let loggingOut = $state(false);
  async function handleLogout() {
    if (loggingOut) return;
    loggingOut = true;
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
    try {
      if (token) {
        await fetch(`${API_BASE}/employee/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        }).catch(() => {});
      }
    } finally {
      try {
        localStorage.removeItem('employee_token');
        localStorage.removeItem('employee_role');
        localStorage.removeItem('employee_nombre');
      } catch {}
      goto('/login', { replaceState: true });
      loggingOut = false;
    }
  }
</script>

<!-- Overlay para móvil -->
{#if isOpen}
  <div 
    class="fixed inset-0 bg-black/50 z-40 lg:hidden"
    onclick={closeSidebar}
    onkeydown={(e) => e.key === 'Enter' && closeSidebar()}
    role="button"
    tabindex="0"
    aria-label="Close sidebar"
  ></div>
{/if}

<aside class="
  w-64 bg-[#0d0d0d] border-r border-neutral-800 flex flex-col p-5
  fixed lg:static inset-y-0 left-0 z-50
  transform transition-transform duration-300 ease-in-out
  {isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
">
  <!-- Logo Section -->
  <div class="p-6 border-b border-neutral-800">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-white rounded flex items-center justify-center">
        <User class="w-6 h-6 text-black" />
      </div>
      <div>
        <div class="text-white font-bold text-lg tracking-widest">NOVATACH</div>
        <div class="text-gray-500 text-xs font-mono uppercase">Conexión donde no llega nadie</div>
      </div>
    </div>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 p-4 overflow-y-auto">
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-3 px-3">
        <div class="w-2 h-2 bg-blue-500 rounded-sm"></div>
        <span class="text-blue-500 text-xs font-mono font-bold tracking-wide">TOOLS</span>
      </div>
      <ul class="space-y-0.5">
        {#each menuItems as item}
          <li>
            {#if item.locked}
              <button
                class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-mono transition-colors text-gray-600"
                aria-label="{item.label}"
                disabled
              >
                <item.icon class="w-4 h-4" />
                <span class="flex-1 text-left font-medium tracking-wide">{item.label}</span>
                <Lock class="w-3.5 h-3.5" />
              </button>
            {:else}
              <a
                href={item.path}
                class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-mono transition-colors {isActive(item.path) ? 'bg-gray-800/50 text-white border-l-2 border-blue-500' : 'text-gray-300 hover:text-white hover:bg-gray-800/30'}"
                aria-label="{item.label}"
                onclick={() => closeSidebar()}
              >
                <item.icon class="w-4 h-4" />
                <span class="flex-1 text-left font-medium tracking-wide">{item.label}</span>
              </a>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </nav>

  <!-- User Profile -->
  <div class="p-4 border-t border-neutral-800">
    <div class="flex items-center gap-2 mb-3 px-3">
      <div class="w-2 h-2 bg-blue-500 rounded-sm"></div>
      <span class="text-blue-500 text-xs font-mono font-bold tracking-wide">USER</span>
    </div>
    <div class="relative flex items-center gap-3 px-3 py-2">
      <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
        F
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-white font-bold text-sm">FERNANDO</div>
        <div class="text-gray-500 text-xs font-mono truncate">KZENBOUH.JOYCO_STUDIO</div>
      </div>
      <button class="text-gray-400 hover:text-white flex-shrink-0" aria-label="User menu" onclick={() => (userMenuOpen = !userMenuOpen)}>
        <MoreVertical class="w-4 h-4" />
      </button>
      {#if userMenuOpen}
        <div class="absolute right-3 bottom-12 w-44 bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg z-10">
          <button type="button" class="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-200 hover:bg-gray-800" disabled>
            Perfil
          </button>
          <button type="button" class="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-60" onclick={handleLogout} disabled={loggingOut} aria-busy={loggingOut}>
            {#if loggingOut}
              Cerrando...
            {:else}
              Cerrar sesión
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
</aside>
