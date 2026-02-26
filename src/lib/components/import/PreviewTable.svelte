<script>
  export let validationResult = null;
  export let plans = [];
  export let showPlanSelector = false;
  
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handlePlanChange(rowIndex, planId) {
    dispatch('planChange', { rowIndex, planId });
  }
</script>

{#if validationResult}
  <div class="space-y-4">
    <div class="grid grid-cols-3 gap-4">
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 {validationResult.valid ? 'border-green-500' : 'border-red-500'}">
        <div class="text-sm text-gray-500 dark:text-gray-400">Estado</div>
        <div class="text-lg font-bold {validationResult.valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
          {validationResult.valid ? 'Válido' : 'Contiene Errores'}
        </div>
      </div>
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 border-blue-500">
        <div class="text-sm text-gray-500 dark:text-gray-400">Total Filas</div>
        <div class="text-lg font-bold text-gray-800 dark:text-gray-100">{validationResult.total_rows}</div>
      </div>
      <div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow border-l-4 border-yellow-500">
        <div class="text-sm text-gray-500 dark:text-gray-400">Errores</div>
        <div class="text-lg font-bold text-gray-800 dark:text-gray-100">{validationResult.error_count}</div>
      </div>
    </div>

    {#if validationResult.errors.length > 0}
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <h3 class="font-medium text-red-800 dark:text-red-400 mb-2">Detalle de Errores</h3>
        <div class="max-h-60 overflow-y-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr>
                <th class="text-left py-2 text-red-700 dark:text-red-300">Fila</th>
                <th class="text-left py-2 text-red-700 dark:text-red-300">Errores</th>
              </tr>
            </thead>
            <tbody>
              {#each validationResult.errors as error}
                <tr class="border-t border-red-100 dark:border-red-800/50">
                  <td class="py-2 text-red-600 dark:text-red-400 font-medium">#{error.row}</td>
                  <td class="py-2 text-red-600 dark:text-red-400">
                    <ul class="list-disc list-inside">
                      {#each error.errors as msg}
                        <li>{msg}</li>
                      {/each}
                    </ul>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    {#if validationResult.preview.length > 0}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
          <h3 class="font-medium text-gray-700 dark:text-gray-200">Vista Previa de Datos (Primeros 5 registros)</h3>
          {#if showPlanSelector}
             <span class="text-xs text-blue-600 dark:text-blue-400 font-medium px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded">
                Modo Asignación de Planes
             </span>
          {/if}
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                {#each Object.keys(validationResult.preview[0]) as header}
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {header}
                  </th>
                {/each}
                {#if showPlanSelector}
                    <th class="px-6 py-3 text-left text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/10 min-w-[200px]">
                        Asignar Plan
                    </th>
                {/if}
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {#each validationResult.preview as row, i}
                <tr>
                  {#each Object.values(row) as cell}
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {cell}
                    </td>
                  {/each}
                  {#if showPlanSelector}
                    <td class="px-6 py-4 whitespace-nowrap bg-blue-50/50 dark:bg-blue-900/5">
                        <div class="relative">
                            <select 
                                class="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-md shadow-sm transition-shadow duration-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600"
                                on:change={(e) => handlePlanChange(i, e.target.value)}
                            >
                                <option value="" class="text-gray-500">Seleccionar Plan...</option>
                                {#each plans as plan}
                                    <option value={plan.id} class="py-2">
                                        {plan.name} - {plan.price}€ ({plan.download_speed}M/{plan.upload_speed}M)
                                    </option>
                                {/each}
                            </select>
                            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                            </div>
                        </div>
                    </td>
                  {/if}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
{/if}
