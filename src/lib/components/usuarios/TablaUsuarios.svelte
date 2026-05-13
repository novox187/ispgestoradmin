<script lang="ts">
    import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
    import { EllipsisVertical, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, Eye, Pencil, Trash2, ToggleLeft, ToggleRight } from '@lucide/svelte';
    import type { Employee, EmployeeFilters } from '$lib/stores/usuarios.svelte';

    type Props = {
        employees: Employee[];
        loading: boolean;
        sortBy: EmployeeFilters['sort_by'];
        sortDir: EmployeeFilters['sort_dir'];
        showTrashed: boolean;
        canEdit?: boolean;
        canDelete?: boolean;
        onSort: (col: EmployeeFilters['sort_by']) => void;
        onView: (id: number) => void;
        onEdit: (id: number) => void;
        onDelete: (id: number) => void;
        onRestore: (id: number) => void;
        onToggleStatus: (id: number) => void;
    };

    const { employees, loading, sortBy, sortDir, showTrashed, canEdit = true, canDelete = true, onSort, onView, onEdit, onDelete, onRestore, onToggleStatus }: Props = $props();

    const columns: { key: EmployeeFilters['sort_by']; label: string; sortable: boolean }[] = [
        { key: 'nombre',     label: 'Nombre',     sortable: true },
        { key: 'email',      label: 'Email',      sortable: true },
        { key: 'status',     label: 'Estado',     sortable: true },
        { key: 'created_at', label: 'Creado',     sortable: true },
    ];

    function sortIcon(col: EmployeeFilters['sort_by']) {
        if (sortBy !== col) return ArrowUpDown;
        return sortDir === 'asc' ? ArrowUp : ArrowDown;
    }

    function formatDate(iso: string | null) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
    }
</script>

