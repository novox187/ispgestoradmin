<script>
  let isExpanded = $state(false);
  let view = $state('list'); // 'list' | 'conversation'
  let activeConversation = $state(null);
  let newMessage = $state('');

  const conversations = $state([
    {
      id: 1,
      name: 'KRIMSON',
      username: '@KKIMSON',
      lastMessage: '🔥🔥🔥🔥🔥',
      date: 'JULY 10',
      color: 'from-purple-500 to-pink-500',
      online: true,
      messages: [
        { id: 1, sender: 'them', text: 'Hey!', time: '10:12' },
        { id: 2, sender: 'me', text: 'Hola 👋', time: '10:13' }
      ]
    },
    {
      id: 2,
      name: 'MATI',
      username: '@MATI',
      lastMessage: 'WE HAVE TO PAY TAXES?! DUDE',
      date: 'JUNE 6',
      color: 'from-orange-500 to-red-500',
      online: true,
      messages: [
        { id: 1, sender: 'them', text: 'We need to talk', time: '09:00' }
      ]
    }
  ]);

  function toggleExpanded() { isExpanded = !isExpanded; }
  function openConversation(conv) { activeConversation = conv; view = 'conversation'; }
  function backToList() { view = 'list'; activeConversation = null; }
  function handleSendMessage() {
    if (!newMessage.trim() || !activeConversation) return;
    activeConversation.messages = [
      ...activeConversation.messages,
      { id: crypto.randomUUID(), sender: 'me', text: newMessage.trim(), time: new Date().toLocaleTimeString().slice(0,5) }
    ];
    // update last message preview
    const idx = conversations.findIndex(c => c.id === activeConversation.id);
    if (idx !== -1) {
      conversations[idx] = { ...conversations[idx], lastMessage: newMessage.trim(), date: 'NOW' };
    }
    newMessage = '';
  }
</script>

<!-- Container fixed to bottom similar to original behavior -->
<div class="fixed bottom-0 inset-x-0 z-50">
  <!-- Header / Toggle -->
  <div class="bg-[#0b0b0d] border-t border-gray-800">
    <div class="max-w-screen-xl mx-auto px-4">
      <div class="h-12 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 bg-green-500 rounded-full"></div>
          <span class="text-xs font-mono font-bold text-white">{view === 'list' ? 'ONLINE' : activeConversation?.name}</span>
        </div>
        <div class="flex items-center gap-2">
          {#if view === 'conversation'}
            <button class="text-xs font-mono text-gray-400 hover:text-white" onclick={backToList}>VOLVER</button>
          {/if}
          <button class="text-xs font-mono text-gray-400 hover:text-white" onclick={toggleExpanded}>{isExpanded ? '─' : '+'}</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Expandable Content -->
  <div class="overflow-hidden transition-[max-height] duration-300 ease-in-out bg-[#0b0b0d] border-t border-gray-800"
       style="max-height: {isExpanded ? '420px' : '0px'};">
    <div class="max-w-screen-xl mx-auto px-4 h-[420px]">
      {#if view === 'list'}
        <!-- Conversations List -->
        <div class="h-full flex flex-col">
          <div class="flex-1 space-y-2 overflow-y-auto py-4">
            {#each conversations as chat}
              <button class="w-full flex items-center gap-3 p-2 hover:bg-gray-800/50 rounded-lg transition-colors text-left"
                      onclick={() => openConversation(chat)}>
                <div class="w-4 h-4 bg-blue-600 text-white rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0">{chat.id}</div>
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br {chat.color} flex items-center justify-center text-white font-bold flex-shrink-0">
                  {chat.name.charAt(0)}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-xs font-bold text-white">{chat.name}</span>
                    <span class="text-[10px] text-gray-500">{chat.username}</span>
                  </div>
                  <p class="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
                </div>
                <span class="text-[10px] font-mono text-gray-600 flex-shrink-0">{chat.date}</span>
              </button>
            {/each}
          </div>
          <div class="mt-auto flex justify-end p-4 border-t border-gray-800 bg-gradient-to-t from-[#0b0b0d] via-[#0b0b0d]/80 to-black/0">
            <button class="bg-blue-600 hover:bg-blue-700 text-white font-mono text-sm py-2 px-4 rounded-lg flex items-center gap-2">
              <div class="w-6 h-6 bg-white text-blue-600 rounded flex items-center justify-center font-bold text-lg">+</div>
              <span class="font-bold">NEW CHAT</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Conversation View -->
        <div class="h-full flex flex-col">
          <div class="flex-1 overflow-y-auto py-4 space-y-2">
            {#each activeConversation?.messages ?? [] as msg}
              <div class="px-1">
                <div class="max-w-[70%] px-3 py-2 rounded-lg text-sm"
                     class:bg-blue-600={msg.sender === 'me'}
                     class:text-white={msg.sender === 'me'}
                     class:bg-gray-800/60={msg.sender !== 'me'}
                     class:text-gray-200={msg.sender !== 'me'}
                     class:ml-auto={msg.sender === 'me'}>
                  {msg.text}
                  <div class="text-[10px] text-gray-300/70 mt-1 text-right">{msg.time}</div>
                </div>
              </div>
            {/each}
          </div>
          <div class="p-3 border-t border-gray-800 flex items-center gap-2">
            <input class="flex-1 bg-transparent border border-gray-800 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-600"
                   placeholder="Escribe un mensaje..."
                   value={newMessage}
                   oninput={(e) => newMessage = e.currentTarget.value}
                   onkeydown={(e) => { if (e.key === 'Enter') handleSendMessage(); }} />
            <button class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-mono px-3 py-2 rounded" onclick={handleSendMessage}>Enviar</button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
