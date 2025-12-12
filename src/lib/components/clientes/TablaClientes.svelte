<script lang="ts">
    type Client = {
        id: number;
        name: string;
        email: string;
        phone: string;
        plan: string;
        status: 'active' | 'suspended' | 'inactive';
    };

    export let filteredClients: Client[] = [];
    export let handleDeleteClient: (id: number) => void;
    export let handleViewClient: (id: number) => void;
    import {
        Menu,
        Portal
    } from '@skeletonlabs/skeleton-svelte';
    import {
        EllipsisVertical
    } from "@lucide/svelte";
    export let loading: boolean = false;
</script>

<div class="bg-card border border-neutral-800 rounded-lg overflow-hidden">
    <div class="overflow-x-auto table-wrap">
        <table class="w-full table caption-bottom">
            <thead>
                <tr class="border-b border-neutral-800 bg-accent/50">
                    <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Nombre</th>
                    <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Email</th>
                    <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Teléfono</th>
                    <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Plan</th>
                    <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Estado</th>
                    <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Acciones</th>
                </tr>
            </thead>
            <tbody class="[&>tr]:hover:preset-tonal-primary">
                {#if loading}
    {#each Array(6) as _, i}
      <tr class="border-b border-neutral-800">
        <td class="px-6 py-4"><div class="h-4 w-32 rounded bg-neutral-800/60 animate-pulse"></div></td>
        <td class="px-6 py-4"><div class="h-4 w-40 rounded bg-neutral-800/60 animate-pulse"></div></td>
        <td class="px-6 py-4"><div class="h-4 w-28 rounded bg-neutral-800/60 animate-pulse"></div></td>
        <td class="px-6 py-4"><div class="h-4 w-24 rounded bg-neutral-800/60 animate-pulse"></div></td>
        <td class="px-6 py-4"><div class="h-6 w-20 rounded-full bg-neutral-800/60 animate-pulse"></div></td>
        <td class="px-6 py-4"><div class="h-8 w-8 rounded bg-neutral-800/60 animate-pulse"></div></td>
      </tr>
    {/each}
  {:else}
    {#each filteredClients as client (client.id)}
      <tr class="border-b border-neutral-800 hover:bg-accent/50 transition">
        <td class="px-6 py-4 text-foreground">{client.name}</td>
        <td class="px-6 py-4 text-muted-foreground">{client.email}</td>
        <td class="px-6 py-4 text-muted-foreground">{client.phone}</td>
        <td class="px-6 py-4 text-foreground">{client.plan}</td>
        <td class="px-6 py-4">
          <span class={`px-3 py-1 rounded-full text-xs font-medium ${
            client.status === 'active'
              ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
              : client.status === 'suspended'
                ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
          }`}>
            {client.status === 'active' ? 'Activo' : client.status === 'suspended' ? 'Suspendido' : 'Inactivo'}
          </span>
        </td>
        <td class="px-6 py-4">
          <Menu>
            <Menu.Trigger class="btn-icon preset-tonal-surface border-none focus:outline-none focus:ring-0">
              <EllipsisVertical />
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner class="border-none focus:outline-none focus:ring-0">
                <Menu.Content class="border-none focus:outline-none focus:ring-0">
                  <Menu.Item value="view" onclick={() => handleViewClient(client.id)}>
                    <Menu.ItemText>Ver</Menu.ItemText>
                  </Menu.Item>
                  <Menu.Item value="delete" onclick={() => handleDeleteClient(client.id)} class="bg-red-500/10 text-red-500 hover:bg-red-500/20">
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
