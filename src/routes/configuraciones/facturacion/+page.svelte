<script lang="ts">
  import {
    Save, Loader2, AlertTriangle, CheckCircle2, RefreshCw,
    Building2, BadgePercent, Landmark, Coins, Info,
    Eye, EyeOff, Receipt,
  } from '@lucide/svelte';
  import { API_BASE } from '$lib/config';
  import { onMount } from 'svelte';

  // ── Tipos ──────────────────────────────────────────────────────────────────
  interface SettingRow {
    id: number;
    key: string;
    value: string;
    data_type: string;
    description: string;
    is_public: boolean;
    group: string;
  }

  // Campos del formulario agrupados
  interface FormData {
    // Emisor
    issuer_name:    string;
    issuer_nit:     string;
    issuer_address: string;
    issuer_city:    string;
    issuer_country: string;
    issuer_email:   string;
    issuer_phone:   string;
    // Impuesto
    tax_rate:       string;
    tax_name:       string;
    tax_id_label:   string;
    // Moneda
    currency_code:   string;
    currency_symbol: string;
    // Legal
    invoice_resolution_number: string;
    invoice_resolution_date:   string;
    // Facturación interna
    invoice_due_days:        string;
    grace_period_days:       string;
    auto_payment_retry_days: string;
  }

  // ── Estado ─────────────────────────────────────────────────────────────────
  let rawSettings  = $state<SettingRow[]>([]);
  let loading      = $state(true);
  let saving       = $state(false);
  let loadError    = $state('');
  let saveError    = $state('');
  let saveSuccess  = $state(false);

  let form = $state<FormData>({
    issuer_name: '', issuer_nit: '', issuer_address: '', issuer_city: '',
    issuer_country: '', issuer_email: '', issuer_phone: '',
    tax_rate: '', tax_name: '', tax_id_label: '',
    currency_code: '', currency_symbol: '',
    invoice_resolution_number: '', invoice_resolution_date: '',
    invoice_due_days: '', grace_period_days: '', auto_payment_retry_days: '',
  });

  // Mapeo de claves que son is_public por defecto (coincide con el seeder)
  const publicKeys = new Set([
    'issuer_name','issuer_nit','issuer_address','issuer_city','issuer_country',
    'issuer_email','issuer_phone','tax_rate','tax_name','tax_id_label',
    'currency_code','currency_symbol',
    'invoice_resolution_number','invoice_resolution_date',
  ]);

  // ── Carga ──────────────────────────────────────────────────────────────────
  async function load() {
    loading   = true;
    loadError = '';
    try {
      const token = localStorage.getItem('employee_token');
      const res = await fetch(`${API_BASE}/admin/settings?module=facturacion`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      rawSettings = await res.json();
      populateForm(rawSettings);
    } catch (e: any) {
      loadError = e.message || 'Error cargando configuraciones';
    } finally {
      loading = false;
    }
  }

  function populateForm(settings: SettingRow[]) {
    const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
    const keys = Object.keys(form) as (keyof FormData)[];
    for (const k of keys) {
      if (map[k] !== undefined) form[k] = map[k];
    }
  }

  // ── Guardado ───────────────────────────────────────────────────────────────
  async function save() {
    saving      = true;
    saveError   = '';
    saveSuccess = false;
    try {
      const token = localStorage.getItem('employee_token');

      const dataTypeMap: Record<keyof FormData, string> = {
        issuer_name: 'string', issuer_nit: 'string', issuer_address: 'string',
        issuer_city: 'string', issuer_country: 'string', issuer_email: 'string',
        issuer_phone: 'string', tax_rate: 'float', tax_name: 'string',
        tax_id_label: 'string', currency_code: 'string', currency_symbol: 'string',
        invoice_resolution_number: 'string', invoice_resolution_date: 'string',
        invoice_due_days: 'integer', grace_period_days: 'integer',
        auto_payment_retry_days: 'integer',
      };

      const groupMap: Record<keyof FormData, string> = {
        issuer_name: 'issuer', issuer_nit: 'issuer', issuer_address: 'issuer',
        issuer_city: 'issuer', issuer_country: 'issuer', issuer_email: 'issuer',
        issuer_phone: 'issuer', tax_rate: 'tax', tax_name: 'tax',
        tax_id_label: 'tax', currency_code: 'currency', currency_symbol: 'currency',
        invoice_resolution_number: 'legal', invoice_resolution_date: 'legal',
        invoice_due_days: 'billing', grace_period_days: 'billing',
        auto_payment_retry_days: 'billing',
      };

      const payload = (Object.keys(form) as (keyof FormData)[]).map(key => ({
        key,
        value:     String(form[key] ?? ''),
        module:    'facturacion',
        group:     groupMap[key],
        data_type: dataTypeMap[key],
        is_public: publicKeys.has(key),
      }));

      const res = await fetch(`${API_BASE}/admin/settings`, {
        method: 'PUT',
        headers: {
          Authorization:  `Bearer ${token}`,
          Accept:         'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        saveError = data.message || data.error || `Error ${res.status}`;
        return;
      }

      saveSuccess = true;
      await load();
      setTimeout(() => { saveSuccess = false; }, 3500);
    } catch (e: any) {
      saveError = e.message || 'Error de conexión';
    } finally {
      saving = false;
    }
  }

  // ── Helpers de UI ──────────────────────────────────────────────────────────
  const inputBase = 'w-full rounded-lg border px-3 py-2.5 text-sm text-white bg-neutral-900 border-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/60 transition-colors placeholder-neutral-600';

  function fmtTaxPreview(): string {
    const r = parseFloat(form.tax_rate);
    return isNaN(r) ? '—' : `${(r * 100).toFixed(0)}%`;
  }

  onMount(load);
</script>

<div class="px-4 md:px-8 py-8 max-w-3xl">

  <!-- Header -->
  <div class="mb-7">
    <div class="flex items-center gap-2.5 mb-1.5">
      <Receipt class="w-5 h-5 text-primary-400" />
      <h2 class="text-lg font-semibold text-neutral-100">Configuración de Facturación</h2>
    </div>
    <p class="text-sm text-neutral-500">
      Datos fiscales, tasas de impuesto y resoluciones legales que se graban en cada factura emitida.
      Estos valores quedan <span class="text-neutral-300 font-medium">congelados en el snapshot</span> de cada factura
      y no pueden modificarse retroactivamente.
    </p>
  </div>

  {#if loading}
    <!-- Skeleton loader -->
    <div class="space-y-5">
      {#each Array(4) as _}
        <div class="rounded-xl border border-neutral-800 bg-surface-elevated p-5 animate-pulse">
          <div class="h-4 w-32 bg-neutral-800 rounded mb-4"></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {#each Array(4) as _}
              <div class="h-10 bg-neutral-800 rounded-lg"></div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

  {:else if loadError}
    <div class="flex items-center gap-3 p-4 rounded-xl border border-red-500/25 bg-red-500/10 text-sm text-red-400">
      <AlertTriangle class="w-4 h-4 shrink-0" />
      <span>{loadError}</span>
      <button onclick={load} class="ml-auto flex items-center gap-1 text-xs text-red-300 hover:text-red-200 transition-colors">
        <RefreshCw class="w-3.5 h-3.5" /> Reintentar
      </button>
    </div>

  {:else}

  <form onsubmit={(e) => { e.preventDefault(); save(); }} class="space-y-5">

    <!-- ── Sección 1: Emisor ─────────────────────────────────────────────── -->
    <fieldset class="rounded-xl border border-neutral-800 bg-surface-elevated overflow-hidden">
      <legend class="sr-only">Datos del emisor</legend>
      <div class="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-800">
        <Building2 class="w-4 h-4 text-primary-400" />
        <span class="text-sm font-semibold text-neutral-200">Datos del Emisor</span>
        <span class="ml-auto flex items-center gap-1 text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <Eye class="w-2.5 h-2.5" /> Público
        </span>
      </div>
      <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div class="space-y-1.5">
          <label for="issuer_name" class="block text-xs font-medium text-neutral-400">
            Razón Social <span class="text-red-400">*</span>
          </label>
          <input id="issuer_name" type="text" bind:value={form.issuer_name}
            placeholder="Iron Link S.A.S." class={inputBase} required />
        </div>

        <div class="space-y-1.5">
          <label for="issuer_nit" class="block text-xs font-medium text-neutral-400">
            NIT / Identificación Fiscal <span class="text-red-400">*</span>
          </label>
          <input id="issuer_nit" type="text" bind:value={form.issuer_nit}
            placeholder="900.123.456-7" class={inputBase} required />
        </div>

        <div class="space-y-1.5 sm:col-span-2">
          <label for="issuer_address" class="block text-xs font-medium text-neutral-400">
            Dirección Fiscal <span class="text-red-400">*</span>
          </label>
          <input id="issuer_address" type="text" bind:value={form.issuer_address}
            placeholder="Calle 10 # 20-30" class={inputBase} required />
        </div>

        <div class="space-y-1.5">
          <label for="issuer_city" class="block text-xs font-medium text-neutral-400">
            Ciudad <span class="text-red-400">*</span>
          </label>
          <input id="issuer_city" type="text" bind:value={form.issuer_city}
            placeholder="Bogotá" class={inputBase} required />
        </div>

        <div class="space-y-1.5">
          <label for="issuer_country" class="block text-xs font-medium text-neutral-400">
            País <span class="text-red-400">*</span>
          </label>
          <input id="issuer_country" type="text" bind:value={form.issuer_country}
            placeholder="Colombia" class={inputBase} required />
        </div>

        <div class="space-y-1.5">
          <label for="issuer_email" class="block text-xs font-medium text-neutral-400">
            Correo de Facturación <span class="text-red-400">*</span>
          </label>
          <input id="issuer_email" type="email" bind:value={form.issuer_email}
            placeholder="facturacion@empresa.com" class={inputBase} required />
        </div>

        <div class="space-y-1.5">
          <label for="issuer_phone" class="block text-xs font-medium text-neutral-400">
            Teléfono
          </label>
          <input id="issuer_phone" type="text" bind:value={form.issuer_phone}
            placeholder="+57 1 234 5678" class={inputBase} />
        </div>

      </div>
    </fieldset>

    <!-- ── Sección 2: Impuestos ──────────────────────────────────────────── -->
    <fieldset class="rounded-xl border border-neutral-800 bg-surface-elevated overflow-hidden">
      <legend class="sr-only">Configuración de impuestos</legend>
      <div class="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-800">
        <BadgePercent class="w-4 h-4 text-primary-400" />
        <span class="text-sm font-semibold text-neutral-200">Impuestos</span>
        <span class="ml-auto flex items-center gap-1 text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <Eye class="w-2.5 h-2.5" /> Público
        </span>
      </div>
      <div class="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div class="space-y-1.5">
          <label for="tax_rate" class="block text-xs font-medium text-neutral-400">
            Tasa de Impuesto <span class="text-red-400">*</span>
          </label>
          <input id="tax_rate" type="number" step="0.01" min="0" max="1"
            bind:value={form.tax_rate} placeholder="0.15" class={inputBase} required />
          <p class="text-[11px] text-neutral-500">Decimal — ej: <code class="text-neutral-400">0.15</code> = 15%</p>
        </div>

        <div class="space-y-1.5">
          <label for="tax_name" class="block text-xs font-medium text-neutral-400">
            Nombre del Impuesto <span class="text-red-400">*</span>
          </label>
          <input id="tax_name" type="text" bind:value={form.tax_name}
            placeholder="IVA" class={inputBase} required />
        </div>

        <div class="space-y-1.5">
          <label for="tax_id_label" class="block text-xs font-medium text-neutral-400">
            Etiqueta ID Fiscal
          </label>
          <input id="tax_id_label" type="text" bind:value={form.tax_id_label}
            placeholder="NIT" class={inputBase} />
        </div>

      </div>

      <!-- Preview de la tasa activa -->
      <div class="mx-5 mb-5 flex items-center gap-2 p-3 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
        <Info class="w-3.5 h-3.5 text-primary-400 shrink-0" />
        <p class="text-xs text-neutral-400">
          Tasa activa: <span class="text-white font-semibold">{fmtTaxPreview()}</span>
          — cada nueva factura usará este valor para calcular
          <span class="text-neutral-300">{form.tax_name || 'impuesto'}</span>.
        </p>
      </div>
    </fieldset>

    <!-- ── Sección 3: Moneda ─────────────────────────────────────────────── -->
    <fieldset class="rounded-xl border border-neutral-800 bg-surface-elevated overflow-hidden">
      <legend class="sr-only">Moneda</legend>
      <div class="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-800">
        <Coins class="w-4 h-4 text-primary-400" />
        <span class="text-sm font-semibold text-neutral-200">Moneda</span>
        <span class="ml-auto flex items-center gap-1 text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <Eye class="w-2.5 h-2.5" /> Público
        </span>
      </div>
      <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div class="space-y-1.5">
          <label for="currency_code" class="block text-xs font-medium text-neutral-400">
            Código ISO <span class="text-red-400">*</span>
          </label>
          <input id="currency_code" type="text" maxlength="3" bind:value={form.currency_code}
            placeholder="COP" class={inputBase} required />
          <p class="text-[11px] text-neutral-500">3 letras — ej: <code class="text-neutral-400">COP</code>, <code class="text-neutral-400">USD</code></p>
        </div>

        <div class="space-y-1.5">
          <label for="currency_symbol" class="block text-xs font-medium text-neutral-400">
            Símbolo <span class="text-red-400">*</span>
          </label>
          <input id="currency_symbol" type="text" maxlength="4" bind:value={form.currency_symbol}
            placeholder="$" class={inputBase} required />
        </div>

      </div>
    </fieldset>

    <!-- ── Sección 4: Resolución Legal ──────────────────────────────────── -->
    <fieldset class="rounded-xl border border-neutral-800 bg-surface-elevated overflow-hidden">
      <legend class="sr-only">Resolución legal</legend>
      <div class="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-800">
        <Landmark class="w-4 h-4 text-primary-400" />
        <span class="text-sm font-semibold text-neutral-200">Resolución Legal</span>
        <span class="ml-auto flex items-center gap-1 text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <Eye class="w-2.5 h-2.5" /> Público
        </span>
      </div>
      <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div class="space-y-1.5">
          <label for="resolution_number" class="block text-xs font-medium text-neutral-400">
            Número de Resolución <span class="text-red-400">*</span>
          </label>
          <input id="resolution_number" type="text" bind:value={form.invoice_resolution_number}
            placeholder="18764000001" class={inputBase} required />
        </div>

        <div class="space-y-1.5">
          <label for="resolution_date" class="block text-xs font-medium text-neutral-400">
            Fecha de Resolución <span class="text-red-400">*</span>
          </label>
          <input id="resolution_date" type="date" bind:value={form.invoice_resolution_date}
            class={inputBase} required />
        </div>

      </div>
    </fieldset>

    <!-- ── Sección 5: Parámetros internos de facturación ────────────────── -->
    <fieldset class="rounded-xl border border-neutral-800 bg-surface-elevated overflow-hidden">
      <legend class="sr-only">Parámetros internos</legend>
      <div class="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-800">
        <Receipt class="w-4 h-4 text-neutral-500" />
        <span class="text-sm font-semibold text-neutral-400">Parámetros Internos de Cobro</span>
        <span class="ml-auto flex items-center gap-1 text-[10px] font-mono text-neutral-500 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded-full">
          <EyeOff class="w-2.5 h-2.5" /> Privado
        </span>
      </div>
      <div class="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div class="space-y-1.5">
          <label for="due_days" class="block text-xs font-medium text-neutral-400">
            Días de Vencimiento
          </label>
          <input id="due_days" type="number" min="1" max="90"
            bind:value={form.invoice_due_days} placeholder="15" class={inputBase} />
          <p class="text-[11px] text-neutral-500">Desde la fecha de emisión</p>
        </div>

        <div class="space-y-1.5">
          <label for="grace_days" class="block text-xs font-medium text-neutral-400">
            Días de Gracia
          </label>
          <input id="grace_days" type="number" min="0" max="30"
            bind:value={form.grace_period_days} placeholder="3" class={inputBase} />
          <p class="text-[11px] text-neutral-500">Antes de suspensión</p>
        </div>

        <div class="space-y-1.5">
          <label for="retry_days" class="block text-xs font-medium text-neutral-400">
            Días de Reintento Autopago
          </label>
          <input id="retry_days" type="number" min="1" max="30"
            bind:value={form.auto_payment_retry_days} placeholder="5" class={inputBase} />
          <p class="text-[11px] text-neutral-500">Intentos tras vencimiento</p>
        </div>

      </div>

      <!-- Nota de privacidad -->
      <div class="mx-5 mb-5 flex items-start gap-2 p-3 rounded-lg bg-neutral-800/40 border border-neutral-700/40">
        <EyeOff class="w-3.5 h-3.5 text-neutral-500 shrink-0 mt-0.5" />
        <p class="text-xs text-neutral-500">
          Estos valores son de uso interno y <strong class="text-neutral-400">nunca se exponen al frontend del cliente</strong>,
          aunque sí quedan registrados en el snapshot de cada factura para auditoría.
        </p>
      </div>
    </fieldset>

    <!-- ── Feedback y acciones ───────────────────────────────────────────── -->
    {#if saveError}
      <div class="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/25 bg-red-500/10">
        <AlertTriangle class="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <p class="text-sm text-red-400">{saveError}</p>
      </div>
    {/if}

    {#if saveSuccess}
      <div class="flex items-center gap-2.5 p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10">
        <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
        <p class="text-sm text-emerald-400">Configuraciones guardadas. El próximo snapshot usará estos valores.</p>
      </div>
    {/if}

    <div class="flex items-center justify-between pt-1 pb-4">
      <button
        type="button"
        onclick={load}
        disabled={loading || saving}
        class="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-40"
      >
        <RefreshCw class="w-3.5 h-3.5 {loading ? 'animate-spin' : ''}" />
        Recargar
      </button>

      <button
        type="submit"
        disabled={saving}
        class="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold
               hover:bg-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-900/40"
      >
        {#if saving}
          <Loader2 class="w-4 h-4 animate-spin" />
          Guardando…
        {:else}
          <Save class="w-4 h-4" />
          Guardar configuraciones
        {/if}
      </button>
    </div>

  </form>
  {/if}

</div>
