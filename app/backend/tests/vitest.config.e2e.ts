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
    name: 'backend-e2e',
    environment: 'node',
    root: path.resolve(__dirname, '../../..'),
    include: ['app/tests/e2e/**/*.spec.ts'],
    passWithNoTests: false,
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    testTimeout: 300000, // 5 minutes for E2E tests
    // Run E2E tests sequentially to avoid conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    reporters: [
      'default',
      new MarkdownReporter({
        outputFile: 'e2e-test-results.md',
        outputDir: path.resolve(__dirname, '../../..', 'test-results'),
      }),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      include: ['app/backend/src/**/*.ts', 'app/shared/**/*.ts'],
      exclude: [
        'app/backend/src/**/*.spec.ts',
        'app/backend/src/**/*.test.ts',
        'app/backend/tests/**/*',
        'app/backend/src/**/*.d.ts',
      ],
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
});
