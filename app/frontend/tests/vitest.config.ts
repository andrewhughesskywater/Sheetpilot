import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { MarkdownReporter } from '../../backend/tests/helpers/markdown-reporter';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    globals: true,
    include: [
      'app/frontend/tests/**/*.spec.{ts,tsx}',
      'app/frontend/tests/**/*.test.{ts,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'build',
      '**/blank-screen-prevention.spec.{ts,tsx}',
      '**/e2e-blank-screen-prevention.spec.{ts,tsx}'
    ],
    reporters: [
      'default',
      new MarkdownReporter({ 
        outputFile: 'frontend-test-results.md',
        outputDir: path.resolve(__dirname, '../../..', 'test-results')
      })
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@tests': path.resolve(__dirname, '.')
    }
  }
});
