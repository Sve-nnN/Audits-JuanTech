#!/usr/bin/env node
/**
 * SC#4 boundary guardrail: Playwright / Chromium must NEVER reach the Vercel
 * (@auditor/web) bundle. The heavy browser stack lives only in the worker via
 * the worker-only @auditor/render package.
 *
 * Why not a naive "`pnpm why playwright` is empty" check?
 * ------------------------------------------------------
 * `pnpm --filter @auditor/web why playwright` is NOT empty and never will be:
 * apps/web depends on @auditor/checks → @auditor/crawler → crawlee →
 * @crawlee/playwright, and crawlee declares `playwright` as a **peer**
 * dependency. So playwright shows up as a `peer` edge in BOTH the web and the
 * worker graphs, identically — an unmet/peer declaration that Next.js
 * tree-shakes away (apps/web uses the Cheerio crawler path, never the
 * Playwright one). That peer chain pre-dates this phase and is not the thing
 * we must guard.
 *
 * What actually would put Chromium in the Vercel bundle is a **real
 * (non-peer)** dependency edge that imports Playwright — i.e. @auditor/render
 * (which declares `playwright: 1.61.1` as a real dep) leaking into the web
 * graph. Phase 13 adds a second carrier to watch: @auditor/export is now a
 * REAL dependency of apps/web (it powers the export route), so this guardrail
 * must also prove that @auditor/export drags neither Puppeteer nor Chromium
 * into the web graph — its serializers (@react-pdf/renderer, pptxgenjs) are
 * pure JS with no headless browser. So this guardrail asserts, deterministically:
 *
 *   A. `playwright` is not a DIRECT dependency of apps/web.
 *   B. `@auditor/render` (the real Playwright carrier) does not resolve
 *      anywhere in @auditor/web's dependency graph.
 *   C. `pnpm --filter @auditor/web why playwright` contains no **non-peer**
 *      (real/resolved) playwright edge — only the tolerated crawlee peer chain.
 *   D. No `puppeteer` or `chromium` edge resolves in the web graph at all —
 *      the guarantee that @auditor/export (the new real dep) stays browserless.
 *
 * Any failure exits non-zero so CI blocks the merge.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Runs a command and returns { stdout, code } without throwing on non-zero. */
function run(cmd, args) {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, code: 0 };
  } catch (err) {
    return {
      stdout: `${err.stdout ?? ""}${err.stderr ?? ""}`,
      code: typeof err.status === "number" ? err.status : 1,
    };
  }
}

const failures = [];

// --- Check A: playwright is not a direct dependency of apps/web ---------------
const webPkg = JSON.parse(
  readFileSync(resolve(repoRoot, "apps/web/package.json"), "utf8"),
);
const directDeps = {
  ...(webPkg.dependencies ?? {}),
  ...(webPkg.devDependencies ?? {}),
  ...(webPkg.optionalDependencies ?? {}),
};
if (Object.keys(directDeps).some((name) => name === "playwright")) {
  failures.push(
    "apps/web/package.json declares a direct `playwright` dependency.",
  );
}

// --- Check B: @auditor/render must not resolve in the web graph ---------------
// `pnpm why` prints nothing (empty) when the package is absent, and prints an
// `@auditor/render link:...` edge when present.
const renderWhy = run("pnpm", [
  "--filter",
  "@auditor/web",
  "why",
  "@auditor/render",
]);
if (/@auditor\/render/.test(renderWhy.stdout)) {
  failures.push(
    "@auditor/render (the real Playwright carrier) resolves inside @auditor/web's dependency graph.",
  );
}

/**
 * Return the "real" (dangerous) resolved edges for a browser package in a
 * `pnpm why` tree, tolerating the crawlee peer chain.
 *
 * Exact-token matching is not enough: the packages that actually ship a
 * Chromium download in the 2026 ecosystem are frequently named with a `-core`
 * suffix or a scope (`puppeteer-core`, `playwright-core`, `@puppeteer/browsers`,
 * `@sparticuz/chromium`, `chrome-aws-lambda`). A `puppeteer\s+\d` boundary never
 * matches `puppeteer-core@24.0.0`, so we relax the version boundary to accept an
 * `@`- OR whitespace-separated version.
 *
 * Peer nuance: the tolerated crawlee chain is `... → playwright (peer) →
 * playwright-core`. The `playwright` line carries the trailing `peer` marker,
 * but its `playwright-core` CHILD does not — a naive per-line `!/peer$/` filter
 * would therefore flag every peer-chain `playwright-core` as a false positive.
 * We instead track indentation: once inside a `peer` subtree, every deeper node
 * is tree-shaken away by Next.js and is tolerated. An edge is dangerous only
 * when it is neither a peer edge itself nor nested under a peer ancestor.
 */
