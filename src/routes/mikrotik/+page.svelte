<script lang="ts">
  import { MIKROTIK_MODULES } from '$lib/mikrotik/modules';
</script>

<div class="space-y-6">
  <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
    <div class="bg-[#111111] border border-neutral-800 rounded-xl p-5">
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h3 class="text-base md:text-lg font-semibold text-gray-100">Accesos rápidos</h3>
          <p class="text-xs md:text-sm text-gray-400 leading-relaxed">
            Entra a cada sección para operar colas, firewall, monitoreo y dispositivos.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {#each MIKROTIK_MODULES.filter((m) => m.id !== 'overview') as m (m.id)}
          <a
            href={m.href}
            class="group border border-neutral-800 rounded-xl p-4 bg-neutral-900/30 hover:bg-neutral-900/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <m.icon class="w-4 h-4 text-blue-300" />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-semibold text-gray-100 truncate">{m.label}</div>
                <div class="text-xs text-gray-500 leading-snug line-clamp-2">{m.description}</div>
              </div>
            </div>
          </a>
        {/each}
      </div>
    </div>

    <div class="bg-[#111111] border border-neutral-800 rounded-xl p-5">
      <div class="space-y-1">
        <h3 class="text-base md:text-lg font-semibold text-gray-100">Guía de uso</h3>
        <p class="text-xs md:text-sm text-gray-400 leading-relaxed">
          Los cambios de configuración deben validarse antes de aplicarse al router. Usa “Colas” para sincronización segura y
          “Firewall” para preparar reglas con validaciones en tiempo real.
        </p>
      </div>

      <div class="mt-4 border border-neutral-800 rounded-xl p-4 bg-neutral-900/30">
        <div class="text-xs font-mono text-gray-400 tracking-wide mb-1">RECOMENDACIÓN</div>
        <div class="text-sm text-gray-200 leading-relaxed">
          Ejecuta sincronizaciones de colas fuera de horas pico y revisa el estado del router en Monitoreo antes de aplicar cambios.
        </div>
      </div>
    </div>
  </div>
</div>
