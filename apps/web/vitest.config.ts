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
    include: ["app/**/*.test.ts", "app/**/*.test.tsx"],
  },
});
