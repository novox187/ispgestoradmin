<script>
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  let dragging = false;

  function handleDrop(e) {
    e.preventDefault();
    dragging = false;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      dispatch('fileSelected', files[0]);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    dragging = true;
  }

  function handleDragLeave() {
    dragging = false;
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
      dispatch('fileSelected', files[0]);
    }
  }
</script>

<div
  class="border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 cursor-pointer
  {dragging 
    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
    : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'}"
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:click={() => document.getElementById('fileInput').click()}
>
  <input
    type="file"
    id="fileInput"
    class="hidden"
    accept=".csv"
    on:change={handleFileSelect}
  />
  <div class="space-y-2">
    <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
    <div class="text-gray-600 dark:text-gray-300">
      <span class="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300">Sube un archivo</span>
      o arrastra y suelta
    </div>
    <p class="text-xs text-gray-500 dark:text-gray-400">CSV (.csv) hasta 10MB</p>
  </div>
</div>
