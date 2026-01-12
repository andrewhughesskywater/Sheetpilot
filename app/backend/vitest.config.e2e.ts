import { defineProject } from 'vitest/config';
import path from 'path';

export default defineProject({
  root: __dirname,
  test: {
    name: 'backend-e2e',
    environment: 'node',
    include: [
      'tests/e2e/**/*.spec.ts'
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
