<script lang="ts">
    import { getContext, onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { API_BASE } from '$lib/config';
    import {
        DASHBOARD_LOAD_CONTEXT,
        fetchJsonWithRetry,
        readCookieCache,
        writeCookieCache,
        type DashboardLoadBus,
        type FetchErrorDetails,
    } from '$lib/utils/hybrid-cache';

    //======================================================================
    // 1. TIPOS
    //======================================================================
    type TimePeriod = 'year';

    interface ChartDataItem {
        date: string;
        invoiced: number;
        collected: number;
        pending: number;
        [key: string]: string | number;
    }

    interface SeriesConfig {
        label: string;
        color: string;
        gradId: string;
    }

    const config: Record<string, SeriesConfig> = {
        invoiced:  { label: 'Facturado',  color: '#3b82f6', gradId: 'gFill0' },
        collected: { label: 'Cobrado',    color: '#10b981', gradId: 'gFill1' },
        pending:   { label: 'Pendiente',  color: '#f97316', gradId: 'gFill2' },
    };

    //======================================================================
    // 2. ESTADO
    //======================================================================
    let chartData = $state<ChartDataItem[]>([]);
    let chartYear = $state(new Date().getFullYear());
    let loading = $state(true);
    let error = $state<string | null>(null);
    let revealed = $state(false);

    const CHART_COOKIE = 'ispga_dash_chart_v1';
    const loadBus = getContext<DashboardLoadBus | undefined>(DASHBOARD_LOAD_CONTEXT);

    let activeTab = $state<TimePeriod>('year');
    let chartContainer = $state<HTMLDivElement | null>(null);
    let hoveredPoint = $state<{ x: number; data: ChartDataItem } | null>(null);
    let abortController: AbortController | null = null;
    let inFlight = false;

    const data = $derived<ChartDataItem[]>(chartData);

    //======================================================================
    // 3. DIMENSIONES (viewBox fijo, escala responsive)
    //======================================================================
    const W = 1000, H = 300;
    const pad = { top: 20, right: 24, bottom: 36, left: 72 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

    const maxValue = $derived(
        data.length > 0
            ? Math.max(Math.max(...data.flatMap(d => [d.invoiced, d.collected, d.pending])) * 1.15, 1)
            : 1000
    );
    const xStep = $derived(data.length > 1 ? cW / (data.length - 1) : cW);

    //======================================================================
    // 4. CURVAS SUAVES (Catmull-Rom → cúbica Bézier)
    //======================================================================
    function toPoints(values: number[]): { x: number; y: number }[] {
        return values.map((v, i) => ({
            x: pad.left + i * xStep,
            y: pad.top + cH - (v / maxValue) * cH,
        }));
    }

    const TENSION = 0.35;

    function catmullRomLine(pts: { x: number; y: number }[]): string {
        if (pts.length < 2) return '';
        let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(i - 1, 0)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(i + 2, pts.length - 1)];
            const cp1x = p1.x + (p2.x - p0.x) * TENSION;
            const cp1y = p1.y + (p2.y - p0.y) * TENSION;
            const cp2x = p2.x - (p3.x - p1.x) * TENSION;
            const cp2y = p2.y - (p3.y - p1.y) * TENSION;
            d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},${cp2x.toFixed(1)} ${cp2y.toFixed(1)},${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }
        return d;
    }

    function catmullRomArea(pts: { x: number; y: number }[]): string {
        if (pts.length === 0) return '';
        const bottom = pad.top + cH;
        const line = catmullRomLine(pts);
        const last = pts.at(-1)!;
        return `${line} L ${last.x.toFixed(1)} ${bottom} L ${pad.left.toFixed(1)} ${bottom} Z`;
    }

    const invoicedPts  = $derived(toPoints(data.map(d => d.invoiced)));
    const collectedPts = $derived(toPoints(data.map(d => d.collected)));
    const pendingPts   = $derived(toPoints(data.map(d => d.pending)));

    const invoicedLine  = $derived(catmullRomLine(invoicedPts));
    const collectedLine = $derived(catmullRomLine(collectedPts));
    const pendingLine   = $derived(catmullRomLine(pendingPts));

    const invoicedArea  = $derived(catmullRomArea(invoicedPts));
    const collectedArea = $derived(catmullRomArea(collectedPts));
    const pendingArea   = $derived(catmullRomArea(pendingPts));

    //======================================================================
    // 5. CARGA DE DATOS
    //======================================================================
    async function loadChartData() {
        if (inFlight) return;
        inFlight = true;
        error = null;
        if (chartData.length === 0) loading = true;
        revealed = false;
        try {
            const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
            const endpoint = `${API_BASE}/admin/dashboard/chart`;
            const headers: Record<string, string> = { Accept: 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            loadBus?.start('chart', endpoint);
            if (abortController) abortController.abort();
            abortController = new AbortController();

            const payload = await fetchJsonWithRetry<any>(
                endpoint,
                { headers, signal: abortController.signal },
                { attempts: 3, baseDelayMs: 700 }
            );

            if (payload.labels && payload.datasets) {
                const labels: string[] = payload.labels;
                chartData = labels.map((label, i) => ({
                    date:      label,
                    invoiced:  Number(payload.datasets[0]?.data[i] ?? 0),
                    collected: Number(payload.datasets[1]?.data[i] ?? 0),
                    pending:   Number(payload.datasets[2]?.data[i] ?? 0),
                }));
                if (payload.year) chartYear = Number(payload.year);
                writeCookieCache(CHART_COOKIE, chartData, { maxAgeSeconds: 60 * 60 * 24 });
            }
            loadBus?.success('chart');
        } catch (e: any) {
            if (e?.name === 'AbortError') return;
            const err = e as FetchErrorDetails;
            const msg = typeof err?.message === 'string' && err.message ? err.message : 'Error cargando datos';
            loadBus?.error('chart', { endpoint: `${API_BASE}/admin/dashboard/chart`, status: err?.status, message: msg });
            error = msg;
        } finally {
            loading = false;
            inFlight = false;
            // Trigger reveal animation after next paint
            requestAnimationFrame(() => { revealed = true; });
        }
    }

    onMount(() => {
        const cached = readCookieCache<ChartDataItem[]>(CHART_COOKIE);
        if (cached?.data && Array.isArray(cached.data) && cached.data.length > 0) {
            chartData = cached.data;
            loading = false;
            requestAnimationFrame(() => { revealed = true; });
        }
        loadChartData();
        const interval = setInterval(loadChartData, 30000);
        return () => {
            clearInterval(interval);
            if (abortController) abortController.abort();
        };
    });

    //======================================================================
    // 6. FORMATO
    //======================================================================
    function fmtY(value: number): string {
        if (value === 0) return '$0';
        if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
        if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
        return `$${value}`;
    }

    function fmtTooltip(value: number): string {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0,
        }).format(value);
    }

    //======================================================================
    // 7. HOVER / TOOLTIP
    //======================================================================
    function getClosest(chartX: number): { x: number; data: ChartDataItem } | null {
        if (data.length === 0) return null;
        let i = Math.round((chartX - pad.left) / xStep);
        i = Math.max(0, Math.min(i, data.length - 1));
        return { x: pad.left + i * xStep, data: data[i] };
    }

    function onMouseMove(e: MouseEvent) {
        if (!chartContainer) return;
        const svg = chartContainer.querySelector('svg');
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * W;
        hoveredPoint = (mouseX >= pad.left && mouseX <= W - pad.right)
            ? getClosest(mouseX)
            : null;
    }

    function onMouseLeave() { hoveredPoint = null; }

    //======================================================================
    // 8. TOTALES ANUALES
    //======================================================================
    const now = new Date();
    // Cap to current month only when showing the current year; past years show all 12 months.
    const totals = $derived(
        data.slice(0, chartYear === now.getFullYear() ? now.getMonth() + 1 : 12).reduce(
            (acc, d) => ({
                invoiced:  acc.invoiced  + d.invoiced,
                collected: acc.collected + d.collected,
                pending:   acc.pending   + d.pending,
            }),
            { invoiced: 0, collected: 0, pending: 0 }
        )
    );
