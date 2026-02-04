<script lang="ts">
  import { Dialog } from '@skeletonlabs/skeleton-svelte';
  import { Loader2, AlertTriangle, CheckCircle } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  export let open: boolean = false;
  export let title: string = 'Confirmación';
  export let message: string = '';
  export let confirmText: string = 'Confirmar';
  export let cancelText: string = 'Cancelar';
  export let type: 'danger' | 'success' | 'warning' | 'info' = 'info';
  export let loading: boolean = false;
  export let error: string | null = null;

  const dispatch = createEventDispatcher();

  function handleConfirm() {
    if (loading) return;
    dispatch('confirm');
  }

  function handleCancel() {
    if (loading) return;
    dispatch('cancel');
    open = false;
  }
</script>

<Dialog bind:open>
  <Dialog.Backdrop 
    transition={fade} 
    transitionParams={{ duration: 200 }}
    class="fixed inset-0 bg-black/60 z-[999] backdrop-blur-sm" 
  />
  <Dialog.Positioner class="fixed inset-0 z-[999] flex items-center justify-center p-4">
    <Dialog.Content 
      transition={fly}
      transitionParams={{ y: 20, duration: 200 }}
      class="w-full max-w-md bg-[#0f0f0f] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden relative"
    >
      <!-- Loading Overlay -->
      {#if loading}
        <div class="absolute inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
          <Loader2 class="size-8 text-primary animate-spin" />
        </div>
      {/if}

      <div class="p-6 space-y-6">
        <!-- Header / Icon -->
        <div class="flex flex-col items-center text-center space-y-4">
          <div class={`p-3 rounded-full ${
            type === 'danger' ? 'bg-red-500/10 text-red-500' : 
            type === 'success' ? 'bg-green-500/10 text-green-500' : 
            'bg-blue-500/10 text-blue-500'
          }`}>
            {#if type === 'danger'}
              <AlertTriangle class="size-8" />
            {:else if type === 'success'}
              <CheckCircle class="size-8" />
            {:else}
              <AlertTriangle class="size-8" />
            {/if}
          </div>
          
          <h2 class="text-xl font-bold text-foreground">{title}</h2>
          
          <p class="text-muted-foreground text-sm leading-relaxed">
            {message}
          </p>

          {#if error}
            <div class="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
          <button
            type="button"
            class="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-neutral-800 hover:bg-neutral-800/50 transition-colors disabled:opacity-50"
            onclick={handleCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          
          <button
            type="button"
            class={`flex-1 px-4 py-2 text-sm font-medium rounded-lg text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
              type === 'danger' 
                ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20' 
                : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20'
            }`}
            onclick={handleConfirm}
            disabled={loading}
          >
            {#if loading}
              <Loader2 class="size-4 animate-spin" />
            {/if}
            {confirmText}
          </button>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Positioner>
</Dialog>
