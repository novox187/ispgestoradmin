<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { toast } from 'svelte-sonner';
  import {
    ShieldCheck,
    Plus,
    Search,
    Download,
    History,
    Trash2,
    Pencil,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Clock,
    X,
    ChevronDown,
    User,
  } from '@lucide/svelte';

  import { API_BASE } from '$lib/config';
  import {
    listWhitelist,
    addClientToWhitelist,
    removeFromWhitelist,
    updateWhitelistEntry,
    listWhitelistHistory,
    downloadWhitelistCsv,
  } from '$lib/api/whitelist';
  import type { WhitelistEntry, WhitelistHistoryEntry } from '$lib/types/whitelist';

  interface ClientOption {
    id: number;
    name: string;
    document_id: string;
    email: string;
    status: string;
  }

  // ── Estado principal ──────────────────────────────────────────────────────
  let entries = $state<WhitelistEntry[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchTerm = $state('');
  let statusFilter = $state<'active' | 'inactive' | 'all'>('active');

  // ── Modal Crear / Editar ──────────────────────────────────────────────────
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let editingEntry = $state<WhitelistEntry | null>(null);
  let formClientId = $state<string>('');
  let formReason = $state('');
  let formExpiresAt = $state<string>('');
  let submitting = $state(false);

  // ── Combobox de clientes ──────────────────────────────────────────────────
  let clientSearch = $state('');
  let clientResults = $state<ClientOption[]>([]);
  let clientsLoading = $state(false);
  let clientPickerOpen = $state(false);
  let selectedClient = $state<ClientOption | null>(null);
  let clientHighlight = $state(0);
  let clientSearchInput = $state<HTMLInputElement | null>(null);
  let clientFetchToken = 0;
  let clientFetchTimer: ReturnType<typeof setTimeout> | null = null;

  async function fetchClients(term: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('employee_token') : null;
    const myToken = ++clientFetchToken;
    clientsLoading = true;
    try {
      const qs = new URLSearchParams({ per_page: '25' });
      if (term.trim()) qs.set('search', term.trim());
      const res = await fetch(`${API_BASE}/admin/clientes/summary?${qs.toString()}`, {
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      // Solo aplicar el resultado si es el fetch más reciente
      if (myToken !== clientFetchToken) return;
      const raw = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      clientResults = raw.map((c: any) => ({
        id: Number(c.id),
        name: c.name || c.full_name || '(sin nombre)',
        document_id: c.document_id || c.dni || '',
        email: c.email || '',
        status: c.status || c.service_status || '',
      }));
      clientHighlight = 0;
    } catch (e: any) {
      if (myToken === clientFetchToken) {
        clientResults = [];
        toast.error(e.message || 'Error cargando clientes');
      }
    } finally {
      if (myToken === clientFetchToken) {
        clientsLoading = false;
      }
    }
  }

  function scheduleClientFetch(term: string) {
    if (clientFetchTimer) clearTimeout(clientFetchTimer);
    clientFetchTimer = setTimeout(() => fetchClients(term), 220);
  }

  async function openClientPicker() {
    clientPickerOpen = true;
    if (clientResults.length === 0) {
      await fetchClients(clientSearch);
    }
    await tick();
    clientSearchInput?.focus();
  }

  function pickClient(c: ClientOption) {
    selectedClient = c;
    formClientId = String(c.id);
    clientPickerOpen = false;
    clientSearch = '';
  }

  function clearSelectedClient() {
    selectedClient = null;
    formClientId = '';
  }

  function onClientSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      clientHighlight = Math.min(clientHighlight + 1, clientResults.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      clientHighlight = Math.max(clientHighlight - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = clientResults[clientHighlight];
      if (c) pickClient(c);
    } else if (e.key === 'Escape') {
      clientPickerOpen = false;
    }
  }

  function statusBadgeColor(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'ACTIVE' || s === 'ACTIVO') return 'bg-success-500/15 text-success-400';
    if (s === 'SUSPENDED' || s === 'SUSPENDIDO') return 'bg-danger-500/15 text-danger-400';
    if (s === 'LIMITED' || s === 'LIMITADO') return 'bg-warning-500/15 text-warning-400';
    return 'bg-neutral-800 text-neutral-500';
  }

  // ── Modal eliminar ────────────────────────────────────────────────────────
  let showRemoveModal = $state(false);
  let removingEntry = $state<WhitelistEntry | null>(null);
  let removeReason = $state('');

  // ── Historial ─────────────────────────────────────────────────────────────
  let showHistoryModal = $state(false);
  let historyEntries = $state<WhitelistHistoryEntry[]>([]);
  let historyLoading = $state(false);
  let historyClientId = $state<number | null>(null);

  async function loadEntries() {
    loading = true;
    error = null;
    try {
      entries = await listWhitelist({ search: searchTerm.trim(), status: statusFilter });
    } catch (e: any) {
      const msg = e.message || 'Error al cargar la lista blanca';
      error = msg;
      toast.error(msg);
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    formClientId = '';
    formReason = '';
    formExpiresAt = '';
    editingEntry = null;
    selectedClient = null;
    clientSearch = '';
    clientResults = [];
    clientPickerOpen = false;
  }

  function openAddModal() {
    resetForm();
    showAddModal = true;
  }

  function openEditModal(entry: WhitelistEntry) {
    editingEntry = entry;
    formClientId = String(entry.client_id);
    formReason = entry.reason;
    formExpiresAt = entry.expires_at ? entry.expires_at.slice(0, 16) : '';
    showEditModal = true;
  }

  function openRemoveModal(entry: WhitelistEntry) {
    removingEntry = entry;
    removeReason = '';
    showRemoveModal = true;
  }

  async function handleAddSubmit() {
    if (!formClientId || !formReason.trim()) {
      toast.error('El cliente y el motivo son obligatorios.');
      return;
    }
    if (formReason.trim().length < 5) {
      toast.error('El motivo debe tener al menos 5 caracteres.');
      return;
    }
    submitting = true;
    try {
      await addClientToWhitelist({
        client_id: Number(formClientId),
        reason: formReason.trim(),
        expires_at: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
      });
      toast.success('Cliente agregado a la lista blanca.');
      showAddModal = false;
      resetForm();
      await loadEntries();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo agregar el cliente.');
    } finally {
      submitting = false;
    }
  }

  async function handleEditSubmit() {
    if (!editingEntry) return;
    if (formReason.trim().length < 5) {
      toast.error('El motivo debe tener al menos 5 caracteres.');
      return;
    }
    submitting = true;
    try {
      await updateWhitelistEntry(editingEntry.id, {
        reason: formReason.trim(),
        expires_at: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
      });
      toast.success('Inclusión actualizada.');
      showEditModal = false;
      resetForm();
      await loadEntries();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo actualizar.');
    } finally {
      submitting = false;
    }
  }

  async function handleRemoveSubmit() {
    if (!removingEntry) return;
    submitting = true;
    try {
      await removeFromWhitelist(removingEntry.id, removeReason.trim() || undefined);
      toast.success('Cliente retirado de la lista blanca.');
      showRemoveModal = false;
      removingEntry = null;
      await loadEntries();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo retirar al cliente.');
    } finally {
      submitting = false;
    }
  }

  async function openHistory(clientId: number | null = null) {
    historyClientId = clientId;
    historyLoading = true;
    showHistoryModal = true;
    try {
      historyEntries = await listWhitelistHistory(clientId ?? undefined);
    } catch (e: any) {
      toast.error(e.message || 'Error cargando historial');
    } finally {
      historyLoading = false;
    }
  }

  async function exportCsv() {
    try {
      await downloadWhitelistCsv(statusFilter);
      toast.success('CSV descargado.');
    } catch (e: any) {
      toast.error(e.message || 'Error al exportar CSV');
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return 'Permanente';
    try {
      return new Date(iso).toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  }

  function operationLabel(op: string): string {
    switch (op) {
      case 'WHITELIST_ADD': return 'Inclusión';
      case 'WHITELIST_REMOVE': return 'Baja';
      case 'WHITELIST_UPDATE': return 'Actualización';
      case 'SUSPEND_BLOCKED_WHITELIST': return 'Suspensión bloqueada';
      default: return op;
    }
  }

  function operationColor(op: string): string {
    switch (op) {
      case 'WHITELIST_ADD': return 'bg-success-500/15 text-success-400 border-success-500/30';
      case 'WHITELIST_REMOVE': return 'bg-danger-500/15 text-danger-400 border-danger-500/30';
      case 'WHITELIST_UPDATE': return 'bg-warning-500/15 text-warning-400 border-warning-500/30';
      case 'SUSPEND_BLOCKED_WHITELIST': return 'bg-primary-500/15 text-primary-400 border-primary-500/30';
      default: return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  }

  let debounceId: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    searchTerm;
    statusFilter;
    if (debounceId) clearTimeout(debounceId);
    debounceId = setTimeout(loadEntries, 250);
  });

  onMount(loadEntries);
</script>

<div class="px-4 md:px-8 py-8 max-w-7xl">
  <!-- Header -->
  <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
    <div>
      <div class="flex items-center gap-2.5 mb-2">
        <ShieldCheck class="w-5 h-5 text-primary-400" />
        <h2 class="text-lg font-semibold text-neutral-100">Lista Blanca de Clientes</h2>
      </div>
      <p class="text-sm text-neutral-500 max-w-2xl">
        Los clientes incluidos quedan exentos de la suspensión automática por facturas vencidas.
        Toda operación se registra en auditoría. Solo super admin puede gestionar la lista.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="px-3 py-2 text-sm rounded-lg border border-neutral-800 bg-surface-elevated text-neutral-300 hover:bg-surface-overlay flex items-center gap-2"
        onclick={() => openHistory(null)}
      >
        <History class="w-4 h-4" />
        Historial
      </button>
      <button
        class="px-3 py-2 text-sm rounded-lg border border-neutral-800 bg-surface-elevated text-neutral-300 hover:bg-surface-overlay flex items-center gap-2"
        onclick={exportCsv}
      >
        <Download class="w-4 h-4" />
        Exportar CSV
      </button>
      <button
        class="px-3 py-2 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600 flex items-center gap-2"
        onclick={openAddModal}
      >
        <Plus class="w-4 h-4" />
        Agregar cliente
      </button>
    </div>
  </div>

  <!-- Filtros -->
  <div class="flex items-center gap-3 mb-4 flex-wrap">
    <div class="relative flex-1 min-w-[260px]">
      <Search class="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        bind:value={searchTerm}
        placeholder="Buscar por nombre, documento o email..."
        class="w-full pl-9 pr-3 py-2 text-sm bg-surface-elevated border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-primary-500/50"
      />
    </div>
    <select
      bind:value={statusFilter}
      class="px-3 py-2 text-sm bg-surface-elevated border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-primary-500/50"
    >
      <option value="active">Activas</option>
      <option value="inactive">Inactivas / Vencidas</option>
      <option value="all">Todas</option>
    </select>
  </div>

  <!-- Tabla -->
  <div class="rounded-xl border border-neutral-800/70 bg-surface-elevated overflow-hidden">
    {#if loading}
      <div class="p-12 flex items-center justify-center text-neutral-500">
        <Loader2 class="w-5 h-5 animate-spin mr-2" />
        Cargando lista blanca...
      </div>
    {:else if error}
      <div class="p-8 flex items-center gap-3 text-danger-400">
        <AlertCircle class="w-5 h-5" />
        {error}
      </div>
    {:else if entries.length === 0}
      <div class="p-12 text-center">
        <ShieldCheck class="w-10 h-10 text-neutral-700 mx-auto mb-3" />
        <p class="text-sm text-neutral-500">No hay clientes en la lista blanca con los filtros aplicados.</p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-neutral-900/40 border-b border-neutral-800">
            <tr class="text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <th class="px-4 py-3 font-medium">Cliente</th>
              <th class="px-4 py-3 font-medium">Motivo</th>
              <th class="px-4 py-3 font-medium">Autorizado por</th>
              <th class="px-4 py-3 font-medium">Incorporado</th>
              <th class="px-4 py-3 font-medium">Vence</th>
              <th class="px-4 py-3 font-medium">Estado</th>
              <th class="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/50">
            {#each entries as entry (entry.id)}
              <tr class="hover:bg-neutral-900/30">
                <td class="px-4 py-3">
                  <div class="font-medium text-neutral-200">{entry.client?.full_name ?? `Cliente #${entry.client_id}`}</div>
                  <div class="text-[11px] text-neutral-500 font-mono">{entry.client?.document_id ?? '—'}</div>
                </td>
                <td class="px-4 py-3 text-neutral-400 max-w-xs">
                  <p class="line-clamp-2">{entry.reason}</p>
                </td>
                <td class="px-4 py-3 text-neutral-400">
                  {entry.authorizer?.nombre ?? 'Sistema'}
                </td>
                <td class="px-4 py-3 text-neutral-500 text-[12px]">
                  {formatDate(entry.added_at)}
                </td>
                <td class="px-4 py-3 text-neutral-500 text-[12px]">
                  {#if entry.expires_at}
                    <span class="inline-flex items-center gap-1">
                      <Clock class="w-3 h-3" />
                      {formatDate(entry.expires_at)}
                    </span>
                  {:else}
                    <span class="text-success-400">Permanente</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  {#if entry.is_valid}
                    <span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-success-500/15 text-success-400 border-success-500/30">
                      <CheckCircle2 class="w-3 h-3" />
                      Vigente
                    </span>
                  {:else}
                    <span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-neutral-800 text-neutral-500 border-neutral-700">
                      Inactiva
                    </span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="inline-flex items-center gap-1">
                    <button
                      class="p-1.5 rounded-md text-neutral-500 hover:text-primary-400 hover:bg-primary-500/10"
                      title="Ver historial del cliente"
                      onclick={() => openHistory(entry.client_id)}
                    >
                      <History class="w-4 h-4" />
                    </button>
                    {#if entry.is_valid}
                      <button
                        class="p-1.5 rounded-md text-neutral-500 hover:text-warning-400 hover:bg-warning-500/10"
                        title="Editar"
                        onclick={() => openEditModal(entry)}
                      >
                        <Pencil class="w-4 h-4" />
                      </button>
                      <button
                        class="p-1.5 rounded-md text-neutral-500 hover:text-danger-400 hover:bg-danger-500/10"
                        title="Retirar de la lista"
                        onclick={() => openRemoveModal(entry)}
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- Modal: Agregar -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-surface-elevated border border-neutral-800 rounded-xl shadow-xl">
      <div class="flex items-center justify-between p-5 border-b border-neutral-800">
        <h3 class="text-base font-semibold text-neutral-100">Agregar cliente a la lista blanca</h3>
        <button
          class="p-1 rounded-md text-neutral-500 hover:text-neutral-300"
          onclick={() => { showAddModal = false; resetForm(); }}
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="p-5 space-y-4">
        <div>
          <label class="block text-xs font-medium text-neutral-400 mb-1.5">Cliente *</label>

          {#if !clientPickerOpen}
            <!-- Trigger: muestra el cliente seleccionado o el botón "elegir cliente" -->
            {#if selectedClient}
              <div class="w-full flex items-center gap-3 px-3 py-2 bg-surface-overlay border border-neutral-800 rounded-lg hover:border-primary-500/40 transition-colors">
                <button
                  type="button"
                  class="flex items-center gap-3 flex-1 min-w-0 text-left focus:outline-none"
                  onclick={openClientPicker}
                  title="Cambiar cliente"
                >
                  <div class="w-7 h-7 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
                    <User class="w-3.5 h-3.5 text-primary-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-neutral-100 truncate">{selectedClient.name}</div>
                    <div class="text-[11px] text-neutral-500 font-mono truncate">
                      ID #{selectedClient.id}
                      {#if selectedClient.document_id} · {selectedClient.document_id}{/if}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  class="p-1 rounded-md text-neutral-500 hover:text-danger-400 shrink-0"
                  title="Limpiar selección"
                  onclick={clearSelectedClient}
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
            {:else}
              <button
                type="button"
                class="w-full flex items-center gap-3 px-3 py-2 text-left bg-surface-overlay border border-neutral-800 rounded-lg hover:border-primary-500/40 focus:outline-none focus:border-primary-500/60 transition-colors"
                onclick={openClientPicker}
              >
                <Search class="w-4 h-4 text-neutral-500 shrink-0" />
                <span class="flex-1 text-sm text-neutral-500">Buscar cliente por nombre, documento o email...</span>
                <ChevronDown class="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              </button>
            {/if}
          {:else}
            <!-- Combobox abierto: search + lista de resultados -->
            <div class="relative">
              <div class="flex items-center gap-2 px-3 py-2 bg-surface-overlay border border-primary-500/50 rounded-t-lg">
                <Search class="w-4 h-4 text-primary-400 shrink-0" />
                <input
                  type="text"
                  bind:this={clientSearchInput}
                  bind:value={clientSearch}
                  oninput={() => scheduleClientFetch(clientSearch)}
                  onkeydown={onClientSearchKeydown}
                  placeholder="Buscar por nombre, documento o email..."
                  class="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
                />
                {#if clientsLoading}
                  <Loader2 class="w-4 h-4 animate-spin text-neutral-500 shrink-0" />
                {/if}
                <button
                  type="button"
                  class="p-1 rounded-md text-neutral-500 hover:text-neutral-300"
                  onclick={() => { clientPickerOpen = false; }}
                  title="Cerrar"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
              <div class="max-h-64 overflow-y-auto border-l border-r border-b border-neutral-800 rounded-b-lg bg-surface-overlay">
                {#if clientsLoading && clientResults.length === 0}
                  <div class="px-3 py-6 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
                    <Loader2 class="w-3.5 h-3.5 animate-spin" /> Cargando...
                  </div>
                {:else if clientResults.length === 0}
                  <div class="px-3 py-6 text-center text-xs text-neutral-500">
                    Sin resultados.
                  </div>
                {:else}
                  <ul class="py-1">
                    {#each clientResults as c, i (c.id)}
                      <li>
                        <button
                          type="button"
                          class="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors {clientHighlight === i ? 'bg-primary-500/10' : 'hover:bg-neutral-800/50'}"
                          onmouseenter={() => { clientHighlight = i; }}
                          onclick={() => pickClient(c)}
                        >
                          <div class="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                            <User class="w-3.5 h-3.5 text-neutral-400" />
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                              <span class="text-sm text-neutral-100 truncate">{c.name}</span>
                              <span class="text-[10px] font-mono text-neutral-500">#{c.id}</span>
                            </div>
                            <div class="text-[11px] text-neutral-500 truncate">
                              {c.document_id || '—'}
                              {#if c.email} · {c.email}{/if}
                            </div>
                          </div>
                          {#if c.status}
                            <span class="text-[10px] font-mono px-1.5 py-0.5 rounded {statusBadgeColor(c.status)}">
                              {c.status}
                            </span>
                          {/if}
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>
          {/if}

          <p class="text-[11px] text-neutral-600 mt-1">Empieza a escribir para filtrar. Usa ↑ ↓ Enter para navegar.</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-neutral-400 mb-1.5">Motivo * (mínimo 5 caracteres)</label>
          <textarea
            bind:value={formReason}
            rows="3"
            placeholder="Cliente VIP, acuerdo comercial, etc..."
            class="w-full px-3 py-2 text-sm bg-surface-overlay border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-primary-500/50"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs font-medium text-neutral-400 mb-1.5">Vencimiento (opcional)</label>
          <input
            type="datetime-local"
            bind:value={formExpiresAt}
            class="w-full px-3 py-2 text-sm bg-surface-overlay border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-primary-500/50"
          />
          <p class="text-[11px] text-neutral-600 mt-1">Si lo dejas vacío, la inclusión es permanente.</p>
        </div>
      </div>
      <div class="p-5 border-t border-neutral-800 flex items-center justify-end gap-2">
        <button
          class="px-3 py-2 text-sm rounded-lg border border-neutral-800 text-neutral-400 hover:bg-surface-overlay"
          onclick={() => { showAddModal = false; resetForm(); }}
        >
          Cancelar
        </button>
        <button
          class="px-3 py-2 text-sm rounded-lg bg-primary-500 text-white hover:bg-primary-600 flex items-center gap-2 disabled:opacity-50"
          disabled={submitting}
          onclick={handleAddSubmit}
        >
          {#if submitting}
            <Loader2 class="w-4 h-4 animate-spin" />
          {/if}
          Agregar
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal: Editar -->
{#if showEditModal && editingEntry}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-surface-elevated border border-neutral-800 rounded-xl shadow-xl">
      <div class="flex items-center justify-between p-5 border-b border-neutral-800">
        <h3 class="text-base font-semibold text-neutral-100">Editar inclusión #{editingEntry.id}</h3>
        <button
          class="p-1 rounded-md text-neutral-500 hover:text-neutral-300"
          onclick={() => { showEditModal = false; resetForm(); }}
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="p-5 space-y-4">
        <div class="text-xs text-neutral-500">
          Cliente: <span class="text-neutral-200">{editingEntry.client?.full_name ?? '—'}</span>
        </div>
        <div>
          <label class="block text-xs font-medium text-neutral-400 mb-1.5">Motivo *</label>
          <textarea
            bind:value={formReason}
            rows="3"
            class="w-full px-3 py-2 text-sm bg-surface-overlay border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-primary-500/50"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs font-medium text-neutral-400 mb-1.5">Vencimiento</label>
          <input
            type="datetime-local"
            bind:value={formExpiresAt}
            class="w-full px-3 py-2 text-sm bg-surface-overlay border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-primary-500/50"
          />
        </div>
      </div>
      <div class="p-5 border-t border-neutral-800 flex items-center justify-end gap-2">
        <button
          class="px-3 py-2 text-sm rounded-lg border border-neutral-800 text-neutral-400 hover:bg-surface-overlay"
          onclick={() => { showEditModal = false; resetForm(); }}
        >
          Cancelar
        </button>
        <button
          class="px-3 py-2 text-sm rounded-lg bg-warning-500 text-white hover:bg-warning-600 flex items-center gap-2 disabled:opacity-50"
          disabled={submitting}
          onclick={handleEditSubmit}
        >
          {#if submitting}
            <Loader2 class="w-4 h-4 animate-spin" />
          {/if}
          Guardar
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal: Retirar -->
{#if showRemoveModal && removingEntry}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="w-full max-w-md bg-surface-elevated border border-neutral-800 rounded-xl shadow-xl">
      <div class="flex items-center justify-between p-5 border-b border-neutral-800">
        <h3 class="text-base font-semibold text-neutral-100">Retirar de la lista blanca</h3>
        <button
          class="p-1 rounded-md text-neutral-500 hover:text-neutral-300"
          onclick={() => { showRemoveModal = false; }}
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="p-5 space-y-4">
        <div class="text-sm text-neutral-300">
          ¿Confirmas retirar a <span class="font-semibold text-neutral-100">{removingEntry.client?.full_name}</span> de la lista blanca?
        </div>
        <p class="text-xs text-neutral-500">
          La inclusión se desactiva pero permanece en el historial. El cliente volverá a ser candidato a suspensión automática.
        </p>
        <div>
          <label class="block text-xs font-medium text-neutral-400 mb-1.5">Motivo del retiro (opcional)</label>
          <textarea
            bind:value={removeReason}
            rows="2"
            class="w-full px-3 py-2 text-sm bg-surface-overlay border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-primary-500/50"
          ></textarea>
        </div>
      </div>
      <div class="p-5 border-t border-neutral-800 flex items-center justify-end gap-2">
        <button
          class="px-3 py-2 text-sm rounded-lg border border-neutral-800 text-neutral-400 hover:bg-surface-overlay"
          onclick={() => { showRemoveModal = false; }}
        >
          Cancelar
        </button>
        <button
          class="px-3 py-2 text-sm rounded-lg bg-danger-500 text-white hover:bg-danger-600 flex items-center gap-2 disabled:opacity-50"
          disabled={submitting}
          onclick={handleRemoveSubmit}
        >
          {#if submitting}
            <Loader2 class="w-4 h-4 animate-spin" />
          {/if}
          Retirar
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal: Historial -->
{#if showHistoryModal}
  <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="w-full max-w-3xl bg-surface-elevated border border-neutral-800 rounded-xl shadow-xl max-h-[80vh] flex flex-col">
      <div class="flex items-center justify-between p-5 border-b border-neutral-800">
        <h3 class="text-base font-semibold text-neutral-100">
          Historial de auditoría
          {#if historyClientId}
            <span class="text-neutral-500 font-normal">(cliente #{historyClientId})</span>
          {/if}
        </h3>
        <button
          class="p-1 rounded-md text-neutral-500 hover:text-neutral-300"
          onclick={() => { showHistoryModal = false; }}
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-5">
        {#if historyLoading}
          <div class="flex items-center justify-center py-12 text-neutral-500">
            <Loader2 class="w-5 h-5 animate-spin mr-2" />
            Cargando historial...
          </div>
        {:else if historyEntries.length === 0}
          <div class="text-center py-12 text-neutral-500 text-sm">
            Sin registros de auditoría.
          </div>
        {:else}
          <div class="space-y-2">
            {#each historyEntries as h (h.id)}
              <div class="p-3 rounded-lg border border-neutral-800 bg-surface-overlay">
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-[11px] px-2 py-0.5 rounded-full border {operationColor(h.operation)}">
                      {operationLabel(h.operation)}
                    </span>
                    <span class="text-[11px] text-neutral-500 font-mono">#{h.record_id}</span>
                  </div>
                  <div class="text-[11px] text-neutral-500">
                    {formatDate(h.created_at)}
                  </div>
                </div>
                <div class="text-xs text-neutral-400 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <div>
                    <span class="text-neutral-600">Usuario:</span>
                    {h.user?.nombre ?? 'Sistema'}
                  </div>
                  <div>
                    <span class="text-neutral-600">IP:</span>
                    {h.ip_address ?? '—'}
                  </div>
                  {#if h.new_values?.reason}
                    <div class="sm:col-span-2">
                      <span class="text-neutral-600">Motivo:</span>
                      {h.new_values.reason}
                    </div>
                  {/if}
                  {#if h.new_values?.expires_at}
                    <div>
                      <span class="text-neutral-600">Vence:</span>
                      {formatDate(h.new_values.expires_at)}
                    </div>
                  {/if}
                  {#if h.new_values?.invoice_id}
                    <div>
                      <span class="text-neutral-600">Factura bloqueada:</span>
                      #{h.new_values.invoice_id}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
