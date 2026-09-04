<script lang="ts">
    import {
        Send, Paperclip, MessageSquare, Wallet, CheckCircle,
        ExternalLink, LockKeyhole, Loader2
    } from '@lucide/svelte';
    import { formatCurrency } from '$lib/utils/currency';

    interface Attachment { name: string; url?: string; type?: string; file_url?: string }

    interface Message {
        id: number | string;
        ticket_id?: number | string | null;
        text: string;
        sender: 'me' | 'them' | 'system';
        time: string;
        event_type?: string | null;
        metadata?: Record<string, any> | null;
        attachments?: Attachment[];
    }

    let {
        messages = [],
        loading = false,
        clientName = '',
        activeTicketId = null,
        ticketStatus = 'open',
        onSend
    }: {
        messages?: Message[];
        loading?: boolean;
        clientName?: string;
        activeTicketId?: number | null;
        ticketStatus?: string;
        onSend: (text: string) => void;
    } = $props();

    let draft = $state('');
    let scrollEl = $state<HTMLDivElement | null>(null);
    let textareaEl = $state<HTMLTextAreaElement | null>(null);

    // El scroll baja solo cuando llega algo nuevo, no mientras se lee historial
    // antiguo: se respeta la posición si el operador no está ya al final.
    let messageCount = $derived(messages.length);
    $effect(() => {
        messageCount;
        if (!scrollEl) return;
        const nearBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 160;
        if (nearBottom || messageCount <= 1) {
            requestAnimationFrame(() => {
                if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
            });
        }
    });

    function autoGrow() {
        if (!textareaEl) return;
        textareaEl.style.height = 'auto';
        textareaEl.style.height = Math.min(textareaEl.scrollHeight, 160) + 'px';
    }

    function send() {
        const text = draft.trim();
        if (!text) return;
        onSend(text);
        draft = '';
        requestAnimationFrame(autoGrow);
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    function getInitials(name: string) {
        return (name || '?').split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();
    }

    function isImage(file: Attachment) {
        return Boolean(file.url) && (/\.(jpe?g|png|gif|webp|avif)$/i.test(file.name ?? '') || Boolean(file.type?.startsWith('image/')));
    }
</script>

<div class="flex flex-col h-full min-h-0">

    <!-- Conversación -->
    <div
        bind:this={scrollEl}
        class="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 scrollbar-isp"
        role="log"
        aria-label="Conversación con {clientName}"
        aria-live="polite"
    >
        {#if loading}
            <div class="flex justify-center py-12" aria-busy="true">
                <div class="flex flex-col items-center gap-2.5 text-text-muted">
                    <Loader2 class="size-6 animate-spin text-primary-500" aria-hidden="true" />
                    <span class="text-xs">Cargando conversación…</span>
                </div>
            </div>

        {:else if messages.length === 0}
            <div class="flex flex-col items-center justify-center h-full py-12 text-center">
                <div class="size-12 rounded-xl bg-surface-elevated border border-white/[0.06] flex items-center justify-center mb-3">
                    <MessageSquare class="size-5 text-text-disabled" aria-hidden="true" />
                </div>
                <p class="text-sm font-semibold text-text-secondary">Sin conversación todavía</p>
                <p class="text-xs text-text-muted mt-1 max-w-[18rem] leading-relaxed">
                    {activeTicketId
                        ? 'Envía el primer mensaje para iniciar el hilo de soporte.'
                        : 'Este cliente aún no ha abierto ningún ticket de soporte.'}
                </p>
            </div>

        {:else}
            {#each messages as msg, i (msg.id)}

                {#if msg.ticket_id && messages[i - 1]?.ticket_id !== msg.ticket_id}
                    <div class="flex items-center gap-3 py-1.5 select-none">
                        <span class="flex-1 h-px bg-white/[0.06]"></span>
                        <span class="text-[10px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full
                                     border border-white/[0.08] bg-surface-elevated text-text-disabled tabular-nums">
                            Ticket #{msg.ticket_id}
                        </span>
                        <span class="flex-1 h-px bg-white/[0.06]"></span>
                    </div>
                {/if}

                {#if msg.event_type === 'wallet_funded' && msg.metadata}
                    {@const meta = msg.metadata}
                    <div class="flex justify-center py-0.5">
                        <div class="w-full max-w-sm rounded-xl border border-success-700/30 bg-success-950/40 p-3.5">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="rounded-md bg-success-500/20 p-1">
                                    <Wallet class="size-3.5 text-success-400" aria-hidden="true" />
                                </span>
                                <span class="text-xs font-semibold text-success-300">Recarga de billetera</span>
                                <CheckCircle class="size-3.5 text-success-400 ml-auto" aria-hidden="true" />
                            </div>

                            <p class="text-xl font-bold text-success-300 tabular-nums leading-none mb-1.5">
                                +{formatCurrency(meta.amount)}
                            </p>

                            {#if meta.description}
                                <p class="text-xs text-text-muted mb-2 leading-snug">{meta.description}</p>
                            {/if}

                            {#if meta.receipt_url}
                                <a
                                    href={meta.receipt_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="block rounded-lg overflow-hidden border border-success-700/20 mb-2
                                           hover:border-success-500/40 transition-colors duration-150"
                                >
                                    <img src={meta.receipt_url} alt="Comprobante de la recarga" class="w-full max-h-40 object-cover" loading="lazy" />
                                    <span class="flex items-center justify-center gap-1 bg-success-900/40 py-1 text-[10px] text-success-300">
                                        <ExternalLink class="size-3" aria-hidden="true" />
                                        Ver comprobante completo
                                    </span>
                                </a>
                            {/if}

                            <div class="flex items-center justify-between text-[10px] text-text-disabled">
                                <span>Por {meta.actor_name ?? 'Administrador'}</span>
                                <time datetime={msg.time}>{msg.time}</time>
                            </div>
                        </div>
                    </div>

                {:else}
                    {@const mine = msg.sender === 'me'}
                    <div class="flex {mine ? 'justify-end' : 'justify-start'}">
                        <div class="flex items-end gap-2 max-w-[85%] sm:max-w-[75%] {mine ? 'flex-row-reverse' : ''}">
                            {#if !mine}
                                <span
                                    class="size-6 rounded-md bg-surface-overlay ring-1 ring-white/10 flex items-center justify-center
                                           text-[9px] font-bold text-text-secondary shrink-0 mb-4"
                                    aria-hidden="true"
                                >
                                    {getInitials(clientName)}
                                </span>
                            {/if}

                            <div class="min-w-0">
                                <div
                                    class="px-3 py-2 rounded-xl text-sm leading-relaxed break-words
                                           {mine
                                               ? 'bg-primary-600 text-white rounded-br-sm'
                                               : 'bg-surface-elevated text-text-primary rounded-bl-sm border border-white/[0.06]'}"
                                >
                                    <p class="whitespace-pre-wrap">{msg.text}</p>

                                    {#if msg.attachments?.length}
                                        <div class="mt-2 space-y-1">
                                            {#each msg.attachments as file}
                                                {#if isImage(file)}
                                                    <a
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="block rounded-lg overflow-hidden border border-white/10
                                                               hover:border-white/25 transition-colors duration-150"
                                                    >
                                                        <img src={file.url} alt={file.name} class="w-full max-h-48 object-cover" loading="lazy" />
                                                    </a>
                                                {:else}
                                                    <a
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="flex items-center gap-2 bg-black/25 px-2 py-1.5 rounded-lg text-xs
                                                               hover:bg-black/40 transition-colors duration-150"
                                                    >
                                                        <Paperclip class="size-3 shrink-0" aria-hidden="true" />
                                                        <span class="truncate">{file.name}</span>
                                                    </a>
                                                {/if}
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                                <time
                                    class="mt-1 block text-[10px] text-text-disabled tabular-nums {mine ? 'text-right' : 'text-left'}"
                                    datetime={msg.time}
                                >
                                    {msg.time}
                                </time>
                            </div>
                        </div>
                    </div>
                {/if}
            {/each}
        {/if}
    </div>

    <!-- Redacción -->
    <div class="shrink-0 border-t border-white/[0.06] bg-surface-card px-3 py-2.5">
        {#if ticketStatus === 'closed'}
            <p class="flex items-center justify-center gap-2 py-2.5 text-xs text-text-muted">
                <LockKeyhole class="size-3.5 text-danger-400 shrink-0" aria-hidden="true" />
                Ticket cerrado. El cliente puede dejar una calificación.
            </p>

        {:else if !activeTicketId}
            <p class="flex items-center justify-center gap-2 py-2.5 text-xs text-text-muted text-center">
                <MessageSquare class="size-3.5 text-text-disabled shrink-0" aria-hidden="true" />
                No hay ticket abierto: el cliente debe iniciarlo desde su aplicación.
            </p>

        {:else}
            <div
                class="flex items-end gap-2 bg-surface-elevated rounded-xl border border-white/[0.06] p-1.5
                       transition-colors duration-150
                       focus-within:border-primary-600/50 focus-within:ring-1 focus-within:ring-primary-500/30"
            >
                <label class="sr-only" for="chat-draft">Mensaje para {clientName}</label>
                <textarea
                    id="chat-draft"
                    bind:this={textareaEl}
                    bind:value={draft}
                    oninput={autoGrow}
                    onkeydown={handleKeydown}
                    placeholder="Escribe un mensaje…"
                    rows="1"
                    class="flex-1 bg-transparent text-text-primary text-sm px-2 py-2 min-h-[2.25rem] max-h-40
                           resize-none scrollbar-isp placeholder:text-text-disabled focus:outline-none"
                ></textarea>

                <button
                    type="button"
                    onclick={send}
                    disabled={!draft.trim()}
                    aria-label="Enviar mensaje"
                    class="size-9 shrink-0 inline-flex items-center justify-center rounded-lg transition-colors duration-150
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400
                           {draft.trim()
                               ? 'bg-primary-600 text-white hover:bg-primary-500 active:bg-primary-700'
                               : 'bg-surface-hover text-text-disabled cursor-not-allowed'}"
                >
                    <Send class="size-4" aria-hidden="true" />
                </button>
            </div>
            <p class="mt-1.5 text-center text-[10px] text-text-disabled">
                Enter envía · Shift+Enter salta de línea
            </p>
        {/if}
    </div>
</div>
