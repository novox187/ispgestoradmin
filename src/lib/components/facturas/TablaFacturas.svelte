<script lang="ts">
    import { EllipsisVertical, CreditCard, Ban, Trash2, Eye, Loader2, CheckCircle2, XCircle } from '@lucide/svelte';
    import { API_BASE } from '$lib/config';
    import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';

    let { invoices, loading, onView, onDelete } = $props();

    // ── Estado del modal de cobro manual ─────────────────────────────────────
    let chargeModal = $state<{
        open: boolean;
        invoice: any | null;
        method: string;
        reference: string;
        notes: string;
        processing: boolean;
        error: string;
    }>({ open: false, invoice: null, method: 'wallet', reference: '', notes: '', processing: false, error: '' });

    // IDs de facturas con operación en progreso (para deshabilitar botones)
    let processingIds = $state<Set<number>>(new Set());

    function openChargeModal(invoice: any) {
        chargeModal = { open: true, invoice, method: 'wallet', reference: '', notes: '', processing: false, error: '' };
    }

    function closeChargeModal() {
        if (chargeModal.processing) return;
        chargeModal = { ...chargeModal, open: false, invoice: null, error: '' };
    }

    async function confirmCharge() {
        if (!chargeModal.invoice || chargeModal.processing) return;

        chargeModal.processing = true;
        chargeModal.error = '';

        const id = chargeModal.invoice.id;
        processingIds = new Set([...processingIds, id]);

        try {
            const token = localStorage.getItem('employee_token');
            const res = await fetch(`${API_BASE}/admin/invoices/${id}/charge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    method: chargeModal.method,
                    reference: chargeModal.reference || undefined,
                    notes: chargeModal.notes || undefined,
                }),
            });

            const data = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor' }));

            if (!res.ok) {
                chargeModal.error = data.error || 'Error al procesar el cobro';
                chargeModal.processing = false;
                processingIds = new Set([...processingIds].filter(x => x !== id));
                return;
            }

            // Éxito: cerrar modal y recargar lista
            chargeModal = { open: false, invoice: null, method: 'wallet', reference: '', notes: '', processing: false, error: '' };
            onDelete(); // refresca la lista

        } catch (e) {
            chargeModal.error = 'Error de conexión. Intente nuevamente.';
            chargeModal.processing = false;
        } finally {
            processingIds = new Set([...processingIds].filter(x => x !== id));
        }
    }

    async function handleCancel(invoice: any) {
        if (invoice.status === 'cancelled') return;
        if (!confirm(`¿Cancelar la factura ${invoice.invoice_number}? Esta acción no se puede deshacer.`)) return;

        processingIds = new Set([...processingIds, invoice.id]);
        try {
            const token = localStorage.getItem('employee_token');
            const res = await fetch(`${API_BASE}/admin/invoices/${invoice.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: 'cancelled' }),
            });
            if (res.ok) {
                onDelete();
            } else {
                alert('Error al cancelar factura');
            }
        } catch (e) {
            console.error(e);
        } finally {
            processingIds = new Set([...processingIds].filter(x => x !== invoice.id));
        }
    }

    async function handleDelete(invoice: any) {
        if (!confirm(`¿Eliminar permanentemente la factura ${invoice.invoice_number}?`)) return;

        processingIds = new Set([...processingIds, invoice.id]);
        try {
            const token = localStorage.getItem('employee_token');
            const res = await fetch(`${API_BASE}/admin/invoices/${invoice.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                onDelete();
            } else {
                alert('Error al eliminar factura');
            }
        } catch (e) {
            console.error(e);
        } finally {
            processingIds = new Set([...processingIds].filter(x => x !== invoice.id));
        }
    }

    function getStatusClass(status: string) {
        const map: Record<string, string> = {
            paid:      'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',
            pending:   'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
            failed:    'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
            cancelled: 'bg-neutral-700/60 text-neutral-400 ring-1 ring-neutral-600/40',
            draft:     'bg-neutral-700/60 text-neutral-400 ring-1 ring-neutral-600/40',
        };
        return map[status] ?? map.draft;
    }

    function getStatusLabel(status: string) {
        const map: Record<string, string> = {
            paid: 'Pagada', pending: 'Pendiente', failed: 'Fallida',
            cancelled: 'Cancelada', draft: 'Borrador',
        };
        return map[status] ?? status;
    }

    // Retorna true si la factura puede ser cobrada manualmente
    function canCharge(status: string) {
        return status === 'pending' || status === 'failed';
    }

    // Retorna true si la acción de cancelar tiene sentido
    function canCancel(status: string) {
        return status !== 'cancelled' && status !== 'paid';
    }

    const PAYMENT_METHOD_LABELS: Record<string, string> = {
        wallet: 'Wallet (descuento automático)',
        manual: 'Efectivo',
        card: 'Tarjeta',
        transfer: 'Transferencia bancaria',
    };
</script>

<!-- ── Modal de Cobro Manual ──────────────────────────────────────────────── -->
{#if chargeModal.open}
    <div
        class="fixed inset-0 z-[70] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="charge-modal-title"
    >
        <button
            class="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onclick={closeChargeModal}
            aria-label="Cerrar modal"
        ></button>

        <div class="relative z-10 w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 shadow-2xl p-6 space-y-5">
            <!-- Header -->
            <div class="flex items-start gap-3">
                <div class="p-2 rounded-lg bg-blue-500/15 border border-blue-500/20">
                    <CreditCard class="size-5 text-blue-400" />
                </div>
                <div>
                    <h2 id="charge-modal-title" class="text-lg font-bold text-white">Cobrar Factura</h2>
                    <p class="text-sm text-neutral-400 mt-0.5">
                        {chargeModal.invoice?.invoice_number} &mdash;
                        <span class="text-white font-semibold">${Number(chargeModal.invoice?.total_amount || 0).toFixed(2)}</span>
                    </p>
                </div>
            </div>

            <!-- Método de pago -->
            <div class="space-y-1.5">
                <label for="charge-method" class="block text-sm font-medium text-neutral-300">
                    Método de pago <span class="text-red-400">*</span>
                </label>
                <select
                    id="charge-method"
                    bind:value={chargeModal.method}
                    class="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                >
                    {#each Object.entries(PAYMENT_METHOD_LABELS) as [value, label]}
                        <option {value}>{label}</option>
                    {/each}
                </select>
                {#if chargeModal.method === 'wallet'}
                    <p class="text-xs text-yellow-400/80">
                        Se descontará el monto directamente de la wallet del cliente.
                        Si no hay saldo suficiente, el cobro fallará.
                    </p>
                {:else}
                    <p class="text-xs text-neutral-500">
                        El pago se registrará como recibido sin afectar la wallet.
                    </p>
                {/if}
            </div>

            <!-- Referencia (opcional para manual) -->
            {#if chargeModal.method !== 'wallet'}
                <div class="space-y-1.5">
                    <label for="charge-reference" class="block text-sm font-medium text-neutral-300">
                        Referencia de pago
                        <span class="text-neutral-500 font-normal">(opcional)</span>
                    </label>
                    <input
                        id="charge-reference"
                        type="text"
                        bind:value={chargeModal.reference}
                        placeholder="Nº recibo, comprobante, etc."
                        maxlength="100"
                        class="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                    />
                </div>
            {/if}

            <!-- Notas -->
            <div class="space-y-1.5">
                <label for="charge-notes" class="block text-sm font-medium text-neutral-300">
                    Notas internas
                    <span class="text-neutral-500 font-normal">(quedan en log)</span>
                </label>
                <textarea
                    id="charge-notes"
                    bind:value={chargeModal.notes}
                    rows="2"
                    maxlength="500"
                    placeholder="Motivo del cobro manual, observaciones..."
                    class="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm resize-none"
                ></textarea>
            </div>

            <!-- Error -->
            {#if chargeModal.error}
                <div class="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <XCircle class="size-4 text-red-400 mt-0.5 shrink-0" />
                    <p class="text-sm text-red-400">{chargeModal.error}</p>
                </div>
            {/if}

            <!-- Acciones -->
            <div class="flex gap-3 pt-1">
                <button
                    type="button"
                    onclick={closeChargeModal}
                    disabled={chargeModal.processing}
                    class="flex-1 px-4 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onclick={confirmCharge}
                    disabled={chargeModal.processing}
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {#if chargeModal.processing}
                        <Loader2 class="size-4 animate-spin" />
                        Procesando...
                    {:else}
                        <CheckCircle2 class="size-4" />
                        Confirmar cobro
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- ── Tabla ──────────────────────────────────────────────────────────────── -->
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
                        {@const isProcessing = processingIds.has(invoice.id)}
                        {@const isCancelled = invoice.status === 'cancelled'}
                        {@const isPaid = invoice.status === 'paid'}
                        <tr
                            class="group hover:bg-neutral-900/30 transition-colors"
                            class:opacity-60={isCancelled}
                        >
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
                                {#if isProcessing}
                                    <div class="flex justify-end pr-2">
                                        <Loader2 class="size-5 animate-spin text-blue-400" />
                                    </div>
                                {:else}
                                    <Menu>
                                        <Menu.Trigger
                                            class="btn-icon preset-tonal-surface border-none focus:outline-none focus:ring-0"
                                            disabled={isCancelled && !isPaid}
                                            aria-label="Acciones para {invoice.invoice_number}"
                                        >
                                            <EllipsisVertical class="size-5" />
                                        </Menu.Trigger>
                                        <Portal>
                                            <Menu.Positioner class="border-none focus:outline-none focus:ring-0 z-50">
                                                <Menu.Content class="border-none focus:outline-none focus:ring-0 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl z-50 min-w-[170px] py-1">

                                                    <!-- Ver detalle — siempre disponible -->
                                                    <Menu.Item value="view" onclick={() => onView(invoice)}>
                                                        <span class="flex items-center gap-2 px-3 py-2 text-sm text-gray-200 hover:bg-neutral-800 rounded cursor-pointer w-full">
                                                            <Eye class="size-4 text-gray-400" />
                                                            Ver Detalle
                                                        </span>
                                                    </Menu.Item>

                                                    <!-- Cobrar — solo si está pendiente o fallida -->
                                                    {#if canCharge(invoice.status)}
                                                        <Menu.Item value="charge" onclick={() => openChargeModal(invoice)}>
                                                            <span class="flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/10 rounded cursor-pointer w-full">
                                                                <CreditCard class="size-4" />
                                                                Cobrar
                                                            </span>
                                                        </Menu.Item>
                                                    {/if}

                                                    <!-- Cancelar — deshabilitado si ya está cancelada/pagada -->
                                                    {#if canCancel(invoice.status)}
                                                        <Menu.Item value="cancel" onclick={() => handleCancel(invoice)}>
                                                            <span class="flex items-center gap-2 px-3 py-2 text-sm text-orange-400 hover:bg-orange-500/10 rounded cursor-pointer w-full">
                                                                <Ban class="size-4" />
                                                                Cancelar
                                                            </span>
                                                        </Menu.Item>
                                                    {:else if isCancelled}
                                                        <div class="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 cursor-not-allowed select-none">
                                                            <Ban class="size-4" />
                                                            Cancelada
                                                        </div>
                                                    {/if}

                                                    <div class="my-1 border-t border-neutral-800"></div>

                                                    <!-- Eliminar — siempre disponible -->
                                                    <Menu.Item value="delete" onclick={() => handleDelete(invoice)}>
                                                        <span class="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded cursor-pointer w-full">
                                                            <Trash2 class="size-4" />
                                                            Eliminar
                                                        </span>
                                                    </Menu.Item>

                                                </Menu.Content>
                                            </Menu.Positioner>
                                        </Portal>
                                    </Menu>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>
</div>
