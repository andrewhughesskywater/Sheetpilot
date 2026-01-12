import { defineProject } from 'vitest/config';
import path from 'path';

export default defineProject({
  root: __dirname,
  test: {
    name: 'backend-unit',
    environment: 'node',
    include: [
      'tests/**/*.spec.ts'
    ],
    exclude: [
      'tests/integration/**/*.spec.ts',
      'tests/e2e/**/*.spec.ts',
      'tests/smoke/**/*.spec.ts',
      'node_modules'
    ],
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    testTimeout: 5000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  }
});
