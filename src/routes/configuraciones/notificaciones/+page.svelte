<script lang="ts">
  import { onMount } from 'svelte';
  import { Bell, Loader2, AlertTriangle, RefreshCw, Lock } from '@lucide/svelte';
  import {
    getNotificationCatalog,
    listChannels,
    listRoutes,
  } from '$lib/api/notifications';
  import type {
    NotificationCatalog,
    ChannelState,
    EventRoute,
  } from '$lib/types/notifications';
  import ChannelForm from '$lib/components/notifications/ChannelForm.svelte';

  let catalog = $state<NotificationCatalog | null>(null);
  let channels = $state<ChannelState[]>([]);
  let routes = $state<EventRoute[]>([]);

  let activeKey = $state<string>('telegram');
  let loading = $state(true);
  let loadError = $state('');

  async function load() {
    loading = true;
    loadError = '';
    try {
      const [cat, ch, rt] = await Promise.all([
        getNotificationCatalog(),
        listChannels(),
        listRoutes(),
      ]);
      catalog = cat;
      channels = ch.channels;
      routes = rt.routes;
    } catch (e: any) {
      loadError = e.message || 'Error al cargar configuración de notificaciones';
    } finally {
      loading = false;
    }
  }

  async function reloadChannels() {
    try {
      const ch = await listChannels();
      channels = ch.channels;
    } catch (e: any) {
      loadError = e.message || 'Error al recargar canales';
    }
  }

  onMount(load);

  const activeChannel = $derived(channels.find(c => c.key === activeKey));
</script>

<div class="px-4 md:px-8 py-8 max-w-5xl">

  <!-- Header -->
  <div class="mb-7">
    <div class="flex items-center gap-2.5 mb-1.5">
      <Bell class="w-5 h-5 text-primary-400" />
      <h2 class="text-lg font-semibold text-neutral-100">Notificaciones</h2>
    </div>
    <p class="text-sm text-neutral-500">
      Configura los canales de envío y selecciona qué eventos del sistema deben generar alertas. Los cambios se aplican
      <span class="text-neutral-300 font-medium">inmediatamente</span> a las próximas notificaciones disparadas.
    </p>
  </div>

  {#if loading}
    <div class="rounded-xl border border-neutral-800 bg-surface-elevated p-6 animate-pulse space-y-4">
      <div class="h-3 w-32 bg-neutral-800 rounded"></div>
      <div class="h-2 w-3/4 bg-neutral-800 rounded"></div>
      <div class="h-40 bg-neutral-800/40 rounded-lg mt-4"></div>
    </div>
  {:else if loadError}
    <div class="flex items-center gap-3 p-4 rounded-xl border border-red-500/25 bg-red-500/10 text-sm text-red-400">
      <AlertTriangle class="w-4 h-4 shrink-0" />
      <span>{loadError}</span>
      <button onclick={load} class="ml-auto flex items-center gap-1 text-xs text-red-300 hover:text-red-200 transition">
        <RefreshCw class="w-3.5 h-3.5" /> Reintentar
      </button>
    </div>
  {:else if catalog}
    <!-- Tabs -->
    <div class="flex items-center gap-1 border-b border-neutral-800 mb-6 overflow-x-auto">
      {#each catalog.channels as entry}
        {@const isActive = activeKey === entry.key}
        {@const isComingSoon = entry.status === 'coming_soon'}
        <button
          onclick={() => { if (!isComingSoon) activeKey = entry.key; }}
          disabled={isComingSoon}
          class="px-3.5 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5
                 {isActive ? 'border-primary-400 text-primary-300' : 'border-transparent text-neutral-400 hover:text-neutral-200'}
                 {isComingSoon ? 'opacity-40 cursor-not-allowed' : ''}"
        >
          {entry.label}
          {#if isComingSoon}
            <Lock class="w-3 h-3" />
          {/if}
        </button>
      {/each}
    </div>

    <!-- Active form -->
    {#if activeChannel}
      <div class="rounded-xl border border-neutral-800/70 bg-surface-elevated p-5">
        <p class="text-xs text-neutral-500 mb-5">{activeChannel.description}</p>
        <!-- {#key} fuerza remount del formulario al cambiar de tab. Esto evita
             que un $effect mutador re-inicialice state mientras el usuario
             escribe (UpdatedAtError / loop reactivo). -->
        {#key activeKey}
          <ChannelForm
            channel={activeChannel}
            {catalog}
            bind:routes
            onSaved={reloadChannels}
          />
        {/key}
      </div>
    {:else}
      <div class="text-center py-16 text-sm text-neutral-500">
        Selecciona un canal disponible.
      </div>
    {/if}
  {/if}
</div>
