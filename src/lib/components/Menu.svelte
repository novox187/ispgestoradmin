<script>
  // @ts-ignore
  import { LayoutDashboard, FlaskConical, Smartphone, Shield, Mail, Settings, Lock, User, MoreVertical, Users, Wifi, CreditCard, Zap, Bell, UserCog, LogOut } from '@lucide/svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { API_BASE } from '$lib/config';
  import { fade, fly } from 'svelte/transition';
  
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
  <div class="p-4 border-t border-neutral-800/50 mt-auto">
    <div class="relative">
      <button 
        class="w-full group flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800/50 transition-all duration-300 border border-transparent hover:border-neutral-700/50 outline-none focus:ring-2 focus:ring-blue-500/20"
        onclick={() => (userMenuOpen = !userMenuOpen)}
        aria-label="User menu"
        aria-expanded={userMenuOpen}
      >
        <div class="relative">
          <div class="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full opacity-75 blur group-hover:opacity-100 transition duration-500"></div>
          <div class="relative w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white font-bold text-lg border border-neutral-800">
            F
          </div>
          <div class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-neutral-900 rounded-full"></div>
        </div>
        
        <div class="flex-1 min-w-0 text-left">
          <div class="text-white font-bold text-sm truncate group-hover:text-blue-400 transition-colors">FERNANDO</div>
          <div class="text-gray-500 text-[10px] font-mono truncate tracking-tight">KZENBOUH.JOYCO_STUDIO</div>
        </div>

        <div class="text-gray-500 group-hover:text-white transition-transform duration-300 {userMenuOpen ? 'rotate-180' : ''}">
          <MoreVertical class="w-4 h-4" />
        </div>
      </button>

      {#if userMenuOpen}
        <div 
          transition:fly={{ y: 10, duration: 200 }}
          class="absolute bottom-full left-0 w-full mb-2 bg-neutral-900/95 backdrop-blur-xl border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-20"
        >
          <div class="p-1 space-y-0.5">
             <a href="/perfil" onclick={() => userMenuOpen = false} class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors group/item">
                <User class="w-4 h-4 text-gray-500 group-hover/item:text-blue-400 transition-colors" />
                <span class="font-medium">Mi Perfil</span>
             </a>
             <div class="h-px bg-neutral-800/50 my-1 mx-2"></div>
             <button 
                class="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors group/item"
                onclick={(e) => { e.stopPropagation(); handleLogout(); }} 
                disabled={loggingOut}
              >
                {#if loggingOut}
                  <div class="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                  <span>Cerrando...</span>
                {:else}
                  <LogOut class="w-4 h-4 text-red-400/70 group-hover/item:text-red-400 transition-colors" />
                  <span>Cerrar sesión</span>
                {/if}
              </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</aside>
