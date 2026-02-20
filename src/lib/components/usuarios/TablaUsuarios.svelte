<script lang="ts">
    type Employee = {
        id: number;
        name: string;
        email: string;
        phone: string;
        role: string;
        status: string;
    };

    export let filteredEmployees: Employee[] = [];
    export let handleEditEmployee: (id: number) => void;
    export let handleDeleteEmployee: (id: number) => void;
    export let handleViewEmployee: (id: number) => void;
    
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
                    <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Rol</th>
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
        <td class="px-6 py-4"><div class="h-6 w-20 rounded-full bg-neutral-800/60 animate-pulse"></div></td>
        <td class="px-6 py-4"><div class="h-8 w-8 rounded bg-neutral-800/60 animate-pulse"></div></td>
      </tr>
    {/each}
  {:else}
    {#each filteredEmployees as employee (employee.id)}
      <tr class="border-b border-neutral-800 hover:bg-accent/50 transition">
        <td class="px-6 py-4 text-foreground">{employee.name}</td>
        <td class="px-6 py-4 text-muted-foreground">{employee.email}</td>
        <td class="px-6 py-4 text-muted-foreground">{employee.phone}</td>
        <td class="px-6 py-4">
            <span class="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500">
                {employee.role || 'Sin Rol'}
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
                  <Menu.Item value="view" onclick={() => handleViewEmployee(employee.id)}>
                    <Menu.ItemText>Ver</Menu.ItemText>
                  </Menu.Item>
                  <Menu.Item value="edit" onclick={() => handleEditEmployee(employee.id)}>
                    <Menu.ItemText>Editar</Menu.ItemText>
                  </Menu.Item>
                  <Menu.Item value="delete" onclick={() => handleDeleteEmployee(employee.id)} class="bg-red-500/10 text-red-500 hover:bg-red-500/20">
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