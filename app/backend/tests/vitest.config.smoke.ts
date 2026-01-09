import { defineConfig } from 'vitest/config';
import path from 'path';
import { MarkdownReporter } from './helpers/markdown-reporter';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@sheetpilot\/shared\/(.+)$/, replacement: path.resolve(__dirname, '../../shared/$1') },
      { find: '@sheetpilot/shared', replacement: path.resolve(__dirname, '../../shared/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, '../src') },
    ],
  },
  test: {
    name: 'backend-smoke',
    environment: 'node',
    root: path.resolve(__dirname, '../../..'),
    include: ['app/tests/system/smoke/**/*.spec.ts'],
    passWithNoTests: false,
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    testTimeout: 10000, // 10 seconds for smoke tests
    // Run tests in sequence for smoke tests to ensure stability
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    reporters: [
      'default',
      new MarkdownReporter({
        outputFile: 'smoke-test-results.md',
        outputDir: path.resolve(__dirname, '../../..', 'test-results'),
      }),
    ],
  },
});
