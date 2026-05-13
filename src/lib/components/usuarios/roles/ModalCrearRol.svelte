<script lang="ts">
    import { XIcon, Loader2, Save, Shield } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import { createEventDispatcher } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { API_BASE } from '$lib/config';
    import { PERMISSION_MODULES, ALL_ACTIONS } from '$lib/config/permissions';
    import type { Permission } from '$lib/stores/usuarios.svelte';

    const props = $props<{ open: boolean; allPermissions: Permission[] }>();
    const dispatch = createEventDispatcher();

    let saving = $state(false);
    let fieldErrors = $state<Record<string, string[]>>({});

    let form = $state({
        nombre: '',
        descripcion: '',
        permissions: [] as number[],
    });

    function getToken() { return typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null; }

    /** Find the permission ID for a `module.action` slug. */
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

    function close() {
        form = { nombre: '', descripcion: '', permissions: [] };
        fieldErrors = {};
        dispatch('close');
    }

    async function submit() {
        saving = true;
        fieldErrors = {};
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE}/admin/roles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(form),
            });

            if (res.ok) {
                toast.success('Rol creado correctamente');
                dispatch('created');
                close();
            } else {
                const data = await res.json();
                if (res.status === 422) {
                    fieldErrors = data.errors ?? {};
                    toast.error(data.message ?? 'Error de validación');
                } else {
                    toast.error(data.message ?? 'Error al crear rol');
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

<Dialog open={props.open} onOpenChange={close}>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="bg-neutral-900 w-full max-w-2xl shadow-2xl rounded-2xl border border-neutral-800 text-gray-100 {animation} overflow-hidden">

                <header class="flex justify-between items-center px-6 py-5 border-b border-neutral-800">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-purple-500/15 rounded-lg border border-purple-500/20">
                            <Shield class="size-5 text-purple-400" />
                        </div>
                        <Dialog.Title class="text-lg font-bold">Nuevo Rol</Dialog.Title>
                    </div>
                    <Dialog.CloseTrigger class="btn-icon hover:bg-white/10 text-white" onclick={close}>
                        <XIcon class="size-4" />
                    </Dialog.CloseTrigger>
                </header>

                <div class="px-6 py-5 space-y-5 max-h-[72vh] overflow-y-auto">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="rl-nombre">Nombre del rol *</label>
                            <input id="rl-nombre" type="text" bind:value={form.nombre} placeholder="Ej. Supervisor"
                                class="w-full px-4 py-2.5 bg-neutral-800 border {fieldErrors.nombre ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-purple-500 transition-colors" />
                            {#if fieldErrors.nombre}<p class="text-xs text-red-400 mt-1">{fieldErrors.nombre[0]}</p>{/if}
                        </div>
                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="rl-desc">Descripción</label>
                            <input id="rl-desc" type="text" bind:value={form.descripcion} placeholder="Describe las responsabilidades..."
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
                </div>

                <footer class="flex justify-end gap-3 px-6 py-4 border-t border-neutral-800">
                    <button class="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors text-sm" onclick={close}>Cancelar</button>
                    <button
                        class="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                        onclick={submit}
                        disabled={saving || !form.nombre.trim()}
                    >
                        {#if saving}<Loader2 class="size-4 animate-spin" /> Creando...{:else}<Save class="size-4" /> Crear Rol{/if}
                    </button>
                </footer>
            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>
