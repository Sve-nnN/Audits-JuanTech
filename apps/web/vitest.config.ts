import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // React plugin enables JSX/TSX transform for component tests (ExportMenu).
  // The default test environment stays "node" (Phase 13 route tests); DOM tests
  // opt in per-file via the `// @vitest-environment jsdom` docblock.
  plugins: [react()],
  test: {
    environment: "node",
    // Only run the API route unit tests; Next's build/type layer stays with tsc.
    // Pages Router tests live under tests/pages/** (not pages/** itself) —
    // Next.js treats every .ts file inside pages/api as a route, so a
    // co-located *.test.ts there would fail the build (missing default export).
    include: [
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
    ],
  },
});
