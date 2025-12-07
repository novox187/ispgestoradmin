<script>
  let { title, value, icon: IconComponent, tipo } = $props();
</script>

<div class="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 relative overflow-hidden hover:border-gray-700 transition-colors">
  <div class="flex items-start justify-between mb-4">
    <div class="text-sm font-medium text-gray-400">{title}</div>
    <button class="text-gray-500 hover:text-gray-300 transition-colors" aria-label="More options">
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
      </svg>
    </button>
  </div>

  <div class="space-y-1">
  
      <div class="text-3xl font-bold text-white">{value}</div>

 
  </div>

  {#if tipo}
    <div class="absolute right-4 bottom-4">
      {#if tipo === 'activo'}
        <div class="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/50 text-emerald-500">
         <IconComponent class="w-6 h-6" />
        </div>
      {:else if tipo === 'deuda'}
        <div class="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/50 text-orange-500">
         <IconComponent class="w-6 h-6" />
        </div>
      {:else if tipo === 'inactivo'}
        <div class="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/50 text-red-500">
         <IconComponent class="w-6 h-6" />
        </div>
      {/if}
    </div>
  {/if}
</div>