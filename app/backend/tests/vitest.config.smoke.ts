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
    include: ['app/backend/tests/smoke/**/*.spec.ts'],
    passWithNoTests: false,
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    testTimeout: 10000, // 10 seconds for smoke tests
    // Run tests in sequence for smoke tests to ensure stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
