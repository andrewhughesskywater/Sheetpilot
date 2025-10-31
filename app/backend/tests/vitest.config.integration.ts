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
      'app/backend/tests/auto-updater.spec.ts',
      'app/backend/tests/database.spec.ts',
      'app/backend/tests/deprecated-constants.spec.ts',
      'app/backend/tests/ipc-handlers-comprehensive.spec.ts',
      'app/backend/tests/ipc-main.spec.ts',
      'app/backend/tests/ipc-workflow-integration.spec.ts',
      'app/backend/tests/main-application-logic.spec.ts',
      'app/backend/tests/quarter-config.spec.ts',
      'app/backend/tests/quarter-routing-integration.spec.ts',
      'app/backend/tests/timesheet_submission_integration.spec.ts',
      'app/backend/tests/services/**/*.spec.ts'
    ],
    passWithNoTests: false,
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    testTimeout: 120000, // 2 minutes for integration tests
    // Allow parallel execution for integration tests
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },
    reporters: [
      'default',
      new MarkdownReporter({ 
        outputFile: 'integration-test-results.md',
        outputDir: path.resolve(__dirname, '../../..', 'test-results')
      })
    ]
  }
});
