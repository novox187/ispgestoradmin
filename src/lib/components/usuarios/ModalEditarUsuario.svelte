<script lang="ts">
    import { XIcon, Loader2, Eye, EyeOff, Save } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import { createEventDispatcher } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { API_BASE } from '$lib/config';
    import { usuariosStore } from '$lib/stores/usuarios.svelte';

    const props = $props<{ open: boolean; userId: number | null }>();
    const dispatch = createEventDispatcher();

    let loadingUser = $state(false);
    let saving = $state(false);
    let showPassword = $state(false);
    let fieldErrors = $state<Record<string, string[]>>({});
    let dirty = $state(false);

    let form = $state({
        name: '',
        email: '',
        password: '',
        phone: '',
        role_id: undefined as number | undefined,
        status: 'active' as 'active' | 'inactive',
    });

    let original = $state({ name: '', email: '', phone: '', role_id: undefined as number | undefined, status: 'active' as 'active' | 'inactive' });

    const hasChanges = $derived(
        form.name !== original.name ||
        form.email !== original.email ||
        form.phone !== original.phone ||
        form.role_id !== original.role_id ||
        form.status !== original.status ||
        form.password.length > 0
    );

    function getToken() { return typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null; }

    async function loadUser() {
        if (!props.userId) return;
        loadingUser = true;
        fieldErrors = {};
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE}/admin/employees/show/${props.userId}`, {
                headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            if (res.ok) {
                const json = await res.json();
                const d = json.data ?? json;
                form.name     = d.name ?? '';
                form.email    = d.email ?? '';
                form.phone    = d.phone ?? '';
                form.role_id  = d.role_id ?? undefined;
                form.status   = d.status ?? 'active';
                form.password = '';
                original = { name: form.name, email: form.email, phone: form.phone, role_id: form.role_id, status: form.status };
            } else {
                toast.error('Error al cargar el usuario');
            }
        } catch {
            toast.error('Error de conexión');
        } finally {
            loadingUser = false;
        }
    }

    $effect(() => {
        if (props.open && props.userId) {
            loadUser();
            if (usuariosStore.roles.length === 0) usuariosStore.fetchRoles();
        }
    });

    async function submit() {
        saving = true;
        fieldErrors = {};
        try {
            const token = getToken();
            const body: Record<string, unknown> = {
                name:    form.name,
                email:   form.email,
                phone:   form.phone,
                role_id: form.role_id,
                status:  form.status,
            };
            if (form.password.length > 0) body.password = form.password;

            const res = await fetch(`${API_BASE}/admin/employees/${props.userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                toast.success('Usuario actualizado correctamente');
                dispatch('updated');
                dispatch('close');
            } else {
                const data = await res.json();
                if (res.status === 422) {
                    fieldErrors = data.errors ?? {};
                    toast.error(data.message ?? 'Error de validación');
                } else {
                    toast.error(data.message ?? 'Error al actualizar');
                }
            }
        } catch {
            toast.error('Error de conexión');
        } finally {
            saving = false;
        }
    }

    const animation = 'transition transition-discrete opacity-0 translate-y-[60px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[60px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} onOpenChange={() => dispatch('close')}>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="bg-neutral-900 w-full max-w-lg shadow-2xl rounded-2xl border border-neutral-800 text-gray-100 {animation} overflow-hidden">

                <header class="flex justify-between items-center px-6 py-5 border-b border-neutral-800">
                    <div>
                        <Dialog.Title class="text-lg font-bold">Editar Usuario</Dialog.Title>
                        {#if hasChanges}
                            <p class="text-xs text-yellow-400 mt-0.5">Hay cambios sin guardar</p>
                        {:else}
                            <p class="text-xs text-neutral-400 mt-0.5">Modifica los datos del empleado</p>
                        {/if}
                    </div>
                    <Dialog.CloseTrigger class="btn-icon hover:bg-white/10 text-white" onclick={() => dispatch('close')}>
                        <XIcon class="size-4" />
                    </Dialog.CloseTrigger>
                </header>

                <div class="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {#if loadingUser}
                        <div class="space-y-4 animate-pulse">
                            {#each Array(5) as _}
                                <div>
                                    <div class="h-3 w-24 bg-neutral-800 rounded mb-2"></div>
                                    <div class="h-10 w-full bg-neutral-800 rounded-lg"></div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="ed-name">Nombre completo *</label>
                            <input id="ed-name" type="text" bind:value={form.name}
                                class="w-full px-4 py-2.5 bg-neutral-800 border {fieldErrors.name ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                            {#if fieldErrors.name}<p class="text-xs text-red-400 mt-1">{fieldErrors.name[0]}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="ed-email">Correo electrónico *</label>
                            <input id="ed-email" type="email" bind:value={form.email}
                                class="w-full px-4 py-2.5 bg-neutral-800 border {fieldErrors.email ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                            {#if fieldErrors.email}<p class="text-xs text-red-400 mt-1">{fieldErrors.email[0]}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="ed-phone">Teléfono</label>
                            <input id="ed-phone" type="tel" bind:value={form.phone}
                                class="w-full px-4 py-2.5 bg-neutral-800 border {fieldErrors.phone ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                            {#if fieldErrors.phone}<p class="text-xs text-red-400 mt-1">{fieldErrors.phone[0]}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="ed-role">Rol</label>
                            <select id="ed-role" bind:value={form.role_id}
                                class="w-full px-4 py-2.5 bg-neutral-800 border {fieldErrors.role_id ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-blue-500 text-white transition-colors">
                                <option value={undefined}>Seleccionar rol</option>
                                {#if usuariosStore.rolesLoading}
                                    <option disabled>Cargando...</option>
                                {:else}
                                    {#each usuariosStore.roles as role}
                                        <option value={role.id}>{role.nombre}</option>
                                    {/each}
                                {/if}
                            </select>
                            {#if fieldErrors.role_id}<p class="text-xs text-red-400 mt-1">{fieldErrors.role_id[0]}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5">Estado</label>
                            <div class="flex gap-3">
                                <label class="flex-1 flex items-center gap-2 p-3 rounded-lg border {form.status === 'active' ? 'border-green-500 bg-green-500/5' : 'border-neutral-700'} cursor-pointer transition-colors">
                                    <input type="radio" bind:group={form.status} value="active" class="accent-green-500" />
                                    <span class="text-sm">Activo</span>
                                </label>
                                <label class="flex-1 flex items-center gap-2 p-3 rounded-lg border {form.status === 'inactive' ? 'border-yellow-500 bg-yellow-500/5' : 'border-neutral-700'} cursor-pointer transition-colors">
                                    <input type="radio" bind:group={form.status} value="inactive" class="accent-yellow-500" />
                                    <span class="text-sm">Inactivo</span>
                                </label>
                            </div>
                        </div>

                        <div class="border-t border-neutral-800 pt-4">
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="ed-password">
                                Nueva contraseña <span class="text-neutral-600">(dejar vacío para no cambiar)</span>
                            </label>
                            <div class="relative">
                                <input id="ed-password" type={showPassword ? 'text' : 'password'} bind:value={form.password} placeholder="Mínimo 8 caracteres"
                                    class="w-full px-4 py-2.5 pr-10 bg-neutral-800 border {fieldErrors.password ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                                <button type="button" onclick={() => showPassword = !showPassword}
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                                    {#if showPassword}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
                                </button>
                            </div>
                            {#if form.password.length > 0 && form.password.length < 8}
                                <p class="text-xs text-yellow-400 mt-1">Mínimo 8 caracteres</p>
                            {/if}
                            {#if fieldErrors.password}<p class="text-xs text-red-400 mt-1">{fieldErrors.password[0]}</p>{/if}
                        </div>
                    {/if}
                </div>

                <footer class="flex justify-end gap-3 px-6 py-4 border-t border-neutral-800 bg-neutral-900/50">
                    <button class="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors text-sm" onclick={() => dispatch('close')} disabled={saving}>
                        Cancelar
                    </button>
                    <button
                        class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={submit}
                        disabled={saving || loadingUser || !hasChanges}
                    >
                        {#if saving}
                            <Loader2 class="size-4 animate-spin" /> Guardando...
                        {:else}
                            <Save class="size-4" /> Guardar cambios
                        {/if}
                    </button>
                </footer>

            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>
