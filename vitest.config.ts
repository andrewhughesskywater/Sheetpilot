import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts', 'renderer/tests/**/*.spec.tsx'],
    passWithNoTests: false,
    globals: true,
    setupFiles: [],
    testTimeout: 30000 // 30 seconds for browser automation tests
  }
});
