<script lang="ts">
  import Encabezado from "$lib/components/Encabezado.svelte";
  import TablaPlanes from "$lib/components/planes/TablaPlanes.svelte";
  import BarraCapacidad from "$lib/components/planes/BarraCapacidad.svelte";
  import type { CapacitySnapshot } from "$lib/types/capacity";
  import ModalVerPlan from "$lib/components/planes/ModalVerPlan.svelte";
  import ModalEditarPlan from "$lib/components/planes/ModalEditarPlan.svelte";
  import ModalCrearPlan from "$lib/components/planes/ModalCrearPlan.svelte";
  import { Pagination } from "@skeletonlabs/skeleton-svelte";
  import { ArrowLeftIcon, ArrowRightIcon, Loader2, CheckCircleIcon, XCircleIcon, PlusIcon } from "@lucide/svelte";
  import { onMount, setContext } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { API_BASE } from "$lib/config";
  import { appState } from '$lib/stores/app.svelte';
  import { toast } from 'svelte-sonner';
  import {
    DASHBOARD_LOAD_CONTEXT,
    fetchJsonWithRetry,
    readStorageCache,
    writeStorageCache,
    type DashboardLoadBus,
    type DashboardLoadStatus,
    type FetchErrorDetails
  } from '$lib/utils/hybrid-cache';

  let isSidebarOpen = $state(false);
  let isNotificationsOpen = $state(false);
  function toggleSidebar() { appState.toggleSidebar() }
  function toggleNotifications() { appState.toggleNotifications() }

  type PlanStatus = 'active' | 'inactive';
  interface Plan {
    id: number;
    name: string;
    price: number;
    download: number;
    upload: number;
    ratio?: string;
    status: PlanStatus;
    clients: number;
    revenue: number;
    description?: string;
    features?: { feature: string; order: number; highlighted: boolean }[];
    symmetric?: boolean;
    setup_price?: number;
    billing_cycle?: string;
    category?: string;
    priority?: number;
    is_featured?: boolean;
    mikrotik_queue_name?: string;
    download_limit?: string;
    upload_limit?: string;
    burst_limit?: string;
  }

  let allPlans = $state<Plan[]>([]);
  let loadingPlans = $state(false);
  let capacity = $state<CapacitySnapshot | null>(null);

  const PLANES_CACHE_STORAGE = 'ispga_planes_summary_v1';
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

  async function loadPlans() {
    if (inFlight) return;
    inFlight = true;
    if (allPlans.length === 0) loadingPlans = true;
    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
      const endpoint = `${API_BASE}/admin/planes/summary`;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      loadBus.start('planes-list', endpoint);

      if (abortController) abortController.abort();
      abortController = new AbortController();

      const data = await fetchJsonWithRetry<any>(
        endpoint,
        { headers, signal: abortController.signal },
        { attempts: 3, baseDelayMs: 700 }
      );
      capacity = (data && typeof data === 'object' && data.capacity) ? data.capacity as CapacitySnapshot : capacity;
      const list = Array.isArray(data?.data) ? data.data : data;
      allPlans = (list || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.monthly_price ?? 0),
        description: p.description ?? '',
        status: String(p.status).toLowerCase() === 'active' ? 'active' : 'inactive',
        download: Number(p.download_speed ?? 0),
        upload: Number(p.upload_speed ?? 0),
        ratio: String(p.ratio ?? '1:1'),
        clients: Number(p.clients ?? 0),
        revenue: Number(p.revenue ?? 0),
        symmetric: Boolean(p.symmetric ?? false),
        setup_price: Number(p.setup_price ?? 0),
        billing_cycle: String(p.billing_cycle ?? 'monthly'),
        category: String(p.category ?? 'residential'),
        priority: Number(p.priority ?? 1),
        is_featured: Boolean(p.is_featured ?? false),
        mikrotik_queue_name: String(p.mikrotik_queue_name ?? ''),
        download_limit: String(p.download_limit ?? ''),
        upload_limit: String(p.upload_limit ?? ''),
        burst_limit: String(p.burst_limit ?? ''),
        features: Array.isArray(p.features)
          ? p.features.map((f: any) => ({
              feature: String(f?.feature ?? f ?? ''),
              order: Number(f?.order ?? 0),
              highlighted: Boolean(f?.highlighted ?? false)
            })).sort((a: any, b: any) => a.order - b.order)
          : []
      }));
      writeStorageCache(PLANES_CACHE_STORAGE, allPlans);
      loadBus.success('planes-list');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.error('Error cargando planes:', e);
      const err = e as FetchErrorDetails;
      const message = typeof err?.message === 'string' && err.message ? err.message : 'Error cargando la lista de planes';
      loadBus.error('planes-list', { endpoint: `${API_BASE}/admin/planes/summary`, status: err?.status, message });
    } finally {
      loadingPlans = false;
      inFlight = false;
    }
  }
  onMount(() => {
    const cached = readStorageCache<Plan[]>(PLANES_CACHE_STORAGE);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      allPlans = cached.data;
      loadingPlans = false;
    }

    loadPlans();
    const interval = setInterval(loadPlans, 60000); // 60s
    return () => {
      clearInterval(interval);
      if (abortController) abortController.abort();
    };
  });

  let searchTerm = $state('');
  let statusFilter: 'all' | PlanStatus = $state('all');
  let filteredPlans = $state<Plan[]>([]);
  $effect(() => {
    filteredPlans = allPlans.filter(p => {
      const matchText = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchText && matchStatus;
    });
  });

  let page = $state(1);
  let pageSize = $state(6);
  const start = $derived((page - 1) * pageSize);
  const end = $derived(start + pageSize);
  const paginatedPlans = $derived(filteredPlans.slice(start, end));
  $effect(() => {
    const total = filteredPlans.length;
    const maxPage = Math.max(1, Math.ceil(total / pageSize));
    if (page > maxPage) page = maxPage;
    if (start >= total && total > 0) page = 1;
  });

  function handleViewPlan(id: number) { selectedPlanId = id; showViewPlan = true }
  function handleEditPlan(id: number) { selectedPlanId = id; showEditPlan = true }
  async function handleToggleStatus(id: number) {
    const idx = allPlans.findIndex(p => p.id === id);
    if (idx === -1) return;
    const nextActive = allPlans[idx].status !== 'active';
    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
      const res = await fetch(`${API_BASE}/admin/planes/${id}/status`, {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: nextActive })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const p = Array.isArray(data?.data) ? data.data[0] : data?.data;
      if (p) {
        const mapped: Plan = {
          id: p.id,
          name: p.name,
          price: Number(p.monthly_price ?? 0),
          description: p.description ?? '',
          status: String(p.status).toLowerCase() === 'active' ? 'active' : 'inactive',
          download: Number(p.download_speed ?? 0),
          upload: Number(p.upload_speed ?? 0),
          ratio: String(p.ratio ?? '1:1'),
          clients: Number(p.clients ?? 0),
          revenue: Number(p.revenue ?? 0),
          features: Array.isArray(p.features)
            ? p.features.map((f: any) => ({
                feature: String(f?.feature ?? ''),
                order: Number(f?.order ?? 0),
                highlighted: Boolean(f?.highlighted ?? false)
              })).sort((a: any, b: any) => a.order - b.order)
            : []
        };
        allPlans[idx] = mapped;
        allPlans = [...allPlans];
      }
    } catch (e) {
      console.error('Error cambiando estado del plan:', e);
    }
  }

  let showViewPlan = $state(false);
  let showEditPlan = $state(false);
  let showCreatePlan = $state(false);
  let selectedPlanId = $state<number | null>(null);
  const currentPlan = $derived(allPlans.find(p => p.id === selectedPlanId) ?? null);
  function closeView() { showViewPlan = false; selectedPlanId = null }
  function closeEdit() { showEditPlan = false; selectedPlanId = null }
  function openCreate() {
    const remaining = Number(capacity?.remaining_down_mbps ?? 0);
    if (remaining <= 0) {
      toast.error('Capacidad de ISP agotada');
      return;
    }
    showCreatePlan = true;
  }
  function closeCreate() { showCreatePlan = false }
  async function savePlan(updated: Plan) {
    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
      const res = await fetch(`${API_BASE}/admin/planes/${updated.id}`, {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: updated.name,
          description: updated.description,
          download_speed: updated.download,
          upload_speed: updated.upload,
          ratio: updated.ratio ?? '1:1',
          monthly_price: updated.price,
          is_active: updated.status === 'active',
          symmetric: updated.symmetric ?? false,
          setup_price: updated.setup_price ?? 0,
          billing_cycle: updated.billing_cycle ?? 'monthly',
          category: updated.category ?? 'residential',
          priority: updated.priority ?? 1,
          is_featured: updated.is_featured ?? false,
          mikrotik_queue_name: updated.mikrotik_queue_name ?? '',
          download_limit: updated.download_limit ?? '',
          upload_limit: updated.upload_limit ?? '',
          burst_limit: updated.burst_limit ?? '',
          features: (updated.features || []).map(f => ({
            feature: f.feature,
            order: f.order,
            highlighted: f.highlighted
          })),
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = (data as any)?.code;
        const message = (data as any)?.message;
        if (res.status === 409 && code === 'ISP_CAPACITY_EXHAUSTED') {
          toast.error(message || 'Capacidad de ISP agotada');
          await loadPlans();
          throw new Error('ISP_CAPACITY_EXHAUSTED');
        }
        if (res.status === 409 && code === 'PLAN_SPEED_EXCEEDS_ISP_CAPACITY') {
          toast.error(message || 'La velocidad del plan supera la capacidad física del ISP');
          await loadPlans();
          throw new Error('PLAN_SPEED_EXCEEDS_ISP_CAPACITY');
        }
        throw new Error(message || `HTTP ${res.status}`);
      }
      const p = Array.isArray(data?.data) ? data.data[0] : data?.data;
      if (p) {
        const mapped: Plan = {
          id: p.id,
          name: p.name,
          price: Number(p.monthly_price ?? 0),
          description: p.description ?? '',
          status: String(p.status).toLowerCase() === 'active' ? 'active' : 'inactive',
          download: Number(p.download_speed ?? 0),
          upload: Number(p.upload_speed ?? 0),
          clients: Number(p.clients ?? 0),
          revenue: Number(p.revenue ?? 0),
          symmetric: Boolean(p.symmetric ?? false),
          setup_price: Number(p.setup_price ?? 0),
          billing_cycle: String(p.billing_cycle ?? 'monthly'),
          category: String(p.category ?? 'residential'),
          priority: Number(p.priority ?? 1),
          is_featured: Boolean(p.is_featured ?? false),
          mikrotik_queue_name: String(p.mikrotik_queue_name ?? ''),
          download_limit: String(p.download_limit ?? ''),
          upload_limit: String(p.upload_limit ?? ''),
          burst_limit: String(p.burst_limit ?? ''),
          features: Array.isArray(p.features)
            ? p.features.map((f: any) => ({
                feature: String(f?.feature ?? ''),
                order: Number(f?.order ?? 0),
                highlighted: Boolean(f?.highlighted ?? false)
              })).sort((a: any, b: any) => a.order - b.order)
            : []
        };
        const idx = allPlans.findIndex(x => x.id === mapped.id);
        if (idx !== -1) {
          allPlans[idx] = mapped;
          allPlans = [...allPlans];
        }
        return mapped;
      }
    } catch (e) {
      console.error('Error actualizando plan:', e);
      throw e;
    }
  }
  async function createPlan(payload: Omit<Plan, 'id' | 'clients' | 'revenue'>) {
    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
      const res = await fetch(`${API_BASE}/admin/planes`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: payload.name,
          description: payload.description,
          download_speed: payload.download,
          upload_speed: payload.upload,
          ratio: payload.ratio ?? '1:1',
          monthly_price: payload.price,
          is_active: payload.status === 'active',
          symmetric: payload.symmetric ?? false,
          setup_price: payload.setup_price ?? 0,
          billing_cycle: payload.billing_cycle ?? 'monthly',
          category: payload.category ?? 'residential',
          priority: payload.priority ?? 1,
          is_featured: payload.is_featured ?? false,
          mikrotik_queue_name: payload.mikrotik_queue_name ?? '',
          download_limit: payload.download_limit ?? '',
          upload_limit: payload.upload_limit ?? '',
          burst_limit: payload.burst_limit ?? '',
          features: (payload.features || []).map(f => ({
            feature: f.feature,
            order: f.order,
            highlighted: f.highlighted
          })),
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && (data as any)?.code === 'ISP_CAPACITY_EXHAUSTED') {
          toast.error((data as any)?.message || 'Capacidad de ISP agotada');
          await loadPlans();
          throw new Error('ISP_CAPACITY_EXHAUSTED');
        }
        if (res.status === 409 && (data as any)?.code === 'PLAN_SPEED_EXCEEDS_ISP_CAPACITY') {
          toast.error((data as any)?.message || 'La velocidad del plan supera la capacidad física del ISP');
          await loadPlans();
          throw new Error('PLAN_SPEED_EXCEEDS_ISP_CAPACITY');
        }
        throw new Error((data as any)?.message || `HTTP ${res.status}`);
      }
      const p = Array.isArray(data?.data) ? data.data[0] : data?.data;
      if (p) {
        const mapped: Plan = {
          id: p.id,
          name: p.name,
          price: Number(p.monthly_price ?? 0),
          description: p.description ?? '',
          status: String(p.status).toLowerCase() === 'active' ? 'active' : 'inactive',
          download: Number(p.download_speed ?? 0),
          upload: Number(p.upload_speed ?? 0),
          ratio: String(p.ratio ?? '1:1'),
          clients: Number(p.clients ?? 0),
          revenue: Number(p.revenue ?? 0),
          features: Array.isArray(p.features)
            ? p.features.map((f: any) => ({
                feature: String(f?.feature ?? ''),
                order: Number(f?.order ?? 0),
                highlighted: Boolean(f?.highlighted ?? false)
              })).sort((a: any, b: any) => a.order - b.order)
            : []
        };
        allPlans = [mapped, ...allPlans];
      }
    } catch (e) {
      console.error('Error creando plan:', e);
      throw e;
    }
  }
