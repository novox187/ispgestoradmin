<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { API_BASE } from '$lib/config';
  import { fade } from 'svelte/transition';
  import ModalCliente from '$lib/components/clientes/ModalCliente.svelte';
  import {
    DASHBOARD_LOAD_CONTEXT,
    fetchJsonWithRetry,
    readCookieCache,
    writeCookieCache,
    type DashboardLoadBus,
    type FetchErrorDetails,
  } from '$lib/utils/hybrid-cache';

  interface Debtor {
    id: number;
    full_name: string;
    email: string;
    total_debt: number;
    pending_invoices_count: number;
  }

  let debtors: Debtor[] = [];
  let loading = true;
  let errorMsg: string | null = null;
  let showClientModal = false;
  let selectedClientId: number | null = null;
  let abortController: AbortController | null = null;
  let inFlight = false;

  const TOP_DEBTORS_COOKIE = 'ispga_dash_top_debtors_v1';
  const loadBus = getContext<DashboardLoadBus | undefined>(DASHBOARD_LOAD_CONTEXT);

  async function loadDebtors() {
    if (inFlight) return;
    inFlight = true;
    try {
      errorMsg = null;
      if (debtors.length === 0) loading = true;
      const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
      const endpoint = `${API_BASE}/admin/dashboard/top-debtors`;
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      loadBus?.start('top-debtors', endpoint);

      if (abortController) abortController.abort();
      abortController = new AbortController();

      const payload = await fetchJsonWithRetry<any>(
        endpoint,
        { headers, signal: abortController.signal },
        { attempts: 3, baseDelayMs: 700 }
      );
      if (Array.isArray(payload)) {
        debtors = payload as Debtor[];
      } else if (Array.isArray(payload?.data)) {
        debtors = payload.data as Debtor[];
      } else {
        debtors = [];
      }
      writeCookieCache(TOP_DEBTORS_COOKIE, debtors, { maxAgeSeconds: 60 * 60 * 24 });
      loadBus?.success('top-debtors');
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      const err = e as FetchErrorDetails;
      const msg = typeof err?.message === 'string' && err.message ? err.message : 'No se pudo actualizar el top de deudores';
      errorMsg = msg;
      loadBus?.error('top-debtors', { endpoint: `${API_BASE}/admin/dashboard/top-debtors`, status: err?.status, message: msg });
    } finally {
      loading = false;
      inFlight = false;
    }
  }

  function openModal(id: number) {
    selectedClientId = id;
    showClientModal = true;
  }

  function closeModal() {
    showClientModal = false;
    selectedClientId = null;
  }

  onMount(() => {
    const cached = readCookieCache<Debtor[]>(TOP_DEBTORS_COOKIE);
    if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
      debtors = cached.data;
      loading = false;
    }
    loadDebtors();
    const interval = setInterval(loadDebtors, 30000);

    return () => {
      clearInterval(interval);
      if (abortController) abortController.abort();
    };
  });

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
  }
</script>

<div class="bg-[#1a1a1a] border border-gray-800 rounded-lg p-4 md:p-6 h-full flex flex-col">
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-2 text-xs font-mono text-gray-300">
      <div class="w-2 h-2 bg-red-500 rounded-sm"></div>
      <span class="font-bold tracking-wide">TOP DEUDORES</span>
    </div>
    <div class="bg-red-900/20 border border-red-900/50 text-red-500 px-3 py-1 rounded-md text-xs font-bold">
      CRÍTICO
    </div>
  </div>
  {#if errorMsg}
    <div class="text-xs text-red-400 mb-3">{errorMsg}</div>
  {/if}

    <div class="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
      {#if loading}
        {#each Array(3) as _}
          <div class="animate-pulse flex items-center justify-between w-full py-2">
             <div class="flex items-center gap-3 w-full">
                <div class="w-10 h-10 rounded-lg bg-gray-800"></div>
                <div class="flex-1 space-y-2">
                   <div class="h-4 bg-gray-800 rounded w-3/4"></div>
                   <div class="h-3 bg-gray-800 rounded w-1/2"></div>
                </div>
             </div>
          </div>
        {/each}
      {:else if debtors.length === 0}
        <div class="text-gray-500 text-sm text-center py-4">No hay clientes con deuda pendiente.</div>
      {:else}
        {#each debtors as debtor, i}
          <div class="flex items-center justify-between w-full group" transition:fade>
            <div class="flex items-center sm:gap-3 gap-1 w-full">
              <div class="h-8 w-8 {i === 0 ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'} flex items-center justify-center rounded text-sm font-bold flex-shrink-0">
                {i + 1}
              </div>
              
              <div class="size-10 sm:size-12 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center text-gray-300 font-bold text-lg flex-shrink-0 border border-gray-700">
                {debtor.full_name.charAt(0).toUpperCase()}
              </div>
              
              <div class="flex flex-1 items-center justify-between bg-gray-800/30 hover:bg-gray-800/50 transition-colors p-2 rounded border border-transparent hover:border-gray-700">
                <div class="flex flex-col min-w-0 mr-2">
                  <span class="sm:text-sm text-xs font-bold text-gray-200 truncate" title={debtor.full_name}>
                    {debtor.full_name}
                  </span>
                  <span class="sm:text-xs text-[11px]  text-gray-500 truncate">
                    {debtor.pending_invoices_count} facturas pendientes
                  </span>
                </div>
                
                <div class="flex flex-col items-end">
                   <span class="sm:text-sm text-xs font-bold text-red-400 whitespace-nowrap">
                     {formatCurrency(Number(debtor.total_debt))}
                   </span>
                   <button 
                      onclick={() => openModal(debtor.id)}
                      class="text-[10px] text-blue-400 hover:text-blue-300 hover:underline cursor-pointer bg-transparent border-none p-0"
                   >
                      Ver cliente
                   </button>
                </div>
              </div>
            </div>
          </div>
        {/each}
    {/if}
  </div>
</div>

<ModalCliente 
  open={showClientModal} 
  clientId={selectedClientId} 
  onClose={closeModal} 
/>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #374151;
    border-radius: 20px;
  }
</style>
