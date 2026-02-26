<script>
  import { createEventDispatcher } from 'svelte';
  
  export let history = [];
  
  const dispatch = createEventDispatcher();

  function formatDate(dateString) {
    return new Date(dateString).toLocaleString('es-ES');
  }

  function getStatusColor(status) {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'rolled_back': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'success': return 'Exitoso';
      case 'failed': return 'Fallido';
      case 'rolled_back': return 'Revertido';
      default: return 'Pendiente';
    }
  }
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
  <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
    <h3 class="font-medium text-gray-700 dark:text-gray-200">Historial de Importaciones</h3>
  </div>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-gray-700">
        <tr>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fecha</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Usuario</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tabla</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Archivo</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Estado</th>
          <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Resumen</th>
          <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
        {#each history as item}
          <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatDate(item.created_at)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.employee?.nombre || 'Sistema'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.table_name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{item.file_name}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {getStatusColor(item.status)}">
                {getStatusLabel(item.status)}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
              {#if item.summary}
                <span class="text-green-600 dark:text-green-400">✓ {item.summary.success}</span>
                <span class="text-red-600 dark:text-red-400 ml-2">✗ {item.summary.failed}</span>
              {:else}
                -
              {/if}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              {#if item.status === 'success'}
                <button
                  class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 px-3 py-1 rounded transition-colors"
                  on:click={() => dispatch('rollback', item.id)}
                  title="Revertir esta importación"
                >
                  Revertir
                </button>
              {/if}
            </td>
          </tr>
        {/each}
        {#if history.length === 0}
          <tr>
            <td colspan="7" class="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
              No hay importaciones registradas
            </td>
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
