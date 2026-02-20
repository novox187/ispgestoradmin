<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
    import Menu from '$lib/components/Menu.svelte';
    import Menuderecha from '$lib/components/Menuderecha.svelte';
    import { Toaster } from 'svelte-sonner';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { appState } from '$lib/stores/app.svelte';
	
	let { children } = $props();

    const isLogin = $derived($page.url.pathname === '/login');

    function guard() {
        if (typeof window === 'undefined') return;
        const token = localStorage.getItem('employee_token');
        const role = (localStorage.getItem('employee_role') || '').toLowerCase();
        const path = $page.url.pathname;
        if ((!token || role !== 'employee') && path !== '/login') {
            goto('/login', { replaceState: true });
            return;
        }
        if (token && role === 'employee' && path === '/login') {
            goto('/', { replaceState: true });
        }
    }

    onMount(() => {
        guard();
    });

    $effect(() => {
        // Run guard on navigation
        const p = $page.url.pathname;
        guard();
    });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-screen min-w-dvw bg-[#0f0f0f] text-gray-100 ">
  {#if !isLogin}
    <Menu bind:isOpen={appState.isSidebarOpen} />
  {/if}

{@render children?.()}
  <!-- RightSidebar como drawer en móvil, fijo en desktop -->
  {#if !isLogin}
    <Menuderecha bind:isOpen={appState.isNotificationsOpen} />
  {/if}
  <Toaster theme="dark" position="bottom-right" />
</div>
