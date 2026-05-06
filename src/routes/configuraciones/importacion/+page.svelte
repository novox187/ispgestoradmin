<script lang="ts">
  import { onMount } from 'svelte';
  import { API_BASE } from '$lib/config';
  import Encabezado from '$lib/components/Encabezado.svelte';
  import { appState } from '$lib/stores/app.svelte';
  import ImportZone from '$lib/components/import/ImportZone.svelte';
  import PreviewTable from '$lib/components/import/PreviewTable.svelte';
  import HistoryTable from '$lib/components/import/HistoryTable.svelte';
  import AssignPlanStep from '$lib/components/import/steps/AssignPlanStep.svelte';
  
  interface Step {
    id: number;
    table: string;
    title: string;
    description: string;
    skippable: boolean;
    customView?: boolean;
  }

  interface HistoryItem {
    id: number | string;
    created_at: string;
    employee?: { nombre: string } | null;
    table_name: string;
    file_name: string;
    status: string;
    summary?: { success: number; failed: number } | null;
  }

  interface Plan {
    id: number | string;
    name: string;
    price: number;
    download_speed: number;
    upload_speed: number;
  }

  interface ValidationResult {
    valid: boolean;
    total_rows: number;
    error_count: number;
    errors: Array<{ row: number; errors: string[] }>;
    preview: Array<Record<string, any>>;
  }

  // Definición de pasos para el Wizard
  const steps: Step[] = [
    {
      id: 1,
      table: 'plans',
      title: '1. Importar Planes',
      description: 'Primero, define los planes de internet que ofrecerás. Esto creará las colas base en Mikrotik.',
      skippable: true
    },
    {
      id: 2,
      table: 'clients',
      title: '2. Importar Clientes',
      description: 'Registra la información personal de tus clientes. Se crearán sus billeteras automáticamente.',
      skippable: true
    },
    {
      id: 3,
      // Ya no usa tabla 'clients_plans' para carga, sino asignación manual
      table: 'clients_plans', 
      title: '3. Asignar Planes',
      description: 'Selecciona los clientes sin plan y asígnales uno. Esto creará las colas en Mikrotik.',
      skippable: true,
      customView: true // Nuevo flag para renderizar vista personalizada
    },
    {
        id: 4,
        table: 'invoices',
        title: '4. Importar Facturas (Opcional)',
        description: 'Si tienes facturas históricas, puedes importarlas aquí.',
        skippable: true
    }
  ];

  let currentStepIndex = 0;
  $: currentStep = steps[currentStepIndex];
  $: selectedTable = currentStep.table;

  let history: HistoryItem[] = [];
  let validationResult: ValidationResult | null = null;
  let isUploading = false;
  let isProcessing = false;
  let isDownloading = false;
  let uploadFile: File | null = null;
  let errorMessage = '';
  let successMessage = '';

  async function loadHistory() {
    try {
      const res = await fetch(`${API_BASE}/admin/import/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('employee_token')}`,
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        history = data.data;
      }
    } catch (e) {
      console.error('Error loading history:', e);
    }
  }

  let availablePlans: Plan[] = [];
  
  async function loadPlans() {
    try {
        const res = await fetch(`${API_BASE}/plans`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('employee_token')}`,
                'Accept': 'application/json'
            }
        });
        if (res.ok) {
            const data = await res.json();
            availablePlans = data.data || [];
        }
    } catch (e) {
        console.error('Error loading plans:', e);
    }
  }

  onMount(() => {
    loadHistory();
    loadPlans();
  });

  // Mapa para guardar las asignaciones de planes (rowIndex -> planId)
  let planAssignments: Record<number, string> = {};

  function handlePlanAssignment(event: CustomEvent<{ rowIndex: number; planId: string }>) {
    const { rowIndex, planId } = event.detail;
    planAssignments[rowIndex] = planId;
    // También podemos actualizar el objeto validationResult.preview para que refleje el cambio visualmente si quisiéramos
  }

  function nextStep() {
    if (currentStepIndex < steps.length - 1) {
      currentStepIndex++;
      resetState();
    }
  }

  function prevStep() {
    if (currentStepIndex > 0) {
      currentStepIndex--;
      resetState();
    }
  }

  function goToStep(index: number) {
    currentStepIndex = index;
    resetState();
  }

  function resetState() {
    validationResult = null;
    uploadFile = null;
    errorMessage = '';
    successMessage = '';
  }

  async function handleDownloadTemplate() {
    if (!selectedTable) return;
    
    isDownloading = true;
    errorMessage = '';
    
    try {
      const res = await fetch(`${API_BASE}/admin/import/template/${selectedTable}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('employee_token')}`,
        }
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `template_${selectedTable}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        errorMessage = 'Error al descargar la plantilla';
      }
    } catch (e) {
      errorMessage = 'Error de conexión';
    } finally {
      isDownloading = false;
    }
  }

  async function handleFileSelected(event: CustomEvent<File>) {
    const file = event.detail;
    uploadFile = file;
    errorMessage = '';
    successMessage = '';
    validationResult = null;

    if (!selectedTable) {
      errorMessage = 'Error interno: tabla no seleccionada';
      return;
    }

    isUploading = true;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('table', selectedTable);

    try {
      const res = await fetch(`${API_BASE}/admin/import/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('employee_token')}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      if (res.ok) {
        validationResult = await res.json();
      } else {
        const err = await res.json();
        errorMessage = err.message || 'Error en la validación';
      }
    } catch (e) {
      errorMessage = 'Error al subir el archivo';
    } finally {
      isUploading = false;
    }
  }

  async function handleProcessImport() {
    if (!uploadFile || !selectedTable) return;
    
    isProcessing = true;
    errorMessage = '';
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('table', selectedTable);
    
    // Si estamos en el paso de planes (id:3) y hay asignaciones, enviarlas
    if (currentStep.id === 3 && Object.keys(planAssignments).length > 0) {
        formData.append('plan_assignments', JSON.stringify(planAssignments));
    }

    try {
      const res = await fetch(`${API_BASE}/admin/import/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('employee_token')}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      if (res.ok) {
        successMessage = 'Importación completada exitosamente. Pasando al siguiente paso...';
        validationResult = null;
        uploadFile = null;
        loadHistory();
        
        // Auto-advance after short delay
        setTimeout(() => {
            nextStep();
            successMessage = ''; // Clear message for next step
        }, 2000);

      } else {
        const err = await res.json();
        errorMessage = err.message || 'Error al procesar la importación';
      }
    } catch (e) {
      errorMessage = 'Error de conexión';
    } finally {
      isProcessing = false;
    }
  }

  async function handleRollback(event: CustomEvent<number>) {
    if (!confirm('¿Estás seguro de que quieres revertir esta importación? Esta acción eliminará los registros creados.')) return;
    
    const id = event.detail;
    try {
      const res = await fetch(`${API_BASE}/admin/import/rollback/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('employee_token')}`,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        successMessage = 'Importación revertida correctamente';
        loadHistory();
      } else {
        const err = await res.json();
        errorMessage = err.message || 'Error al revertir';
      }
    } catch (e) {
      errorMessage = 'Error de conexión';
    }
  }

  function toggleSidebar() {
    appState.toggleSidebar();
  }
