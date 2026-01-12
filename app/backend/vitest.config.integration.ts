import { defineProject } from "vitest/config";
import path from "path";

export default defineProject({
  root: __dirname,
  test: {
    name: "backend-integration",
    environment: "node",
    globals: true,
    include: [
      "tests/auto-updater.spec.ts",
      "tests/database.spec.ts",
      "tests/database-persistence-regression.spec.ts",
      "tests/deprecated-constants.spec.ts",
      "tests/import-policy.spec.ts",
      "tests/ipc-handlers-comprehensive.spec.ts",
      "tests/ipc-main.spec.ts",
      "tests/ipc-workflow-integration.spec.ts",
      "tests/main-application-logic.spec.ts",
      "tests/quarter-config.spec.ts",
      "tests/quarter-routing-integration.spec.ts",
      "tests/submission-database-integration.spec.ts",
      "tests/timesheet_submission_integration.spec.ts",
      "tests/preload.spec.ts",
      "tests/ipc/**/*.spec.ts",
      "tests/integration/**/*.spec.ts",
      "tests/repositories/**/*.spec.ts",
      "tests/services/**/*.spec.ts",
    ],
    exclude: ["node_modules", "dist", "build"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 120000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    reporters: process.env.CI ? ["verbose"] : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "tests/",
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
      "@": path.resolve(__dirname, "src"),
    },
  },
});
