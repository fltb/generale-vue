import { defineConfig } from "vitest/config";
import solidPlugin from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: [
      { find: "@generale/bomberman-engine", replacement: path.resolve(__dirname, "../bomberman-engine/src/index.ts") },
      { find: "@generale/types", replacement: path.resolve(__dirname, "../types/src/index.ts") },
      { find: "@generale/i18n/locales", replacement: path.resolve(__dirname, "../i18n/locales") },
      { find: "@generale/i18n", replacement: path.resolve(__dirname, "../i18n/src/index.ts") },
      { find: "~", replacement: path.resolve(__dirname, "src") },
    ],
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    include: ["src/**/__tests__/**/*.test.{ts,tsx}", "src/ws/__test__/**/*.test.ts"],
    globals: false,
    server: {
      deps: {
        inline: ["solid-js"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/__tests__/**", "src/**/*.d.ts"],
      thresholds: {
        "src/routes/games/bomberman/**/*.{ts,tsx}": {
          lines: 20,
          branches: 10,
          functions: 10,
          statements: 20,
        },
      },
    },
  },
});
