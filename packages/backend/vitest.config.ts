import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist", "src/__tests__"],
    reporters: ["verbose"],
    env: {
      DB_FILE_NAME: ":memory:",
    },
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/__tests__/**"],
      thresholds: {
        // Game core + service files must maintain minimum coverage
        "src/games/bomberman/**/*.ts": {
          lines: 50,
          branches: 40,
          functions: 40,
          statements: 50,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
      "@generale/i18n": path.resolve(import.meta.dirname, "../i18n/src/index.ts"),
    },
  },
});
