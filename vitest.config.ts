import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['__tests__/**/*.spec.ts', 'renderer/tests/**/*.spec.tsx'],
    passWithNoTests: false,
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    testTimeout: 30000 // 30 seconds for browser automation tests
  }
});
