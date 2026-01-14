import { defineProject } from "vitest/config";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineProject({
  root: __dirname,
  test: {
    name: "backend-unit",
    environment: "node",
    globals: true,
    include: [
      "tests/unit/**/*.spec.ts",
      "tests/validation/**/*.spec.ts",
      "tests/contracts/**/*.spec.ts",
      "tests/logic/**/*.spec.ts",
      "tests/middleware/**/*.spec.ts",
    ],
    exclude: ["node_modules", "dist", "build"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 5000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
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
        // Validation and logic require high coverage
        'src/validation': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        'src/logic': {
          lines: 85,
          functions: 85,
          branches: 85,
          statements: 85,
        },
      },
    },
    pool: "threads",
    poolOptions: {
      threads: {
        maxThreads: 4,
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
