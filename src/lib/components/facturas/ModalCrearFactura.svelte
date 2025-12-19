<script lang="ts">
    import { API_BASE } from '$lib/config';
    import { X } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';

    let { open, onClose, onCreated } = $props();

    interface Client {
        id: number;
        name: string;
        dni: string;
    }

    interface Plan {
        id: number;
        name: string;
        price: number;
    }

    interface ClientPlan {
        id: number;
        plan?: Plan;
        ip_address?: string;
        price?: number;
    }

    let loading = $state(false);
    let clients = $state<Client[]>([]);
    let clientPlans = $state<ClientPlan[]>([]);
    
    let form = $state({
        client_id: '',
        client_plan_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: '',
        amount: 0,
        tax_amount: 0,
        status: 'pending',
        description: ''
    });

    // Cargar clientes al abrir (simple search o load all - cuidado con rendimiento si son muchos)
    // Para simplificar cargamos summary
    async function loadClients() {
        try {
            const token = localStorage.getItem('employee_token');
            const res = await fetch(`${API_BASE}/admin/clientes/summary`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            clients = Array.isArray(data.data) ? data.data : data;
        } catch(e) { console.error(e); }
    }

    // Al seleccionar cliente, cargar sus planes
    async function handleClientChange() {
        if (!form.client_id) return;
        try {
            // Aquí idealmente deberíamos tener un endpoint para obtener los planes de un cliente específico
            // Como no lo tenemos a mano, simularemos o asumiremos que el backend lo provee
            // TODO: Crear endpoint getClientPlans($clientId) en backend si no existe
            // Por ahora usaré el endpoint de planes generales para poblar, pero esto es incorrecto lógicamente.
            // Corrección: Usaré el endpoint de clientes full para sacar los planes
             const token = localStorage.getItem('employee_token');
             const res = await fetch(`${API_BASE}/admin/clientes/full/${form.client_id}`, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             const data = await res.json();
             // Asumiendo que data.client_plans existe
             clientPlans = data.client_plans || [];
        } catch(e) { console.error(e); }
    }

    // Al seleccionar plan, pre-llenar monto
    function handlePlanChange() {
        const plan = clientPlans.find(p => p.id == Number(form.client_plan_id));
        if (plan) {
            form.amount = plan.price || plan.plan?.price || 0; // Ajustar según estructura
        }
    }

    $effect(() => {
        if (open) loadClients();
    });

    async function handleSubmit() {
        loading = true;
        try {
            const token = localStorage.getItem('employee_token');
            const res = await fetch(`${API_BASE}/admin/invoices`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify(form)
            });
            
            if (res.ok) {
                onCreated();
            } else {
                const err = await res.json();
                alert('Error: ' + (err.message || JSON.stringify(err)));
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
        } finally {
            loading = false;
        }
    }

    const animation = 'transition transition-discrete opacity-0 translate-y-[80px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[80px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';

</script>

<Dialog {open} closeOnEscape closeOnInteractOutside onOpenChange={() => onClose?.()}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class={"card bg-surface-100-900 w-full max-w-2xl p-6 shadow-xl rounded-2xl " + animation}>
        <header class="flex justify-between items-center mb-6">
          <Dialog.Title class="text-xl font-bold text-white">Nueva Factura</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal" onclick={() => onClose?.()}>
            <X class="size-6 text-gray-400 hover:text-white" />
          </Dialog.CloseTrigger>
        </header>

        <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1" for="client_id">Cliente</label>
                    <select id="client_id" bind:value={form.client_id} onchange={handleClientChange} required class="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none">
                        <option value="">Seleccionar Cliente</option>
                        {#each clients as client}
                            <option value={client.id}>{client.name} - {client.dni}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1" for="client_plan_id">Plan Contratado</label>
                    <select id="client_plan_id" bind:value={form.client_plan_id} onchange={handlePlanChange} required class="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none">
                        <option value="">Seleccionar Plan</option>
                        {#each clientPlans as cp}
                            <option value={cp.id}>{cp.plan?.name || 'Plan'} ({cp.ip_address || 'Sin IP'})</option>
                        {/each}
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1" for="issue_date">Fecha Emisión</label>
                    <input id="issue_date" type="date" bind:value={form.issue_date} required class="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1" for="due_date">Fecha Vencimiento</label>
                    <input id="due_date" type="date" bind:value={form.due_date} required class="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none" />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1" for="amount">Monto</label>
                    <input id="amount" type="number" step="0.01" bind:value={form.amount} required class="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1" for="tax_amount">Impuestos</label>
                    <input id="tax_amount" type="number" step="0.01" bind:value={form.tax_amount} class="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1" for="status">Estado</label>
                    <select id="status" bind:value={form.status} class="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none">
                        <option value="draft">Borrador</option>
                        <option value="pending">Pendiente</option>
                        <option value="paid">Pagada</option>
                    </select>
                </div>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1" for="description">Descripción</label>
                <textarea id="description" bind:value={form.description} rows="3" class="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-white focus:border-blue-500 focus:outline-none"></textarea>
            </div>

            <div class="flex justify-end gap-3 mt-6">
                <button type="button" onclick={onClose} class="px-4 py-2 rounded-lg bg-neutral-800 text-gray-300 hover:bg-neutral-700">Cancelar</button>
                <button type="submit" disabled={loading} class="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50">
                    {loading ? 'Guardando...' : 'Crear Factura'}
                </button>
            </div>
        </form>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
