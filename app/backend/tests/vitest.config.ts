import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    }
  },
  test: {
    environment: 'jsdom',
    root: path.resolve(__dirname, '../../..'),
    include: [
      'app/backend/tests/unit/**/*.spec.ts',
      'app/backend/tests/contracts/**/*.spec.ts'
    ],
    passWithNoTests: false,
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
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
