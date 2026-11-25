import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Emit a versioned service worker with the built shell as its precache list.
 * Public files are copied separately by Vite, so the known-offline essentials
 * are listed explicitly.
 */
function atlasServiceWorker(): Plugin {
  const staticFiles = [
    './index.html',
    './site.webmanifest',
    './offline.html',
    './favicon.svg',
    './favicon.ico',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-512.png',
    './apple-touch-icon.png',
    './data/atlas.json',
    './data/traffic.json',
    './map/light.json',
    './map/dark.json',
  ];

  return {
    name: 'atlas-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle)
        .filter((fileName) => !fileName.endsWith('.map') && fileName !== 'sw.js')
        .map((fileName) => `./${fileName}`);
      const precache = [...new Set([...staticFiles, ...built])];

      const template = readFileSync(
        new URL('./pwa/sw.js', import.meta.url),
        'utf8',
      );
      const source = template
        .replace('__VERSION__', JSON.stringify(Date.now().toString(36)))
        .replace('__PRECACHE__', JSON.stringify(precache, null, 2));

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source,
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), atlasServiceWorker()],
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
