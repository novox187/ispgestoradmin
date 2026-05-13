<script lang="ts">
    import { XIcon, Loader2, Save, Shield } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import { createEventDispatcher } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { API_BASE } from '$lib/config';
    import { PERMISSION_MODULES, ALL_ACTIONS } from '$lib/config/permissions';
    import type { Permission } from '$lib/stores/usuarios.svelte';

    const props = $props<{ open: boolean; roleId: number | null; allPermissions: Permission[] }>();
    const dispatch = createEventDispatcher();

    let loadingRole = $state(false);
    let saving = $state(false);
    let fieldErrors = $state<Record<string, string[]>>({});

    let form = $state({ nombre: '', descripcion: '', permissions: [] as number[] });
    let original = $state({ nombre: '', descripcion: '', permissions: [] as number[] });

    const hasChanges = $derived(
        form.nombre !== original.nombre ||
        form.descripcion !== original.descripcion ||
        JSON.stringify([...form.permissions].sort()) !== JSON.stringify([...original.permissions].sort())
    );

    function getToken() { return typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null; }

    async function loadRole() {
        if (!props.roleId) return;
        loadingRole = true;
        fieldErrors = {};
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE}/admin/roles/${props.roleId}`, {
                headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            if (res.ok) {
                const json = await res.json();
                const d = json.data ?? json;
                form.nombre      = d.nombre ?? '';
                form.descripcion = d.descripcion ?? '';
                form.permissions = (d.permissions ?? []).map((p: any) => p.id);
                original = { nombre: form.nombre, descripcion: form.descripcion, permissions: [...form.permissions] };
            } else {
                toast.error('Error al cargar el rol');
            }
        } catch {
            toast.error('Error de conexión');
        } finally {
            loadingRole = false;
        }
    }

    $effect(() => {
        if (props.open && props.roleId) loadRole();
    });

    function findPermId(module: string, action: string): number | undefined {
        return props.allPermissions.find(p => p.slug === `${module}.${action}`)?.id;
    }

    function isChecked(module: string, action: string): boolean {
        const id = findPermId(module, action);
        return id !== undefined && form.permissions.includes(id);
    }

    function togglePerm(module: string, action: string) {
        const id = findPermId(module, action);
        if (id === undefined) return;
        if (form.permissions.includes(id)) {
            form.permissions = form.permissions.filter(p => p !== id);
        } else {
            form.permissions = [...form.permissions, id];
        }
    }

    function selectAll() { form.permissions = props.allPermissions.map(p => p.id); }
    function clearAll()  { form.permissions = []; }

    async function submit() {
        saving = true;
        fieldErrors = {};
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE}/admin/roles/${props.roleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(form),
            });

            if (res.ok) {
                toast.success('Rol actualizado correctamente');
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

    const totalSelected = $derived(form.permissions.length);
    const animation = 'transition transition-discrete opacity-0 translate-y-[60px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[60px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} onOpenChange={() => dispatch('close')}>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="bg-neutral-900 w-full max-w-2xl shadow-2xl rounded-2xl border border-neutral-800 text-gray-100 {animation} overflow-hidden">

                <header class="flex justify-between items-center px-6 py-5 border-b border-neutral-800">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-purple-500/15 rounded-lg border border-purple-500/20">
                            <Shield class="size-5 text-purple-400" />
                        </div>
                        <div>
                            <Dialog.Title class="text-lg font-bold">Editar Rol</Dialog.Title>
                            {#if hasChanges}<p class="text-xs text-yellow-400 mt-0.5">Cambios sin guardar</p>{/if}
                        </div>
                    </div>
                    <Dialog.CloseTrigger class="btn-icon hover:bg-white/10 text-white" onclick={() => dispatch('close')}>
                        <XIcon class="size-4" />
                    </Dialog.CloseTrigger>
                </header>

                <div class="px-6 py-5 space-y-5 max-h-[72vh] overflow-y-auto">
                    {#if loadingRole}
                        <div class="space-y-4 animate-pulse">
                            <div class="grid grid-cols-2 gap-4">
                                {#each Array(2) as _}
                                    <div>
                                        <div class="h-3 w-24 bg-neutral-800 rounded mb-2"></div>
                                        <div class="h-10 w-full bg-neutral-800 rounded-lg"></div>
                                    </div>
                                {/each}
                            </div>
                            <div class="h-48 w-full bg-neutral-800 rounded-xl"></div>
                        </div>
                    {:else}
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="er-nombre">Nombre del rol *</label>
                                <input id="er-nombre" type="text" bind:value={form.nombre}
                                    class="w-full px-4 py-2.5 bg-neutral-800 border {fieldErrors.nombre ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-purple-500 transition-colors" />
                                {#if fieldErrors.nombre}<p class="text-xs text-red-400 mt-1">{fieldErrors.nombre[0]}</p>{/if}
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="er-desc">Descripción</label>
                                <input id="er-desc" type="text" bind:value={form.descripcion}
                                    class="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-purple-500 transition-colors text-sm" />
                            </div>
                        </div>

                        <!-- Permission matrix -->
                        <div>
                            <div class="flex items-center justify-between mb-3">
                                <p class="text-xs font-medium text-neutral-400">
                                    Permisos <span class="text-neutral-600">({totalSelected} seleccionados)</span>
                                </p>
                                <div class="flex gap-2 text-xs">
                                    <button onclick={selectAll} class="text-purple-400 hover:text-purple-300 transition-colors">Todos</button>
                                    <span class="text-neutral-700">|</span>
                                    <button onclick={clearAll} class="text-neutral-400 hover:text-neutral-300 transition-colors">Ninguno</button>
                                </div>
                            </div>

                            <div class="overflow-x-auto rounded-xl border border-neutral-700">
                                <table class="w-full text-xs">
                                    <thead>
                                        <tr class="bg-neutral-800/60 border-b border-neutral-700">
                                            <th class="px-4 py-2.5 text-left font-semibold text-neutral-400 w-36">Módulo</th>
                                            {#each ALL_ACTIONS as action}
                                                <th class="px-3 py-2.5 text-center font-semibold text-neutral-400 capitalize">{action}</th>
                                            {/each}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each PERMISSION_MODULES as mod}
                                            <tr class="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
                                                <td class="px-4 py-2.5 font-medium text-neutral-200">{mod.label}</td>
                                                {#each ALL_ACTIONS as action}
                                                    <td class="px-3 py-2.5 text-center">
                                                        {#if (mod.actions as readonly string[]).includes(action)}
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked(mod.slug, action)}
                                                                onchange={() => togglePerm(mod.slug, action)}
                                                                class="accent-purple-500 size-4 cursor-pointer"
                                                            />
                                                        {:else}
                                                            <span class="text-neutral-700">—</span>
                                                        {/if}
                                                    </td>
                                                {/each}
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    {/if}
                </div>

                <footer class="flex justify-end gap-3 px-6 py-4 border-t border-neutral-800">
                    <button class="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors text-sm" onclick={() => dispatch('close')}>Cancelar</button>
                    <button
                        class="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={submit}
                        disabled={saving || loadingRole || !hasChanges}
                    >
                        {#if saving}<Loader2 class="size-4 animate-spin" /> Guardando...{:else}<Save class="size-4" /> Guardar cambios{/if}
                    </button>
                </footer>
            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>
