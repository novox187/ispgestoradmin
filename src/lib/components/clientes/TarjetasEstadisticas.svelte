    <script>
  /** @typedef {'active' | 'suspended' | 'inactive'} ClientStatus */
  /** @typedef {{ status: ClientStatus }} Client */
  /** @type {Client[]} */
        export let clients;
    </script>


    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-card border border-neutral-800 rounded-lg p-6">
            <p class="text-sm text-muted-foreground mb-1">Total de Clientes</p>
            <p class="text-2xl md:text-3xl font-bold text-foreground">{clients.length}</p>
        </div>
        <div class="bg-card border border-neutral-800 rounded-lg p-6">
            <p class="text-sm text-muted-foreground mb-1">Activos</p>
            <p class="text-2xl md:text-3xl font-bold text-green-500">{clients.filter(c => c.status
                === 'active').length}</p>
        </div>
        <div class="bg-card border border-neutral-800 rounded-lg p-6">
            <p class="text-sm text-muted-foreground mb-1">Suspendidos</p>
            <p class="text-2xl md:text-3xl font-bold text-yellow-500">{clients.filter(c => c.status
                === 'suspended').length}</p>
        </div>
        <div class="bg-card border border-neutral-800 rounded-lg p-6">
            <p class="text-sm text-muted-foreground mb-1">Inactivos</p>
            <p class="text-2xl md:text-3xl font-bold text-red-500">{clients.filter(c => c.status
                === 'inactive').length}</p>
        </div>
    </div>