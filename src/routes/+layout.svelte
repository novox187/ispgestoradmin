<script>
	import '../app.css';
	import favicon from '$lib/assets/faviconv2.ico';
    import Menu from '$lib/components/Menu.svelte';
    import SystemBootstrapBanner from '$lib/components/common/SystemBootstrapBanner.svelte';
    import { Toaster } from 'svelte-sonner';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { appState } from '$lib/stores/app.svelte';
    import { bootstrap } from '$lib/stores/bootstrap.svelte';
    import { BRAND } from '$lib/brand';

	let { children } = $props();

    const isLogin = $derived($page.url.pathname === '/login');

    // Sección actual a partir de la URL (capitalizada para el <title>)
    const pageSection = $derived.by(() => {
        const path = $page.url.pathname;
        if (path === '/') return 'Dashboard';
        const segment = path.replace(/^\/+/, '').split('/')[0];
        return segment.charAt(0).toUpperCase() + segment.slice(1);
    });

    // Slug en minúsculas — clave para la descripción contextual del brand
    const pageSlug = $derived.by(() => {
        const path = $page.url.pathname;
        if (path === '/') return 'dashboard';
        return path.replace(/^\/+/, '').split('/')[0].toLowerCase();
    });

    // Descripción adaptada a la sección activa
    const pageDescription = $derived(BRAND.pageDescription(pageSlug));

    // URL canónica absoluta de la vista actual
    const canonicalUrl = $derived(`${BRAND.canonicalUrl}${$page.url.pathname}`);

    // Rutas públicas indexables; el resto del panel se marca como noindex
    const isPublicRoute = $derived(
        $page.url.pathname === '/' || $page.url.pathname === '/login'
    );
    const robotsDirective = $derived(
        isPublicRoute ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive, nosnippet'
    );

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
            return;
        }

        // Si una ruta dependiente se visita sin router primary, redirigir a
        // la página de dispositivos para forzar la configuración. Esto cubre
        // accesos directos por URL — el sidebar ya deshabilita los enlaces.
        if (token && bootstrap.isRouteBlocked(path)) {
            goto('/mikrotik/dispositivos', { replaceState: true });
        }
    }

    onMount(() => {
        guard();
        // Cargar el estado de bootstrap al entrar al panel.
        bootstrap.refresh();
    });

    $effect(() => {
        const p = $page.url.pathname;
        guard();
    });
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{BRAND.pageTitle(pageSection)}</title>
	<meta name="description" content={pageDescription} />
	<meta name="robots" content={robotsDirective} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:title" content={BRAND.pageTitle(pageSection)} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={canonicalUrl} />
	<meta name="twitter:title" content={BRAND.pageTitle(pageSection)} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div class="flex h-full overflow-hidden bg-[#0b0b0d] text-gray-100">
  {#if !isLogin}
    <Menu bind:isOpen={appState.isSidebarOpen} />
  {/if}

  <div class="flex flex-1 flex-col overflow-hidden">
    {#if !isLogin}
      <SystemBootstrapBanner />
    {/if}
    <div class="flex-1 overflow-auto">
      {@render children?.()}
    </div>
  </div>

  <Toaster theme="dark" position="bottom-right" />
</div>
