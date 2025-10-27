import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['__tests__/**/*.spec.ts', '__tests__/**/*.spec.tsx'],
    passWithNoTests: false,
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    testTimeout: 10000, // Reduced to 10 seconds to prevent hanging
    // Prevent resource-intensive operations - use threads with minimal concurrency
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
        useAtomics: true
      }
    },
    maxConcurrency: 1, // Limit concurrent tests to prevent EMFILE errors on Windows
    fileParallelism: false // Disable file parallelism to reduce file handle usage
  },
  define: {
    'import.meta.env': JSON.stringify({
      DEV: true,
      MODE: 'test',
      PROD: false
    })
  }
});
