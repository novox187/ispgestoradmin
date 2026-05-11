<script lang="ts">
  import {
    X, Loader2, Crosshair, Search, CheckCircle, XCircle, AlertTriangle,
    Save, Phone, Mail, MapPin, CreditCard, Edit3, User, Settings, FileText, Wallet
  } from '@lucide/svelte';
  import { createEventDispatcher, onMount, untrack } from 'svelte';
  import { API_BASE } from '$lib/config';
  import { toast } from 'svelte-sonner';
  import { processIpInput, validateIp, parseGpsCoordinates, validateGps } from '$lib/utils/input-formatters';

  interface Client {
    id: number;
    name?: string;
    full_name?: string;
    document_id?: string;
    dni?: string;
    phone?: string;
    contact_phone?: string;
    email?: string;
    address?: string;
    installation_address?: string;
    coordinates?: string;
    gps_coordinates?: string;
    contract_date?: string;
    status?: string;
    service_status?: string;
    ip_address?: string;
    ip?: string;
    notes?: string;
    observations?: string;
    current_plan_id?: number;
    client_plans?: { plan_id: number }[];
    wallet_balance?: number | string;
    balance?: number | string;
    wallet?: { balance?: number | string };
    [key: string]: any;
  }

  let {
    client = null,
    onClose = () => {}
  }: {
    client?: Client | null;
    onClose?: () => void;
  } = $props();

  const dispatch = createEventDispatcher();

  let loading = $state(false);
  let errorMsg = $state('');
  let fieldErrors = $state<Record<string, string[]>>({});

  let geoLoading = $state(false);
  let coordsError = $state<string | null>(null);
  let ipCheckLoading = $state(false);
  let ipCheckError = $state<string | null>(null);
  let ipCheckStatus = $state<'available' | 'in_use_db' | 'in_use_router' | 'in_use_both' | null>(null);

  // IP + GPS — formateo y validación en tiempo real
  let ipRaw = $state('');
  let ipValidation = $derived(validateIp(ipRaw));
  let gpsRaw = $state('');
  let gpsValidation = $derived(validateGps(gpsRaw));

  type PlanOption = {
    id: number;
    name: string;
    monthly_price: number;
    download: number;
    upload: number;
    can_add_next_client?: boolean;
    next_client_required_down_mbps?: number;
  };
  let plans = $state<PlanOption[]>([]);
  let plansLoading = $state(false);
  let plansError = $state<string | null>(null);

  let isEditing = $state(false);
  let initialForm = $state<typeof form | null>(null);
  let form = $state({
    full_name: '',
    document_id: '',
    contact_phone: '',
    email: '',
    installation_address: '',
    gps_coordinates: '',
    contract_date: '',
    service_status: 'ACTIVE',
    ip: '',
    observations: '',
    plan_id: undefined as number | undefined,
    reason: ''
  });

  let originalPlanId = $state<number | undefined>(undefined);
  let selectedPlan = $derived(plans.find(p => p.id === form.plan_id));
  let walletBalance = $derived.by(() => {
    const raw = client?.wallet_balance ?? client?.balance ?? client?.wallet?.balance;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  });

  let currentClientId = $state<number | null>(null);

  $effect(() => {
    if (client && client.id !== currentClientId) {
      currentClientId = client.id;
      untrack(() => initForm(client));
    }
  });

  function initForm(c: Client) {
    let rawStatus = c.service_status?.toUpperCase() || 'ACTIVE';
    const validStatuses = ['ACTIVE', 'LIMITED', 'SUSPENDED', 'CANCELLED'];
    if (!validStatuses.includes(rawStatus)) {
      rawStatus = rawStatus === 'INACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    }

    form = {
      full_name: c.name || c.full_name || '',
      document_id: c.document_id || c.dni || '',
      contact_phone: c.phone || c.contact_phone || '',
      email: c.email || '',
      installation_address: c.address || c.installation_address || '',
      gps_coordinates: c.coordinates || c.gps_coordinates || '',
      contract_date: c.contract_date || '',
      service_status: rawStatus,
      ip: c.ip_address || c.ip || '',
      observations: c.notes || c.observations || '',
      plan_id: c.current_plan_id || (c.client_plans?.[0]?.plan_id) || undefined,
      reason: ''
    };
    originalPlanId = form.plan_id;
    initialForm = { ...form };
    ipRaw = form.ip;
    gpsRaw = form.gps_coordinates;
  }

  async function loadPlans() {
    plansLoading = true;
    plansError = null;
    try {
      const token = localStorage.getItem('employee_token');
      const res = await fetch(`${API_BASE}/plans`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
      });
      let payload: any = null;
      try { payload = await res.json(); } catch {}
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      plans = list.map((p: any) => ({
        id: Number(p.id),
        name: String(p.name),
        monthly_price: Number(p.monthly_price),
        download: Number(p.download_speed),
        upload: Number(p.upload_speed),
        can_add_next_client: Boolean(p.can_add_next_client ?? true),
        next_client_required_down_mbps: Number(p.next_client_required_down_mbps ?? 0)
      }));
    } catch (e) {
      console.error('Error cargando planes:', e);
      plansError = 'No se pudieron cargar los planes.';
    } finally {
      plansLoading = false;
    }
  }

  onMount(() => { loadPlans(); });

  function handleSelectPlan(e: Event) {
    const target = e.target as HTMLSelectElement;
    form.plan_id = Number(target.value || 0) || undefined;
  }

  let hasChanges = $derived.by(() => {
    if (!initialForm) return false;
    const keys = Object.keys(form).filter(k => k !== 'reason') as (keyof typeof form)[];
    return keys.some(key => form[key] !== initialForm![key]);
  });

  function getCurrentCoords() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    coordsError = null;
    geoLoading = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const formatted = `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
        form.gps_coordinates = formatted;
        gpsRaw = formatted;
        geoLoading = false;
      },
      () => { coordsError = 'Error al obtener ubicación'; geoLoading = false; },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function handleIpInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const cursor = input.selectionStart ?? input.value.length;
    const oldValue = input.value;
    const next = processIpInput(input.value, ipRaw);
    ipRaw = next;
    form.ip = next;
    if (next !== oldValue) {
      const delta = next.length - oldValue.length;
      const newPos = Math.max(0, Math.min(cursor + delta, next.length));
      requestAnimationFrame(() => input.setSelectionRange(newPos, newPos));
    }
    ipCheckError = null;
    ipCheckStatus = null;
  }

  function handleIpBlur() {
    if (ipRaw.endsWith('.')) {
      ipRaw = ipRaw.slice(0, -1);
      form.ip = ipRaw;
    }
  }

  function handleGpsInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    gpsRaw = raw;
    const parsed = parseGpsCoordinates(raw);
    form.gps_coordinates = parsed
      ? `${parsed.lat.toFixed(6)},${parsed.lon.toFixed(6)}`
      : raw;
  }

  function handleGpsBlur() {
    const parsed = parseGpsCoordinates(gpsRaw);
    if (parsed) {
      const formatted = `${parsed.lat.toFixed(6)},${parsed.lon.toFixed(6)}`;
      gpsRaw = formatted;
      form.gps_coordinates = formatted;
    }
  }

  async function checkIp() {
    ipCheckError = null;
    ipCheckStatus = null;
    const ip = form.ip.trim();
    if (!ip || ipValidation.state !== 'valid') { ipCheckError = ipValidation.message || 'Ingrese una IP válida (ej: 192.168.1.10)'; return; }
    ipCheckLoading = true;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      const token = localStorage.getItem('employee_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/mikrotik/ip/check?ip=${encodeURIComponent(ip)}`, { headers });
      let payload: any = null;
      try { payload = await res.json(); } catch {}
      if (!res.ok) ipCheckError = payload?.message || `Error ${res.status}`;
      else ipCheckStatus = payload?.data?.status || null;
    } catch { ipCheckError = 'Error de red'; }
    finally { ipCheckLoading = false; }
  }

  async function submit() {
    if (!form.reason || form.reason.trim().length < 5) {
      fieldErrors = { ...fieldErrors, reason: ['Motivo requerido (mín. 5 caracteres).'] };
      toast.error('Debe indicar un motivo para el cambio');
      return;
    }

    errorMsg = '';
    fieldErrors = {};
    loading = true;
    try {
      const token = localStorage.getItem('employee_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (!client) { toast.error('Cliente no válido'); return; }

      const res = await fetch(`${API_BASE}/admin/clientes/${client.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(form)
      });

      if (res.ok) {
        const updatedClient = await res.json();
        dispatch('updated', updatedClient);
        toast.success('Cliente actualizado correctamente');
        initForm(updatedClient.client || updatedClient);
      } else {
        const payload = await res.json().catch(() => ({}));
        if (res.status === 422) {
          fieldErrors = payload.errors || {};
          errorMsg = payload.message || 'Errores de validación.';
        } else if (res.status === 409 && payload?.code === 'ISP_CAPACITY_EXHAUSTED') {
          errorMsg = payload.message || 'Capacidad de ISP agotada';
        } else {
          errorMsg = payload.message || `Error ${res.status}`;
        }
        toast.error(errorMsg);
      }
    } catch (e) {
      console.error('Error actualizando cliente:', e);
      toast.error('Error de red o del servidor');
    } finally {
      loading = false;
    }
  }

  function getInitials(name: string) {
    return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '';
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP',
      minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(amount);
  }

  function statusBadgeClass(s: string) {
    switch (s) {
      case 'ACTIVE':    return 'status-badge-active';
      case 'SUSPENDED': return 'status-badge-suspended';
      case 'CANCELLED': return 'status-badge-cancelled';
      case 'LIMITED':   return 'status-badge-limited';
      default:          return 'status-badge-inactive';
    }
  }

  function statusLabel(s: string) {
    switch (s) {
      case 'ACTIVE':    return 'Activo';
      case 'SUSPENDED': return 'Suspendido';
      case 'CANCELLED': return 'Cancelado';
      case 'LIMITED':   return 'Limitado';
      default:          return s;
    }
  }
</script>

<div class="h-full flex flex-col bg-[#09090fbd] text-text-primary">

    <!-- Encabezado del perfil -->
    <div class="px-5 py-4 border-b border-white/[0.06] bg-[#09090f] shrink-0">
        <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-4">
                <!-- Avatar -->
                <div
                    class="size-14 rounded-2xl bg-gradient-to-br from-primary-700 to-primary-900 flex items-center justify-center text-white text-lg font-bold shadow-xl shrink-0"
                    aria-hidden="true"
                >
                    {getInitials(form.full_name)}
                </div>

                <div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <h2 class="text-base font-bold text-text-primary leading-tight">
                            {form.full_name || 'Sin nombre'}
                        </h2>
                        <button
                            onclick={() => isEditing = !isEditing}
                            aria-pressed={isEditing}
                            aria-label={isEditing ? 'Desactivar edición' : 'Editar cliente'}
                            class="p-1.5 rounded-lg transition-colors
                                   {isEditing
                                       ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/40'
                                       : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'}"
                        >
                            <Edit3 class="size-3.5" />
                        </button>
                    </div>

                    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span class="text-[11px] font-semibold text-text-muted bg-surface-elevated px-2 py-0.5 rounded-full border border-white/[0.06]">
                            ID #{client?.id}
                        </span>
                        <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full {statusBadgeClass(form.service_status)}">
                            {statusLabel(form.service_status)}
                        </span>
                    </div>
                </div>
            </div>

            <button
                onclick={onClose}
                aria-label="Cerrar panel de detalles"
                class="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors shrink-0"
            >
                <X class="size-4" />
            </button>
        </div>

        {#if isEditing}
            <div class="mt-3 px-3 py-2 rounded-lg bg-primary-600/10 border border-primary-500/20 flex items-center gap-2">
                <Edit3 class="size-3.5 text-primary-400 shrink-0" aria-hidden="true" />
                <span class="text-xs text-primary-300 font-medium">Modo edición activo — modifica los campos y guarda los cambios.</span>
            </div>
        {/if}
    </div>

    <!-- Contenido desplazable -->
    <div class="flex-1 overflow-y-auto p-5 scrollbar-isp">
        <div class="max-w-4xl mx-auto space-y-5">

            <!-- Error global -->
            {#if errorMsg}
                <div class="text-sm text-danger-400 bg-danger-500/10 border border-danger-700/40 rounded-xl p-3 flex items-start gap-3" role="alert">
                    <AlertTriangle class="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{errorMsg}</span>
                </div>
            {/if}

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

                <!-- Información básica -->
                <fieldset class="isp-card" aria-label="Información básica">
                    <div class="isp-section-header">
                        <User class="size-4 text-primary-400" aria-hidden="true" />
                        <legend class="text-xs font-bold text-text-secondary uppercase tracking-widest">
                            Información Básica
                        </legend>
                    </div>

                    <div>
                        <label class="isp-label" for="full_name">Nombre Completo</label>
                        <input
                            id="full_name"
                            type="text"
                            bind:value={form.full_name}
                            disabled={!isEditing}
                            aria-describedby={fieldErrors.full_name ? 'err-full_name' : undefined}
                            class="isp-input"
                        />
                        {#if fieldErrors.full_name}
                            <p id="err-full_name" class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.full_name[0]}</p>
                        {/if}
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="isp-label" for="document_id">Documento</label>
                            <input
                                id="document_id"
                                type="text"
                                bind:value={form.document_id}
                                disabled={!isEditing}
                                class="isp-input"
                            />
                            {#if fieldErrors.document_id}
                                <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.document_id[0]}</p>
                            {/if}
                        </div>
                        <div>
                            <label class="isp-label" for="service_status">Estado</label>
                            <select
                                id="service_status"
                                bind:value={form.service_status}
                                disabled={!isEditing}
                                class="isp-input appearance-none cursor-pointer"
                            >
                                <option value="ACTIVE">Activo</option>
                                <option value="SUSPENDED">Suspendido</option>
                                <option value="CANCELLED">Cancelado</option>
                                <option value="LIMITED">Limitado</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="isp-label" for="email">Email</label>
                            <div class="relative">
                                <Mail class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                                <input
                                    id="email"
                                    type="email"
                                    bind:value={form.email}
                                    disabled={!isEditing}
                                    class="isp-input pl-9"
                                />
                            </div>
                            {#if fieldErrors.email}
                                <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.email[0]}</p>
                            {/if}
                        </div>
                        <div>
                            <label class="isp-label" for="contact_phone">Teléfono</label>
                            <div class="relative">
                                <Phone class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                                <input
                                    id="contact_phone"
                                    type="tel"
                                    bind:value={form.contact_phone}
                                    disabled={!isEditing}
                                    class="isp-input pl-9"
                                />
                            </div>
                            {#if fieldErrors.contact_phone}
                                <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.contact_phone[0]}</p>
                            {/if}
                        </div>
                    </div>
                </fieldset>

                <!-- Detalles técnicos -->
                <fieldset class="isp-card" aria-label="Detalles técnicos">
                    <div class="isp-section-header">
                        <Settings class="size-4 text-primary-400" aria-hidden="true" />
                        <legend class="text-xs font-bold text-text-secondary uppercase tracking-widest">
                            Detalles Técnicos
                        </legend>
                    </div>

                    <!-- Balance de billetera -->
                    <div>
                        <label class="isp-label" for="wallet_balance">Balance de Billetera</label>
                        <div class="relative">
                            <Wallet class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                            <input
                                id="wallet_balance"
                                type="text"
                                value={formatCurrency(walletBalance)}
                                readonly
                                class="isp-input pl-9 text-success-400 font-semibold"
                                aria-label="Balance: {formatCurrency(walletBalance)}"
                            />
                        </div>
                    </div>

                    <!-- IP con verificación -->
                    <div>
                        <label class="isp-label" for="ip">Dirección IP</label>
                        <div class="relative">
                            <input
                                id="ip"
                                type="text"
                                value={ipRaw}
                                oninput={isEditing ? handleIpInput : undefined}
                                onblur={isEditing ? handleIpBlur : undefined}
                                disabled={!isEditing}
                                placeholder="192.168.1.100"
                                autocomplete="off"
                                maxlength="15"
                                class="isp-input pr-10 transition-all
                                       {isEditing && ipValidation.state === 'valid'   ? 'border-success-600/50 focus-visible:ring-success-500'  :
                                        isEditing && ipValidation.state === 'invalid' ? 'border-danger-600/50  focus-visible:ring-danger-500'   : ''}"
                            />
                            {#if ipRaw && isEditing}
                                <button
                                    type="button"
                                    onclick={checkIp}
                                    disabled={ipCheckLoading || ipValidation.state !== 'valid'}
                                    aria-label="Verificar disponibilidad de IP"
                                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary disabled:opacity-50 transition-colors"
                                >
                                    {#if ipCheckLoading}
                                        <Loader2 class="size-3.5 animate-spin" />
                                    {:else if ipCheckStatus === 'available'}
                                        <CheckCircle class="size-3.5 text-success-400" />
                                    {:else if ipCheckStatus}
                                        <XCircle class="size-3.5 text-danger-400" />
                                    {:else}
                                        <Search class="size-3.5" />
                                    {/if}
                                </button>
                            {/if}
                        </div>
                        {#if fieldErrors.ip}
                            <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.ip[0]}</p>
                        {:else if isEditing && ipValidation.state === 'invalid'}
                            <p class="text-xs text-danger-400 mt-1" role="alert">{ipValidation.message}</p>
                        {:else if ipCheckError}
                            <p class="text-xs text-danger-400 mt-1" role="alert">{ipCheckError}</p>
                        {:else if ipCheckStatus === 'available'}
                            <p class="text-xs text-success-400 mt-1">IP disponible</p>
                        {:else if ipCheckStatus}
                            <p class="text-xs text-warning-400 mt-1">
                                {ipCheckStatus === 'in_use_db' ? 'IP asignada en la base de datos'
                                : ipCheckStatus === 'in_use_router' ? 'IP en uso en el router'
                                : 'IP en uso en DB y router'}
                            </p>
                        {/if}
                    </div>

                    <!-- Plan de servicio -->
                    <div>
                        <label class="isp-label" for="plan">Plan de Servicio</label>
                        <div class="relative">
                            <CreditCard class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                            <select
                                id="plan"
                                onchange={handleSelectPlan}
                                disabled={!isEditing}
                                class="isp-input pl-9 appearance-none cursor-pointer"
                            >
                                <option value="">Seleccionar plan</option>
                                {#if plansLoading}
                                    <option disabled>Cargando planes...</option>
                                {:else}
                                    {#each plans as p}
                                        <option
                                            value={p.id}
                                            selected={form.plan_id === p.id}
                                            disabled={!p.can_add_next_client && originalPlanId !== p.id}
                                        >
                                            {p.name}
                                        </option>
                                    {/each}
                                {/if}
                            </select>
                        </div>
                    </div>

                    <!-- Detalle del plan seleccionado -->
                    {#if selectedPlan}
                        <div class="bg-surface-base rounded-lg p-3 border border-white/[0.06]">
                            <div class="flex justify-between items-center mb-1.5">
                                <span class="text-sm font-semibold text-text-primary">{selectedPlan.name}</span>
                                <span class="text-sm font-bold text-success-400">${selectedPlan.monthly_price}</span>
                            </div>
                            <div class="flex gap-4 text-xs text-text-muted">
                                <span class="flex items-center gap-1">
                                    {selectedPlan.download} Mbps
                                    <span class="text-success-400 font-bold">↓</span>
                                </span>
                                <span class="flex items-center gap-1">
                                    {selectedPlan.upload} Mbps
                                    <span class="text-primary-400 font-bold">↑</span>
                                </span>
                            </div>
                            {#if form.plan_id !== originalPlanId}
                                <div class="mt-2 text-xs text-warning-400 flex items-center gap-1.5">
                                    <AlertTriangle class="size-3.5" aria-hidden="true" />
                                    Cambio de plan detectado
                                </div>
                            {/if}
                        </div>
                    {/if}
                </fieldset>

                <!-- Ubicación -->
                <fieldset class="isp-card" aria-label="Ubicación de instalación">
                    <div class="isp-section-header">
                        <MapPin class="size-4 text-success-400" aria-hidden="true" />
                        <legend class="text-xs font-bold text-text-secondary uppercase tracking-widest">
                            Ubicación
                        </legend>
                    </div>

                    <div>
                        <label class="isp-label" for="installation_address">Dirección de Instalación</label>
                        <textarea
                            id="installation_address"
                            rows="3"
                            bind:value={form.installation_address}
                            disabled={!isEditing}
                            placeholder={isEditing ? 'Calle, número, referencias...' : '—'}
                            class="isp-input resize-none"
                        ></textarea>
                        {#if fieldErrors.installation_address}
                            <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.installation_address[0]}</p>
                        {/if}
                    </div>

                    <div>
                        <label class="isp-label" for="gps_coordinates">Coordenadas GPS</label>
                        <div class="relative">
                            <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                            <input
                                id="gps_coordinates"
                                type="text"
                                value={gpsRaw}
                                oninput={isEditing ? handleGpsInput : undefined}
                                onblur={isEditing ? handleGpsBlur : undefined}
                                disabled={!isEditing}
                                placeholder="10.501200,-66.912300"
                                autocomplete="off"
                                spellcheck="false"
                                maxlength="30"
                                class="isp-input pl-9 pr-10 transition-all
                                       {isEditing && gpsValidation.state === 'valid'   ? 'border-success-600/50 focus-visible:ring-success-500' :
                                        isEditing && gpsValidation.state === 'invalid' ? 'border-danger-600/50  focus-visible:ring-danger-500'  : ''}"
                            />
                            {#if isEditing}
                                <button
                                    type="button"
                                    onclick={getCurrentCoords}
                                    disabled={geoLoading}
                                    aria-label="Obtener mi ubicación actual"
                                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary-400 disabled:opacity-50 transition-colors"
                                >
                                    {#if geoLoading}
                                        <Loader2 class="size-3.5 animate-spin" />
                                    {:else}
                                        <Crosshair class="size-3.5" />
                                    {/if}
                                </button>
                            {/if}
                        </div>
                        {#if coordsError}
                            <p class="text-xs text-danger-400 mt-1" role="alert">{coordsError}</p>
                        {:else if isEditing && gpsValidation.state === 'valid'}
                            <p class="text-xs text-success-400 mt-1 flex items-center gap-1.5">
                                <CheckCircle class="size-3 shrink-0" aria-hidden="true" />
                                <span class="font-mono tabular-nums">
                                    {gpsValidation.parsed!.lat.toFixed(6)}, {gpsValidation.parsed!.lon.toFixed(6)}
                                </span>
                            </p>
                        {:else if isEditing && gpsValidation.state === 'invalid'}
                            <p class="text-xs text-danger-400 mt-1 flex items-center gap-1" role="alert">
                                <XCircle class="size-3 shrink-0" aria-hidden="true" />
                                {gpsValidation.message}
                            </p>
                        {/if}
                    </div>
                </fieldset>

                <!-- Notas internas -->
                <fieldset class="isp-card" aria-label="Notas internas">
                    <div class="isp-section-header">
                        <FileText class="size-4 text-warning-400" aria-hidden="true" />
                        <legend class="text-xs font-bold text-text-secondary uppercase tracking-widest">
                            Notas Internas
                        </legend>
                    </div>

                    <textarea
                        id="observations"
                        rows="6"
                        bind:value={form.observations}
                        disabled={!isEditing}
                        placeholder={isEditing ? 'Agregar nota interna...' : 'Sin notas registradas'}
                        class="isp-input resize-none"
                    ></textarea>
                </fieldset>
            </div>

            <!-- Motivo de auditoría (visible solo al editar con cambios) -->
            {#if hasChanges && isEditing}
                <div
                    class="bg-warning-900/20 border border-warning-600/30 rounded-xl p-5 space-y-2"
                    role="group"
                    aria-label="Campo de motivo de cambio"
                >
                    <label class="block text-sm font-semibold text-warning-400" for="reason">
                        Motivo del cambio
                        <span class="text-xs text-warning-600 font-normal ml-1">(requerido para auditoría)</span>
                    </label>
                    <input
                        id="reason"
                        type="text"
                        bind:value={form.reason}
                        placeholder="Ej: Solicitud del cliente, actualización de plan..."
                        class="w-full px-4 py-2.5 bg-surface-base border border-warning-600/40 rounded-lg text-sm text-text-primary
                               placeholder:text-text-disabled
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-500 transition-all"
                        aria-required="true"
                    />
                    {#if fieldErrors.reason}
                        <p class="text-xs text-danger-400" role="alert">{fieldErrors.reason[0]}</p>
                    {/if}
                </div>
            {/if}

        </div>
    </div>

    <!-- Pie de acciones (solo en modo edición) -->
    {#if isEditing}
        <div class="px-5 py-4 border-t border-white/[0.06] bg-surface-card flex justify-end gap-3 shrink-0">
            <button
                onclick={() => { isEditing = false; if (client) initForm(client); }}
                class="isp-btn-ghost"
                aria-label="Cancelar edición"
            >
                Cancelar
            </button>
            <button
                onclick={submit}
                disabled={loading || !hasChanges}
                class="isp-btn-primary"
                aria-label={loading ? 'Guardando cambios...' : 'Guardar cambios'}
            >
                {#if loading}
                    <Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
                    Guardando...
                {:else}
                    <Save class="size-3.5" aria-hidden="true" />
                    Guardar
                {/if}
            </button>
        </div>
    {/if}
</div>
