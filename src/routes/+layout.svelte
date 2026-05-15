<script>
	import '../app.css';
	import favicon from '$lib/assets/faviconv2.ico';
    import Menu from '$lib/components/Menu.svelte';
    import { Toaster } from 'svelte-sonner';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { appState } from '$lib/stores/app.svelte';
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
	<meta name="description" content={pageDescription} />
	<meta name="robots" content={robotsDirective} />
	<link rel="canonical" href={canonicalUrl} />
	<meta property="og:title" content={BRAND.pageTitle(pageSection)} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={canonicalUrl} />
	<meta name="twitter:title" content={BRAND.pageTitle(pageSection)} />
	<meta name="twitter:description" content={pageDescription} />
</svelte:head>

<div class="flex h-full overflow-hidden bg-[#0f0f0f] text-gray-100">
  {#if !isLogin}
    <Menu bind:isOpen={appState.isSidebarOpen} />
  {/if}

{@render children?.()}
  <Toaster theme="dark" position="bottom-right" />
</div>
