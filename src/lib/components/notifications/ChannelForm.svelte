<script lang="ts">
  import { Eye, EyeOff, Loader2, Save, Send, CheckCircle2, AlertTriangle, Info } from '@lucide/svelte';
  import type {
    ChannelState,
    CategoryGroup,
    EventRoute,
    NotificationCatalog,
  } from '$lib/types/notifications';
  import { updateChannel, sendTestNotification, replaceRoutes } from '$lib/api/notifications';
  import Toggle from '$lib/components/common/Toggle.svelte';

  let {
    channel = $bindable(),
    catalog,
    routes = $bindable(),
    onSaved,
  }: {
    channel: ChannelState;
    catalog: NotificationCatalog;
    routes: EventRoute[];
    onSaved?: () => void;
  } = $props();

  // El componente se monta una vez por canal (el parent usa {#key} para forzar
  // remount al cambiar de tab). Por eso podemos inicializar el state local
  // directamente desde las props sin usar $effect — un $effect que mutara state
  // derivado de props ejecutaría el loop reactivo (UpdatedAtError).

  function buildInitialCreds(): Record<string, string> {
    const out: Record<string, string> = {};
    channel.credentials_schema.forEach(f => {
      const v = channel.credentials[f.key];
      // Si el backend devolvió "********" (valor enmascarado) dejamos vacío para
      // que el usuario solo escriba si quiere cambiarlo. El backend preserva el
      // valor previo cuando recibe cadena vacía.
      out[f.key] = v === '********' ? '' : (v ?? '');
    });
    return out;
  }

  function buildInitialSettings(): Record<string, string> {
    const out: Record<string, string> = {};
    channel.settings_schema.forEach(f => {
      const v = channel.settings[f.key];
      out[f.key] = v === '********' ? '' : (v ?? '');
    });
    return out;
  }

  function buildInitialRouteMap(): Record<string, EventRoute> {
    const map: Record<string, EventRoute> = {};
    for (const r of routes) {
      if (r.channel_key === channel.key) {
        map[r.category] = { ...r, extra: r.extra ? { ...r.extra } : null };
      }
    }
    return map;
  }

  let formEnabled = $state(channel.enabled);
  let credInputs = $state<Record<string, string>>(buildInitialCreds());
  let settingInputs = $state<Record<string, string>>(buildInitialSettings());
  let showSensitive = $state<Record<string, boolean>>({});
  let routeMap = $state<Record<string, EventRoute>>(buildInitialRouteMap());

  let saving = $state(false);
  let sendingTest = $state(false);
  let savingRoutes = $state(false);
  let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
  let testMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  function toggleSensitive(key: string) {
    showSensitive[key] = !showSensitive[key];
  }

  async function handleSave() {
    saving = true;
    saveMessage = null;
    try {
      const credPayload: Record<string, string> = {};
      for (const f of channel.credentials_schema) {
        const v = credInputs[f.key];
        // Vacío = no cambia (el backend preserva el valor anterior).
        if (v !== '') credPayload[f.key] = v;
      }
      const settPayload: Record<string, string> = {};
      for (const f of channel.settings_schema) {
        const v = settingInputs[f.key];
        if (v !== '') settPayload[f.key] = v;
      }

      await updateChannel(channel.key, {
        enabled: formEnabled,
        credentials: credPayload,
        settings: settPayload,
      });
      saveMessage = { type: 'success', text: 'Configuración guardada.' };
      onSaved?.();
    } catch (e: any) {
      saveMessage = { type: 'error', text: e.message || 'Error al guardar' };
    } finally {
      saving = false;
    }
  }

  async function handleTest() {
    sendingTest = true;
    testMessage = null;
    try {
      const res = await sendTestNotification(channel.key);
      const ok = (res.logs_sent ?? 0) > 0;
      // El backend ya incluye el error específico en `message`. Evitamos
      // duplicarlo si last_log_error es prácticamente lo mismo.
      const detail =
        !ok && res.last_log_error && !res.message.includes(res.last_log_error)
          ? ` — ${res.last_log_error}`
          : '';
      testMessage = {
        type: ok ? 'success' : 'error',
        text: `${res.message}${detail}`,
      };
    } catch (e: any) {
      testMessage = { type: 'error', text: e.message || 'Error al enviar prueba' };
    } finally {
      sendingTest = false;
    }
  }

  function toggleCategory(catKey: string, enabled: boolean) {
    const existing = routeMap[catKey];
    routeMap[catKey] = {
      category: catKey,
      channel_key: channel.key,
      enabled,
      address_override: existing?.address_override ?? null,
      extra: existing?.extra ?? null,
    };
  }

  function updateThreadId(catKey: string, threadId: string) {
    const existing = routeMap[catKey] ?? {
      category: catKey,
      channel_key: channel.key,
      enabled: false,
      address_override: null,
      extra: null,
    };
    const cleanThread = threadId.trim();
    routeMap[catKey] = {
      ...existing,
      extra: cleanThread ? { ...(existing.extra ?? {}), thread_id: cleanThread } : null,
    };
  }

  async function handleSaveRoutes() {
    savingRoutes = true;
    saveMessage = null;
    try {
      // Mantener las rutas de OTROS canales intactas + reemplazar las de este canal.
      const otherChannels = routes.filter(r => r.channel_key !== channel.key);
      const myRoutes = Object.values(routeMap).filter(r => {
        // Conservar solo rutas habilitadas O con datos no triviales.
        return r.enabled || r.address_override || (r.extra && Object.keys(r.extra).length > 0);
      });
      const merged = [...otherChannels, ...myRoutes];
      const res = await replaceRoutes(merged);
      routes = merged;
      saveMessage = { type: 'success', text: `Suscripciones actualizadas (${res.count} rutas).` };
    } catch (e: any) {
      saveMessage = { type: 'error', text: e.message || 'Error al guardar rutas' };
    } finally {
      savingRoutes = false;
    }
  }

  // Helper para template
  function getThreadId(catKey: string): string {
    const r = routeMap[catKey];
    return (r?.extra && typeof r.extra.thread_id === 'string') ? (r.extra.thread_id as string) : '';
  }
