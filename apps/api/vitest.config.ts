import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts", "test/**/*.test.ts"],
    fileParallelism: false,
    globals: true,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
