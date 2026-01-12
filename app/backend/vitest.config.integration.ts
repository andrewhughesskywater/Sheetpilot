import { defineProject } from 'vitest/config';
import path from 'path';

export default defineProject({
  root: __dirname,
  test: {
    name: 'backend-integration',
    environment: 'node',
    include: [
      'tests/auto-updater.spec.ts',
      'tests/database.spec.ts',
      'tests/database-persistence-regression.spec.ts',
      'tests/deprecated-constants.spec.ts',
      'tests/import-policy.spec.ts',
      'tests/ipc-handlers-comprehensive.spec.ts',
      'tests/ipc-main.spec.ts',
      'tests/ipc-workflow-integration.spec.ts',
      'tests/main-application-logic.spec.ts',
      'tests/quarter-config.spec.ts',
      'tests/quarter-routing-integration.spec.ts',
      'tests/submission-database-integration.spec.ts',
      'tests/timesheet_submission_integration.spec.ts',
      'tests/services/**/*.spec.ts',
      'tests/integration/**/*.spec.ts'
    ],
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    testTimeout: 120000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  }
});