</script>

<div class="space-y-6">

  <!-- Cabecera con Save + Test -->
  <div class="flex items-center justify-between border-b border-neutral-800 pb-4">
    <div class="flex items-center gap-3">
      <h3 class="text-base font-semibold text-neutral-100">{channel.label}</h3>
      <button
        onclick={handleSave}
        disabled={saving}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary-500/15 text-primary-300 border border-primary-500/30 hover:bg-primary-500/25 transition disabled:opacity-50"
      >
        {#if saving}
          <Loader2 class="w-3.5 h-3.5 animate-spin" />
        {:else}
          <Save class="w-3.5 h-3.5" />
        {/if}
        Guardar
      </button>
    </div>
    <button
      onclick={handleTest}
      disabled={sendingTest || !channel.enabled}
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-neutral-300 border border-neutral-700 hover:bg-neutral-800/60 transition disabled:opacity-40"
      title={!channel.enabled ? 'Habilita el canal y guarda antes de probar' : 'Envía una notificación de prueba'}
    >
      {#if sendingTest}
        <Loader2 class="w-3.5 h-3.5 animate-spin" />
      {:else}
        <Send class="w-3.5 h-3.5" />
      {/if}
      Enviar Notificación de Prueba
    </button>
  </div>

  {#if saveMessage}
    <div
      class="flex items-start gap-2 p-3 rounded-lg border text-xs {saveMessage.type === 'success' ? 'border-success-500/30 bg-success-500/10 text-success-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}"
    >
      {#if saveMessage.type === 'success'}
        <CheckCircle2 class="w-4 h-4 shrink-0" />
      {:else}
        <AlertTriangle class="w-4 h-4 shrink-0" />
      {/if}
      {saveMessage.text}
    </div>
  {/if}
  {#if testMessage}
    <div
      class="flex items-start gap-2 p-3 rounded-lg border text-xs {testMessage.type === 'success' ? 'border-success-500/30 bg-success-500/10 text-success-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}"
    >
      {#if testMessage.type === 'success'}
        <CheckCircle2 class="w-4 h-4 shrink-0" />
      {:else}
        <AlertTriangle class="w-4 h-4 shrink-0" />
      {/if}
      {testMessage.text}
    </div>
  {/if}

  <!-- Enable toggle -->
  <div class="flex items-center justify-between">
    <span class="text-sm font-medium text-neutral-200">Habilitado</span>
    <Toggle bind:checked={formEnabled} ariaLabel="Habilitar canal {channel.label}" />
  </div>

  <!-- Credenciales -->
  {#if channel.credentials_schema.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each channel.credentials_schema as field}
        <div>
          <label for="cred-{field.key}" class="block text-xs font-medium text-neutral-200 mb-1.5">
            {field.label}
            {#if field.required}<span class="text-amber-400">*</span>{/if}
            {#if channel.credentials[field.key] === '********'}
              <span class="text-[10px] text-neutral-500 ml-1">(actualmente configurado — deja vacío para conservar)</span>
            {/if}
          </label>
          <div class="relative">
            <input
              id="cred-{field.key}"
              type={field.sensitive && !showSensitive[field.key] ? 'password' : 'text'}
              bind:value={credInputs[field.key]}
              placeholder={field.placeholder ?? ''}
              class="w-full px-3 py-2 pr-10 text-sm rounded-md bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-600 focus:border-primary-500 focus:outline-none"
            />
            {#if field.sensitive}
              <button
                type="button"
                onclick={() => toggleSensitive(field.key)}
                class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition"
                aria-label="Mostrar/ocultar"
              >
                {#if showSensitive[field.key]}
                  <EyeOff class="w-4 h-4" />
                {:else}
                  <Eye class="w-4 h-4" />
                {/if}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Settings no sensibles -->
  {#if channel.settings_schema.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      {#each channel.settings_schema as field}
        <div>
          <label for="setting-{field.key}" class="block text-xs font-medium text-neutral-200 mb-1.5">
            {field.label}
            {#if field.required}<span class="text-amber-400">*</span>{/if}
            {#if (field.sensitive ?? false) && channel.settings[field.key] === '********'}
              <span class="text-[10px] text-neutral-500 ml-1">(configurado)</span>
            {/if}
          </label>

          {#if field.type === 'select' && field.options}
            <!-- Select cerrado: opciones predefinidas. Evita errores humanos al
                 tipear valores como "MarkdownV2" mal escrito. -->
            <select
              id="setting-{field.key}"
              bind:value={settingInputs[field.key]}
              class="w-full px-3 py-2 text-sm rounded-md bg-neutral-900 border border-neutral-700 text-neutral-100 focus:border-primary-500 focus:outline-none"
            >
              {#each field.options as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          {:else}
            <div class="relative">
              <input
                id="setting-{field.key}"
                type={(field.sensitive ?? false) && !showSensitive[field.key] ? 'password' : 'text'}
                bind:value={settingInputs[field.key]}
                placeholder={field.placeholder ?? ''}
                class="w-full px-3 py-2 pr-10 text-sm rounded-md bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-600 focus:border-primary-500 focus:outline-none"
              />
              {#if field.sensitive ?? false}
                <button
                  type="button"
                  onclick={() => toggleSensitive(field.key)}
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition"
                  aria-label="Mostrar/ocultar"
                >
                  {#if showSensitive[field.key]}
                    <EyeOff class="w-4 h-4" />
                  {:else}
                    <Eye class="w-4 h-4" />
                  {/if}
                </button>
              {/if}
            </div>
          {/if}

          {#if field.description}
            <p class="flex items-start gap-1.5 text-[10px] text-neutral-500 mt-1.5 leading-relaxed">
              <Info class="w-3 h-3 shrink-0 mt-0.5 text-neutral-600" />
              <span>{field.description}</span>
            </p>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Suscripciones por categoría -->
  <div class="pt-4 border-t border-neutral-800">
    <div class="flex items-center justify-between mb-2">
      <div>
        <h4 class="text-sm font-semibold text-neutral-100">Categorías a notificar</h4>
        <p class="text-xs text-neutral-500 mt-0.5">
          Marca las categorías para las que este canal debe recibir notificaciones. Si una categoría tiene rutas marcadas
          aquí, sobreescribe el ruteo por severidad declarado en <code class="text-[10px] text-neutral-400">config/notifications.php</code>.
        </p>
      </div>
      <button
        onclick={handleSaveRoutes}
        disabled={savingRoutes}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary-500/15 text-primary-300 border border-primary-500/30 hover:bg-primary-500/25 transition disabled:opacity-50"
      >
        {#if savingRoutes}
          <Loader2 class="w-3.5 h-3.5 animate-spin" />
        {:else}
          <Save class="w-3.5 h-3.5" />
        {/if}
        Guardar suscripciones
      </button>
    </div>

    <div class="space-y-4 mt-4">
      {#each catalog.categories as group}
        <div class="rounded-xl border border-neutral-800/70 bg-surface-elevated p-4">
          <h5 class="text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-3">{group.group_label}</h5>
          <div class="space-y-2.5">
            {#each group.items as item}
              {@const route = routeMap[item.key]}
              {@const isEnabled = route?.enabled ?? false}
              <div class="grid grid-cols-[40px_1fr_220px] items-center gap-3">
                <Toggle
                  checked={isEnabled}
                  size="sm"
                  ariaLabel={item.label}
                  onChange={(next) => toggleCategory(item.key, next)}
                />
                <div class="text-xs text-neutral-300 cursor-default">
                  <span class="font-medium text-neutral-200">{item.label}</span>
                  <span class="text-neutral-500 ml-1.5">— {item.description}</span>
                  <span class="inline-block ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 uppercase">{item.default_severity}</span>
                </div>
                {#if channel.key === 'telegram'}
                  <input
                    type="text"
                    placeholder="Custom Telegram Thread ID"
                    value={getThreadId(item.key)}
                    oninput={(e) => updateThreadId(item.key, (e.currentTarget as HTMLInputElement).value)}
                    disabled={!isEnabled}
                    class="px-2.5 py-1.5 text-xs rounded-md bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-600 focus:border-primary-500 focus:outline-none disabled:opacity-40"
                  />
                {:else}
                  <div></div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
