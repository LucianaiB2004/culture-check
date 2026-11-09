import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  build: {
    assetsDir: 'static',
    rollupOptions: { input: Object.fromEntries(['index', 'upload', 'analyzing', 'result', 'compare'].map(n => [n, resolve(__dirname, `${n}.html`)])) },
  },
  server: { host: '127.0.0.1', port: 5173 },
});
