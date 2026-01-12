import { defineProject } from "vitest/config";
import path from "path";

/**
 * Vitest Configuration for Cross-Cutting Tests
 * 
 * This configuration is for tests in app/tests/ that cover cross-cutting concerns:
 * - Accessibility tests
 * - E2E tests (user journeys)
 * - Integration tests (submission progress)
 * - Performance tests (database, rendering)
 * - Security tests (authentication, data protection, input validation)
 */
export default defineProject({
  root: __dirname,
  test: {
    name: "app-tests",
    environment: "node",
    globals: true,
    include: [
      "accessibility/**/*.spec.ts",
      "e2e/**/*.spec.ts",
      "integration/**/*.spec.ts",
      "performance/**/*.spec.ts",
      "security/**/*.spec.ts",
    ],
    exclude: ["node_modules", "dist", "build"],
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    reporters: process.env.CI ? ["verbose"] : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "**/*.spec.ts",
        "**/*.test.ts",
        "dist/",
        "build/",
        "coverage/",
      ],
      all: false,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".."),
    },
  },
});
