<script lang="ts">
    import {
        Download, X, Building2, User, Calendar, Hash,
        CreditCard, FileText, CheckCircle2, Clock, XCircle,
        AlertCircle, Ban, Info,
    } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import jsPDF from 'jspdf';
    import autoTable from 'jspdf-autotable';
    import { BRAND } from '$lib/brand';

    let { open, invoice, onClose } = $props();

    // ── Datos del emisor desde el snapshot congelado ──────────────────────────
    // El snapshot almacena cada clave como { value, _public }
    function snapVal(key: string): string {
        const snap = invoice?.configuration_snapshot;
        if (!snap) return '';
        const entry = snap[key];
        if (entry && typeof entry === 'object' && 'value' in entry) return String(entry.value ?? '');
        // soporte para snapshots planos (valor directo)
        return String(snap[key] ?? '');
    }

    // Emisor: usa snapshot si existe, cae a BRAND como fallback visual
    const issuer = $derived({
        name:    snapVal('issuer_name')    || BRAND.nameUpper,
        address: snapVal('issuer_address') || BRAND.contact.address,
        nit:     snapVal('issuer_nit')     || BRAND.contact.nit,
        email:   snapVal('issuer_email')   || BRAND.contact.email,
        phone:   snapVal('issuer_phone')   || BRAND.contact.phone,
        website: BRAND.contact.website,
    });

    // Impuesto: calcula la tasa real desde el snapshot
    const taxRate = $derived((): number => {
        const r = parseFloat(snapVal('tax_rate'));
        return isNaN(r) ? 0 : r;
    });
    const taxLabel = $derived((): string => {
        const name = snapVal('tax_name') || 'Impuestos';
        const pct  = (taxRate() * 100).toFixed(0);
        return `${name} (${pct}%)`;
    });

    // ── Helpers de estado ─────────────────────────────────────────────────────
    type StatusKey = 'paid' | 'pending' | 'failed' | 'cancelled' | 'draft';

    const STATUS_CONFIG: Record<StatusKey, { label: string; icon: any; badge: string; iconClass: string }> = {
        paid:      { label: 'Pagada',    icon: CheckCircle2, badge: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30',    iconClass: 'text-green-400' },
        pending:   { label: 'Pendiente', icon: Clock,        badge: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30', iconClass: 'text-yellow-400' },
        failed:    { label: 'Fallida',   icon: XCircle,      badge: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',          iconClass: 'text-red-400' },
        cancelled: { label: 'Cancelada', icon: Ban,          badge: 'bg-neutral-700/60 text-neutral-400 ring-1 ring-neutral-600/40', iconClass: 'text-neutral-400' },
        draft:     { label: 'Borrador',  icon: AlertCircle,  badge: 'bg-neutral-700/60 text-neutral-400 ring-1 ring-neutral-600/40', iconClass: 'text-neutral-400' },
    };

    const PAYMENT_METHOD_LABELS: Record<string, string> = {
        wallet:   'Wallet',
        manual:   'Efectivo',
        card:     'Tarjeta',
        transfer: 'Transferencia',
    };

    function getStatusConfig(status: string) {
        return STATUS_CONFIG[status as StatusKey] ?? STATUS_CONFIG.draft;
    }

    function fmt(val: any): string {
        const n = Number(val);
        return isNaN(n) ? '0.00' : n.toFixed(2);
    }

    function fmtDate(d: string | undefined): string {
        if (!d) return '—';
        const date = new Date(d);
        return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function fmtDateShort(d: string | undefined): string {
        if (!d) return '—';
        const date = new Date(d);
        return isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
    }

    // ── Animación ──────────────────────────────────────────────────────────────
    const animation =
        'transition transition-discrete opacity-0 translate-y-4 ' +
        'starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-4 ' +
        'data-[state=open]:opacity-100 data-[state=open]:translate-y-0 duration-200';

    // ── Generación de PDF profesional ─────────────────────────────────────────
    function downloadPDF() {
        if (!invoice) return;

        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 14;
        const rightCol = pageW - margin;

        const statusCfg = getStatusConfig(invoice.status);

        // ── Franja de color superior ──
        doc.setFillColor(15, 15, 25);
        doc.rect(0, 0, pageW, 42, 'F');

        // Nombre empresa (izquierda) — desde snapshot
        const snap = issuer;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text(snap.name, margin, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 190);
        doc.text(BRAND.slogan, margin, 24);
        doc.text(snap.address, margin, 29);
        doc.text(`NIT: ${snap.nit}  |  ${snap.email}  |  ${snap.phone}`, margin, 34);

        // Nº factura (derecha)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(255, 255, 255);
        doc.text('FACTURA', rightCol, 16, { align: 'right' });
        doc.setFontSize(14);
        doc.text(invoice.invoice_number, rightCol, 23, { align: 'right' });

        // Estado en badge
        const statusColors: Record<string, [number, number, number]> = {
            paid: [34, 197, 94], pending: [234, 179, 8],
            failed: [239, 68, 68], cancelled: [115, 115, 115], draft: [115, 115, 115],
        };
        const [sr, sg, sb] = statusColors[invoice.status] ?? [115, 115, 115];
        doc.setFillColor(sr, sg, sb);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const statusLabel = statusCfg.label.toUpperCase();
        const badgeW = doc.getTextWidth(statusLabel) + 6;
        doc.roundedRect(rightCol - badgeW, 26, badgeW, 6, 1, 1, 'F');
        doc.text(statusLabel, rightCol - badgeW / 2, 30.2, { align: 'center' });

        // ── Bloque de fechas ──
        let y = 52;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 120);
        doc.text('FECHA EMISIÓN', margin, y);
        doc.text('FECHA VENCIMIENTO', margin + 55, y);
        doc.text('PLAN', margin + 110, y);
        if (invoice.paid_at) doc.text('FECHA PAGO', margin + 150, y);

        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 30, 40);
        doc.text(fmtDateShort(invoice.issue_date), margin, y);
        doc.text(fmtDateShort(invoice.due_date), margin + 55, y);
        doc.text(invoice.client_plan?.plan?.name || 'N/A', margin + 110, y);
        if (invoice.paid_at) doc.text(fmtDateShort(invoice.paid_at), margin + 150, y);

        // Línea separadora
        y += 8;
        doc.setDrawColor(220, 220, 230);
        doc.setLineWidth(0.3);
        doc.line(margin, y, rightCol, y);

        // ── Bloque De / Facturar a ──
        y += 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 120);
        doc.text('DE', margin, y);
        doc.text('FACTURAR A', pageW / 2 + 2, y);

        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 30);
        doc.text(snap.name, margin, y);
        doc.text(invoice.client?.name || 'Sin nombre', pageW / 2 + 2, y);

        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(70, 70, 80);
        const companyLines = [
            snap.address,
            `NIT: ${snap.nit}`,
            snap.email,
            snap.website,
        ];
        const clientLines = [
            invoice.client?.address || 'Dirección no registrada',
            `DNI/NIT: ${invoice.client?.dni || '—'}`,
            invoice.client?.email || '—',
            invoice.client?.phone || '',
        ];
        companyLines.forEach((line, i) => { doc.text(line, margin, y + i * 4.5); });
        clientLines.forEach((line, i) => { if (line) doc.text(line, pageW / 2 + 2, y + i * 4.5); });

        // ── Tabla de conceptos ──
        y += companyLines.length * 4.5 + 8;

        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [['Descripción', 'Método de pago', 'Monto']],
            body: [[
                invoice.description || `Servicio de Internet — ${invoice.client_plan?.plan?.name || 'Plan'}`,
                invoice.payment_method ? (PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method) : '—',
                `$${fmt(invoice.amount)}`,
            ]],
            theme: 'striped',
            headStyles: {
                fillColor: [15, 15, 25],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8.5,
            },
            bodyStyles: { fontSize: 8.5, textColor: [40, 40, 50] },
            alternateRowStyles: { fillColor: [248, 248, 252] },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 38, halign: 'center' },
                2: { cellWidth: 30, halign: 'right' },
            },
        });

        // ── Totales ──
        // @ts-ignore
        const afterTable: number = doc.lastAutoTable.finalY + 6;
        const totalsX = rightCol - 65;

        doc.setDrawColor(220, 220, 230);
        doc.setLineWidth(0.3);
        doc.line(totalsX, afterTable, rightCol, afterTable);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(80, 80, 95);
        doc.text('Subtotal', totalsX + 2, afterTable + 7);
        doc.text(`$${fmt(invoice.amount)}`, rightCol, afterTable + 7, { align: 'right' });

        doc.text(taxLabel(), totalsX + 2, afterTable + 13);
        doc.text(`$${fmt(invoice.tax_amount)}`, rightCol, afterTable + 13, { align: 'right' });

        doc.setLineWidth(0.4);
        doc.line(totalsX, afterTable + 15, rightCol, afterTable + 15);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 15, 25);
        doc.text('TOTAL', totalsX + 2, afterTable + 22);
        doc.text(`$${fmt(invoice.total_amount)}`, rightCol, afterTable + 22, { align: 'right' });

        // Referencia de pago
        if (invoice.payment_reference) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(120, 120, 135);
            doc.text(`Ref. pago: ${invoice.payment_reference}`, totalsX + 2, afterTable + 29);
        }

        // ── Términos y condiciones ──
        const termsY = Math.max(afterTable + 40, pageH - 48);
        doc.setFillColor(245, 245, 250);
        doc.roundedRect(margin, termsY, pageW - margin * 2, 28, 2, 2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 100);
        doc.text('TÉRMINOS Y CONDICIONES', margin + 4, termsY + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 120);
        const terms = [
            '1. El pago de esta factura debe realizarse antes de la fecha de vencimiento indicada.',
            '2. Los pagos vencidos pueden generar suspensión del servicio según los términos del contrato.',
            '3. Para disputas o consultas, contáctenos en: ' + snap.email,
            '4. Esta factura es válida como comprobante fiscal de la prestación del servicio.',
        ];
        terms.forEach((t, i) => doc.text(t, margin + 4, termsY + 12 + i * 4));

        // ── Pie de página con número de página ──
        const totalPages = doc.getNumberOfPages();
        for (let pg = 1; pg <= totalPages; pg++) {
            doc.setPage(pg);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(160, 160, 175);
            doc.text(
                `${snap.name}  |  ${snap.website}  |  Generado el ${new Date().toLocaleDateString()}`,
                margin,
                pageH - 6,
            );
            doc.text(`Página ${pg} de ${totalPages}`, rightCol, pageH - 6, { align: 'right' });
        }

        doc.save(`Factura-${invoice.invoice_number}.pdf`);
    }
