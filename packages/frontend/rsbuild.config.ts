import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginSolid } from "@rsbuild/plugin-solid";

const BACKEND_TARGET = process.env["BACKEND_TARGET"] || "http://localhost:3000";

export default defineConfig({
  plugins: [
    pluginBabel({
      include: [
        /[\\/]src[\\/].*\.(?:jsx|tsx)$/,
        /[\\/]node_modules[\\/]@solidjs[\\/]meta[\\/]/,
        /[\\/]node_modules[\\/]@solidjs[\\/]router[\\/]/,
        /[\\/]node_modules[\\/]@tanstack[\\/]solid-query-devtools[\\/]/,
      ],
    }),
    pluginSolid(),
  ],
  source: {
    entry: {
      index: "./src/index.tsx",
    },
    include: [
      /[\\/]node_modules[\\/]@solidjs[\\/]meta[\\/]/,
      /[\\/]node_modules[\\/]@solidjs[\\/]router[\\/]/,
      /[\\/]node_modules[\\/]@tanstack[\\/]solid-query-devtools[\\/]/,
    ],
  },
  server: {
    host: "0.0.0.0",
    port: parseInt(process.env["FRONTEND_PORT"] || "5173", 10),
    proxy: {
      "/api": {
        target: BACKEND_TARGET,
        changeOrigin: true,
        secure: false,
      },

      "/api/ws": {
        target: BACKEND_TARGET,
        ws: true,
        changeOrigin: true,
      },

      "/robots.txt": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },

      "/sitemap.xml": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
    },
  },
});
