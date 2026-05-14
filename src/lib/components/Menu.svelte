<script lang="ts">
  import {
    LayoutDashboard, Users, Wifi, Zap, CreditCard,
    Router, UserCog, Lock, User, MoreVertical, Settings, LogOut, SlidersHorizontal
  } from '@lucide/svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { API_BASE } from '$lib/config';
  import { BRAND } from '$lib/brand';
  import { fly } from 'svelte/transition';
  import LogoComponent from '$lib/assets/logos/LogoComponent.svelte';
  import { auth } from '$lib/stores/auth.svelte';

  let { isOpen = $bindable(false) } = $props();

  type NavItem = {
    label: string;
    icon: any;
    path: string;
    locked?: boolean;
  };

  type NavGroup = {
    label: string;
    items: NavItem[];
  };

  const navGroups: NavGroup[] = [
    {
      label: 'General',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
      ]
    },
    {
      label: 'Gestión',
      items: [
        { label: 'Clientes', icon: Users, path: '/clientes' },
        { label: 'Planes', icon: Wifi, path: '/planes' },
      ]
    },
    {
      label: 'Finanzas',
      items: [
        { label: 'Facturación', icon: CreditCard, path: '/facturas' },
        { label: 'Proveedores', icon: Zap, path: '/proveedores' },
      ]
    },
    {
      label: 'Infraestructura',
      items: [
        { label: 'MikroTik', icon: Router, path: '/mikrotik' },
      ]
    },
    {
      label: 'Sistema',
      items: [
        { label: 'Usuarios', icon: UserCog, path: '/usuarios' },
        { label: 'Configuraciones', icon: SlidersHorizontal, path: '/configuraciones' },
      ]
    },
  ];

  function closeSidebar() {
    isOpen = false;
  }

  function isActive(path: string) {
    const current = $page.url.pathname;
    return path === '/' ? current === '/' : current.startsWith(path);
  }

  let userMenuOpen = $state(false);
  let loggingOut = $state(false);
  let userName = $derived(auth.nombre || 'Usuario');
  let userRole = $derived((auth.roleName || 'Sin Rol').toUpperCase());

  async function handleLogout() {
    if (loggingOut) return;
    loggingOut = true;
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
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

<!-- Mobile overlay -->
{#if isOpen}
  <div
    class="fixed inset-0 bg-black/50 z-40 lg:hidden"
    onclick={closeSidebar}
    onkeydown={(e) => e.key === 'Enter' && closeSidebar()}
    role="button"
    tabindex="0"
    aria-label="Cerrar menú"
  ></div>
{/if}

<aside class="
  w-60 bg-[#0a0a0a] border-r border-neutral-800/60 flex flex-col
  fixed lg:static inset-y-0 left-0 z-50
  transform transition-transform duration-300 ease-in-out
  {isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
">
  <!-- Logo -->
  <div class="px-5 py-5 border-b border-neutral-800/60">
    <div class="flex items-center gap-3">
      <LogoComponent size={48} color="white" title={BRAND.logoAlt} />
      <div class="min-w-0">
        <div class="text-white font-bold text-sm tracking-widest leading-tight">{BRAND.nameUpper}</div>
        <div class="text-neutral-600 text-[10px] font-mono truncate">{BRAND.tagline}</div>
      </div>
    </div>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 overflow-y-auto py-3 px-3 space-y-4">
    {#each navGroups as group}
      <div>
        <div class="px-2 mb-1">
          <span class="text-[10px] font-mono font-semibold text-neutral-600 uppercase tracking-widest">
            {group.label}
          </span>
        </div>
        <ul class="space-y-0.5">
          {#each group.items as item}
            <li>
              {#if item.locked}
                <span class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-neutral-600 cursor-not-allowed select-none">
                  <item.icon class="w-4 h-4 shrink-0" />
                  <span class="flex-1">{item.label}</span>
                  <Lock class="w-3 h-3" />
                </span>
              {:else}
                <a
                  href={item.path}
                  onclick={() => closeSidebar()}
                  class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150
                    {isActive(item.path)
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent'}"
                >
                  <item.icon class="w-4 h-4 shrink-0 {isActive(item.path) ? 'text-blue-400' : ''}" />
                  <span class="flex-1">{item.label}</span>
                  {#if isActive(item.path)}
                    <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  {/if}
                </a>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>

  <!-- User section -->
  <div class="px-3 py-3 border-t border-neutral-800/60">
    <div class="relative">
      <button
        onclick={() => (userMenuOpen = !userMenuOpen)}
        aria-label="Menú de usuario"
        aria-expanded={userMenuOpen}
        class="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-neutral-800/60 border border-transparent hover:border-neutral-700/40 transition-all duration-150 outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50"
      >
        <div class="relative shrink-0">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-[#0a0a0a] rounded-full"></div>
        </div>
        <div class="flex-1 min-w-0 text-left">
          <div class="text-white text-xs font-semibold truncate leading-tight">{userName}</div>
          <div class="text-neutral-500 text-[10px] font-mono truncate">{userRole}</div>
        </div>
        <MoreVertical class="w-3.5 h-3.5 text-neutral-600 shrink-0 transition-transform duration-200 {userMenuOpen ? 'rotate-90' : ''}" />
      </button>

      {#if userMenuOpen}
        <div
          transition:fly={{ y: 6, duration: 150 }}
          class="absolute bottom-full left-0 w-full mb-1.5 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-20"
        >
          <div class="p-1 space-y-0.5">
            <a
              href="/perfil"
              onclick={() => { userMenuOpen = false; closeSidebar(); }}
              class="flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <User class="w-3.5 h-3.5 text-neutral-500" />
              Mi perfil
            </a>
            <div class="h-px bg-neutral-800 my-1 mx-1"></div>
            <button
              onclick={(e) => { e.stopPropagation(); handleLogout(); }}
              disabled={loggingOut}
              class="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              {#if loggingOut}
                <div class="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                Cerrando sesión...
              {:else}
                <LogOut class="w-3.5 h-3.5" />
                Cerrar sesión
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</aside>
