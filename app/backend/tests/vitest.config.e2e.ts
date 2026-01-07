import { defineConfig } from 'vitest/config';
import path from 'path';
import { MarkdownReporter } from './helpers/markdown-reporter';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    }
  },
  test: {
    name: 'backend-e2e',
    environment: 'node',
    root: path.resolve(__dirname, '../../..'),
    include: [
      'app/tests/e2e/**/*.spec.ts'
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
