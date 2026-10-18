import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**"],
      provider: "v8",
    },
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
