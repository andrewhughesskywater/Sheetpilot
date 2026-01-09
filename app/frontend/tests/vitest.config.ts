import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { MarkdownReporter } from '../../backend/tests/helpers/markdown-reporter';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'frontend',
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
    deps: {
      optimizer: {
        web: {
          include: [
            '@emotion/react',
            '@emotion/styled',
            '@mui/material',
            '@mui/styled-engine'
          ]
        }
      }
    },
    reporters: [
      'default',
      new MarkdownReporter({ 
        outputFile: 'frontend-test-results.md',
        outputDir: path.resolve(__dirname, '../../..', 'test-results')
      })
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      include: [
        'src/**/*.{ts,tsx}'
      ],
      exclude: [
        'src/**/*.spec.{ts,tsx}',
        'src/**/*.test.{ts,tsx}',
        'tests/**/*',
        'src/**/*.d.ts',
        'src/main.tsx', // Entry point - tested via integration
        'src/App.tsx' // Main app - tested via integration
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  },
  resolve: {
    alias: [
      { find: /^@sheetpilot\/shared\/(.+)$/, replacement: path.resolve(__dirname, '../../shared/$1') },
      { find: '@sheetpilot/shared', replacement: path.resolve(__dirname, '../../shared/index.ts') },
      { find: '@', replacement: path.resolve(__dirname, '../src') },
      { find: '@tests', replacement: path.resolve(__dirname, '.') },
    ]
  }
});
