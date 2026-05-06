<script lang="ts">
  import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
  import { EllipsisVertical } from "@lucide/svelte";
  import type { Connection, ConnectionStatus } from '$lib/types/proveedores';

  export let items: Connection[] = [];
  export let loading: boolean = false;
  export let onView: (id: number) => void;
  export let onEdit: (id: number) => void;
  export let onToggleActive: (id: number) => void;
  export let onDelete: (id: number) => void;

  function statusClass(s: ConnectionStatus) {
    if (s === 'active') return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
    if (s === 'maintenance') return "bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20";
    if (s === 'suspended') return "bg-red-500/10 text-red-500 hover:bg-red-500/20";
    return "bg-gray-500/10 text-gray-300 hover:bg-gray-500/20";
  }
  function statusLabel(s: ConnectionStatus) {
    if (s === 'active') return 'Activo';
    if (s === 'maintenance') return 'Mantenimiento';
    if (s === 'suspended') return 'Suspendido';
    return 'Cancelado';
  }
</script>

<div class="bg-card border border-neutral-800 rounded-lg overflow-hidden">
  <div class="overflow-x-auto table-wrap">
    <table class="w-full table caption-bottom">
      <thead>
        <tr class="border-b border-neutral-800 bg-accent/50">
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Bajada / Subida</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Ratio</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Precio</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Costo/Mb</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Estado</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Acciones</th>
        </tr>
      </thead>
      <tbody class="[&>tr]:hover:preset-tonal-primary">
        {#if loading}
          {#each Array(6) as _, i}
            <tr class="border-b border-neutral-800">
              <td class="px-6 py-4"><div class="h-4 w-44 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 w-20 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 w-24 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 w-20 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-6 w-24 rounded-full bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-8 w-8 rounded bg-neutral-800/60 animate-pulse"></div></td>
            </tr>
          {/each}
        {:else}
          {#each items as c (c.id)}
            <tr class="border-b border-neutral-800 hover:bg-accent/50 transition">
              <td class="px-6 py-4 text-foreground">
                <div class="font-medium">{c.bandwidth_down}↓ / {c.bandwidth_up}↑ Mbps</div>
                <div class="text-xs text-muted-foreground">{c.interface_name || ''}</div>
              </td>
              <td class="px-6 py-4 text-muted-foreground">{c.ratio || '-'}</td>
              <td class="px-6 py-4 text-foreground">${c.monthly_price.toFixed(2)}</td>
              <td class="px-6 py-4 text-muted-foreground">${c.price_per_mb.toFixed(2)}</td>
              <td class="px-6 py-4">
                <span class={`px-3 py-1 rounded-full text-xs font-medium ${statusClass(c.status)}`}>
                  {statusLabel(c.status)}
                </span>
              </td>
              <td class="px-6 py-4">
                <Menu>
                  <Menu.Trigger class="btn-icon preset-tonal-surface border-none focus:outline-none focus:ring-0">
                    <EllipsisVertical />
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner class="border-none focus:outline-none focus:ring-0">
                      <Menu.Content class="border-none focus:outline-none focus:ring-0 z-50">
                        <Menu.Item value="view" onclick={() => onView?.(c.id)}>
                          <Menu.ItemText>Ver</Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item value="edit" onclick={() => onEdit?.(c.id)}>
                          <Menu.ItemText>Editar</Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item
                          value="toggle"
                          onclick={() => onToggleActive?.(c.id)}
                          class={`${c.status === 'active' ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500/20"}`}
                        >
                          <Menu.ItemText>{c.status === 'active' ? 'Desactivar' : 'Activar'}</Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item value="delete" onclick={() => onDelete?.(c.id)} class="bg-red-500/10 text-red-500 hover:bg-red-500/20">
                          <Menu.ItemText>Eliminar</Menu.ItemText>
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

