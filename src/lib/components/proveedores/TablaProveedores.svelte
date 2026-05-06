<script lang="ts">
  import type { Provider } from '$lib/types/proveedores';

  export let items: Provider[] = [];
  export let loading: boolean = false;
  export let onView: (id: number) => void;
  export let onEdit: (id: number) => void;
  export let onToggleStatus: (id: number) => void;
  export let onViewConnections: (id: number) => void;

  import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
  import { EllipsisVertical } from "@lucide/svelte";
</script>

<div class="bg-card border border-neutral-800 rounded-lg overflow-hidden">
  <div class="overflow-x-auto table-wrap">
    <table class="w-full table caption-bottom">
      <thead>
        <tr class="border-b border-neutral-800 bg-accent/50">
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Proveedor</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Contacto</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Estado</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Conexiones</th>
          <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Acciones</th>
        </tr>
      </thead>
      <tbody class="[&>tr]:hover:preset-tonal-primary">
        {#if loading}
          {#each Array(6) as _, i}
            <tr class="border-b border-neutral-800">
              <td class="px-6 py-4"><div class="h-4 w-48 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 w-44 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-6 w-20 rounded-full bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-4 w-20 rounded bg-neutral-800/60 animate-pulse"></div></td>
              <td class="px-6 py-4"><div class="h-8 w-8 rounded bg-neutral-800/60 animate-pulse"></div></td>
            </tr>
          {/each}
        {:else}
          {#each items as isp (isp.id)}
            <tr class="border-b border-neutral-800 hover:bg-accent/50 transition">
              <td class="px-6 py-4 text-foreground">
                <div class="font-medium">{isp.company_name}</div>
                {#if isp.technical_support_contact}
                  <div class="text-xs text-muted-foreground">{isp.technical_support_contact}</div>
                {/if}
              </td>
              <td class="px-6 py-4 text-muted-foreground">
                <div>{isp.support_phone || '-'}</div>
                <div class="text-xs">{isp.support_email || ''}</div>
              </td>
              <td class="px-6 py-4">
                <span class={`px-3 py-1 rounded-full text-xs font-medium ${
                  isp.status === 'active'
                    ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                    : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                }`}>
                  {isp.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td class="px-6 py-4 text-foreground">{isp.connections_count}</td>
              <td class="px-6 py-4">
                <Menu>
                  <Menu.Trigger class="btn-icon preset-tonal-surface border-none focus:outline-none focus:ring-0">
                    <EllipsisVertical />
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner class="border-none focus:outline-none focus:ring-0">
                      <Menu.Content class="border-none focus:outline-none focus:ring-0 z-50">
                        <Menu.Item value="view" onclick={() => onView?.(isp.id)}>
                          <Menu.ItemText>Ver</Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item value="edit" onclick={() => onEdit?.(isp.id)}>
                          <Menu.ItemText>Editar</Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item value="connections" onclick={() => onViewConnections?.(isp.id)}>
                          <Menu.ItemText>Ver Conexiones</Menu.ItemText>
                        </Menu.Item>
                        <Menu.Item
                          value="toggle"
                          onclick={() => onToggleStatus?.(isp.id)}
                          class={`${
                            isp.status === 'active'
                              ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                              : "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                          }`}
                        >
                          <Menu.ItemText>{isp.status === 'active' ? 'Desactivar' : 'Activar'}</Menu.ItemText>
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

