import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the native/binary-backed packages out of Next's bundling (server
  // runtime) — they use Node-native APIs (TCP sockets, Prisma's query
  // engine binary) and must be loaded via plain `require`, never bundled.
  // `@auditor/db` / `@auditor/queue` are workspace TS source (no build
  // step), so they're intentionally left OUT of this list and transpiled
  // by Next like any other first-party module; they simply re-export the
  // externals below, which Next still externalizes correctly regardless
  // of which module requires them.
  //
  // `@react-pdf/renderer` MUST be external too, but for a different reason:
  // the PDF export route (`app/api/audits/[id]/export`) runs in the App
  // Router server layer, where Next resolves `react` via the `react-server`
  // export condition. React 19.2's RSC build exposes `__SERVER_INTERNALS…`
  // but NOT `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`,
  // which @react-pdf's bundled reconciler dereferences (`.S`) at render time.
  // Bundled under that condition it crashes with
  // "Cannot read properties of undefined (reading 'S')". Externalizing it makes
  // Next `require()` it at runtime via Node's default conditions, so its whole
  // subtree resolves the CLIENT React build (intact internals) and renders. This
  // keeps @react-pdf (pure JS, no headless Chromium per CLAUDE.md).
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "@prisma/client",
    "@react-pdf/renderer",
  ],

  // These are workspace TS packages (no build step) — tell Next to run its
  // own SWC transform over them so TS/ESM-with-.js-specifier resolves
  // correctly, the same as first-party app code.
  transpilePackages: ["@auditor/db", "@auditor/queue", "@auditor/email", "@auditor/quota", "@auditor/checks"],
};

export default nextConfig;
