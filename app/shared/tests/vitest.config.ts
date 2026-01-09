import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@sheetpilot\/shared\/(.+)$/, replacement: path.resolve(__dirname, '../$1') },
      { find: '@sheetpilot/shared', replacement: path.resolve(__dirname, '../index.ts') },
      { find: '@', replacement: path.resolve(__dirname, '..') },
    ]
  },
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
