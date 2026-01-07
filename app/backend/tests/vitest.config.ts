import { defineConfig } from 'vitest/config';
import path from 'path';
import { MarkdownReporter } from './helpers/markdown-reporter';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    }
  },
  test: {
    name: 'backend-unit',
    environment: 'node',
    root: path.resolve(__dirname, '../../..'),
    include: [
      'app/backend/tests/unit/**/*.spec.ts'
    ],
    passWithNoTests: false,
    globals: true,
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    testTimeout: 5000, // Reduced to 5 seconds for faster test runs
    // Enable parallelization now that better-sqlite3 is mocked
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,  // Enable parallelization
        minThreads: 1,
        useAtomics: true
      }
    },
    maxConcurrency: 4, // Allow concurrent tests for better performance
    fileParallelism: true, // Enable file parallelism
    reporters: [
      'default',
      new MarkdownReporter({ 
        outputFile: 'unit-test-results.md',
        outputDir: path.resolve(__dirname, '../../..', 'test-results')
      })
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      include: [
        'app/backend/src/**/*.ts'
      ],
      exclude: [
        'app/backend/src/**/*.spec.ts',
        'app/backend/src/**/*.test.ts',
        'app/backend/tests/**/*',
        'app/backend/src/**/*.d.ts',
        'app/backend/src/main.ts', // Main entry point - tested via integration
        'app/backend/src/preload.ts' // Preload script - tested separately
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  },
  define: {
    'import.meta.env': JSON.stringify({
      DEV: true,
      MODE: 'test',
      PROD: false
    })
  }
});
