import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run tests in Node environment (backend)
    environment: "node",
    // TypeScript support via built-in esbuild transform
    globals: false,
    // Pattern for test files
    include: ["src/tests/**/*.test.ts"],
    // Inline snapshot support
    reporters: ["verbose"],
    // Increase timeout for integration tests (they spin up an express app)
    testTimeout: 15000,
    // Run sequentially to avoid module-mock conflicts across tests
    singleFork: true,
    // Coverage (optional)
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/tests/**", "src/**/*.d.ts"],
    },
  },
  resolve: {
    // Handle .js extension imports (TypeScript ESM)
    conditions: ["node"],
  },
});
