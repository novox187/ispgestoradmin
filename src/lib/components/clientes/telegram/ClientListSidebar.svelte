<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Search, User } from '@lucide/svelte';

    interface ClientSummary {
        id: number;
        name: string;
        email?: string;
        status?: string;
        joinDate?: string;
        unreadCount?: number;
    }

    // Define props
    let { 
        clients = [], 
        selectedClientId = null, 
        searchTerm = '', 
        statusFilter = 'all',
        loading = false
    }: {
        clients?: ClientSummary[];
        selectedClientId?: number | null;
        searchTerm?: string;
        statusFilter?: string;
        loading?: boolean;
    } = $props();

    const dispatch = createEventDispatcher();

    // Local state for search input to avoid rapid API calls if we want debouncing, 
    // but for now we'll just bind and let parent handle it or dispatch events.
    let localSearchTerm = $state(searchTerm);

    function handleSearch(e: Event) {
        const value = (e.target as HTMLInputElement).value;
        localSearchTerm = value;
        dispatch('search', value);
    }

    function handleFilterChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value;
        dispatch('filter', value);
    }

    function selectClient(id: number) {
        dispatch('select', id);
    }

    // Helper for initials
    function getInitials(name: string) {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    // Format date if available (mock for now since we don't have last message date)
    function formatTime(dateStr: string) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
</script>

<div class="flex flex-col h-full bg-[#1c1c1e] border-r border-neutral-800 w-full md:w-80 lg:w-96">
    <!-- Header / Search -->
    <div class="p-4 border-b border-neutral-800 space-y-3">
        <div class="relative">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 size-4" />
            <input 
                type="text" 
                placeholder="Buscar clientes..." 
                value={localSearchTerm}
                oninput={handleSearch}
                class="w-full bg-[#2c2c2e] text-white rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-neutral-500 transition-all"
            />
        </div>
        
        <div class="flex gap-2">
            <select 
                value={statusFilter} 
                onchange={handleFilterChange}
                class="w-full bg-[#2c2c2e] text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 border-none appearance-none cursor-pointer"
            >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="suspended">Suspendidos</option>
                <option value="cancelled">Cancelados</option>
            </select>
        </div>
    </div>

    <!-- Client List -->
    <div class="flex-1 overflow-y-auto">
        {#if loading && clients.length === 0}
            <div class="p-4 space-y-3">
                {#each Array(5) as _}
                    <div class="flex items-center gap-3 animate-pulse">
                        <div class="size-12 rounded-full bg-neutral-800"></div>
                        <div class="flex-1 space-y-2">
                            <div class="h-4 w-2/3 bg-neutral-800 rounded"></div>
                            <div class="h-3 w-1/2 bg-neutral-800 rounded"></div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else if clients.length === 0}
            <div class="flex flex-col items-center justify-center h-full text-neutral-500 p-4 text-center">
                <User class="size-12 mb-2 opacity-50" />
                <p class="text-sm">No se encontraron clientes</p>
            </div>
        {:else}
            <div class="divide-y divide-neutral-800/50">
                {#each clients as client (client.id)}
                    <button 
                        onclick={() => selectClient(client.id)}
                        class="w-full p-3 flex items-center gap-3 hover:bg-[#2c2c2e] transition-colors text-left relative group
                        {selectedClientId === client.id ? 'bg-[#2c2c2e] border-l-4 border-blue-500' : 'border-l-4 border-transparent'}"
                    >
                        <!-- Avatar -->
                        <div class="relative shrink-0">
                            <div class="size-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                                {getInitials(client.name)}
                            </div>
                            <!-- Status Indicator -->
                            <div class="absolute bottom-0 right-0 size-3 rounded-full border-2 border-[#1c1c1e] 
                                {client.status === 'active' ? 'bg-green-500' : 
                                 client.status === 'suspended' ? 'bg-yellow-500' : 
                                 client.status === 'cancelled' ? 'bg-red-500' : 'bg-neutral-500'}">
                            </div>
                        </div>

                        <!-- Info -->
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-baseline mb-1">
                                <h3 class="text-sm font-semibold text-white truncate pr-2">{client.name}</h3>
                                <span class="text-[10px] text-neutral-500 shrink-0">
                                    {client.joinDate ? new Date(client.joinDate).toLocaleDateString() : ''}
                                </span>
                            </div>
                            <div class="flex justify-between items-center">
                                <p class="text-xs text-neutral-400 truncate">
                                    {client.email}
                                </p>
                                {#if client.unreadCount && client.unreadCount > 0}
                                    <span class="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                        {client.unreadCount}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>
