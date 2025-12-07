<script>
  const notifications = [
    {
      title: 'PAYMENT RECEIVED',
      badge: 'MED',
      message: 'Your payment to Rampart Studio has been processed successfully.',
      date: '10/7/2024'
    },
    {
      title: 'INTRO: JOYCO STUDIO AND V0',
      message: "About us - We're a healthcare company focused on accessibility and...",
      date: '10/7/2024'
    },
    {
      title: 'SYSTEM UPDATE',
      badge: 'MED',
      message: 'Security patches have been applied to all guard bots.',
      date: '10/7/2024'
    }
  ];
</script>

<!-- Notifications -->
<div class="flex-1 overflow-y-auto p-6">
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-2 text-xs font-mono text-gray-400">
      <div class="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white font-bold">
        {notifications.length}
      </div>
      NOTIFICACIONES
    </div>
    <button class="text-xs font-mono text-blue-500 hover:text-blue-400">
      LIMPIAR TODO
    </button>
  </div>

  <div class="space-y-3">
    {#each notifications as notification}
      <div class="bg-[#111111] border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
        <div class="flex items-start gap-2 mb-2">
          <div class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5"></div>
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-mono font-bold text-white">{notification.title}</span>
              {#if notification.badge}
                <span class="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-mono">
                  {notification.badge}
                </span>
              {/if}
            </div>
            <p class="text-xs text-gray-400 leading-relaxed mb-2">
              {notification.message}
            </p>
            <div class="text-[10px] font-mono text-gray-600">
              {notification.date}
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>

  <button class="w-full mt-4 text-xs font-mono text-gray-400 hover:text-white text-center py-2">
    MOSTRAR TODO (4)
  </button>
  
  <!-- Texto informativo para móvil -->
  <div class="xl:hidden mt-6 p-4 text-center border-t border-gray-800">
    <p class="text-xs text-gray-500 font-mono">
      Desliza a la izquierda para eliminar notificaciones
    </p>
  </div>
</div>
