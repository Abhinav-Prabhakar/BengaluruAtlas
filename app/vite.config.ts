import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: '../docs',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 4096,
  },
});
