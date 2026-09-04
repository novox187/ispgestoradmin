<script lang="ts">
  import {
    Loader2, Crosshair, Search, CheckCircle, XCircle, AlertTriangle,
    Save, Phone, Mail, MapPin, CreditCard, Pencil, User, FileText, Wallet,
    Calendar, Shield, Clock, ArrowDown, ArrowUp, Sparkles, ChevronRight,
    Hash, Globe, X
  } from '@lucide/svelte';
  import { createEventDispatcher, onMount, untrack } from 'svelte';
  import { API_BASE } from '$lib/config';
  import { toast } from 'svelte-sonner';
  import { processIpInput, validateIp, parseGpsCoordinates, validateGps } from '$lib/utils/input-formatters';
  import { formatCurrency } from '$lib/utils/currency';
  import { statusLabel } from '$lib/utils/client-status';
  import { toDateInputValue, todayDateInputValue, formatDate as formatDatePure, relativeFromDate } from '$lib/utils/date-format';

  interface Client { id: number; [key: string]: any }

  let { client = null, canEdit = true }: { client?: Client | null; canEdit?: boolean } = $props();

  const dispatch = createEventDispatcher();

  let loading = $state(false);
  let errorMsg = $state('');
  let fieldErrors = $state<Record<string, string[]>>({});

  let geoLoading = $state(false);
  let coordsError = $state<string | null>(null);
  let ipCheckLoading = $state(false);
  let ipCheckError = $state<string | null>(null);
  let ipCheckStatus = $state<'available' | 'in_use_db' | 'in_use_router' | 'in_use_both' | null>(null);

  let ipRaw = $state('');
  let ipValidation = $derived(validateIp(ipRaw));
  let gpsRaw = $state('');
  let gpsValidation = $derived(validateGps(gpsRaw));

  type PlanOption = {
    id: number; name: string; monthly_price: number;
    download: number; upload: number;
    can_add_next_client?: boolean;
  };
  let plans = $state<PlanOption[]>([]);
  let plansLoading = $state(false);
  let plansError = $state<string | null>(null);

  /**
   * Tiempo límite de las peticiones de esta ficha.
   *
   * Guardar un cliente sincroniza contra el router MikroTik: si el equipo no
   * responde, la petición se queda abierta hasta que el servidor la corta y el
   * operador se queda mirando «Guardando…» sin salida. Se corta antes y se le
   * dice qué pasó y qué puede hacer.
   */
  const REQUEST_TIMEOUT_MS = 45_000;

  function timeoutSignal(ms = REQUEST_TIMEOUT_MS): AbortSignal {
    // AbortSignal.timeout no está en todos los navegadores objetivo.
    if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
      return (AbortSignal as any).timeout(ms);
    }
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
  }

  let isEditing = $state(false);
  let initialForm = $state<typeof form | null>(null);
  let form = $state({
    full_name: '', document_id: '', contact_phone: '', email: '',
    installation_address: '', gps_coordinates: '', contract_date: '',
    service_status: 'ACTIVE', ip: '', observations: '',
    plan_id: undefined as number | undefined, reason: ''
  });

  let originalPlanId = $state<number | undefined>(undefined);

  // El plan que el cliente ya tiene viene embebido en su propia ficha. Se usa
  // como respaldo del catálogo porque `GET /plans` consulta la capacidad real
  // del router y falla cuando el equipo no responde: sin este respaldo, una
  // caída de red dejaba la ficha diciendo «Sin asignar» a un cliente con plan.
  let embeddedPlan = $derived.by<PlanOption | undefined>(() => {
    const cp = client?.client_plans?.[0];
    const p = cp?.plan;
    if (!p) return undefined;
    return {
      id: Number(p.id),
      name: String(p.name),
      monthly_price: Number(cp.current_price ?? p.monthly_price),
      download: Number(p.download_speed),
      upload: Number(p.upload_speed),
      can_add_next_client: true
    };
  });

  function resolvePlan(id: number | undefined): PlanOption | undefined {
    if (!id) return undefined;
    return plans.find(p => p.id === id) ?? (embeddedPlan?.id === id ? embeddedPlan : undefined);
  }

  let selectedPlan = $derived(resolvePlan(form.plan_id));
  let originalPlan = $derived(resolvePlan(originalPlanId));

  let walletBalance = $derived.by(() => {
    const raw = client?.wallet_balance ?? client?.balance ?? client?.wallet?.balance;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  });

  const todayIso = todayDateInputValue();

  let contractDateValidation = $derived.by(() => {
    const v = form.contract_date;
    if (!v) return { state: 'empty' as const, message: 'Indica la fecha en que se firmó el contrato.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { state: 'invalid' as const, message: 'Formato inválido (YYYY-MM-DD).' };
    if (v > todayIso) return { state: 'invalid' as const, message: 'La fecha no puede ser futura.' };
    return { state: 'valid' as const, message: '' };
  });

  let contractAge = $derived(contractDateValidation.state === 'valid' ? relativeFromDate(form.contract_date) : '');

  let currentClientId = $state<number | null>(null);
  $effect(() => {
    if (client && client.id !== currentClientId) {
      currentClientId = client.id;
      untrack(() => { isEditing = false; initForm(client); });
    }
  });

  function initForm(c: Client) {
    let rawStatus = c.service_status?.toUpperCase() || 'ACTIVE';
    const valid = ['ACTIVE', 'LIMITED', 'SUSPENDED', 'CANCELLED'];
    if (!valid.includes(rawStatus)) rawStatus = rawStatus === 'INACTIVE' ? 'SUSPENDED' : 'ACTIVE';

    form = {
      full_name: c.name || c.full_name || '',
      document_id: c.document_id || c.dni || '',
      contact_phone: c.phone || c.contact_phone || '',
      email: c.email || '',
      installation_address: c.address || c.installation_address || '',
      gps_coordinates: c.coordinates || c.gps_coordinates || '',
      contract_date: toDateInputValue(c.contract_date),
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
    reasonAutoFilled = true;
    fieldErrors = {};
    errorMsg = '';
    ipCheckStatus = null;
    ipCheckError = null;
    coordsError = null;
  }

  async function loadPlans() {
    plansLoading = true;
    plansError = null;
    try {
      const token = localStorage.getItem('employee_token');
      const res = await fetch(`${API_BASE}/plans`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: timeoutSignal(20_000)
      });
      let payload: any = null;
      try { payload = await res.json(); } catch { /* respuesta no JSON */ }

      // El endpoint responde 200 con cuerpo de error en algunos fallos: sin
      // mirar res.ok, la lista quedaba vacía y en silencio, y el desplegable
      // parecía decir que no existe ningún plan.
      if (!res.ok) {
        plansError = payload?.message || `No se pudo cargar el catálogo de planes (error ${res.status}).`;
        plans = [];
        return;
      }

      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      plans = list.map((p: any) => ({
        id: Number(p.id),
        name: String(p.name),
        monthly_price: Number(p.monthly_price),
        download: Number(p.download_speed),
        upload: Number(p.upload_speed),
        can_add_next_client: Boolean(p.can_add_next_client ?? true)
      }));
    } catch (e: any) {
      console.error('Error cargando planes:', e);
      plansError = e?.name === 'TimeoutError' || e?.name === 'AbortError'
        ? 'El catálogo de planes tardó demasiado en responder.'
        : 'No se pudieron cargar los planes.';
    } finally {
      plansLoading = false;
    }
  }

  onMount(loadPlans);

  // ─── Motivo de auditoría ──────────────────────────────────────────────────
  const FIELD_LABELS: Record<string, string> = {
    full_name: 'nombre', document_id: 'documento', contact_phone: 'teléfono',
    email: 'email', installation_address: 'dirección', gps_coordinates: 'coordenadas GPS',
    contract_date: 'fecha de contrato', service_status: 'estado de servicio',
    ip: 'IP', observations: 'observaciones', plan_id: 'plan'
  };

  function planName(id: number | undefined) {
    if (!id) return 'sin plan';
    return plans.find(p => p.id === id)?.name ?? `plan #${id}`;
  }

  function formatFieldValue(key: string, value: any): string {
    if (value === '' || value === null || value === undefined) return '—';
    if (key === 'service_status') return statusLabel(String(value));
    if (key === 'plan_id') return planName(Number(value));
    if (key === 'contract_date') return formatDatePure(String(value));
    if (key === 'observations') {
      const s = String(value);
      return s.length > 40 ? s.slice(0, 40) + '…' : s;
    }
    return String(value);
  }

  let changedFields = $derived.by(() => {
    if (!initialForm) return [] as string[];
    const keys = Object.keys(form).filter(k => k !== 'reason') as (keyof typeof form)[];
    return keys.filter(k => form[k] !== initialForm![k]) as string[];
  });

  let hasChanges = $derived(changedFields.length > 0);

  function buildSmartReason(): string {
    if (!initialForm || changedFields.length === 0) return '';
    if (changedFields.length === 1) {
      const k = changedFields[0];
      const label = FIELD_LABELS[k] ?? k;
      const before = formatFieldValue(k, (initialForm as any)[k]);
      const after = formatFieldValue(k, (form as any)[k]);
      if (k === 'plan_id')        return `Cambio de plan: ${before} → ${after}.`;
      if (k === 'service_status') return `Cambio de estado: ${before} → ${after}.`;
      if (k === 'contract_date')  return `Actualización de fecha de contrato: ${before} → ${after}.`;
      if (k === 'observations')   return 'Actualización de observaciones internas.';
      return `Actualización de ${label}: ${before} → ${after}.`;
    }
    const labels = changedFields.map(k => FIELD_LABELS[k] ?? k);
    const last = labels.pop();
    const list = labels.length ? `${labels.join(', ')} y ${last}` : last;
    return `Actualización de ${list}.`;
  }

  let smartReason = $derived(buildSmartReason());
  let reasonAutoFilled = $state(true);

  $effect(() => {
    if (!isEditing || !reasonAutoFilled) return;
    if (smartReason && form.reason !== smartReason) form.reason = smartReason;
    else if (!smartReason && form.reason !== '') form.reason = '';
  });

  function handleReasonInput(e: Event) {
    reasonAutoFilled = false;
    form.reason = (e.target as HTMLInputElement).value;
  }

  function regenerateReason() {
    reasonAutoFilled = true;
    form.reason = smartReason;
  }

  // ─── Geo / IP ─────────────────────────────────────────────────────────────
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
      () => { coordsError = 'No se pudo obtener la ubicación del dispositivo.'; geoLoading = false; },
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
    if (ipRaw.endsWith('.')) { ipRaw = ipRaw.slice(0, -1); form.ip = ipRaw; }
  }

  function handleGpsInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value;
    gpsRaw = raw;
    const parsed = parseGpsCoordinates(raw);
    form.gps_coordinates = parsed ? `${parsed.lat.toFixed(6)},${parsed.lon.toFixed(6)}` : raw;
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
    if (!ip || ipValidation.state !== 'valid') {
      ipCheckError = ipValidation.message || 'Ingresa una IP válida (ej. 192.168.1.10).';
      return;
    }
    ipCheckLoading = true;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      const token = localStorage.getItem('employee_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/mikrotik/ip/check?ip=${encodeURIComponent(ip)}`, { headers });
      let payload: any = null;
      try { payload = await res.json(); } catch { /* respuesta no JSON */ }
      if (!res.ok) ipCheckError = payload?.message || `Error ${res.status}`;
      else ipCheckStatus = payload?.data?.status || null;
    } catch {
      ipCheckError = 'Error de red al verificar la IP.';
    } finally {
      ipCheckLoading = false;
    }
  }

  // ─── Guardado ─────────────────────────────────────────────────────────────
  async function submit() {
    if (!form.reason || form.reason.trim().length < 5) {
      fieldErrors = { ...fieldErrors, reason: ['Motivo requerido (mín. 5 caracteres).'] };
      toast.error('Indica un motivo para el cambio.');
      document.getElementById('reason')?.focus();
      return;
    }
    if (contractDateValidation.state !== 'valid') {
      fieldErrors = { ...fieldErrors, contract_date: [contractDateValidation.message] };
      toast.error(contractDateValidation.message);
      document.getElementById('contract_date')?.focus();
      return;
    }

    errorMsg = '';
    fieldErrors = {};
    loading = true;
    try {
      const token = localStorage.getItem('employee_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (!client) { toast.error('Cliente no válido.'); return; }

      const res = await fetch(`${API_BASE}/admin/clientes/${client.id}`, {
        method: 'PUT', headers, body: JSON.stringify(form), signal: timeoutSignal()
      });

      if (res.ok) {
        const updated = await res.json();
        dispatch('updated', updated);
        toast.success('Cliente actualizado correctamente.');
        initForm(updated.client || updated);
        isEditing = false;
      } else {
        const payload = await res.json().catch(() => ({}));
        if (res.status === 422) {
          fieldErrors = payload.errors || {};
          errorMsg = payload.message || 'Revisa los campos marcados.';
          // Enfocar el primer campo inválido: buscarlo a mano en un formulario
          // de este tamaño es un coste que no tiene por qué pagar el operador.
          const first = Object.keys(fieldErrors)[0];
          if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
        } else if (res.status === 409 && payload?.code === 'ISP_CAPACITY_EXHAUSTED') {
          errorMsg = payload.message || 'Capacidad del ISP agotada para ese plan.';
        } else if (res.status === 403) {
          errorMsg = 'No tienes permiso para modificar este cliente.';
        } else {
          errorMsg = payload.message || `Error ${res.status}`;
        }
        toast.error(errorMsg);
      }
    } catch (e: any) {
      console.error('Error actualizando cliente:', e);
      errorMsg = e?.name === 'TimeoutError' || e?.name === 'AbortError'
        ? 'El servidor no respondió a tiempo. El cambio puede haberse aplicado igualmente: '
          + 'revisa la ficha antes de reintentar. Suele deberse a que el router no responde.'
        : 'Error de red o del servidor.';
      toast.error(errorMsg);
    } finally {
      loading = false;
    }
  }

  function startEdit() { isEditing = true; }
  function cancelEdit() {
    isEditing = false;
    if (client) initForm(client);
  }

  // Aviso del navegador si se recarga con cambios sin guardar.
  $effect(() => {
    if (!isEditing || !hasChanges) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });
</script>

<div class="h-full flex flex-col min-h-0">

  <!-- Barra de modo -->
  <div class="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-white/[0.06] bg-surface-card">
    {#if isEditing}
      <p class="flex items-center gap-1.5 text-[11px] text-warning-300 min-w-0">
        <Shield class="size-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate">Modo edición — cada cambio queda en auditoría.</span>
      </p>
      <button
        type="button"
        onclick={cancelEdit}
        disabled={loading}
        class="shrink-0 h-8 px-2.5 inline-flex items-center gap-1 rounded-md border border-white/10 text-xs font-medium
               text-text-secondary hover:bg-surface-hover hover:text-text-primary
               disabled:opacity-50 transition-colors duration-150
               focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
      >
        <X class="size-3.5" aria-hidden="true" />
        Salir
      </button>
    {:else}
      <p class="text-[11px] text-text-muted truncate">Ficha del cliente</p>
      {#if canEdit}
        <button
          type="button"
          onclick={startEdit}
          class="shrink-0 h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-surface-elevated border border-white/[0.06]
                 text-xs font-semibold text-text-secondary
                 hover:bg-surface-hover hover:text-text-primary transition-colors duration-150
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <Pencil class="size-3.5" aria-hidden="true" />
          Editar ficha
        </button>
      {/if}
    {/if}
  </div>

  <div class="flex-1 overflow-y-auto scrollbar-isp">
    <div class="max-w-4xl mx-auto px-4 py-4 space-y-4">

      {#if errorMsg}
        <div class="flex items-start gap-2 rounded-lg border border-danger-500/30 bg-danger-950/30 p-3 text-sm text-danger-200" role="alert">
          <AlertTriangle class="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      {/if}

      {#if !isEditing}
        <!-- ══ LECTURA ══
             Los datos se muestran como texto, no como inputs deshabilitados:
             un campo gris atenuado se lee como «roto», no como «sólo lectura». -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">

          <section class="isp-card !p-0 !space-y-0 overflow-hidden" aria-labelledby="ro-identidad">
            <h3 id="ro-identidad" class="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] text-xs font-semibold text-text-secondary">
              <User class="size-3.5 text-primary-400" aria-hidden="true" /> Identidad
            </h3>
            <dl class="divide-y divide-white/[0.04]">
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Nombre</dt>
                <dd class="text-sm font-medium text-text-primary text-right truncate">{form.full_name || '—'}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Documento</dt>
                <dd class="text-sm font-mono tabular-nums text-text-secondary text-right truncate">{form.document_id || '—'}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Estado</dt>
                <dd class="text-sm font-medium text-text-primary text-right">{statusLabel(form.service_status)}</dd>
              </div>
            </dl>
          </section>

          <section class="isp-card !p-0 !space-y-0 overflow-hidden" aria-labelledby="ro-contacto">
            <h3 id="ro-contacto" class="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] text-xs font-semibold text-text-secondary">
              <Phone class="size-3.5 text-info-400" aria-hidden="true" /> Contacto
            </h3>
            <dl class="divide-y divide-white/[0.04]">
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Correo</dt>
                <dd class="text-sm text-right truncate min-w-0">
                  {#if form.email}
                    <a href="mailto:{form.email}" class="text-primary-400 hover:text-primary-300 hover:underline transition-colors duration-150">{form.email}</a>
                  {:else}<span class="text-text-disabled">—</span>{/if}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Teléfono</dt>
                <dd class="text-sm text-right truncate min-w-0">
                  {#if form.contact_phone}
                    <a href="tel:{form.contact_phone}" class="font-mono tabular-nums text-primary-400 hover:text-primary-300 hover:underline transition-colors duration-150">{form.contact_phone}</a>
                  {:else}<span class="text-text-disabled">—</span>{/if}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Contrato</dt>
                <dd class="text-sm text-text-secondary text-right tabular-nums">
                  {form.contract_date ? formatDatePure(form.contract_date) : '—'}
                  {#if contractAge}<span class="block text-[10px] text-text-disabled">{contractAge}</span>{/if}
                </dd>
              </div>
            </dl>
          </section>

          <section class="isp-card !p-0 !space-y-0 overflow-hidden" aria-labelledby="ro-servicio">
            <h3 id="ro-servicio" class="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] text-xs font-semibold text-text-secondary">
              <CreditCard class="size-3.5 text-success-400" aria-hidden="true" /> Servicio
            </h3>
            <dl class="divide-y divide-white/[0.04]">
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Plan</dt>
                <dd class="text-sm font-medium text-text-primary text-right truncate">
                  {#if selectedPlan}
                    {selectedPlan.name}
                  {:else if form.plan_id}
                    <span class="text-warning-300">Plan #{form.plan_id}</span>
                  {:else if plansLoading}
                    <span class="text-text-muted">Cargando…</span>
                  {:else}
                    <span class="text-text-muted">Sin asignar</span>
                  {/if}
                  {#if selectedPlan}
                    <span class="block text-[10px] text-text-muted tabular-nums">
                      {selectedPlan.download}/{selectedPlan.upload} Mbps · {formatCurrency(selectedPlan.monthly_price)}/mes
                    </span>
                  {/if}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Dirección IP</dt>
                <dd class="text-sm font-mono tabular-nums text-text-secondary text-right truncate">{form.ip || '—'}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Saldo</dt>
                <dd class="text-sm font-semibold tabular-nums text-right {walletBalance > 0 ? 'text-success-300' : 'text-text-secondary'}">
                  {formatCurrency(walletBalance)}
                </dd>
              </div>
            </dl>
          </section>

          <section class="isp-card !p-0 !space-y-0 overflow-hidden" aria-labelledby="ro-ubicacion">
            <h3 id="ro-ubicacion" class="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] text-xs font-semibold text-text-secondary">
              <MapPin class="size-3.5 text-warning-400" aria-hidden="true" /> Ubicación
            </h3>
            <dl class="divide-y divide-white/[0.04]">
              <div class="px-4 py-2.5">
                <dt class="text-[11px] text-text-muted mb-1">Dirección de instalación</dt>
                <dd class="text-sm text-text-secondary leading-snug">{form.installation_address || '—'}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt class="text-[11px] text-text-muted shrink-0">Coordenadas</dt>
                <dd class="text-sm text-right min-w-0 truncate">
                  {#if form.gps_coordinates}
                    <a
                      href="https://www.openstreetmap.org/?mlat={form.gps_coordinates.split(',')[0]}&mlon={form.gps_coordinates.split(',')[1]}#map=18/{form.gps_coordinates.split(',')[0]}/{form.gps_coordinates.split(',')[1]}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 font-mono tabular-nums text-primary-400 hover:text-primary-300 transition-colors duration-150"
                    >
                      <Globe class="size-3 shrink-0" aria-hidden="true" />
                      {form.gps_coordinates}
                    </a>
                  {:else}<span class="text-text-disabled">—</span>{/if}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <section class="isp-card !p-0 !space-y-0 overflow-hidden" aria-labelledby="ro-notas">
          <h3 id="ro-notas" class="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] text-xs font-semibold text-text-secondary">
            <FileText class="size-3.5 text-text-muted" aria-hidden="true" /> Notas internas
          </h3>
          <p class="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap {form.observations ? 'text-text-secondary' : 'text-text-disabled'}">
            {form.observations || 'Sin notas registradas.'}
          </p>
        </section>

      {:else}
        <!-- ══ EDICIÓN ══ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">

          <section class="isp-card" aria-labelledby="ed-identidad">
            <div class="isp-section-header">
              <User class="size-3.5 text-primary-400" aria-hidden="true" />
              <h3 id="ed-identidad" class="text-xs font-semibold text-text-secondary">Identidad</h3>
            </div>

            <div>
              <label class="isp-label" for="full_name">Nombre completo</label>
              <input id="full_name" type="text" bind:value={form.full_name} autocomplete="name"
                     aria-invalid={Boolean(fieldErrors.full_name)}
                     aria-describedby={fieldErrors.full_name ? 'err-full_name' : undefined}
                     class="isp-input" />
              {#if fieldErrors.full_name}
                <p id="err-full_name" class="mt-1.5 text-xs text-danger-300" role="alert">{fieldErrors.full_name[0]}</p>
              {/if}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="isp-label" for="document_id">Documento</label>
                <div class="relative">
                  <Hash class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                  <input id="document_id" type="text" inputmode="numeric" bind:value={form.document_id}
                         aria-invalid={Boolean(fieldErrors.document_id)}
                         class="isp-input !pl-9 font-mono tabular-nums" />
                </div>
                {#if fieldErrors.document_id}
                  <p class="mt-1.5 text-xs text-danger-300" role="alert">{fieldErrors.document_id[0]}</p>
                {/if}
              </div>
              <div>
                <label class="isp-label" for="service_status">Estado de servicio</label>
                <select id="service_status" bind:value={form.service_status} class="isp-input cursor-pointer">
                  <option value="ACTIVE">Activo</option>
                  <option value="SUSPENDED">Suspendido</option>
                  <option value="LIMITED">Limitado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
            </div>
          </section>

          <section class="isp-card" aria-labelledby="ed-contacto">
            <div class="isp-section-header">
              <Phone class="size-3.5 text-info-400" aria-hidden="true" />
              <h3 id="ed-contacto" class="text-xs font-semibold text-text-secondary">Contacto</h3>
            </div>

            <div>
              <label class="isp-label" for="email">Correo electrónico</label>
              <div class="relative">
                <Mail class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                <input id="email" type="email" bind:value={form.email} autocomplete="email"
                       aria-invalid={Boolean(fieldErrors.email)} class="isp-input !pl-9" />
              </div>
              {#if fieldErrors.email}
                <p class="mt-1.5 text-xs text-danger-300" role="alert">{fieldErrors.email[0]}</p>
              {/if}
            </div>

            <div>
              <label class="isp-label" for="contact_phone">Teléfono</label>
              <div class="relative">
                <Phone class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                <input id="contact_phone" type="tel" inputmode="tel" bind:value={form.contact_phone} autocomplete="tel"
                       aria-invalid={Boolean(fieldErrors.contact_phone)} class="isp-input !pl-9 font-mono tabular-nums" />
              </div>
              {#if fieldErrors.contact_phone}
                <p class="mt-1.5 text-xs text-danger-300" role="alert">{fieldErrors.contact_phone[0]}</p>
              {/if}
            </div>

            <div>
              <label class="isp-label" for="contract_date">
                Fecha de firma del contrato
                <span class="inline-flex items-center gap-1 ml-1 normal-case tracking-normal font-normal text-text-disabled">
                  <Shield class="size-3" aria-hidden="true" /> auditado
                </span>
              </label>
              <div class="relative">
                <input
                  id="contract_date" type="date" bind:value={form.contract_date} max={todayIso}
                  aria-invalid={contractDateValidation.state === 'invalid'}
                  class="isp-input pr-9
                         {contractDateValidation.state === 'valid'   ? '!border-success-500/40' :
                          contractDateValidation.state === 'invalid' ? '!border-danger-500/40'  : ''}"
                />
                {#if contractDateValidation.state === 'valid'}
                  <CheckCircle class="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-success-400 pointer-events-none" aria-hidden="true" />
                {/if}
              </div>
              {#if fieldErrors.contract_date}
                <p class="mt-1.5 flex items-center gap-1 text-xs text-danger-300" role="alert">
                  <XCircle class="size-3 shrink-0" aria-hidden="true" /> {fieldErrors.contract_date[0]}
                </p>
              {:else if contractDateValidation.state === 'invalid'}
                <p class="mt-1.5 flex items-center gap-1 text-xs text-danger-300" role="alert">
                  <XCircle class="size-3 shrink-0" aria-hidden="true" /> {contractDateValidation.message}
                </p>
              {:else if contractAge}
                <p class="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
                  <Clock class="size-3 shrink-0" aria-hidden="true" /> Cliente {contractAge}
                </p>
              {/if}
            </div>
          </section>

          <section class="isp-card" aria-labelledby="ed-servicio">
            <div class="isp-section-header">
              <CreditCard class="size-3.5 text-success-400" aria-hidden="true" />
              <h3 id="ed-servicio" class="text-xs font-semibold text-text-secondary">Servicio</h3>
            </div>

            <div>
              <label class="isp-label" for="ip">Dirección IP</label>
              <div class="relative">
                <input
                  id="ip" type="text" value={ipRaw} oninput={handleIpInput} onblur={handleIpBlur}
                  placeholder="192.168.1.100" autocomplete="off" maxlength="15" inputmode="decimal"
                  aria-invalid={ipValidation.state === 'invalid'}
                  class="isp-input pr-10 font-mono tabular-nums
                         {ipValidation.state === 'valid'   ? '!border-success-500/40' :
                          ipValidation.state === 'invalid' ? '!border-danger-500/40'  : ''}"
                />
                {#if ipRaw}
                  <button
                    type="button" onclick={checkIp}
                    disabled={ipCheckLoading || ipValidation.state !== 'valid'}
                    aria-label="Verificar disponibilidad de la IP en la red"
                    class="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center rounded-md
                           text-text-muted hover:text-text-primary hover:bg-surface-hover
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    {#if ipCheckLoading}<Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
                    {:else if ipCheckStatus === 'available'}<CheckCircle class="size-3.5 text-success-400" aria-hidden="true" />
                    {:else if ipCheckStatus}<XCircle class="size-3.5 text-danger-400" aria-hidden="true" />
                    {:else}<Search class="size-3.5" aria-hidden="true" />{/if}
                  </button>
                {/if}
              </div>
              <div aria-live="polite">
                {#if fieldErrors.ip}
                  <p class="mt-1.5 text-xs text-danger-300" role="alert">{fieldErrors.ip[0]}</p>
                {:else if ipValidation.state === 'invalid'}
                  <p class="mt-1.5 text-xs text-danger-300" role="alert">{ipValidation.message}</p>
                {:else if ipCheckError}
                  <p class="mt-1.5 text-xs text-danger-300" role="alert">{ipCheckError}</p>
                {:else if ipCheckStatus === 'available'}
                  <p class="mt-1.5 text-xs text-success-300">IP disponible en la red.</p>
                {:else if ipCheckStatus}
                  <p class="mt-1.5 text-xs text-warning-300">
                    {ipCheckStatus === 'in_use_db' ? 'IP ya asignada en la base de datos.'
                     : ipCheckStatus === 'in_use_router' ? 'IP en uso en el router.'
                     : 'IP en uso en la base de datos y en el router.'}
                  </p>
                {/if}
              </div>
            </div>

            <div>
              <label class="isp-label" for="plan">Plan de servicio</label>
              <div class="relative">
                <CreditCard class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                <select
                  id="plan"
                  value={form.plan_id ?? ''}
                  onchange={(e) => form.plan_id = Number((e.target as HTMLSelectElement).value || 0) || undefined}
                  class="isp-input !pl-9 cursor-pointer"
                >
                  <option value="">Sin plan asignado</option>
                  {#if plansLoading}
                    <option disabled>Cargando planes…</option>
                  {:else if plans.length > 0}
                    {#each plans as p (p.id)}
                      <option value={p.id} disabled={!p.can_add_next_client && originalPlanId !== p.id}>
                        {p.name}{!p.can_add_next_client && originalPlanId !== p.id ? ' — sin capacidad' : ''}
                      </option>
                    {/each}
                  {:else if embeddedPlan}
                    <option value={embeddedPlan.id}>{embeddedPlan.name} — plan actual</option>
                  {/if}
                </select>
              </div>
              {#if plansError}
                <p class="mt-1.5 flex items-start gap-1 text-xs text-warning-300" role="alert">
                  <AlertTriangle class="size-3 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{plansError} Sólo puedes conservar el plan actual hasta que el catálogo vuelva a responder.</span>
                </p>
              {/if}

              {#if selectedPlan}
                <div class="mt-2.5 rounded-lg border border-white/[0.06] bg-surface-base p-3">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-semibold text-text-primary truncate">{selectedPlan.name}</span>
                    <span class="text-sm font-bold text-success-300 tabular-nums shrink-0">{formatCurrency(selectedPlan.monthly_price)}</span>
                  </div>
                  <div class="mt-1.5 flex items-center gap-3 text-xs text-text-muted tabular-nums">
                    <span class="inline-flex items-center gap-1">
                      <ArrowDown class="size-3 text-success-400" aria-hidden="true" /> {selectedPlan.download} Mbps
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <ArrowUp class="size-3 text-primary-400" aria-hidden="true" /> {selectedPlan.upload} Mbps
                    </span>
                  </div>
                  {#if form.plan_id !== originalPlanId}
                    <p class="mt-2 pt-2 border-t border-white/[0.06] flex items-center gap-1.5 text-[11px] text-warning-300">
                      <AlertTriangle class="size-3 shrink-0" aria-hidden="true" />
                      {originalPlan?.name ?? 'Sin plan'}
                      <ChevronRight class="size-3 shrink-0" aria-hidden="true" />
                      {selectedPlan.name}
                    </p>
                  {/if}
                </div>
              {/if}
            </div>
          </section>

          <section class="isp-card" aria-labelledby="ed-ubicacion">
            <div class="isp-section-header">
              <MapPin class="size-3.5 text-warning-400" aria-hidden="true" />
              <h3 id="ed-ubicacion" class="text-xs font-semibold text-text-secondary">Ubicación</h3>
            </div>

            <div>
              <label class="isp-label" for="installation_address">Dirección de instalación</label>
              <textarea
                id="installation_address" rows="2" bind:value={form.installation_address}
                placeholder="Calle, número, referencias…"
                class="isp-input resize-none"
              ></textarea>
              {#if fieldErrors.installation_address}
                <p class="mt-1.5 text-xs text-danger-300" role="alert">{fieldErrors.installation_address[0]}</p>
              {/if}
            </div>

            <div>
              <label class="isp-label" for="gps_coordinates">Coordenadas GPS</label>
              <div class="relative">
                <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-text-disabled pointer-events-none" aria-hidden="true" />
                <input
                  id="gps_coordinates" type="text" value={gpsRaw}
                  oninput={handleGpsInput} onblur={handleGpsBlur}
                  placeholder="-0.180653,-78.467834" autocomplete="off" spellcheck="false" maxlength="30"
                  aria-invalid={gpsValidation.state === 'invalid'}
                  class="isp-input !pl-9 pr-10 font-mono tabular-nums
                         {gpsValidation.state === 'valid'   ? '!border-success-500/40' :
                          gpsValidation.state === 'invalid' ? '!border-danger-500/40'  : ''}"
                />
                <button
                  type="button" onclick={getCurrentCoords} disabled={geoLoading}
                  aria-label="Capturar la ubicación actual del dispositivo"
                  class="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center rounded-md
                         text-text-muted hover:text-primary-300 hover:bg-surface-hover
                         disabled:opacity-40 transition-colors duration-150
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {#if geoLoading}<Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
                  {:else}<Crosshair class="size-3.5" aria-hidden="true" />{/if}
                </button>
              </div>
              <div aria-live="polite">
                {#if coordsError}
                  <p class="mt-1.5 text-xs text-danger-300" role="alert">{coordsError}</p>
                {:else if gpsValidation.state === 'valid'}
                  <p class="mt-1.5 flex items-center gap-1.5 text-xs text-success-300 font-mono tabular-nums">
                    <CheckCircle class="size-3 shrink-0" aria-hidden="true" />
                    {gpsValidation.parsed!.lat.toFixed(6)}, {gpsValidation.parsed!.lon.toFixed(6)}
                  </p>
                {:else if gpsValidation.state === 'invalid'}
                  <p class="mt-1.5 flex items-center gap-1 text-xs text-danger-300" role="alert">
                    <XCircle class="size-3 shrink-0" aria-hidden="true" /> {gpsValidation.message}
                  </p>
                {/if}
              </div>
            </div>
          </section>
        </div>

        <section class="isp-card" aria-labelledby="ed-notas">
          <div class="isp-section-header">
            <FileText class="size-3.5 text-text-muted" aria-hidden="true" />
            <h3 id="ed-notas" class="text-xs font-semibold text-text-secondary">Notas internas</h3>
          </div>
          <textarea
            id="observations" rows="4" bind:value={form.observations}
            placeholder="Anotaciones visibles sólo para el personal…"
            class="isp-input resize-y"
          ></textarea>
        </section>

        {#if hasChanges}
          <section class="rounded-xl border border-warning-500/30 bg-warning-950/25 p-4 space-y-3" aria-labelledby="ed-motivo">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="size-7 rounded-lg bg-warning-500/15 ring-1 ring-warning-500/30 flex items-center justify-center shrink-0">
                  <Shield class="size-3.5 text-warning-300" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <h3 id="ed-motivo" class="text-sm font-semibold text-warning-200">Motivo del cambio</h3>
                  <p class="text-[11px] text-warning-400/80">Se guardará en el registro de auditoría.</p>
                </div>
              </div>
              {#if !reasonAutoFilled && smartReason}
                <button
                  type="button" onclick={regenerateReason}
                  class="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium
                         text-warning-200 hover:text-warning-100 hover:bg-warning-500/10 transition-colors duration-150
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-warning-400"
                >
                  <Sparkles class="size-3" aria-hidden="true" /> Sugerir
                </button>
              {/if}
            </div>

            <ul class="flex flex-wrap gap-1.5" aria-label="Campos modificados">
              {#each changedFields as field (field)}
                <li class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium
                           text-warning-200 bg-warning-500/15 border border-warning-500/25">
                  {FIELD_LABELS[field] ?? field}
                </li>
              {/each}
            </ul>

            <div class="relative">
              <label class="sr-only" for="reason">Motivo del cambio</label>
              <input
                id="reason" type="text" value={form.reason} oninput={handleReasonInput}
                placeholder="Describe brevemente el motivo…"
                aria-required="true" aria-invalid={Boolean(fieldErrors.reason)}
                class="isp-input !bg-black/40 !border-warning-500/30 pr-16
                       focus-visible:!ring-warning-400"
              />
              {#if reasonAutoFilled && smartReason}
                <span
                  class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded
                         text-[10px] font-medium text-warning-300 bg-warning-500/15 border border-warning-500/30"
                  title="Redactado automáticamente a partir de los cambios detectados. Puedes editarlo."
                >
                  <Sparkles class="size-3" aria-hidden="true" /> Auto
                </span>
              {/if}
            </div>

            {#if fieldErrors.reason}
              <p class="text-xs text-danger-300" role="alert">{fieldErrors.reason[0]}</p>
            {/if}
          </section>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Barra de guardado -->
  {#if isEditing}
    <div class="shrink-0 border-t border-white/[0.06] bg-surface-card px-4 py-3">
      <div class="max-w-4xl mx-auto flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <p class="text-[11px] text-text-muted tabular-nums" aria-live="polite">
          {hasChanges
            ? `${changedFields.length} cambio${changedFields.length === 1 ? '' : 's'} sin guardar`
            : 'Sin cambios'}
        </p>
        <div class="flex gap-2">
          <button
            type="button" onclick={cancelEdit} disabled={loading}
            class="isp-btn-ghost flex-1 sm:flex-none !py-2 justify-center"
          >
            Descartar
          </button>
          <button
            type="button" onclick={submit} disabled={loading || !hasChanges}
            title={!hasChanges ? 'No hay cambios por guardar' : 'Guardar cambios'}
            class="isp-btn-primary flex-1 sm:flex-none !py-2 justify-center"
          >
            {#if loading}
              <Loader2 class="size-3.5 animate-spin" aria-hidden="true" /> Guardando…
            {:else}
              <Save class="size-3.5" aria-hidden="true" /> Guardar cambios
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
