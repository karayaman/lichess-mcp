import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Contract check: requests sent by tool tests must match the Lichess API spec.
    globalSetup: ["tests/contract/global-setup.ts"],
    setupFiles: ["tests/contract/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/types/**"],
    },
  },
});
