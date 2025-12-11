<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
    import Menu from '$lib/components/Menu.svelte';
    import Menuderecha from '$lib/components/Menuderecha.svelte';
	
	let { children } = $props();

	let isSidebarOpen = $state(false);
    let isNotificationsOpen = $state(false);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-screen min-w-dvw bg-[#0f0f0f] text-gray-100 ">
  <Menu bind:isOpen={isSidebarOpen} />

{@render children?.()}
  <!-- RightSidebar como drawer en móvil, fijo en desktop -->
  <Menuderecha bind:isOpen={isNotificationsOpen} />
</div>
