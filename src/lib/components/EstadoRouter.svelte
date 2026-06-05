<script lang="ts">
    import { Cpu, Clock, Users, Wifi, WifiOff } from "@lucide/svelte";

    interface Props {
        online?: boolean;
        activeClients?: number;
        totalClients?: number;
        cpuLoad?: string;
        uptime?: string;
    }

    let {
        online = false,
        activeClients = 0,
        totalClients = 0,
        cpuLoad = "0%",
        uptime = "Offline",
    }: Props = $props();

    function formatUptime(raw: string): string {
        if (!raw || raw === 'Offline') return '—';
        const parts = raw.match(/(\d+)([wdhms])/g);
        if (!parts) return raw;
        const map: Record<string, string> = { w: 'sem', d: 'd', h: 'h', m: 'm', s: 's' };
        return parts
            .slice(0, 3)
            .map(p => p.replace(/(\d+)([wdhms])/, (_, n, u) => `${n}${map[u] ?? u}`))
            .join(' ');
    }

    function cpuPercent(raw: string): number {
        return Math.min(100, Math.max(0, parseInt(raw ?? '0') || 0));
    }

    const cpuPct     = $derived(cpuPercent(cpuLoad));
    const clientsPct = $derived(totalClients > 0 ? Math.round((activeClients / totalClients) * 100) : 0);

    function barColor(pct: number): string {
        if (pct >= 90) return '#f53b3b';
        if (pct >= 70) return '#f59e0b';
        return '#2570ff';
    }
</script>

<div class="router-card">

    <!-- ── Header ──────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-2.5">
            <!-- Animated status ring -->
            <div class="relative flex items-center justify-center w-8 h-8">
                {#if online}
                    <span class="absolute inline-flex w-8 h-8 rounded-full bg-emerald-500/20 ping-ring"></span>
                    <span class="relative w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                {:else}
                    <span class="relative w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                {/if}
            </div>
            <div>
                <p class="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Estado del Router</p>
                <p class="text-sm font-semibold text-slate-200 leading-none mt-0.5">MikroTik</p>
            </div>
        </div>

        <div class="flex items-center gap-2">
            {#if online}
                <Wifi class="w-4 h-4 text-emerald-400" />
                <span class="status-badge status-online">ONLINE</span>
            {:else}
                <WifiOff class="w-4 h-4 text-red-400" />
                <span class="status-badge status-offline">OFFLINE</span>
            {/if}
        </div>
    </div>

    <!-- ── Métricas ─────────────────────────────────────────────────── -->
    <div class="grid grid-cols-3 gap-3">

        <!-- Clientes -->
        <div class="metric-box">
            <div class="metric-icon">
                <Users class="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p class="metric-label">Clientes</p>
            <p class="metric-value">{activeClients}<span class="metric-sub">/{totalClients}</span></p>
            <div class="bar-track">
                <div class="bar-fill" style="width:{clientsPct}%; background:{barColor(clientsPct)}"></div>
            </div>
        </div>

        <!-- CPU -->
        <div class="metric-box">
            <div class="metric-icon">
                <Cpu class="w-3.5 h-3.5 text-violet-400" />
            </div>
            <p class="metric-label">CPU</p>
            <p class="metric-value">{cpuLoad}</p>
            <div class="bar-track">
                <div class="bar-fill" style="width:{cpuPct}%; background:{barColor(cpuPct)}"></div>
            </div>
        </div>

        <!-- Uptime -->
        <div class="metric-box">
            <div class="metric-icon">
                <Clock class="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p class="metric-label">Uptime</p>
            <p class="metric-value uptime" title={uptime}>{formatUptime(uptime)}</p>
            <div class="bar-track">
                <div class="bar-fill bg-amber-500" style="width:{online ? 100 : 0}%; opacity:0.6"></div>
            </div>
        </div>

    </div>

    <!-- ── Footer ───────────────────────────────────────────────────── -->
    <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        <p class="text-[10px] text-slate-600 font-mono">RouterOS · API</p>
        <div class="flex items-center gap-1.5">
            <span class="w-1 h-1 rounded-full {online ? 'bg-emerald-400' : 'bg-slate-700'}"></span>
            <span class="w-1 h-1 rounded-full {online ? 'bg-emerald-400' : 'bg-slate-700'}" style="animation-delay:0.15s"></span>
            <span class="w-1 h-1 rounded-full {online ? 'bg-emerald-400' : 'bg-slate-700'}" style="animation-delay:0.3s"></span>
        </div>
    </div>

</div>

<style>
    .router-card {
        background: #121214;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 14px;
        padding: 1.25rem;
        transition: border-color 0.2s ease;
    }
    .router-card:hover {
        border-color: rgba(255, 255, 255, 0.10);
    }

    /* Animated pulsing ring */
    @keyframes pingRing {
        0%   { transform: scale(0.9); opacity: 0.7; }
        70%  { transform: scale(1.8); opacity: 0; }
        100% { transform: scale(1.8); opacity: 0; }
    }
    .ping-ring {
        animation: pingRing 2s cubic-bezier(0, 0, 0.2, 1) infinite;
    }

    .status-badge {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        padding: 3px 8px;
        border-radius: 6px;
    }
    .status-online {
        background: rgba(16, 185, 129, 0.12);
        color: #32c686;
        border: 1px solid rgba(16, 185, 129, 0.25);
    }
    .status-offline {
        background: rgba(239, 68, 68, 0.12);
        color: #ff6464;
        border: 1px solid rgba(239, 68, 68, 0.25);
    }

    .metric-box {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        padding: 0.75rem 0.6rem;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }
    .metric-icon {
        margin-bottom: 2px;
    }
    .metric-label {
        font-size: 10px;
        font-weight: 500;
        color: #6a6a70;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    .metric-value {
        font-size: 1.1rem;
        font-weight: 700;
        color: #b6b6ba;
        line-height: 1.1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .metric-value.uptime {
        font-size: 0.85rem;
    }
    .metric-sub {
        font-size: 0.65rem;
        font-weight: 400;
        color: #45454b;
    }

    .bar-track {
        margin-top: 6px;
        height: 3px;
        background: rgba(255,255,255,0.06);
        border-radius: 99px;
        overflow: hidden;
    }
    .bar-fill {
        height: 100%;
        border-radius: 99px;
        transition: width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
</style>
