import { defineProject } from "vitest/config";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineProject({
  root: __dirname,
  test: {
    name: "backend-e2e",
    environment: "node",
    globals: true,
    include: ["tests/e2e/**/*.spec.ts"],
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
        maxThreads: 1,
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
