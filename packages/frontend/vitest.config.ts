import { defineConfig } from "vitest/config";
import solidPlugin from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
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
      include: ["src/routes/games/bomberman/**/*.tsx", "src/routes/games/bomberman/**/*.ts"],
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
