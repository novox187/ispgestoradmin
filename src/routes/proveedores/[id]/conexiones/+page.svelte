<script lang="ts">
  import Encabezado from "$lib/components/Encabezado.svelte";
  import TablaConexiones from "$lib/components/proveedores/TablaConexiones.svelte";
  import ModalVerConexion from "$lib/components/proveedores/ModalVerConexion.svelte";
  import ModalEditarConexion from "$lib/components/proveedores/ModalEditarConexion.svelte";
  import ModalCrearConexion from "$lib/components/proveedores/ModalCrearConexion.svelte";
  import ModalConfirmacion from "$lib/components/common/ModalConfirmacion.svelte";
  import type { Connection, ConnectionCreate, ConnectionStatus } from "$lib/types/proveedores";
  import { Pagination } from "@skeletonlabs/skeleton-svelte";
  import { ArrowLeftIcon, ArrowRightIcon, ChevronLeftIcon, PlusIcon } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { page as pageStore } from "$app/stores";
  import { onMount } from "svelte";
  import { API_BASE } from "$lib/config";
  import { appState } from '$lib/stores/app.svelte';
  import { fetchJsonWithRetry, readStorageCache, writeStorageCache } from '$lib/utils/hybrid-cache';

  function toggleSidebar() { appState.toggleSidebar() }
  function toggleNotifications() { appState.toggleNotifications() }

  interface ProviderLite {
    id: number;
    company_name: string;
    status: 'active' | 'inactive';
  }

  const ispId = $derived(Number($pageStore.params.id));
  let isp = $state<ProviderLite | null>(null);

  let allConnections = $state<Connection[]>([]);
  let loading = $state(false);
  let abortController: AbortController | null = null;

  const cacheKey = $derived(`ispga_isp_${ispId}_connections_v1`);

  async function loadIsp() {
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const data = await fetchJsonWithRetry<any>(`${API_BASE}/admin/isps/${ispId}`, { headers }, { attempts: 3, baseDelayMs: 700 });
    const x = Array.isArray(data?.data) ? data.data[0] : data?.data;
    if (x) {
      isp = {
        id: Number(x.id),
        company_name: String(x.company_name ?? ''),
        status: String(x.status).toLowerCase() === 'active' ? 'active' : 'inactive'
      };
    }
  }

  async function loadConnections() {
    loading = true;
    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      if (abortController) abortController.abort();
      abortController = new AbortController();

      const data = await fetchJsonWithRetry<any>(
        `${API_BASE}/admin/isps/${ispId}/connections`,
        { headers, signal: abortController.signal },
        { attempts: 3, baseDelayMs: 700 }
      );
      const list = Array.isArray(data?.data) ? data.data : data;
      allConnections = (list || []).map((c: any) => ({
        id: Number(c.id),
        isp_id: Number(c.isp_id),
        bandwidth_down: Number(c.bandwidth_down ?? 0),
        bandwidth_up: Number(c.bandwidth_up ?? 0),
        ratio: String(c.ratio ?? ''),
        contract_date: String(c.contract_date ?? ''),
        billing_day: Number(c.billing_day ?? 1),
        billing_cycle: String(c.billing_cycle ?? 'monthly'),
        monthly_price: Number(c.monthly_price ?? 0),
        interface_name: String(c.interface_name ?? ''),
        status: (String(c.status ?? 'active').toLowerCase() as ConnectionStatus),
        price_per_mb: Number(c.price_per_mb ?? 0),
      }));
      writeStorageCache(cacheKey, allConnections);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    const cached = readStorageCache<Connection[]>(cacheKey);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      allConnections = cached.data;
      loading = false;
    }
    Promise.all([loadIsp(), loadConnections()]);
    return () => {
      if (abortController) abortController.abort();
    };
  });

  let searchTerm = $state('');
  let statusFilter: 'all' | ConnectionStatus = $state('all');
  let filtered = $state<Connection[]>([]);
  $effect(() => {
    filtered = allConnections.filter(c => {
      const hay = `${c.interface_name ?? ''} ${c.ratio ?? ''}`.toLowerCase();
      const matchText = hay.includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchText && matchStatus;
    });
  });

  let page = $state(1);
  let pageSize = $state(6);
  const start = $derived((page - 1) * pageSize);
  const end = $derived(start + pageSize);
  const paginated = $derived(filtered.slice(start, end));
  $effect(() => {
    const total = filtered.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (page > maxPage) page = maxPage;
    if (start >= total && total > 0) page = 1;
  });

  let showView = $state(false);
  let showEdit = $state(false);
  let showCreate = $state(false);
  let selectedId = $state<number | null>(null);
  const current = $derived(allConnections.find(c => c.id === selectedId) ?? null);

  function onView(id: number) { selectedId = id; showView = true }
  function onEdit(id: number) { selectedId = id; showEdit = true }
  function openCreate() { showCreate = true }
  function closeView() { showView = false; selectedId = null }
  function closeEdit() { showEdit = false; selectedId = null }
  function closeCreate() { showCreate = false }

  async function createConnection(payload: ConnectionCreate) {
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
    const res = await fetch(`${API_BASE}/admin/isps/${ispId}/connections`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bandwidth_down: payload.bandwidth_down,
        bandwidth_up: payload.bandwidth_up,
        ratio: payload.ratio || '1:1',
        contract_date: payload.contract_date,
        billing_day: payload.billing_day,
        billing_cycle: payload.billing_cycle || 'monthly',
        monthly_price: payload.monthly_price,
        interface_name: payload.interface_name || null,
        status: payload.status || 'active',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const c = Array.isArray(data?.data) ? data.data[0] : data?.data;
    if (c) {
      const mapped: Connection = {
        id: Number(c.id),
        isp_id: Number(c.isp_id),
        bandwidth_down: Number(c.bandwidth_down ?? 0),
        bandwidth_up: Number(c.bandwidth_up ?? 0),
        ratio: String(c.ratio ?? ''),
        contract_date: String(c.contract_date ?? ''),
        billing_day: Number(c.billing_day ?? 1),
        billing_cycle: String(c.billing_cycle ?? 'monthly'),
        monthly_price: Number(c.monthly_price ?? 0),
        interface_name: String(c.interface_name ?? ''),
        status: (String(c.status ?? 'active').toLowerCase() as ConnectionStatus),
        price_per_mb: Number(c.price_per_mb ?? 0),
      };
      allConnections = [mapped, ...allConnections];
    }
  }

  async function saveConnection(updated: Connection) {
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
    const res = await fetch(`${API_BASE}/admin/isp-connections/${updated.id}`, {
      method: 'PUT',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isp_id: ispId,
        bandwidth_down: updated.bandwidth_down,
        bandwidth_up: updated.bandwidth_up,
        ratio: updated.ratio || '1:1',
        contract_date: updated.contract_date,
        billing_day: updated.billing_day,
        billing_cycle: updated.billing_cycle || 'monthly',
        monthly_price: updated.monthly_price,
        interface_name: updated.interface_name || null,
        status: updated.status,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const c = Array.isArray(data?.data) ? data.data[0] : data?.data;
    if (c) {
      const mapped: Connection = {
        id: Number(c.id),
        isp_id: Number(c.isp_id),
        bandwidth_down: Number(c.bandwidth_down ?? 0),
        bandwidth_up: Number(c.bandwidth_up ?? 0),
        ratio: String(c.ratio ?? ''),
        contract_date: String(c.contract_date ?? ''),
        billing_day: Number(c.billing_day ?? 1),
        billing_cycle: String(c.billing_cycle ?? 'monthly'),
        monthly_price: Number(c.monthly_price ?? 0),
        interface_name: String(c.interface_name ?? ''),
        status: (String(c.status ?? 'active').toLowerCase() as ConnectionStatus),
        price_per_mb: Number(c.price_per_mb ?? 0),
      };
      const idx = allConnections.findIndex(x => x.id === mapped.id);
      if (idx !== -1) {
        allConnections[idx] = mapped;
        allConnections = [...allConnections];
      }
      return mapped;
    }
  }

  async function toggleActive(id: number) {
    const c = allConnections.find(x => x.id === id);
    if (!c) return;
    const nextStatus: ConnectionStatus = c.status === 'active' ? 'suspended' : 'active';
    await saveConnection({ ...c, status: nextStatus });
  }

  let confirmOpen = $state(false);
  let confirmLoading = $state(false);
  let confirmError = $state<string | null>(null);
  let pendingDeleteId = $state<number | null>(null);

  function askDelete(id: number) {
    pendingDeleteId = id;
    confirmError = null;
    confirmOpen = true;
  }

  async function doDelete() {
    if (!pendingDeleteId) return;
    confirmLoading = true;
    confirmError = null;
    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
      const res = await fetch(`${API_BASE}/admin/isp-connections/${pendingDeleteId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Accept': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allConnections = allConnections.filter(x => x.id !== pendingDeleteId);
      confirmOpen = false;
      pendingDeleteId = null;
    } catch (e: any) {
      confirmError = 'No se pudo eliminar';
    } finally {
      confirmLoading = false;
    }
  }
</script>

<main class="flex-1 overflow-y-auto bg-[#0f0f0f] text-gray-100">
  <Encabezado {toggleSidebar} {toggleNotifications} />

  <div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
    <div class="flex items-center justify-between">
      <div class="flex items-start gap-3">
        <button class="btn-icon preset-tonal-surface border-none focus:outline-none focus:ring-0 mt-1" onclick={() => goto('/proveedores')}>
          <ChevronLeftIcon class="size-4" />
        </button>
        <div>
          <h2 class="text-xl md:text-4xl font-bold tracking-tight">Conexiones</h2>
          <p class="sm:text-sm text-xs text-gray-400 leading-relaxed">
            {#if isp}{isp.company_name}{:else}Proveedor #{ispId}{/if}
          </p>
        </div>
      </div>
      <button class="flex gap-1 items-center px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-xs sm:text-sm font-semibold shadow-lg transition-colors" onclick={openCreate}>
        <PlusIcon class="size-4" /> Nuevo
      </button>
    </div>

    <div class="bg-card border border-neutral-800 rounded-lg p-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar</label>
          <input id="searchTerm" type="text" placeholder="Interfaz o ratio" bind:value={searchTerm}
            class="w-full px-4 py-2 border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
        </div>
        <div>
          <label class="block text-sm font-medium text-foreground mb-2" for="statusFilter">Estado</label>
          <select id="statusFilter" bind:value={statusFilter}
            class="w-full px-5 py-2 border border-neutral-800 rounded-lg focus:outline-none focus:ring-0 bg-neutral-900">
            <option value="all">Todos</option>
            <option value="active">Activo</option>
            <option value="maintenance">Mantenimiento</option>
            <option value="suspended">Suspendido</option>
            <option value="canceled">Cancelado</option>
          </select>
        </div>
      </div>

      <TablaConexiones items={paginated} {loading} onView={onView} onEdit={onEdit} onToggleActive={toggleActive} onDelete={askDelete} />
    </div>

    <div class="flex justify-center items-center gap-4 w-full mt-4">
      <Pagination count={filtered.length} {pageSize} {page} onPageChange={(event)=> (page = event.page)}>
        <Pagination.PrevTrigger>
          <ArrowLeftIcon class="size-4" />
        </Pagination.PrevTrigger>
        <Pagination.Context>
          {#snippet children(pagination)}
            {#each pagination().pages as page, index (page)}
              {#if page.type === 'page'}
                <Pagination.Item {...page}>
                  {page.value}
                </Pagination.Item>
              {:else}
                <Pagination.Ellipsis {index}>&#8230;</Pagination.Ellipsis>
              {/if}
            {/each}
          {/snippet}
        </Pagination.Context>
        <Pagination.NextTrigger>
          <ArrowRightIcon class="size-4" />
        </Pagination.NextTrigger>
      </Pagination>
    </div>

    {#if showView}
      <ModalVerConexion open={showView} connection={current} onClose={closeView} />
    {/if}
    {#if showEdit}
      <ModalEditarConexion open={showEdit} connection={current} onClose={closeEdit} onSave={saveConnection} />
    {/if}
    {#if showCreate}
      <ModalCrearConexion open={showCreate} onClose={closeCreate} onCreate={createConnection} />
    {/if}

    <ModalConfirmacion
      bind:open={confirmOpen}
      title="Eliminar Conexión"
      message="Esta acción no se puede deshacer."
      confirmText="Eliminar"
      cancelText="Cancelar"
      type="danger"
      loading={confirmLoading}
      error={confirmError}
      on:confirm={doDelete}
      on:cancel={() => { pendingDeleteId = null; confirmError = null; }}
    />
  </div>
</main>

