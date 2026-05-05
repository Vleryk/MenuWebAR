import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["client/vitest.config.js", "server/vitest.config.js"],
  },
});
