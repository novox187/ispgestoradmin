<script lang="ts">
  import { XIcon, Loader2 } from '@lucide/svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { createEventDispatcher, onMount } from 'svelte';
  import { API_BASE } from '$lib/config';

  const props = $props<{
    open: boolean;
    userId: number | null;
  }>();

  const dispatch = createEventDispatcher();

  let loading = $state(false);
  let errorMsg = $state('');
  let fieldErrors = $state<Record<string, string[]>>({});

  type RoleOption = { id: number; nombre: string; slug: string };
  let roles = $state<RoleOption[]>([]);
  let rolesLoading = $state(false);
  let rolesError = $state<string | null>(null);

  let form = $state({
    name: '',
    email: '',
    password: '',
    phone: '',
    role_id: undefined as number | undefined
  });

  async function loadRoles() {
    rolesLoading = true;
    rolesError = null;
    try {
        const token = localStorage.getItem('employee_token');
        const res = await fetch(`${API_BASE}/admin/roles`, {
            headers: { 
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if(res.ok) {
            roles = await res.json();
        } else {
            rolesError = 'Error cargando roles';
        }
    } catch (e) {
        console.error('Error loading roles', e);
        rolesError = 'Error de conexión';
    } finally {
        rolesLoading = false;
    }
  }

  async function loadUser() {
    if (!props.userId) return;
    loading = true;
    try {
        const token = localStorage.getItem('employee_token');
        const res = await fetch(`${API_BASE}/admin/employees/${props.userId}`, {
            headers: { 
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (res.ok) {
            const data = await res.json();
            form.name = data.name;
            form.email = data.email;
            form.phone = data.phone;
            form.role_id = data.role_id;
            form.password = ''; // Don't fill password
        }
    } catch (e) {
        errorMsg = 'Error cargando usuario';
    } finally {
        loading = false;
    }
  }

  $effect(() => {
    if (props.open && props.userId) {
        loadUser();
        if (roles.length === 0) loadRoles();
    }
  });

  async function submit() {
    loading = true;
    errorMsg = '';
    fieldErrors = {};
    
    try {
      const token = localStorage.getItem('employee_token');
      const res = await fetch(`${API_BASE}/admin/employees/${props.userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        dispatch('updated');
        dispatch('close');
      } else {
        const data = await res.json();
        if (res.status === 422) {
            fieldErrors = data.errors || {};
            errorMsg = data.message || 'Error de validación';
        } else {
            errorMsg = data.message || 'Error al actualizar usuario';
        }
      }
    } catch (e) {
        errorMsg = 'Error de conexión';
    } finally {
        loading = false;
    }
  }
  
  const animation = 'transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} onOpenChange={() => dispatch('close')}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class="card bg-neutral-900 w-full max-w-lg p-6 space-y-4 shadow-xl rounded-xl border border-neutral-800 text-gray-100 {animation}">
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Editar Usuario</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:bg-white/10 text-white" onclick={() => dispatch('close')}>
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        <div class="space-y-4">
          {#if errorMsg}
            <div class="text-sm text-red-400 bg-red-500/10 border border-red-600 rounded-md p-2">
              {errorMsg}
            </div>
          {/if}

          <div>
            <label class="block text-sm font-medium mb-2" for="name">Nombre</label>
            <input id="name" type="text" bind:value={form.name}
              class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-blue-500" />
            {#if fieldErrors.name}<p class="text-xs text-red-400 mt-1">{fieldErrors.name[0]}</p>{/if}
          </div>

          <div>
            <label class="block text-sm font-medium mb-2" for="email">Email</label>
            <input id="email" type="email" bind:value={form.email}
              class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-blue-500" />
            {#if fieldErrors.email}<p class="text-xs text-red-400 mt-1">{fieldErrors.email[0]}</p>{/if}
          </div>

          <div>
            <label class="block text-sm font-medium mb-2" for="phone">Teléfono</label>
            <input id="phone" type="tel" bind:value={form.phone}
              class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-blue-500" />
            {#if fieldErrors.phone}<p class="text-xs text-red-400 mt-1">{fieldErrors.phone[0]}</p>{/if}
          </div>

          <div>
            <label class="block text-sm font-medium mb-2" for="role">Rol</label>
            <select id="role" bind:value={form.role_id}
                class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-blue-500 text-white">
                <option value={undefined}>Seleccionar rol</option>
                {#if rolesLoading}
                  <option disabled>Cargando roles...</option>
                {:else if rolesError}
                  <option disabled>{rolesError}</option>
                {:else}
                  {#each roles as role}
                      <option value={role.id}>{role.nombre}</option>
                  {/each}
                {/if}
            </select>
            {#if fieldErrors.role_id}<p class="text-xs text-red-400 mt-1">{fieldErrors.role_id[0]}</p>{/if}
          </div>

          <div>
            <label class="block text-sm font-medium mb-2" for="password">Contraseña (Opcional)</label>
            <input id="password" type="password" placeholder="Dejar en blanco para no cambiar" bind:value={form.password}
              class="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-blue-500" />
            {#if fieldErrors.password}<p class="text-xs text-red-400 mt-1">{fieldErrors.password[0]}</p>{/if}
          </div>

        </div>

        <footer class="flex justify-end gap-2 mt-6">
          <button class="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors" onclick={() => dispatch('close')}>Cancelar</button>
          <button class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-2" onclick={submit} disabled={loading}>
            {#if loading}
              <Loader2 class="size-4 animate-spin" /> Guardando...
            {:else}
              Guardar Cambios
            {/if}
          </button>
        </footer>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>