</script>

<main class="flex-1 overflow-y-auto bg-[#0f0f0f] text-gray-100">
  <Encabezado {toggleSidebar} {toggleNotifications} />

  <div class="p-4 md:p-6 max-w-7xl mx-auto w-full space-y-4 md:space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl md:text-4xl font-bold tracking-tight">Gestión de Planes</h2>
        <p class="sm:text-sm text-xs text-gray-400 leading-relaxed">Administra los planes de internet disponibles</p>
      </div>
      <button
        class={`flex gap-1 items-center px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-lg transition-colors ${
          Number(capacity?.remaining_down_mbps ?? 0) <= 0
            ? 'bg-gray-200/30 text-gray-200/60 cursor-not-allowed'
            : 'bg-gray-200 text-gray-900'
        }`}
        disabled={Number(capacity?.remaining_down_mbps ?? 0) <= 0}
        onclick={openCreate}
      >
        <PlusIcon class="size-4" /> Nuevo 
      </button>
    </div>

    <BarraCapacidad {capacity} />

    <div class="bg-card border border-neutral-800 rounded-lg p-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar Plan</label>
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

      <TablaPlanes filteredPlans={paginatedPlans} handleViewPlan={handleViewPlan} handleEditPlan={handleEditPlan} handleToggleStatus={handleToggleStatus} loading={loadingPlans} />
    </div>

    <div class="flex justify-center items-center gap-4 w-full mt-4">
      <Pagination count={filteredPlans.length} {pageSize} {page} onPageChange={(event)=> (page = event.page)}>
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

    {#if showViewPlan}
      <ModalVerPlan open={showViewPlan} plan={currentPlan} onClose={closeView} />
    {/if}
    {#if showEditPlan}
      <ModalEditarPlan open={showEditPlan} plan={currentPlan} onClose={closeEdit} onSave={savePlan} {capacity} />
    {/if}
    {#if showCreatePlan}
      <ModalCrearPlan open={showCreatePlan} onClose={closeCreate} onCreate={createPlan} {capacity} />
    {/if}
  </div>

  <!-- Indicador de carga -->
  {#if indicatorVisible}
      <div class="fixed bottom-4 right-4 z-[60]" in:scale={{ duration: 140, start: 0.9 }} out:fade={{ duration: 140 }}>
          <button
              class="flex items-center gap-2 bg-[#141414] border border-gray-800 text-gray-200 px-3 py-2 rounded-lg shadow-lg max-w-[320px]"
              onclick={() => overallStatus === 'error' && loadPlans()}
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
