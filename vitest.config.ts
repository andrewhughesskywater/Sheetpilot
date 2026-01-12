import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Root Vitest Configuration with Projects
 * 
 * This configuration defines multiple projects within a single monorepo.
 * Each project can have its own vitest.config.ts or vitest.config.*.ts file.
 * 
 * Projects are discovered using glob patterns:
 * - app/backend/vitest.config.{unit,integration,e2e,smoke}.ts
 * - app/frontend/vitest.config.ts
 * - app/shared/vitest.config.ts
 * 
 * Benefits:
 * - All tests are discoverable by VS Code Vitest extension
 * - Projects can run in parallel
 * - Each project maintains its own test environment and settings
 * - Supports different test types (unit, integration, e2e, smoke)
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    passWithNoTests: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
        useAtomics: true
      }
    },
    // Define all projects in the monorepo
    projects: [
      // Backend projects (matched by glob pattern)
      'app/backend/vitest.config.unit.ts',
      'app/backend/vitest.config.integration.ts',
      'app/backend/vitest.config.e2e.ts',
      'app/backend/vitest.config.smoke.ts',
      // Frontend project
      'app/frontend/vitest.config.ts',
      // Shared project
      'app/shared/vitest.config.ts',
    ]
  }
});
