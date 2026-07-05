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
  serverExternalPackages: ["bullmq", "ioredis", "@prisma/client"],

  // These are workspace TS packages (no build step) — tell Next to run its
  // own SWC transform over them so TS/ESM-with-.js-specifier resolves
  // correctly, the same as first-party app code.
  transpilePackages: ["@auditor/db", "@auditor/queue"],
};

export default nextConfig;
