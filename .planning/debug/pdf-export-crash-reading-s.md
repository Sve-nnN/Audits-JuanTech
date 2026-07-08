---
status: fixing
trigger: "export pdf failed: TypeError: Cannot read properties of undefined (reading 'S') at toPdf renderToBuffer"
created: 2026-07-08T00:00:00Z
updated: 2026-07-08T00:00:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "Next's App Router server layer resolves `react` via the `react-server` export condition; that RSC build lacks `__CLIENT_INTERNALS...`, which @react-pdf/reconciler-33 dereferences as `.S`, so the render crashes only in the Next server runtime (not vitest)."
  confirming_evidence:
    - "node --conditions=react-server repro-pdf.mjs reproduces the EXACT error at reconciler-33.js inside createRenderer; plain node writes a valid %PDF."
    - "react.react-server.production.js exports __SERVER_INTERNALS... only; reconciler-33 reads __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE."
    - "Single react@19.2.7 in the graph and reconciler 2.0.0 already targets 19.2 -> not a version/dupe bug."
  falsification_test: "If externalizing @react-pdf/renderer (loading it via Node default conditions, no react-server) still crashed, the hypothesis would be wrong. Plain-node repro = default conditions = passes, so externalization must fix it."
  fix_rationale: "serverExternalPackages opts @react-pdf/renderer out of Next's RSC bundling; at runtime it is require()d via Node's default conditions (node/import/default), so its whole subtree resolves the CLIENT React build with intact internals — the exact code path the passing repro exercises. 4.5.1 + reconciler 2.0.0 are already latest, so a version bump is impossible; this is the minimal robust fix and keeps @react-pdf (no headless Chromium)."
  blind_spots: "End-to-end Next route not booted here; relying on the equivalence externalized-load == Node-default-conditions == passing repro. Turbopack path not exercised (app uses Next 15 webpack default)."

next_action: add @react-pdf/renderer to serverExternalPackages, re-verify repro + tests + typecheck.

## Symptoms

expected: GET /api/audits/[id]/export?format=pdf returns a valid PDF buffer
actual: throws TypeError: Cannot read properties of undefined (reading 'S') at toPdf renderToBuffer
errors: "Cannot read properties of undefined (reading 'S')"
reproduction: hit export route with format=pdf in Next dev server
started: unit tests pass (vitest, client React build); only runtime (Next server layer) fails

## Evidence

- checked: node_modules resolution graph
  found: single react@19.2.7 (no duplicate copies); @react-pdf/renderer@4.5.1 -> @react-pdf/reconciler@2.0.0
  implication: NOT a duplicate-React nor reconciler-version-mismatch bug

- checked: @react-pdf/reconciler@2.0.0 lib/index.js selection logic
  found: picks reconciler-33 for React >= 19.2 (explicitly supports 19.2)
  implication: reconciler version is correct for the installed React

- checked: reconciler-33.js internals symbol
  found: reads `React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` then `.S`
  implication: it depends on the CLIENT React build's shared internals

- checked: react@19.2.7 package exports + build files
  found: `.` has a `react-server` condition -> react.react-server.js. Client build exports `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`; react-server build exports `__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE` (no client internals)
  implication: under react-server condition, `__CLIENT_INTERNALS...` is undefined -> `.S` throws

## Resolution

root_cause: The PDF export route runs in Next's App Router server layer, where `react` resolves via the `react-server` export condition. React 19.2's RSC build exports `__SERVER_INTERNALS…` but not `__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`. @react-pdf/reconciler@2.0.0 (reconciler-33, selected for React >=19.2) reads that client-internals object and dereferences its `.S` dispatcher slot at createRenderer time -> `undefined.S` -> "Cannot read properties of undefined (reading 'S')". vitest resolves the normal client build, so its tests passed while the Next runtime crashed. Not a duplicate-React nor a reconciler-version bug (single react@19.2.7; renderer 4.5.1 + reconciler 2.0.0 already latest and 19.2-aware).
fix: Added "@react-pdf/renderer" to `serverExternalPackages` in apps/web/next.config.ts. Externalizing opts it out of RSC bundling; Next require()s it at runtime via Node's default conditions, so the whole @react-pdf subtree resolves the CLIENT React build (intact internals) and renders. Keeps @react-pdf (no headless Chromium).
verification: node --conditions=react-server repro-pdf.mjs reproduced the exact crash; plain node (= externalized load path) wrote a valid 14590-byte %PDF with Khand+Geist embedded and accents/headings parseable via pdf-parse. `pnpm --filter @auditor/export test` 25/25 pass; export + web typecheck clean.
files_changed: [apps/web/next.config.ts, packages/export/scripts/repro-pdf.mjs]
