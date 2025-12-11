<script lang="ts">
    import Menu from "$lib/components/Menu.svelte";
    import Menuderecha from "$lib/components/Menuderecha.svelte";

    interface Client {
        id: number;
        name: string;
        email: string;
        phone: string;
        plan: string;
        status: 'active' | 'suspended' | 'inactive';
        joinDate: string;
    }

    type NewClient = Omit < Client, 'id' | 'joinDate' > ;

    let searchTerm = $state('');
    let statusFilter = $state('all');
    let showAddClient = $state(false);
    let newClient = $state < NewClient > ({
        name: '',
        email: '',
        phone: '',
        plan: '',
        status: 'active'
    });

    let clients = $state < Client[] > ([{
            id: 1,
            name: 'Juan García',
            email: 'juan@example.com',
            phone: '+34 912 345 678',
            plan: 'Premium',
            status: 'active',
            joinDate: '2024-01-15'
        },
        {
            id: 2,
            name: 'María López',
            email: 'maria@example.com',
            phone: '+34 923 456 789',
            plan: 'Business',
            status: 'active',
            joinDate: '2024-02-20'
        },
        {
            id: 3,
            name: 'Carlos Rodríguez',
            email: 'carlos@example.com',
            phone: '+34 934 567 890',
            plan: 'Basic',
            status: 'suspended',
            joinDate: '2023-11-10'
        },
        {
            id: 4,
            name: 'Ana Martínez',
            email: 'ana@example.com',
            phone: '+34 945 678 901',
            plan: 'Premium',
            status: 'active',
            joinDate: '2024-03-05'
        },
        {
            id: 5,
            name: 'Pedro Sánchez',
            email: 'pedro@example.com',
            phone: '+34 956 789 012',
            plan: 'Business',
            status: 'inactive',
            joinDate: '2023-12-01'
        },
    ]);

    let filteredClients = $derived(() => {
        return clients.filter(client => {
            const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    });

    function handleAddClient() {
        console.log('[v0] Adding client:', newClient);
        const newId = Math.max(...clients.map(c => c.id), 0) + 1;
        const newJoinDate = new Date().toISOString().split('T')[0];
        clients.push({
            ...newClient,
            id: newId,
            joinDate: newJoinDate
        });
        newClient = {
            name: '',
            email: '',
            phone: '',
            plan: '',
            status: 'active'
        };
        showAddClient = false;
    }

    function handleDeleteClient(id: number) {
        console.log('[v0] Deleting client:', id);
        const index = clients.findIndex(client => client.id === id);
        if (index !== -1) {
            clients.splice(index, 1);
        }
    }
</script>

    <div class="w-full mx-auto p-10">
        <!-- Header -->
        <div class="flex items-center justify-between mb-8">
            <div>
                <h1 class="text-3xl md:text-4xl font-bold text-foreground mb-2">Gestión de Clientes</h1>
                <p class="text-muted-foreground">Administra todos tus clientes de internet</p>
            </div>
            <div class="flex items-end justify-center">
                <button onclick={()=> (showAddClient = true)}
                    class="w-full px-6 py-2  bg-white text-gray-800 hover:bg-white/90 cursor-pointer rounded-lg transition font-medium"
                    >
                    + Agregar Cliente
                </button>
            </div>
        </div>

        <!-- Stats Cards -->
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

        <!-- Filters and Search -->
        <div class="bg-card border border-neutral-800 rounded-lg p-6 mb-8">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar
                        Cliente</label>
                    <input id="searchTerm" type="text" placeholder="Nombre o email..." bind:value={searchTerm}
                        class="w-full px-4 py-2 bg-background border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-foreground mb-2" for="statusFilter">Estado</label>
                    <select id="statusFilter" bind:value={statusFilter}
                        class="w-full px-4 py-2 bg-background border border-neutral-800 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="all">Todos</option>
                        <option value="active">Activo</option>
                        <option value="suspended">Suspendido</option>
                        <option value="inactive">Inactivo</option>
                    </select>
                </div>
            </div>
        </div>

        <!-- Clients Table -->
        <div class="bg-card border border-neutral-800 rounded-lg overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="border-b border-neutral-800 bg-accent/50">
                            <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Nombre</th>
                            <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Email</th>
                            <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Teléfono</th>
                            <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Plan</th>
                            <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Estado</th>
                            <th class="px-6 py-4 text-left text-sm font-semibold text-foreground">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each filteredClients() as client (client.id)}
              <tr class="border-b border-neutral-800 hover:bg-accent/50 transition">
                <td class="px-6 py-4 text-foreground">{client.name}</td>
                <td class="px-6 py-4 text-muted-foreground">{client.email}</td>
                <td class="px-6 py-4 text-muted-foreground">{client.phone}</td>
                <td class="px-6 py-4 text-foreground">{client.plan}</td>
                <td class="px-6 py-4">
                  <span
                    class={`px-3 py-1 rounded-full text-xs font-medium ${
                      client.status === 'active'
                        ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                        : client.status === 'suspended'
                          ? 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                          : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                    }`}
                  >
                    {client.status === 'active'
                      ? 'Activo'
                      : client.status === 'suspended'
                        ? 'Suspendido'
                        : 'Inactivo'}
                  </span>
                </td>
                <td class="px-6 py-4">
                  <div class="flex gap-2">
                    <button class="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition">
                      Ver
                    </button>
                    <button
                      onclick={() => handleDeleteClient(client.id)}
                      class="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Client Modal -->
    {#if showAddClient}
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
        <div class="bg-card border border-neutral-800 rounded-lg max-w-md w-full p-6">
          <h2 class="text-xl font-bold text-foreground mb-4">Agregar Nuevo Cliente</h2>
          <div class="space-y-4 mb-6">
            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="newClientName">Nombre</label>
              <input
                id="newClientName"
                type="text"
                placeholder="Nombre completo"
                bind:value={newClient.name}
                class="w-full px-4 py-2 bg-background border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="newClientEmail">Email</label>
              <input
                id="newClientEmail"
                type="email"
                placeholder="email@example.com"
                bind:value={newClient.email}
                class="w-full px-4 py-2 bg-background border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="newClientPhone">Teléfono</label>
              <input
                id="newClientPhone"
                type="tel"
                placeholder="+34 XXX XXX XXX"
                bind:value={newClient.phone}
                class="w-full px-4 py-2 bg-background border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="newClientPlan">Plan</label>
              <select
                id="newClientPlan"
                bind:value={newClient.plan}
                class="w-full px-4 py-2 bg-background border border-neutral-800 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Seleccionar plan</option>
                <option value="Basic">Basic</option>
                <option value="Premium">Premium</option>
                <option value="Business">Business</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-foreground mb-2" for="newClientStatus">Estado</label>
              <select
                id="newClientStatus"
                bind:value={newClient.status}
                class="w-full px-4 py-2 bg-background border border-neutral-800 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="active">Activo</option>
                <option value="suspended">Suspendido</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3">
            <button
              onclick={() => (showAddClient = false)}
              class="flex-1 px-4 py-2 bg-accent text-foreground rounded-lg hover:bg-accent/80 transition font-medium"
            >
              Cancelar
            </button>
            <button
              onclick={handleAddClient}
              class="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>