</script>

<main class="flex-1 overflow-y-auto bg-[#0f0f0f] text-gray-100">
  <Encabezado {toggleSidebar} />

<div class="container mx-auto px-4 py-8">
  <div class="mb-8">
    <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Asistente de Importación</h1>
    <p class="text-gray-600 dark:text-gray-400 mt-2">Sigue los pasos para importar tus datos y sincronizar con Mikrotik correctamente.</p>
  </div>

  <!-- Stepper Navigation -->
  <div class="mb-8">
    <div class="flex items-center justify-between relative">
        <div class="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700 -z-10"></div>
        {#each steps as step, index}
            <button 
                class="flex flex-col items-center group focus:outline-none"
                on:click={() => goToStep(index)}
            >
                <div class="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-200
                    {index === currentStepIndex ? 'bg-blue-600 border-blue-600 text-white' : 
                     index < currentStepIndex ? 'bg-green-500 border-green-500 text-white' : 
                     'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'}">
                    {#if index < currentStepIndex}
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    {:else}
                        {step.id}
                    {/if}
                </div>
                <span class="mt-2 text-xs font-medium {index === currentStepIndex ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}">
                    {step.title}
                </span>
            </button>
        {/each}
    </div>
  </div>

  {#if errorMessage}
    <div class="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative mb-4" role="alert">
      <span class="block sm:inline">{errorMessage}</span>
    </div>
  {/if}

  {#if successMessage}
    <div class="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded relative mb-4" role="alert">
      <span class="block sm:inline">{successMessage}</span>
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
    <!-- Panel Izquierdo: Instrucciones y Acciones -->
    <div class="col-span-1 space-y-6">
      <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-blue-500">
        <h2 class="text-xl font-bold mb-2 text-gray-800 dark:text-white">{currentStep.title}</h2>
        <p class="text-gray-600 dark:text-gray-300 mb-6">{currentStep.description}</p>
        
        {#if !currentStep.customView}
            <div class="space-y-4">
            <button
                class="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none transition-colors"
                disabled={isDownloading}
                on:click={handleDownloadTemplate}
            >
                {#if isDownloading}
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Descargando...
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    1. Descargar Plantilla CSV
                {/if}
            </button>

            <div class="relative">
                <div class="absolute inset-0 flex items-center" aria-hidden="true">
                <div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div class="relative flex justify-center">
                <span class="px-2 bg-white dark:bg-gray-800 text-sm text-gray-500">Luego</span>
                </div>
            </div>

            <ImportZone on:fileSelected={handleFileSelected} />
            
            {#if isUploading}
                <div class="mt-2 text-center text-sm text-blue-600 dark:text-blue-400 font-medium">Analizando archivo...</div>
            {/if}
            </div>
        {/if}
      </div>
      
      <!-- Navegación entre pasos -->
      <div class="flex justify-between items-center">
        <button
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-4 py-2 disabled:opacity-50"
            disabled={currentStepIndex === 0}
            on:click={prevStep}
        >
            &larr; Anterior
        </button>
        
        {#if currentStep.skippable}
            <button
                class="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 px-4 py-2 text-sm"
                on:click={nextStep}
            >
                Saltar este paso &rarr;
            </button>
        {/if}
      </div>
    </div>

    <!-- Panel Derecho: Vista Previa y Confirmación -->
    <div class="col-span-2 space-y-6">
      {#if currentStep.customView && currentStep.id === 3}
         <AssignPlanStep plans={availablePlans} />
      {:else if validationResult}
        <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow animate-fade-in">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Confirmar Importación</h2>
            {#if validationResult.valid && !isProcessing}
              <button
                class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors shadow-lg transform hover:-translate-y-0.5"
                on:click={handleProcessImport}
              >
                Importar Datos
              </button>
            {/if}
          </div>
          
          <PreviewTable 
            {validationResult} 
            plans={availablePlans} 
            showPlanSelector={currentStep.id === 3} 
            on:planChange={handlePlanAssignment}
          />
          
          {#if isProcessing}
            <div class="mt-6 flex flex-col items-center justify-center p-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <svg class="animate-spin h-10 w-10 text-blue-600 dark:text-blue-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-lg font-medium text-blue-800 dark:text-blue-300">Procesando importación...</span>
              <span class="text-sm text-blue-600 dark:text-blue-400 mt-1">Esto puede tomar unos momentos, especialmente si sincronizamos con Mikrotik.</span>
            </div>
          {/if}
        </div>
      {:else if !isUploading}
        <div class="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg h-full min-h-[300px] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 p-8 text-center">
            <svg class="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <h3 class="text-lg font-medium text-gray-500 dark:text-gray-400">Esperando archivo</h3>
            <p class="mt-1 max-w-sm">Descarga la plantilla del paso actual, complétala y súbela para ver la vista previa aquí.</p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Historial -->
  <div class="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
    <HistoryTable {history} on:rollback={handleRollback} />
  </div>
</div>
</main>
