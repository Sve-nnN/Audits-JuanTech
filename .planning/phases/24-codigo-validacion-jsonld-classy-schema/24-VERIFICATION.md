---
phase: 24-codigo-validacion-jsonld-classy-schema
verified: 2026-07-10T02:00:00Z
status: passed
score: 9/9 must-haves verified
overrides_applied: 0
---

# Phase 24: Código + validación JSON-LD estilo Classy Schema Verification Report

**Phase Goal:** Código + validación JSON-LD estilo Classy Schema — JSON-LD formateado por entidad + validación por propiedad/tipo contra schema.org
**Verified:** 2026-07-10T02:00:00Z
**Status:** passed
**Human-verify checkpoint:** APPROVED by Juan (24-03 Task 3, blocking gate) — treated as satisfied, not re-requested.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `validateEntities` valida 13 tipos, required=error/recommended=warning por propiedad, con status agregado por entidad | ✓ VERIFIED | `packages/checks/src/checks/schema/validateEntities.ts` — logic confirmed by reading; `SCHEMA_RULES` extended to 13 types in `schemaValidate.ts` |
| 2 | Anti-patrón Product+AggregateRating sin reviewCount/ratingValue → warning, nunca error | ✓ VERIFIED | `antiPatterns()` in validateEntities.ts:59-79, hardcoded `status: "warning"` |
| 3 | Article/BlogPosting sin author/datePublished → warning; propiedad desconocida no genera hallazgo | ✓ VERIFIED | Covered by required/recommended mechanism + unknown props excluded from `properties`/`issues` by construction |
| 4 | Motor puro, determinista, sin cheerio/React/IO | ✓ VERIFIED | Imports only `./extract` + `./schemaValidate`; no Date.now/Math.random (`grep` returns 0) |
| 5 | Check de scoring SD-07 emite sólo ok/warning, nunca critical | ✓ VERIFIED | `schemaEntityValidate.ts` test suite asserts no critical severities; registered in `schemaPageChecks` replacing SD-04 |
| 6 | `Page.schemaJson (Json?)` persiste entidades JSON-LD planas; worker las escribe al final del audit junto a schemaGraph | ✓ VERIFIED | `schema.prisma:121`; worker `apps/worker/src/index.ts:541-549` unified update; `pnpm db:push` applied per SUMMARY (confirmed "database is now in sync") |
| 7 | `runAllChecks` devuelve `pageSchemaEntities` por Page.id | ✓ VERIFIED | `packages/checks/src/registry.ts:44,57,68,82` |
| 8 | Detalle de página muestra card por entidad JSON-LD (header @type + árbol propiedad→valor anidado indentado) con badges por propiedad/entidad (ok/warning/error), sin marcar desconocidas | ✓ VERIFIED | `SchemaEntities.tsx` — `EntityCard`, `PropertyRows`, `statusByProp` only set for properties present in `validation.properties`; badge omitted for unknown keys |
| 9 | Toggle a código crudo formateado (pre + JSON.stringify) por entidad, datos desde `schemaJson` con fallback Playwright-free por `html` | ✓ VERIFIED | `SchemaEntities.tsx:190-191` toggle; `page.tsx` uses `page.schemaJson` first, lazily fetches `html` only when null, via narrow `@auditor/checks/validate` entry (cheerio-only, confirmed Playwright-free by `assert-no-playwright-in-web.mjs` PASS) |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/checks/src/checks/schema/validateEntities.ts` | Pure engine, 13-type rules + anti-patterns | ✓ VERIFIED | Exists, substantive, wired (used by schemaEntityValidate.ts and re-exported for web) |
| `packages/checks/src/checks/schema/validateEntities.test.ts` | Full behavior coverage | ✓ VERIFIED | 11 tests passing |
| `packages/checks/src/checks/schema/schemaEntityValidate.ts` | SD-07 scoring check | ✓ VERIFIED | Registered in `schemaPageChecks`; 5 tests passing |
| `packages/db/prisma/schema.prisma` | `Page.schemaJson Json?` | ✓ VERIFIED | Field present at line 121, documented |
| `packages/checks/src/registry.ts` | `pageSchemaEntities` in `RunAllChecksResult` | ✓ VERIFIED | Populated reusing already-loaded `$` |
| `apps/web/app/components/SchemaEntities.tsx` | Client component: entity tree + badges + raw toggle | ✓ VERIFIED | Wired into page.tsx, renders correctly, breadth+depth caps applied (WR-02 fix) |
| `apps/web/app/components/SchemaEntities.module.css` | Tokens-only styles | ✓ VERIFIED | No hex colors found (`grep` empty) |
| `apps/web/app/audits/[id]/pages/[pageId]/page.tsx` | Wiring: schemaJson/html select, validateEntities, new section | ✓ VERIFIED | Section "Código y validación JSON-LD" between graph and findings; `html` fetched lazily only on fallback (WR-03 fix) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|----|--------|---------|
| `schemaEntityValidate.ts` | `validateEntities.ts` | import + map to IssueDraft ok/warning | ✓ WIRED | Confirmed in source and tests |
| `index.ts` | `schemaEntityValidateCheck` + `validateEntities` | registration + re-export | ✓ WIRED | `schemaPageChecks` array includes SD-07, not SD-04; re-exports present |
| `apps/worker/src/index.ts` | `Page.schemaJson` | `prisma.page.update` with `data.schemaJson` | ✓ WIRED | Line 549, unified update per page |
| `packages/checks/src/registry.ts` | `flattenNodes/extractJsonLdBlocks` | reuse of loaded `$` | ✓ WIRED | Line ~57-68 |
| `page.tsx` | `validateEntities` (`@auditor/checks/validate`) | server-side run + props to component | ✓ WIRED | Narrow browser-safe entry point confirmed cheerio-only, no crawler leak |
| `page.tsx` | `Page.schemaJson` / fallback `Page.html` | conditional fetch | ✓ WIRED | Lazy second query only if `schemaJson === null` |
| `SchemaEntities.tsx` | `EntityValidation` results | badge mapping by property name | ✓ WIRED | `statusByProp` map, badges only for known properties |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| SDVIZ-02 | 24-02, 24-03 | JSON-LD formateado por entidad, árbol de propiedades | ✓ SATISFIED | `Page.schemaJson` persisted + `SchemaEntities` renders entity tree + raw toggle |
| SDVIZ-03 | 24-01, 24-03 | Validación por propiedad/tipo, nunca falla dura del score | ✓ SATISFIED | `validateEntities` engine + SD-07 (ok/warning only) + UI badges |

Note: `.planning/REQUIREMENTS.md` still shows both as unchecked/"Pending" — this is a documentation bookkeeping item (typically closed at milestone-level), not a functional gap; code evidence fully satisfies both IDs.

### Anti-Patterns Found

None blocking. Code review (24-REVIEW.md) found 3 warnings (WR-01 CHECK_ID collision, WR-02 breadth cap missing, WR-03 unconditional html fetch) — all 3 confirmed fixed in code via 24-REVIEW-FIX.md and independently re-verified in this pass:
- `schemaValidate.ts:8` → `CHECK_ID = "SD-04-legacy"` (no longer collides with `danglingIds.ts`'s active `SD-04`)
- `SchemaEntities.tsx` → `MAX_ITEMS_PER_LEVEL = 50` applied in array/object/primitive-array branches
- `page.tsx` → `html` no longer in primary `select`; only fetched lazily on fallback path

Info-level findings (IN-01/02/03) were explicitly out of scope (fix_scope: critical_warning) and are non-blocking cosmetic items (dedup of type list in message, key-by-index for entity cards).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Engine + SD-07 tests | `pnpm exec vitest run validateEntities.test.ts schemaEntityValidate.test.ts` | 16/16 passed | ✓ PASS |
| Full checks suite (regression) | `cd packages/checks && pnpm test` | 121/121 passed, 24 files | ✓ PASS |
| checks typecheck | `pnpm typecheck` | clean | ✓ PASS |
| web typecheck | `pnpm typecheck` | clean | ✓ PASS |
| web build | `pnpm build` | succeeds, `/audits/[id]/pages/[pageId]` route compiles | ✓ PASS |
| No hex colors in new CSS | `grep -Ei "#[0-9a-f]{3,6}"` | no matches | ✓ PASS |
| No Playwright leak in web | `node scripts/assert-no-playwright-in-web.mjs` | PASS | ✓ PASS |
| No debt markers (TBD/FIXME/XXX) | `grep` on all phase-modified files | no matches | ✓ PASS |

### Human Verification Required

None outstanding. The phase's blocking `checkpoint:human-verify` gate (24-03 Task 3) was already presented to and approved by Juan per 24-03-SUMMARY.md ("Checkpoint visual (Task 3) presentado y aprobado por Juan"). No new visual/behavioral items require human judgment beyond what was already approved.

### Gaps Summary

No gaps found. All 9 derived truths verified against actual code (not SUMMARY claims), all artifacts exist/are substantive/are wired, all 3 code-review warnings confirmed fixed, full test suite green, typecheck clean on both packages, web build succeeds, and the human-verify checkpoint was already approved by the project owner.

---

_Verified: 2026-07-10T02:00:00Z_
_Verifier: Claude (gsd-verifier)_
