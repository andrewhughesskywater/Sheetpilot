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
    testTimeout: 5000, // Reduced to 5 seconds for faster test runs
    // Enable parallelization now that better-sqlite3 is mocked
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,  // Enable parallelization
        minThreads: 1,
        useAtomics: true
      }
    },
    maxConcurrency: 4, // Allow concurrent tests for better performance
    fileParallelism: true // Enable file parallelism
  },
  define: {
    'import.meta.env': JSON.stringify({
      DEV: true,
      MODE: 'test',
      PROD: false
    })
  }
});
