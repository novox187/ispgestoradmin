<script lang="ts">
  import {
    Save, Loader2, AlertTriangle, CheckCircle2, RefreshCw,
    Building2, BadgePercent, Landmark, Coins, Info,
    Eye, EyeOff, Receipt, ShieldCheck, XCircle,
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

  interface FormData {
    // Emisor
    issuer_name:    string;
    issuer_ruc:     string;
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
    // Legal SRI
    sri_establishment_code: string;
    sri_emission_point:     string;
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
    issuer_name: '', issuer_ruc: '', issuer_address: '', issuer_city: '',
    issuer_country: 'Ecuador', issuer_email: '', issuer_phone: '',
    tax_rate: '0.15', tax_name: 'IVA', tax_id_label: 'RUC',
    currency_code: 'USD', currency_symbol: '$',
    sri_establishment_code: '001', sri_emission_point: '001',
    invoice_due_days: '', grace_period_days: '', auto_payment_retry_days: '',
  });

  // ── Errores de validación en tiempo real ───────────────────────────────────
  let fieldErrors = $state<Partial<Record<keyof FormData, string>>>({});

  const publicKeys = new Set([
    'issuer_name','issuer_ruc','issuer_address','issuer_city','issuer_country',
    'issuer_email','issuer_phone','tax_rate','tax_name','tax_id_label',
    'currency_code','currency_symbol',
    'sri_establishment_code','sri_emission_point',
  ]);

  // ── Validadores en tiempo real ─────────────────────────────────────────────

  function validateRucLive(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length < 13) return `${digits.length}/13 dígitos — faltan ${13 - digits.length}`;
    if (digits.length > 13) return 'El RUC no puede tener más de 13 dígitos';
    const province = parseInt(digits.substring(0, 2), 10);
    if (province < 1 || province > 24) return `Provincia inválida: "${digits.substring(0, 2)}" — debe ser 01 al 24`;
    if (digits.substring(10) === '000') return 'Los últimos 3 dígitos no pueden ser 000';
    return '';
  }

  function validateSriCodeLive(value: string): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (!/^\d{3}$/.test(value)) return 'Debe ser exactamente 3 dígitos (ej: 001)';
    if (value === '000') return 'No puede ser 000 — use 001 o superior';
    return '';
  }

  // ── Handlers de input con auto-formato ────────────────────────────────────

  function onRucInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 13);
    form.issuer_ruc = digits;
    fieldErrors.issuer_ruc = validateRucLive(digits);
  }

  function onSriCodeInput(field: 'sri_establishment_code' | 'sri_emission_point', e: Event) {
    const input = e.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 3);
    form[field] = digits;
    fieldErrors[field] = validateSriCodeLive(digits);
  }

  function onSriCodeBlur(field: 'sri_establishment_code' | 'sri_emission_point') {
    const val = form[field].replace(/\D/g, '');
    if (val.length > 0 && val.length <= 3) {
      form[field] = val.padStart(3, '0');
    }
    fieldErrors[field] = validateSriCodeLive(form[field]);
  }

  function onPhoneInput(e: Event) {
    const input = e.target as HTMLInputElement;
    let val = input.value;
    // Si el usuario borra el prefijo, lo restaura automáticamente
    if (val && !val.startsWith('+593') && val.startsWith('+')) {
      // deja que escriban otro prefijo libremente
    } else if (val && !val.startsWith('+')) {
      val = '+593 ' + val.replace(/^\s+/, '');
      form.issuer_phone = val;
    }
  }

  function onCurrencyCodeInput(e: Event) {
    const input = e.target as HTMLInputElement;
    form.currency_code = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  }

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
    // Validar antes de guardar
    fieldErrors.issuer_ruc             = validateRucLive(form.issuer_ruc);
    fieldErrors.sri_establishment_code = validateSriCodeLive(form.sri_establishment_code);
    fieldErrors.sri_emission_point     = validateSriCodeLive(form.sri_emission_point);

    const hasErrors = Object.values(fieldErrors).some(v => v && v.length > 0);
    if (hasErrors) {
      saveError = 'Corrija los errores de validación antes de guardar.';
      return;
    }

    saving      = true;
    saveError   = '';
    saveSuccess = false;
    try {
      const token = localStorage.getItem('employee_token');

      const dataTypeMap: Record<keyof FormData, string> = {
        issuer_name: 'string', issuer_ruc: 'string', issuer_address: 'string',
        issuer_city: 'string', issuer_country: 'string', issuer_email: 'string',
        issuer_phone: 'string', tax_rate: 'float', tax_name: 'string',
        tax_id_label: 'string', currency_code: 'string', currency_symbol: 'string',
        sri_establishment_code: 'string', sri_emission_point: 'string',
        invoice_due_days: 'integer', grace_period_days: 'integer',
        auto_payment_retry_days: 'integer',
      };

      const groupMap: Record<keyof FormData, string> = {
        issuer_name: 'issuer', issuer_ruc: 'issuer', issuer_address: 'issuer',
        issuer_city: 'issuer', issuer_country: 'issuer', issuer_email: 'issuer',
        issuer_phone: 'issuer', tax_rate: 'tax', tax_name: 'tax',
        tax_id_label: 'tax', currency_code: 'currency', currency_symbol: 'currency',
        sri_establishment_code: 'legal', sri_emission_point: 'legal',
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
  const inputError = 'w-full rounded-lg border px-3 py-2.5 text-sm text-white bg-neutral-900 border-red-500/60 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/60 transition-colors placeholder-neutral-600';

  function inputClass(field: keyof FormData): string {
    return fieldErrors[field] ? inputError : inputBase;
  }

  function fmtTaxPreview(): string {
    const r = parseFloat(form.tax_rate);
    return isNaN(r) ? '—' : `${(r * 100).toFixed(0)}%`;
  }

  /** Indicador de progreso de RUC */
  function rucProgress(): { digits: number; color: string } {
    const digits = form.issuer_ruc.replace(/\D/g, '').length;
    const color  = digits === 13 && !fieldErrors.issuer_ruc
      ? 'text-emerald-400'
      : digits > 0 ? 'text-amber-400' : 'text-neutral-600';
    return { digits, color };
  }

  onMount(load);
</script>

<div class="px-4 md:px-8 py-8 max-w-3xl">

  <!-- Header -->
  <div class="mb-7">
    <div class="flex items-center gap-2.5 mb-1.5">
      <Receipt class="w-5 h-5 text-primary-400" />
      <h2 class="text-lg font-semibold text-neutral-100">Configuración de Facturación — Ecuador</h2>
    </div>
    <p class="text-sm text-neutral-500">
      Datos fiscales, tasas de IVA y códigos SRI que se graban en cada factura emitida.
      Estos valores quedan <span class="text-neutral-300 font-medium">congelados en el snapshot</span> de cada factura
      y no pueden modificarse retroactivamente.
    </p>
  </div>

  {#if loading}
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
            placeholder="Iron Link S.A." class={inputBase} required />
        </div>

        <!-- RUC con validación en tiempo real -->
        <div class="space-y-1.5">
          <label for="issuer_ruc" class="block text-xs font-medium text-neutral-400">
            RUC <span class="text-red-400">*</span>
          </label>
          <div class="relative">
            <input
              id="issuer_ruc"
              type="text"
              inputmode="numeric"
              value={form.issuer_ruc}
              oninput={onRucInput}
              placeholder="1790123456001"
              class={inputClass('issuer_ruc')}
              maxlength="13"
              required
            />
            {#if form.issuer_ruc.length > 0}
              <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {#if !fieldErrors.issuer_ruc && form.issuer_ruc.replace(/\D/g,'').length === 13}
                  <ShieldCheck class="w-4 h-4 text-emerald-400" />
                {:else}
                  <XCircle class="w-4 h-4 text-amber-400" />
                {/if}
              </span>
            {/if}
          </div>
          {#if fieldErrors.issuer_ruc}
            <p class="text-[11px] text-red-400">{fieldErrors.issuer_ruc}</p>
          {:else}
            {@const rp = rucProgress()}
            <p class="text-[11px] {rp.color}">
              {rp.digits}/13 dígitos — formato Ecuador (ej: <span class="font-mono">1790123456001</span>)
            </p>
          {/if}
        </div>

        <div class="space-y-1.5 sm:col-span-2">
          <label for="issuer_address" class="block text-xs font-medium text-neutral-400">
            Dirección Fiscal <span class="text-red-400">*</span>
          </label>
          <input id="issuer_address" type="text" bind:value={form.issuer_address}
            placeholder="Av. Principal 123 y Secundaria" class={inputBase} required />
        </div>

        <div class="space-y-1.5">
          <label for="issuer_city" class="block text-xs font-medium text-neutral-400">
            Ciudad <span class="text-red-400">*</span>
          </label>
          <input id="issuer_city" type="text" bind:value={form.issuer_city}
            placeholder="Guayaquil" class={inputBase} required />
        </div>

        <div class="space-y-1.5">
          <label for="issuer_country" class="block text-xs font-medium text-neutral-400">
            País <span class="text-red-400">*</span>
          </label>
          <input id="issuer_country" type="text" bind:value={form.issuer_country}
            placeholder="Ecuador" class={inputBase} required />
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
          <input
            id="issuer_phone"
            type="text"
            bind:value={form.issuer_phone}
            oninput={onPhoneInput}
            placeholder="+593 99 123 4567"
            class={inputBase}
          />
          <p class="text-[11px] text-neutral-500">Móvil: +593 9X XXX XXXX · Fijo: +593 X XXX XXXX</p>
        </div>

      </div>
    </fieldset>

    <!-- ── Sección 2: Impuestos ──────────────────────────────────────────── -->
    <fieldset class="rounded-xl border border-neutral-800 bg-surface-elevated overflow-hidden">
      <legend class="sr-only">Configuración de impuestos</legend>
      <div class="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-800">
        <BadgePercent class="w-4 h-4 text-primary-400" />
        <span class="text-sm font-semibold text-neutral-200">Impuestos (IVA)</span>
        <span class="ml-auto flex items-center gap-1 text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <Eye class="w-2.5 h-2.5" /> Público
        </span>
      </div>
      <div class="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div class="space-y-1.5">
          <label for="tax_rate" class="block text-xs font-medium text-neutral-400">
            Tasa de IVA <span class="text-red-400">*</span>
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
            Etiqueta ID Fiscal Cliente
          </label>
          <input id="tax_id_label" type="text" bind:value={form.tax_id_label}
            placeholder="RUC" class={inputBase} />
          <p class="text-[11px] text-neutral-500">Aparece en la factura junto al ID del cliente</p>
        </div>

      </div>

      <div class="mx-5 mb-5 flex items-center gap-2 p-3 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
        <Info class="w-3.5 h-3.5 text-primary-400 shrink-0" />
        <p class="text-xs text-neutral-400">
          Tasa activa: <span class="text-white font-semibold">{fmtTaxPreview()}</span>
          — Ecuador aplica IVA del <span class="text-neutral-300">15%</span> (Decreto Ejecutivo 470, confirmado para 2026).
          Use <code class="text-neutral-300">0.15</code> para 15% · <code class="text-neutral-300">0</code> para exento.
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
          <input
            id="currency_code"
            type="text"
            maxlength="3"
            value={form.currency_code}
            oninput={onCurrencyCodeInput}
            placeholder="USD"
            class={inputBase}
            required
          />
          <p class="text-[11px] text-neutral-500">Ecuador usa <code class="text-neutral-400">USD</code> (dolarizado desde 2000)</p>
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

    <!-- ── Sección 4: Datos SRI / Numeración ────────────────────────────── -->
    <fieldset class="rounded-xl border border-neutral-800 bg-surface-elevated overflow-hidden">
      <legend class="sr-only">Datos SRI</legend>
      <div class="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-800">
        <Landmark class="w-4 h-4 text-primary-400" />
        <span class="text-sm font-semibold text-neutral-200">Numeración SRI</span>
        <span class="ml-auto flex items-center gap-1 text-[10px] font-mono text-emerald-500/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <Eye class="w-2.5 h-2.5" /> Público
        </span>
      </div>
      <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">

        <!-- Código de establecimiento -->
        <div class="space-y-1.5">
          <label for="sri_establishment_code" class="block text-xs font-medium text-neutral-400">
            Código de Establecimiento <span class="text-red-400">*</span>
          </label>
          <div class="relative">
            <input
              id="sri_establishment_code"
              type="text"
              inputmode="numeric"
              value={form.sri_establishment_code}
              oninput={(e) => onSriCodeInput('sri_establishment_code', e)}
              onblur={() => onSriCodeBlur('sri_establishment_code')}
              placeholder="001"
              maxlength="3"
              class={inputClass('sri_establishment_code')}
              required
            />
            {#if form.sri_establishment_code && !fieldErrors.sri_establishment_code}
              <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ShieldCheck class="w-4 h-4 text-emerald-400" />
              </span>
            {/if}
          </div>
          {#if fieldErrors.sri_establishment_code}
            <p class="text-[11px] text-red-400">{fieldErrors.sri_establishment_code}</p>
          {:else}
            <p class="text-[11px] text-neutral-500">3 dígitos registrados en SRI (ej: <code class="text-neutral-400">001</code>)</p>
          {/if}
        </div>

        <!-- Punto de emisión -->
        <div class="space-y-1.5">
          <label for="sri_emission_point" class="block text-xs font-medium text-neutral-400">
            Punto de Emisión <span class="text-red-400">*</span>
          </label>
          <div class="relative">
            <input
              id="sri_emission_point"
              type="text"
              inputmode="numeric"
              value={form.sri_emission_point}
              oninput={(e) => onSriCodeInput('sri_emission_point', e)}
              onblur={() => onSriCodeBlur('sri_emission_point')}
              placeholder="001"
              maxlength="3"
              class={inputClass('sri_emission_point')}
              required
            />
            {#if form.sri_emission_point && !fieldErrors.sri_emission_point}
              <span class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ShieldCheck class="w-4 h-4 text-emerald-400" />
              </span>
            {/if}
          </div>
          {#if fieldErrors.sri_emission_point}
            <p class="text-[11px] text-red-400">{fieldErrors.sri_emission_point}</p>
          {:else}
            <p class="text-[11px] text-neutral-500">3 dígitos registrados en SRI (ej: <code class="text-neutral-400">001</code>)</p>
          {/if}
        </div>

      </div>

      <!-- Preview del formato de factura -->
      <div class="mx-5 mb-5 flex items-center gap-2 p-3 rounded-lg bg-neutral-800/60 border border-neutral-700/50">
        <Info class="w-3.5 h-3.5 text-primary-400 shrink-0" />
        <p class="text-xs text-neutral-400">
          Las facturas se numerarán como:
          <code class="text-white font-semibold ml-1">
            {form.sri_establishment_code || '001'}-{form.sri_emission_point || '001'}-000000001
          </code>
          (secuencial de 9 dígitos, estrictamente ascendente según SRI Ecuador)
        </p>
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
