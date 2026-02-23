<script lang="ts">
  interface Props {
    online?: boolean;
    activeClients?: number;
    totalClients?: number;
    cpuLoad?: string;
    uptime?: string;
  }

  let { 
    online = true, 
    activeClients = 0, 
    totalClients = 0, 
    cpuLoad = "0%", 
    uptime = "0d 0h 0m" 
  }: Props = $props();

  function formatUptime(raw: string): string {
    if (!raw || raw === 'Offline') return 'Offline';
    const parts = raw.match(/(\d+[wdhms])/g);
    if (!parts) return raw;
    return parts
      .slice(0, 3)
      .join(' ')
      .replace('w', 'sem')
      .replace('d', 'd')
      .replace('h', 'h')
      .replace('m', 'm')
      .replace('s', 's');
  }
</script>

<div class="bg-[#1a1a1a] border border-gray-800 rounded-lg p-2 md:p-3">
  <div class="flex items-center justify-between mb-2 md:mb-2">
    <div class="flex items-center gap-2 text-xs font-mono text-gray-400">
      <div class={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}></div>
      ESTADO DEL ROUTER
    </div>
    <div class={`${online ? 'bg-green-700/20 border-green-700 text-green-600' : 'bg-red-700/20 border-red-700 text-red-600'} border px-3 py-1 rounded-md text-xs font-bold`}>
      {online ? 'ONLINE' : 'OFFLINE'}
    </div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 bg-[#181617] rounded-lg p-2 md:p-3">
    <div class="space-y-3 md:space-y-4">
      <div class="border border-green-600 rounded-lg p-3 md:p-4">
        <div class="flex items-center gap-2 text-xs font-mono text-gray-400 mb-2">
          <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          CLIENTES CONECTADOS
        </div>
        <div class="text-2xl md:text-3xl font-bold text-green-500">{activeClients}/{totalClients}</div>
      </div>

      <div class="border border-green-600 rounded-lg p-3 md:p-4">
        <div class="flex items-center gap-2 text-xs font-mono text-gray-400 mb-2">
          <div class="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          CARGA DE CPU
        </div>
        <div class="text-2xl md:text-3xl font-bold text-green-500">{cpuLoad}</div>
      </div>

      <div class="border border-orange-600 rounded-lg p-3 md:p-4">
        <div class="flex items-center gap-2 text-xs font-mono text-gray-400 mb-2">
          <div class="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
          TIEMPO DE ACTIVIDAD
        </div>
        <div class="text-xl md:text-2xl font-bold text-orange-500 truncate" title={uptime}>
            {formatUptime(uptime)}
        </div>
        <div class="text-xs font-mono text-gray-500 mt-1">[UPTIME]</div>
      </div>
    </div>

    <div class="flex items-center justify-center order-first md:order-last">
      <img 
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bot_greenprint-B6PxnxvJNSRzVluqX5dA83cj4ptvnD.gif" 
        alt="Security Robot Wireframe" 
        class="w-full h-auto max-w-[200px] md:max-w-[280px] opacity-90"
      />
    </div>
  </div>
</div>
