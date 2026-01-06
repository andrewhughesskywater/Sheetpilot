import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'shared',
    root: path.resolve(__dirname, '../../..'),
    environment: 'node',
    globals: true,
    include: [
      'app/shared/tests/**/*.spec.ts'
    ],
    passWithNoTests: false
  }
});
