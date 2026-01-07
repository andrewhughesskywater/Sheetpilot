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
    name: 'system-tests',
    environment: 'node',
    root: path.resolve(__dirname, '../../..'),
    include: [
      'app/tests/system/**/*.spec.ts'
    ],
    passWithNoTests: false,
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    testTimeout: 30000, // 30 seconds for system tests
    // Run tests in sequence for system tests to ensure stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    reporters: [
      'default',
      new MarkdownReporter({ 
        outputFile: 'system-test-results.md',
        outputDir: path.resolve(__dirname, '../../..', 'test-results')
      })
    ]
  }
});
