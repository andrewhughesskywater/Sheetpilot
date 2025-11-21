import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['frontend/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['frontend/**/*.{js,ts,svelte}'],
      exclude: ['frontend/**/*.{test,spec}.{js,ts}', 'tests/**'],
    },
  },
  resolve: {
    alias: {
      '$lib': '/frontend/lib',
    },
  },
});

