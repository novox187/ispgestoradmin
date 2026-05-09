<script lang="ts">
    import { Signal, AlertTriangle, ArrowDown, ArrowUp } from "@lucide/svelte";
    import type { CapacitySnapshot } from '$lib/types/capacity';

    interface Props { capacity: CapacitySnapshot; }
    let { capacity }: Props = $props();

    function pct(used: number, total: number): number {
        if (!total || total <= 0) return 0;
        return Math.min(100, Math.max(0, (used / total) * 100));
    }

    function fmtMbps(v: number): string {
        if (!Number.isFinite(v) || v <= 0) return '0 Mbps';
        if (v >= 1000) return `${(v / 1000).toFixed(1)} Gbps`;
        return `${Math.round(v)} Mbps`;
    }

    function barColor(p: number): string {
        if (p >= 90) return '#ef4444';
        if (p >= 80) return '#f97316';
        if (p >= 60) return '#eab308';
        return '#3b82f6';
    }

    const downPct = $derived(pct(capacity.used_down_mbps, capacity.total_down_mbps));
    const upPct   = $derived(pct(capacity.used_up_mbps ?? 0, capacity.total_up_mbps ?? 0));
    const hasUp   = $derived((capacity.total_up_mbps ?? 0) > 0);
</script>

<div class="cap-card" class:cap-warn={capacity.warn_80}>

    <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
            <Signal class="w-4 h-4 text-slate-400" />
            <span class="text-sm font-semibold text-slate-200">Capacidad ISP</span>
        </div>
        {#if capacity.warn_80}
            <span class="warn-badge">
                <AlertTriangle class="w-3 h-3" />
                Alerta
            </span>
        {:else}
            <span class="text-xs text-slate-600">Reúso {capacity.reuse_ratio}:1</span>
        {/if}
    </div>

    <div class="space-y-3.5">

        <!-- Descarga -->
        <div>
            <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-1 text-xs text-slate-500">
                    <ArrowDown class="w-3 h-3" /> Descarga
                </div>
                <div class="text-xs font-mono text-slate-300">
                    {fmtMbps(capacity.used_down_mbps)}
                    <span class="text-slate-600">/ {fmtMbps(capacity.total_down_mbps)}</span>
                    <span class="ml-1 text-[10px]" style="color:{barColor(downPct)}">{downPct.toFixed(0)}%</span>
                </div>
            </div>
            <div class="bar-track">
                <div class="bar-fill" style="width:{downPct}%;background:{barColor(downPct)}"></div>
            </div>
        </div>

        <!-- Subida -->
        {#if hasUp}
        <div>
            <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-1 text-xs text-slate-500">
                    <ArrowUp class="w-3 h-3" /> Subida
                </div>
                <div class="text-xs font-mono text-slate-300">
                    {fmtMbps(capacity.used_up_mbps ?? 0)}
                    <span class="text-slate-600">/ {fmtMbps(capacity.total_up_mbps ?? 0)}</span>
                    <span class="ml-1 text-[10px]" style="color:{barColor(upPct)}">{upPct.toFixed(0)}%</span>
                </div>
            </div>
            <div class="bar-track">
                <div class="bar-fill" style="width:{upPct}%;background:{barColor(upPct)}"></div>
            </div>
        </div>
        {/if}

    </div>

    <p class="text-[10px] text-slate-700 mt-4 font-mono">
        {#if capacity.warn_80}
            ⚠ Uso superior al 80% — considerar ampliar capacidad
        {:else}
            Ratio de reúso {capacity.reuse_ratio}:1
        {/if}
    </p>

</div>

<style>
    .cap-card {
        background: #111118;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 14px;
        padding: 1.1rem 1.25rem;
        transition: border-color 0.2s ease;
    }
    .cap-card.cap-warn {
        border-color: rgba(249,115,22,0.25);
    }
    .warn-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        font-weight: 600;
        color: #fb923c;
        background: rgba(249,115,22,0.10);
        border: 1px solid rgba(249,115,22,0.20);
        padding: 2px 8px;
        border-radius: 99px;
    }
    .bar-track {
        height: 4px;
        background: rgba(255,255,255,0.05);
        border-radius: 99px;
        overflow: hidden;
    }
    .bar-fill {
        height: 100%;
        border-radius: 99px;
        transition: width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
</style>
