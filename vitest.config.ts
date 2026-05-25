import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "extension", ".next"],
    pool: "forks",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "server-only": resolve(__dirname, "tests/empty.ts"),
    },
  },
});