</script>

<Dialog {open} closeOnEscape closeOnInteractOutside onOpenChange={() => onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class={"bg-neutral-950 border border-neutral-800 max-w-2xl w-full shadow-2xl rounded-2xl max-h-[88vh] overflow-y-auto " + animation}>

        {#if !invoice}
          <!-- Estado de error / sin datos -->
          <div class="flex flex-col items-center justify-center gap-4 p-12 text-center">
            <div class="p-4 rounded-full bg-neutral-800">
              <Info class="size-8 text-neutral-500" />
            </div>
            <p class="text-neutral-400 text-sm">No hay información disponible para esta factura.</p>
            <button onclick={() => onClose?.()} class="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm">
              Cerrar
            </button>
          </div>

        {:else}
          {@const cfg = getStatusConfig(invoice.status)}

          <!-- ── Header ── -->
          <header class="sticky top-0 z-10 bg-neutral-950 border-b border-neutral-800 px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
            <div class="flex items-center gap-3 min-w-0">
              <div class="p-2 rounded-lg bg-neutral-800 shrink-0">
                <FileText class="size-5 text-neutral-300" />
              </div>
              <div class="min-w-0">
                <Dialog.Title class="text-lg font-bold text-white truncate">
                  {invoice.invoice_number}
                </Dialog.Title>
                <span class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold mt-1 ${cfg.badge}`}>
                  <svelte:component this={cfg.icon} class="size-3" />
                  {cfg.label}
                </span>
              </div>
            </div>
            <Dialog.CloseTrigger
              onclick={() => onClose?.()}
              class="p-2 rounded-lg hover:bg-neutral-800 transition-colors shrink-0"
              aria-label="Cerrar"
            >
              <X class="size-5 text-neutral-400" />
            </Dialog.CloseTrigger>
          </header>

          <div class="p-6 space-y-6">

            <!-- ── Fechas y referencias ── -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
              <div>
                <div class="flex items-center gap-1.5 text-xs text-neutral-500 uppercase tracking-wider mb-1">
                  <Calendar class="size-3" /> Emisión
                </div>
                <div class="text-sm font-medium text-white">{fmtDate(invoice.issue_date)}</div>
              </div>
              <div>
                <div class="flex items-center gap-1.5 text-xs text-neutral-500 uppercase tracking-wider mb-1">
                  <Calendar class="size-3" /> Vencimiento
                </div>
                <div class="text-sm font-medium text-white">{fmtDate(invoice.due_date)}</div>
              </div>
              <div>
                <div class="flex items-center gap-1.5 text-xs text-neutral-500 uppercase tracking-wider mb-1">
                  <Hash class="size-3" /> Plan
                </div>
                <div class="text-sm font-medium text-white truncate">{invoice.client_plan?.plan?.name || '—'}</div>
              </div>
              <div>
                <div class="flex items-center gap-1.5 text-xs text-neutral-500 uppercase tracking-wider mb-1">
                  <CreditCard class="size-3" /> Ref. Pago
                </div>
                <div class="text-sm font-medium text-white truncate" title={invoice.payment_reference || ''}>
                  {invoice.payment_reference || '—'}
                </div>
              </div>
            </div>

            <!-- ── Partes (De / Para) ── -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Emisor -->
              <div class="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                <div class="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wider">
                  <Building2 class="size-3.5" /> De
                </div>
                <div class="text-base font-bold text-white">{issuer.name}</div>
                <div class="space-y-0.5 text-sm text-neutral-400">
                  <p>{issuer.address}</p>
                  <p>NIT: {issuer.nit}</p>
                  <p>{issuer.email}</p>
                  <p>{issuer.website}</p>
                </div>
              </div>

              <!-- Cliente -->
              <div class="p-4 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
                <div class="flex items-center gap-2 text-xs text-neutral-500 uppercase tracking-wider">
                  <User class="size-3.5" /> Facturar a
                </div>
                <div class="text-base font-bold text-white">{invoice.client?.name || '—'}</div>
                <div class="space-y-0.5 text-sm text-neutral-400">
                  <p>{invoice.client?.address || 'Dirección no registrada'}</p>
                  {#if invoice.client?.dni}
                    <p>DNI/NIT: {invoice.client.dni}</p>
                  {/if}
                  {#if invoice.client?.email}
                    <p>{invoice.client.email}</p>
                  {/if}
                </div>
              </div>
            </div>

            <!-- ── Tabla de conceptos ── -->
            <div>
              <h3 class="text-xs text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileText class="size-3.5" /> Detalle del servicio
              </h3>
              <div class="rounded-xl overflow-hidden border border-neutral-800">
                <table class="w-full text-sm text-left">
                  <thead class="bg-neutral-900 text-neutral-500 text-xs uppercase">
                    <tr>
                      <th class="px-4 py-3">Descripción</th>
                      {#if invoice.payment_method}
                        <th class="px-4 py-3 text-center">Método</th>
                      {/if}
                      <th class="px-4 py-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="border-t border-neutral-800">
                      <td class="px-4 py-3.5 text-neutral-200 leading-snug">
                        {invoice.description || `Servicio de Internet — ${invoice.client_plan?.plan?.name || 'Plan'}`}
                      </td>
                      {#if invoice.payment_method}
                        <td class="px-4 py-3.5 text-center">
                          <span class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-neutral-800 text-neutral-300">
                            <CreditCard class="size-3" />
                            {PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method}
                          </span>
                        </td>
                      {/if}
                      <td class="px-4 py-3.5 text-right font-semibold text-white">${fmt(invoice.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- ── Totales ── -->
            <div class="flex justify-end">
              <div class="w-full sm:w-72 space-y-2 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
                <div class="flex justify-between text-sm text-neutral-400">
                  <span>Subtotal</span>
                  <span>${fmt(invoice.amount)}</span>
                </div>
                <div class="flex justify-between text-sm text-neutral-400">
                  <span>{taxLabel()}</span>
                  <span>${fmt(invoice.tax_amount)}</span>
                </div>
                <div class="border-t border-neutral-700 pt-2 flex justify-between text-lg font-bold text-white">
                  <span>Total</span>
                  <span>${fmt(invoice.total_amount)}</span>
                </div>
                {#if invoice.paid_at}
                  <div class="flex justify-between text-xs text-green-400 pt-1">
                    <span>Pagado el</span>
                    <span>{fmtDate(invoice.paid_at)}</span>
                  </div>
                {/if}
              </div>
            </div>

          </div>

          <!-- ── Footer de acciones ── -->
          <footer class="sticky bottom-0 bg-neutral-950 border-t border-neutral-800 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
            <button
              type="button"
              onclick={() => onClose?.()}
              class="px-4 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors text-sm font-medium"
            >
              Cerrar
            </button>
            <button
              type="button"
              onclick={downloadPDF}
              class="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-semibold"
            >
              <Download class="size-4" />
              Descargar PDF
            </button>
          </footer>

        {/if}
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
