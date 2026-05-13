<script lang="ts">
    import { XIcon, Loader2, User, Shield, CheckCircle2, ChevronRight, ChevronLeft, Eye, EyeOff } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import { createEventDispatcher } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { API_BASE } from '$lib/config';
    import { usuariosStore } from '$lib/stores/usuarios.svelte';

    const props = $props<{ open: boolean }>();
    const dispatch = createEventDispatcher();

    let step = $state(1);
    let loading = $state(false);
    let showPassword = $state(false);
    let fieldErrors = $state<Record<string, string[]>>({});

    let form = $state({
        name: '',
        email: '',
        password: '',
        phone: '',
        role_id: undefined as number | undefined,
        status: 'active' as 'active' | 'inactive',
    });

    // Validation for each step
    const step1Valid = $derived(
        form.name.trim().length >= 2 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
        form.password.length >= 8
    );

    const step2Valid = $derived(form.role_id !== undefined);

    function close() {
        step = 1;
        loading = false;
        showPassword = false;
        fieldErrors = {};
        form = { name: '', email: '', password: '', phone: '', role_id: undefined, status: 'active' };
        dispatch('close');
    }

    function getToken() { return typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null; }

    async function submit() {
        loading = true;
        fieldErrors = {};
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE}/admin/employees`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(form),
            });

            if (res.ok) {
                toast.success('Usuario creado correctamente');
                dispatch('created');
                close();
            } else {
                const data = await res.json();
                if (res.status === 422) {
                    fieldErrors = data.errors ?? {};
                    const firstStepFields = ['name', 'email', 'password', 'phone'];
                    const hasStep1Error = Object.keys(fieldErrors).some(k => firstStepFields.includes(k));
                    if (hasStep1Error) step = 1;
                    toast.error(data.message ?? 'Error de validación');
                } else {
                    toast.error(data.message ?? 'Error al crear usuario');
                }
            }
        } catch {
            toast.error('Error de conexión');
        } finally {
            loading = false;
        }
    }

    const animation = 'transition transition-discrete opacity-0 translate-y-[60px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[60px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
    const stepTitles = ['Información básica', 'Rol y configuración', 'Revisión final'];
</script>

<Dialog open={props.open} onOpenChange={close}>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="bg-neutral-900 w-full max-w-lg shadow-2xl rounded-2xl border border-neutral-800 text-gray-100 {animation} overflow-hidden">

                <!-- Header -->
                <header class="flex justify-between items-center px-6 py-5 border-b border-neutral-800">
                    <div>
                        <Dialog.Title class="text-lg font-bold">Nuevo Usuario</Dialog.Title>
                        <p class="text-xs text-neutral-400 mt-0.5">Paso {step} de 3 — {stepTitles[step - 1]}</p>
                    </div>
                    <Dialog.CloseTrigger class="btn-icon hover:bg-white/10 text-white" onclick={close}>
                        <XIcon class="size-4" />
                    </Dialog.CloseTrigger>
                </header>

                <!-- Step Progress -->
                <div class="flex px-6 pt-4 gap-1.5">
                    {#each [1, 2, 3] as s}
                        <div class="flex-1 h-1 rounded-full transition-colors duration-300 {s <= step ? 'bg-blue-500' : 'bg-neutral-700'}"></div>
                    {/each}
                </div>

                <!-- Step Content -->
                <div class="px-6 py-5 space-y-4">

                    {#if step === 1}
                        <!-- Información básica -->
                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="cr-name">Nombre completo *</label>
                            <input id="cr-name" type="text" bind:value={form.name} placeholder="Ej. Juan García"
                                class="w-full px-4 py-2.5 bg-neutral-800 border {fieldErrors.name ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                            {#if fieldErrors.name}<p class="text-xs text-red-400 mt-1">{fieldErrors.name[0]}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="cr-email">Correo electrónico *</label>
                            <input id="cr-email" type="email" bind:value={form.email} placeholder="correo@empresa.com"
                                class="w-full px-4 py-2.5 bg-neutral-800 border {fieldErrors.email ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                            {#if fieldErrors.email}<p class="text-xs text-red-400 mt-1">{fieldErrors.email[0]}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="cr-phone">Teléfono</label>
                            <input id="cr-phone" type="tel" bind:value={form.phone} placeholder="+1 234 567 8900"
                                class="w-full px-4 py-2.5 bg-neutral-800 border {fieldErrors.phone ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                            {#if fieldErrors.phone}<p class="text-xs text-red-400 mt-1">{fieldErrors.phone[0]}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="cr-password">Contraseña *</label>
                            <div class="relative">
                                <input id="cr-password" type={showPassword ? 'text' : 'password'} bind:value={form.password} placeholder="Mínimo 8 caracteres"
                                    class="w-full px-4 py-2.5 pr-10 bg-neutral-800 border {fieldErrors.password ? 'border-red-500' : 'border-neutral-700'} rounded-lg focus:outline-none focus:border-blue-500 transition-colors" />
                                <button type="button" onclick={() => showPassword = !showPassword}
                                    class="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                                    {#if showPassword}<EyeOff class="size-4" />{:else}<Eye class="size-4" />{/if}
                                </button>
                            </div>
                            {#if form.password.length > 0 && form.password.length < 8}
                                <p class="text-xs text-yellow-400 mt-1">La contraseña debe tener al menos 8 caracteres</p>
                            {/if}
                            {#if fieldErrors.password}<p class="text-xs text-red-400 mt-1">{fieldErrors.password[0]}</p>{/if}
                        </div>

                    {:else if step === 2}
                        <!-- Rol y configuración -->
                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5" for="cr-role">Rol del sistema *</label>
                            {#if usuariosStore.rolesLoading}
                                <div class="flex items-center gap-2 text-neutral-400 text-sm py-2">
                                    <Loader2 class="size-4 animate-spin" /> Cargando roles...
                                </div>
                            {:else}
                                <div class="space-y-2">
                                    {#each usuariosStore.roles as role}
                                        <label class="flex items-start gap-3 p-3 rounded-lg border {form.role_id === role.id ? 'border-blue-500 bg-blue-500/5' : 'border-neutral-700 hover:border-neutral-600'} cursor-pointer transition-colors">
                                            <input type="radio" bind:group={form.role_id} value={role.id} class="mt-0.5 accent-blue-500" />
                                            <div>
                                                <p class="text-sm font-medium">{role.nombre}</p>
                                                {#if role.descripcion}
                                                    <p class="text-xs text-neutral-400 mt-0.5">{role.descripcion}</p>
                                                {/if}
                                                {#if role.permissions && role.permissions.length > 0}
                                                    <p class="text-xs text-neutral-500 mt-1">{role.permissions.length} permiso(s)</p>
                                                {/if}
                                            </div>
                                        </label>
                                    {/each}
                                    {#if usuariosStore.roles.length === 0}
                                        <p class="text-sm text-neutral-500 py-2">No hay roles disponibles.</p>
                                    {/if}
                                </div>
                            {/if}
                            {#if fieldErrors.role_id}<p class="text-xs text-red-400 mt-1">{fieldErrors.role_id[0]}</p>{/if}
                        </div>

                        <div>
                            <label class="block text-xs font-medium text-neutral-400 mb-1.5">Estado inicial</label>
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

                    {:else}
                        <!-- Revisión final -->
                        <div class="space-y-4">
                            <div class="bg-neutral-800/50 rounded-xl border border-neutral-700 p-4 space-y-3">
                                <h4 class="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                                    <User class="size-3.5" /> Información personal
                                </h4>
                                <div class="grid grid-cols-2 gap-3 text-sm">
                                    <div><p class="text-xs text-neutral-500">Nombre</p><p class="font-medium">{form.name}</p></div>
                                    <div><p class="text-xs text-neutral-500">Email</p><p class="font-medium truncate">{form.email}</p></div>
                                    <div><p class="text-xs text-neutral-500">Teléfono</p><p class="font-medium">{form.phone || '—'}</p></div>
                                    <div><p class="text-xs text-neutral-500">Estado</p>
                                        <span class="text-xs px-2 py-0.5 rounded-full {form.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}">
                                            {form.status === 'active' ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div class="bg-neutral-800/50 rounded-xl border border-neutral-700 p-4 space-y-2">
                                <h4 class="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                                    <Shield class="size-3.5" /> Rol asignado
                                </h4>
                                {#if form.role_id}
                                    {@const selectedRole = usuariosStore.roles.find(r => r.id === form.role_id)}
                                    {#if selectedRole}
                                        <p class="text-sm font-medium">{selectedRole.nombre}</p>
                                        {#if selectedRole.descripcion}<p class="text-xs text-neutral-400">{selectedRole.descripcion}</p>{/if}
                                        {#if selectedRole.permissions && selectedRole.permissions.length > 0}
                                            <div class="flex flex-wrap gap-1 mt-2">
                                                {#each selectedRole.permissions.slice(0, 6) as perm}
                                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">{perm.nombre}</span>
                                                {/each}
                                                {#if (selectedRole.permissions?.length ?? 0) > 6}
                                                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">
                                                        +{(selectedRole.permissions?.length ?? 0) - 6} más
                                                    </span>
                                                {/if}
                                            </div>
                                        {/if}
                                    {/if}
                                {:else}
                                    <p class="text-sm text-neutral-500">Sin rol seleccionado</p>
                                {/if}
                            </div>
                        </div>
                    {/if}

                </div>

                <!-- Footer -->
                <footer class="flex justify-between items-center px-6 py-4 border-t border-neutral-800 bg-neutral-900/50">
                    <button
                        class="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition-colors text-sm disabled:opacity-40"
                        onclick={() => step > 1 ? step-- : close()}
                        disabled={loading}
                    >
                        {#if step === 1}
                            Cancelar
                        {:else}
                            <span class="flex items-center gap-1"><ChevronLeft class="size-4" /> Anterior</span>
                        {/if}
                    </button>

                    {#if step < 3}
                        <button
                            class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            onclick={() => step++}
                            disabled={step === 1 ? !step1Valid : !step2Valid}
                        >
                            Siguiente <ChevronRight class="size-4" />
                        </button>
                    {:else}
                        <button
                            class="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                            onclick={submit}
                            disabled={loading}
                        >
                            {#if loading}
                                <Loader2 class="size-4 animate-spin" /> Creando...
                            {:else}
                                <CheckCircle2 class="size-4" /> Crear Usuario
                            {/if}
                        </button>
                    {/if}
                </footer>

            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>
