import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
plugins: [
    sveltekit({
        compilerOptions: {
            runes: ({ filename }) =>
                filename.split(/[/\\]/).includes('node_modules') ? undefined : true
        },
        adapter: adapter()
    }),
    
    // Tambahkan 'as any' setelah kurung tutup SvelteKitPWA
    SvelteKitPWA({
        srcDir: 'src',
        strategy: 'generateSW',
        registerType: 'autoUpdate',
        manifest: {
            name: 'Sistem Informasi Apotek Baru',
            short_name: 'ApotekPWA',
            // ... sisa konfigurasi manifest lainnya tetap sama ...
        },
        workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
        }
    }) as any
]
});