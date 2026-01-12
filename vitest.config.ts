import { defineConfig } from "vitest/config";

/**
 * Root Vitest Workspace Configuration
 *
 * This configuration defines multiple projects within a single monorepo using workspace mode.
 * Each project has its own vitest.config.ts file with specific settings.
 *
 * Projects:
 * - Backend: unit, integration, e2e, smoke tests
 * - Frontend: React component and integration tests
 * - Shared: Utility and library tests
 *
 * Benefits:
 * - All tests are discoverable by VS Code Vitest extension
 * - Projects can run in parallel
 * - Each project maintains its own test environment and settings
 * - Supports different test types (unit, integration, e2e, smoke)
 */
export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: false,
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
    projects: [
      // Backend projects
      "app/backend/vitest.config.unit.ts",
      "app/backend/vitest.config.integration.ts",
      "app/backend/vitest.config.e2e.ts",
      "app/backend/vitest.config.smoke.ts",
      // Frontend project
      "app/frontend/vitest.config.ts",
      // Shared project
      "app/shared/vitest.config.ts",
    ],
  },
});
