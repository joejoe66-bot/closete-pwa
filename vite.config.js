import { defineConfig } from 'vite';

export default defineConfig({
  base: '/closete-pwa/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  server: {
    port: 4173,
    strictPort: true,
  },
});
