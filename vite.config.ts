/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// `vitest run --mode bench` (npm run bench) runs the throughput benchmarks instead of the tests.
export default defineConfig(({ mode }) => ({
  base: '/balatro-buff/',
  build: {
    rollupOptions: {
      input: {
        main: page('index.html'),
        finder: page('finder.html'),
      },
    },
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: mode === 'bench' ? ['bench/**/*.bench.ts'] : ['tests/**/*.test.ts'],
    testTimeout: mode === 'bench' ? 120_000 : 30_000,
  },
}));

function page(file: string): string {
  return fileURLToPath(new URL(file, import.meta.url));
}
