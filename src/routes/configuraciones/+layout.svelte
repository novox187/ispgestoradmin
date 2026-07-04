<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    Settings, Database, Shield, Bell, ChevronRight,
    Users, Bot, Sliders, Building2, Lock, Receipt, ShieldCheck, ScrollText
  } from '@lucide/svelte';
  import Encabezado from '$lib/components/Encabezado.svelte';
  import { appState } from '$lib/stores/app.svelte';

  let { children } = $props();

  type SettingsItem = {
    id: string;
    label: string;
    description: string;
    icon: any;
    path: string;
    badge?: string;
    locked?: boolean;
  };

  type SettingsSection = {
    label: string;
    items: SettingsItem[];
  };

  const settingsSections: SettingsSection[] = [
    {
      label: 'Sistema',
      items: [
        {
          id: 'general',
          label: 'General',
          description: 'Configuración general del sistema',
          icon: Sliders,
          path: '/configuraciones',
        },
        {
          id: 'importacion',
          label: 'Importación de Datos',
          description: 'Carga masiva mediante plantillas CSV',
          icon: Database,
          path: '/configuraciones/importacion',
          badge: 'Herramienta',
        },
        {
          id: 'facturacion',
          label: 'Facturación',
          description: 'Datos fiscales, impuestos y resoluciones legales',
          icon: Receipt,
          path: '/configuraciones/facturacion',
        },
      ],
    },
    {
      label: 'Acceso y Seguridad',
      items: [
        {
          id: 'whitelist',
          label: 'Lista Blanca',
          description: 'Clientes protegidos de la suspensión automática',
          icon: ShieldCheck,
          path: '/configuraciones/whitelist',
          badge: 'Super',
        },
        {
          id: 'seguridad',
          label: 'Seguridad y Permisos',
          description: 'Roles y políticas de acceso',
          icon: Shield,
          path: '/configuraciones/seguridad',
        },
        {
          id: 'usuarios',
          label: 'Usuarios del Sistema',
          description: 'Gestión de cuentas de empleados',
          icon: Users,
          path: '/configuraciones/usuarios',
        },
        {
          id: 'auditoria',
          label: 'Auditoría del Sistema',
          description: 'Registro inmutable de operaciones y cortes de servicio',
          icon: ScrollText,
          path: '/configuraciones/auditoria',
        },
      ],
    },
    {
      label: 'Notificaciones y Empresa',
      items: [
        {
          id: 'notificaciones',
          label: 'Notificaciones',
          description: 'Canales, alertas y suscripciones por categoría',
          icon: Bell,
          path: '/configuraciones/notificaciones',
        },
        {
          id: 'empresa',
          label: 'Datos de Empresa',
          description: 'Información corporativa y marca',
          icon: Building2,
          path: '/configuraciones/empresa',
          locked: true,
        },
      ],
    },
    {
      label: 'Automatización',
      items: [
        {
          id: 'workers',
          label: 'Workers Automáticos',
          description: 'Tareas programadas y bots',
          icon: Bot,
          path: '/configuraciones/workers',
        },
      ],
    },
  ];

  function isActive(path: string) {
    const current = $page.url.pathname;
    if (path === '/configuraciones') return current === '/configuraciones';
    return current.startsWith(path);
  }

  function getActiveItem(): SettingsItem | null {
    for (const section of settingsSections) {
      for (const item of section.items) {
        if (isActive(item.path)) return item;
      }
    }
    return null;
  }

  const activeItem = $derived(getActiveItem());

  const breadcrumbs = $derived.by(() => {
    const crumbs = [{ label: 'Configuraciones', path: '/configuraciones' }];
    const current = $page.url.pathname;
    if (current !== '/configuraciones') {
      const found = settingsSections.flatMap(s => s.items).find(i => current.startsWith(i.path) && i.path !== '/configuraciones');
      if (found) crumbs.push({ label: found.label, path: found.path });
    }
    return crumbs;
  });

  function toggleSidebar() {
    appState.toggleSidebar();
  }
</script>

<main class="flex-1 overflow-hidden flex flex-col bg-[#0b0b0d] text-gray-100">
  <Encabezado {toggleSidebar} />

  <!-- Breadcrumb -->
  <div class="border-b border-neutral-800/60 bg-[#0b0b0d] px-4 md:px-6 py-2.5">
    <nav class="flex items-center gap-1 text-xs" aria-label="Breadcrumb">
      {#each breadcrumbs as crumb, i}
        {#if i > 0}
          <ChevronRight class="w-3 h-3 text-neutral-600 shrink-0" />
        {/if}
        {#if i < breadcrumbs.length - 1}
          <a href={crumb.path} class="text-neutral-400 hover:text-white transition-colors">
            {crumb.label}
          </a>
        {:else}
          <span class="text-neutral-200 font-medium">{crumb.label}</span>
        {/if}
      {/each}
    </nav>
  </div>

  <!-- Contenido con sub-sidebar -->
  <div class="flex flex-1 overflow-hidden">

    <!-- Sub-sidebar de configuraciones -->
    <aside class="w-56 shrink-0 border-r border-neutral-800/60 bg-[#0b0b0d] overflow-y-auto hidden md:flex flex-col py-3 px-2 gap-4">
      <!-- Header del panel -->
      <div class="px-2 mb-1">
        <div class="flex items-center gap-2 mb-1">
          <Settings class="w-4 h-4 text-primary-500" />
          <span class="text-xs font-semibold text-neutral-200 tracking-wide">Configuraciones</span>
        </div>
        <p class="text-[10px] text-neutral-500 font-mono">Panel de administración</p>
      </div>

      {#each settingsSections as section}
        <div>
          <div class="px-2 mb-1">
            <span class="text-[9px] font-mono font-semibold text-neutral-600 uppercase tracking-widest">
              {section.label}
            </span>
          </div>
          <ul class="space-y-0.5">
            {#each section.items as item}
              <li>
                {#if item.locked}
                  <span
                    class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-neutral-600 cursor-not-allowed select-none"
                    title="Próximamente disponible"
                  >
                    <item.icon class="w-3.5 h-3.5 shrink-0" />
                    <span class="flex-1 truncate">{item.label}</span>
                    <Lock class="w-3 h-3 shrink-0" />
                  </span>
                {:else}
                  <a
                    href={item.path}
                    class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150
                      {isActive(item.path)
                        ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent'}"
                  >
                    <item.icon class="w-3.5 h-3.5 shrink-0 {isActive(item.path) ? 'text-primary-400' : ''}" />
                    <span class="flex-1 truncate">{item.label}</span>
                    {#if item.badge}
                      <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">
                        {item.badge}
                      </span>
                    {/if}
                    {#if isActive(item.path)}
                      <div class="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0"></div>
                    {/if}
                  </a>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </aside>

    <!-- Área de contenido principal -->
    <div class="flex-1 overflow-y-auto">
      {@render children?.()}
    </div>
  </div>
</main>
