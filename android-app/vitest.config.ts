import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "expo-constants": "./src/test/mocks/expoConstants.ts"
    }
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
