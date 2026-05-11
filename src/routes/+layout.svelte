<script>
	import '../app.css';
	import favicon from '$lib/assets/faviconfondo.ico';
    import Menu from '$lib/components/Menu.svelte';
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
        const userId = localStorage.getItem('employee_id');

        const path = $page.url.pathname;
        // Permitimos cualquier rol que no esté vacío, ya que el backend maneja los permisos reales
        // El frontend solo debe validar que exista una sesión activa
        if (!token && path !== '/login') {
            goto('/login', { replaceState: true });
            return;
        }
        
        // Si hay token y estamos en login, redirigir al home
        if (token && path === '/login') {
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
  <Toaster theme="dark" position="bottom-right" />
</div>
