<script lang="ts">
  import {
    Database, Shield, Bell, Building2, Bot, Users,
    ChevronRight, Sliders, Lock, Sparkles, CheckCircle2, Receipt
  } from '@lucide/svelte';

  type ConfigCard = {
    id: string;
    label: string;
    description: string;
    icon: any;
    path: string;
    badge?: string;
    badgeColor?: string;
    status: 'available' | 'coming_soon';
    features: string[];
  };

  const cards: ConfigCard[] = [
    {
      id: 'importacion',
      label: 'Importación de Datos',
      description: 'Carga masiva de clientes, planes y facturas históricas mediante plantillas CSV estructuradas.',
      icon: Database,
      path: '/configuraciones/importacion',
      badge: 'Herramienta',
      badgeColor: 'blue',
      status: 'available',
      features: ['Importar planes', 'Importar clientes', 'Asignar planes', 'Importar facturas históricas'],
    },
    {
      id: 'facturacion',
      label: 'Configuración de Facturación',
      description: 'Datos fiscales del emisor, tasa de impuesto activa, moneda y resoluciones legales que se graban en cada factura.',
      icon: Receipt,
      path: '/configuraciones/facturacion',
      badge: 'Fiscal',
      badgeColor: 'blue',
      status: 'available',
      features: ['Datos del emisor', 'Tasa de impuesto (IVA)', 'Moneda y símbolo', 'Resolución legal', 'Parámetros de cobro'],
    },
    {
      id: 'seguridad',
      label: 'Seguridad y Permisos',
      description: 'Administra roles, permisos granulares y políticas de acceso para cada área del sistema.',
      icon: Shield,
      path: '/configuraciones/seguridad',
      badge: 'Próximamente',
      badgeColor: 'neutral',
      status: 'coming_soon',
      features: ['Gestión de roles', 'Permisos por módulo', 'Políticas de contraseña', 'Sesiones activas'],
    },
    {
      id: 'usuarios',
      label: 'Usuarios del Sistema',
      description: 'Crea y administra las cuentas de los empleados que acceden al panel de gestión.',
      icon: Users,
      path: '/configuraciones/usuarios',
      badge: 'Próximamente',
      badgeColor: 'neutral',
      status: 'coming_soon',
      features: ['Alta de empleados', 'Asignación de roles', 'Historial de actividad', 'Deshabilitar cuentas'],
    },
    {
      id: 'notificaciones',
      label: 'Notificaciones',
      description: 'Personaliza las plantillas de correo electrónico y configura alertas automáticas del sistema.',
      icon: Bell,
      path: '/configuraciones/notificaciones',
      badge: 'Próximamente',
      badgeColor: 'neutral',
      status: 'coming_soon',
      features: ['Plantillas de email', 'Alertas de vencimiento', 'Notificaciones push', 'Integraciones'],
    },
    {
      id: 'workers',
      label: 'Workers Automáticos',
      description: 'Gestiona las tareas programadas como cortes automáticos, generación de facturas y sincronización con MikroTik.',
      icon: Bot,
      path: '/configuraciones/workers',
      badge: 'Automatización',
      badgeColor: 'blue',
      status: 'available',
      features: ['Suspensión automática', 'Facturación mensual', 'Sync MikroTik', 'Historial de auditoría'],
    },
  ];

  const badgeClasses: Record<string, string> = {
    blue: 'bg-primary-500/15 text-primary-400 border border-primary-500/25',
    neutral: 'bg-neutral-800 text-neutral-500 border border-neutral-700/50',
  };

  const availableCards = cards.filter(c => c.status === 'available');
  const comingSoonCards = cards.filter(c => c.status === 'coming_soon');
</script>

<div class="px-4 md:px-8 py-8 max-w-5xl">

  <!-- Header de sección -->
  <div class="mb-8">
    <div class="flex items-center gap-2.5 mb-2">
      <Sliders class="w-5 h-5 text-primary-400" />
      <h2 class="text-lg font-semibold text-neutral-100">Panel de Configuraciones</h2>
    </div>
    <p class="text-sm text-neutral-500">
      Administra todas las opciones del sistema desde un único lugar. Selecciona una sección para comenzar.
    </p>
  </div>

  <!-- Tarjeta disponible (destacada) -->
  {#if availableCards.length > 0}
    <div class="mb-6">
      <p class="text-[10px] font-mono font-semibold text-neutral-600 uppercase tracking-widest mb-3">Disponible</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {#each availableCards as card}
          <a
            href={card.path}
            class="group relative flex flex-col p-5 rounded-xl border bg-surface-elevated border-neutral-800/70
                   hover:border-primary-500/40 hover:bg-surface-overlay transition-all duration-200"
          >
            <div class="flex items-start justify-between mb-4">
              <div class="p-2.5 rounded-lg bg-primary-500/10 border border-primary-500/15 group-hover:bg-primary-500/15 transition-colors">
                <card.icon class="w-5 h-5 text-primary-400" />
              </div>
              {#if card.badge}
                <span class="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full {badgeClasses[card.badgeColor ?? 'neutral']}">
                  {card.badge}
                </span>
              {/if}
            </div>

            <h3 class="text-sm font-semibold text-neutral-100 mb-1.5 group-hover:text-primary-300 transition-colors">
              {card.label}
            </h3>
            <p class="text-xs text-neutral-500 mb-4 leading-relaxed flex-1">
              {card.description}
            </p>

            <ul class="space-y-1 mb-4">
              {#each card.features as feat}
                <li class="flex items-center gap-2 text-[11px] text-neutral-400">
                  <CheckCircle2 class="w-3 h-3 text-success-500 shrink-0" />
                  {feat}
                </li>
              {/each}
            </ul>

            <div class="flex items-center gap-1 text-xs font-medium text-primary-400 group-hover:text-primary-300 transition-colors mt-auto">
              Abrir sección
              <ChevronRight class="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Próximamente -->
  {#if comingSoonCards.length > 0}
    <div>
      <div class="flex items-center gap-2 mb-3">
        <p class="text-[10px] font-mono font-semibold text-neutral-600 uppercase tracking-widest">Próximamente</p>
        <Sparkles class="w-3 h-3 text-neutral-600" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each comingSoonCards as card}
          <div
            class="relative flex flex-col p-4 rounded-xl border border-neutral-800/50 bg-neutral-900/30 opacity-60 cursor-not-allowed"
            title="Esta sección estará disponible próximamente"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="p-2 rounded-lg bg-neutral-800/60">
                <card.icon class="w-4 h-4 text-neutral-600" />
              </div>
              <Lock class="w-3.5 h-3.5 text-neutral-600 mt-0.5" />
            </div>

            <h3 class="text-xs font-semibold text-neutral-500 mb-1">
              {card.label}
            </h3>
            <p class="text-[11px] text-neutral-600 leading-relaxed">
              {card.description}
            </p>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
