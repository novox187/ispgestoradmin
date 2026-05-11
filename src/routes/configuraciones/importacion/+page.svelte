<script lang="ts">
  import { onMount } from 'svelte';
  import { API_BASE } from '$lib/config';
  import ImportZone from '$lib/components/import/ImportZone.svelte';
  import PreviewTable from '$lib/components/import/PreviewTable.svelte';
  import HistoryTable from '$lib/components/import/HistoryTable.svelte';
  import AssignPlanStep from '$lib/components/import/steps/AssignPlanStep.svelte';
  import {
    Database, Download, CheckCircle2, AlertCircle,
    ChevronLeft, ChevronRight, SkipForward
  } from '@lucide/svelte';

  interface Step {
    id: number;
    table: string;
    title: string;
    shortTitle: string;
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

  const steps: Step[] = [
    {
      id: 1,
      table: 'plans',
      title: 'Importar Planes',
      shortTitle: 'Planes',
      description: 'Define los planes de internet disponibles. Se crearán las colas base en Mikrotik.',
      skippable: true,
    },
    {
      id: 2,
      table: 'clients',
      title: 'Importar Clientes',
      shortTitle: 'Clientes',
      description: 'Registra la información personal de tus clientes. Se crearán sus billeteras automáticamente.',
      skippable: true,
    },
    {
      id: 3,
      table: 'clients_plans',
      title: 'Asignar Planes',
      shortTitle: 'Asignación',
      description: 'Selecciona los clientes sin plan y asígnales uno. Se crearán las colas en Mikrotik.',
      skippable: true,
      customView: true,
    },
    {
      id: 4,
      table: 'invoices',
      title: 'Importar Facturas',
      shortTitle: 'Facturas',
      description: 'Importa facturas históricas de tu sistema anterior (paso opcional).',
      skippable: true,
    },
  ];

  let currentStepIndex = $state(0);
  let history = $state<HistoryItem[]>([]);
  let validationResult = $state<ValidationResult | null>(null);
  let isUploading = $state(false);
  let isProcessing = $state(false);
  let isDownloading = $state(false);
  let uploadFile = $state<File | null>(null);
  let errorMessage = $state('');
  let successMessage = $state('');
  let availablePlans = $state<Plan[]>([]);
  let planAssignments = $state<Record<number, string>>({});

  const currentStep = $derived(steps[currentStepIndex]);

  async function loadHistory() {
    try {
      const res = await fetch(`${API_BASE}/admin/import/history`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('employee_token')}`,
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        history = data.data;
      }
    } catch (e) {
      console.error('Error loading history:', e);
    }
  }

  async function loadPlans() {
    try {
      const res = await fetch(`${API_BASE}/plans`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('employee_token')}`,
          Accept: 'application/json',
        },
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

  function handlePlanAssignment(event: CustomEvent<{ rowIndex: number; planId: string }>) {
    const { rowIndex, planId } = event.detail;
    planAssignments[rowIndex] = planId;
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
    isDownloading = true;
    errorMessage = '';
    try {
      const res = await fetch(`${API_BASE}/admin/import/template/${currentStep.table}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('employee_token')}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `template_${currentStep.table}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        errorMessage = 'Error al descargar la plantilla';
      }
    } catch {
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
    isUploading = true;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('table', currentStep.table);

    try {
      const res = await fetch(`${API_BASE}/admin/import/validate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('employee_token')}`,
          Accept: 'application/json',
        },
        body: formData,
      });
      if (res.ok) {
        validationResult = await res.json();
      } else {
        const err = await res.json();
        errorMessage = err.message || 'Error en la validación';
      }
    } catch {
      errorMessage = 'Error al subir el archivo';
    } finally {
      isUploading = false;
    }
  }

  async function handleProcessImport() {
    if (!uploadFile) return;
    isProcessing = true;
    errorMessage = '';

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('table', currentStep.table);
    if (currentStep.id === 3 && Object.keys(planAssignments).length > 0) {
      formData.append('plan_assignments', JSON.stringify(planAssignments));
    }

    try {
      const res = await fetch(`${API_BASE}/admin/import/process`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('employee_token')}`,
          Accept: 'application/json',
        },
        body: formData,
      });
      if (res.ok) {
        successMessage = 'Importación completada. Avanzando al siguiente paso...';
        validationResult = null;
        uploadFile = null;
        loadHistory();
        setTimeout(() => {
          nextStep();
          successMessage = '';
        }, 2000);
      } else {
        const err = await res.json();
        errorMessage = err.message || 'Error al procesar la importación';
      }
    } catch {
      errorMessage = 'Error de conexión';
    } finally {
      isProcessing = false;
    }
  }

  async function handleRollback(event: CustomEvent<number>) {
    if (!confirm('¿Revertir esta importación? Se eliminarán los registros creados.')) return;
    const id = event.detail;
    try {
      const res = await fetch(`${API_BASE}/admin/import/rollback/${id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('employee_token')}`,
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        successMessage = 'Importación revertida correctamente';
        loadHistory();
      } else {
        const err = await res.json();
        errorMessage = err.message || 'Error al revertir';
      }
    } catch {
      errorMessage = 'Error de conexión';
    }
  }
</script>

<div class="px-4 md:px-8 py-8 max-w-6xl">

  <!-- Header -->
  <div class="mb-6">
    <div class="flex items-center gap-2.5 mb-1.5">
      <Database class="w-5 h-5 text-primary-400" />
      <h2 class="text-lg font-semibold text-neutral-100">Asistente de Importación</h2>
    </div>
    <p class="text-sm text-neutral-500">
      Sigue los pasos para importar tus datos y sincronizarlos con Mikrotik correctamente.
    </p>
  </div>

  <!-- Stepper -->
  <div class="mb-8">
    <div class="flex items-center gap-0">
      {#each steps as step, index}
        <button
          class="flex-1 flex flex-col items-center gap-1.5 group focus:outline-none"
          onclick={() => goToStep(index)}
          aria-label="Ir al paso {step.shortTitle}"
        >
          <!-- Línea + círculo -->
          <div class="flex items-center w-full">
            <!-- Línea izquierda -->
            <div class="flex-1 h-px {index === 0 ? 'opacity-0' : index <= currentStepIndex ? 'bg-primary-500/60' : 'bg-neutral-800'}"></div>
            <!-- Círculo -->
            <div class="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-200 shrink-0
              {index === currentStepIndex
                ? 'border-primary-500 bg-primary-500/15 text-primary-400'
                : index < currentStepIndex
                  ? 'border-success-500 bg-success-500/15 text-success-500'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-600'}">
              {#if index < currentStepIndex}
                <CheckCircle2 class="w-4 h-4" />
              {:else}
                <span class="text-xs font-bold">{step.id}</span>
              {/if}
            </div>
            <!-- Línea derecha -->
            <div class="flex-1 h-px {index === steps.length - 1 ? 'opacity-0' : index < currentStepIndex ? 'bg-primary-500/60' : 'bg-neutral-800'}"></div>
          </div>
          <!-- Label -->
          <span class="text-[10px] font-medium hidden sm:block
            {index === currentStepIndex ? 'text-primary-400' : index < currentStepIndex ? 'text-success-400' : 'text-neutral-600'}">
            {step.shortTitle}
          </span>
        </button>
      {/each}
    </div>
  </div>

  <!-- Mensajes globales -->
  {#if errorMessage}
    <div class="flex items-start gap-3 p-3.5 rounded-lg bg-danger-900/30 border border-danger-700/40 text-danger-300 text-sm mb-6" role="alert">
      <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
      <span>{errorMessage}</span>
    </div>
  {/if}
  {#if successMessage}
    <div class="flex items-start gap-3 p-3.5 rounded-lg bg-success-900/30 border border-success-700/40 text-success-300 text-sm mb-6" role="alert">
      <CheckCircle2 class="w-4 h-4 shrink-0 mt-0.5" />
      <span>{successMessage}</span>
    </div>
  {/if}

  <!-- Contenido del paso actual -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

    <!-- Panel izquierdo: instrucciones -->
    <div class="col-span-1 space-y-4">
      <div class="p-5 rounded-xl bg-surface-elevated border border-neutral-800/70 border-l-2 border-l-primary-500">
        <h3 class="text-sm font-semibold text-neutral-100 mb-1">{currentStep.title}</h3>
        <p class="text-xs text-neutral-500 leading-relaxed mb-5">{currentStep.description}</p>

        {#if !currentStep.customView}
          <div class="space-y-3">
            <!-- Descargar plantilla -->
            <button
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700
                     text-xs font-medium text-neutral-300 bg-neutral-800/60 hover:bg-neutral-700/60
                     hover:border-neutral-600 hover:text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isDownloading}
              onclick={handleDownloadTemplate}
            >
              {#if isDownloading}
                <div class="w-3.5 h-3.5 border-2 border-neutral-400/30 border-t-neutral-400 rounded-full animate-spin"></div>
                Descargando...
              {:else}
                <Download class="w-3.5 h-3.5 text-primary-400" />
                1. Descargar Plantilla CSV
              {/if}
            </button>

            <!-- Separador -->
            <div class="flex items-center gap-2">
              <div class="flex-1 h-px bg-neutral-800"></div>
              <span class="text-[10px] text-neutral-600 font-mono">LUEGO</span>
              <div class="flex-1 h-px bg-neutral-800"></div>
            </div>

            <!-- Zona de carga -->
            <ImportZone on:fileSelected={handleFileSelected} />

            {#if isUploading}
              <div class="flex items-center justify-center gap-2 text-xs text-primary-400 py-2">
                <div class="w-3.5 h-3.5 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin"></div>
                Analizando archivo...
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Navegación entre pasos -->
      <div class="flex items-center justify-between">
        <button
          class="flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:text-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          disabled={currentStepIndex === 0}
          onclick={prevStep}
        >
          <ChevronLeft class="w-3.5 h-3.5" />
          Anterior
        </button>

        {#if currentStep.skippable}
          <button
            class="flex items-center gap-1.5 px-3 py-2 text-xs text-neutral-500 hover:text-primary-400 transition-colors"
            onclick={nextStep}
          >
            Saltar
            <SkipForward class="w-3.5 h-3.5" />
          </button>
        {/if}
      </div>
    </div>

    <!-- Panel derecho: vista previa / asignación -->
    <div class="col-span-2">
      {#if currentStep.customView && currentStep.id === 3}
        <AssignPlanStep plans={availablePlans} />
      {:else if validationResult}
        <div class="p-5 rounded-xl bg-surface-elevated border border-neutral-800/70">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-sm font-semibold text-neutral-100">Confirmar Importación</h3>
            {#if validationResult.valid && !isProcessing}
              <button
                class="flex items-center gap-2 px-4 py-2 rounded-lg bg-success-600 hover:bg-success-500 text-white text-xs font-semibold transition-colors shadow-lg"
                onclick={handleProcessImport}
              >
                <CheckCircle2 class="w-3.5 h-3.5" />
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
            <div class="mt-6 flex flex-col items-center justify-center p-8 rounded-lg bg-primary-500/5 border border-primary-500/15">
              <div class="w-10 h-10 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin mb-4"></div>
              <span class="text-sm font-medium text-primary-300">Procesando importación...</span>
              <span class="text-xs text-primary-400/60 mt-1">Esto puede tardar si se sincroniza con Mikrotik.</span>
            </div>
          {/if}
        </div>
      {:else if !isUploading}
        <div class="flex flex-col items-center justify-center h-full min-h-[280px] rounded-xl border-2 border-dashed border-neutral-800/70 bg-neutral-900/20 text-neutral-600 p-8 text-center">
          <Database class="w-12 h-12 mb-3 text-neutral-800" />
          <p class="text-sm font-medium text-neutral-500">Sin archivo cargado</p>
          <p class="text-xs mt-1 max-w-xs">
            Descarga la plantilla del paso actual, complétala y súbela para ver la vista previa aquí.
          </p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Historial de importaciones -->
  <div class="pt-6 border-t border-neutral-800/60">
    <HistoryTable {history} on:rollback={handleRollback} />
  </div>
</div>
