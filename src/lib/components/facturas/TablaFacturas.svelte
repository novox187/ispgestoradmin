<script lang="ts">
    import { EllipsisVertical } from '@lucide/svelte';
    import { API_BASE } from '$lib/config';
    import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';

    let { invoices, loading, onView, onDelete } = $props();

    async function handleCancel(id: number) {
        if (!confirm('¿Estás seguro de cancelar esta factura?')) return;
        
        try {
            const token = localStorage.getItem('employee_token');
            const res = await fetch(`${API_BASE}/admin/invoices/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ status: 'cancelled' })
            });
            if (res.ok) {
                onDelete(); // Refresh list
            } else {
                alert('Error al cancelar factura');
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('¿Estás seguro de eliminar permanentemente esta factura?')) return;
        
        try {
            const token = localStorage.getItem('employee_token');
            const res = await fetch(`${API_BASE}/admin/invoices/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                onDelete();
            } else {
                alert('Error al eliminar factura');
            }
        } catch (e) {
            console.error(e);
        }
    }

    function getStatusClass(status: string) {
        switch (status) {
            case 'paid': return 'bg-green-500/20 text-green-500';
            case 'pending': return 'bg-yellow-500/20 text-yellow-500';
            case 'failed': return 'bg-red-500/20 text-red-500';
            case 'cancelled': return 'bg-gray-500/20 text-gray-500';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    }

    function getStatusLabel(status: string) {
        switch (status) {
            case 'paid': return 'Pagada';
            case 'pending': return 'Pendiente';
            case 'failed': return 'Fallida';
            case 'cancelled': return 'Cancelada';
            case 'draft': return 'Borrador';
            default: return status;
        }
    }
</script>

<div class="w-full overflow-hidden rounded-lg border border-neutral-800 bg-card">
    <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
            <thead class="bg-neutral-900/50 text-muted-foreground">
                <tr>
                    <th class="px-6 py-3 font-medium">Nº Factura</th>
                    <th class="px-6 py-3 font-medium">Cliente</th>
                    <th class="px-6 py-3 font-medium">Plan</th>
                    <th class="px-6 py-3 font-medium">Emisión</th>
                    <th class="px-6 py-3 font-medium">Vencimiento</th>
                    <th class="px-6 py-3 font-medium">Total</th>
                    <th class="px-6 py-3 font-medium">Estado</th>
                    <th class="px-6 py-3 font-medium text-right">Acciones</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-neutral-800">
                {#if loading}
                    {#each Array(5) as _}
                        <tr class="animate-pulse">
                            <td class="px-6 py-4"><div class="h-4 w-24 bg-neutral-800 rounded"></div></td>
                            <td class="px-6 py-4">
                                <div class="h-4 w-32 bg-neutral-800 rounded mb-2"></div>
                                <div class="h-3 w-20 bg-neutral-800 rounded"></div>
                            </td>
                            <td class="px-6 py-4"><div class="h-4 w-24 bg-neutral-800 rounded"></div></td>
                            <td class="px-6 py-4"><div class="h-4 w-24 bg-neutral-800 rounded"></div></td>
                            <td class="px-6 py-4"><div class="h-4 w-24 bg-neutral-800 rounded"></div></td>
                            <td class="px-6 py-4"><div class="h-4 w-20 bg-neutral-800 rounded"></div></td>
                            <td class="px-6 py-4"><div class="h-6 w-20 bg-neutral-800 rounded-full"></div></td>
                            <td class="px-6 py-4"><div class="h-8 w-16 bg-neutral-800 rounded ml-auto"></div></td>
                        </tr>
                    {/each}
                {:else if invoices.length === 0}
                    <tr>
                        <td colspan="8" class="px-6 py-8 text-center text-muted-foreground">
                            No se encontraron facturas
                        </td>
                    </tr>
                {:else}
                    {#each invoices as invoice}
                        <tr class="group hover:bg-neutral-900/30 transition-colors">
                            <td class="px-6 py-3 font-medium text-white">{invoice.invoice_number}</td>
                            <td class="px-6 py-3 text-gray-300">
                                <div class="font-medium">{invoice.client?.name || 'N/A'}</div>
                                <div class="text-xs text-muted-foreground">{invoice.client?.dni || ''}</div>
                            </td>
                            <td class="px-6 py-3 text-gray-300">{invoice.client_plan?.plan?.name || 'N/A'}</td>
                            <td class="px-6 py-3 text-gray-300">{new Date(invoice.issue_date).toLocaleDateString()}</td>
                            <td class="px-6 py-3 text-gray-300">{new Date(invoice.due_date).toLocaleDateString()}</td>
                            <td class="px-6 py-3 font-medium text-white">${Number(invoice.total_amount).toFixed(2)}</td>
                            <td class="px-6 py-3">
                                <span class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(invoice.status)}`}>
                                    {getStatusLabel(invoice.status)}
                                </span>
                            </td>
                            <td class="px-6 py-3 text-right">
                                <Menu>
                                    <Menu.Trigger class="btn-icon preset-tonal-surface border-none focus:outline-none focus:ring-0">
                                        <EllipsisVertical class="size-5" />
                                    </Menu.Trigger>
                                    <Portal>
                                        <Menu.Positioner class="border-none focus:outline-none focus:ring-0 z-50">
                                            <Menu.Content class="border-none focus:outline-none focus:ring-0 bg-neutral-900 border-neutral-800 z-50">
                                                <Menu.Item value="view" onclick={() => onView(invoice)}>
                                                    <Menu.ItemText>Ver Detalle</Menu.ItemText>
                                                </Menu.Item>
                                                <Menu.Item value="cancel" onclick={() => handleCancel(invoice.id)} class="text-orange-500 hover:bg-orange-500/10">
                                                    <Menu.ItemText>Cancelar</Menu.ItemText>
                                                </Menu.Item>
                                                <Menu.Item value="delete" onclick={() => handleDelete(invoice.id)} class="text-red-500 hover:bg-red-500/10">
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
