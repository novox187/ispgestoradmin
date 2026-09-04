<script lang="ts">
    import {
        AlertOctagon, CheckCircle2, Receipt, Calendar, Clock,
        ExternalLink, ChevronRight, Wallet
    } from '@lucide/svelte';
    import { formatCurrency, toAmount } from '$lib/utils/currency';
    import { formatDate as formatDatePure } from '$lib/utils/date-format';
    import type { InvoiceLite } from '$lib/types/clientes';

    let {
        invoices = [],
        walletBalance = 0
    }: {
        invoices?: InvoiceLite[];
        walletBalance?: number;
    } = $props();

    // Medianoche local: comparar contra `now()` marcaría como vencida una
    // factura que vence hoy mismo.
    const todayMidnight = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();

    function isOverdue(inv: InvoiceLite): boolean {
        if (!inv?.due_date) return false;
        const t = new Date(inv.due_date).getTime();
        return Number.isFinite(t) && t < todayMidnight;
    }

    let pending = $derived.by<InvoiceLite[]>(() =>
        (invoices ?? [])
            .filter((i) => i && (i.status === 'pending' || i.status === 'failed'))
            .sort((a, b) => {
                const da = a.due_date ? new Date(a.due_date).getTime() : 0;
                const db = b.due_date ? new Date(b.due_date).getTime() : 0;
                return da - db;
            })
    );

    let settled = $derived.by<InvoiceLite[]>(() =>
        (invoices ?? [])
            .filter((i) => i && i.status === 'paid')
            .sort((a, b) => {
                const da = a.issue_date ? new Date(a.issue_date).getTime() : 0;
                const db = b.issue_date ? new Date(b.issue_date).getTime() : 0;
                return db - da;
            })
            .slice(0, 6)
    );

    let totals = $derived.by(() => {
        let conIva = 0, sinIva = 0, iva = 0;
        for (const inv of pending) {
            conIva += toAmount(inv.total_amount);
            sinIva += toAmount(inv.amount);
            iva    += toAmount(inv.tax_amount);
        }
        return { conIva, sinIva, iva };
    });

    let overdueCount = $derived(pending.filter(isOverdue).length);

    function shortDescription(raw?: string): string {
        if (!raw) return 'Sin descripción del concepto';
        const cleaned = String(raw).replace(/\s+/g, ' ').trim();
        return cleaned.length <= 120 ? cleaned : cleaned.slice(0, 117) + '…';
    }
</script>

