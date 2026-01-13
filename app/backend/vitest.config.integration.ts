import { defineProject } from "vitest/config";
import path from "path";

export default defineProject({
  root: __dirname,
  test: {
    name: "backend-integration",
    environment: "node",
    globals: true,
    include: [
      "tests/integration/**/*.spec.ts",
      "tests/repositories/**/*.spec.ts",
      "tests/services/**/*.spec.ts",
      "tests/ipc/**/*.spec.ts",
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
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
        // Critical paths require higher coverage
        'src/repositories': {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        'src/services': {
          lines: 75,
          functions: 75,
          branches: 75,
          statements: 75,
        },
      },
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
