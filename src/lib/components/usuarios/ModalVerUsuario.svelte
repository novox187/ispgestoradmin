<script lang="ts">
  import { XIcon, Loader2, Shield, User, Phone, Mail, Lock } from '@lucide/svelte';
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
  
  let user = $state<{
    name: string;
    email: string;
    phone: string;
    role: string;
    permissions: string[];
  } | null>(null);

  async function loadUser() {
    if (!props.userId) return;
    loading = true;
    errorMsg = '';
    user = null;
    
    try {
        const token = localStorage.getItem('employee_token');
        const res = await fetch(`${API_BASE}/admin/employees/show/${props.userId}`, {
            headers: { 
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (res.ok) {
            user = await res.json();
        } else {
            errorMsg = 'No se pudo cargar la información del usuario';
        }
    } catch (e) {
        console.error('Error loading user', e);
        errorMsg = 'Error de conexión';
    } finally {
        loading = false;
    }
  }

  $effect(() => {
    if (props.open && props.userId) {
        loadUser();
    }
  });
  
  const animation = 'transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0';
</script>

<Dialog open={props.open} onOpenChange={() => dispatch('close')}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-40 bg-black/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-center items-center p-4">
      <Dialog.Content class="card bg-neutral-900 w-full max-w-2xl max-h-[80vh] sm:max-h-none overflow-hidden p-0 shadow-xl rounded-xl border border-neutral-800 text-gray-100 {animation}">
        
        <!-- Header -->
        <header class="flex justify-between items-center sm:p-6 p-3 border-b border-neutral-800 bg-neutral-800/50">
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-500/20 rounded-lg">
                <User class="size-6 text-blue-400" />
            </div>
            <div>
                <Dialog.Title class="sm:text-xl font-bold">Detalles del Usuario</Dialog.Title>
                <p class="text-xs sm:text-sm text-neutral-400">Información completa y permisos</p>
            </div>
          </div>
          <Dialog.CloseTrigger class="btn-icon hover:bg-white/10 text-white transition-colors" onclick={() => dispatch('close')}>
            <XIcon class="size-5" />
          </Dialog.CloseTrigger>
        </header>

        <div class="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {#if loading}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
                <!-- Skeleton Personal Info -->
                <div class="space-y-6">
                    <div class="h-5 w-40 bg-neutral-800 rounded mb-4"></div>
                    <div class="space-y-6">
                        {#each Array(3) as _}
                            <div class="flex items-start gap-3">
                                <div class="size-5 bg-neutral-800 rounded-full"></div>
                                <div>
                                    <div class="h-3 w-24 bg-neutral-800 rounded mb-2"></div>
                                    <div class="h-4 w-48 bg-neutral-800 rounded"></div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Skeleton Role & Permissions -->
                <div class="space-y-6">
                    <div class="h-5 w-40 bg-neutral-800 rounded mb-4"></div>
                    <div class="bg-neutral-800/30 rounded-lg p-4 border border-neutral-800">
                        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-800">
                            <div class="size-6 bg-neutral-800 rounded"></div>
                            <div>
                                <div class="h-3 w-24 bg-neutral-800 rounded mb-2"></div>
                                <div class="h-6 w-32 bg-neutral-800 rounded-full"></div>
                            </div>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 mb-3">
                                <div class="size-4 bg-neutral-800 rounded"></div>
                                <div class="h-3 w-40 bg-neutral-800 rounded"></div>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                {#each Array(6) as _}
                                    <div class="h-6 w-20 bg-neutral-800 rounded"></div>
                                {/each}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          {:else if errorMsg}
            <div class="text-center py-8">
                <div class="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4 inline-block">
                    {errorMsg}
                </div>
            </div>
          {:else if user}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                <!-- Personal Info -->
                <div class="space-y-6">
                    <h3 class="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Información Personal</h3>
                    
                    <div class="space-y-4">
                        <div class="flex items-start gap-3 group">
                            <User class="size-5 text-neutral-500 mt-0.5 group-hover:text-blue-400 transition-colors" />
                            <div>
                                <p class="text-xs text-neutral-500">Nombre Completo</p>
                                <p class="text-lg font-medium">{user.name}</p>
                            </div>
                        </div>

                        <div class="flex items-start gap-3 group">
                            <Mail class="size-5 text-neutral-500 mt-0.5 group-hover:text-blue-400 transition-colors" />
                            <div>
                                <p class="text-xs text-neutral-500">Correo Electrónico</p>
                                <p class="text-base">{user.email}</p>
                            </div>
                        </div>

                        <div class="flex items-start gap-3 group">
                            <Phone class="size-5 text-neutral-500 mt-0.5 group-hover:text-blue-400 transition-colors" />
                            <div>
                                <p class="text-xs text-neutral-500">Teléfono</p>
                                <p class="text-base">{user.phone || 'No registrado'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Role & Permissions -->
                <div class="space-y-6">
                    <h3 class="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Rol y Accesos</h3>
                    
                    <div class="bg-neutral-800/30 rounded-lg p-4 border border-neutral-800">
                        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-800">
                            <Shield class="size-6 text-purple-400" />
                            <div>
                                <p class="text-xs text-neutral-500 uppercase font-semibold mb-1">Rol Asignado</p>
                                <span class="inline-flex items-center px-3 py-1 rounded-full text-base font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    {user.role || 'Sin Rol'}
                                </span>
                            </div>
                        </div>

                        <div>
                            <div class="flex items-center gap-2 mb-3">
                                <Lock class="size-4 text-neutral-500" />
                                <p class="text-xs text-neutral-500 font-medium">PERMISOS DEL SISTEMA ({user.permissions?.length || 0})</p>
                            </div>
                            
                            {#if user.permissions && user.permissions.length > 0}
                                <div class="bg-neutral-900/50 rounded-lg p-3 border border-neutral-800 max-h-[200px] overflow-y-auto custom-scrollbar">
                                    <div class="flex flex-wrap gap-2">
                                        {#each user.permissions as permission}
                                            <span class="px-2 py-1 rounded text-xs bg-neutral-700 text-neutral-300 border border-neutral-600 whitespace-normal text-center flex-grow">
                                                {permission}
                                            </span>
                                        {/each}
                                    </div>
                                </div>
                            {:else}
                                <p class="text-sm text-neutral-500 italic">Este rol no tiene permisos específicos asignados.</p>
                            {/if}
                        </div>
                    </div>
                </div>

            </div>
          {/if}
        </div>

      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>

<style>
    /* Custom Scrollbar for the content area */
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.02);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.2);
    }
</style>