<div class="bg-card border border-neutral-800 rounded-lg overflow-hidden">
    <div class="overflow-x-auto">
        <table class="w-full table caption-bottom text-sm">
            <thead>
                <tr class="border-b border-neutral-800 bg-accent/50">
                    {#each columns as col}
                        <th class="px-6 py-4 text-left font-semibold text-foreground">
                            {#if col.sortable}
                                <button
                                    class="flex items-center gap-1.5 hover:text-white transition-colors group"
                                    onclick={() => onSort(col.key)}
                                >
                                    {col.label}
                                    <svelte:component this={sortIcon(col.key)}
                                        class="size-3.5 {sortBy === col.key ? 'text-blue-400' : 'text-neutral-600 group-hover:text-neutral-400'}" />
                                </button>
                            {:else}
                                {col.label}
                            {/if}
                        </th>
                    {/each}
                    <th class="px-6 py-4 text-left font-semibold text-foreground">Rol</th>
                    <th class="px-6 py-4 text-left font-semibold text-foreground">Teléfono</th>
                    <th class="px-6 py-4 text-right font-semibold text-foreground">Acciones</th>
                </tr>
            </thead>
            <tbody>
                {#if loading}
                    {#each Array(6) as _, i}
                        <tr class="border-b border-neutral-800">
                            <td class="px-6 py-4"><div class="h-4 w-36 rounded bg-neutral-800/60 animate-pulse"></div></td>
                            <td class="px-6 py-4"><div class="h-4 w-44 rounded bg-neutral-800/60 animate-pulse"></div></td>
                            <td class="px-6 py-4"><div class="h-5 w-16 rounded-full bg-neutral-800/60 animate-pulse"></div></td>
                            <td class="px-6 py-4"><div class="h-4 w-24 rounded bg-neutral-800/60 animate-pulse"></div></td>
                            <td class="px-6 py-4"><div class="h-5 w-20 rounded-full bg-neutral-800/60 animate-pulse"></div></td>
                            <td class="px-6 py-4"><div class="h-4 w-28 rounded bg-neutral-800/60 animate-pulse"></div></td>
                            <td class="px-6 py-4"><div class="h-8 w-8 rounded bg-neutral-800/60 animate-pulse ml-auto"></div></td>
                        </tr>
                    {/each}
                {:else if employees.length === 0}
                    <tr>
                        <td colspan="7" class="px-6 py-12 text-center text-neutral-500 text-sm">
                            No se encontraron usuarios con los filtros aplicados.
                        </td>
                    </tr>
                {:else}
                    {#each employees as emp (emp.id)}
                        <tr class="border-b border-neutral-800 hover:bg-accent/40 transition {emp.deleted_at ? 'opacity-60' : ''}">
                            <td class="px-6 py-4 text-foreground font-medium">
                                {emp.name}
                                {#if emp.deleted_at}
                                    <span class="ml-2 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">eliminado</span>
                                {/if}
                            </td>
                            <td class="px-6 py-4 text-muted-foreground">{emp.email}</td>
                            <td class="px-6 py-4">
                                {#if emp.status === 'active'}
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                        Activo
                                    </span>
                                {:else}
                                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                        Inactivo
                                    </span>
                                {/if}
                            </td>
                            <td class="px-6 py-4 text-muted-foreground text-xs">{formatDate(emp.created_at)}</td>
                            <td class="px-6 py-4">
                                <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    {emp.role ?? 'Sin rol'}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-muted-foreground text-xs">{emp.phone ?? '—'}</td>
                            <td class="px-6 py-4 text-right">
                                <Menu>
                                    <Menu.Trigger class="btn-icon preset-tonal-surface border-none focus:outline-none focus:ring-0">
                                        <EllipsisVertical class="size-4" />
                                    </Menu.Trigger>
                                    <Portal>
                                        <Menu.Positioner class="border-none">
                                            <Menu.Content class="min-w-[140px]">
                                                {#if !emp.deleted_at}
                                                    <Menu.Item value="view" onclick={() => onView(emp.id)}>
                                                        <Eye class="size-3.5 mr-2" /><Menu.ItemText>Ver</Menu.ItemText>
                                                    </Menu.Item>
                                                    {#if canEdit}
                                                        <Menu.Item value="edit" onclick={() => onEdit(emp.id)}>
                                                            <Pencil class="size-3.5 mr-2" /><Menu.ItemText>Editar</Menu.ItemText>
                                                        </Menu.Item>
                                                        <Menu.Item value="status" onclick={() => onToggleStatus(emp.id)}>
                                                            {#if emp.status === 'active'}
                                                                <ToggleLeft class="size-3.5 mr-2 text-yellow-400" />
                                                                <Menu.ItemText>Desactivar</Menu.ItemText>
                                                            {:else}
                                                                <ToggleRight class="size-3.5 mr-2 text-green-400" />
                                                                <Menu.ItemText>Activar</Menu.ItemText>
                                                            {/if}
                                                        </Menu.Item>
                                                    {/if}
                                                    {#if canDelete}
                                                        <Menu.Item value="delete" onclick={() => onDelete(emp.id)} class="text-red-400 hover:bg-red-500/10">
                                                            <Trash2 class="size-3.5 mr-2" /><Menu.ItemText>Eliminar</Menu.ItemText>
                                                        </Menu.Item>
                                                    {/if}
                                                {:else}
                                                    <Menu.Item value="view" onclick={() => onView(emp.id)}>
                                                        <Eye class="size-3.5 mr-2" /><Menu.ItemText>Ver</Menu.ItemText>
                                                    </Menu.Item>
                                                    {#if canDelete}
                                                        <Menu.Item value="restore" onclick={() => onRestore(emp.id)} class="text-green-400 hover:bg-green-500/10">
                                                            <RotateCcw class="size-3.5 mr-2" /><Menu.ItemText>Restaurar</Menu.ItemText>
                                                        </Menu.Item>
                                                    {/if}
                                                {/if}
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
