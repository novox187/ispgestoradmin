<script lang="ts">
  type PlanStatus = 'active' | 'inactive';
  type Plan = {
    id: number;
    name: string;
    price: number;
    download: number;
    upload: number;
    status: PlanStatus;
    clients: number;
    revenue: number;
  };
  export let filteredPlans: Plan[] = [];
  export let handleViewPlan: (id: number) => void;
  export let handleEditPlan: (id: number) => void;
  export let handleToggleStatus: (id: number) => void;
  export let loading: boolean = false;
  import { onMount } from 'svelte';
  import { API_BASE } from '$lib/config';
  import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
  import { EllipsisVertical, Users } from "@lucide/svelte";

  let taxRate = 0.15;

  onMount(async () => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null;
      const res = await fetch(`${API_BASE}/admin/settings?module=facturacion`, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const json = await res.json();
        const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        const row = rows.find((r: any) => r.key === 'tax_rate');
        if (row) {
          const parsed = parseFloat(row.value);
          if (Number.isFinite(parsed) && parsed > 0) taxRate = parsed;
        }
      }
    } catch { /* fallback al 15% por defecto */ }
  });
</script>

<div class="bg-card border border-neutral-800 rounded-lg overflow-hidden">
  <div class="overflow-x-auto table-wrap">
    <table class="w-full table caption-bottom">
      <thead>
        <tr class="border-b border-neutral-800 bg-accent/50">
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Nombre</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">
            <div class="flex flex-col">
              <span>Precio</span>
              <span class="text-[10px] font-normal text-muted-foreground">con IVA / sin IVA</span>
            </div>
          </th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Velocidad</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Estado</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Clientes</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Ingresos</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Acciones</th>
        </tr>
      </thead>
      <tbody class="[&>tr]:hover:preset-tonal-primary">
        {#if loading}
          {#each Array(6) as _, i}
            <tr class="border-b border-neutral-800">
              <td class="px-6 py-4"><div class="h-4 w-32 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-8 w-28 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 w-28 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-6 w-20 rounded-full bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 w-20 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 w-24 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-8 w-8 rounded bg-neutral-800/60 animate-pulse"></div></td>
            </tr>
          {/each}
        {:else}
          {#each filteredPlans as plan (plan.id)}
            {@const priceWithIva = Math.round(plan.price * (1 + taxRate) * 100) / 100}
            <tr class="border-b border-neutral-800 hover:bg-accent/50 transition">
              <td class="px-6 py-4 text-foreground">{plan.name}</td>
              <td class="px-6 py-4">
                <div class="flex flex-col gap-0.5">
                  <span class="text-foreground text-sm font-semibold">${priceWithIva.toFixed(2)}</span>
                  <span class="text-xs text-muted-foreground">sin IVA: ${plan.price.toFixed(2)}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-muted-foreground">{plan.download}↓ / {plan.upload}↑ Mbps</td>
              <td class="px-6 py-4">
                <span class={`px-3 py-1 rounded-full text-xs font-medium ${
                  plan.status === 'active'
                    ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                    : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                }`}>
                  {plan.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td class="flex justify-center items-center gap-2 px-6 py-4 text-muted-foreground"><Users class="size-4" /> {plan.clients}</td>
              <td class="px-6 py-4 text-foreground">${plan.revenue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="px-6 py-4">
                <Menu>
                  <Menu.Trigger class="btn-icon preset-tonal-surface border-none focus:outline-none focus:ring-0">
                    <EllipsisVertical />
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner class="border-none focus:outline-none focus:ring-0">
                      <Menu.Content class="border-none focus:outline-none focus:ring-0 z-50">
                        <Menu.Item value="view" onclick={() => handleViewPlan(plan.id)}>
                          <Menu.ItemText>Ver</Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item value="edit" onclick={() => handleEditPlan(plan.id)}>
                          <Menu.ItemText>Editar</Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item value="toggle" onclick={() => handleToggleStatus(plan.id)} class={`${
                          plan.status === 'active'
                            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            : "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                        }`}>
                          <Menu.ItemText>{plan.status === 'active' ? 'Desactivar' : 'Activar'}</Menu.ItemText>
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
