import { defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineProject({
  root: __dirname,
  plugins: [react()],
  test: {
    name: "frontend",
    environment: "jsdom",
    globals: true,
    include: [
      "tests/**/*.spec.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
      "src/**/*.spec.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
    ],
    exclude: ["node_modules", "dist", "build"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    isolate: true,
    reporters: process.env.CI ? ["verbose"] : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/*.test.ts",
        "**/*.test.tsx",
        "dist/",
        "build/",
        "coverage/",
        "src/main.tsx",
        "src/vite-env.d.ts",
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
        // Critical components require higher coverage
        'src/components/timesheet': {
          lines: 75,
          functions: 75,
          branches: 75,
          statements: 75,
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
        maxThreads: 4,
        minThreads: 1,
      },
    },
    deps: {
      optimizer: {
        web: {
          include: [
            "@emotion/react",
            "@emotion/styled",
            "@mui/material",
            "@mui/styled-engine",
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@tests": path.resolve(__dirname, "tests"),
    },
  },
});
