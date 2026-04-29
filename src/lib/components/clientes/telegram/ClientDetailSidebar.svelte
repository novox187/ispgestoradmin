<script lang="ts">
  import { 
    X, Loader2, Crosshair, Search, CheckCircle, XCircle, AlertTriangle, 
    Save, Phone, Mail, MapPin, CreditCard, Edit3, User, Settings, FileText, Wallet
  } from '@lucide/svelte';
  import { createEventDispatcher, onMount, untrack } from 'svelte';
  import { API_BASE } from '$lib/config';
  import { toast } from 'svelte-sonner';

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
  
  // Geo & IP states
  let geoLoading = $state(false);
  let coordsError = $state<string | null>(null);
  let ipCheckLoading = $state(false);
  let ipCheckError = $state<string | null>(null);
  let ipCheckStatus = $state<'available' | 'in_use_db' | 'in_use_router' | 'in_use_both' | null>(null);

  // Plans
  type PlanOption = { id: number; name: string; monthly_price: number; download: number; upload: number };
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

  // Init form when client changes
  $effect(() => {
    if (client && client.id !== currentClientId) {
      currentClientId = client.id;
      untrack(() => initForm(client));
    }
  });

  function initForm(c: Client) {
    let rawStatus =  c.service_status?.toUpperCase() || 'ACTIVE';
    // Map invalid 'INACTIVE' or others to a valid enum
    const validStatuses = ['ACTIVE', 'LIMITED', 'SUSPENDED', 'CANCELLED'];
    if (!validStatuses.includes(rawStatus)) {
        if (rawStatus === 'INACTIVE') rawStatus = 'SUSPENDED'; // Default inactive to suspended
        else rawStatus = 'ACTIVE'; // Fallback
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
  }

  async function loadPlans() {
    plansLoading = true;
    plansError = null;
    try {
      const token = localStorage.getItem('employee_token');
      const res = await fetch(`${API_BASE}/plans`, { 
          headers: { 
              Accept: 'application/json',
              Authorization: `Bearer ${token}` 
            } 
        });
      let payload: any = null;
      try { payload = await res.json(); } catch {}
      const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      plans = list.map((p: any) => ({ 
        id: Number(p.id), 
        name: String(p.name),
        monthly_price: Number(p.monthly_price),
        download: Number(p.download_speed),
        upload: Number(p.upload_speed)
      }));
    } catch (e) {
      console.error('Error cargando planes:', e);
      plansError = 'No se pudieron cargar los planes.';
    } finally {
      plansLoading = false;
    }
  }

  onMount(() => {
    loadPlans();
  });

  function handleSelectPlan(e: Event) {
    const target = e.target as HTMLSelectElement;
    const selectedId = Number(target.value || 0) || undefined;
    form.plan_id = selectedId;
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
      (position) => {
        const { latitude, longitude } = position.coords;
        form.gps_coordinates = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        geoLoading = false;
      },
      (err) => {
        coordsError = 'Error al obtener ubicación';
        geoLoading = false;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function isValidIp(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    for (const p of parts) {
      if (!/^\d{1,3}$/.test(p)) return false;
      const n = Number(p);
      if (n < 0 || n > 255) return false;
    }
    return true;
  }

  async function checkIp() {
    ipCheckError = null;
    ipCheckStatus = null;
    const ip = form.ip.trim();
    if (!ip || !isValidIp(ip)) {
      ipCheckError = 'IP inválida';
      return;
    }
    ipCheckLoading = true;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      const token = localStorage.getItem('employee_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = `${API_BASE}/mikrotik/ip/check?ip=${encodeURIComponent(ip)}`;
      const res = await fetch(url, { method: 'GET', headers });
      let payload: any = null;
      try { payload = await res.json(); } catch {}
      if (!res.ok) {
        ipCheckError = (payload?.message || `Error ${res.status}`);
      } else {
        const status = payload?.data?.status || null;
        ipCheckStatus = status;
      }
    } catch (e) {
      ipCheckError = 'Error de red';
    } finally {
      ipCheckLoading = false;
    }
  }

  async function submit() {
    if (!form.reason || form.reason.trim().length < 5) {
        fieldErrors = { ...fieldErrors, reason: ['Motivo requerido (min 5 caracteres).'] };
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
      if (!client) {
        toast.error('Cliente no válido');
        return;
      }
      const url = `${API_BASE}/admin/clientes/${client.id}`;
      
      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(form)
      });

      if (res.ok) {
        const updatedClient = await res.json();
        dispatch('updated', updatedClient);
        toast.success('Cliente actualizado correctamente');
        // Update initial form so hasChanges becomes false
        initForm(updatedClient.client || updatedClient);
      } else {
        const payload = await res.json().catch(() => ({}));
        if (res.status === 422) {
          fieldErrors = payload.errors || {};
          errorMsg = payload.message || 'Errores de validación.';
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
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  }
</script>

<div class="h-full flex flex-col bg-[#0f0f0f] text-gray-100">
    <!-- Header -->
    <div class="px-8 py-6 border-b border-neutral-800 flex justify-between items-center bg-[#1c1c1e] shrink-0">
        <div class="flex items-center gap-5">
            <div class="size-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-xl">
                {getInitials(form.full_name)}
            </div>
            <div class="flex flex-col justify-center">
                <div class="flex items-center gap-3">
                    <h2 class="text-xl font-bold text-white">{form.full_name}</h2>
                    <button 
                        onclick={() => isEditing = !isEditing} 
                        class="p-1.5 rounded-md transition-colors {isEditing ? 'bg-blue-500/20 text-blue-400' : 'text-neutral-400 hover:text-white hover:bg-white/10'}"
                        title={isEditing ? 'Desactivar edición' : 'Habilitar edición'}
                    >
                        <Edit3 class="size-4" />
                    </button>
                </div>
                <div class="flex items-center gap-2 mt-1.5">
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        ID: {client?.id}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-medium 
                        {form.service_status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                         form.service_status === 'SUSPENDED' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                         form.service_status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                         'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'}">
                        {form.service_status}
                    </span>
                </div>
            </div>
        </div>
        <button onclick={onClose} class="text-neutral-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
            <X class="size-6" />
        </button>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        <div class="max-w-5xl mx-auto space-y-8">
            
            {#if errorMsg}
                <div class="text-sm text-red-400 bg-red-500/10 border border-red-600 rounded-lg p-3 flex items-start gap-3">
                    <AlertTriangle class="size-5 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            {/if}

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Basic Info -->
                <div class="space-y-5 bg-[#1c1c1e] p-6 rounded-xl border border-neutral-800 shadow-sm">
                    <div class="flex items-center gap-2 border-b border-neutral-800 pb-3">
                        <User class="size-5 text-blue-400" />
                        <h3 class="text-sm font-bold text-white uppercase tracking-wider">Información Básica</h3>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="full_name">Nombre Completo</label>
                            <input id="full_name" type="text" bind:value={form.full_name} disabled={!isEditing}
                                class="w-full px-3 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
                            {#if fieldErrors.full_name}<p class="text-xs text-red-400 mt-1">{fieldErrors.full_name[0]}</p>{/if}
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="document_id">Documento ID</label>
                                <input id="document_id" type="text" bind:value={form.document_id} disabled={!isEditing}
                                    class="w-full px-3 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
                                {#if fieldErrors.document_id}<p class="text-xs text-red-400 mt-1">{fieldErrors.document_id[0]}</p>{/if}
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="service_status">Estado del Servicio</label>
                                <select id="service_status" bind:value={form.service_status} disabled={!isEditing}
                                    class="w-full px-3 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none disabled:opacity-60 disabled:cursor-not-allowed">
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="SUSPENDED">SUSPENDED</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                    <option value="LIMITED">LIMITED</option>
                                </select>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="email">Email</label>
                                <div class="relative">
                                    <Mail class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                                    <input id="email" type="email" bind:value={form.email} disabled={!isEditing}
                                        class="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
                                </div>
                                {#if fieldErrors.email}<p class="text-xs text-red-400 mt-1">{fieldErrors.email[0]}</p>{/if}
                            </div>

                            <div>
                                <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="contact_phone">Teléfono</label>
                                <div class="relative">
                                    <Phone class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                                    <input id="contact_phone" type="tel" bind:value={form.contact_phone} disabled={!isEditing}
                                        class="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
                                </div>
                                {#if fieldErrors.contact_phone}<p class="text-xs text-red-400 mt-1">{fieldErrors.contact_phone[0]}</p>{/if}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Technical -->
                <div class="space-y-5 bg-[#1c1c1e] p-6 rounded-xl border border-neutral-800 shadow-sm">
                    <div class="flex items-center gap-2 border-b border-neutral-800 pb-3">
                        <Settings class="size-5 text-purple-400" />
                        <h3 class="text-sm font-bold text-white uppercase tracking-wider">Detalles Técnicos</h3>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="wallet_balance">Balance de Billetera</label>
                            <div class="relative">
                                <Wallet class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                                <input
                                    id="wallet_balance"
                                    type="text"
                                    value={formatCurrency(walletBalance)}
                                    readonly
                                    class="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="ip">Dirección IP</label>
                            <div class="relative">
                                <input id="ip" type="text" bind:value={form.ip} disabled={!isEditing}
                                    class="w-full px-3 py-2 pr-10 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
                                {#if form.ip && isEditing}
                                    <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white disabled:opacity-50"
                                        onclick={checkIp} disabled={ipCheckLoading}>
                                        {#if ipCheckLoading} <Loader2 class="size-4 animate-spin" /> 
                                        {:else if ipCheckStatus === 'available'} <CheckCircle class="size-4 text-emerald-500" />
                                        {:else if ipCheckStatus} <XCircle class="size-4 text-red-500" />
                                        {:else} <Search class="size-4" /> {/if}
                                    </button>
                                {/if}
                            </div>
                            {#if fieldErrors.ip}<p class="text-xs text-red-400 mt-1">{fieldErrors.ip[0]}</p>{/if}
                            {#if ipCheckError}<p class="text-xs text-red-400 mt-1">{ipCheckError}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="plan">Plan de Servicio</label>
                            <div class="relative">
                                <CreditCard class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                                <select id="plan" onchange={handleSelectPlan} disabled={!isEditing}
                                    class="w-full pl-9 pr-8 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none disabled:opacity-60 disabled:cursor-not-allowed">
                                    <option value="">Seleccionar plan</option>
                                    {#if plansLoading}
                                        <option disabled>Cargando planes...</option>
                                    {:else}
                                        {#each plans as p}
                                            <option value={p.id} selected={form.plan_id === p.id}>{p.name}</option>
                                        {/each}
                                    {/if}
                                </select>
                            </div>
                        </div>

                        {#if selectedPlan}
                            <div class="bg-[#0f0f0f] border border-neutral-800 rounded-lg p-4">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="font-medium text-white text-sm">{selectedPlan.name}</span>
                                    <span class="font-bold text-emerald-400 text-sm">${selectedPlan.monthly_price}</span>
                                </div>
                                <div class="text-xs text-neutral-400 flex gap-4">
                                    <span class="flex items-center gap-1">{selectedPlan.download}Mbps <span class="text-emerald-500 font-bold">↓</span></span>
                                    <span class="flex items-center gap-1">{selectedPlan.upload}Mbps <span class="text-blue-500 font-bold">↑</span></span>
                                </div>
                                {#if form.plan_id !== originalPlanId}
                                    <div class="mt-3 text-xs text-yellow-500 flex items-center gap-1.5">
                                        <AlertTriangle class="size-4" /> Cambio de plan detectado
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Location -->
                <div class="space-y-5 bg-[#1c1c1e] p-6 rounded-xl border border-neutral-800 shadow-sm">
                    <div class="flex items-center gap-2 border-b border-neutral-800 pb-3">
                        <MapPin class="size-5 text-emerald-400" />
                        <h3 class="text-sm font-bold text-white uppercase tracking-wider">Ubicación</h3>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="installation_address">Dirección de Instalación</label>
                            <textarea id="installation_address" rows="3" bind:value={form.installation_address} disabled={!isEditing}
                                class="w-full px-3 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"></textarea>
                            {#if fieldErrors.installation_address}<p class="text-xs text-red-400 mt-1">{fieldErrors.installation_address[0]}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="gps_coordinates">Coordenadas GPS</label>
                            <div class="relative">
                                <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500" />
                                <input id="gps_coordinates" type="text" bind:value={form.gps_coordinates} disabled={!isEditing}
                                    class="w-full pl-9 pr-10 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
                                {#if isEditing}
                                    <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white disabled:opacity-50"
                                        onclick={getCurrentCoords} disabled={geoLoading}>
                                        {#if geoLoading} <Loader2 class="size-4 animate-spin" /> {:else} <Crosshair class="size-4" /> {/if}
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Observations -->
                <div class="space-y-5 bg-[#1c1c1e] p-6 rounded-xl border border-neutral-800 shadow-sm">
                    <div class="flex items-center gap-2 border-b border-neutral-800 pb-3">
                        <FileText class="size-5 text-yellow-400" />
                        <h3 class="text-sm font-bold text-white uppercase tracking-wider">Notas Internas</h3>
                    </div>
                    <textarea id="observations" rows="6" bind:value={form.observations} disabled={!isEditing} placeholder={isEditing ? "Agregar nota..." : "Sin notas"}
                        class="w-full px-3 py-2 bg-[#0f0f0f] border border-neutral-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed"></textarea>
                </div>
            </div>

            <!-- Audit Reason -->
            {#if hasChanges && isEditing}
                <div class="bg-[#1c1c1e] p-6 rounded-xl border border-yellow-500/30 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                    <label class="block text-sm font-medium text-yellow-400 mb-2" for="reason">Motivo del cambio (Requerido para auditar)</label>
                    <input id="reason" type="text" bind:value={form.reason} placeholder="Ej. Solicitud del cliente, actualización de plan..."
                        class="w-full px-4 py-3 bg-[#0f0f0f] border border-yellow-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-yellow-500 transition-colors" />
                    {#if fieldErrors.reason}<p class="text-sm text-red-400 mt-2">{fieldErrors.reason[0]}</p>{/if}
                </div>
            {/if}

        </div>
    </div>

    <!-- Footer Actions -->
    {#if isEditing}
        <div class="px-8 py-4 border-t border-neutral-800 bg-[#1c1c1e] flex justify-end gap-4 shrink-0 animate-in fade-in slide-in-from-bottom-2">
            <button onclick={() => isEditing = false} class="px-6 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white text-sm font-medium transition-colors">
                Cancelar Edición
            </button>
            <button onclick={submit} disabled={loading || !hasChanges} 
                class="px-8 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                {#if loading}
                    <Loader2 class="size-4 animate-spin" /> Guardando...
                {:else}
                    <Save class="size-4" /> Guardar Cambios
                {/if}
            </button>
        </div>
    {/if}
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #3f3f46;
        border-radius: 2px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #52525b;
    }
</style>
