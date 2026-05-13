<script lang="ts">
    import { XIcon, Loader2, Shield, User, Phone, Mail, CalendarDays, Activity, CheckCircle2, XCircle } from '@lucide/svelte';
    import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
    import { createEventDispatcher } from 'svelte';
    import { API_BASE } from '$lib/config';
    import { PERMISSION_MODULES } from '$lib/config/permissions';

    const props = $props<{ open: boolean; userId: number | null }>();
    const dispatch = createEventDispatcher();

    let loading = $state(false);
    let errorMsg = $state('');

    type UserDetail = {
        id: number;
        name: string;
        email: string;
        phone: string | null;
        role: string | null;
        role_slug: string | null;
        status: 'active' | 'inactive';
        permissions: string[];
        created_at: string | null;
        deleted_at: string | null;
    };

    let user = $state<UserDetail | null>(null);

    function getToken() { return typeof localStorage !== 'undefined' ? localStorage.getItem('employee_token') : null; }

    async function loadUser() {
        if (!props.userId) return;
        loading = true;
        errorMsg = '';
        user = null;
        try {
            const token = getToken();
            const res = await fetch(`${API_BASE}/admin/employees/show/${props.userId}`, {
                headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            if (res.ok) {
                const json = await res.json();
                user = json.data ?? json;
            } else {
                errorMsg = 'No se pudo cargar la información del usuario';
            }
        } catch {
            errorMsg = 'Error de conexión';
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        if (props.open && props.userId) loadUser();
    });

    function formatDate(iso: string | null) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    const animation = 'transition transition-discrete opacity-0 translate-y-[60px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[60px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';

    function hasPermission(module: string, action: string) {
        return user?.permissions?.includes(`${module}.${action}`) ?? false;
    }
</script>

<Dialog open={props.open} onOpenChange={() => dispatch('close')}>
    <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content class="bg-neutral-900 w-full max-w-2xl shadow-2xl rounded-2xl border border-neutral-800 text-gray-100 {animation} overflow-hidden">

                <!-- Header -->
                <header class="flex justify-between items-center px-6 py-5 border-b border-neutral-800 bg-neutral-800/30">
                    <div class="flex items-center gap-3">
                        <div class="p-2.5 bg-blue-500/15 rounded-xl border border-blue-500/20">
                            <User class="size-5 text-blue-400" />
                        </div>
                        <div>
                            <Dialog.Title class="text-lg font-bold">Perfil de Usuario</Dialog.Title>
                            <p class="text-xs text-neutral-400">Detalles completos y permisos del sistema</p>
                        </div>
                    </div>
                    <Dialog.CloseTrigger class="btn-icon hover:bg-white/10 text-white transition-colors" onclick={() => dispatch('close')}>
                        <XIcon class="size-5" />
                    </Dialog.CloseTrigger>
                </header>

                <div class="overflow-y-auto max-h-[72vh] p-6">
                    {#if loading}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                            <div class="space-y-5">
                                {#each Array(4) as _}
                                    <div class="flex items-start gap-3">
                                        <div class="size-5 bg-neutral-800 rounded-full mt-1"></div>
                                        <div class="flex-1">
                                            <div class="h-3 w-20 bg-neutral-800 rounded mb-2"></div>
                                            <div class="h-4 w-48 bg-neutral-800 rounded"></div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                            <div class="space-y-3">
                                <div class="h-5 w-32 bg-neutral-800 rounded mb-4"></div>
                                <div class="h-24 bg-neutral-800 rounded-xl"></div>
                                <div class="h-32 bg-neutral-800 rounded-xl"></div>
                            </div>
                        </div>
                    {:else if errorMsg}
                        <div class="flex flex-col items-center justify-center py-12 text-center">
                            <XCircle class="size-10 text-red-400 mb-3" />
                            <p class="text-red-400 font-medium">{errorMsg}</p>
                        </div>
                    {:else if user}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <!-- Info personal -->
                            <div class="space-y-5">
                                <h3 class="text-xs font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2">
                                    Información Personal
                                </h3>

                                <div class="flex items-start gap-3 group">
                                    <User class="size-4 text-neutral-500 mt-1 group-hover:text-blue-400 transition-colors" />
                                    <div>
                                        <p class="text-xs text-neutral-500 mb-0.5">Nombre completo</p>
                                        <p class="text-base font-semibold">{user.name}</p>
                                    </div>
                                </div>

                                <div class="flex items-start gap-3 group">
                                    <Mail class="size-4 text-neutral-500 mt-1 group-hover:text-blue-400 transition-colors" />
                                    <div>
                                        <p class="text-xs text-neutral-500 mb-0.5">Correo electrónico</p>
                                        <p class="text-sm">{user.email}</p>
                                    </div>
                                </div>

                                <div class="flex items-start gap-3 group">
                                    <Phone class="size-4 text-neutral-500 mt-1 group-hover:text-blue-400 transition-colors" />
                                    <div>
                                        <p class="text-xs text-neutral-500 mb-0.5">Teléfono</p>
                                        <p class="text-sm">{user.phone ?? 'No registrado'}</p>
                                    </div>
                                </div>

                                <div class="flex items-start gap-3 group">
                                    <Activity class="size-4 text-neutral-500 mt-1 group-hover:text-blue-400 transition-colors" />
                                    <div>
                                        <p class="text-xs text-neutral-500 mb-1">Estado</p>
                                        {#if user.status === 'active'}
                                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                                <span class="size-1.5 bg-green-400 rounded-full"></span>Activo
                                            </span>
                                        {:else}
                                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                <span class="size-1.5 bg-yellow-400 rounded-full"></span>Inactivo
                                            </span>
                                        {/if}
                                        {#if user.deleted_at}
                                            <span class="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                                                Eliminado
                                            </span>
                                        {/if}
                                    </div>
                                </div>

                                <div class="flex items-start gap-3 group">
                                    <CalendarDays class="size-4 text-neutral-500 mt-1 group-hover:text-blue-400 transition-colors" />
                                    <div>
                                        <p class="text-xs text-neutral-500 mb-0.5">Fecha de registro</p>
                                        <p class="text-sm">{formatDate(user.created_at)}</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Rol y permisos -->
                            <div class="space-y-4">
                                <h3 class="text-xs font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-800 pb-2">
                                    Rol y Accesos
                                </h3>

                                <!-- Rol badge -->
                                <div class="bg-neutral-800/40 rounded-xl border border-neutral-700 p-4 flex items-center gap-3">
                                    <div class="p-2 bg-purple-500/15 rounded-lg border border-purple-500/20">
                                        <Shield class="size-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <p class="text-xs text-neutral-500 uppercase tracking-wider font-semibold mb-1">Rol asignado</p>
                                        <span class="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                            {user.role ?? 'Sin rol'}
                                        </span>
                                    </div>
                                </div>

                                <!-- Permisos por categoría -->
                                <div class="bg-neutral-800/40 rounded-xl border border-neutral-700 p-4 space-y-3">
                                    <p class="text-xs text-neutral-500 font-semibold uppercase tracking-wider">
                                        Permisos del sistema
                                        <span class="ml-1 text-neutral-400">({user.permissions?.length ?? 0})</span>
                                    </p>

                                    {#if user.permissions?.includes('acceso_total')}
                                        <div class="flex items-center gap-2 text-sm text-green-400">
                                            <CheckCircle2 class="size-4" /> Acceso total al sistema
                                        </div>
                                    {:else if user.permissions && user.permissions.length > 0}
                                        {#each PERMISSION_MODULES as mod}
                                            <div>
                                                <p class="text-[10px] text-neutral-600 uppercase tracking-wider mb-1.5">{mod.label}</p>
                                                <div class="grid grid-cols-2 gap-1">
                                                    {#each mod.actions as action}
                                                        {@const active = hasPermission(mod.slug, action)}
                                                        <div class="flex items-center gap-1.5 text-xs {active ? 'text-neutral-200' : 'text-neutral-600'}">
                                                            {#if active}
                                                                <CheckCircle2 class="size-3 text-green-400 flex-shrink-0" />
                                                            {:else}
                                                                <XCircle class="size-3 text-neutral-700 flex-shrink-0" />
                                                            {/if}
                                                            {action}
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                        {/each}
                                    {:else}
                                        <p class="text-xs text-neutral-500 italic">Sin permisos específicos asignados.</p>
                                    {/if}
                                </div>
                            </div>

                        </div>
                    {/if}
                </div>

            </Dialog.Content>
        </Dialog.Positioner>
    </Portal>
</Dialog>
