<script lang="ts">
  import { goto } from "$app/navigation";
  import { API_BASE } from "$lib/config";
  let email = "";
  let password = "";
  let loading = false;
  let errorMsg = "";
  async function handleLogin(event: SubmitEvent) {
    event.preventDefault();
    errorMsg = "";
    loading = true;
    try {
      const res = await fetch(`${API_BASE}/employee/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data && (data.message || (data.errors ? JSON.stringify(data.errors) : null))) || null;
        throw new Error(msg || "Credenciales inválidas");
      }
      const data = await res.json();
      const token = data?.token;
      // Intenta obtener el rol desde diferentes estructuras posibles
      const role = data?.role || data?.user?.role || data?.usuario?.rol || "employee";
      // Intenta obtener el nombre desde diferentes estructuras posibles, incluyendo data.employee
      const nombre = data?.employee?.nombre || data?.user?.name || data?.usuario?.nombre || data?.admin?.nombre || "";
      // Intenta obtener el ID del empleado
      const employeeId = data?.employee?.id || data?.user?.id || data?.usuario?.id || "";

      if (!token) throw new Error("No se recibió el token de autenticación");
      if (String(role).toLowerCase() !== "employee") throw new Error("No autorizado");
      
      localStorage.setItem("employee_token", token);
      
      // Guardar el nombre real del rol si está disponible en los datos del empleado
      const realRole = data?.employee?.role || data?.employee?.rol || role;
      localStorage.setItem("employee_role", String(realRole));
      
      if (nombre) localStorage.setItem("employee_nombre", nombre);
      if (employeeId) localStorage.setItem("employee_id", String(employeeId));
      
      goto("/", { replaceState: true });
    } catch (err) {
      errorMsg = err instanceof Error && err.message === "No autorizado" ? "Acceso restringido al área administrativa" : "El correo electrónico o la contraseña son incorrectos";
    } finally {
      loading = false;
    }
  }
</script>
<div class="min-h-screen w-full grid place-items-center bg-[#0f0f0f] text-gray-100 p-6">
  <form class="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4" on:submit|preventDefault={handleLogin}>
    <h1 class="text-xl font-bold">Admin Login</h1>
    {#if errorMsg}
      <div class="text-sm p-3 rounded bg-red-900/30 text-red-300">{errorMsg}</div>
    {/if}
    <div class="space-y-2">
      <label for="email" class="text-sm">Correo electrónico</label>
      <input id="email" name="email" type="email" bind:value={email} required class="w-full px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none text-gray-100" placeholder="admin@ejemplo.com" />
    </div>
    <div class="space-y-2">
      <label for="password" class="text-sm">Contraseña</label>
      <input id="password" name="password" type="password" bind:value={password} required class="w-full px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 focus:outline-none text-gray-100" placeholder="••••••••" />
    </div>
    <button type="submit" disabled={loading} class="w-full font-semibold py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
      {#if loading}Procesando...{:else}Entrar{/if}
    </button>
  </form>
</div>
