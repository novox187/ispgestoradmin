<script>
	import '../app.css';
	import favicon from '$lib/assets/faviconfondo.ico';
    import Menu from '$lib/components/Menu.svelte';
    import { Toaster } from 'svelte-sonner';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { appState } from '$lib/stores/app.svelte';
    import { BRAND } from '$lib/brand';

	let { children } = $props();

    const isLogin = $derived($page.url.pathname === '/login');

    // Título dinámico basado en la ruta actual
    const pageSection = $derived.by(() => {
        const path = $page.url.pathname;
        if (path === '/') return 'Dashboard';
        const segment = path.replace(/^\/+/, '').split('/')[0];
        return segment.charAt(0).toUpperCase() + segment.slice(1);
    });

    function guard() {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('employee_token');

        const path = $page.url.pathname;
        if (!token && path !== '/login') {
            goto('/login', { replaceState: true });
            return;
        }

        if (token && path === '/login') {
            goto('/', { replaceState: true });
        }
    }

    onMount(() => {
        guard();
    });

    $effect(() => {
        const p = $page.url.pathname;
        guard();
    });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{BRAND.pageTitle(pageSection)}</title>
</svelte:head>

<div class="flex h-full overflow-hidden bg-[#0f0f0f] text-gray-100">
  {#if !isLogin}
    <Menu bind:isOpen={appState.isSidebarOpen} />
  {/if}

{@render children?.()}
  <Toaster theme="dark" position="bottom-right" />
</div>
