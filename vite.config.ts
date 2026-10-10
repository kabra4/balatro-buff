/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Multi-page ready: add `finder: page('finder.html')` when the seed finder page lands.
export default defineConfig({
  base: '/balatro-buff/',
  build: {
    rollupOptions: {
      input: {
        main: page('index.html'),
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
});

function page(file: string): string {
  return fileURLToPath(new URL(file, import.meta.url));
}
