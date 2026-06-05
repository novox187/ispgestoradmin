<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { X } from '@lucide/svelte';
    import { API_BASE } from '$lib/config';
    import { toast } from 'svelte-sonner';

    export let open = false;
    export let client: any = null;

    const dispatch = createEventDispatcher();

    let amount = '';
    let description = 'Recarga administrativa';
    let imageFile: File | null = null;
    let imagePreviewUrl: string | null = null;
    let loading = false;
    let showFullscreenPreview = false;

    function handleImageChange(e: Event) {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            imageFile = target.files[0];
            
            // Create preview URL
            if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
            imagePreviewUrl = URL.createObjectURL(imageFile);
        } else {
            imageFile = null;
            if (imagePreviewUrl) {
                URL.revokeObjectURL(imagePreviewUrl);
                imagePreviewUrl = null;
            }
        }
    }

    async function handleAddFunds() {
        if (!client || !client.id) return;
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast.error('Ingrese un monto válido');
            return;
        }
        if (!imageFile) {
            toast.error('Debe adjuntar un comprobante de pago');
            return;
        }

        loading = true;
        try {
            const token = localStorage.getItem('employee_token');
            const formData = new FormData();
            formData.append('amount', amount);
            formData.append('description', description);
            formData.append('image', imageFile);

            const res = await fetch(`${API_BASE}/admin/clientes/${client.id}/add-funds`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();

            if (res.ok) {
                toast.success('Fondos agregados correctamente.');
                dispatch('success', data);
                closeModal();
            } else {
                toast.error(data.message || 'Error al agregar fondos.');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error de red al procesar la solicitud.');
        } finally {
            loading = false;
        }
    }

    function closeModal() {
        open = false;
        amount = '';
        description = 'Recarga administrativa';
        imageFile = null;
        showFullscreenPreview = false;
        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            imagePreviewUrl = null;
        }
        dispatch('close');
    }
    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && showFullscreenPreview) {
            showFullscreenPreview = false;
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div class="bg-[#232327] rounded-xl shadow-2xl w-full max-w-md border border-neutral-800 overflow-hidden flex flex-col">
            
            <div class="flex items-center justify-between p-4 border-b border-neutral-800">
                <h3 class="text-lg font-medium text-white">Agregar Fondos a Billetera</h3>
                <button 
                    onclick={closeModal}
                    class="text-neutral-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
                    disabled={loading}
                >
                    <X class="size-5" />
                </button>
            </div>

            <div class="p-4 space-y-4">
                <p class="text-sm text-neutral-300">
                    Cliente: <strong class="text-white">{client?.name}</strong>
                </p>

                <div>
                    <label for="amount" class="block text-sm font-medium text-neutral-400 mb-1">Monto a agregar</label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                        <input 
                            type="number" 
                            id="amount" 
                            bind:value={amount}
                            min="0.01"
                            step="0.01"
                            class="w-full bg-[#0b0b0d] border border-neutral-800 rounded-lg py-2 pl-8 pr-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="0.00"
                            disabled={loading}
                        />
                    </div>
                </div>

                <div>
                    <label for="description" class="block text-sm font-medium text-neutral-400 mb-1">Descripción</label>
                    <input 
                        type="text" 
                        id="description" 
                        bind:value={description}
                        class="w-full bg-[#0b0b0d] border border-neutral-800 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        placeholder="Motivo de la recarga"
                        disabled={loading}
                    />
                </div>

                <div>
                    <label for="image" class="block text-sm font-medium text-neutral-400 mb-1">Comprobante de pago (Requerido)</label>
                    <input 
                        type="file" 
                        id="image" 
                        accept="image/jpeg,image/png,image/jpg,image/gif"
                        onchange={handleImageChange}
                        class="w-full bg-[#0b0b0d] border border-neutral-800 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 transition-colors file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                        disabled={loading}
                    />
                    {#if imagePreviewUrl}
                        <div class="mt-3 relative inline-block group">
                            <button 
                                type="button"
                                class="block focus:outline-none"
                                onclick={() => showFullscreenPreview = true}
                                title="Ampliar imagen"
                            >
                                <img 
                                    src={imagePreviewUrl} 
                                    alt="Vista previa" 
                                    class="h-24 w-auto rounded-lg border border-neutral-700 object-cover transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg cursor-zoom-in" 
                                />
                            </button>
                            <button 
                                type="button"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    imageFile = null;
                                    URL.revokeObjectURL(imagePreviewUrl!);
                                    imagePreviewUrl = null;
                                    const input = document.getElementById('image') as HTMLInputElement;
                                    if (input) input.value = '';
                                }}
                                class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors z-10"
                                title="Eliminar imagen"
                            >
                                <X class="size-3" />
                            </button>
                        </div>
                    {/if}
                </div>
            </div>

            <div class="p-4 border-t border-neutral-800 flex justify-end gap-3 bg-[#1a1a1d]">
                <button 
                    onclick={closeModal}
                    class="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
                    disabled={loading}
                >
                    Cancelar
                </button>
                <button 
                    onclick={handleAddFunds}
                    disabled={loading || !amount || Number(amount) <= 0 || !imageFile}
                    class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {#if loading}
                        <div class="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Procesando...
                    {:else}
                        Agregar Fondos
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

{#if showFullscreenPreview && imagePreviewUrl}
    <div 
        class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md cursor-zoom-out"
        transition:fade={{ duration: 300, easing: quintOut }}
        onclick={() => showFullscreenPreview = false}
        role="dialog"
        aria-modal="true"
    >
        <button 
            type="button"
            class="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-all duration-300 z-10"
            onclick={(e) => {
                e.stopPropagation();
                showFullscreenPreview = false;
            }}
            title="Cerrar (Esc)"
        >
            <X class="size-6 sm:size-8" />
        </button>

        <img 
            src={imagePreviewUrl} 
            alt="Vista previa ampliada" 
            class="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/10"
            transition:scale={{ duration: 400, start: 0.85, easing: quintOut }}
            onclick={(e) => e.stopPropagation()} 
        />
    </div>
{/if}
