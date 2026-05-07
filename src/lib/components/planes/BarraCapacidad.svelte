<script lang="ts">
  import type { CapacitySnapshot } from '$lib/types/capacity';

  export let capacity: CapacitySnapshot | null = null;

  function formatMbps(v: number): string {
    if (!Number.isFinite(v) || v <= 0) return '0 Mbps';
    if (v >= 1000) return `${(v / 1000).toFixed(2).replace(/\.00$/, '')} Gbps`;
    return `${Math.round(v)} Mbps`;
  }

  function pct(used: number, total: number): number {
    if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0;
    return Math.min(100, Math.max(0, (used / total) * 100));
  }

  $: assignedDown = Number(capacity?.plans_assigned_down_mbps ?? capacity?.used_down_mbps ?? 0);
  $: assignedUp = Number(capacity?.plans_assigned_up_mbps ?? capacity?.used_up_mbps ?? 0);
  $: remainingDown = Number(capacity?.plans_remaining_down_mbps ?? capacity?.remaining_down_mbps ?? 0);
  $: remainingUp = Number(capacity?.plans_remaining_up_mbps ?? capacity?.remaining_up_mbps ?? 0);
  $: totalDown = Number(capacity?.total_down_mbps ?? 0);
  $: totalUp = Number(capacity?.total_up_mbps ?? 0);
  $: warn80 = Math.max(pct(assignedDown, totalDown), pct(assignedUp, totalUp)) >= 80;
</script>

{#if capacity}
  <div class="bg-card border border-neutral-800 rounded-lg p-4">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <div class="text-sm font-semibold text-foreground">
          Megas asignados a planes: {formatMbps(assignedDown)} / {formatMbps(totalDown)} ↓ · {formatMbps(assignedUp)} / {formatMbps(totalUp)} ↑
        </div>
        <div class="text-xs text-muted-foreground">
          {pct(assignedDown, totalDown).toFixed(1)}% ↓ · {pct(assignedUp, totalUp).toFixed(1)}% ↑ · Reúso {capacity.reuse_ratio}:1 · Disponible {formatMbps(remainingDown)} ↓ · {formatMbps(remainingUp)} ↑
        </div>
      </div>
      <div class={`text-xs font-medium px-3 py-1 rounded-full ${
        warn80 ? 'bg-orange-500/10 text-orange-300' : 'bg-emerald-500/10 text-emerald-300'
      }`}>
        {warn80 ? 'Alerta 80%' : 'OK'}
      </div>
    </div>

    <div class="mt-3 space-y-2">
      <div>
        <div class="flex justify-between text-[11px] text-muted-foreground">
          <span>Descarga</span>
          <span>{pct(assignedDown, totalDown).toFixed(1)}%</span>
        </div>
        <div class="h-2 w-full bg-[#0f0f0f] rounded">
          <div
            class={`h-2 rounded ${warn80 ? 'bg-orange-500' : 'bg-emerald-500'}`}
            style={`width: ${pct(assignedDown, totalDown)}%`}
          ></div>
        </div>
      </div>
      <div>
        <div class="flex justify-between text-[11px] text-muted-foreground">
          <span>Subida</span>
          <span>{pct(assignedUp, totalUp).toFixed(1)}%</span>
        </div>
        <div class="h-2 w-full bg-[#0f0f0f] rounded">
          <div
            class={`h-2 rounded ${warn80 ? 'bg-orange-500' : 'bg-emerald-500'}`}
            style={`width: ${pct(assignedUp, totalUp)}%`}
          ></div>
        </div>
      </div>
    </div>
  </div>
{/if}

