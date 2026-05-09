<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		text,
		children
	}: {
		text: string;
		children?: Snippet;
	} = $props();
</script>

<span class="relative inline-flex shrink-0 group/tip">
	{@render children?.()}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<span
		role="tooltip"
		class="pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
		       w-60 rounded-lg bg-neutral-900 border border-neutral-700
		       px-3 py-2 text-xs text-gray-200 shadow-2xl leading-relaxed
		       opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 whitespace-normal"
	>
		{text}
		<span class="absolute top-full left-1/2 -translate-x-1/2
		             border-[5px] border-transparent border-t-neutral-700"></span>
	</span>
</span>
