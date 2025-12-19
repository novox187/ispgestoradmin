<script lang="ts">
  import Encabezado from "$lib/components/Encabezado.svelte";
  import TablaPlanes from "$lib/components/planes/TablaPlanes.svelte";
  import ModalVerPlan from "$lib/components/planes/ModalVerPlan.svelte";
  import ModalEditarPlan from "$lib/components/planes/ModalEditarPlan.svelte";
  import ModalCrearPlan from "$lib/components/planes/ModalCrearPlan.svelte";
  import { Pagination } from "@skeletonlabs/skeleton-svelte";
  import { ArrowLeftIcon, ArrowRightIcon } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { API_BASE } from "$lib/config";
  let isSidebarOpen = $state(false);
  let isNotificationsOpen = $state(false);
  function toggleSidebar() { isSidebarOpen = !isSidebarOpen }
  function toggleNotifications() { isNotificationsOpen = !isNotificationsOpen }

  type PlanStatus = 'active' | 'inactive';
  interface Plan {
    id: number;
    name: string;
    price: number;
    download: number;
    upload: number;
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
  async function loadPlans() {
    loadingPlans = true;
    try {
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
      const res = await fetch(`${API_BASE}/admin/planes/summary`, {
        headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : data;
      allPlans = (list || []).map((p: any) => ({
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
              feature: String(f?.feature ?? f ?? ''),
              order: Number(f?.order ?? 0),
              highlighted: Boolean(f?.highlighted ?? false)
            })).sort((a: any, b: any) => a.order - b.order)
          : []
      }));
    } catch (e) {
      console.error('Error cargando planes:', e);
    } finally {
      loadingPlans = false;
    }
  }
  onMount(() => {
    loadPlans();
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
  function openCreate() { showCreatePlan = true }
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
        <h2 class="text-3xl md:text-4xl font-bold tracking-tight">Gestión de Planes</h2>
        <p class="text-sm text-gray-400 leading-relaxed">Administra los planes de internet disponibles</p>
      </div>
      <button class="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-semibold shadow-lg transition-colors" onclick={openCreate}>
        + Nuevo Plan
      </button>
    </div>

    <div class="bg-card border border-neutral-800 rounded-lg p-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar Plan</label>
          <input id="searchTerm" type="text" placeholder="Nombre..." bind:value={searchTerm}
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
      <ModalEditarPlan open={showEditPlan} plan={currentPlan} onClose={closeEdit} onSave={savePlan} />
    {/if}
    {#if showCreatePlan}
      <ModalCrearPlan open={showCreatePlan} onClose={closeCreate} onCreate={createPlan} />
    {/if}
  </div>
</main>
