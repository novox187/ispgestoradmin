<script lang="ts">
  import { XIcon, Loader2, CrosshairIcon, SearchIcon, CheckCircleIcon, XCircleIcon, AlertTriangle } from '@lucide/svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { createEventDispatcher } from 'svelte';
  import { API_BASE } from '$lib/config';
  import { onMount } from 'svelte';

  const props = $props<{
    clientId: number | null;
    open: boolean;
    onClose?: () => void;
    onUpdated?: (client: any) => void;
  }>();

  const dispatch = createEventDispatcher();

  let loading = $state(false);
  let fetching = $state(false);
  let errorMsg = $state('');
  let fieldErrors = $state<Record<string, string[]>>({});
  let geoLoading = $state(false);
  let coordsError = $state<string | null>(null);
  let ipCheckLoading = $state(false);
  let ipCheckError = $state<string | null>(null);
  let ipCheckStatus = $state<'available' | 'in_use_db' | 'in_use_router' | 'in_use_both' | null>(null);

  type PlanOption = { id: number; name: string; monthly_price: number; download: number; upload: number };
  let plans = $state<PlanOption[]>([]);
  let plansLoading = $state(false);
  let plansError = $state<string | null>(null);

  let initialForm = $state<any>(null);

  let form = $state({
    full_name: '',
    document_id: '',
    contact_phone: '',
    email: '',
    // password: '', // Password update usually handled separately or optional
    installation_address: '',
    gps_coordinates: '',
    contract_date: '',
    service_status: 'ACTIVE',
    ip: '',
    observations: '',
    plan_id: undefined as number | undefined,
    reason: '' // For auditing
  });

  let originalPlanId: number | undefined = undefined;
  let selectedPlan = $derived(plans.find(p => p.id === form.plan_id));

  $effect(() => {
    if (props.open && props.clientId) {
      loadClientData(props.clientId);
      loadPlans();
    }
  });

  async function loadPlans() {
    plansLoading = true;
    plansError = null;
    try {
      const res = await fetch(`${API_BASE}/plans`, { headers: { Accept: 'application/json' } }); // Assuming /plans returns full details
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
      console.log('Planes cargados:', plans);
    } catch (e) {
      console.error('Error cargando planes:', e);
      plansError = 'No se pudieron cargar los planes.';
    } finally {
      plansLoading = false;
    }
  }

  async function loadClientData(id: number) {
    fetching = true;
    errorMsg = '';
    try {
      const token = localStorage.getItem('employee_token');
      const res = await fetch(`${API_BASE}/admin/clientes/full/${id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      });
      if (!res.ok) throw new Error('Error cargando cliente');
      const data = await res.json();
      const c = data.client || data; // Adjust based on actual response structure
      
      form = {
        full_name: c.name || c.full_name || '',
        document_id: c.document_id || c.dni || '',
        contact_phone: c.phone || c.contact_phone || '',
        email: c.email || '',
        installation_address: c.address || c.installation_address || '',
        gps_coordinates: c.coordinates || c.gps_coordinates || '',
        contract_date: c.contract_date || '',
        service_status: c.status || c.service_status || 'ACTIVE',
        ip: c.ip_address || c.ip || '',
        observations: c.notes || c.observations || '',
        plan_id: c.current_plan_id || (c.client_plans?.[0]?.plan_id) || undefined,
        reason: ''
      };
      
      originalPlanId = form.plan_id;
      initialForm = { ...form };

    } catch (e) {
      errorMsg = 'No se pudo cargar la información del cliente.';
      console.error(e);
    } finally {
      fetching = false;
    }
  }

  function handleSelectPlan(e: Event) {
    const target = e.target as HTMLSelectElement;
    const selectedId = Number(target.value || 0) || undefined;
    form.plan_id = selectedId;
  }

  let hasChanges = $derived.by(() => {
    if (!initialForm) return false;
    const keys = Object.keys(form).filter(k => k !== 'reason') as (keyof typeof form)[];
    return keys.some(key => form[key] !== initialForm[key]);
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
        coordsError = 'No se pudo obtener la ubicación';
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
      fieldErrors = { ...fieldErrors, reason: ['Debe indicar un motivo para el cambio (mínimo 5 caracteres).'] };
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
      const url = `${API_BASE}/admin/clientes/${props.clientId}`;
      
      const res = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(form)
      });

      if (res.ok) {
        const updatedClient = await res.json();
        if (props.onUpdated) props.onUpdated(updatedClient);
        dispatch('updated', updatedClient);
        if (props.onClose) props.onClose();
      } else {
        const payload = await res.json().catch(() => ({}));
        if (res.status === 422) {
          fieldErrors = payload.errors || {};
          errorMsg = payload.message || 'Errores de validación.';
        } else {
          errorMsg = payload.message || `Error ${res.status}: No se pudo actualizar el cliente`;
        }
      }
    } catch (e) {
      console.error('Error actualizando cliente:', e);
      errorMsg = 'Error de red o del servidor.';
    } finally {
      loading = false;
    }
  }

  const animation =
    'transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} closeOnEscape={!loading} closeOnInteractOutside={!loading} onOpenChange={(e) => { if(!e.open && props.onClose) props.onClose() }}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-40 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class="card bg-surface-100-900 w-full max-w-2xl p-6 space-y-4 shadow-xl rounded-xl {animation} max-h-[90vh] overflow-y-auto">
        <header class="flex justify-between items-center sticky top-0 bg-surface-100-900 z-10 pb-2 border-b border-neutral-800">
          <Dialog.Title class="text-lg font-bold">Editar Cliente</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal" onclick={props.onClose}>
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        {#if fetching}
           <div class="flex justify-center p-8">
             <Loader2 class="size-8 animate-spin text-primary-500" />
           </div>
        {:else}
          <div class="space-y-4">
            {#if errorMsg}
              <div class="text-sm text-red-400 bg-red-500/10 border border-red-600 rounded-md p-2 flex items-start gap-2">
                <AlertTriangle class="size-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            {/if}

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Basic Info -->
              <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="full_name">Nombre</label>
                <input id="full_name" type="text" bind:value={form.full_name}
                  class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0" />
                {#if fieldErrors.full_name}<p class="text-xs text-red-400 mt-1">{fieldErrors.full_name[0]}</p>{/if}
              </div>

              <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="document_id">Documento</label>
                <input id="document_id" type="text" bind:value={form.document_id}
                  class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0" />
                {#if fieldErrors.document_id}<p class="text-xs text-red-400 mt-1">{fieldErrors.document_id[0]}</p>{/if}
              </div>

              <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="email">Email</label>
                <input id="email" type="email" bind:value={form.email}
                  class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0" />
                {#if fieldErrors.email}<p class="text-xs text-red-400 mt-1">{fieldErrors.email[0]}</p>{/if}
              </div>

              <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="contact_phone">Teléfono</label>
                <input id="contact_phone" type="tel" bind:value={form.contact_phone}
                  class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0" />
                {#if fieldErrors.contact_phone}<p class="text-xs text-red-400 mt-1">{fieldErrors.contact_phone[0]}</p>{/if}
              </div>

              <!-- Address & GPS -->
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-foreground mb-2" for="installation_address">Dirección de instalación</label>
                <textarea id="installation_address" rows="2" bind:value={form.installation_address}
                  class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0"></textarea>
                {#if fieldErrors.installation_address}<p class="text-xs text-red-400 mt-1">{fieldErrors.installation_address[0]}</p>{/if}
              </div>

              <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="gps_coordinates">Coordenadas GPS</label>
                <div class="relative">
                  <input id="gps_coordinates" type="text" bind:value={form.gps_coordinates}
                    class="w-full px-4 py-2 pr-10 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0" />
                  <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                    onclick={getCurrentCoords} disabled={geoLoading}>
                    {#if geoLoading} <Loader2 class="size-4 animate-spin" /> {:else} <CrosshairIcon class="size-4" /> {/if}
                  </button>
                </div>
              </div>

              <!-- Technical Info -->
              <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="ip">IP</label>
                <div class="relative">
                  <input id="ip" type="text" bind:value={form.ip}
                    class="w-full px-4 py-2 pr-10 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0" />
                  {#if form.ip}
                    <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                      onclick={checkIp} disabled={ipCheckLoading}>
                      {#if ipCheckLoading} <Loader2 class="size-4 animate-spin" /> 
                      {:else if ipCheckStatus === 'available'} <CheckCircleIcon class="size-4 text-emerald-500" />
                      {:else if ipCheckStatus} <XCircleIcon class="size-4 text-red-500" />
                      {:else} <SearchIcon class="size-4" /> {/if}
                    </button>
                  {/if}
                </div>
                {#if fieldErrors.ip}<p class="text-xs text-red-400 mt-1">{fieldErrors.ip[0]}</p>{/if}
                {#if ipCheckError}<p class="text-xs text-red-400 mt-1">{ipCheckError}</p>{/if}
              </div>

              <!-- Plan Selector & Preview -->
              <div class="md:col-span-2 border-t border-neutral-800 pt-4 mt-2">
                <h3 class="text-sm font-bold text-foreground mb-3">Plan de Servicio</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-foreground mb-2" for="plan">Plan</label>
                    <select id="plan" onchange={handleSelectPlan}
                      class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0 bg-neutral-900">
                      <option value="">Seleccionar plan</option>
                      {#if plansLoading}
                        <option disabled>Cargando planes...</option>
                      {:else}
                        {#each plans as p}
                          <option value={p.id} selected={form.plan_id === p.id}>{p.name} - ${p.monthly_price}</option>
                        {/each}
                      {/if}
                    </select>
                  </div>

                  <div class="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3">
                    <div class="text-xs text-muted-foreground mb-1">Vista Previa del Plan</div>
                    {#if selectedPlan}
                      <div class="flex justify-between items-center mb-1">
                        <span class="font-medium text-foreground">{selectedPlan.name}</span>
                        <span class="font-bold text-emerald-400">${selectedPlan.monthly_price}</span>
                      </div>
                      <div class="text-xs text-gray-400 flex gap-2">
                        <span>{selectedPlan.download}Mbps <span class="text-emerald-500">↓</span></span>
                        <span>{selectedPlan.upload}Mbps <span class="text-blue-500">↑</span></span>
                      </div>
                      {#if form.plan_id !== originalPlanId}
                         <div class="mt-2 text-xs text-yellow-500 flex items-center gap-1">
                           <AlertTriangle class="size-3" /> Cambio de plan detectado
                         </div>
                      {/if}
                    {:else}
                      <div class="text-sm text-muted-foreground italic">Ningún plan seleccionado</div>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Observations & Audit -->
              <div class="md:col-span-2 border-t border-neutral-800 pt-4 mt-2">
                <label class="block text-sm font-medium text-foreground mb-2" for="observations">Observaciones</label>
                <textarea id="observations" rows="2" bind:value={form.observations}
                  class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0"></textarea>
              </div>

              {#if hasChanges}
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-foreground mb-2" for="reason">Motivo del cambio <span class="text-red-400">*</span></label>
                <input id="reason" type="text" placeholder="Requerido para auditoría (ej. Solicitud del cliente)" bind:value={form.reason}
                  class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0" />
                {#if fieldErrors.reason}<p class="text-xs text-red-400 mt-1">{fieldErrors.reason[0]}</p>{/if}
              </div>
              {/if}
            </div>
          </div>

          <footer class="flex justify-end gap-2 pt-4 border-t border-neutral-800 mt-4">
            <button type="button" class="btn preset-tonal" onclick={props.onClose} disabled={loading}>Cancelar</button>
            <button type="button" class="btn preset-filled inline-flex items-center gap-2" onclick={submit} disabled={loading || !hasChanges}>
              {#if loading} <Loader2 class="size-4 animate-spin" /> Guardando... {:else} Guardar Cambios {/if}
            </button>
          </footer>
        {/if}
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
