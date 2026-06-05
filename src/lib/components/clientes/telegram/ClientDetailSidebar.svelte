<script lang="ts">
  import {
    X, Loader2, Crosshair, Search, CheckCircle, XCircle, AlertTriangle,
    Save, Phone, Mail, MapPin, CreditCard, Edit3, User, FileText, Wallet,
    Calendar, Shield, Clock, ArrowDown, ArrowUp, Sparkles, ChevronRight,
    AlertOctagon, CheckCircle2, Receipt, ExternalLink
  } from '@lucide/svelte';
  import { createEventDispatcher, onMount, untrack } from 'svelte';
  import { API_BASE } from '$lib/config';
  import { toast } from 'svelte-sonner';
  import { processIpInput, validateIp, parseGpsCoordinates, validateGps } from '$lib/utils/input-formatters';
  import {
    toDateInputValue,
    todayDateInputValue,
    formatDate as formatDatePure,
    relativeFromDate
  } from '$lib/utils/date-format';

  interface InvoiceLite {
    id: number;
    invoice_number?: string;
    issue_date?: string;
    due_date?: string;
    amount?: number | string;
    tax_amount?: number | string;
    total_amount?: number | string;
    status?: string;
    description?: string;
  }

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
    invoices?: InvoiceLite[];
    [key: string]: any;
  }

  let { client = null, onClose = () => {} }:
    { client?: Client | null; onClose?: () => void; } = $props();

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
  let originalPlan = $derived(plans.find(p => p.id === originalPlanId));
  let walletBalance = $derived.by(() => {
    const raw = client?.wallet_balance ?? client?.balance ?? client?.wallet?.balance;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  });

  // ── Deudas / Estado de cuenta ───────────────────────────────────────────────
  const todayMidnight = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

  function toNumber(v: number | string | undefined | null): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function isInvoiceOverdue(inv: InvoiceLite): boolean {
    if (!inv?.due_date) return false;
    const t = new Date(inv.due_date).getTime();
    return Number.isFinite(t) && t < todayMidnight;
  }

  let pendingInvoices = $derived.by<InvoiceLite[]>(() => {
    const list = (client?.invoices ?? []) as InvoiceLite[];
    return list
      .filter((i) => i && (i.status === 'pending' || i.status === 'failed'))
      .sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date).getTime() : 0;
        const db = b.due_date ? new Date(b.due_date).getTime() : 0;
        return da - db;
      });
  });

  let debtTotals = $derived.by(() => {
    let conIva = 0;
    let sinIva = 0;
    let iva = 0;
    for (const inv of pendingInvoices) {
      conIva += toNumber(inv.total_amount);
      sinIva += toNumber(inv.amount);
      iva += toNumber(inv.tax_amount);
    }
    return { conIva, sinIva, iva };
  });

  let overdueCount = $derived(pendingInvoices.filter(isInvoiceOverdue).length);
  let hasDebt = $derived(pendingInvoices.length > 0);

  function summarizeDescription(raw?: string): string {
    if (!raw) return 'Sin descripción del concepto';
    const cleaned = String(raw).replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 120) return cleaned;
    return cleaned.slice(0, 117) + '…';
  }

  // Hoy en YYYY-MM-DD (zona local) para tope del date picker
  const todayIso = todayDateInputValue();

  let contractDateValidation = $derived.by(() => {
    const v = form.contract_date;
    if (!v) return { state: 'empty' as const, message: 'Indica la fecha en que se firmó el contrato.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { state: 'invalid' as const, message: 'Formato inválido (YYYY-MM-DD).' };
    if (v > todayIso) return { state: 'invalid' as const, message: 'La fecha no puede ser futura.' };
    return { state: 'valid' as const, message: '' };
  });

  let contractAge = $derived.by(() => {
    if (contractDateValidation.state !== 'valid') return '';
    return relativeFromDate(form.contract_date);
  });

  function formatDateShort(raw: string): string {
    return formatDatePure(raw);
  }

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

  // ─── Detección de cambios y motivo inteligente ────────────────────────────
  const FIELD_LABELS: Record<string, string> = {
    full_name: 'nombre',
    document_id: 'documento',
    contact_phone: 'teléfono',
    email: 'email',
    installation_address: 'dirección',
    gps_coordinates: 'coordenadas GPS',
    contract_date: 'fecha de contrato',
    service_status: 'estado de servicio',
    ip: 'IP',
    observations: 'observaciones',
    plan_id: 'plan'
  };

  function statusLabel(s: string) {
    switch (s) {
      case 'ACTIVE':    return 'Activo';
      case 'SUSPENDED': return 'Suspendido';
      case 'CANCELLED': return 'Cancelado';
      case 'LIMITED':   return 'Limitado';
      default:          return s;
    }
  }

  function planName(id: number | undefined) {
    if (!id) return 'sin plan';
    return plans.find(p => p.id === id)?.name ?? `plan #${id}`;
  }

  function formatFieldValue(key: string, value: any): string {
    if (value === '' || value === null || value === undefined) return '—';
    if (key === 'service_status') return statusLabel(String(value));
    if (key === 'plan_id') return planName(Number(value));
    if (key === 'contract_date') return formatDateShort(String(value));
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
  let contractDateChanged = $derived(changedFields.includes('contract_date'));

  function buildSmartReason(): string {
    if (!initialForm || changedFields.length === 0) return '';

    // Caso de un único cambio → frase con valores antes/después
    if (changedFields.length === 1) {
      const k = changedFields[0];
      const label = FIELD_LABELS[k] ?? k;
      const before = formatFieldValue(k, (initialForm as any)[k]);
      const after  = formatFieldValue(k, (form as any)[k]);
      if (k === 'plan_id')        return `Cambio de plan: ${before} → ${after}.`;
      if (k === 'service_status') return `Cambio de estado: ${before} → ${after}.`;
      if (k === 'contract_date')  return `Actualización de fecha de contrato: ${before} → ${after}.`;
      if (k === 'observations')   return `Actualización de observaciones internas.`;
      return `Actualización de ${label}: ${before} → ${after}.`;
    }

    // Múltiples cambios → lista breve
    const labels = changedFields.map(k => FIELD_LABELS[k] ?? k);
    const last = labels.pop();
    const list = labels.length ? `${labels.join(', ')} y ${last}` : last;
    return `Actualización de ${list}.`;
  }

  let smartReason = $derived(buildSmartReason());

  // El usuario puede editar manualmente; cuando lo hace, dejamos de sobreescribir.
  let reasonAutoFilled = $state(true);

  $effect(() => {
    if (!isEditing) return;
    if (!reasonAutoFilled) return;
    // Mantener el campo sincronizado con la propuesta inteligente
    if (smartReason && form.reason !== smartReason) {
      form.reason = smartReason;
    } else if (!smartReason && form.reason !== '') {
      form.reason = '';
    }
  });

  function handleReasonInput(e: Event) {
    reasonAutoFilled = false;
    form.reason = (e.target as HTMLInputElement).value;
  }

  function regenerateReason() {
    reasonAutoFilled = true;
    form.reason = smartReason;
  }

  // ─── Geo / IP / GPS ───────────────────────────────────────────────────────
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
    if (!ip || ipValidation.state !== 'valid') {
      ipCheckError = ipValidation.message || 'Ingrese una IP válida (ej: 192.168.1.10)';
      return;
    }
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

  // ─── Submit ───────────────────────────────────────────────────────────────
  async function submit() {
    if (!form.reason || form.reason.trim().length < 5) {
      fieldErrors = { ...fieldErrors, reason: ['Motivo requerido (mín. 5 caracteres).'] };
      toast.error('Debe indicar un motivo para el cambio');
      return;
    }
    if (contractDateValidation.state !== 'valid') {
      fieldErrors = { ...fieldErrors, contract_date: [contractDateValidation.message] };
      toast.error(contractDateValidation.message);
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
        method: 'PUT', headers, body: JSON.stringify(form)
      });

      if (res.ok) {
        const updatedClient = await res.json();
        dispatch('updated', updatedClient);
        toast.success('Cliente actualizado correctamente');
        initForm(updatedClient.client || updatedClient);
        isEditing = false;
      } else {
        const payload = await res.json().catch(() => ({}));
        if (res.status === 422) {
          fieldErrors = payload.errors || {};
          errorMsg = payload.message || 'Errores de validación.';
        } else if (res.status === 409 && payload?.code === 'ISP_CAPACITY_EXHAUSTED') {
          errorMsg = payload.message || 'Capacidad de ISP agotada';
        } else if (res.status === 403) {
          errorMsg = 'No tienes permiso para modificar este cliente.';
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
    return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '?';
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP',
      minimumFractionDigits: 0, maximumFractionDigits: 2
    }).format(amount);
  }

  function statusTheme(s: string) {
    switch (s) {
      case 'ACTIVE':    return { dot: 'bg-emerald-400', ring: 'ring-emerald-400/30', text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
      case 'SUSPENDED': return { dot: 'bg-amber-400',   ring: 'ring-amber-400/30',   text: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30' };
      case 'CANCELLED': return { dot: 'bg-rose-400',    ring: 'ring-rose-400/30',    text: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30' };
      case 'LIMITED':   return { dot: 'bg-sky-400',     ring: 'ring-sky-400/30',     text: 'text-sky-300',     bg: 'bg-sky-500/10',     border: 'border-sky-500/30' };
      default:          return { dot: 'bg-zinc-400',    ring: 'ring-zinc-400/30',    text: 'text-zinc-300',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/30' };
    }
  }

  let theme = $derived(statusTheme(form.service_status));
</script>

<div class="h-full flex flex-col bg-[#0b0b0d] text-zinc-100 relative overflow-hidden">

    <!-- Glow decorativo de fondo -->
    <div class="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-60"
         style="background: radial-gradient(60% 100% at 50% 0%, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 70%);"></div>

    <!-- ═══ HEADER ═══ -->
    <header class="relative shrink-0 px-6 pt-5 pb-6 border-b border-white/[0.05]">
        <div class="flex items-start justify-between gap-3 mb-5">
            <span class="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">
                Cliente · #{client?.id ?? '—'}
            </span>
            <div class="flex items-center gap-1">
                <button
                    type="button"
                    onclick={() => { isEditing = !isEditing; if (!isEditing && client) initForm(client); }}
                    aria-pressed={isEditing}
                    title={isEditing ? 'Salir del modo edición' : 'Activar modo edición'}
                    class="size-8 inline-flex items-center justify-center rounded-lg transition-all
                           {isEditing
                               ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/40'
                               : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5'}"
                >
                    <Edit3 class="size-4" />
                </button>
                <button
                    type="button"
                    onclick={onClose}
                    aria-label="Cerrar"
                    title="Cerrar"
                    class="size-8 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
                >
                    <X class="size-4" />
                </button>
            </div>
        </div>

        <div class="flex items-center gap-4">
            <div class="relative shrink-0">
                <div class="size-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-900/40 ring-2 {theme.ring}"
                     aria-hidden="true">
                    {getInitials(form.full_name)}
                </div>
                <span class="absolute -bottom-1 -right-1 size-4 rounded-full {theme.dot} ring-[3px] ring-[#0b0b0d]" aria-hidden="true"></span>
            </div>
            <div class="min-w-0 flex-1">
                <h2 class="text-lg font-bold text-zinc-50 leading-tight truncate" title={form.full_name || 'Sin nombre'}>
                    {form.full_name || 'Sin nombre'}
                </h2>
                <div class="mt-1 flex items-center gap-2 flex-wrap">
                    <span class="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md {theme.bg} {theme.text} border {theme.border}">
                        <span class="size-1.5 rounded-full {theme.dot}"></span>
                        {statusLabel(form.service_status)}
                    </span>
                    {#if form.email}
                        <span class="text-[11px] text-zinc-500 truncate" title={form.email}>
                            {form.email}
                        </span>
                    {/if}
                </div>
            </div>
        </div>

        <!-- KPIs -->
        <div class="mt-5 grid grid-cols-3 gap-2">
            <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    <Wallet class="size-3" aria-hidden="true" /> Saldo
                </div>
                <div class="mt-1 text-sm font-bold text-emerald-300 tabular-nums truncate" title={formatCurrency(walletBalance)}>
                    {formatCurrency(walletBalance)}
                </div>
            </div>
            <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    <CreditCard class="size-3" aria-hidden="true" /> Plan
                </div>
                <div class="mt-1 text-sm font-bold text-zinc-100 truncate" title={selectedPlan?.name ?? 'Sin asignar'}>
                    {selectedPlan?.name ?? 'Sin asignar'}
                </div>
            </div>
            <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                    <Calendar class="size-3" aria-hidden="true" /> Contrato
                </div>
                <div class="mt-1 text-sm font-bold text-zinc-100 truncate" title={contractAge ? `Cliente ${contractAge}` : ''}>
                    {form.contract_date ? formatDateShort(form.contract_date) : '—'}
                </div>
            </div>
        </div>

        {#if isEditing}
            <div class="mt-4 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-400/20 flex items-center gap-2">
                <Sparkles class="size-3.5 text-indigo-300 shrink-0" aria-hidden="true" />
                <span class="text-xs text-indigo-200">Modo edición activo — los cambios se registran en auditoría.</span>
            </div>
        {/if}
    </header>

    <!-- ═══ CONTENIDO ═══ -->
    <div class="flex-1 overflow-y-auto scrollbar-isp">
        <div class="px-6 py-5 space-y-6 max-w-3xl mx-auto">

            {#if errorMsg}
                <div class="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2" role="alert">
                    <AlertTriangle class="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{errorMsg}</span>
                </div>
            {/if}

            <!-- ── Estado de cuenta · Deudas (prominente) ── -->
            <section aria-labelledby="sec-debt" class="-mt-1">
                {#if hasDebt}
                    <div class="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/[0.09] via-rose-500/[0.04] to-transparent shadow-lg shadow-rose-950/20">
                        <div class="pointer-events-none absolute inset-x-0 -top-24 h-48 opacity-50"
                             style="background: radial-gradient(60% 100% at 50% 0%, rgba(244,63,94,0.22) 0%, rgba(244,63,94,0) 70%);"></div>

                        <div class="relative p-5">
                            <!-- Encabezado -->
                            <div class="flex items-start justify-between gap-3 mb-4">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="size-10 rounded-xl bg-rose-500/20 ring-1 ring-rose-400/30 flex items-center justify-center shrink-0">
                                        <AlertOctagon class="size-5 text-rose-300" aria-hidden="true" />
                                    </div>
                                    <div class="min-w-0">
                                        <h3 id="sec-debt" class="text-sm font-bold text-rose-100 leading-tight">
                                            Deudas pendientes
                                        </h3>
                                        <p class="text-[11px] text-rose-300/80 mt-0.5">
                                            {pendingInvoices.length} {pendingInvoices.length === 1 ? 'factura sin pagar' : 'facturas sin pagar'}
                                            {#if overdueCount > 0}
                                                · <span class="text-rose-200 font-medium">{overdueCount} vencida{overdueCount === 1 ? '' : 's'}</span>
                                            {/if}
                                        </p>
                                    </div>
                                </div>
                                <span class="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-rose-200 bg-rose-500/15 border border-rose-400/30 px-2 py-1 rounded-md shrink-0">
                                    <AlertTriangle class="size-3" aria-hidden="true" />
                                    Atención
                                </span>
                            </div>

                            <!-- Totales -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                                <div class="rounded-xl bg-black/40 border border-rose-500/25 p-3.5">
                                    <div class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-rose-300/80">
                                        <Receipt class="size-3" aria-hidden="true" />
                                        Total adeudado (c/IVA)
                                    </div>
                                    <div class="mt-1.5 text-xl font-bold text-rose-200 tabular-nums leading-none">
                                        {formatCurrency(debtTotals.conIva)}
                                    </div>
                                </div>
                                <div class="rounded-xl bg-black/30 border border-white/[0.06] p-3.5">
                                    <div class="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                        <Wallet class="size-3" aria-hidden="true" />
                                        Subtotal (sin IVA)
                                    </div>
                                    <div class="mt-1.5 flex items-baseline justify-between gap-2">
                                        <span class="text-base font-semibold text-zinc-100 tabular-nums">
                                            {formatCurrency(debtTotals.sinIva)}
                                        </span>
                                        <span class="text-[10px] text-zinc-500 tabular-nums">
                                            IVA: {formatCurrency(debtTotals.iva)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Lista de facturas -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-[11px] font-medium uppercase tracking-wider text-rose-300/70">
                                        Facturas pendientes
                                    </span>
                                    <a href="/facturas?status=pending"
                                       class="text-[11px] text-rose-200/80 hover:text-rose-100 inline-flex items-center gap-1 transition-colors">
                                        Ver todas
                                        <ChevronRight class="size-3" aria-hidden="true" />
                                    </a>
                                </div>

                                {#each pendingInvoices as inv (inv.id)}
                                    {@const overdue = isInvoiceOverdue(inv)}
                                    <a
                                        href="/facturas?invoice={inv.id}"
                                        class="group block rounded-lg bg-black/30 border border-white/[0.05] hover:border-rose-400/40 hover:bg-black/40 transition-all p-3"
                                        title="Abrir factura {inv.invoice_number ?? `#${inv.id}`}"
                                    >
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="min-w-0 flex-1">
                                                <div class="flex items-center gap-2 flex-wrap">
                                                    <span class="text-xs font-mono text-zinc-200 truncate">
                                                        {inv.invoice_number ?? `#${inv.id}`}
                                                    </span>
                                                    {#if overdue}
                                                        <span class="text-[9px] font-bold tracking-wider uppercase text-rose-200 bg-rose-500/20 border border-rose-400/30 px-1.5 py-0.5 rounded">
                                                            Vencida
                                                        </span>
                                                    {:else if inv.status === 'failed'}
                                                        <span class="text-[9px] font-bold tracking-wider uppercase text-orange-200 bg-orange-500/15 border border-orange-400/30 px-1.5 py-0.5 rounded">
                                                            Fallida
                                                        </span>
                                                    {:else}
                                                        <span class="text-[9px] font-bold tracking-wider uppercase text-amber-200 bg-amber-500/15 border border-amber-400/30 px-1.5 py-0.5 rounded">
                                                            Pendiente
                                                        </span>
                                                    {/if}
                                                </div>

                                                <p class="mt-1 text-[11.5px] text-zinc-400 leading-snug line-clamp-2">
                                                    {summarizeDescription(inv.description)}
                                                </p>

                                                <div class="mt-1.5 flex items-center gap-3 flex-wrap text-[10px] text-zinc-500">
                                                    <span class="inline-flex items-center gap-1">
                                                        <Calendar class="size-3" aria-hidden="true" />
                                                        Emitida: <span class="text-zinc-400 tabular-nums">{formatDateShort(inv.issue_date ?? '')}</span>
                                                    </span>
                                                    {#if inv.due_date}
                                                        <span class="inline-flex items-center gap-1">
                                                            <Clock class="size-3 {overdue ? 'text-rose-400' : ''}" aria-hidden="true" />
                                                            Vence:
                                                            <span class="{overdue ? 'text-rose-300 font-medium' : 'text-zinc-400'} tabular-nums">
                                                                {formatDateShort(inv.due_date)}
                                                            </span>
                                                        </span>
                                                    {/if}
                                                </div>
                                            </div>

                                            <div class="flex flex-col items-end gap-1 shrink-0">
                                                <span class="text-sm font-bold text-rose-200 tabular-nums leading-none">
                                                    {formatCurrency(toNumber(inv.total_amount))}
                                                </span>
                                                <span class="text-[10px] text-zinc-500 tabular-nums">
                                                    s/IVA: {formatCurrency(toNumber(inv.amount))}
                                                </span>
                                                <ExternalLink class="size-3.5 text-zinc-600 group-hover:text-rose-300 transition-colors mt-0.5" aria-hidden="true" />
                                            </div>
                                        </div>
                                    </a>
                                {/each}
                            </div>
                        </div>
                    </div>
                {:else}
                    <div class="rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent p-4 flex items-center gap-3">
                        <div class="size-10 rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/30 flex items-center justify-center shrink-0">
                            <CheckCircle2 class="size-5 text-emerald-300" aria-hidden="true" />
                        </div>
                        <div class="min-w-0">
                            <h3 class="text-sm font-semibold text-emerald-100 leading-tight">
                                Cliente al día
                            </h3>
                            <p class="text-[11px] text-emerald-300/80 mt-0.5 leading-snug">
                                No registra deudas pendientes. Todas sus facturas se encuentran pagadas.
                            </p>
                        </div>
                    </div>
                {/if}
            </section>

            <!-- ── Identidad ── -->
            <section aria-labelledby="sec-identity">
                <div class="flex items-center gap-2 mb-3">
                    <div class="size-7 rounded-lg bg-indigo-500/15 ring-1 ring-indigo-400/20 flex items-center justify-center">
                        <User class="size-3.5 text-indigo-300" aria-hidden="true" />
                    </div>
                    <h3 id="sec-identity" class="text-sm font-semibold text-zinc-100">Identidad</h3>
                </div>
                <div class="rounded-xl bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04]">

                    <div class="p-4">
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="full_name">
                            Nombre completo
                        </label>
                        <input
                            id="full_name"
                            type="text"
                            bind:value={form.full_name}
                            disabled={!isEditing}
                            class="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-zinc-100
                                   placeholder:text-zinc-600
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:border-indigo-400/40
                                   disabled:opacity-60 disabled:cursor-not-allowed transition"
                        />
                        {#if fieldErrors.full_name}
                            <p class="text-xs text-rose-300 mt-1.5" role="alert">{fieldErrors.full_name[0]}</p>
                        {/if}
                    </div>

                    <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="document_id">Documento</label>
                            <input
                                id="document_id"
                                type="text"
                                bind:value={form.document_id}
                                disabled={!isEditing}
                                class="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-zinc-100
                                       focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                                       disabled:opacity-60 disabled:cursor-not-allowed transition"
                            />
                            {#if fieldErrors.document_id}
                                <p class="text-xs text-rose-300 mt-1.5" role="alert">{fieldErrors.document_id[0]}</p>
                            {/if}
                        </div>
                        <div>
                            <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="service_status">Estado de servicio</label>
                            <select
                                id="service_status"
                                bind:value={form.service_status}
                                disabled={!isEditing}
                                class="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-zinc-100 appearance-none cursor-pointer
                                       focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                                       disabled:opacity-60 disabled:cursor-not-allowed transition"
                            >
                                <option value="ACTIVE">Activo</option>
                                <option value="SUSPENDED">Suspendido</option>
                                <option value="CANCELLED">Cancelado</option>
                                <option value="LIMITED">Limitado</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            <!-- ── Contacto ── -->
            <section aria-labelledby="sec-contact">
                <div class="flex items-center gap-2 mb-3">
                    <div class="size-7 rounded-lg bg-sky-500/15 ring-1 ring-sky-400/20 flex items-center justify-center">
                        <Phone class="size-3.5 text-sky-300" aria-hidden="true" />
                    </div>
                    <h3 id="sec-contact" class="text-sm font-semibold text-zinc-100">Contacto</h3>
                </div>
                <div class="rounded-xl bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04]">
                    <div class="p-4">
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="email">Correo electrónico</label>
                        <div class="relative">
                            <Mail class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 pointer-events-none" aria-hidden="true" />
                            <input
                                id="email"
                                type="email"
                                bind:value={form.email}
                                disabled={!isEditing}
                                class="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-zinc-100
                                       focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                                       disabled:opacity-60 disabled:cursor-not-allowed transition"
                            />
                        </div>
                        {#if fieldErrors.email}
                            <p class="text-xs text-rose-300 mt-1.5" role="alert">{fieldErrors.email[0]}</p>
                        {/if}
                    </div>
                    <div class="p-4">
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="contact_phone">Teléfono</label>
                        <div class="relative">
                            <Phone class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 pointer-events-none" aria-hidden="true" />
                            <input
                                id="contact_phone"
                                type="tel"
                                bind:value={form.contact_phone}
                                disabled={!isEditing}
                                class="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-zinc-100
                                       focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                                       disabled:opacity-60 disabled:cursor-not-allowed transition"
                            />
                        </div>
                        {#if fieldErrors.contact_phone}
                            <p class="text-xs text-rose-300 mt-1.5" role="alert">{fieldErrors.contact_phone[0]}</p>
                        {/if}
                    </div>
                </div>
            </section>

            <!-- ── Contrato ── -->
            <section aria-labelledby="sec-contract">
                <div class="flex items-center justify-between gap-2 mb-3">
                    <div class="flex items-center gap-2">
                        <div class="size-7 rounded-lg bg-violet-500/15 ring-1 ring-violet-400/20 flex items-center justify-center">
                            <Calendar class="size-3.5 text-violet-300" aria-hidden="true" />
                        </div>
                        <h3 id="sec-contract" class="text-sm font-semibold text-zinc-100">Contrato</h3>
                    </div>
                    {#if !isEditing}
                        <span class="inline-flex items-center gap-1 text-[10px] text-zinc-500" title="Sólo personal con permiso 'clientes.editar' puede modificar este campo. Cada cambio queda registrado en auditoría.">
                            <Shield class="size-3" aria-hidden="true" />
                            Protegido
                        </span>
                    {/if}
                </div>
                <div class="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                    <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="contract_date">Fecha de firma</label>
                    <div class="relative">
                        <input
                            id="contract_date"
                            type="date"
                            bind:value={form.contract_date}
                            disabled={!isEditing}
                            max={todayIso}
                            aria-invalid={isEditing && contractDateValidation.state === 'invalid'}
                            title="Fecha en que se firmó el contrato. No puede ser posterior a hoy."
                            class="w-full px-3 py-2 rounded-lg bg-black/30 border text-sm text-zinc-100
                                   focus:outline-none focus-visible:ring-2 transition
                                   disabled:opacity-60 disabled:cursor-not-allowed
                                   {isEditing && contractDateValidation.state === 'valid'   ? 'border-emerald-500/40 focus-visible:ring-emerald-400/60' :
                                    isEditing && contractDateValidation.state === 'invalid' ? 'border-rose-500/40    focus-visible:ring-rose-400/60'    :
                                                                                              'border-white/[0.06]    focus-visible:ring-indigo-400/60'}"
                        />
                        {#if loading && contractDateChanged}
                            <Loader2 class="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-indigo-300 animate-spin pointer-events-none" aria-hidden="true" />
                        {:else if isEditing && contractDateValidation.state === 'valid' && contractDateChanged}
                            <CheckCircle class="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 text-emerald-400 pointer-events-none" aria-hidden="true" />
                        {/if}
                    </div>

                    {#if fieldErrors.contract_date}
                        <p class="text-xs text-rose-300 mt-1.5 flex items-center gap-1" role="alert">
                            <XCircle class="size-3 shrink-0" aria-hidden="true" />
                            {fieldErrors.contract_date[0]}
                        </p>
                    {:else if isEditing && contractDateValidation.state === 'invalid'}
                        <p class="text-xs text-rose-300 mt-1.5 flex items-center gap-1" role="alert">
                            <XCircle class="size-3 shrink-0" aria-hidden="true" />
                            {contractDateValidation.message}
                        </p>
                    {:else if contractAge}
                        <p class="text-xs text-zinc-500 mt-1.5 flex items-center gap-1.5">
                            <Clock class="size-3 shrink-0" aria-hidden="true" />
                            Cliente {contractAge}
                        </p>
                    {/if}
                </div>
            </section>

            <!-- ── Servicio (IP + Plan) ── -->
            <section aria-labelledby="sec-service">
                <div class="flex items-center gap-2 mb-3">
                    <div class="size-7 rounded-lg bg-emerald-500/15 ring-1 ring-emerald-400/20 flex items-center justify-center">
                        <CreditCard class="size-3.5 text-emerald-300" aria-hidden="true" />
                    </div>
                    <h3 id="sec-service" class="text-sm font-semibold text-zinc-100">Servicio</h3>
                </div>
                <div class="rounded-xl bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04]">

                    <!-- IP -->
                    <div class="p-4">
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="ip">Dirección IP</label>
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
                                class="w-full px-3 py-2 pr-10 rounded-lg bg-black/30 border text-sm text-zinc-100 font-mono tabular-nums
                                       placeholder:text-zinc-600 focus:outline-none focus-visible:ring-2 transition
                                       disabled:opacity-60 disabled:cursor-not-allowed
                                       {isEditing && ipValidation.state === 'valid'   ? 'border-emerald-500/40 focus-visible:ring-emerald-400/60' :
                                        isEditing && ipValidation.state === 'invalid' ? 'border-rose-500/40    focus-visible:ring-rose-400/60'    :
                                                                                          'border-white/[0.06]    focus-visible:ring-indigo-400/60'}"
                            />
                            {#if ipRaw && isEditing}
                                <button
                                    type="button"
                                    onclick={checkIp}
                                    disabled={ipCheckLoading || ipValidation.state !== 'valid'}
                                    title="Verificar si la IP está disponible en la red"
                                    aria-label="Verificar disponibilidad de IP"
                                    class="absolute right-2 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/5 disabled:opacity-40 transition-colors"
                                >
                                    {#if ipCheckLoading}
                                        <Loader2 class="size-3.5 animate-spin" />
                                    {:else if ipCheckStatus === 'available'}
                                        <CheckCircle class="size-3.5 text-emerald-400" />
                                    {:else if ipCheckStatus}
                                        <XCircle class="size-3.5 text-rose-400" />
                                    {:else}
                                        <Search class="size-3.5" />
                                    {/if}
                                </button>
                            {/if}
                        </div>
                        {#if fieldErrors.ip}
                            <p class="text-xs text-rose-300 mt-1.5" role="alert">{fieldErrors.ip[0]}</p>
                        {:else if isEditing && ipValidation.state === 'invalid'}
                            <p class="text-xs text-rose-300 mt-1.5" role="alert">{ipValidation.message}</p>
                        {:else if ipCheckError}
                            <p class="text-xs text-rose-300 mt-1.5" role="alert">{ipCheckError}</p>
                        {:else if ipCheckStatus === 'available'}
                            <p class="text-xs text-emerald-300 mt-1.5">IP disponible</p>
                        {:else if ipCheckStatus}
                            <p class="text-xs text-amber-300 mt-1.5">
                                {ipCheckStatus === 'in_use_db' ? 'IP asignada en la base de datos'
                                : ipCheckStatus === 'in_use_router' ? 'IP en uso en el router'
                                : 'IP en uso en DB y router'}
                            </p>
                        {/if}
                    </div>

                    <!-- Plan -->
                    <div class="p-4">
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="plan">Plan de servicio</label>
                        <div class="relative">
                            <CreditCard class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 pointer-events-none" aria-hidden="true" />
                            <select
                                id="plan"
                                onchange={handleSelectPlan}
                                disabled={!isEditing}
                                class="w-full pl-9 pr-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-zinc-100 appearance-none cursor-pointer
                                       focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                                       disabled:opacity-60 disabled:cursor-not-allowed transition"
                            >
                                <option value="">Seleccionar plan</option>
                                {#if plansLoading}
                                    <option disabled>Cargando planes…</option>
                                {:else}
                                    {#each plans as p}
                                        <option value={p.id} selected={form.plan_id === p.id} disabled={!p.can_add_next_client && originalPlanId !== p.id}>
                                            {p.name}
                                        </option>
                                    {/each}
                                {/if}
                            </select>
                        </div>
                        {#if plansError}
                            <p class="text-xs text-rose-300 mt-1.5" role="alert">{plansError}</p>
                        {/if}

                        {#if selectedPlan}
                            <div class="mt-3 rounded-lg bg-black/30 border border-white/[0.06] p-3">
                                <div class="flex items-center justify-between gap-2">
                                    <span class="text-sm font-semibold text-zinc-100 truncate">{selectedPlan.name}</span>
                                    <span class="text-sm font-bold text-emerald-300 tabular-nums">{formatCurrency(selectedPlan.monthly_price)}</span>
                                </div>
                                <div class="mt-1.5 flex items-center gap-3 text-xs text-zinc-400 tabular-nums">
                                    <span class="inline-flex items-center gap-1" title="Descarga">
                                        <ArrowDown class="size-3 text-emerald-400" aria-hidden="true" />
                                        {selectedPlan.download} Mbps
                                    </span>
                                    <span class="inline-flex items-center gap-1" title="Subida">
                                        <ArrowUp class="size-3 text-indigo-400" aria-hidden="true" />
                                        {selectedPlan.upload} Mbps
                                    </span>
                                </div>
                                {#if form.plan_id !== originalPlanId}
                                    <div class="mt-2 pt-2 border-t border-white/[0.05] text-[11px] text-amber-300 flex items-center gap-1.5">
                                        <AlertTriangle class="size-3 shrink-0" aria-hidden="true" />
                                        Cambio de plan: {originalPlan?.name ?? '—'} <ChevronRight class="size-3 inline" aria-hidden="true" /> {selectedPlan.name}
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            </section>

            <!-- ── Ubicación ── -->
            <section aria-labelledby="sec-location">
                <div class="flex items-center gap-2 mb-3">
                    <div class="size-7 rounded-lg bg-amber-500/15 ring-1 ring-amber-400/20 flex items-center justify-center">
                        <MapPin class="size-3.5 text-amber-300" aria-hidden="true" />
                    </div>
                    <h3 id="sec-location" class="text-sm font-semibold text-zinc-100">Ubicación</h3>
                </div>
                <div class="rounded-xl bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.04]">
                    <div class="p-4">
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="installation_address">Dirección de instalación</label>
                        <textarea
                            id="installation_address"
                            rows="2"
                            bind:value={form.installation_address}
                            disabled={!isEditing}
                            placeholder={isEditing ? 'Calle, número, referencias…' : '—'}
                            class="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-zinc-100 resize-none
                                   placeholder:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                                   disabled:opacity-60 disabled:cursor-not-allowed transition"
                        ></textarea>
                        {#if fieldErrors.installation_address}
                            <p class="text-xs text-rose-300 mt-1.5" role="alert">{fieldErrors.installation_address[0]}</p>
                        {/if}
                    </div>
                    <div class="p-4">
                        <label class="block text-[11px] font-medium text-zinc-400 mb-1.5" for="gps_coordinates">Coordenadas GPS</label>
                        <div class="relative">
                            <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 pointer-events-none" aria-hidden="true" />
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
                                class="w-full pl-9 pr-10 py-2 rounded-lg bg-black/30 border text-sm text-zinc-100 font-mono tabular-nums
                                       placeholder:text-zinc-600 focus:outline-none focus-visible:ring-2 transition
                                       disabled:opacity-60 disabled:cursor-not-allowed
                                       {isEditing && gpsValidation.state === 'valid'   ? 'border-emerald-500/40 focus-visible:ring-emerald-400/60' :
                                        isEditing && gpsValidation.state === 'invalid' ? 'border-rose-500/40    focus-visible:ring-rose-400/60'    :
                                                                                          'border-white/[0.06]    focus-visible:ring-indigo-400/60'}"
                            />
                            {#if isEditing}
                                <button
                                    type="button"
                                    onclick={getCurrentCoords}
                                    disabled={geoLoading}
                                    aria-label="Obtener ubicación actual"
                                    title="Capturar la ubicación actual del dispositivo"
                                    class="absolute right-2 top-1/2 -translate-y-1/2 size-7 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-indigo-300 hover:bg-white/5 disabled:opacity-40 transition-colors"
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
                            <p class="text-xs text-rose-300 mt-1.5" role="alert">{coordsError}</p>
                        {:else if isEditing && gpsValidation.state === 'valid'}
                            <p class="text-xs text-emerald-300 mt-1.5 flex items-center gap-1.5 font-mono tabular-nums">
                                <CheckCircle class="size-3 shrink-0" aria-hidden="true" />
                                {gpsValidation.parsed!.lat.toFixed(6)}, {gpsValidation.parsed!.lon.toFixed(6)}
                            </p>
                        {:else if isEditing && gpsValidation.state === 'invalid'}
                            <p class="text-xs text-rose-300 mt-1.5 flex items-center gap-1" role="alert">
                                <XCircle class="size-3 shrink-0" aria-hidden="true" />
                                {gpsValidation.message}
                            </p>
                        {/if}
                    </div>
                </div>
            </section>

            <!-- ── Notas ── -->
            <section aria-labelledby="sec-notes">
                <div class="flex items-center gap-2 mb-3">
                    <div class="size-7 rounded-lg bg-zinc-500/15 ring-1 ring-zinc-400/20 flex items-center justify-center">
                        <FileText class="size-3.5 text-zinc-300" aria-hidden="true" />
                    </div>
                    <h3 id="sec-notes" class="text-sm font-semibold text-zinc-100">Notas internas</h3>
                </div>
                <div class="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                    <textarea
                        id="observations"
                        rows="4"
                        bind:value={form.observations}
                        disabled={!isEditing}
                        placeholder={isEditing ? 'Agregar nota interna…' : 'Sin notas registradas'}
                        class="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.06] text-sm text-zinc-100 resize-none
                               placeholder:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60
                               disabled:opacity-60 disabled:cursor-not-allowed transition"
                    ></textarea>
                </div>
            </section>

            <!-- ── Motivo inteligente de auditoría ── -->
            {#if hasChanges && isEditing}
                <section aria-labelledby="sec-reason">
                    <div class="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02] p-4 space-y-3">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <div class="size-7 rounded-lg bg-amber-500/20 ring-1 ring-amber-400/30 flex items-center justify-center">
                                    <Shield class="size-3.5 text-amber-300" aria-hidden="true" />
                                </div>
                                <div>
                                    <h3 id="sec-reason" class="text-sm font-semibold text-amber-200">Motivo del cambio</h3>
                                    <p class="text-[11px] text-amber-400/80">Quedará registrado en auditoría.</p>
                                </div>
                            </div>
                            {#if !reasonAutoFilled && smartReason}
                                <button
                                    type="button"
                                    onclick={regenerateReason}
                                    title="Restaurar la sugerencia automática basada en los cambios detectados"
                                    class="inline-flex items-center gap-1 text-[11px] font-medium text-amber-200 hover:text-amber-100 px-2 py-1 rounded-md hover:bg-amber-500/10 transition-colors"
                                >
                                    <Sparkles class="size-3" aria-hidden="true" />
                                    Auto
                                </button>
                            {/if}
                        </div>

                        <!-- Resumen visual de cambios -->
                        <div class="flex flex-wrap gap-1.5">
                            {#each changedFields as field}
                                <span class="inline-flex items-center gap-1 text-[10px] font-medium text-amber-200 bg-amber-500/15 border border-amber-400/25 px-2 py-0.5 rounded-md">
                                    {FIELD_LABELS[field] ?? field}
                                </span>
                            {/each}
                        </div>

                        <div class="relative">
                            <input
                                id="reason"
                                type="text"
                                value={form.reason}
                                oninput={handleReasonInput}
                                placeholder="Describe brevemente el motivo del cambio…"
                                title="Texto que quedará en el log de auditoría. Puedes modificarlo o usar la sugerencia automática."
                                aria-required="true"
                                class="w-full px-3 py-2.5 pr-16 rounded-lg bg-black/40 border border-amber-500/30 text-sm text-zinc-100
                                       placeholder:text-zinc-600
                                       focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 transition"
                            />
                            {#if reasonAutoFilled && smartReason}
                                <span
                                    class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-500/15 border border-amber-400/30 px-1.5 py-0.5 rounded"
                                    title="Texto generado automáticamente a partir de los cambios detectados. Puedes editarlo libremente."
                                >
                                    <Sparkles class="size-3" aria-hidden="true" />
                                    Auto
                                </span>
                            {/if}
                        </div>

                        {#if fieldErrors.reason}
                            <p class="text-xs text-rose-300" role="alert">{fieldErrors.reason[0]}</p>
                        {/if}
                    </div>
                </section>
            {/if}

        </div>
    </div>

    <!-- ═══ FOOTER ═══ -->
    {#if isEditing}
        <div class="shrink-0 px-6 py-4 border-t border-white/[0.06] bg-[#0b0b0d]/95 backdrop-blur">
            <div class="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3">
                <span class="text-[11px] text-zinc-500">
                    {hasChanges ? `${changedFields.length} cambio${changedFields.length === 1 ? '' : 's'} pendiente${changedFields.length === 1 ? '' : 's'}` : 'Sin cambios'}
                </span>
                <div class="flex gap-2 sm:gap-3">
                    <button
                        type="button"
                        onclick={() => { isEditing = false; if (client) initForm(client); }}
                        disabled={loading}
                        class="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-white/10 text-sm font-medium text-zinc-300
                               hover:bg-white/5 hover:text-zinc-100 hover:border-white/20
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-white/25
                               disabled:opacity-50 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onclick={submit}
                        disabled={loading || !hasChanges}
                        title={!hasChanges ? 'No hay cambios por guardar' : 'Guardar cambios'}
                        class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold
                               hover:bg-indigo-400 active:bg-indigo-600 shadow-lg shadow-indigo-900/40
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0d]
                               disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {#if loading}
                            <Loader2 class="size-3.5 animate-spin" aria-hidden="true" />
                            Guardando…
                        {:else}
                            <Save class="size-3.5" aria-hidden="true" />
                            Guardar cambios
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
