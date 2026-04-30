import adapter from '@sveltejs/adapter-node'; // Cambia adapter-auto por adapter-node
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter() // Esto generará un servidor Node.js funcional
	}
};

export default config;