<div class="h-full overflow-y-auto scrollbar-isp">
    <div class="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {#if pending.length > 0}
            <!-- Cabecera de deuda -->
            <section
                class="rounded-xl border border-danger-500/30 bg-danger-950/25 overflow-hidden"
                aria-labelledby="deuda-heading"
            >
                <div class="flex items-start justify-between gap-3 p-4 pb-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="size-9 rounded-lg bg-danger-500/15 ring-1 ring-danger-500/30 flex items-center justify-center shrink-0">
                            <AlertOctagon class="size-4.5 text-danger-300" aria-hidden="true" />
                        </span>
                        <div class="min-w-0">
                            <h3 id="deuda-heading" class="text-sm font-bold text-danger-100 leading-tight">Deuda pendiente</h3>
                            <p class="text-[11px] text-danger-300/80 mt-0.5">
                                {pending.length} {pending.length === 1 ? 'factura sin pagar' : 'facturas sin pagar'}
                                {#if overdueCount > 0}
                                    · <span class="font-semibold text-danger-200">{overdueCount} vencida{overdueCount === 1 ? '' : 's'}</span>
                                {/if}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 px-4 pb-4">
                    <div class="rounded-lg bg-black/40 border border-danger-500/25 p-3">
                        <p class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-danger-300/80">
                            <Receipt class="size-3" aria-hidden="true" /> Total con IVA
                        </p>
                        <p class="mt-1 text-xl font-bold text-danger-200 tabular-nums leading-none">
                            {formatCurrency(totals.conIva)}
                        </p>
                    </div>
                    <div class="rounded-lg bg-black/25 border border-white/[0.06] p-3">
                        <p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Subtotal</p>
                        <p class="mt-1 text-base font-semibold text-text-primary tabular-nums leading-none">
                            {formatCurrency(totals.sinIva)}
                        </p>
                        <p class="mt-1 text-[10px] text-text-disabled tabular-nums">IVA {formatCurrency(totals.iva)}</p>
                    </div>
                    <div class="rounded-lg bg-black/25 border border-white/[0.06] p-3">
                        <p class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                            <Wallet class="size-3" aria-hidden="true" /> Saldo a favor
                        </p>
                        <p class="mt-1 text-base font-semibold tabular-nums leading-none
                                  {walletBalance > 0 ? 'text-success-300' : 'text-text-secondary'}">
                            {formatCurrency(walletBalance)}
                        </p>
                        {#if walletBalance > 0 && walletBalance < totals.conIva}
                            <p class="mt-1 text-[10px] text-warning-400 tabular-nums">
                                Faltan {formatCurrency(totals.conIva - walletBalance)}
                            </p>
                        {/if}
                    </div>
                </div>
            </section>

            <!-- Facturas pendientes -->
            <section aria-labelledby="pendientes-heading">
                <div class="flex items-center justify-between mb-2">
                    <h3 id="pendientes-heading" class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                        Facturas pendientes
                    </h3>
                    <a
                        href="/facturas?status=pending"
                        class="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary-400
                               hover:text-primary-300 transition-colors duration-150
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                    >
                        Ver en Facturación
                        <ChevronRight class="size-3" aria-hidden="true" />
                    </a>
                </div>

                <ul class="space-y-1.5">
                    {#each pending as inv (inv.id)}
                        {@const overdue = isOverdue(inv)}
                        <li>
                            <a
                                href="/facturas?invoice={inv.id}"
                                class="group flex items-start justify-between gap-3 rounded-lg border p-3
                                       transition-colors duration-150
                                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                                       {overdue
                                           ? 'bg-danger-950/20 border-danger-500/25 hover:border-danger-400/50'
                                           : 'bg-surface-elevated border-white/[0.06] hover:border-white/15'}"
                            >
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="text-xs font-mono text-text-primary truncate">
                                            {inv.invoice_number ?? `#${inv.id}`}
                                        </span>
                                        {#if overdue}
                                            <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded status-badge-cancelled">
                                                Vencida
                                            </span>
                                        {:else if inv.status === 'failed'}
                                            <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded status-badge-suspended">
                                                Cobro fallido
                                            </span>
                                        {:else}
                                            <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded status-badge-inactive">
                                                Pendiente
                                            </span>
                                        {/if}
                                    </div>

                                    <p class="mt-1 text-[11.5px] text-text-muted leading-snug line-clamp-2">
                                        {shortDescription(inv.description)}
                                    </p>

                                    <div class="mt-1.5 flex items-center gap-3 flex-wrap text-[10px] text-text-disabled">
                                        <span class="inline-flex items-center gap-1">
                                            <Calendar class="size-3" aria-hidden="true" />
                                            Emitida <span class="tabular-nums text-text-muted">{formatDatePure(inv.issue_date ?? '')}</span>
                                        </span>
                                        {#if inv.due_date}
                                            <span class="inline-flex items-center gap-1">
                                                <Clock class="size-3 {overdue ? 'text-danger-400' : ''}" aria-hidden="true" />
                                                Vence
                                                <span class="tabular-nums {overdue ? 'font-semibold text-danger-300' : 'text-text-muted'}">
                                                    {formatDatePure(inv.due_date)}
                                                </span>
                                            </span>
                                        {/if}
                                    </div>
                                </div>

                                <div class="shrink-0 text-right">
                                    <p class="text-sm font-bold tabular-nums leading-none {overdue ? 'text-danger-200' : 'text-text-primary'}">
                                        {formatCurrency(inv.total_amount)}
                                    </p>
                                    <p class="mt-1 text-[10px] text-text-disabled tabular-nums">
                                        s/IVA {formatCurrency(inv.amount)}
                                    </p>
                                    <ExternalLink
                                        class="mt-1 ml-auto size-3.5 text-text-disabled group-hover:text-primary-400 transition-colors duration-150"
                                        aria-hidden="true"
                                    />
                                </div>
                            </a>
                        </li>
                    {/each}
                </ul>
            </section>

        {:else}
            <section class="rounded-xl border border-success-500/25 bg-success-950/20 p-4 flex items-center gap-3">
                <span class="size-10 rounded-lg bg-success-500/15 ring-1 ring-success-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 class="size-5 text-success-300" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                    <h3 class="text-sm font-semibold text-success-100 leading-tight">Cliente al día</h3>
                    <p class="text-[11px] text-success-300/80 mt-0.5 leading-snug">
                        No registra facturas pendientes. Saldo en billetera: <span class="tabular-nums font-medium">{formatCurrency(walletBalance)}</span>.
                    </p>
                </div>
            </section>
        {/if}

        <!-- Historial de pagos -->
        {#if settled.length > 0}
            <section aria-labelledby="pagadas-heading">
                <h3 id="pagadas-heading" class="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Últimas pagadas
                </h3>
                <ul class="rounded-lg border border-white/[0.06] bg-surface-elevated divide-y divide-white/[0.04] overflow-hidden">
                    {#each settled as inv (inv.id)}
                        <li>
                            <a
                                href="/facturas?invoice={inv.id}"
                                class="flex items-center justify-between gap-3 px-3 py-2 text-xs
                                       hover:bg-surface-hover transition-colors duration-150
                                       focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                            >
                                <span class="flex items-center gap-2 min-w-0">
                                    <CheckCircle2 class="size-3.5 text-success-400 shrink-0" aria-hidden="true" />
                                    <span class="font-mono text-text-secondary truncate">{inv.invoice_number ?? `#${inv.id}`}</span>
                                </span>
                                <span class="flex items-center gap-3 shrink-0 tabular-nums">
                                    <span class="text-text-disabled">{formatDatePure(inv.issue_date ?? '')}</span>
                                    <span class="font-semibold text-text-secondary">{formatCurrency(inv.total_amount)}</span>
                                </span>
                            </a>
                        </li>
                    {/each}
                </ul>
            </section>
        {/if}
    </div>
</div>
