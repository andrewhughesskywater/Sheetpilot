import { defineProject } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { MarkdownReporter } from '../../backend/tests/helpers/markdown-reporter';

export default defineProject({
  root: __dirname,
  plugins: [react()],
  test: {
    name: 'frontend',
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: [
      'tests/**/*.spec.{ts,tsx}',
      'tests/**/*.test.{ts,tsx}',
      'src/**/*.spec.{ts,tsx}',
      'src/**/*.test.{ts,tsx}'
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@tests': path.resolve(__dirname, 'tests')
    }
  }
});
