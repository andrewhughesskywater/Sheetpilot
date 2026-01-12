import { defineProject } from "vitest/config";
import path from "path";

export default defineProject({
  root: __dirname,
  test: {
    name: "shared",
    environment: "node",
    globals: true,
    include: ["tests/**/*.spec.ts"],
    exclude: ["node_modules", "dist", "build"],
    testTimeout: 5000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
