<script lang="ts">
  import { onMount } from 'svelte';
  import { API_BASE } from '$lib/config';
  
  interface Plan {
    id: number | string;
    name: string;
    price: number;
  }

  interface Client {
    id: number;
    name: string;
    email: string;
    phone: string;
    plan: string | null;
    document_id: string;
  }

  interface Pagination {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  }

  export let plans: Plan[] = [];
  
  let clients: Client[] = [];
  let pagination: Pagination = {
    current_page: 1,
    last_page: 1,
    total: 0,
    per_page: 4
  };
  
  let loading = false;
  let assigning = false;
  let message = '';
  
  // Filtros
  let searchTerm = '';
  let showOnlyWithoutPlan = true;
  let searchTimeout: ReturnType<typeof setTimeout>;

  async function loadClients(page = 1) {
    loading = true;
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: pagination.per_page.toString(),
        status: showOnlyWithoutPlan ? 'without_plan' : 'active',
        search: searchTerm,
        _t: Date.now().toString() // Evitar caché
      });
      
      const res = await fetch(`${API_BASE}/admin/clientes/summary?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('employee_token')}`,
          'Accept': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        clients = data.data;
        console.log(data)
        pagination = {
            current_page: data.current_page,
            last_page: data.last_page,
            total: data.total,
            per_page: data.per_page
        };
      }
    } catch (e) {
      console.error('Error loading clients:', e);
    } finally {
      loading = false;
    }
  }

  // Debounce para búsqueda
  function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadClients(1);
    }, 500);
  }

  function handleFilterChange() {
    loadClients(1);
  }

  function changePage(newPage: number) {
    if (newPage >= 1 && newPage <= pagination.last_page) {
        loadClients(newPage);
    }
  }

  onMount(() => {
    loadClients();
  });

  async function assignPlan(client: Client, planId: string) {
    if (!planId) return;
    
    assigning = true;
    message = '';
    
    try {
      // Robustez: Asegurar que tenemos document_id
      let docId = client.document_id;
      if (!docId) {
          try {
             // Intento de fallback sin caché
             const resDetail = await fetch(`${API_BASE}/admin/clientes/${client.id}?_t=${Date.now()}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('employee_token')}`,
                  'Accept': 'application/json'
                }
             });
             if (resDetail.ok) {
                 const detailData = await resDetail.json();
                 docId = detailData.document_id;
                 client.document_id = docId; // Actualizar ref local
             }
          } catch(e) { console.error("Error fetching detail", e); }
      }

      if (!docId) {
          alert('Error: No se pudo obtener el Document ID del cliente. Intente recargar la página.');
          assigning = false;
          return;
      }

      const res = await fetch(`${API_BASE}/admin/clientes/${client.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('employee_token')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
            full_name: client.name,
            email: client.email,
            contact_phone: client.phone,
            document_id: docId,
            reason: 'Asignación inicial de plan desde importación',
            plan_id: planId
        })
      });

      if (res.ok) {
        // Actualizar lista local
        const updatedClient = await res.json();
        const plan = plans.find(p => p.id == planId);
        
        if (plan) {
            clients = clients.map(c => 
                c.id === client.id 
                ? { ...c, plan: plan.name } 
                : c
            );
            message = `Plan asignado correctamente a ${client.name}`;
        }
        
        // Auto-limpiar mensaje
        setTimeout(() => message = '', 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        if (res.status === 409 && err?.code === 'ISP_CAPACITY_EXHAUSTED') {
          alert('Capacidad de ISP agotada');
        } else {
          alert('Error: ' + (err.message || 'No se pudo asignar el plan'));
        }
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      assigning = false;
    }
  }

  /* Eliminar lógica de filtrado en cliente */
  /* $: filteredClients = clients.filter(...) - YA NO ES NECESARIO */
</script>

<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-blue-500">
    <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
            <h2 class="text-xl font-bold text-gray-800 dark:text-white">Asignación de Planes</h2>
            <p class="text-gray-600 dark:text-gray-400 text-sm">Asigna planes a los clientes importados para activar su servicio en Mikrotik.</p>
        </div>
        
        <div class="flex items-center gap-4">
            <div class="relative">
                <input 
                    type="text" 
                    bind:value={searchTerm}
                    on:input={handleSearch}
                    placeholder="Buscar cliente..." 
                    class="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white w-64"
                >
                <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            
            <label class="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input 
                    type="checkbox" 
                    bind:checked={showOnlyWithoutPlan} 
                    on:change={handleFilterChange}
                    class="rounded text-blue-600 focus:ring-blue-500"
                >
                <span>Solo sin plan</span>
            </label>
        </div>
    </div>

    {#if message}
        <div class="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm flex items-center">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            {message}
        </div>
    {/if}

    <div class="overflow-x-auto">
        {#if loading}
            <div class="flex justify-center items-center py-12">
                <svg class="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        {:else}
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-700">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cliente</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email / Teléfono</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Plan Actual</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-900/10">Asignar Nuevo Plan</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {#each clients as client}
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm font-medium text-gray-900 dark:text-white">{client.name}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <div class="text-sm text-gray-500 dark:text-gray-400">{client.email}</div>
                                <div class="text-xs text-gray-400">{client.phone}</div>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                {#if client.plan}
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                                        {client.plan}
                                    </span>
                                {:else}
                                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                                        Sin Plan
                                    </span>
                                {/if}
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap bg-blue-50/30 dark:bg-blue-900/5">
                                <select 
                                    class="block w-full pl-3 pr-10 py-1 text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md shadow-sm"
                                    on:change={(e) => assignPlan(client, e.currentTarget.value)}
                                    disabled={assigning}
                                    value="" 
                                >
                                    <option value="" disabled selected>Seleccionar...</option>
                                    {#each plans as plan}
                                        <option value={plan.id}>{plan.name} - {plan.price}€</option>
                                    {/each}
                                </select>
                            </td>
                        </tr>
                    {/each}
                    
                    {#if clients.length === 0}
                        <tr>
                            <td colspan="4" class="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                                No se encontraron clientes que coincidan con los filtros.
                            </td>
                        </tr>
                    {/if}
                </tbody>
            </table>
        {/if}
    </div>

    <!-- Paginación -->
    {#if pagination.last_page > 1}
        <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 mt-4">
            <div class="flex flex-1 justify-between sm:hidden">
                <button 
                    on:click={() => changePage(pagination.current_page - 1)}
                    disabled={pagination.current_page === 1}
                    class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Anterior
                </button>
                <button 
                    on:click={() => changePage(pagination.current_page + 1)}
                    disabled={pagination.current_page === pagination.last_page}
                    class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    Siguiente
                </button>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                        Mostrando <span class="font-medium">{(pagination.current_page - 1) * pagination.per_page + 1}</span> a <span class="font-medium">{Math.min(pagination.current_page * pagination.per_page, pagination.total)}</span> de <span class="font-medium">{pagination.total}</span> resultados
                    </p>
                </div>
                <div>
                    <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button 
                            on:click={() => changePage(pagination.current_page - 1)}
                            disabled={pagination.current_page === 1}
                            class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                        >
                            <span class="sr-only">Anterior</span>
                            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
                            </svg>
                        </button>
                        
                        {#each Array(pagination.last_page) as _, i}
                            {#if i + 1 === pagination.current_page}
                                <button aria-current="page" class="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{i + 1}</button>
                            {:else if i + 1 === 1 || i + 1 === pagination.last_page || (i + 1 >= pagination.current_page - 1 && i + 1 <= pagination.current_page + 1)}
                                <button on:click={() => changePage(i + 1)} class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700">{i + 1}</button>
                            {:else if i + 1 === pagination.current_page - 2 || i + 1 === pagination.current_page + 2}
                                <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 dark:text-gray-400 dark:ring-gray-600">...</span>
                            {/if}
                        {/each}

                        <button 
                            on:click={() => changePage(pagination.current_page + 1)}
                            disabled={pagination.current_page === pagination.last_page}
                            class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                        >
                            <span class="sr-only">Siguiente</span>
                            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    {/if}
</div>
