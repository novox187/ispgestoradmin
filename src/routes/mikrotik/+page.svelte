<script lang="ts">
  import Encabezado from "$lib/components/Encabezado.svelte";
  import MikroTikActionCard from "$lib/components/mikrotik/MikroTikActionCard.svelte";
  import { API_BASE } from "$lib/config";
  import { toast } from 'svelte-sonner';

  let isSidebarOpen = $state(false);
  let isNotificationsOpen = $state(false);
  function toggleSidebar() { isSidebarOpen = !isSidebarOpen }
  function toggleNotifications() { isNotificationsOpen = !isNotificationsOpen }

  let useAsync = $state(false);

  function handleNotify({ type, message }: { type: 'success' | 'error' | 'info', message: string }) {
    toast[type](message);
  }

  function validateSync() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return 'No hay conexión a internet. Verifica tu red.';
    }
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
    if (!token) {
      return 'Tu sesión expiró. Inicia sesión nuevamente.';
    }
    return null;
  }

  async function syncQueues() {
    const token = (typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null);
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/mikrotik/sync/queues/cleanup`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ async: useAsync })
    });
    let payload: any = null;
    try { payload = await res.json(); } catch {}
    if (!res.ok) {
      return { ok: false, message: payload?.message || `Error ${res.status}` };
    }
    const msg = payload?.message || (useAsync ? 'Sincronización en cola.' : 'Sincronización completada.');
    return { ok: true, message: msg };
  }
</script>

<main class="flex-1 overflow-y-auto bg-[#0f0f0f] text-gray-100">
  <Encabezado {toggleSidebar} {toggleNotifications} />

  <div class="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
    <div class="space-y-1">
      <h2 class="text-2xl md:text-3xl font-semibold tracking-tight">MikroTik</h2>
      <p class="text-sm text-gray-400 leading-relaxed">Sincroniza planes y clientes con una acción segura y controlada.</p>
    </div>

    <div class="grid grid-cols-1 gap-4">
      <MikroTikActionCard
        title="Sincronizar MikroTik con planes y clientes"
        description="Actualiza colas padre e hijas en MikroTik usando los planes activos y clientes con IP válida."
        actionLabel="Sincronizar ahora"
        modalTitle="Confirmar sincronización con limpieza"
        modalMessage="Se crearán o actualizarán colas de planes y clientes, y se eliminarán colas huérfanas."
        modalSecondaryMessage="Esta acción afecta la configuración de /queue/simple en el Router."
        modalDetailsTitle="Elementos afectados"
        modalDetailsItems={[
          'Colas padre asociadas a planes activos',
          'Colas hijas de clientes activos con IP válida',
          'Colas huérfanas que ya no existan en la base de datos'
        ]}
        confirmText="Confirmar sincronización"
        cancelText="Cancelar"
        modalType="warning"
        validate={validateSync}
        onAction={syncQueues}
        onNotify={handleNotify}
      >
      </MikroTikActionCard>
    </div>
  </div>

</main>
