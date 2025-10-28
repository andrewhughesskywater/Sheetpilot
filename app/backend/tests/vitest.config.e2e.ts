import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['__tests__/e2e/**/*.spec.ts'],
    passWithNoTests: false,
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    testTimeout: 300000, // 5 minutes for E2E tests
    // Run E2E tests sequentially to avoid conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
