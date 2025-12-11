<script>
  import Reloj from './Reloj.svelte';
  import ListaNotificaciones from './ListaNotificaciones.svelte';
  
  let { isOpen = $bindable(false) } = $props();
  
  function closeDrawer() {
    isOpen = false;
  }
  
</script>

<!-- Overlay para móvil -->
{#if isOpen}
  <div 
    class="fixed inset-0 bg-black/50 z-40 xl:hidden"
    onclick={closeDrawer}
    onkeydown={(e) => e.key === 'Enter' && closeDrawer()}
    role="button"
    tabindex="0"
    aria-label="Close notifications"
  ></div>
{/if}

<aside class="
  w-96 bg-[#0d0d0d] border-l border-neutral-800 flex flex-col
  fixed xl:static inset-y-0 right-0 z-50
  transform transition-transform duration-300 ease-in-out
  xl:translate-x-0
  {isOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'}
">
  <!-- Header con botón de cerrar en móvil -->
  <div class="xl:hidden flex items-center justify-between p-4 border-b border-neutral-800">
    <div class="flex items-center gap-2">
      <div class="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xs">
        3
      </div>
      <span class="text-white font-bold text-sm">NOTIFICACIONES</span>
    </div>
    <button 
      class="text-gray-400 hover:text-white p-2"
      onclick={closeDrawer}
      aria-label="Close notifications"
    >
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
      </svg>
    </button>
  </div>
  
  <!-- Clock Component -->
  <Reloj />

  <!-- Notifications Component -->
  <ListaNotificaciones />

  <!-- Chat Button Component -->
</aside>
