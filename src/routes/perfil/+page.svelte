<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { User, Mail, Phone, Shield, Save, X, Edit2, CheckCircle, AlertCircle, Loader2 } from '@lucide/svelte';
  import { API_BASE } from '$lib/config';
  import Encabezado from '$lib/components/Encabezado.svelte';
  import { appState } from '$lib/stores/app.svelte';

  // Tipos
    interface Employee {
        id: number;
        name: string;
        email: string;
        phone: string;
        role: string;
        status: string;
        role_id?: number;
        permissions?: string[];
        [key: string]: any; // Permitir otras propiedades
    }

  // Estado
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let isEditing = $state(false);
  let employee = $state<Employee | null>(null);
  
  // Estado del formulario
  let form = $state({
    name: '',
    email: '',
    phone: '',
  });

  let errors = $state({
    name: '',
    email: '',
    phone: '',
  });

  // Validaciones reactivas
  function validateField(field: 'name' | 'email' | 'phone') {
    if (!isEditing) return;
    
    switch (field) {
      case 'name':
        errors.name = (!form.name || form.name.length < 3) ? 'El nombre debe tener al menos 3 caracteres' : '';
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        errors.email = (!form.email || !emailRegex.test(form.email)) ? 'Ingrese un correo electrónico válido' : '';
        break;
      case 'phone':
        errors.phone = (!form.phone || form.phone.length < 8) ? 'El teléfono debe tener al menos 8 dígitos' : '';
        break;
    }
  }

  // Validaciones
  function validate() {
    let isValid = true;
    errors = { name: '', email: '', phone: '' };

    if (!form.name || form.name.length < 3) {
      errors.name = 'El nombre debe tener al menos 3 caracteres';
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email || !emailRegex.test(form.email)) {
      errors.email = 'Ingrese un correo electrónico válido';
      isValid = false;
    }

    if (!form.phone || form.phone.length < 8) {
      errors.phone = 'El teléfono debe tener al menos 8 dígitos';
      isValid = false;
    }

    return isValid;
  }

  // Cargar datos
  onMount(async () => {
    try {
      const token = localStorage.getItem('employee_token');
      const id = localStorage.getItem('employee_id');

      if (!token) throw new Error('No hay sesión activa');
      
      let url = `${API_BASE}/user`; // Ahora /user también usa la estructura completa
      if (id) {
        url = `${API_BASE}/admin/employees/show/${id}`;
      }

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
   

      if (!res.ok) {
        if (res.status === 401) throw new Error('Sesión expirada');
        throw new Error('No se pudo cargar la información del perfil');
      }

      const data = await res.json();
      // Ajustar según la respuesta de la API (puede venir directo o en data.employee)
      const rawEmployee = data.employee || data.user || data;
      
      if (rawEmployee) {
        // Normalizar datos
        employee = {
          id: rawEmployee.id,
          name: rawEmployee.name || rawEmployee.nombre || 'Usuario',
          email: rawEmployee.email || '',
          phone: rawEmployee.phone || rawEmployee.telefono || '',
          role: rawEmployee.role || rawEmployee.rol || 'Empleado',
          status: rawEmployee.status || 'active',
          role_id: rawEmployee.role_id,
          permissions: rawEmployee.permissions || data.permissions || []
        };
        resetForm();
      } else {
        throw new Error('Datos de empleado no encontrados');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error desconocido';
    } finally {
      loading = false;
    }
  });

  function resetForm() {
    if (employee) {
      form = {
        name: employee.name,
        email: employee.email,
        phone: employee.phone
      };
      errors = { name: '', email: '', phone: '' };
    }
  }

  function toggleEdit() {
    if (isEditing) {
      // Cancelar edición
      resetForm();
      isEditing = false;
    } else {
      isEditing = true;
    }
  }

  async function handleSave() {
    if (!validate()) return;
    if (!employee) return;

    saving = true;
    error = null;
    success = null;

    try {
      const token = localStorage.getItem('employee_token');
      
      const payload: any = {
        name: form.name,
        email: form.email,
        phone: form.phone
      };
      
      // Solo enviamos role_id si lo tenemos, para evitar cambiar el rol accidentalmente
      if (employee.role_id) {
        payload.role_id = employee.role_id;
      }

      const res = await fetch(`${API_BASE}/admin/employees/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al guardar los cambios');
      }

      const updatedData = await res.json();
      employee = { ...employee, ...form }; // Actualización optimista o usar updatedData
      
      // Actualizar localStorage si cambió el nombre
      localStorage.setItem('employee_nombre', form.name);
      
      success = 'Perfil actualizado correctamente';
      isEditing = false;
      
      setTimeout(() => success = null, 3000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Error al guardar';
    } finally {
      saving = false;
    }
  }

  function toggleSidebar() {
    appState.toggleSidebar();
  }
</script>

<main class="flex-1 overflow-y-auto bg-[#0f0f0f] text-gray-100">
  <Encabezado {toggleSidebar} />

<div class="p-4 md:p-6 max-w-7xl mx-auto space-y-6 w-full">
  <!-- Header -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
    <div>
      <h1 class="text-2xl font-bold text-white flex items-center gap-2">
        <User class="w-6 h-6 text-blue-500" />
        Mi Perfil
      </h1>
      <p class="text-neutral-400 text-sm mt-1">Gestiona tu información personal y laboral</p>
    </div>
    
    {#if !loading && !error}
      <button 
        onclick={toggleEdit}
        class="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 
        {isEditing 
          ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700' 
          : 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300'}"
      >
        {#if isEditing}
          <X class="w-4 h-4" />
          <span>Cancelar</span>
        {:else}
          <Edit2 class="w-4 h-4" />
          <span>Editar Perfil</span>
        {/if}
      </button>
    {/if}
  </div>

  <!-- Content -->
  {#if loading}
    <div class="flex flex-col items-center justify-center py-20 text-neutral-500">
      <Loader2 class="w-8 h-8 animate-spin mb-2 text-blue-500" />
      <p>Cargando información...</p>
    </div>
  {:else if error}
    <div class="bg-red-900/20 border border-red-900/50 text-red-300 p-4 rounded-xl flex items-center gap-3" transition:fade>
      <AlertCircle class="w-5 h-5 shrink-0" />
      <p>{error}</p>
    </div>
  {:else if employee}
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6" transition:fade>
      
      <!-- Card Izquierda: Avatar y Rol -->
      <div class="md:col-span-1 lg:col-span-1 space-y-6">
        <div class="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden group">
          <div class="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div class="relative mb-4">
            <div class="w-24 h-24 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-900 border-2 border-neutral-700 flex items-center justify-center shadow-xl">
              <span class="text-3xl font-bold text-neutral-300">{(employee.name || '?').charAt(0).toUpperCase()}</span>
            </div>
            <div class="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-4 border-neutral-900 rounded-full" title="Activo"></div>
          </div>
          
          <h2 class="text-lg font-bold text-white mb-1">{employee.name || 'Sin nombre'}</h2>
          <p class="text-sm text-neutral-400 mb-4">{employee.email}</p>
          
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
            <Shield class="w-3 h-3" />
            {employee.role || 'Empleado'}
          </div>
        </div>

        <!-- Estadísticas o Info Adicional (Placeholder) -->
        <div class="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <h3 class="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-4">Estado de Cuenta</h3>
          <div class="space-y-3">
             <div class="flex justify-between items-center text-sm">
                <span class="text-neutral-500">Estado</span>
                <span class="text-green-400 bg-green-400/10 px-2 py-0.5 rounded text-xs font-medium">Activo</span>
             </div>
             <div class="flex justify-between items-center text-sm">
                <span class="text-neutral-500">ID Empleado</span>
                <span class="text-neutral-300 font-mono">#{employee.id}</span>
             </div>
          </div>
        </div>
      </div>

      <!-- Card Derecha: Formulario -->
      <div class="md:col-span-2 lg:col-span-3 bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6 relative">
        {#if success}
          <div class="absolute top-4 right-4 left-4 z-10 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg backdrop-blur-sm" transition:slide>
            <CheckCircle class="w-4 h-4" />
            {success}
          </div>
        {/if}

        <h3 class="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <span class="w-1 h-6 bg-blue-500 rounded-full"></span>
          Información Personal
        </h3>

        <div class="space-y-6">
          <!-- Nombre -->
          <div class="space-y-2">
            <label for="name" class="text-sm font-medium text-neutral-400">Nombre Completo</label>
            {#if isEditing}
              <div class="relative">
                <User class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="text" 
                  id="name" 
                  bind:value={form.name} 
                  oninput={() => validateField('name')}
                  class="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none {errors.name ? 'border-red-500/50 focus:border-red-500' : ''}"
                  placeholder="Tu nombre completo"
                />
              </div>
              {#if errors.name}
                <p class="text-red-400 text-xs mt-1" transition:slide>{errors.name}</p>
              {/if}
            {:else}
              <div class="text-neutral-200 text-lg py-1 border-b border-transparent">{employee.name}</div>
            {/if}
          </div>

          <!-- Email -->
          <div class="space-y-2">
            <label for="email" class="text-sm font-medium text-neutral-400">Correo Electrónico</label>
            {#if isEditing}
              <div class="relative">
                <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="email" 
                  id="email" 
                  bind:value={form.email} 
                  oninput={() => validateField('email')}
                  class="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none {errors.email ? 'border-red-500/50 focus:border-red-500' : ''}"
                  placeholder="ejemplo@correo.com"
                />
              </div>
              {#if errors.email}
                <p class="text-red-400 text-xs mt-1" transition:slide>{errors.email}</p>
              {/if}
            {:else}
              <div class="text-neutral-200 text-lg py-1 border-b border-transparent">{employee.email}</div>
            {/if}
          </div>

          <!-- Teléfono -->
          <div class="space-y-2">
            <label for="phone" class="text-sm font-medium text-neutral-400">Teléfono</label>
            {#if isEditing}
              <div class="relative">
                <Phone class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input 
                  type="tel" 
                  id="phone" 
                  bind:value={form.phone} 
                  oninput={() => validateField('phone')}
                  class="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none {errors.phone ? 'border-red-500/50 focus:border-red-500' : ''}"
                  placeholder="+56 9 1234 5678"
                />
              </div>
              {#if errors.phone}
                <p class="text-red-400 text-xs mt-1" transition:slide>{errors.phone}</p>
              {/if}
            {:else}
              <div class="text-neutral-200 text-lg py-1 border-b border-transparent">{employee.phone || 'No registrado'}</div>
            {/if}
          </div>

          <!-- Botones de Acción (Solo en edición) -->
          {#if isEditing}
            <div class="flex items-center justify-end gap-3 pt-6 border-t border-neutral-800/50" transition:slide>
              <button 
                onclick={toggleEdit}
                class="px-4 py-2 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                disabled={saving}
              >
                Cancelar
              </button>
              <button 
                onclick={handleSave}
                disabled={saving}
                class="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {#if saving}
                  <Loader2 class="w-4 h-4 animate-spin" />
                  Guardando...
                {:else}
                  <Save class="w-4 h-4" />
                  Guardar Cambios
                {/if}
              </button>
            </div>
          {/if}
        </div>

        <!-- Sección de Rol y Permisos -->
        <div class="mt-8 pt-6 border-t border-neutral-800/50">
            <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span class="w-1 h-6 bg-purple-500 rounded-full"></span>
                Rol y Permisos
            </h3>
            
            <div class="bg-neutral-950/50 rounded-xl p-4 border border-neutral-800">
                <div class="flex items-center gap-3 mb-4">
                    <div class="p-2 bg-purple-500/10 rounded-lg">
                        <Shield class="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <div class="text-sm text-neutral-400">Rol Asignado</div>
                        <div class="text-white font-medium">{employee.role || 'Sin rol asignado'}</div>
                    </div>
                </div>

                {#if employee.permissions && employee.permissions.length > 0}
                    <div class="space-y-2">
                        <div class="text-xs font-medium text-neutral-500 uppercase tracking-wider">Permisos Activos</div>
                        <div class="flex flex-wrap gap-2">
                            {#each employee.permissions as permission}
                                <span class="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-mono">
                                    {permission}
                                </span>
                            {/each}
                        </div>
                    </div>
                {:else}
                    <p class="text-sm text-neutral-500 italic">Este rol no tiene permisos específicos asignados o no se pudieron cargar.</p>
                {/if}
            </div>
        </div>
      </div>
    </div>
  {/if}
</div>
</main>
