<script lang="ts">
    import { Download, X } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import jsPDF from 'jspdf';
    import autoTable from 'jspdf-autotable';
    import { BRAND } from '$lib/brand';

    let { open, invoice, onClose } = $props();

    function getStatusBadge(status: string) {
        const classes: Record<string, string> = {
            paid: 'bg-green-500/20 text-green-500',
            pending: 'bg-yellow-500/20 text-yellow-500',
            failed: 'bg-red-500/20 text-red-500',
            cancelled: 'bg-gray-500/20 text-gray-500',
            draft: 'bg-gray-500/20 text-gray-400'
        };
        const labels: Record<string, string> = {
            paid: 'Pagada',
            pending: 'Pendiente',
            failed: 'Fallida',
            cancelled: 'Cancelada',
            draft: 'Borrador'
        };
        return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${classes[status] || classes.draft}">${labels[status] || status}</span>`;
    }

    function downloadPDF() {
        if (!invoice) return;

        const doc = new jsPDF();

        // Header - Company Info
        doc.setFontSize(20);
        doc.text(BRAND.nameUpper, 14, 22);

        doc.setFontSize(10);
        doc.text(BRAND.contact.address, 14, 30);
        doc.text(`NIT: ${BRAND.contact.nit}`, 14, 35);
        doc.text(BRAND.contact.email, 14, 40);

        // Header - Invoice Info
        doc.setFontSize(16);
        doc.text(`Factura ${invoice.invoice_number}`, 120, 22);
        
        doc.setFontSize(10);
        doc.text(`Fecha Emisión: ${new Date(invoice.issue_date).toLocaleDateString()}`, 120, 30);
        doc.text(`Vencimiento: ${new Date(invoice.due_date).toLocaleDateString()}`, 120, 35);
        doc.text(`Estado: ${invoice.status.toUpperCase()}`, 120, 40);

        // Client Info
        doc.setFontSize(11);
        doc.text('Facturar a:', 14, 55);
        doc.setFontSize(12);
        doc.text(invoice.client?.name || 'Cliente', 14, 62);
        doc.setFontSize(10);
        doc.text(invoice.client?.address || 'Dirección no registrada', 14, 68);
        doc.text(`DNI/NIT: ${invoice.client?.dni || ''}`, 14, 73);
        doc.text(invoice.client?.email || '', 14, 78);

        // Table
        const tableBody = [
            [
                invoice.description || `Servicio de Internet - ${invoice.client_plan?.plan?.name || ''}`,
                `$${Number(invoice.amount).toFixed(2)}`
            ]
        ];

        autoTable(doc, {
            startY: 85,
            head: [['Descripción', 'Monto']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [23, 23, 23], textColor: 255 }, // Dark header
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 40, halign: 'right' }
            }
        });

        // Totals
        // @ts-ignore
        const finalY = doc.lastAutoTable.finalY || 100;
        
        doc.text(`Subtotal: $${Number(invoice.amount).toFixed(2)}`, 130, finalY + 10);
        doc.text(`Impuestos: $${Number(invoice.tax_amount).toFixed(2)}`, 130, finalY + 15);
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Total: $${Number(invoice.total_amount).toFixed(2)}`, 130, finalY + 25);

        doc.save(`Factura-${invoice.invoice_number}.pdf`);
    }

    const animation = 'transition transition-discrete opacity-0 translate-y-[80px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[80px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog {open} closeOnEscape closeOnInteractOutside onOpenChange={() => onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50 " />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4 ">
      <Dialog.Content class={"card bg-surface-100-900 max-w-3xl p-6 shadow-xl rounded-2xl max-h-[80vh] overflow-y-auto " + animation}>
        {#if invoice}
        <header class="flex justify-between items-center mb-6 border-b border-neutral-800 pb-4">
          <div>
            <Dialog.Title class="sm:text-2xl font-bold text-white">Factura {invoice.invoice_number}</Dialog.Title>
            <div class="mt-1">
                {@html getStatusBadge(invoice.status)}
            </div>
          </div>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal" onclick={() => onClose?.()}>
            <X class="size-6 text-gray-400 hover:text-white" />
          </Dialog.CloseTrigger>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <!-- Emisor (Hardcoded por ahora o desde config) -->
            <div>
                <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">De</h3>
                <div class="text-white font-bold text-lg">{BRAND.nameUpper}</div>
                <div class="text-gray-300 text-sm">{BRAND.contact.address}</div>
                <div class="text-gray-300 text-sm">NIT: {BRAND.contact.nit}</div>
                <div class="text-gray-300 text-sm">{BRAND.contact.email}</div>
            </div>

            <!-- Cliente -->
            <div>
                <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Facturar a</h3>
                <div class="text-white font-bold text-lg">{invoice.client?.name}</div>
                <div class="text-gray-300 text-sm">{invoice.client?.address || 'Dirección no registrada'}</div>
                <div class="text-gray-300 text-sm">DNI/NIT: {invoice.client?.dni}</div>
                <div class="text-gray-300 text-sm">{invoice.client?.email}</div>
            </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 bg-neutral-800/50 p-4 rounded-lg">
            <div>
                <div class="text-xs text-gray-400 uppercase">Fecha Emisión</div>
                <div class="text-white font-medium">{new Date(invoice.issue_date).toLocaleDateString()}</div>
            </div>
            <div>
                <div class="text-xs text-gray-400 uppercase">Fecha Vencimiento</div>
                <div class="text-white font-medium">{new Date(invoice.due_date).toLocaleDateString()}</div>
            </div>
            <div>
                <div class="text-xs text-gray-400 uppercase">Plan</div>
                <div class="text-white font-medium truncate">{invoice.client_plan?.plan?.name || 'N/A'}</div>
            </div>
             <div>
                <div class="text-xs text-gray-400 uppercase">Ref. Pago</div>
                <div class="text-white font-medium truncate">{invoice.payment_reference || '-'}</div>
            </div>
        </div>

        <div class="mb-8">
            <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Detalle</h3>
            <table class="w-full text-left">
                <thead class="bg-neutral-800 text-gray-400 text-xs uppercase">
                    <tr>
                        <th class="px-4 py-2">Descripción</th>
                        <th class="px-4 py-2 text-right">Monto</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-neutral-800">
                    <tr>
                        <td class="px-4 py-3 text-gray-300">
                            {invoice.description || `Servicio de Internet - ${invoice.client_plan?.plan?.name}`}
                        </td>
                        <td class="px-4 py-3 text-right text-white font-medium">
                            ${Number(invoice.amount).toFixed(2)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="flex justify-end mb-8">
            <div class="w-full md:w-1/3 space-y-2">
                <div class="flex justify-between text-gray-400">
                    <span>Subtotal</span>
                    <span>${Number(invoice.amount).toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-gray-400">
                    <span>Impuestos</span>
                    <span>${Number(invoice.tax_amount).toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-white font-bold text-xl border-t border-neutral-700 pt-2">
                    <span>Total</span>
                    <span>${Number(invoice.total_amount).toFixed(2)}</span>
                </div>
            </div>
        </div>

        <div class="flex justify-end gap-3">
            <button type="button" onclick={onClose} class="px-4 py-2 rounded-lg bg-neutral-800 text-gray-300 hover:bg-neutral-700">Cerrar</button>
            <button type="button" onclick={downloadPDF} class="flex justify-center items-center px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500">
                Descargar <Download class="size-5 ml-2" />
            </button>
        </div>
        {:else}
            <div class="text-muted-foreground p-4">No hay información de la factura.</div>
        {/if}
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
