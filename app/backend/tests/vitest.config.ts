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
    environment: 'node',
    root: path.resolve(__dirname, '../../..'),
    include: [
      'app/backend/tests/unit/**/*.spec.ts',
      'app/backend/tests/contracts/**/*.spec.ts'
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
    ]
  },
  define: {
    'import.meta.env': JSON.stringify({
      DEV: true,
      MODE: 'test',
      PROD: false
    })
  }
});
