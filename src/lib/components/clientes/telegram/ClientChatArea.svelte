<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { 
        Send, Paperclip, MoreVertical, Phone, Mail, 
        MapPin, CreditCard, User, X, ArrowLeft
    } from '@lucide/svelte';
    import { fade, fly } from 'svelte/transition';
    import ClientDetailSidebar from './ClientDetailSidebar.svelte';

    interface Attachment {
        name: string;
        url?: string;
    }

    interface Message {
        id: number | string;
        text: string;
        sender: 'me' | 'them';
        time: string;
        attachments?: Attachment[];
    }

    interface Client {
        id: number;
        name: string;
        status: string;
        [key: string]: any;
    }

    let { 
        client = null, 
        messages = [], 
        loading = false,
        isDetailOpen = false
    }: {
        client?: Client | null;
        messages?: Message[];
        loading?: boolean;
        isDetailOpen?: boolean;
    } = $props();

    const dispatch = createEventDispatcher();

    let newMessage = $state('');
    let chatContainer: HTMLDivElement;

    function handleSendMessage() {
        if (!newMessage.trim()) return;
        dispatch('sendMessage', newMessage);
        newMessage = '';
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }

    function toggleDetail() {
        dispatch('toggleDetail');
    }
    
    function goBack() {
        dispatch('back');
    }

    // Auto-scroll to bottom when messages change
    $effect(() => {
        if (messages.length && chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });

    function getInitials(name: string) {
        return name ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : '';
    }
</script>

<div class="flex flex-1 h-full bg-[#0f0f0f] relative overflow-hidden">
    {#if !client}
        <!-- Empty State -->
        <div class="flex-1 flex flex-col items-center justify-center text-neutral-500 p-8 select-none">
            <div class="bg-[#1c1c1e] p-4 rounded-full mb-4">
                <User class="size-12 opacity-50" />
            </div>
            <h3 class="text-lg font-medium text-white mb-2">Selecciona un cliente</h3>
            <p class="text-sm max-w-xs text-center">Elige un cliente de la lista para ver su historial de chat y detalles.</p>
        </div>
    {:else}
        <!-- Main Chat Area -->
        <div class="flex-1 flex flex-col min-w-0 transition-all duration-300" class:mr-80={isDetailOpen}>
            
            <!-- Header -->
            <header class="h-16 border-b border-neutral-800 flex items-center justify-between px-4 bg-[#1c1c1e]/50 backdrop-blur-md sticky top-0 z-10">
                <div class="flex items-center gap-3">
                    <button onclick={goBack} class="md:hidden text-neutral-400 hover:text-white mr-2">
                        <ArrowLeft class="size-5" />
                    </button>
                    
                    <button 
                        onclick={toggleDetail}
                        class="flex items-center gap-3 hover:bg-white/5 p-2 rounded-lg transition-colors group text-left"
                    >
                        <div class="size-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                            {getInitials(client.name)}
                        </div>
                        <div>
                            <h2 class="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                                {client.name}
                            </h2>
                            <span class="text-xs flex items-center gap-1.5">
                                <span class="size-2 rounded-full {client.status === 'active' ? 'bg-green-500' : 'bg-red-500'}"></span>
                                <span class="text-neutral-400">{client.status === 'active' ? 'En línea' : 'Desconectado'}</span>
                            </span>
                        </div>
                    </button>
                </div>

                <div class="flex items-center gap-2">
                    <button onclick={toggleDetail} class="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Info del cliente">
                        <MoreVertical class="size-5" />
                    </button>
                </div>
            </header>

            <!-- Messages -->
            <div 
                bind:this={chatContainer}
                class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
                {#if loading}
                    <div class="flex justify-center p-8">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                {:else if messages.length === 0}
                    <div class="text-center text-neutral-500 mt-10 text-sm">
                        <p>No hay mensajes en esta conversación.</p>
                        <p class="text-xs mt-1">Envía un mensaje para comenzar.</p>
                    </div>
                {:else}
                    {#each messages as msg (msg.id)}
                        <div class="flex flex-col {msg.sender === 'me' ? 'items-end' : 'items-start'} w-full">
                            <div class="flex items-end gap-2 max-w-[85%] {msg.sender === 'me' ? 'flex-row-reverse' : 'flex-row'}">
                                {#if msg.sender !== 'me'}
                                    <div class="size-6 rounded-full bg-neutral-700 flex items-center justify-center text-[10px] text-white shrink-0 mb-1">
                                        {getInitials(client.name)}
                                    </div>
                                {/if}
                                
                                <div class="relative group">
                                    <div class="px-4 py-2 rounded-2xl text-sm shadow-sm
                                        {msg.sender === 'me' 
                                            ? 'bg-blue-600 text-white rounded-br-none' 
                                            : 'bg-[#2c2c2e] text-white rounded-bl-none'}">
                                        <p>{msg.text}</p>
                                        {#if msg.attachments?.length}
                                            <div class="mt-2 space-y-1">
                                                {#each msg.attachments as file}
                                                    <div class="flex items-center gap-2 bg-black/20 p-2 rounded text-xs">
                                                        <Paperclip class="size-3" />
                                                        <span class="truncate max-w-[150px]">{file.name}</span>
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}
                                    </div>
                                    <span class="text-[10px] text-neutral-500 mt-1 block {msg.sender === 'me' ? 'text-right' : 'text-left'}">
                                        {msg.time}
                                    </span>
                                </div>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

            <!-- Input Area -->
            <div class="p-4 bg-[#1c1c1e] border-t border-neutral-800">
                <div class="flex items-end gap-3 bg-[#0f0f0f] p-2 rounded-xl border border-neutral-800 focus-within:border-blue-500/50 transition-colors">
                    <button class="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <Paperclip class="size-5" />
                    </button>
                    
                    <textarea 
                        bind:value={newMessage}
                        onkeydown={handleKeyDown}
                        placeholder="Escribe un mensaje..."
                        class="flex-1 bg-transparent text-white text-sm max-h-32 min-h-[40px] py-2 resize-none focus:outline-none custom-scrollbar placeholder-neutral-500"
                        rows="1"
                    ></textarea>

                    <button 
                        onclick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        class="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-blue-500/20"
                    >
                        <Send class="size-5" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Detail Panel (Overlay/Sidebar) -->
        {#if isDetailOpen}
            <div 
                transition:fly={{ x: 300, duration: 300 }}
                class="absolute top-0 right-0 w-80 h-full bg-[#1c1c1e] border-l border-neutral-800 z-20 shadow-2xl"
            >
                <ClientDetailSidebar 
                    {client} 
                    onClose={toggleDetail}
                    on:updated
                />
            </div>
        {/if}
    {/if}
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #3f3f46;
        border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #52525b;
    }
</style>
