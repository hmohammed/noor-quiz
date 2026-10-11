import { defineConfig } from 'vite';

// The browser calls the API on its own origin; Vite proxies /v1 to the functions
// emulator, so no CORS is needed locally. Hosting rewrites do the same in T004.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:5001',
        rewrite: (path) => '/demo-noor/europe-west1/api' + path,
      },
    },
  },
  // No @vitejs/plugin-react (v5 needs Node 20.19): esbuild's automatic JSX is enough.
  esbuild: { jsx: 'automatic' },
});
