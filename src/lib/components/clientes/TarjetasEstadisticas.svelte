<script>
    export let stats = { total: 0, active: 0, suspended: 0, inactive: 0 };
</script>

<div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
    <div class="bg-card border border-neutral-800 rounded-lg p-6">
        <p class="text-sm text-muted-foreground mb-1">Total de Clientes</p>
        <p class="text-2xl md:text-3xl font-bold text-foreground">{stats.total}</p>
    </div>
    <div class="bg-card border border-neutral-800 rounded-lg p-6">
        <p class="text-sm text-muted-foreground mb-1">Activos</p>
        <p class="text-2xl md:text-3xl font-bold text-green-500">{stats.active}</p>
    </div>
    <div class="bg-card border border-neutral-800 rounded-lg p-6">
        <p class="text-sm text-muted-foreground mb-1">Suspendidos</p>
        <p class="text-2xl md:text-3xl font-bold text-yellow-500">{stats.suspended}</p>
    </div>
    <div class="bg-card border border-neutral-800 rounded-lg p-6">
        <p class="text-sm text-muted-foreground mb-1">Inactivos</p>
        <p class="text-2xl md:text-3xl font-bold text-red-500">{stats.inactive}</p>
    </div>
</div>
