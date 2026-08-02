import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/tests/setup.ts"],
  },
  resolve: {
    extensions: [".ts", ".js", ".mjs"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
