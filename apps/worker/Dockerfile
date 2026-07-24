# syntax=docker/dockerfile:1

# =============================================================================
# @auditor/worker container image
# =============================================================================
# Runs the BullMQ Worker + Crawlee + the selective Playwright render pass
# (@auditor/render) and the PSI/Lighthouse sampling. This is a background
# worker service — it exposes NO HTTP port.
#
# The base image is PINNED to the exact Playwright version installed in the
# workspace (playwright@1.61.1). This is mandatory: Playwright's bundled
# Chromium build is tied 1:1 to the npm package version, so a drifting/`:latest`
# tag causes "browser executable doesn't exist" at runtime. NEVER use `:latest`
# here — bump the npm `playwright` version and this tag together (SC#4).
#
# Low-/dev/shm mitigation: @auditor/render launches Chromium with
# `--disable-dev-shm-usage` (and `--no-sandbox`) already (see 12-02
# packages/render/src/browser.ts), so the 64MB default /dev/shm won't crash
# Chromium under RENDER_CONCURRENCY=2 + the PSI pass. On the host (Railway),
# additionally run the container with `--ipc=host` or a larger `--shm-size`
# (e.g. `--shm-size=1g`) for headroom when concurrency grows.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — builder: install deps, generate the Prisma client, build the worker
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS builder

WORKDIR /app

# pnpm via corepack (pinned by the workspace's packageManager field if present).
RUN corepack enable

# Copy the workspace manifest set first for a cacheable install layer. The
# worker depends (directly or transitively) on every @auditor/* package, so we
# copy all package.json files plus the lockfile and workspace config.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/checks/package.json packages/checks/package.json
COPY packages/crawler/package.json packages/crawler/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/fingerprint/package.json packages/fingerprint/package.json
COPY packages/graph/package.json packages/graph/package.json
COPY packages/psi/package.json packages/psi/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY packages/render/package.json packages/render/package.json
COPY packages/scoring/package.json packages/scoring/package.json

# Install the worker's dependency closure. The Playwright browsers are already
# baked into the base image, so skip the browser download during npm install.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile --filter @auditor/worker...

# Copy the sources the worker actually needs (NOT apps/web — Playwright must
# never reach the Vercel bundle, and the web app has no place in this image).
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/worker apps/worker
COPY packages/checks packages/checks
COPY packages/crawler packages/crawler
COPY packages/db packages/db
COPY packages/fingerprint packages/fingerprint
COPY packages/graph packages/graph
COPY packages/psi packages/psi
COPY packages/queue packages/queue
COPY packages/render packages/render
COPY packages/scoring packages/scoring

# Generate the Prisma client (required by @auditor/db) and build the worker.
RUN pnpm --filter @auditor/db db:generate
RUN pnpm --filter @auditor/worker build

# -----------------------------------------------------------------------------
# Stage 2 — runtime
# -----------------------------------------------------------------------------
# The @auditor/* workspace packages ship TypeScript source (their package
# `main`/`types` point at src/index.ts, they emit no JS), so the built worker
# entry (apps/worker/dist/index.js) still imports TS from those packages at
# runtime. We register `tsx` as a Node loader (`node --import tsx`) so those
# workspace TS imports transpile on the fly while the worker's own entry is the
# built dist/index.js. tsx is part of the installed dependency closure.
FROM mcr.microsoft.com/playwright:v1.61.1-noble AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN corepack enable

# Copy the fully-installed, built workspace from the builder. pnpm's symlinked
# store makes selective copying brittle, so bring the resolved tree wholesale.
COPY --from=builder /app /app

# Background worker: no EXPOSE (no HTTP port).
#
# `tsx` is apps/worker's own devDependency, placed in its own pnpm-managed
# node_modules -- resolving `--import tsx` from cwd `/app` (the monorepo
# root) fails with ERR_MODULE_NOT_FOUND, confirmed the first time this image
# actually ran. `pnpm --filter @auditor/worker exec` runs with the correct
# cwd/resolution context (apps/worker), same as the package's own `dev`
# script does locally.
CMD ["pnpm", "--filter", "@auditor/worker", "exec", "node", "--import", "tsx", "dist/index.js"]
