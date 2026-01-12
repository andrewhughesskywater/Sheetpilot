import { defineProject } from 'vitest/config';
import path from 'path';

export default defineProject({
  root: __dirname,
  test: {
    name: 'backend-smoke',
    environment: 'node',
    include: [
      'tests/smoke/**/*.spec.ts'
    ],
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  }
});
