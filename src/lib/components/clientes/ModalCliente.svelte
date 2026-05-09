<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { API_BASE } from '$lib/config';
	import {
		X, User, Wifi, WifiOff, Clock, CreditCard, FileText,
		MapPin, Phone, Mail, Cpu, ShieldAlert, CheckCircle2,
		AlertTriangle, Loader2, ChevronRight, Wallet
	} from '@lucide/svelte';

	const props = $props<{ open: boolean; clientId: number | null; onClose: () => void }>();

	// ── Estado ───────────────────────────────────────────────────────────────
	let loading    = $state(false);
	let actionBusy = $state(false);
	let errorMsg   = $state<string | null>(null);
	let actionMsg  = $state<{ type: 'success' | 'error'; text: string } | null>(null);
	let client     = $state<any>(null);
	let activeTab  = $state<'info' | 'invoices' | 'support'>('info');
	let confirmAction = $state<'suspend' | 'activate' | null>(null);

	// ── Helpers de estado ────────────────────────────────────────────────────
	function getStatus(s?: string) {
		const up = (s ?? '').toUpperCase();
		if (up === 'ACTIVE'     || up === 'ACTIVO')    return { label: 'Activo',    color: '#34d399', bg: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.20)'  };
		if (up === 'LIMITED'    || up === 'LIMITADO')  return { label: 'Limitado',  color: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.20)'  };
		if (up === 'SUSPENDED'  || up === 'SUSPENDIDO')return { label: 'Suspendido',color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.20)' };
		if (up === 'CANCELLED'  || up === 'CANCELADO') return { label: 'Cancelado', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.20)' };
		return { label: s || 'Desconocido', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' };
	}

	function getInvoiceStatus(s: string) {
		if (s === 'paid')      return { label: 'Pagada',    color: '#34d399', bg: 'rgba(52,211,153,0.10)'  };
		if (s === 'pending')   return { label: 'Pendiente', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)'  };
		if (s === 'failed')    return { label: 'Fallida',   color: '#f87171', bg: 'rgba(248,113,113,0.10)' };
		if (s === 'cancelled') return { label: 'Cancelada', color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' };
		return { label: s, color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' };
	}

	function fmtCurrency(v: number | string) {
		return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(v) || 0);
	}

	function fmtDate(d?: string) {
		if (!d) return '—';
		const dt = new Date(d + (d.includes('T') ? '' : 'T00:00:00'));
		return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	// ── Carga de datos ───────────────────────────────────────────────────────
	async function fetchClient() {
		if (!props.clientId) return;
		loading  = true;
		errorMsg = null;
		client   = null;
		try {
			const token = localStorage.getItem('employee_token');
			const res = await fetch(`${API_BASE}/admin/clientes/full/${props.clientId}`, {
				headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			client = await res.json();
		} catch (e: any) {
			errorMsg = e?.message || 'Error cargando datos del cliente';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (props.open && props.clientId) {
			activeTab     = 'info';
			confirmAction = null;
			actionMsg     = null;
			fetchClient();
		}
		if (!props.open) {
			client = null;
		}
	});

	// ── Acciones ─────────────────────────────────────────────────────────────
	async function runAction(action: 'suspend' | 'activate') {
		if (!client) return;
		actionBusy = true;
		actionMsg  = null;
		const url  = `${API_BASE}/admin/clientes/${client.id}/${action}`;
		try {
			const token = localStorage.getItem('employee_token');
			const res = await fetch(url, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason: `${action === 'suspend' ? 'Suspensión' : 'Activación'} manual desde panel admin` })
			});
			const data = await res.json();
			if (!res.ok || !data.success) throw new Error(data.message || `Error HTTP ${res.status}`);
			actionMsg = { type: 'success', text: data.message || 'Operación exitosa' };
			await fetchClient();
		} catch (e: any) {
			actionMsg = { type: 'error', text: e?.message || 'Error en la operación' };
		} finally {
			actionBusy    = false;
			confirmAction = null;
		}
	}

	// ── Datos derivados ──────────────────────────────────────────────────────
	const activePlan    = $derived(client?.client_plans?.[0]);
	const pendingInvs   = $derived((client?.invoices ?? []).filter((i: any) => ['pending','failed'].includes(i.status)));
	const walletBalance = $derived(Number(client?.wallet?.balance ?? client?.wallet_balance ?? 0));
	const status        = $derived(getStatus(client?.service_status));
	const isSuspended   = $derived(['SUSPENDED','SUSPENDIDO'].includes((client?.service_status ?? '').toUpperCase()));
	const isActive      = $derived(['ACTIVE','ACTIVO'].includes((client?.service_status ?? '').toUpperCase()));
	const canSuspend    = $derived(isActive);
	const canActivate   = $derived(isSuspended);

	function closeModal() {
		confirmAction = null;
		props.onClose?.();
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) closeModal();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
	}
</script>

{#if props.open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- Backdrop -->
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		onclick={handleBackdrop}
		onkeydown={handleKeydown}
		transition:fade={{ duration: 150 }}
	>
		<!-- Panel -->
		<div
			class="modal-panel"
			transition:scale={{ duration: 200, start: 0.96 }}
		>
			<!-- ── Header ──────────────────────────────────────────────────── -->
			<div class="modal-header">
				<div class="flex items-center gap-3">
					{#if client && !loading}
						<div class="avatar-lg">
							{client.full_name?.charAt(0).toUpperCase() ?? '?'}
						</div>
						<div>
							<h2 class="modal-title">{client.full_name}</h2>
							<p class="modal-subtitle">#{client.id} · {client.document_id}</p>
						</div>
					{:else}
						<div class="flex flex-col gap-1">
							<div class="h-5 w-40 bg-white/5 rounded animate-pulse"></div>
							<div class="h-3 w-24 bg-white/[0.03] rounded animate-pulse mt-0.5"></div>
						</div>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					{#if client && !loading}
						<span
							class="status-badge"
							style="color:{status.color};background:{status.bg};border-color:{status.border}"
						>{status.label}</span>
					{/if}
					<button class="close-btn" onclick={closeModal} aria-label="Cerrar">
						<X class="w-4 h-4" />
					</button>
				</div>
			</div>

			<!-- ── Action feedback ─────────────────────────────────────────── -->
			{#if actionMsg}
				<div
					class="action-msg"
					class:action-msg-success={actionMsg.type === 'success'}
					class:action-msg-error={actionMsg.type === 'error'}
					transition:fade={{ duration: 120 }}
				>
					{#if actionMsg.type === 'success'}
						<CheckCircle2 class="w-4 h-4 flex-shrink-0" />
					{:else}
						<AlertTriangle class="w-4 h-4 flex-shrink-0" />
					{/if}
					<span class="text-xs">{actionMsg.text}</span>
				</div>
			{/if}

			<!-- ── Tabs ───────────────────────────────────────────────────── -->
			<div class="tabs-row">
				<button class="tab-btn" class:tab-active={activeTab === 'info'}     onclick={() => activeTab = 'info'}>
					<User class="w-3.5 h-3.5" /> Información
				</button>
				<button class="tab-btn" class:tab-active={activeTab === 'invoices'} onclick={() => activeTab = 'invoices'}>
					<FileText class="w-3.5 h-3.5" /> Facturas
					{#if pendingInvs.length > 0}
						<span class="tab-badge">{pendingInvs.length}</span>
					{/if}
				</button>
				<button class="tab-btn" class:tab-active={activeTab === 'support'}  onclick={() => activeTab = 'support'}>
					<ShieldAlert class="w-3.5 h-3.5" /> Soporte
					{#if (client?.soportes?.length ?? 0) > 0}
						<span class="tab-badge tab-badge-neutral">{client.soportes.length}</span>
					{/if}
				</button>
			</div>

			<!-- ── Body ───────────────────────────────────────────────────── -->
			<div class="modal-body custom-scrollbar">
				{#if loading}
					<div class="space-y-3 animate-pulse">
						{#each Array(5) as _}
							<div class="skeleton-row">
								<div class="h-3 w-24 bg-white/[0.04] rounded"></div>
								<div class="h-4 w-48 bg-white/[0.07] rounded"></div>
							</div>
						{/each}
					</div>
				{:else if errorMsg}
					<div class="flex flex-col items-center justify-center py-12 gap-3">
						<AlertTriangle class="w-8 h-8 text-red-400/60" />
						<p class="text-sm text-red-400/80">{errorMsg}</p>
						<button class="retry-btn" onclick={fetchClient}>Reintentar</button>
					</div>
				{:else if client}

					<!-- ── TAB: INFO ──────────────────────────────────────── -->
					{#if activeTab === 'info'}
						<div class="space-y-4">

							<!-- Datos de contacto -->
							<section class="info-section">
								<p class="section-label">Contacto</p>
								<div class="info-grid">
									<div class="info-row">
										<Mail class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
										<span class="info-key">Email</span>
										<span class="info-val break-all">{client.email || '—'}</span>
									</div>
									<div class="info-row">
										<Phone class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
										<span class="info-key">Teléfono</span>
										<span class="info-val">{client.contact_phone || '—'}</span>
									</div>
								</div>
							</section>

							<!-- Instalación -->
							<section class="info-section">
								<p class="section-label">Instalación</p>
								<div class="info-grid">
									<div class="info-row md:col-span-2">
										<MapPin class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
										<span class="info-key">Dirección</span>
										<span class="info-val">{client.installation_address || '—'}</span>
									</div>
									<div class="info-row">
										<Cpu class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
										<span class="info-key">IP</span>
										<span class="info-val font-mono text-blue-400">{client.ip || '—'}</span>
									</div>
									<div class="info-row">
										<MapPin class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
										<span class="info-key">GPS</span>
										<span class="info-val font-mono text-xs">{client.gps_coordinates || '—'}</span>
									</div>
									<div class="info-row">
										<Clock class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
										<span class="info-key">Contrato</span>
										<span class="info-val">{fmtDate(client.contract_date)}</span>
									</div>
								</div>
							</section>

							<!-- Plan activo -->
							<section class="info-section">
								<p class="section-label">Plan activo</p>
								{#if activePlan}
									<div class="plan-card">
										<div class="flex items-start justify-between gap-2 mb-3">
											<div>
												<p class="text-sm font-semibold text-slate-200">{activePlan.plan?.name || 'Sin nombre'}</p>
												<p class="text-xs text-slate-500 mt-0.5">Desde {fmtDate(activePlan.start_date)}</p>
											</div>
											<span class="plan-price">{fmtCurrency(activePlan.plan?.monthly_price ?? activePlan.current_price ?? 0)}/mes</span>
										</div>
										<div class="grid grid-cols-3 gap-2">
											<div class="plan-stat">
												<p class="plan-stat-label">Descarga</p>
												<p class="plan-stat-val text-blue-400">{activePlan.plan?.download_speed ?? '—'} Mbps</p>
											</div>
											<div class="plan-stat">
												<p class="plan-stat-label">Subida</p>
												<p class="plan-stat-val text-emerald-400">{activePlan.plan?.upload_speed ?? '—'} Mbps</p>
											</div>
											<div class="plan-stat">
												<p class="plan-stat-label">Prox. cobro</p>
												<p class="plan-stat-val text-slate-300 text-xs">{fmtDate(activePlan.next_billing_date)}</p>
											</div>
										</div>
									</div>
								{:else}
									<p class="text-sm text-slate-600 italic">Sin plan activo asignado.</p>
								{/if}
							</section>

							<!-- Wallet -->
							<section class="info-section">
								<p class="section-label">Balance de Cuenta</p>
								<div
									class="wallet-row"
									class:wallet-positive={walletBalance >= 0}
									class:wallet-negative={walletBalance < 0}
								>
									<Wallet class="w-4 h-4 flex-shrink-0" />
									<span class="text-sm font-semibold">{fmtCurrency(walletBalance)}</span>
									{#if walletBalance < 0}
										<span class="text-[10px] text-red-400/70 ml-auto">Saldo negativo</span>
									{/if}
								</div>
							</section>

							{#if client.observations}
								<section class="info-section">
									<p class="section-label">Observaciones</p>
									<p class="text-sm text-slate-400 leading-relaxed">{client.observations}</p>
								</section>
							{/if}
						</div>

					<!-- ── TAB: FACTURAS ───────────────────────────────────── -->
					{:else if activeTab === 'invoices'}
						<div class="space-y-2">
							{#if client.invoices?.length === 0}
								<div class="empty-state">
									<FileText class="w-8 h-8 text-slate-700" />
									<p class="text-sm text-slate-600">Sin facturas registradas</p>
								</div>
							{:else}
								{#each (client.invoices ?? []) as inv}
									{@const ist = getInvoiceStatus(inv.status)}
									<div class="invoice-row">
										<div class="flex items-start justify-between gap-3">
											<div class="min-w-0">
												<p class="text-xs font-mono text-slate-300 truncate">{inv.invoice_number}</p>
												<p class="text-[10px] text-slate-600 mt-0.5">
													Emitida: {fmtDate(inv.issue_date)}
													{#if inv.due_date} · Vence: {fmtDate(inv.due_date)}{/if}
												</p>
											</div>
											<div class="flex flex-col items-end gap-1 flex-shrink-0">
												<span class="text-sm font-bold text-slate-200">{fmtCurrency(inv.total_amount)}</span>
												<span class="inv-badge" style="color:{ist.color};background:{ist.bg}">{ist.label}</span>
											</div>
										</div>
										{#if inv.payment_method && inv.paid_at}
											<p class="text-[10px] text-slate-600 mt-1.5 pt-1.5 border-t border-white/[0.04]">
												Pagada el {fmtDate(inv.paid_at)} · {inv.payment_method}
											</p>
										{/if}
									</div>
								{/each}
							{/if}
						</div>

					<!-- ── TAB: SOPORTE ────────────────────────────────────── -->
					{:else if activeTab === 'support'}
						<div class="space-y-2">
							{#if !client.soportes?.length}
								<div class="empty-state">
									<ShieldAlert class="w-8 h-8 text-slate-700" />
									<p class="text-sm text-slate-600">Sin tickets de soporte</p>
								</div>
							{:else}
								{#each client.soportes as ticket}
									<div class="support-row">
										<div class="flex items-start justify-between gap-2">
											<p class="text-sm text-slate-300 flex-1">{ticket.description || ticket.title || 'Sin descripción'}</p>
											<span class="text-[10px] text-slate-600 flex-shrink-0">{fmtDate(ticket.created_at)}</span>
										</div>
										{#if ticket.status}
											<p class="text-[10px] text-slate-500 mt-1">Estado: {ticket.status}</p>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					{/if}

				{/if}
			</div>

			<!-- ── Footer con acciones ────────────────────────────────────── -->
			{#if client && !loading}
				<div class="modal-footer">
					{#if confirmAction}
						<!-- Confirmación -->
						<div class="confirm-box" transition:fade={{ duration: 100 }}>
							<p class="text-xs text-slate-400">
								¿Confirmar <strong class="text-slate-200">{confirmAction === 'suspend' ? 'suspensión' : 'activación'}</strong> del cliente?
							</p>
							<div class="flex gap-2">
								<button class="btn-ghost-sm" onclick={() => confirmAction = null} disabled={actionBusy}>Cancelar</button>
								<button
									class="btn-action-sm"
									class:btn-danger={confirmAction === 'suspend'}
									class:btn-success={confirmAction === 'activate'}
									onclick={() => runAction(confirmAction!)}
									disabled={actionBusy}
								>
									{#if actionBusy}
										<Loader2 class="w-3 h-3 animate-spin" />
									{/if}
									{confirmAction === 'suspend' ? 'Suspender' : 'Activar'}
								</button>
							</div>
						</div>
					{:else}
						<div class="flex items-center gap-2 ml-auto">
							{#if canSuspend}
								<button
									class="footer-btn btn-warn"
									onclick={() => { confirmAction = 'suspend'; actionMsg = null; }}
								>
									<WifiOff class="w-3.5 h-3.5" /> Suspender
								</button>
							{/if}
							{#if canActivate}
								<button
									class="footer-btn btn-ok"
									onclick={() => { confirmAction = 'activate'; actionMsg = null; }}
								>
									<Wifi class="w-3.5 h-3.5" /> Activar
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
/* ── Overlay ─────────────────────────────────────────────────────────────── */
.modal-backdrop {
	position: fixed;
	inset: 0;
	z-index: 9999;
	background: rgba(0, 0, 0, 0.65);
	backdrop-filter: blur(4px);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 1rem;
}

/* ── Panel ───────────────────────────────────────────────────────────────── */
.modal-panel {
	background: #111118;
	border: 1px solid rgba(255, 255, 255, 0.07);
	border-radius: 18px;
	width: 100%;
	max-width: 560px;
	max-height: 90vh;
	display: flex;
	flex-direction: column;
	box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.04);
	overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 1.25rem 1.25rem 1rem;
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	flex-shrink: 0;
}
.modal-title {
	font-size: 1rem;
	font-weight: 700;
	color: #e2e8f0;
	line-height: 1.2;
}
.modal-subtitle {
	font-size: 11px;
	color: #475569;
	margin-top: 2px;
	font-family: ui-monospace, monospace;
}
.avatar-lg {
	width: 42px;
	height: 42px;
	border-radius: 12px;
	background: rgba(255, 255, 255, 0.07);
	border: 1px solid rgba(255, 255, 255, 0.10);
	color: #94a3b8;
	font-size: 18px;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}
.status-badge {
	font-size: 10px;
	font-weight: 700;
	letter-spacing: 0.06em;
	padding: 3px 10px;
	border-radius: 99px;
	border: 1px solid;
}
.close-btn {
	width: 30px;
	height: 30px;
	border-radius: 8px;
	background: transparent;
	border: 1px solid rgba(255,255,255,0.07);
	color: #64748b;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: background 0.15s, color 0.15s;
}
.close-btn:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; }

/* ── Action feedback ─────────────────────────────────────────────────────── */
.action-msg {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 1.25rem;
	font-size: 12px;
	flex-shrink: 0;
}
.action-msg-success { background: rgba(52,211,153,0.08); color: #34d399; border-bottom: 1px solid rgba(52,211,153,0.12); }
.action-msg-error   { background: rgba(248,113,113,0.08); color: #f87171; border-bottom: 1px solid rgba(248,113,113,0.12); }

/* ── Tabs ────────────────────────────────────────────────────────────────── */
.tabs-row {
	display: flex;
	gap: 2px;
	padding: 0.75rem 1.25rem 0;
	border-bottom: 1px solid rgba(255,255,255,0.05);
	flex-shrink: 0;
}
.tab-btn {
	display: flex;
	align-items: center;
	gap: 5px;
	padding: 6px 12px;
	border-radius: 8px 8px 0 0;
	font-size: 12px;
	font-weight: 500;
	color: #64748b;
	background: transparent;
	border: none;
	cursor: pointer;
	transition: color 0.15s, background 0.15s;
	position: relative;
	bottom: -1px;
}
.tab-btn:hover { color: #94a3b8; background: rgba(255,255,255,0.03); }
.tab-active {
	color: #e2e8f0 !important;
	background: rgba(255,255,255,0.04) !important;
	border: 1px solid rgba(255,255,255,0.07);
	border-bottom-color: #111118;
}
.tab-badge {
	font-size: 9px;
	font-weight: 700;
	background: rgba(248,113,113,0.15);
	color: #f87171;
	border-radius: 99px;
	padding: 1px 5px;
}
.tab-badge-neutral {
	background: rgba(148,163,184,0.12);
	color: #94a3b8;
}

/* ── Body ────────────────────────────────────────────────────────────────── */
.modal-body {
	flex: 1;
	overflow-y: auto;
	padding: 1.25rem;
}

/* ── Info sections ───────────────────────────────────────────────────────── */
.info-section {
	background: rgba(255,255,255,0.02);
	border: 1px solid rgba(255,255,255,0.05);
	border-radius: 12px;
	padding: 0.875rem 1rem;
}
.section-label {
	font-size: 10px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: #475569;
	margin-bottom: 0.625rem;
}
.info-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 6px;
}
@media (min-width: 480px) {
	.info-grid { grid-template-columns: 1fr 1fr; }
	.info-grid .md\:col-span-2 { grid-column: span 2; }
}
.info-row {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	padding: 6px 0;
	border-bottom: 1px solid rgba(255,255,255,0.03);
}
.info-row:last-child { border-bottom: none; }
.info-key {
	font-size: 11px;
	color: #64748b;
	min-width: 68px;
	flex-shrink: 0;
	padding-top: 1px;
}
.info-val {
	font-size: 12px;
	color: #cbd5e1;
	font-weight: 500;
	flex: 1;
}

/* ── Plan card ───────────────────────────────────────────────────────────── */
.plan-card {
	background: rgba(59,130,246,0.05);
	border: 1px solid rgba(59,130,246,0.12);
	border-radius: 10px;
	padding: 0.875rem 1rem;
}
.plan-price {
	font-size: 13px;
	font-weight: 700;
	color: #3b82f6;
	flex-shrink: 0;
}
.plan-stat {
	background: rgba(255,255,255,0.03);
	border-radius: 8px;
	padding: 6px 8px;
	text-align: center;
}
.plan-stat-label {
	font-size: 9px;
	color: #475569;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	margin-bottom: 3px;
}
.plan-stat-val {
	font-size: 13px;
	font-weight: 700;
}

/* ── Wallet ──────────────────────────────────────────────────────────────── */
.wallet-row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 10px;
	border-radius: 8px;
}
.wallet-positive { color: #34d399; background: rgba(52,211,153,0.06); }
.wallet-negative { color: #f87171; background: rgba(248,113,113,0.06); }

/* ── Invoices ────────────────────────────────────────────────────────────── */
.invoice-row {
	background: rgba(255,255,255,0.02);
	border: 1px solid rgba(255,255,255,0.05);
	border-radius: 10px;
	padding: 10px 12px;
	transition: border-color 0.15s;
}
.invoice-row:hover { border-color: rgba(255,255,255,0.09); }
.inv-badge {
	font-size: 9px;
	font-weight: 700;
	padding: 2px 7px;
	border-radius: 99px;
}

/* ── Support ─────────────────────────────────────────────────────────────── */
.support-row {
	background: rgba(255,255,255,0.02);
	border: 1px solid rgba(255,255,255,0.05);
	border-radius: 10px;
	padding: 10px 12px;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 3rem 1rem;
	gap: 8px;
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
.skeleton-row {
	display: flex;
	flex-direction: column;
	gap: 6px;
	padding: 8px 0;
	border-bottom: 1px solid rgba(255,255,255,0.03);
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.modal-footer {
	padding: 0.875rem 1.25rem;
	border-top: 1px solid rgba(255,255,255,0.05);
	display: flex;
	align-items: center;
	flex-shrink: 0;
}
.footer-btn {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 6px 14px;
	border-radius: 8px;
	font-size: 12px;
	font-weight: 600;
	border: 1px solid;
	cursor: pointer;
	transition: opacity 0.15s;
}
.footer-btn:hover { opacity: 0.85; }
.btn-warn {
	background: rgba(251,191,36,0.08);
	border-color: rgba(251,191,36,0.20);
	color: #fbbf24;
}
.btn-ok {
	background: rgba(52,211,153,0.08);
	border-color: rgba(52,211,153,0.20);
	color: #34d399;
}

/* ── Confirm box ─────────────────────────────────────────────────────────── */
.confirm-box {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}
.btn-ghost-sm {
	padding: 5px 12px;
	border-radius: 7px;
	font-size: 11px;
	font-weight: 500;
	background: transparent;
	border: 1px solid rgba(255,255,255,0.10);
	color: #64748b;
	cursor: pointer;
}
.btn-ghost-sm:hover { color: #94a3b8; }
.btn-action-sm {
	display: flex;
	align-items: center;
	gap: 5px;
	padding: 5px 14px;
	border-radius: 7px;
	font-size: 11px;
	font-weight: 700;
	border: 1px solid;
	cursor: pointer;
	transition: opacity 0.15s;
}
.btn-action-sm:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-danger  { background: rgba(248,113,113,0.10); border-color: rgba(248,113,113,0.25); color: #f87171; }
.btn-success { background: rgba(52,211,153,0.10);  border-color: rgba(52,211,153,0.25);  color: #34d399; }

/* ── Retry ───────────────────────────────────────────────────────────────── */
.retry-btn {
	padding: 6px 16px;
	border-radius: 8px;
	font-size: 12px;
	background: rgba(255,255,255,0.05);
	border: 1px solid rgba(255,255,255,0.10);
	color: #94a3b8;
	cursor: pointer;
}
.retry-btn:hover { background: rgba(255,255,255,0.08); }

/* ── Scrollbar ───────────────────────────────────────────────────────────── */
.custom-scrollbar::-webkit-scrollbar       { width: 3px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
</style>
