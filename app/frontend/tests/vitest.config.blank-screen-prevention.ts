import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { MarkdownReporter } from '../../backend/tests/helpers/markdown-reporter';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'frontend-blank-screen',
    root: path.resolve(__dirname, '../../..'),
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
      'build'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/**/*.{ts,tsx}',
        'utils/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'contexts/**/*.{ts,tsx}'
      ],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.test.{ts,tsx}',
        '__tests__/**/*',
        '**/*.d.ts'
      ]
    },
    reporters: [
      'default',
      new MarkdownReporter({ 
        outputFile: 'frontend-blank-screen-test-results.md',
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
