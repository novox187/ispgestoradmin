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

<div class="debtors-card">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
        <div>
            <p class="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Deuda acumulada</p>
            <h3 class="text-sm font-semibold text-slate-200 mt-0.5">Top Deudores</h3>
        </div>
        {#if debtors.length > 0}
            <span class="crit-badge">CRÍTICO</span>
        {/if}
    </div>

    {#if errorMsg}
        <p class="text-xs text-red-400/70 mb-3">{errorMsg}</p>
    {/if}

    <div class="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
        {#if loading}
            {#each Array(4) as _, i}
                <div class="skeleton-row" style="animation-delay:{i * 80}ms">
                    <div class="skeleton-avatar"></div>
                    <div class="flex-1 space-y-1.5">
                        <div class="h-3 bg-white/5 rounded w-3/4"></div>
                        <div class="h-2.5 bg-white/[0.03] rounded w-1/2"></div>
                    </div>
                    <div class="h-4 bg-white/5 rounded w-16"></div>
                </div>
            {/each}
        {:else if debtors.length === 0}
            <div class="flex flex-col items-center justify-center py-10 text-center">
                <div class="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                    <span class="text-emerald-400 text-lg">✓</span>
                </div>
                <p class="text-sm font-medium text-slate-400">Sin deudas pendientes</p>
                <p class="text-xs text-slate-600 mt-1">Todos los clientes al día</p>
            </div>
        {:else}
            {#each debtors as debtor, i}
                <div class="debtor-row" transition:fade>
                    <!-- Rank -->
                    <div class="rank-badge" class:rank-first={i === 0}>{i + 1}</div>

                    <!-- Avatar -->
                    <div class="avatar">
                        {debtor.full_name.charAt(0).toUpperCase()}
                    </div>

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-slate-200 truncate leading-none" title={debtor.full_name}>
                            {debtor.full_name}
                        </p>
                        <p class="text-[11px] text-slate-600 mt-0.5">
                            {debtor.pending_invoices_count} fact. pendiente{debtor.pending_invoices_count !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <!-- Debt + action -->
                    <div class="flex flex-col items-end gap-0.5">
                        <span class="text-sm font-bold text-red-400">{formatCurrency(Number(debtor.total_debt))}</span>
                        <button
                            onclick={() => openModal(debtor.id)}
                            class="text-[10px] text-blue-400 hover:text-blue-300 transition-colors bg-transparent border-none p-0 cursor-pointer"
                        >Ver →</button>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<ModalCliente open={showClientModal} clientId={selectedClientId} onClose={closeModal} />

<style>
    .debtors-card {
        background: #111118;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 14px;
        padding: 1.25rem;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    .crit-badge {
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: #f87171;
        background: rgba(239,68,68,0.10);
        border: 1px solid rgba(239,68,68,0.20);
        padding: 3px 8px;
        border-radius: 6px;
    }
    .debtor-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid transparent;
        transition: background 0.15s ease, border-color 0.15s ease;
    }
    .debtor-row:hover {
        background: rgba(255,255,255,0.03);
        border-color: rgba(255,255,255,0.05);
    }
    .rank-badge {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: rgba(255,255,255,0.05);
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
    .rank-badge.rank-first {
        background: rgba(239,68,68,0.15);
        color: #f87171;
    }
    .avatar {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        color: #94a3b8;
        font-size: 14px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    /* Skeleton */
    .skeleton-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        animation: skelPulse 1.5s ease-in-out infinite;
    }
    .skeleton-avatar {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: rgba(255,255,255,0.05);
        flex-shrink: 0;
    }
    @keyframes skelPulse {
        0%, 100% { opacity: 0.6; }
        50%       { opacity: 1; }
    }

    /* Scrollbar */
    .custom-scrollbar { overflow-y: auto; flex: 1; }
    .custom-scrollbar::-webkit-scrollbar { width: 3px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
</style>
