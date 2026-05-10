<script lang="ts">
  import {
    XIcon, Loader2, CrosshairIcon, SearchIcon, CheckCircleIcon, XCircleIcon,
    User, Settings, MapPin, UserPlus
  } from '@lucide/svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { createEventDispatcher } from 'svelte';
  import { API_BASE } from '$lib/config';
  import { onMount } from 'svelte';
  import { processIpInput, validateIp, parseGpsCoordinates, validateGps } from '$lib/utils/input-formatters';

  interface NewClientPrefill {
    name: string;
    email: string;
    phone: string;
    plan: string;
    status?: 'active' | 'suspended' | 'inactive';
  }

  interface ClientForm {
    full_name: string;
    document_id: string;
    contact_phone: string;
    email: string;
    password: string;
    installation_address: string;
    gps_coordinates: string;
    contract_date: string;
    service_status: 'ACTIVE' | 'LIMITED' | 'SUSPENDED' | 'CANCELLED';
    ip: string;
    observations: string;
    plan: string;
    plan_id?: number;
  }

  const props = $props<{
    newClient: NewClientPrefill | null;
    showAddClient: boolean;
    handleAddClient?: () => void;
  }>();

  const dispatch = createEventDispatcher();

  let loading = $state(false);
  let errorMsg = $state('');
  let fieldErrors = $state<Record<string, string[]>>({});
  let errorId = $state<string | null>(null);
  let geoLoading = $state(false);
  let coordsError = $state<string | null>(null);

  // GPS + IP — formateo y validación en tiempo real
  let gpsRaw = $state('');
  let gpsValidation = $derived(validateGps(gpsRaw));
  let ipRaw = $state('');
  let ipValidation = $derived(validateIp(ipRaw));
  let ipCheckLoading = $state(false);
  let ipCheckError = $state<string | null>(null);
  let ipCheckStatus = $state<'available' | 'in_use_db' | 'in_use_router' | 'in_use_both' | null>(null);

  type PlanOption = { id: number; name: string };
  let plans = $state<PlanOption[]>([]);
  let plansLoading = $state(false);
  let plansError = $state<string | null>(null);

  let form = $state<ClientForm>({
    full_name: '',
    document_id: '',
    contact_phone: '',
    email: '',
    password: '',
    installation_address: '',
    gps_coordinates: '',
    contract_date: '',
    service_status: 'ACTIVE',
    ip: '',
    observations: '',
    plan: '',
    plan_id: undefined
  });

  let prefilled = false;
  $effect(() => {
    if (!props.showAddClient) { prefilled = false; return; }
    if (props.showAddClient && !prefilled) {
      form.full_name    = (props.newClient?.name  || form.full_name);
      form.email        = (props.newClient?.email || form.email);
      form.contact_phone = (props.newClient?.phone || form.contact_phone);
      form.plan         = (props.newClient?.plan  || form.plan);
      prefilled = true;
    }
  });

  async function loadPlans() {
    plansLoading = true;
    plansError = null;
    try {
      const res = await fetch(`${API_BASE}/plans/names`, { headers: { Accept: 'application/json' } });
      let payload: any = null;
      try { payload = await res.json(); } catch {}
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      plans = list.map((p: any) => ({ id: Number(p.id), name: String(p.name) }));
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
    const selectedId = Number(target.value || 0) || undefined;
    form.plan_id = selectedId;
    const selected = plans.find(p => p.id === selectedId);
    form.plan = selected?.name || '';
  }

  function getCurrentCoords() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    coordsError = null;
    try {
      if (typeof navigator.permissions !== 'undefined') {
        navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((p) => {
          if (p.state === 'denied') coordsError = 'Permiso de ubicación denegado en el navegador';
        }).catch(() => {});
      }
    } catch {}
    geoLoading = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const formatted = `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
        form.gps_coordinates = formatted;
        gpsRaw = formatted;   // sincronizar el campo visible
        geoLoading = false;
      },
      (err) => {
        if (err.code === 1)      coordsError = 'Permiso de ubicación denegado';
        else if (err.code === 2) coordsError = 'Ubicación no disponible';
        else if (err.code === 3) coordsError = 'Tiempo de espera agotado';
        else                     coordsError = 'No se pudo obtener la ubicación';
        geoLoading = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
    // Clear stale check result when the IP changes
    ipCheckError = null;
    ipCheckStatus = null;
  }

  function handleIpBlur() {
    if (ipRaw.endsWith('.')) {
      ipRaw = ipRaw.slice(0, -1);
      form.ip = ipRaw;
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
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('employee_token')) || '';
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/mikrotik/ip/check?ip=${encodeURIComponent(ip)}`, { method: 'GET', headers });
      let payload: any = null;
      try { payload = await res.json(); } catch {}
      if (!res.ok) ipCheckError = payload?.message || `Error ${res.status}`;
      else ipCheckStatus = payload?.data?.status || null;
    } catch { ipCheckError = 'Error de red'; }
    finally { ipCheckLoading = false; }
  }

  async function submit() {
    errorMsg = '';
    fieldErrors = {};
    errorId = null;
    loading = true;
    try {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('employee_token')) || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = `${API_BASE}/admin/clientes/crear`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          full_name: form.full_name,
          document_id: form.document_id,
          contact_phone: form.contact_phone,
          email: form.email,
          password: form.password,
          installation_address: form.installation_address,
          gps_coordinates: form.gps_coordinates || null,
          contract_date: form.contract_date,
          service_status: form.service_status,
          ip: form.ip || undefined,
          observations: form.observations || null,
          plan: form.plan || undefined,
          plan_id: form.plan_id || undefined
        })
      });

      if (res.ok) {
        const client = await res.json();
        dispatch('created', client);
        dispatch('close', { open: false });
        form = {
          full_name: '', document_id: '', contact_phone: '', email: '', password: '',
          installation_address: '', gps_coordinates: '', contract_date: '',
          service_status: 'ACTIVE', ip: '', observations: '', plan: '', plan_id: undefined
        };
        gpsRaw = '';
        ipRaw = '';
        return;
      }

      if (res.status === 422) {
        let payload: any = null;
        try { payload = await res.json(); } catch {}
        fieldErrors = (payload && payload.errors) || {};
        errorId = payload?.error_id || null;
        errorMsg = (payload && payload.message) || 'Errores de validación.';
      } else if (res.status === 404) {
        let msg = '';
        try { const data = await res.json(); msg = data?.message || data?.error || ''; errorId = data?.error_id || null; }
        catch { try { msg = await res.text(); } catch { msg = ''; } }
        errorMsg = msg || `Ruta no encontrada: ${url}`;
      } else if (res.status === 401) {
        let payload: any = null;
        try { payload = await res.json(); } catch {}
        errorId = payload?.error_id || null;
        errorMsg = (payload?.message || 'No autenticado. Verifique su token.') as string;
      } else {
        let msg = '';
        try { const data = await res.json(); msg = data?.message || data?.error || ''; errorId = data?.error_id || null; }
        catch { try { msg = await res.text(); } catch { msg = ''; } }
        errorMsg = msg || `Error ${res.status}: No se pudo crear el cliente`;
      }
    } catch (e) {
      console.error('[CrearCliente] Error de red/servidor:', e);
      errorMsg = 'Error de red o del servidor.';
    } finally {
      loading = false;
    }
  }

  const animation =
    'transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog
    open={props.showAddClient}
    closeOnEscape
    closeOnInteractOutside
    onOpenChange={() => { dispatch('close', { open: false }); }}
