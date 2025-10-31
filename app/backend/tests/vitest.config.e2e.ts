import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { MarkdownReporter } from './helpers/markdown-reporter';

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
      'app/backend/tests/*integration*.spec.ts',
      'app/backend/tests/*workflow*.spec.ts'
    ],
    passWithNoTests: false,
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    testTimeout: 300000, // 5 minutes for E2E tests
    // Run E2E tests sequentially to avoid conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    reporters: [
      'default',
      new MarkdownReporter({ 
        outputFile: 'e2e-test-results.md',
        outputDir: path.resolve(__dirname, '../../..', 'test-results')
      })
    ]
  }
});
