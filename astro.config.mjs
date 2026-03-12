// Framelab: static Astro site with Svelte islands. Every page is prerendered into dist/.
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import stripRemoteUrls from './scripts/vite-strip-remote-urls.mjs';
import serviceWorker from './scripts/sw.mjs';

export default defineConfig({
  output: 'static',
  site: 'https://framelab.pages.dev',
  trailingSlash: 'ignore',
  build: { format: 'directory', inlineStylesheets: 'never' },
  integrations: [svelte(), serviceWorker()],
  vite: {
    // Never inline scripts or assets: the CSP allows only same-origin scripts plus the hashed island bootstrap.
    build: { assetsInlineLimit: 0 },
    worker: {
      format: 'es',
      plugins: () => [stripRemoteUrls()],
      // The mediabunny core gets its own chunk inside the engine worker, so the bundle budget (U26) can see it.
      rollupOptions: {
        output: {
          manualChunks: (id) => (/[\\/]node_modules[\\/]mediabunny[\\/]/.test(id) ? 'mediabunny' : undefined),
        },
      },
    },
    plugins: [stripRemoteUrls()],
  },
});
