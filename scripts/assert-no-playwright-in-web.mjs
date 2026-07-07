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
 * graph. So this guardrail asserts, deterministically:
 *
 *   A. `playwright` is not a DIRECT dependency of apps/web.
 *   B. `@auditor/render` (the real Playwright carrier) does not resolve
 *      anywhere in @auditor/web's dependency graph.
 *   C. `pnpm --filter @auditor/web why playwright` contains no **non-peer**
 *      (real/resolved) playwright edge — only the tolerated crawlee peer chain.
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

// --- Check C: no non-peer playwright edge in the web graph --------------------
const pwWhy = run("pnpm", ["--filter", "@auditor/web", "why", "playwright"]);
const nonPeerPlaywrightEdges = pwWhy.stdout
  .split("\n")
  .map((line) => line.trim())
  // A dependency edge line references the playwright package followed by a
  // version, e.g. "└── playwright 1.61.1" or "playwright 1.61.1 peer".
  .filter((line) => /(^|[│├└─\s])playwright\s+\d[\w.-]*/.test(line))
  // Peer edges are the tolerated, tree-shaken crawlee chain; a line WITHOUT a
  // trailing "peer" marker is a real resolved edge that would bundle Chromium.
  .filter((line) => !/\bpeer\s*$/.test(line));

if (nonPeerPlaywrightEdges.length > 0) {
  failures.push(
    `@auditor/web has ${nonPeerPlaywrightEdges.length} non-peer (real) playwright edge(s):\n    ` +
      nonPeerPlaywrightEdges.join("\n    "),
  );
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