>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-40 bg-surface-base/70 backdrop-blur-sm" />

        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content
                class="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-white/[0.08] shadow-2xl bg-surface-card overflow-hidden {animation}"
                aria-label="Agregar nuevo cliente"
            >
                <!-- Encabezado del modal -->
                <header class="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="size-8 rounded-lg bg-primary-600/15 flex items-center justify-center border border-primary-500/20">
                            <UserPlus class="size-4 text-primary-400" aria-hidden="true" />
                        </div>
                        <div>
                            <Dialog.Title class="text-sm font-bold text-text-primary">Nuevo Cliente</Dialog.Title>
                            <p class="text-[11px] text-text-muted">Completa los datos para registrar al cliente</p>
                        </div>
                    </div>
                    <Dialog.CloseTrigger
                        class="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <XIcon class="size-4" />
                    </Dialog.CloseTrigger>
                </header>

                <!-- Contenido del formulario -->
                <div class="flex-1 overflow-y-auto p-6 scrollbar-isp">
                    <div class="space-y-5">

                        <!-- Alerta de error global -->
                        {#if errorMsg}
                            <div
                                class="text-sm text-danger-400 bg-danger-500/10 border border-danger-700/40 rounded-xl p-3.5 flex items-start gap-3"
                                role="alert"
                            >
                                <div class="size-4 rounded-full bg-danger-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                    <XCircleIcon class="size-3 text-danger-400" aria-hidden="true" />
                                </div>
                                <div>
                                    <p>{errorMsg}</p>
                                    {#if errorId}
                                        <p class="text-xs text-danger-600 mt-0.5">Ref: {errorId}</p>
                                    {/if}
                                </div>
                            </div>
                        {/if}

                        <!-- Sección: Información Personal -->
                        <div class="isp-card">
                            <div class="isp-section-header">
                                <User class="size-4 text-primary-400" aria-hidden="true" />
                                <h3 class="text-xs font-bold text-text-secondary uppercase tracking-widest">
                                    Información Personal
                                </h3>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="md:col-span-2">
                                    <label class="isp-label" for="m_full_name">Nombre Completo</label>
                                    <input
                                        id="m_full_name"
                                        type="text"
                                        placeholder="Juan García López"
                                        bind:value={form.full_name}
                                        aria-required="true"
                                        class="isp-input"
                                    />
                                    {#if fieldErrors.full_name}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.full_name[0]}</p>
                                    {/if}
                                </div>

                                <div>
                                    <label class="isp-label" for="m_document_id">Documento de Identidad</label>
                                    <input
                                        id="m_document_id"
                                        type="text"
                                        placeholder="V-12345678"
                                        bind:value={form.document_id}
                                        class="isp-input"
                                    />
                                    {#if fieldErrors.document_id}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.document_id[0]}</p>
                                    {/if}
                                </div>

                                <div>
                                    <label class="isp-label" for="m_contract_date">Fecha de Contrato</label>
                                    <input
                                        id="m_contract_date"
                                        type="date"
                                        bind:value={form.contract_date}
                                        class="isp-input"
                                    />
                                    {#if fieldErrors.contract_date}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.contract_date[0]}</p>
                                    {/if}
                                </div>

                                <div>
                                    <label class="isp-label" for="m_email">Correo Electrónico</label>
                                    <input
                                        id="m_email"
                                        type="email"
                                        placeholder="cliente@email.com"
                                        bind:value={form.email}
                                        class="isp-input"
                                    />
                                    {#if fieldErrors.email}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.email[0]}</p>
                                    {/if}
                                </div>

                                <div>
                                    <label class="isp-label" for="m_contact_phone">Teléfono de Contacto</label>
                                    <input
                                        id="m_contact_phone"
                                        type="tel"
                                        placeholder="+58 412 000 0000"
                                        bind:value={form.contact_phone}
                                        class="isp-input"
                                    />
                                    {#if fieldErrors.contact_phone}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.contact_phone[0]}</p>
                                    {/if}
                                </div>

                                <div>
                                    <label class="isp-label" for="m_password">Contraseña de Acceso</label>
                                    <input
                                        id="m_password"
                                        type="password"
                                        placeholder="Mínimo 6 caracteres"
                                        bind:value={form.password}
                                        class="isp-input"
                                    />
                                    {#if fieldErrors.password}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.password[0]}</p>
                                    {/if}
                                </div>
                            </div>
                        </div>

                        <!-- Sección: Configuración del Servicio -->
                        <div class="isp-card">
                            <div class="isp-section-header">
                                <Settings class="size-4 text-primary-400" aria-hidden="true" />
                                <h3 class="text-xs font-bold text-text-secondary uppercase tracking-widest">
                                    Configuración del Servicio
                                </h3>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="isp-label" for="m_service_status">Estado Inicial</label>
                                    <select
                                        id="m_service_status"
                                        bind:value={form.service_status}
                                        class="isp-input appearance-none cursor-pointer"
                                    >
                                        <option value="ACTIVE">Activo</option>
                                        <option value="LIMITED">Limitado</option>
                                        <option value="SUSPENDED">Suspendido</option>
                                        <option value="CANCELLED">Cancelado</option>
                                    </select>
                                </div>

                                <div>
                                    <label class="isp-label" for="m_plan">Plan de Servicio</label>
                                    <select
                                        id="m_plan"
                                        onchange={handleSelectPlan}
                                        class="isp-input appearance-none cursor-pointer"
                                    >
                                        <option value="">Seleccionar plan</option>
                                        {#if plansLoading}
                                            <option disabled>Cargando planes...</option>
                                        {:else if plansError}
                                            <option disabled>{plansError}</option>
                                        {:else}
                                            {#each plans as p}
                                                <option value={p.id} selected={form.plan_id === p.id}>{p.name}</option>
                                            {/each}
                                        {/if}
                                    </select>
                                </div>

                                <!-- Dirección IP con verificación -->
                                <div>
                                    <label class="isp-label" for="m_ip">
                                        Dirección IP
                                        <span class="text-text-disabled font-normal normal-case tracking-normal ml-1">(opcional)</span>
                                    </label>
                                    <div class="relative">
                                        <input
                                            id="m_ip"
                                            type="text"
                                            placeholder="192.168.1.10"
                                            value={ipRaw}
                                            oninput={handleIpInput}
                                            onblur={handleIpBlur}
                                            autocomplete="off"
                                            maxlength="15"
                                            class="isp-input pr-9 transition-all
                                                   {ipValidation.state === 'valid'   ? 'border-success-600/50 focus-visible:ring-success-500'  :
                                                    ipValidation.state === 'invalid' ? 'border-danger-600/50  focus-visible:ring-danger-500'   : ''}"
                                        />
                                        {#if ipRaw}
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
                                                    <CheckCircleIcon class="size-3.5 text-success-400" />
                                                {:else if ipCheckStatus}
                                                    <XCircleIcon class="size-3.5 text-danger-400" />
                                                {:else}
                                                    <SearchIcon class="size-3.5" />
                                                {/if}
                                            </button>
                                        {/if}
                                    </div>

                                    {#if fieldErrors.ip}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.ip[0]}</p>
                                    {:else if ipValidation.state === 'invalid'}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{ipValidation.message}</p>
                                    {:else if ipCheckError}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{ipCheckError}</p>
                                    {:else if ipCheckStatus === 'available'}
                                        <p class="text-xs text-success-400 mt-1 flex items-center gap-1">
                                            <CheckCircleIcon class="size-3" aria-hidden="true" /> IP disponible
                                        </p>
                                    {:else if ipCheckStatus === 'in_use_db'}
                                        <p class="text-xs text-warning-400 mt-1">IP asignada en la base de datos</p>
                                    {:else if ipCheckStatus === 'in_use_router'}
                                        <p class="text-xs text-warning-400 mt-1">IP en uso en el router</p>
                                    {:else if ipCheckStatus === 'in_use_both'}
                                        <p class="text-xs text-danger-400 mt-1">IP en uso en DB y router</p>
                                    {:else if ipValidation.state === 'valid'}
                                        <p class="text-xs text-text-muted mt-1 flex items-center gap-1">
                                            <SearchIcon class="size-3" aria-hidden="true" /> Formato correcto — verifica disponibilidad
                                        </p>
                                    {/if}
                                </div>
                            </div>
                        </div>

                        <!-- Sección: Ubicación -->
                        <div class="isp-card">
                            <div class="isp-section-header">
                                <MapPin class="size-4 text-success-400" aria-hidden="true" />
                                <h3 class="text-xs font-bold text-text-secondary uppercase tracking-widest">
                                    Ubicación
                                </h3>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="md:col-span-2">
                                    <label class="isp-label" for="m_installation_address">Dirección de Instalación</label>
                                    <textarea
                                        id="m_installation_address"
                                        rows="2"
                                        placeholder="Calle, número, sector, referencias..."
                                        bind:value={form.installation_address}
                                        class="isp-input resize-none"
                                    ></textarea>
                                    {#if fieldErrors.installation_address}
                                        <p class="text-xs text-danger-400 mt-1" role="alert">{fieldErrors.installation_address[0]}</p>
                                    {/if}
                                </div>

                                <div>
                                    <label class="isp-label" for="m_gps_coordinates">
                                        Coordenadas GPS
                                        <span class="text-text-disabled font-normal normal-case tracking-normal ml-1">(opcional)</span>
                                    </label>
                                    <div class="relative">
                                        <input
                                            id="m_gps_coordinates"
                                            type="text"
                                            placeholder="Ej: 10.5012,-66.9123"
                                            value={gpsRaw}
                                            oninput={handleGpsInput}
                                            onblur={handleGpsBlur}
                                            autocomplete="off"
                                            spellcheck="false"
                                            maxlength="30"
                                            aria-describedby="gps-hint"
                                            class="isp-input pr-9 transition-all
                                                   {gpsValidation.state === 'valid'   ? 'border-success-600/50 focus-visible:ring-success-500' :
                                                    gpsValidation.state === 'invalid' ? 'border-danger-600/50  focus-visible:ring-danger-500'  : ''}"
                                        />
                                        <button
                                            type="button"
                                            onclick={getCurrentCoords}
                                            disabled={geoLoading}
                                            aria-label="Obtener mi ubicación actual (GPS)"
                                            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary-400 disabled:opacity-50 transition-colors"
                                        >
                                            {#if geoLoading}
                                                <Loader2 class="size-3.5 animate-spin" />
                                            {:else}
                                                <CrosshairIcon class="size-3.5" />
                                            {/if}
                                        </button>
                                    </div>

                                    <!-- Retroalimentación en tiempo real -->
                                    {#if coordsError}
                                        <p class="text-xs text-danger-400 mt-1.5 flex items-center gap-1" role="alert" id="gps-hint">
                                            <XCircleIcon class="size-3 shrink-0" aria-hidden="true" />
                                            {coordsError}
                                        </p>
                                    {:else if gpsValidation.state === 'valid'}
                                        <p class="text-xs text-success-400 mt-1.5 flex items-center gap-1.5" id="gps-hint">
                                            <CheckCircleIcon class="size-3 shrink-0" aria-hidden="true" />
                                            <span class="font-mono tabular-nums tracking-wide">
                                                {gpsValidation.parsed!.lat.toFixed(6)}, {gpsValidation.parsed!.lon.toFixed(6)}
                                            </span>
                                        </p>
                                    {:else if gpsValidation.state === 'invalid'}
                                        <p class="text-xs text-danger-400 mt-1.5 flex items-center gap-1" role="alert" id="gps-hint">
                                            <XCircleIcon class="size-3 shrink-0" aria-hidden="true" />
                                            {gpsValidation.message}
                                        </p>
                                    {:else if gpsRaw.trim().length > 2}
                                        <p class="text-xs text-text-muted mt-1.5" id="gps-hint">
                                            Formatos: <span class="font-mono text-text-secondary">lat,lon</span>
                                            · <span class="font-mono text-text-secondary">lat lon</span>
                                            · <span class="font-mono text-text-secondary">10,5 -66,9</span>
                                        </p>
                                    {:else}
                                        <p class="text-[10px] text-text-disabled mt-1" id="gps-hint">
                                            Pega desde Google Maps o usa el botón de ubicación
                                        </p>
                                    {/if}
                                </div>

                                <div>
                                    <label class="isp-label" for="m_observations">
                                        Observaciones
                                        <span class="text-text-disabled font-normal normal-case tracking-normal ml-1">(opcional)</span>
                                    </label>
                                    <textarea
                                        id="m_observations"
                                        rows="2"
                                        placeholder="Notas adicionales sobre el cliente..."
                                        bind:value={form.observations}
                                        class="isp-input resize-none"
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Pie del modal -->
                <footer class="flex justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-surface-card shrink-0">
                    <Dialog.CloseTrigger class="isp-btn-ghost">
                        Cancelar
                    </Dialog.CloseTrigger>
                    <button
                        type="button"
                        onclick={submit}
                        disabled={loading}
                        class="isp-btn-primary"
                        aria-label={loading ? 'Registrando cliente...' : 'Registrar cliente'}
                    >
                        {#if loading}
                            <Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
                            Registrando...
                        {:else}
                            <UserPlus class="size-3.5" aria-hidden="true" />
                            Registrar Cliente
                        {/if}
                    </button>
                </footer>
            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>
