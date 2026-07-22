import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			srcDir: 'src',
			strategy: 'generateSW',
			registerType: 'autoUpdate',
			manifest: {
				name: 'Sistem Informasi Apotek Baru',
				short_name: 'ApotekPWA'
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
			}
		}) as any
	]
});