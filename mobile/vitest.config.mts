import { defineConfig } from "vitest/config";
import path from "node:path";

// The app's pure logic, run in Node (the screens are checked by the iOS
// bundle export and the screenshot pass, scripts/screenshots.mjs).
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "../lib/elite"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