</script>

<!-- ════════════════════════════════════════════════════════════════════ -->
<div class="chart-shell">

    <!-- Header ──────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
            <h2 class="text-base font-semibold text-slate-200 tracking-tight">Ingresos Financieros</h2>
            <p class="text-xs text-slate-500 mt-0.5">Facturación vs Recaudo · Año {chartYear}</p>
        </div>

        <div class="flex flex-wrap items-center gap-5">
            {#each Object.entries(config) as [, cfg]}
                <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full" style="background:{cfg.color};box-shadow:0 0 6px {cfg.color}55"></span>
                    <span class="text-xs font-medium text-slate-400">{cfg.label}</span>
                </div>
            {/each}
        </div>
    </div>

    <!-- Totales del año ─────────────────────────────────────── -->
    {#if data.length > 0}
        <div class="flex flex-wrap gap-3 md:gap-5 mb-5 pb-4 border-b border-white/5">
            {#each Object.entries(config) as [key, cfg]}
                <div class="total-chip">
                    <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background:{cfg.color}"></span>
                    <span class="text-slate-500">{cfg.label}:</span>
                    <span class="font-semibold" style="color:{cfg.color}">{fmtY(Math.round((totals as any)[key]))}</span>
                </div>
            {/each}
        </div>
    {/if}

    <!-- SVG Area ────────────────────────────────────────────── -->
    <div class="relative w-full" bind:this={chartContainer}>
        {#if loading}
            <div class="chart-placeholder">
                <div class="skeleton-bar" style="height:60%;animation-delay:0s"></div>
                <div class="skeleton-bar" style="height:80%;animation-delay:0.1s"></div>
                <div class="skeleton-bar" style="height:45%;animation-delay:0.2s"></div>
                <div class="skeleton-bar" style="height:70%;animation-delay:0.3s"></div>
                <div class="skeleton-bar" style="height:90%;animation-delay:0.4s"></div>
                <div class="skeleton-bar" style="height:55%;animation-delay:0.5s"></div>
            </div>
        {:else if error}
            <div class="flex items-center justify-center" style="height:{H}px">
                <p class="text-sm text-red-400/70">{error}</p>
            </div>
        {:else}
            <div
                class="chart-svg-wrap"
                class:chart-revealed={revealed}
                style="height:{H}px"
                role="img"
                aria-label="Gráfico de ingresos financieros"
                onmousemove={onMouseMove}
                onmouseleave={onMouseLeave}
            >
                <svg
                    viewBox="0 0 {W} {H}"
                    class="w-full h-full overflow-visible"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <defs>
                        <!-- Gradient fills per series -->
                        {#each Object.entries(config) as [, cfg], gi}
                            <linearGradient id={`gFill${gi}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%"   stop-color={cfg.color} stop-opacity="0.25"/>
                                <stop offset="55%"  stop-color={cfg.color} stop-opacity="0.08"/>
                                <stop offset="100%" stop-color={cfg.color} stop-opacity="0"/>
                            </linearGradient>
                        {/each}

                        <!-- Clip for smooth axis edge -->
                        <clipPath id="chartClip">
                            <rect x={pad.left} y={pad.top} width={cW} height={cH + 2}/>
                        </clipPath>
                    </defs>

                    <!-- Grid lines (horizontal) -->
                    {#each Array(5) as _, i}
                        {@const y = pad.top + (cH / 4) * i}
                        {@const val = maxValue * (1 - i / 4)}
                        <line
                            x1={pad.left} y1={y}
                            x2={W - pad.right} y2={y}
                            stroke="rgba(255,255,255,0.05)"
                            stroke-width="1"
                            stroke-dasharray="4 6"
                        />
                        <text
                            x={pad.left - 10} y={y + 4}
                            text-anchor="end"
                            font-size="11"
                            fill="#475569"
                        >{fmtY(Math.round(val))}</text>
                    {/each}

                    <!-- X-axis labels -->
                    {#each data as point, i}
                        {@const x = pad.left + xStep * i}
                        <text
                            x={x} y={H - pad.bottom + 18}
                            text-anchor="middle"
                            font-size="11"
                            fill="#475569"
                            font-weight="500"
                        >{point.date}</text>
                    {/each}

                    <!-- Areas (clipped) -->
                    <g clip-path="url(#chartClip)">
                        <path d={invoicedArea}  fill="url(#gFill0)"/>
                        <path d={collectedArea} fill="url(#gFill1)"/>
                        <path d={pendingArea}   fill="url(#gFill2)"/>
                    </g>

                    <!-- Lines -->
                    <g clip-path="url(#chartClip)">
                        <path d={invoicedLine}  fill="none" stroke={config.invoiced.color}  stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d={collectedLine} fill="none" stroke={config.collected.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d={pendingLine}   fill="none" stroke={config.pending.color}   stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </g>

                    <!-- Hover indicator -->
                    {#if hoveredPoint}
                        {@const gY = (v: number) => pad.top + cH - (v / maxValue) * cH}
                        <line
                            x1={hoveredPoint.x} y1={pad.top}
                            x2={hoveredPoint.x} y2={pad.top + cH}
                            stroke="rgba(255,255,255,0.12)" stroke-width="1" stroke-dasharray="3 3"
                        />
                        {#each Object.entries(config) as [key, cfg]}
                            {@const cy = gY(hoveredPoint.data[key] as number)}
                            <circle cx={hoveredPoint.x} cy={cy} r="5" fill={cfg.color} stroke="#0d0d18" stroke-width="2"/>
                            <circle cx={hoveredPoint.x} cy={cy} r="9" fill="none" stroke={cfg.color} stroke-width="1" opacity="0.3"/>
                        {/each}
                    {/if}
                </svg>

                <!-- Tooltip -->
                {#if hoveredPoint}
                    {@const ratio = hoveredPoint.x / W}
                    {@const isRight = ratio > 0.72}
                    <div
                        class="chart-tooltip"
                        style="
                            left:{ratio * 100}%;
                            top:16px;
                            transform:translate({isRight ? 'calc(-100% - 12px)' : ratio < 0.28 ? '8px' : '-50%'}, 0)
                        "
                        in:fade={{ duration: 80 }}
                    >
                        <p class="tooltip-date">{hoveredPoint.data.date}</p>
                        {#each Object.entries(config) as [key, cfg]}
                            <div class="tooltip-row">
                                <span class="tooltip-dot" style="background:{cfg.color}"></span>
                                <span class="tooltip-label">{cfg.label}</span>
                                <span class="tooltip-value" style="color:{cfg.color}">{fmtTooltip(hoveredPoint.data[key] as number)}</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    /* ── Shell ─────────────────────────────────────────────────────────── */
    .chart-shell {
        background: #0d0d16;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 16px;
        padding: 1.5rem;
    }

    .total-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
    }

    /* ── Chart reveal animation ──────────────────────────────────────── */
    @keyframes chartReveal {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    .chart-svg-wrap {
        opacity: 0;
        transition: none;
    }
    .chart-svg-wrap.chart-revealed {
        animation: chartReveal 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }

    /* ── Loading skeleton ────────────────────────────────────────────── */
    .chart-placeholder {
        height: 300px;
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 0 72px 36px;
    }
    @keyframes skeletonPulse {
        0%, 100% { opacity: 0.04; }
        50%       { opacity: 0.10; }
    }
    .skeleton-bar {
        flex: 1;
        background: white;
        border-radius: 4px 4px 0 0;
        animation: skeletonPulse 1.6s ease-in-out infinite;
    }

    /* ── Tooltip ─────────────────────────────────────────────────────── */
    .chart-tooltip {
        position: absolute;
        pointer-events: none;
        z-index: 50;
        background: rgba(15, 15, 26, 0.92);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.10);
        border-radius: 12px;
        padding: 12px 14px;
        min-width: 200px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }
    .tooltip-date {
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .tooltip-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
    }
    .tooltip-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .tooltip-label {
        font-size: 12px;
        color: #64748b;
        flex: 1;
    }
    .tooltip-value {
        font-size: 12px;
        font-weight: 600;
    }
</style>
