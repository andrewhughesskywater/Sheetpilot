import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['__tests__/integration/**/*.spec.ts'],
    passWithNoTests: false,
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    testTimeout: 120000, // 2 minutes for integration tests
    // Allow parallel execution for integration tests
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    }
  }
});
