<script lang="ts">
    import ModalCrearCliente from "$lib/components/clientes/ModalCrearCliente.svelte";
    import TablaClientes from "$lib/components/clientes/TablaClientes.svelte";
    import TarjetasEstadisticas from "$lib/components/clientes/TarjetasEstadisticas.svelte";

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

    let filteredClients = $state<Client[]>([]);

    $effect(() => {
        filteredClients = clients.filter(client => {
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
	function handleCloseModal() {
		showAddClient = false;
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
     <TarjetasEstadisticas clients={clients}/>

    <!-- Filters and Search -->
    <div class="bg-card border border-neutral-800 rounded-lg p-6 mb-8">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="searchTerm">Buscar
                    Cliente</label>
                <input id="searchTerm" type="text" placeholder="Nombre o email..." bind:value={searchTerm}
                    class="w-full px-4 py-2 border border-neutral-800 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0" />
            </div>
            <div>
                <label class="block text-sm font-medium text-foreground mb-2" for="statusFilter">Estado</label>
                <select id="statusFilter" bind:value={statusFilter}
                    class="w-full px-5 py-2 border border-neutral-800 rounded-lg focus:outline-none focus:ring-0 bg-neutral-900">
                    <option value="all">Todos</option>
                    <option value="active">Activo</option>
                    <option value="suspended">Suspendido</option>
                    <option value="inactive">Inactivo</option>
                </select>
            </div>
        </div>
    </div>

    <!-- Clients Table -->
     <TablaClientes  filteredClients={filteredClients} handleDeleteClient={handleDeleteClient}/>

    <!-- Add Client Modal -->
    {#if showAddClient}
    <ModalCrearCliente
    	{newClient}
	    {showAddClient}
	    {handleAddClient}
	    on:close={handleCloseModal}
    />
    {/if}
  </div>
