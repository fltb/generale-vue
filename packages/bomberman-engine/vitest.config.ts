import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 10000,
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    reporters: ["verbose"],
  },
});
