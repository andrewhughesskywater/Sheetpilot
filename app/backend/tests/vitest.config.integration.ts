import { defineConfig } from 'vitest/config';
import path from 'path';
import { MarkdownReporter } from './helpers/markdown-reporter';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@sheetpilot\/shared\/(.+)$/, replacement: path.resolve(__dirname, '../../shared/$1.ts') },
      { find: '@sheetpilot/shared', replacement: path.resolve(__dirname, '../../shared/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, '../src') },
    ],
  },
  test: {
    name: 'backend-integration',
    environment: 'node',
    root: path.resolve(__dirname, '../../..'),
    include: ['app/backend/tests/integration/**/*.spec.ts', 'app/tests/integration/**/*.spec.ts'],
    passWithNoTests: false,
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    testTimeout: 120000, // 2 minutes for integration tests
    // Allow parallel execution for integration tests
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
    reporters: [
      'default',
      new MarkdownReporter({
        outputFile: 'integration-test-results.md',
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
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
});
