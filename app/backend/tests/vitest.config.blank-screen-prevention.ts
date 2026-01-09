import { defineConfig } from 'vitest/config';
import path from 'path';
import { MarkdownReporter } from './helpers/markdown-reporter';

export default defineConfig({
  test: {
    name: 'backend-blank-screen',
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    globals: true,
    include: [
      '__tests__/**/*.spec.{ts,tsx}',
      '__tests__/**/*.test.{ts,tsx}'
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
        outputFile: 'backend-blank-screen-test-results.md',
        outputDir: path.resolve(__dirname, '../../..', 'test-results')
      })
    ]
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
