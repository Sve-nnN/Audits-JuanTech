# syntax=docker/dockerfile:1

# =============================================================================
# @auditor/web container image
# =============================================================================
# Next.js frontend for the pnpm/turbo monorepo. Built explicitly with a
# workspace-aware Dockerfile rather than relying on Nixpacks' generic
# JS-project auto-detection, which does not understand pnpm workspace
# `--filter` scoping and would otherwise try to build/start the wrong
# package (or all of them). Mirrors the layering approach already proven in
# apps/worker/Dockerfile.
#
# No `output: "standalone"` is set in next.config.ts (the app deliberately
# keeps bullmq/ioredis/@prisma/client/@react-pdf/renderer external — see that
# file's comments), so the runtime stage needs the full installed
# node_modules tree, not just a standalone bundle.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — builder
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /app
RUN corepack enable

# Workspace manifests first for a cacheable install layer. @auditor/web's
# own dependency closure (see apps/web/package.json): checks, db, email,
# export, queue, quota, report-model, scoring.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/checks/package.json packages/checks/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/email/package.json packages/email/package.json
COPY packages/export/package.json packages/export/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY packages/quota/package.json packages/quota/package.json
COPY packages/report-model/package.json packages/report-model/package.json
COPY packages/scoring/package.json packages/scoring/package.json

RUN pnpm install --frozen-lockfile --filter @auditor/web...

# Copy only the sources @auditor/web actually needs (not apps/worker or the
# Playwright/crawler-only packages — keeps this image lean and unrelated to
# the worker's browser dependency).
COPY tsconfig.base.json ./tsconfig.base.json
COPY apps/web apps/web
COPY packages/checks packages/checks
COPY packages/db packages/db
COPY packages/email packages/email
COPY packages/export packages/export
COPY packages/queue packages/queue
COPY packages/quota packages/quota
COPY packages/report-model packages/report-model
COPY packages/scoring packages/scoring

# Prisma client must exist before `next build` (it's require()'d at runtime
# via serverExternalPackages, but Next still resolves the module during the
# build's type-check/trace phase).
RUN pnpm --filter @auditor/db db:generate
RUN pnpm --filter @auditor/web build

# -----------------------------------------------------------------------------
# Stage 2 — runtime
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# pnpm's symlinked store makes selective copying brittle — bring the
# resolved tree wholesale, same rationale as apps/worker/Dockerfile.
COPY --from=builder /app /app

EXPOSE 3000
CMD ["pnpm", "--filter", "@auditor/web", "start"]
