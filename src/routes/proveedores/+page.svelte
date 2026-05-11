<script lang="ts">
  import Encabezado from "$lib/components/Encabezado.svelte";
  import TablaProveedores from "$lib/components/proveedores/TablaProveedores.svelte";
  import ModalVerProveedor from "$lib/components/proveedores/ModalVerProveedor.svelte";
  import ModalEditarProveedor from "$lib/components/proveedores/ModalEditarProveedor.svelte";
  import ModalCrearProveedor from "$lib/components/proveedores/ModalCrearProveedor.svelte";
  import { Pagination } from "@skeletonlabs/skeleton-svelte";
  import { ArrowLeftIcon, ArrowRightIcon, Loader2, CheckCircleIcon, XCircleIcon, PlusIcon } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { onMount, setContext } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { API_BASE } from "$lib/config";
  import { appState } from '$lib/stores/app.svelte';
  import type { Provider, ProviderStatus } from '$lib/types/proveedores';
  import {
    DASHBOARD_LOAD_CONTEXT,
    fetchJsonWithRetry,
    readStorageCache,
    writeStorageCache,
    type DashboardLoadBus,
    type DashboardLoadStatus,
    type FetchErrorDetails
  } from '$lib/utils/hybrid-cache';

  function toggleSidebar() { appState.toggleSidebar() }
  function toggleNotifications() { appState.toggleNotifications() }

  let allIsps = $state<Provider[]>([]);
  let loadingIsps = $state(false);

  const ISPS_CACHE_STORAGE = 'ispga_isps_v1';
  let inFlight = false;
  let abortController: AbortController | null = null;

  let requestStates = $state<Record<string, { status: DashboardLoadStatus; endpoint: string; message?: string; updatedAt: number }>>({});
  let indicatorVisible = $state(false);
  let indicatorHideTimer: ReturnType<typeof setTimeout> | null = null;

  const overallStatus = $derived.by((): DashboardLoadStatus => {
    const items = Object.values(requestStates);
    if (items.some(i => i.status === 'loading')) return 'loading';
    if (items.some(i => i.status === 'error')) return 'error';
    if (items.some(i => i.status === 'success')) return 'success';
    return 'idle';
  });

  const overallMessage = $derived.by((): string => {
    const errors = Object.entries(requestStates)
      .filter(([, v]) => v.status === 'error')
      .sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0));
    const first = errors[0]?.[1];
    if (!first) return '';
    return first.message || 'Error de actualización';
  });

  function setRequestState(key: string, next: { status: DashboardLoadStatus; endpoint: string; message?: string }) {
    requestStates[key] = { ...next, updatedAt: Date.now() };
    requestStates = { ...requestStates };
  }

  const loadBus: DashboardLoadBus = {
    start: (key, endpoint) => setRequestState(key, { status: 'loading', endpoint }),
    success: (key) => {
      const prev = requestStates[key];
      setRequestState(key, { status: 'success', endpoint: prev?.endpoint || '' });
    },
    error: (key, details) => setRequestState(key, { status: 'error', endpoint: details.endpoint, message: details.message })
  };

  setContext(DASHBOARD_LOAD_CONTEXT, loadBus);

  $effect(() => {
    if (indicatorHideTimer) {
      clearTimeout(indicatorHideTimer);
      indicatorHideTimer = null;
    }

    if (overallStatus === 'idle') {
      indicatorVisible = false;
      return;
    }

    indicatorVisible = true;

    if (overallStatus === 'success') {
      indicatorHideTimer = setTimeout(() => {
        if (overallStatus === 'success') indicatorVisible = false;
      }, 2500);
    }

    if (overallStatus === 'error') {
      indicatorHideTimer = setTimeout(() => {
        if (overallStatus === 'error') indicatorVisible = false;
      }, 9000);
    }

    return () => {
      if (indicatorHideTimer) {
        clearTimeout(indicatorHideTimer);
        indicatorHideTimer = null;
      }
    };
  });

  async function loadIsps() {
    if (inFlight) return;
    inFlight = true;
    if (allIsps.length === 0) loadingIsps = true;
    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
      const endpoint = `${API_BASE}/admin/isps`;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      loadBus.start('isps-list', endpoint);

      if (abortController) abortController.abort();
      abortController = new AbortController();

      const data = await fetchJsonWithRetry<any>(
        endpoint,
        { headers, signal: abortController.signal },
        { attempts: 3, baseDelayMs: 700 }
      );
      const list = Array.isArray(data?.data) ? data.data : data;
      allIsps = (list || []).map((x: any) => ({
        id: Number(x.id),
        company_name: String(x.company_name ?? ''),
        technical_support_contact: String(x.technical_support_contact ?? ''),
        support_phone: String(x.support_phone ?? ''),
        support_email: String(x.support_email ?? ''),
        address: String(x.address ?? ''),
        payment_method: String(x.payment_method ?? ''),
        account_number: String(x.account_number ?? ''),
        status: String(x.status).toLowerCase() === 'active' ? 'active' : 'inactive',
        connections_count: Number(x.connections_count ?? 0),
      }));
      writeStorageCache(ISPS_CACHE_STORAGE, allIsps);
      loadBus.success('isps-list');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error('Error cargando ISPs:', e);
      const err = e as FetchErrorDetails;
      const message = typeof err?.message === 'string' && err.message ? err.message : 'Error cargando la lista de proveedores';
      loadBus.error('isps-list', { endpoint: `${API_BASE}/admin/isps`, status: err?.status, message });
    } finally {
      loadingIsps = false;
      inFlight = false;
    }
  }

  onMount(() => {
    const cached = readStorageCache<Provider[]>(ISPS_CACHE_STORAGE);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      allIsps = cached.data;
      loadingIsps = false;
    }

    loadIsps();
    const interval = setInterval(loadIsps, 60000);
    return () => {
      clearInterval(interval);
      if (abortController) abortController.abort();
    };
  });

  let searchTerm = $state('');
  let statusFilter: 'all' | ProviderStatus = $state('all');
  let filtered = $state<Provider[]>([]);
  $effect(() => {
    filtered = allIsps.filter(p => {
      const matchText = p.company_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
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
  const current = $derived(allIsps.find(p => p.id === selectedId) ?? null);

  function openCreate() { showCreate = true }
  function closeCreate() { showCreate = false }
  function closeView() { showView = false; selectedId = null }
  function closeEdit() { showEdit = false; selectedId = null }

  function onView(id: number) { selectedId = id; showView = true }
  function onEdit(id: number) { selectedId = id; showEdit = true }
  function onViewConnections(id: number) { goto(`/proveedores/${id}/conexiones`) }

  async function saveIsp(updated: Provider) {
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
    const res = await fetch(`${API_BASE}/admin/isps/${updated.id}`, {
      method: 'PUT',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_name: updated.company_name,
        technical_support_contact: updated.technical_support_contact || null,
        support_phone: updated.support_phone || null,
        support_email: updated.support_email || null,
        address: updated.address || null,
        payment_method: updated.payment_method || null,
        account_number: updated.account_number || null,
        is_active: updated.status === 'active',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const x = Array.isArray(data?.data) ? data.data[0] : data?.data;
    if (x) {
      const mapped: Provider = {
        id: Number(x.id),
        company_name: String(x.company_name ?? ''),
        technical_support_contact: String(x.technical_support_contact ?? ''),
        support_phone: String(x.support_phone ?? ''),
        support_email: String(x.support_email ?? ''),
        address: String(x.address ?? ''),
        payment_method: String(x.payment_method ?? ''),
        account_number: String(x.account_number ?? ''),
        status: String(x.status).toLowerCase() === 'active' ? 'active' : 'inactive',
        connections_count: Number(x.connections_count ?? 0),
      };
      const idx = allIsps.findIndex(p => p.id === mapped.id);
      if (idx !== -1) {
        allIsps[idx] = mapped;
        allIsps = [...allIsps];
      }
      return mapped;
    }
  }

  async function createIsp(payload: Omit<Provider, 'id' | 'connections_count'>) {
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
    const res = await fetch(`${API_BASE}/admin/isps`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        company_name: payload.company_name,
        technical_support_contact: payload.technical_support_contact || null,
        support_phone: payload.support_phone || null,
        support_email: payload.support_email || null,
        address: payload.address || null,
        payment_method: payload.payment_method || null,
        account_number: payload.account_number || null,
        is_active: payload.status === 'active',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const x = Array.isArray(data?.data) ? data.data[0] : data?.data;
    if (x) {
      const mapped: Provider = {
        id: Number(x.id),
        company_name: String(x.company_name ?? ''),
        technical_support_contact: String(x.technical_support_contact ?? ''),
        support_phone: String(x.support_phone ?? ''),
        support_email: String(x.support_email ?? ''),
        address: String(x.address ?? ''),
        payment_method: String(x.payment_method ?? ''),
        account_number: String(x.account_number ?? ''),
        status: String(x.status).toLowerCase() === 'active' ? 'active' : 'inactive',
        connections_count: Number(x.connections_count ?? 0),
      };
      allIsps = [mapped, ...allIsps];
    }
  }

  async function onToggleStatus(id: number) {
    const isp = allIsps.find(x => x.id === id);
    if (!isp) return;
    const next: Provider = { ...isp, status: isp.status === 'active' ? 'inactive' : 'active' };
    await saveIsp(next);
  }
</script>

<main class="flex-1 overflow-y-auto bg-[#09090f] text-gray-100">
  <Encabezado {toggleSidebar} {toggleNotifications} />

  <div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl md:text-4xl font-bold tracking-tight">Gestión de Proveedores</h2>
        <p class="sm:text-sm text-xs text-gray-400 leading-relaxed">Administra los proveedores de internet (ISPs)</p>
      </div>
      <button class="flex gap-1 items-center px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-xs sm:text-sm font-semibold shadow-lg transition-colors" onclick={openCreate}>
        <PlusIcon class="size-4" /> Nuevo
      </button>
    </div>

    <div class="bg-card border border-neutral-800 rounded-lg p-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar Proveedor</label>
          <input id="searchTerm" type="text" placeholder="Nombre" bind:value={searchTerm}
            class="w-full px-4 py-2 border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
        </div>
        <div>
          <label class="block text-sm font-medium text-foreground mb-2" for="statusFilter">Estado</label>
          <select id="statusFilter" bind:value={statusFilter}
            class="w-full px-5 py-2 border border-neutral-800 rounded-lg focus:outline-none focus:ring-0 bg-neutral-900">
            <option value="all">Todos</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </div>

      <TablaProveedores items={paginated} onView={onView} onEdit={onEdit} onToggleStatus={onToggleStatus} onViewConnections={onViewConnections} loading={loadingIsps} />
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
      <ModalVerProveedor open={showView} isp={current} onClose={closeView} />
    {/if}
    {#if showEdit}
      <ModalEditarProveedor open={showEdit} isp={current} onClose={closeEdit} onSave={saveIsp} />
    {/if}
    {#if showCreate}
      <ModalCrearProveedor open={showCreate} onClose={closeCreate} onCreate={createIsp} />
    {/if}
  </div>

  {#if indicatorVisible}
    <div class="fixed bottom-4 right-4 z-[60]" in:scale={{ duration: 140, start: 0.9 }} out:fade={{ duration: 140 }}>
      <button
        class="flex items-center gap-2 bg-[#141414] border border-gray-800 text-gray-200 px-3 py-2 rounded-lg shadow-lg max-w-[320px]"
        onclick={() => overallStatus === 'error' && loadIsps()}
      >
        {#if overallStatus === 'loading'}
          <Loader2 class="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" />
        {:else if overallStatus === 'success'}
          <CheckCircleIcon class="w-4 h-4 text-green-500 flex-shrink-0" />
        {:else if overallStatus === 'error'}
          <XCircleIcon class="w-4 h-4 text-red-500 flex-shrink-0" />
          <span class="text-xs truncate">{overallMessage}</span>
        {/if}
      </button>
    </div>
  {/if}
</main>

