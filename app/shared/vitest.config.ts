import { defineProject } from "vitest/config";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