function realBrowserEdges(stdout, browserPkg) {
  // Escape regex metacharacters in the package name (scopes contain `/`, `@`).
  const esc = browserPkg.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  // A dependency edge references the package name followed by its version,
  // separated by whitespace OR `@` (e.g. "puppeteer-core 24.0.0",
  // "@sparticuz/chromium@2.0.0", "└── playwright-core 1.61.1"). The `[@\s]`
  // boundary (not `\s`) is what lets scoped/`-core` variants trip the guard.
  const edgeRe = new RegExp(`(^|[│├└─\\s])${esc}[@\\s]+\\d[\\w.-]*`);
  const dangerous = [];
  // Indentation (column of the branch connector) of the nearest `peer` ancestor.
  // Any node deeper than this lives inside a tree-shaken peer subtree.
  let peerIndent = Infinity;
  for (const raw of stdout.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const connector = line.search(/[├└]/);
    const indent = connector >= 0 ? connector : 0;
    // Returning to shallower/equal depth means we've exited the peer subtree.
    if (indent <= peerIndent) peerIndent = Infinity;
    const isPeer = /\bpeer\s*$/.test(line);
    if (isPeer) peerIndent = indent;
    const trimmed = line.trim();
    if (!edgeRe.test(trimmed)) continue;
    // Tolerated if the edge is a peer edge itself or nested under a peer node;
    // otherwise it is a real resolved edge that would bundle a browser engine.
    if (isPeer || indent > peerIndent) continue;
    dangerous.push(trimmed);
  }
  return dangerous;
}

// --- Check C: no non-peer playwright edge in the web graph --------------------
const pwWhy = run("pnpm", ["--filter", "@auditor/web", "why", "playwright"]);
const nonPeerPlaywrightEdges = realBrowserEdges(pwWhy.stdout, "playwright");
if (nonPeerPlaywrightEdges.length > 0) {
  failures.push(
    `@auditor/web has ${nonPeerPlaywrightEdges.length} non-peer (real) playwright edge(s):\n    ` +
      nonPeerPlaywrightEdges.join("\n    "),
  );
}

// --- Check D: no puppeteer/chromium/-core/scoped browser edge -----------------
// @auditor/export is a REAL dependency of apps/web as of Phase 13. Its
// serializers (@react-pdf/renderer, pptxgenjs) are pure JS — no headless
// browser. Enumerate the known Chromium carriers (including `-core` and scoped
// variants) so a future dep dragging in `puppeteer-core` or `@sparticuz/chromium`
// can't slip past the guardrail with a false PASS.
for (const browserPkg of [
  "puppeteer",
  "puppeteer-core",
  "@puppeteer/browsers",
  "chromium",
  "@sparticuz/chromium",
  "chrome-aws-lambda",
  "playwright-core",
  "@playwright/test",
]) {
  const why = run("pnpm", ["--filter", "@auditor/web", "why", browserPkg]);
  const realEdges = realBrowserEdges(why.stdout, browserPkg);
  if (realEdges.length > 0) {
    failures.push(
      `@auditor/web has ${realEdges.length} real (non-peer) ${browserPkg} edge(s) — likely via @auditor/export:\n    ` +
        realEdges.join("\n    "),
    );
  }
}

// --- Report -------------------------------------------------------------------
if (failures.length > 0) {
  console.error("FAIL: Playwright boundary violated — it can reach the web bundle.");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nPlaywright/Chromium must stay in the worker only (via @auditor/render). " +
      "Do NOT add playwright or @auditor/render to apps/web.",
  );
  process.exit(1);
}

console.log(
  "PASS: Playwright stays out of the @auditor/web bundle " +
    "(no direct dep, no @auditor/render in the web graph, no non-peer playwright edge).",
);
process.exit(0);
