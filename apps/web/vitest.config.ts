import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Only run the API route unit tests; Next's build/type layer stays with tsc.
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
  },
});
