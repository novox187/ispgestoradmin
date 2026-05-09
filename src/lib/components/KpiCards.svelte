<script lang="ts">
    import { onMount } from 'svelte';
    import { Users, TrendingUp, TrendingDown, CheckCircle, Clock, AlertTriangle } from "@lucide/svelte";
    import { readCookieCache, fetchJsonWithRetry } from '$lib/utils/hybrid-cache';
    import { API_BASE } from '$lib/config';

    interface Props {
        activeClients: number;
        suspendedClients: number;
        invoicedThisMonth: number;
        paidThisMonth: number;
        pendingCount: number;
        pendingAmount: number;
    }

    let {
        activeClients,
        suspendedClients,
        invoicedThisMonth,
        paidThisMonth,
        pendingCount,
        pendingAmount,
    }: Props = $props();

    // ── Datos de tendencia (chart cache) ──────────────────────────────
    const CHART_COOKIE = 'ispga_dash_chart_v1';
    type MonthRow = { date: string; invoiced: number; collected: number; pending: number };
    let chartMonths: MonthRow[] = $state([]);

    onMount(() => {
        const cached = readCookieCache<MonthRow[]>(CHART_COOKIE);
        if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
            chartMonths = cached.data;
        } else {
            loadChartData();
        }
    });

    async function loadChartData() {
        try {
            const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            const payload = await fetchJsonWithRetry<any>(
                `${API_BASE}/admin/dashboard/chart`,
                { headers },
                { attempts: 2, baseDelayMs: 500 }
            );
            if (payload?.labels && payload?.datasets) {
                chartMonths = (payload.labels as string[]).map((label, i) => ({
                    date: label,
                    invoiced:  Number(payload.datasets[0]?.data[i] ?? 0),
                    collected: Number(payload.datasets[1]?.data[i] ?? 0),
                    pending:   Number(payload.datasets[2]?.data[i] ?? 0),
                }));
            }
        } catch { /* silent fallback */ }
    }

    // ── Helpers ───────────────────────────────────────────────────────
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
    function formatCOP(v: number): string {
        if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
        if (v >= 1_000_000)     return `$${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000)         return `$${(v / 1_000).toFixed(0)}K`;
        return fmt.format(v);
    }

    const currentMonthIdx = new Date().getMonth(); // 0-based
    const currentMonthName = new Date().toLocaleString('es-CO', { month: 'long' });

    function getLast7(key: keyof MonthRow & ('invoiced' | 'collected' | 'pending')): number[] {
        if (chartMonths.length === 0) return [];
        const upToCurrent = chartMonths.slice(0, currentMonthIdx + 1);
        return upToCurrent.map(m => m[key]).slice(-7);
    }

    function calcTrend(values: number[]): number | null {
        if (values.length < 2) return null;
        const curr = values.at(-1)!;
        const prev = values.at(-2)!;
        if (!prev) return null;
        return Math.round(((curr - prev) / prev) * 100);
    }

    // ── Sparkline SVG ─────────────────────────────────────────────────
    type SparkPaths = { line: string; area: string };

    function buildSparkline(values: number[]): SparkPaths {
        if (values.length < 2) return { line: '', area: '' };
        const W = 80, H = 28, P = 2;
        const vmax = Math.max(...values, 1);
        const vmin = Math.min(...values, 0);
        const range = vmax - vmin || 1;
        const step = (W - P * 2) / Math.max(values.length - 1, 1);
        const pts = values.map((v, i) => ({
            x: P + i * step,
            y: H - P - ((v - vmin) / range) * (H - P * 2),
        }));
        // Catmull-Rom smooth curve
        const T = 0.25;
        let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(i - 1, 0)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(i + 2, pts.length - 1)];
            const cp1x = p1.x + (p2.x - p0.x) * T;
            const cp1y = p1.y + (p2.y - p0.y) * T;
            const cp2x = p2.x - (p3.x - p1.x) * T;
            const cp2y = p2.y - (p3.y - p1.y) * T;
            line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }
        const last = pts.at(-1)!;
        const first = pts[0];
        const area = `${line} L ${last.x.toFixed(1)} ${H} L ${first.x.toFixed(1)} ${H} Z`;
        return { line, area };
    }

    // ── Reactive data per card ────────────────────────────────────────
    const invoicedSeries  = $derived(getLast7('invoiced'));
    const collectedSeries = $derived(getLast7('collected'));
    const pendingSeries   = $derived(getLast7('pending'));

    const invoicedTrend  = $derived(calcTrend(invoicedSeries));
    const collectedTrend = $derived(calcTrend(collectedSeries));
    const pendingTrend   = $derived(calcTrend(pendingSeries));

    const invoicedSpark  = $derived(buildSparkline(invoicedSeries));
    const collectedSpark = $derived(buildSparkline(collectedSeries));
    const pendingSpark   = $derived(buildSparkline(pendingSeries));

    function trendClass(t: number | null, invert = false): string {
        if (t === null) return 'text-gray-600';
        const positive = invert ? t < 0 : t > 0;
        return positive ? 'text-emerald-400' : 'text-red-400';
    }
    function trendLabel(t: number | null): string {
        if (t === null) return '';
        return `${t > 0 ? '+' : ''}${t}%`;
    }
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">

    <!-- ── 1. Clientes activos ─────────────────────────────────────── -->
    <div class="kpi-card group">
        <div class="flex items-start justify-between mb-3">
            <div class="p-2 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                <Users class="w-4 h-4 text-blue-400" />
            </div>
            {#if suspendedClients > 0}
                <span class="flex items-center gap-1 text-[10px] font-medium text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full">
                    <AlertTriangle class="w-2.5 h-2.5" />
                    {suspendedClients}
                </span>
            {/if}
        </div>
        <p class="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Clientes activos</p>
        <p class="text-3xl font-bold text-slate-100 mt-1 leading-none">{activeClients}</p>
        <p class="text-xs text-slate-600 mt-2">
            {suspendedClients > 0 ? `${suspendedClients} suspendidos` : 'Sin suspensiones'}
        </p>
    </div>

    <!-- ── 2. Facturado este mes ──────────────────────────────────── -->
    <div class="kpi-card group">
        <div class="flex items-start justify-between mb-3">
            <div class="p-2 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                <TrendingUp class="w-4 h-4 text-blue-400" />
            </div>
            {#if invoicedTrend !== null}
                <span class="flex items-center gap-0.5 text-[10px] font-semibold {trendClass(invoicedTrend)}">
                    {#if invoicedTrend > 0}<TrendingUp class="w-3 h-3"/>{:else if invoicedTrend < 0}<TrendingDown class="w-3 h-3"/>{/if}
                    {trendLabel(invoicedTrend)}
                </span>
            {/if}
        </div>
        <p class="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Facturado</p>
        <p class="text-2xl font-bold text-slate-100 mt-1 leading-none truncate">{formatCOP(invoicedThisMonth)}</p>
        {#if invoicedSpark.line}
            <div class="mt-3">
                <svg viewBox="0 0 80 28" class="w-full h-7" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
                            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
                        </linearGradient>
                    </defs>
                    <path d={invoicedSpark.area} fill="url(#gInv)"/>
                    <path d={invoicedSpark.line} fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </div>
        {:else}
            <p class="text-xs text-slate-600 mt-2 capitalize">{currentMonthName}</p>
        {/if}
    </div>

    <!-- ── 3. Cobrado este mes ────────────────────────────────────── -->
    <div class="kpi-card group">
        <div class="flex items-start justify-between mb-3">
            <div class="p-2 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <CheckCircle class="w-4 h-4 text-emerald-400" />
            </div>
            {#if collectedTrend !== null}
                <span class="flex items-center gap-0.5 text-[10px] font-semibold {trendClass(collectedTrend)}">
                    {#if collectedTrend > 0}<TrendingUp class="w-3 h-3"/>{:else if collectedTrend < 0}<TrendingDown class="w-3 h-3"/>{/if}
                    {trendLabel(collectedTrend)}
                </span>
            {/if}
        </div>
        <p class="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Cobrado</p>
        <p class="text-2xl font-bold text-slate-100 mt-1 leading-none truncate">{formatCOP(paidThisMonth)}</p>
        {#if collectedSpark.line}
            <div class="mt-3">
                <svg viewBox="0 0 80 28" class="w-full h-7" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
                            <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
                        </linearGradient>
                    </defs>
                    <path d={collectedSpark.area} fill="url(#gCol)"/>
                    <path d={collectedSpark.line} fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </div>
        {:else}
            <p class="text-xs text-slate-600 mt-2 capitalize">{currentMonthName}</p>
        {/if}
    </div>

    <!-- ── 4. Facturas pendientes ─────────────────────────────────── -->
    <div class="kpi-card group {pendingCount > 0 ? 'ring-1 ring-orange-500/20' : ''}">
        <div class="flex items-start justify-between mb-3">
            <div class="p-2 rounded-lg {pendingCount > 0 ? 'bg-orange-500/10 ring-1 ring-orange-500/20' : 'bg-slate-800/60'}">
                <Clock class="w-4 h-4 {pendingCount > 0 ? 'text-orange-400' : 'text-slate-500'}" />
            </div>
            {#if pendingTrend !== null}
                <span class="flex items-center gap-0.5 text-[10px] font-semibold {trendClass(pendingTrend, true)}">
                    {#if pendingTrend > 0}<TrendingUp class="w-3 h-3"/>{:else if pendingTrend < 0}<TrendingDown class="w-3 h-3"/>{/if}
                    {trendLabel(pendingTrend)}
                </span>
            {/if}
        </div>
        <p class="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Pendientes</p>
        <p class="text-3xl font-bold mt-1 leading-none {pendingCount > 0 ? 'text-orange-300' : 'text-slate-100'}">
            {pendingCount}
        </p>
        {#if pendingSpark.line}
            <div class="mt-3">
                <svg viewBox="0 0 80 28" class="w-full h-7" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="gPen" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#f97316" stop-opacity="0.35"/>
                            <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
                        </linearGradient>
                    </defs>
                    <path d={pendingSpark.area} fill="url(#gPen)"/>
                    <path d={pendingSpark.line} fill="none" stroke="#f97316" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </div>
        {:else}
            <p class="text-xs text-slate-600 mt-2">{formatCOP(pendingAmount)}</p>
        {/if}
    </div>

</div>

<style>
    .kpi-card {
        background: #111118;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 14px;
        padding: 1.1rem 1.25rem;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .kpi-card:hover {
        border-color: rgba(255, 255, 255, 0.11);
        box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.35);
    }
</style>
