<script lang="ts">
    import {
        X, User, Calendar, DollarSign, FileText, ChevronDown,
        Search, AlertTriangle, CheckCircle2, Loader2, Info,
        Receipt, BadgePercent, Clock, Settings,
    } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import { goto } from '$app/navigation';
    import { API_BASE } from '$lib/config';
    import ModalConfigGuard, { type ConfigCheckResult } from './ModalConfigGuard.svelte';
    import {
        calcTotals, validateInvoiceForm, buildInvoicePayload,
        filterClients, isPossibleDuplicate, defaultDescription,
        addDays, todayISO, DEFAULT_TAX_RATE, TAX_RATES,
        type InvoiceFormState, type ValidationError, type ClientSummary,
        type ExistingInvoice,
    } from '$lib/utils/invoice-form';

    let { open, onClose, onCreated } = $props();

    // ── Tipos internos ────────────────────────────────────────────────────────
    interface ClientPlan {
        id: number;
        current_price?: number;
        plan?: { id: number; name: string; monthly_price?: number };
        ip_address?: string;
        status?: string;
    }

    interface FullClient extends ClientSummary {
        address?: string;
        client_plans?: ClientPlan[];
    }

    // ── Estado del formulario ─────────────────────────────────────────────────
    const today = todayISO();

    let form = $state<InvoiceFormState>({
        client_id:      '',
        client_plan_id: '',
        issue_date:     today,
        due_date:       addDays(today, 15),
        amount:         '',
        tax_rate:       DEFAULT_TAX_RATE,
        status:         'pending',
        description:    '',
    });

    // ── Estado de UI ──────────────────────────────────────────────────────────
    let step        = $state<'form' | 'confirm'>('form');
    let submitting  = $state(false);
    let submitError = $state('');

    // Config guard (shown when server rejects with missing/invalid config)
    let configGuardOpen   = $state(false);
    let configGuardResult = $state<ConfigCheckResult | null>(null);

    // Clientes
    let allClients       = $state<ClientSummary[]>([]);
    let loadingClients   = $state(false);
    let clientSearch     = $state('');
    let showClientList   = $state(false);
    let selectedClient   = $state<FullClient | null>(null);
    let loadingPlans     = $state(false);
    let clientPlans      = $state<ClientPlan[]>([]);

    // Facturas existentes para detección de duplicados
    let existingInvoices = $state<ExistingInvoice[]>([]);

    // Validación (se ejecuta al intentar avanzar al paso de confirmación)
    let touched  = $state(false);
    let errors   = $state<ValidationError[]>([]);

    // ── Derivados ─────────────────────────────────────────────────────────────
    const filteredClients = $derived(filterClients(allClients, clientSearch, 8));
    const totals          = $derived(calcTotals(Number(form.amount) || 0, form.tax_rate));
    const isDuplicate     = $derived(isPossibleDuplicate(existingInvoices, form));

    function fieldError(field: keyof InvoiceFormState): string | undefined {
        return touched ? errors.find(e => e.field === field)?.message : undefined;
    }

    // Recalcula errores reactivamente cuando el formulario cambia (post-touched)
    $effect(() => {
        if (touched) {
            // Leer todas las propiedades del formulario para suscribirse a sus cambios
            const _ = { ...form };
            errors = validateInvoiceForm(form).errors;
        }
    });

    // Cuando cambia issue_date: mueve due_date 15 días adelante si era la fecha auto-calculada
    $effect(() => {
        if (form.issue_date) {
            const auto = addDays(form.issue_date, 15);
            if (!form.due_date || form.due_date === addDays(today, 15)) {
                form.due_date = auto;
            }
        }
    });

    // ── Carga de datos ────────────────────────────────────────────────────────
    async function loadClients() {
        loadingClients = true;
        try {
            const token = localStorage.getItem('employee_token');
            const res = await fetch(`${API_BASE}/admin/clientes/summary`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            const data = await res.json();
            const raw  = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
            allClients = raw.map((c: any) => ({
                id:    c.id,
                name:  c.full_name || c.name || '(sin nombre)',
                dni:   c.document_id || c.dni || '',
                email: c.email || '',
            }));
        } catch (e) {
            console.error('Error cargando clientes:', e);
        } finally {
            loadingClients = false;
        }
    }

    async function loadClientPlans(clientId: string) {
        if (!clientId) return;
        loadingPlans = true;
        clientPlans  = [];
        form.client_plan_id = '';
        form.amount         = '';
        form.description    = '';
        try {
            const token = localStorage.getItem('employee_token');
            const res   = await fetch(`${API_BASE}/admin/clientes/full/${clientId}`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            const data = await res.json();
            clientPlans    = data.client_plans || [];
            selectedClient = { ...allClients.find(c => String(c.id) === clientId)!, ...data };

            // Cargar facturas existentes del cliente para detección de duplicados
            const invRes = await fetch(`${API_BASE}/admin/invoices?client_id=${clientId}&per_page=100`, {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            const invData  = await invRes.json();
            existingInvoices = (invData.data || []).map((inv: any) => ({
                client_id:      inv.client_id,
                client_plan_id: inv.client_plan_id,
                issue_date:     typeof inv.issue_date === 'string'
                    ? inv.issue_date.substring(0, 10)
                    : String(inv.issue_date),
            }));
        } catch (e) {
            console.error('Error cargando planes del cliente:', e);
        } finally {
            loadingPlans = false;
        }
    }

    // ── Handlers de UI ────────────────────────────────────────────────────────
    function selectClient(client: ClientSummary) {
        form.client_id  = String(client.id);
        clientSearch    = client.name;
        showClientList  = false;
        loadClientPlans(String(client.id));
    }

    function clearClient() {
        form.client_id      = '';
        form.client_plan_id = '';
        form.amount         = '';
        form.description    = '';
        clientSearch        = '';
        selectedClient      = null;
        clientPlans         = [];
        existingInvoices    = [];
    }

    function handlePlanChange() {
        const plan = clientPlans.find(p => p.id === Number(form.client_plan_id));
        if (!plan) return;
        const price = plan.current_price ?? plan.plan?.monthly_price ?? 0;
        form.amount = price;
        if (plan.plan?.name) {
            form.description = defaultDescription(plan.plan.name, form.issue_date);
        }
    }

    function handleAmountInput(e: Event) {
        const v = (e.target as HTMLInputElement).value;
        form.amount = v === '' ? '' : v;
    }

    // ── Navegación entre pasos ────────────────────────────────────────────────
    function goToConfirm() {
        touched = true;
        const result = validateInvoiceForm(form);
        errors = result.errors;
        if (!result.ok) return;
        step = 'confirm';
    }

    function goBack() {
        step = 'form';
    }

    // ── Envío ─────────────────────────────────────────────────────────────────
    async function handleSubmit() {
        submitting  = true;
        submitError = '';
        try {
            const token   = localStorage.getItem('employee_token');
            const payload = buildInvoicePayload(form);
            const res = await fetch(`${API_BASE}/admin/invoices`, {
                method:  'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept:         'application/json',
                    Authorization:  `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                // Config validation error — open the guard modal instead of inline error
                if (res.status === 422 && data.config_url) {
                    configGuardResult = {
                        valid:    false,
                        missing:  data.details ?? {},
                        invalid:  {},
                        messages: [data.error ?? 'Configuración de facturación incompleta'],
                    };
                    configGuardOpen = true;
                    step = 'form';
                    return;
                }
                const msg = data.error || data.message || (data.errors ? JSON.stringify(data.errors) : 'Error desconocido');
                submitError = msg;
                step = 'form';
                return;
            }

            resetForm();
            onCreated?.();
        } catch (e: any) {
            submitError = 'Error de conexión. Verifique su red e intente de nuevo.';
            step = 'form';
        } finally {
            submitting = false;
        }
    }

    function resetForm() {
        const t = todayISO();
        form = {
            client_id: '', client_plan_id: '', issue_date: t, due_date: addDays(t, 15),
            amount: '', tax_rate: DEFAULT_TAX_RATE, status: 'pending', description: '',
        };
        touched = false; errors = []; step = 'form'; submitError = '';
        clientSearch = ''; selectedClient = null; clientPlans = [];
        existingInvoices = []; showClientList = false;
    }

    function handleClose() {
        resetForm();
        onClose?.();
    }

    // Cargar clientes cuando se abre el modal
    $effect(() => {
        if (open) {
            loadClients();
        } else {
            resetForm();
        }
    });

    // ── Clases de campo con error ─────────────────────────────────────────────
    function inputClass(field: keyof InvoiceFormState, extra = '') {
        const hasError = touched && errors.some(e => e.field === field);
        const base = 'w-full rounded-lg border px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 transition-colors bg-neutral-800';
        const ring = hasError
            ? 'border-red-500/70 focus:ring-red-500/30'
            : 'border-neutral-700 focus:ring-blue-500/30 focus:border-blue-500/60';
        return `${base} ${ring} ${extra}`;
    }

    const animation =
        'transition transition-discrete opacity-0 translate-y-4 ' +
        'starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-4 ' +
        'data-[state=open]:opacity-100 data-[state=open]:translate-y-0 duration-200';

    const STATUS_LABELS: Record<string, string> = {
        draft: 'Borrador', pending: 'Pendiente', paid: 'Pagada',
        failed: 'Fallida', cancelled: 'Cancelada',
    };
</script>

<Dialog {open} closeOnEscape closeOnInteractOutside={!submitting} onOpenChange={() => !submitting && handleClose()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-start sm:items-center p-2 sm:p-4 overflow-y-auto">
      <Dialog.Content class={"bg-neutral-950 border border-neutral-800 w-full max-w-2xl shadow-2xl rounded-2xl flex flex-col my-auto " + animation}>

        <!-- ── Header ── -->
        <header class="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-neutral-800 shrink-0">
            <div class="flex items-center gap-3">
                <div class="p-2 rounded-lg bg-blue-500/15 border border-blue-500/20">
                    <Receipt class="size-4 text-blue-400" />
                </div>
                <div>
                    <Dialog.Title class="text-base sm:text-lg font-bold text-white leading-tight">Nueva Factura</Dialog.Title>
                    <p class="text-xs text-neutral-500 mt-0.5">
                        {step === 'form' ? 'Complete los datos del servicio' : 'Revise y confirme la factura'}
                    </p>
                </div>
            </div>
            <Dialog.CloseTrigger
                onclick={handleClose}
                disabled={submitting}
                class="p-2 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-40"
                aria-label="Cerrar"
            >
                <X class="size-5 text-neutral-400" />
            </Dialog.CloseTrigger>
        </header>

        <!-- ── Indicador de pasos ── -->
        <div class="flex items-center gap-2 px-5 sm:px-6 pt-4 pb-2">
            {#each [{ id: 'form', label: 'Datos' }, { id: 'confirm', label: 'Confirmar' }] as s, i}
                <div class="flex items-center gap-2 flex-1">
                    <div class={`size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors
                        ${step === s.id || (s.id === 'form' && step === 'confirm')
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-800 text-neutral-500'}`}>
                        {i + 1}
                    </div>
                    <span class={`text-xs hidden sm:block ${step === s.id ? 'text-white font-medium' : 'text-neutral-500'}`}>
                        {s.label}
                    </span>
                    {#if i < 1}
                        <div class="flex-1 h-px bg-neutral-800 mx-1"></div>
                    {/if}
                </div>
            {/each}
        </div>

        <!-- ── Alerta de error general ── -->
        {#if submitError}
            <div class="mx-5 sm:mx-6 mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle class="size-4 text-red-400 mt-0.5 shrink-0" />
                <p class="text-sm text-red-400">{submitError}</p>
            </div>
        {/if}

        <!-- ═══════════════════════════ PASO 1: FORMULARIO ═══════════════════ -->
        {#if step === 'form'}
        <div class="overflow-y-auto px-5 sm:px-6 py-4 space-y-6 max-h-[calc(100vh-220px)] sm:max-h-[60vh]">

            <!-- Sección 1: Cliente -->
            <section>
                <h3 class="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                    <User class="size-3.5" />
                    Información del cliente
                </h3>

                <!-- Autocomplete de clientes -->
                <div class="space-y-1 mb-3 relative">
                    <label for="client-search" class="block text-sm font-medium text-neutral-300">
                        Cliente <span class="text-red-400">*</span>
                    </label>

                    {#if selectedClient}
                        <!-- Cliente seleccionado: muestra tarjeta -->
                        <div class="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/25">
                            <div>
                                <div class="text-sm font-semibold text-white">{selectedClient.name}</div>
                                <div class="text-xs text-neutral-400">
                                    DNI: {selectedClient.dni}
                                    {#if selectedClient.email} · {selectedClient.email}{/if}
                                </div>
                            </div>
                            <button
                                type="button"
                                onclick={clearClient}
                                class="p-1.5 rounded-md hover:bg-neutral-700 transition-colors"
                                aria-label="Cambiar cliente"
                            >
                                <X class="size-4 text-neutral-400" />
                            </button>
                        </div>
                    {:else}
                        <!-- Campo de búsqueda -->
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none" />
                            <input
                                id="client-search"
                                type="text"
                                bind:value={clientSearch}
                                oninput={() => { showClientList = true; }}
                                onfocus={() => { showClientList = true; }}
                                placeholder={loadingClients ? 'Cargando clientes...' : 'Buscar por nombre, DNI o email...'}
                                disabled={loadingClients}
                                class="{inputClass('client_id', 'pl-9 pr-4')} disabled:opacity-50"
                                autocomplete="off"
                            />
                            {#if loadingClients}
                                <Loader2 class="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 animate-spin" />
                            {/if}
                        </div>

                        <!-- Dropdown de resultados -->
                        {#if showClientList && clientSearch.length > 0}
                            <div class="absolute z-20 left-0 right-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden">
                                {#if filteredClients.length === 0}
                                    <div class="px-4 py-3 text-sm text-neutral-500 text-center">
                                        No se encontraron clientes con "{clientSearch}"
                                    </div>
                                {:else}
                                    <ul class="max-h-48 overflow-y-auto divide-y divide-neutral-800">
                                        {#each filteredClients as client}
                                            <li>
                                                <button
                                                    type="button"
                                                    onclick={() => selectClient(client)}
                                                    class="w-full text-left px-4 py-2.5 hover:bg-neutral-800 transition-colors"
                                                >
                                                    <div class="text-sm font-medium text-white">{client.name}</div>
                                                    <div class="text-xs text-neutral-500">
                                                        DNI: {client.dni}
                                                        {#if client.email} · {client.email}{/if}
                                                    </div>
                                                </button>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                        {/if}
                    {/if}

                    {#if fieldError('client_id')}
                        <p class="text-xs text-red-400 flex items-center gap-1 mt-1">
                            <AlertTriangle class="size-3 shrink-0" />{fieldError('client_id')}
                        </p>
                    {/if}
                </div>

                <!-- Plan contratado -->
                <div class="space-y-1">
                    <label for="client_plan" class="block text-sm font-medium text-neutral-300">
                        Plan contratado <span class="text-red-400">*</span>
                    </label>
                    <div class="relative">
                        <select
                            id="client_plan"
                            bind:value={form.client_plan_id}
                            onchange={handlePlanChange}
                            disabled={!form.client_id || loadingPlans}
                            class="{inputClass('client_plan_id', 'pr-9 appearance-none')} disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <option value="">
                                {!form.client_id
                                    ? 'Seleccione primero un cliente'
                                    : loadingPlans
                                        ? 'Cargando planes...'
                                        : clientPlans.length === 0
                                            ? 'Este cliente no tiene planes activos'
                                            : 'Seleccione un plan'}
                            </option>
                            {#each clientPlans as cp}
                                <option value={cp.id}>
                                    {cp.plan?.name || 'Plan'}
                                    {#if cp.ip_address} · {cp.ip_address}{/if}
                                    {#if cp.current_price} — ${Number(cp.current_price).toFixed(2)}{/if}
                                </option>
                            {/each}
                        </select>
                        <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none" />
                        {#if loadingPlans}
                            <Loader2 class="absolute right-8 top-1/2 -translate-y-1/2 size-4 text-neutral-500 animate-spin" />
                        {/if}
                    </div>
                    {#if fieldError('client_plan_id')}
                        <p class="text-xs text-red-400 flex items-center gap-1">
                            <AlertTriangle class="size-3 shrink-0" />{fieldError('client_plan_id')}
                        </p>
                    {/if}
                </div>
            </section>

            <!-- Sección 2: Fechas y estado -->
            <section>
                <h3 class="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                    <Calendar class="size-3.5" />
                    Fechas y estado
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div class="space-y-1">
                        <label for="issue_date" class="block text-sm font-medium text-neutral-300">
                            Emisión <span class="text-red-400">*</span>
                        </label>
                        <input
                            id="issue_date"
                            type="date"
                            bind:value={form.issue_date}
                            class={inputClass('issue_date')}
                        />
                        {#if fieldError('issue_date')}
                            <p class="text-xs text-red-400 flex items-center gap-1">
                                <AlertTriangle class="size-3 shrink-0" />{fieldError('issue_date')}
                            </p>
                        {/if}
                    </div>
                    <div class="space-y-1">
                        <label for="due_date" class="block text-sm font-medium text-neutral-300">
                            Vencimiento <span class="text-red-400">*</span>
                        </label>
                        <input
                            id="due_date"
                            type="date"
                            bind:value={form.due_date}
                            min={form.issue_date}
                            class={inputClass('due_date')}
                        />
                        {#if fieldError('due_date')}
                            <p class="text-xs text-red-400 flex items-center gap-1">
                                <AlertTriangle class="size-3 shrink-0" />{fieldError('due_date')}
                            </p>
                        {/if}
                    </div>
                    <div class="space-y-1">
                        <label for="status" class="block text-sm font-medium text-neutral-300">Estado</label>
                        <div class="relative">
                            <select
                                id="status"
                                bind:value={form.status}
                                class="{inputClass('status', 'pr-9 appearance-none')}"
                            >
                                {#each Object.entries(STATUS_LABELS) as [value, label]}
                                    <option {value}>{label}</option>
                                {/each}
                            </select>
                            <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </section>

            <!-- Sección 3: Montos -->
            <section>
                <h3 class="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                    <DollarSign class="size-3.5" />
                    Detalles del servicio
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <!-- Monto base -->
                    <div class="space-y-1">
                        <label for="amount" class="block text-sm font-medium text-neutral-300">
                            Monto base <span class="text-red-400">*</span>
                        </label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">$</span>
                            <input
                                id="amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="9999999.99"
                                value={form.amount}
                                oninput={handleAmountInput}
                                placeholder="0.00"
                                class="{inputClass('amount', 'pl-7')}"
                            />
                        </div>
                        {#if fieldError('amount')}
                            <p class="text-xs text-red-400 flex items-center gap-1">
                                <AlertTriangle class="size-3 shrink-0" />{fieldError('amount')}
                            </p>
                        {/if}
                    </div>

                    <!-- Tasa de impuesto -->
                    <div class="space-y-1">
                        <label for="tax_rate" class="block text-sm font-medium text-neutral-300">
                            Tasa de impuesto
                        </label>
                        <div class="relative">
                            <BadgePercent class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none" />
                            <select
                                id="tax_rate"
                                bind:value={form.tax_rate}
                                class="{inputClass('tax_rate', 'pl-9 pr-9 appearance-none')}"
                            >
                                {#each TAX_RATES as rate}
                                    <option value={rate}>{rate} %</option>
                                {/each}
                            </select>
                            <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-neutral-500 pointer-events-none" />
                        </div>
                    </div>
                </div>

                <!-- Descripción -->
                <div class="space-y-1">
                    <label for="description" class="block text-sm font-medium text-neutral-300">
                        Descripción
                        <span class="text-neutral-500 font-normal text-xs ml-1">(opcional)</span>
                    </label>
                    <div class="relative">
                        <FileText class="absolute left-3 top-3 size-4 text-neutral-500 pointer-events-none" />
                        <textarea
                            id="description"
                            bind:value={form.description}
                            rows="2"
                            maxlength="500"
                            placeholder="Descripción del servicio facturado..."
                            class="{inputClass('description', 'pl-9 resize-none')}"
                        ></textarea>
                    </div>
                    <div class="flex justify-between items-center">
                        {#if fieldError('description')}
                            <p class="text-xs text-red-400 flex items-center gap-1">
                                <AlertTriangle class="size-3 shrink-0" />{fieldError('description')}
                            </p>
                        {:else}
                            <div></div>
                        {/if}
                        <span class="text-xs text-neutral-600">{form.description.length}/500</span>
                    </div>
                </div>
            </section>

            <!-- Sección 4: Resumen de totales en tiempo real -->
            <section class="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-2">
                <h3 class="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                    <Receipt class="size-3.5" />
                    Resumen de totales
                </h3>
                <div class="flex justify-between text-sm text-neutral-400">
                    <span>Subtotal</span>
                    <span class="tabular-nums">${totals.amount.toFixed(2)}</span>
                </div>
                <div class="flex justify-between text-sm text-neutral-400">
                    <span>Impuesto ({form.tax_rate} %)</span>
                    <span class="tabular-nums">${totals.tax_amount.toFixed(2)}</span>
                </div>
                <div class="border-t border-neutral-700 pt-2 flex justify-between font-bold text-white text-base">
                    <span>Total a facturar</span>
                    <span class="tabular-nums text-blue-400">${totals.total_amount.toFixed(2)}</span>
                </div>
            </section>

            <!-- Advertencia de posible duplicado -->
            {#if isDuplicate}
                <div class="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/25">
                    <AlertTriangle class="size-4 text-yellow-400 mt-0.5 shrink-0" />
                    <div>
                        <p class="text-sm font-medium text-yellow-300">Posible factura duplicada</p>
                        <p class="text-xs text-yellow-400/80 mt-0.5">
                            Ya existe una factura para este cliente y plan en el mismo mes. Verifique antes de continuar.
                        </p>
                    </div>
                </div>
            {/if}

        </div>

        <!-- Footer paso 1 -->
        <footer class="px-5 sm:px-6 py-4 border-t border-neutral-800 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
            <button
                type="button"
                onclick={handleClose}
                class="px-4 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors text-sm font-medium"
            >
                Cancelar
            </button>
            <button
                type="button"
                onclick={goToConfirm}
                class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-semibold"
            >
                Revisar y confirmar
                <ChevronDown class="size-4 -rotate-90" />
            </button>
        </footer>

        <!-- ═══════════════════════════ PASO 2: CONFIRMACIÓN ═════════════════ -->
        {:else}
        <div class="overflow-y-auto px-5 sm:px-6 py-4 space-y-4 max-h-[calc(100vh-220px)] sm:max-h-[60vh]">

            <p class="text-sm text-neutral-400">
                Revise los datos antes de crear la factura. Una vez creada quedará registrada en el sistema.
            </p>

            <!-- Resumen de confirmación -->
            <div class="rounded-xl border border-neutral-800 overflow-hidden divide-y divide-neutral-800">

                <!-- Cliente y plan -->
                <div class="p-4 bg-neutral-900/50">
                    <div class="text-xs text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <User class="size-3" /> Cliente y plan
                    </div>
                    <div class="text-white font-semibold">{selectedClient?.name || '—'}</div>
                    <div class="text-sm text-neutral-400 mt-0.5">
                        {clientPlans.find(p => p.id === Number(form.client_plan_id))?.plan?.name || '—'}
                    </div>
                </div>

                <!-- Fechas -->
                <div class="p-4 grid grid-cols-2 gap-4 bg-neutral-900/30">
                    <div>
                        <div class="text-xs text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Calendar class="size-3" /> Emisión
                        </div>
                        <div class="text-sm font-medium text-white">{form.issue_date}</div>
                    </div>
                    <div>
                        <div class="text-xs text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Clock class="size-3" /> Vencimiento
                        </div>
                        <div class="text-sm font-medium text-white">{form.due_date}</div>
                    </div>
                </div>

                <!-- Descripción -->
                {#if form.description}
                    <div class="p-4 bg-neutral-900/20">
                        <div class="text-xs text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <FileText class="size-3" /> Descripción
                        </div>
                        <div class="text-sm text-neutral-300">{form.description}</div>
                    </div>
                {/if}

                <!-- Totales -->
                <div class="p-4 space-y-2">
                    <div class="flex justify-between text-sm text-neutral-400">
                        <span>Subtotal</span>
                        <span class="tabular-nums">${totals.amount.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between text-sm text-neutral-400">
                        <span>Impuesto ({form.tax_rate} %)</span>
                        <span class="tabular-nums">${totals.tax_amount.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between font-bold text-white text-base pt-1 border-t border-neutral-700">
                        <span>Total</span>
                        <span class="tabular-nums text-green-400">${totals.total_amount.toFixed(2)}</span>
                    </div>
                </div>

                <!-- Estado -->
                <div class="px-4 py-3 bg-neutral-900/30 flex items-center justify-between">
                    <span class="text-xs text-neutral-500 uppercase tracking-wider">Estado inicial</span>
                    <span class="text-sm font-medium text-white">{STATUS_LABELS[form.status]}</span>
                </div>
            </div>

            <!-- Re-advertencia de duplicado en confirmación -->
            {#if isDuplicate}
                <div class="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/25">
                    <AlertTriangle class="size-4 text-yellow-400 mt-0.5 shrink-0" />
                    <p class="text-sm text-yellow-300">
                        Advertencia: Ya existe una factura para este cliente y plan en el mismo mes.
                        Al confirmar se creará de todas formas.
                    </p>
                </div>
            {/if}

            <div class="flex items-start gap-2 p-3 rounded-lg bg-neutral-800/60 border border-neutral-700">
                <Info class="size-4 text-neutral-400 mt-0.5 shrink-0" />
                <p class="text-xs text-neutral-400">
                    El número de factura se generará automáticamente al guardar.
                </p>
            </div>
        </div>

        <!-- Footer paso 2 -->
        <footer class="px-5 sm:px-6 py-4 border-t border-neutral-800 flex flex-col sm:flex-row justify-between gap-3 shrink-0">
            <button
                type="button"
                onclick={goBack}
                disabled={submitting}
                class="px-4 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors text-sm font-medium disabled:opacity-50 order-2 sm:order-1"
            >
                Volver a editar
            </button>
            <button
                type="button"
                onclick={handleSubmit}
                disabled={submitting}
                class="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
            >
                {#if submitting}
                    <Loader2 class="size-4 animate-spin" />
                    Creando factura...
                {:else}
                    <CheckCircle2 class="size-4" />
                    Crear factura
                {/if}
            </button>
        </footer>
        {/if}

      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>

<ModalConfigGuard
    bind:open={configGuardOpen}
    result={configGuardResult}
    onClose={() => { configGuardOpen = false; }}
/>
