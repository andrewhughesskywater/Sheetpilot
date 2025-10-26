import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['__tests__/**/*.spec.ts', '__tests__/**/*.spec.tsx'],
    passWithNoTests: false,
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    testTimeout: 10000, // Reduced to 10 seconds to prevent hanging
    // Prevent resource-intensive operations
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
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
