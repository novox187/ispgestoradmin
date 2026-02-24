<script lang="ts">
  import { XIcon, Loader2, CrosshairIcon, SearchIcon, CheckCircleIcon, XCircleIcon } from '@lucide/svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { createEventDispatcher } from 'svelte';
  import { API_BASE } from '$lib/config';
  import { onMount } from 'svelte';

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
    if (!props.showAddClient) {
      prefilled = false;
      return;
    }
    if (props.showAddClient && !prefilled) {
      form.full_name = (props.newClient?.name || form.full_name);
      form.email = (props.newClient?.email || form.email);
      form.contact_phone = (props.newClient?.phone || form.contact_phone);
      form.plan = (props.newClient?.plan || form.plan);
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

  onMount(() => {
    loadPlans();
  });

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
          if (p.state === 'denied') {
            coordsError = 'Permiso de ubicación denegado en el navegador';
          }
        }).catch(() => {});
      }
    } catch {}
    geoLoading = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        form.gps_coordinates = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        geoLoading = false;
      },
      (err) => {
        console.error('Geolocation error:', err);
        if (err && typeof err.code === 'number') {
          if (err.code === 1) coordsError = 'Permiso de ubicación denegado';
          else if (err.code === 2) coordsError = 'Ubicación no disponible';
          else if (err.code === 3) coordsError = 'Tiempo de espera agotado';
          else coordsError = 'No se pudo obtener la ubicación';
        } else {
          coordsError = 'No se pudo obtener la ubicación';
        }
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
      const token =
        (typeof localStorage !== 'undefined' && (localStorage.getItem('admin_token') || localStorage.getItem('client_token'))) || '';
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
    errorMsg = '';
    fieldErrors = {};
    errorId = null;
    loading = true;
    try {
      const token =
        (typeof localStorage !== 'undefined' && (localStorage.getItem('admin_token') || localStorage.getItem('client_token'))) || '';
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

      let debugBody: string | null = null;
      try {
        debugBody = await res.clone().text();
      } catch {}

      if (res.ok) {
        const client = await res.json();
        dispatch('created', client);
        dispatch('close', { open: false });
        form = {
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
        };
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
        try {
          const data = await res.json();
          msg = data?.message || data?.error || '';
          errorId = data?.error_id || null;
        } catch {
          try { msg = await res.text(); } catch { msg = ''; }
        }
        errorMsg = msg || `Ruta no encontrada: ${url}`;
      } else if (res.status === 401) {
        let payload: any = null;
        try { payload = await res.json(); } catch {}
        errorId = payload?.error_id || null;
        errorMsg = (payload?.message || 'No autenticado. Verifique su token.') as string;
      } else {
        let msg = '';
        try {
          const data = await res.json();
          msg = data?.message || data?.error || '';
          errorId = data?.error_id || null;
        } catch {
          try { msg = await res.text(); } catch { msg = ''; }
        }
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

<Dialog open={props.showAddClient} closeOnEscape closeOnInteractOutside onOpenChange={() => {dispatch('close', { open: false })}}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-40 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class="card bg-surface-100-900 w-full max-w-2xl p-6 space-y-4 shadow-xl rounded-xl {animation}">
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Agregar Nuevo Cliente</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        <div class="space-y-4">
          {#if errorMsg}
            <div class="text-sm text-red-400 bg-red-500/10 border border-red-600 rounded-md p-2">
              {errorMsg}{errorId ? ` (error_id: ${errorId})` : ''}
            </div>
          {/if}

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="full_name">Nombre</label>
              <input id="full_name" type="text" placeholder="Nombre completo" bind:value={form.full_name}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
              {#if fieldErrors.full_name}<p class="text-xs text-red-400 mt-1">{fieldErrors.full_name[0]}</p>{/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="document_id">Documento</label>
              <input id="document_id" type="text" placeholder="V-12345678" bind:value={form.document_id}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
              {#if fieldErrors.document_id}<p class="text-xs text-red-400 mt-1">{fieldErrors.document_id[0]}</p>{/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="email">Email</label>
              <input id="email" type="email" placeholder="email@example.com" bind:value={form.email}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
              {#if fieldErrors.email}<p class="text-xs text-red-400 mt-1">{fieldErrors.email[0]}</p>{/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="contact_phone">Teléfono</label>
              <input id="contact_phone" type="tel" placeholder="+58 412 000 0000" bind:value={form.contact_phone}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
              {#if fieldErrors.contact_phone}<p class="text-xs text-red-400 mt-1">{fieldErrors.contact_phone[0]}</p>{/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="password">Contraseña</label>
              <input id="password" type="password" placeholder="Mínimo 6 caracteres" bind:value={form.password}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
              {#if fieldErrors.password}<p class="text-xs text-red-400 mt-1">{fieldErrors.password[0]}</p>{/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="contract_date">Fecha de contrato</label>
              <input id="contract_date" type="date" bind:value={form.contract_date}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
              {#if fieldErrors.contract_date}<p class="text-xs text-red-400 mt-1">{fieldErrors.contract_date[0]}</p>{/if}
            </div>

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-foreground mb-2" for="installation_address">Dirección de instalación</label>
              <textarea id="installation_address" rows="2" placeholder="Calle, nro, referencias" bind:value={form.installation_address}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0"></textarea>
              {#if fieldErrors.installation_address}<p class="text-xs text-red-400 mt-1">{fieldErrors.installation_address[0]}</p>{/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="gps_coordinates">Coordenadas GPS</label>
              <div class="relative">
                <input id="gps_coordinates" type="text" placeholder="10.5012,-66.9123" bind:value={form.gps_coordinates}
                  class="w-full px-4 py-2 pr-10 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
                <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  onclick={getCurrentCoords} disabled={geoLoading}>
                  {#if geoLoading}
                    <Loader2 class="size-4 animate-spin" />
                  {:else}
                    <CrosshairIcon class="size-4" />
                  {/if}
                </button>
              </div>
              {#if coordsError}
                <p class="text-xs text-red-400 mt-1">{coordsError}</p>
              {/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="ip">IP (opcional)</label>
              <div class="relative">
                <input id="ip" type="text" placeholder="192.168.1.10" bind:value={form.ip}
                  class="w-full px-4 py-2 pr-10 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
                {#if form.ip}
                  <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                    onclick={checkIp} disabled={ipCheckLoading}>
                    {#if ipCheckLoading}
                      <Loader2 class="size-4 animate-spin" />
                    {:else if ipCheckStatus === 'available'}
                      <CheckCircleIcon class="size-4 text-emerald-500" />
                    {:else if ipCheckStatus}
                      <XCircleIcon class="size-4 text-red-500" />
                    {:else}
                      <SearchIcon class="size-4" />
                    {/if}
                  </button>
                {/if}
              </div>
              {#if fieldErrors.ip}<p class="text-xs text-red-400 mt-1">{fieldErrors.ip[0]}</p>{/if}
              {#if ipCheckError}
                <p class="text-xs text-red-400 mt-1">{ipCheckError}</p>
              {:else if ipCheckStatus === 'available'}
                <p class="text-xs text-emerald-400 mt-1">IP disponible</p>
              {:else if ipCheckStatus === 'in_use_db'}
                <p class="text-xs text-yellow-400 mt-1">IP asignada en la base de datos</p>
              {:else if ipCheckStatus === 'in_use_router'}
                <p class="text-xs text-orange-400 mt-1">IP en uso en el router</p>
              {:else if ipCheckStatus === 'in_use_both'}
                <p class="text-xs text-red-400 mt-1">IP en uso en DB y router</p>
              {/if}
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="service_status">Estado</label>
              <select id="service_status" bind:value={form.service_status}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0 bg-neutral-900">
                <option value="ACTIVE">Activo</option>
                <option value="LIMITED">Limitado</option>
                <option value="SUSPENDED">Suspendido</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="plan">Plan</label>
              <select id="plan" onchange={handleSelectPlan}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground focus:outline-none focus:ring-0 bg-neutral-900">
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

            <div class="md:col-span-2">
              <label class="block text-sm font-medium text-foreground mb-2" for="observations">Observaciones</label>
              <textarea id="observations" rows="2" placeholder="Notas adicionales" bind:value={form.observations}
                class="w-full px-4 py-2 bg-background border border-neutral-600 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0"></textarea>
            </div>
          </div>
        </div>

        <footer class="flex justify-end gap-2">
          <Dialog.CloseTrigger class="btn preset-tonal">Cancelar</Dialog.CloseTrigger>
          <button type="button" class="btn preset-filled inline-flex items-center gap-2" onclick={submit} disabled={loading}>
            {#if loading}
              <Loader2 class="size-4 animate-spin" /> Guardando...
            {:else}
              Agregar
            {/if}
          </button>
        </footer>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
