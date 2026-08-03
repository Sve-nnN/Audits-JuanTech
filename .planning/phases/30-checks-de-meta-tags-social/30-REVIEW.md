---
phase: 30-checks-de-meta-tags-social
reviewed: 2026-08-03T10:30:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - packages/checks/package.json
  - packages/checks/src/checks/social/charset.test.ts
  - packages/checks/src/checks/social/charset.ts
  - packages/checks/src/checks/social/index.ts
  - packages/checks/src/checks/social/ogDescription.test.ts
  - packages/checks/src/checks/social/ogDescription.ts
  - packages/checks/src/checks/social/ogDuplicates.test.ts
  - packages/checks/src/checks/social/ogDuplicates.ts
  - packages/checks/src/checks/social/ogImage.test.ts
  - packages/checks/src/checks/social/ogImage.ts
  - packages/checks/src/checks/social/ogTitle.test.ts
  - packages/checks/src/checks/social/ogTitle.ts
  - packages/checks/src/checks/social/ogType.test.ts
  - packages/checks/src/checks/social/ogType.ts
  - packages/checks/src/checks/social/ogUrl.test.ts
  - packages/checks/src/checks/social/ogUrl.ts
  - packages/checks/src/checks/social/pipeline.test.ts
  - packages/checks/src/checks/social/social-calibration.test.ts
  - packages/checks/src/checks/social/social-guardrail.test.ts
  - packages/checks/src/checks/social/twitterCard.test.ts
  - packages/checks/src/checks/social/twitterCard.ts
  - packages/checks/src/index.ts
  - packages/checks/src/registry.test.ts
  - packages/checks/src/registry.ts
  - packages/meta-social/package.json
  - packages/meta-social/src/charset.test.ts
  - packages/meta-social/src/charset.ts
  - packages/meta-social/src/extract.test.ts
  - packages/meta-social/src/extract.ts
  - packages/meta-social/src/index.ts
  - packages/meta-social/src/thresholds.ts
  - packages/meta-social/src/types.ts
  - packages/meta-social/tsconfig.json
findings:
  critical: 3
  warning: 6
  info: 8
  total: 17
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-08-03T10:30:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Reviewed the new `@auditor/meta-social` pure engine plus the eight `SOCIAL-01..08` checks wired into `@auditor/checks`. Suite state at review time: `@auditor/meta-social` 17/17 tests pass, `@auditor/checks` 240/240 tests pass, both packages typecheck clean. Passing tests are not evidence of correctness here — every finding below was reproduced against the shipped code with throwaway probe tests (removed afterwards; no source file was modified).

The wiring is sound: the category is registered in `pageChecks`, `social` already exists in `CATEGORY_WEIGHTS` and every `CATEGORY_ORDER` list, the worker aggregates category scores generically, and `apps/web` only imports `@auditor/checks` as types or through the `/validate` subpath, so the new `Buffer` usage in `charset.ts` never reaches an edge/browser bundle.

The defects are in check semantics, not plumbing. Three are blockers: SOCIAL-06 reports spec-legal Open Graph arrays as errors (systematic false positives on multilingual WordPress, which is the exact target universe of this lead magnet); the extractor uses attribute *precedence* where its own doc comment promises a *union*, which fabricates "missing tag" criticals on tags that are present in the HTML; and SOCIAL-06 copies fully site-controlled key text, uncapped, into three persisted fields — the precise control (T-30-06) that the rest of the category implements everywhere else.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: SOCIAL-06 reports spec-legal Open Graph arrays as duplicate/conflicting tags

**File:** `packages/checks/src/checks/social/ogDuplicates.ts:38-61` (criterion text at `:7-8`)

**Issue:** The rule is "any `og:*` key that appears more than once with more than one distinct value is a warning". The Open Graph protocol explicitly defines array properties: repeating the same tag with different values is the documented way to declare multiple images/videos/audios and multiple alternate locales, and the protocol itself states the first tag wins on conflict. `og:locale:alternate` has *no* single-valued form at all — Yoast/Polylang/WPML emit one tag per alternate language on every page of a multilingual WordPress site, which is a large slice of the target universe.

Reproduced against the shipped check:

```
input:  <meta property="og:image" content="https://example.com/a.png" />
        <meta property="og:image" content="https://example.com/b.png" />
        <meta property="og:locale:alternate" content="es_ES" />
        <meta property="og:locale:alternate" content="en_US" />

output: warning "Etiqueta og:image duplicada con valores distintos"          (2 etiquetas, 2 valores distintos)
        warning "Etiqueta og:locale:alternate duplicada con valores distintos" (2 etiquetas, 2 valores distintos)
```

Both rows are false. They also drag the category score down (0.5 health each) and land in the priority table on every page of the site. The existing test file never exercises an array property, so the suite stays green. The check's own `CRITERION` string ("Cada propiedad de Open Graph debe declararse una sola vez") states a rule the protocol does not have.

**Fix:** Restrict the duplicate rule to the single-valued scalar properties and exclude the array families (and their structured sub-properties):

```ts
/** Open Graph properties that are single-valued: repeating them IS a conflict. */
const SINGLE_VALUED_OG_KEYS = new Set([
  "og:title",
  "og:description",
  "og:url",
  "og:type",
  "og:site_name",
  "og:locale",
  "og:determiner",
]);

const ogEntries = Array.from(data.tags).filter(([key]) => SINGLE_VALUED_OG_KEYS.has(key));
```

(An allow-list is safer than a deny-list here: `og:image`, `og:image:*`, `og:video*`, `og:audio*`, `og:locale:alternate` and any vendor extension are all legitimately repeatable.) Add regression tests for repeated `og:image` and repeated `og:locale:alternate` asserting no warning, and update the `CRITERION` copy accordingly.

### CR-02: `extractMetaSocial` applies attribute precedence, not the union it documents — produces false "missing tag" criticals

**File:** `packages/meta-social/src/extract.ts:35-39`

**Issue:** The header comment states the key is "the union of `property` and `name`", but the code is `$(el).attr("property") ?? $(el).attr("name")`. `??` only falls through on `null`/`undefined`; Cheerio returns `""` for a present-but-empty attribute, and it never consults `name` when `property` is present with an unrelated value. Two realistic emitter shapes are silently dropped:

```
input:  <meta property="" name="og:title" content="Titular social valido" />
tags:   []                                  <- tag dropped entirely
SOCIAL-01: critical "Falta la etiqueta og:title"   <- false critical

input:  <meta property="og:image" name="twitter:image" content="https://x.com/a.png" />
tags:   [["og:image", ["https://x.com/a.png"]]]    <- twitter:image lost
```

The second shape (one tag serving both vocabularies) is a real pattern from CMS/meta plugins, and the mirror case `<meta name="og:title" property="twitter:title" ...>` yields the same false `SOCIAL-01` critical as the first. This is exactly the failure class the phase says it exists to eliminate (the retired ONPAGE-05 defect), so it is a blocker rather than a nit. A false `critical` on a correctly configured page is the worst possible output for a lead-magnet audit.

**Fix:** Collect from both attributes and index every social-prefixed candidate:

```ts
$("meta").each((_, el) => {
  const content = $(el).attr("content")?.trim();
  if (!content) return;

  const rawKeys = [$(el).attr("property"), $(el).attr("name")];
  const seen = new Set<string>();
  for (const rawKey of rawKeys) {
    if (!rawKey) continue;
    const key = rawKey.trim().toLowerCase();
    if (!SOCIAL_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    if (seen.has(key)) continue; // same key on both attributes = one declaration
    seen.add(key);
    const existing = tags.get(key);
    if (existing) existing.push(content);
    else tags.set(key, [content]);
  }
});
```

Add the two repro cases above as tests in `extract.test.ts`.

### CR-03: SOCIAL-06 writes uncapped, site-controlled key text into `title`, `recommendation` and `fingerprint`

**File:** `packages/checks/src/checks/social/ogDuplicates.ts:46`, `:53`, `:57`

**Issue:** `thresholds.ts:33-45` declares the category-wide control: "Single cap for any fragment of site-controlled text a `social` check copies into an issue's measured value... Every check in the category imports this constant; none declares a cap of its own." SOCIAL-06 imports no cap at all. It caps `measuredValue` by construction (two derived numbers) but then interpolates the raw, audited-site-controlled meta key into three other persisted fields. Reproduced with a 20 000-character `og:` key:

```
rows: 1  titleLen: 20044  fingerprintLen: 20035  recommendationLen: 20185
```

That is ~60 KB of attacker-chosen text per page, per audit, in columns with no length limit, multiplied by up to 500 pages. `fingerprint` is additionally copied into the cross-audit diff (`diffIssues` map keys, and `scores.diff.resolvedFingerprints`, which the worker persists into the audit summary JSON), so the payload propagates into a second store and into the report UI. Same threat T-30-06 names; the mitigation just was not applied on this check.

**Fix:** Cap the display copies, and keep the fingerprint bounded without losing injectivity:

```ts
import { MAX_MEASURED_VALUE_CHARS } from "@auditor/meta-social";
import { createHash } from "node:crypto";

const cap = (value: string) => value.slice(0, MAX_MEASURED_VALUE_CHARS);
// Bounded AND injective: short prefix for readability + full-key digest.
const keyToken = (key: string) =>
  key.length <= MAX_MEASURED_VALUE_CHARS
    ? key
    : `${cap(key)}#${createHash("sha1").update(key).digest("hex").slice(0, 8)}`;

title: `Etiqueta ${cap(key)} duplicada con valores distintos`,
recommendation: `Deja una sola etiqueta ${cap(key)} con el valor correcto ...`,
fingerprint: pageFingerprint(`${CHECK_ID}:${keyToken(key)}`, url),
```

Note the fingerprint format change is a one-time diff churn for any site that currently has a SOCIAL-06 row; only long keys are affected if `keyToken` passes short keys through unchanged, as above.

## Warnings

### WR-01: The charset detector passes on documents that never declare a charset

**File:** `packages/meta-social/src/charset.ts:35`, `:41-48`

**Issue:** `/<meta[^>]*charset\s*=/i` matches the substring `charset=` anywhere inside any `<meta>` tag, including inside an attribute *value*, and the regex runs on raw text so commented-out markup matches too. Both reproduced:

```
<meta name="description" content="Como declarar charset=utf-8 en HTML">  -> hasCharsetInFirstKB = true
<!-- <meta charset="utf-8"> -->                                          -> hasCharsetInFirstKB = true
```

The file's header calls this an "accepted approximation", but the consequence is a *silent pass*: SOCIAL-08 tells the user their document is fine when the declaration is absent or commented out. A documented defect is still a defect, and the false-negative direction is the one the audit cannot recover from (the user never sees the row). The commented-out case is not mentioned in the header at all.

**Fix:** Keep the window-trim (that is the real ReDoS mitigation) but qualify the match so the token has to be an attribute, not free text, and strip comments from the window first:

```ts
const CHARSET_DECLARATION = /<meta\s[^>]*?\bcharset\s*=\s*["']?[\w-]+/i;

export function hasCharsetInFirstKB(html: string): boolean {
  const head = Buffer.from(html, "utf8").subarray(0, CHARSET_WINDOW_BYTES).toString("utf8");
  const withoutComments = head.replace(/<!--[\s\S]*?(-->|$)/g, "");
  return CHARSET_DECLARATION.test(withoutComments);
}
```

Both quantifiers stay simple and the input is still the trimmed window, so the T-30-03 property holds. Add the two repro strings as negative tests.

### WR-02: SOCIAL-07 double-penalizes the same defect and carries 4x the score weight of its siblings

**File:** `packages/checks/src/checks/social/twitterCard.ts:91-109`

**Issue:** The fallback loop emits one warning row per missing `twitter:*`/`og:*` pair, so a page with no social tags yields four SOCIAL-07 rows on top of the SOCIAL-01/02/03 rows for the same three absent tags. Two consequences:

1. Double reporting: an absent `og:image` produces both `SOCIAL-03 critical` and `SOCIAL-07 missing-image warning`. The user sees the same fix twice in the priority table, on every page.
2. Score distortion: `scoreCategory` is an unweighted pass rate over rows, so twitter-card health contributes up to 4 of ~11 rows for a page, while `og:title` (a `critical`, and the more important signal) contributes 1. The category score is therefore driven more by X-vocabulary completeness than by Open Graph correctness, which inverts the intent stated in the calibration harness.

**Fix:** Either collapse the three fallback rows into a single row listing the missing fields (one fingerprint subtype, e.g. `fallback-missing`), or suppress the `missing-title`/`missing-description`/`missing-image` subtypes when the corresponding SOCIAL-01/02/03 defect already fires (the sibling checks own that finding; SOCIAL-07 should only speak when the `og:*` fallback exists but the X-specific tag is the problem). Collapsing is the smaller change and immediately fixes both the duplication and the weighting.

### WR-03: `og:title`/`og:description` lengths are measured in UTF-16 code units

**File:** `packages/checks/src/checks/social/ogTitle.ts:33`, `packages/checks/src/checks/social/ogDescription.ts:33`

**Issue:** `value.length` counts UTF-16 units, so every emoji or astral character counts as 2 and the reported number does not match what the user sees or what a share preview truncates. Reproduced:

```
title "🚀🚀🚀🚀🚀🚀 Hola"  ->  value.length = 17, actual characters = 11, measuredValue "17 caracteres"
```

Emoji in social headlines is common enough in this segment that a 33-character title can be scored as "demasiado largo" at 61 units, and the `measuredValue` shown to the user is simply wrong. Note the phase already applied this exact rigor to bytes in `charset.ts`; the same reasoning applies here to characters.

**Fix:** Count code points, in one shared helper in the pure engine so both checks and the Phase 32 preview panel agree:

```ts
// packages/meta-social/src/length.ts
export const socialLength = (value: string) => [...value].length;
```

Then `const length = socialLength(value);` in both checks. Add an emoji case to each test file.

### WR-04: SOCIAL-06 emits zero rows on pages without Open Graph, so removing all OG tags reads as "resolved" in the diff

**File:** `packages/checks/src/checks/social/ogDuplicates.ts:34`

**Issue:** The early `return []` is justified in the comment as an anti-trivial-pass measure, but it makes the check's row *presence* depend on the audited page. When a site that previously had OG tags removes them (a genuine regression), the previous `SOCIAL-06:<url>` fingerprint disappears from the new run and `diffIssues` classifies it as **resolved** — the report tells the user they fixed something while the site got worse. It also changes the category denominator between two audits of the same site, so score deltas across that boundary are partly an artifact of applicability, not of the site.

**Fix:** Keep the check applicable on every page and express non-applicability without vanishing, e.g. emit the `ok` row with `measuredValue: "sin etiquetas og"` (consistent with the other seven checks, which always emit exactly one row per page), or — if the trivial-pass concern must be honoured — teach the diff to distinguish "not applicable" from "resolved" instead of relying on row absence.

### WR-05: Retiring ONPAGE-05 drops the CMS-specific fix copy for Open Graph findings

**File:** `packages/cms-adapters/src/types.ts:38-48` (consequence of `packages/checks/src/registry.ts:17,25` + `packages/checks/src/checks/social/index.ts`)

**Issue:** `SUPPORTED_CHECK_IDS` still lists the retired `ONPAGE-05` and contains none of `SOCIAL-01..08`. `resolveCmsRecommendation` falls back to the generic copy for any checkId absent from the catalog, so from this phase onward every OG-tag finding on a WordPress/Shopify/Webflow/Wix/Squarespace site loses the platform-specific instruction it used to get, while a slot in the "10 highest-volume checks" catalog is occupied by a check that can no longer fire. `packages/cms-adapters/src/coverage.test.ts` keeps passing because it iterates the stale tuple. Net effect for the user: fewer actionable fixes than before v1.6 on exactly the highest-volume category.

**Fix:** Re-point the catalog: replace the `ONPAGE-05` entry with the SOCIAL ids that carry the same copy (at minimum `SOCIAL-01`, `SOCIAL-02`, `SOCIAL-03`), migrating each adapter's existing OG string. If that is deliberately deferred to a later phase, record it as an explicit open item in the phase summary — right now the regression is invisible from the phase artifacts.

### WR-06: `og:url` measured value can hold ~173 characters of site-controlled text, breaking the single-cap invariant

**File:** `packages/checks/src/checks/social/ogUrl.ts:93`

**Issue:** `` `${cap(normalized)} (canonical: ${cap(reference)})` `` composes two 80-character caps plus a literal, so the persisted field holds up to 173 characters, of which up to 160 come from the audited site. `thresholds.ts:33-45` declares `MAX_MEASURED_VALUE_CHARS` as "single cap for any fragment of site-controlled text a `social` check copies into an issue's measured value", and the Phase 32 preview panel is expected to size against that number. The per-half rationale in the file comment explains the intent but leaves the stated invariant false, and no test pins the composed length.

**Fix:** Cap the composed string as a whole, splitting the budget between halves (e.g. `MAX_MEASURED_VALUE_CHARS / 2` each), or state the composed ceiling in `thresholds.ts` and pin it with a test so Phase 32 can rely on a real number.

## Info

### IN-01: `cap()` is triplicated and one check bypasses it

**File:** `packages/checks/src/checks/social/ogImage.ts:16`, `ogUrl.ts:17`, `twitterCard.ts:22`, `ogType.ts:44`
**Issue:** The same one-line helper is declared three times, `ogType` inlines `value.slice(0, MAX_MEASURED_VALUE_CHARS)` instead, and `ogDuplicates` has none (see CR-03). Four different spellings of one rule invites exactly the drift the constant was centralized to prevent.
**Fix:** Export `capMeasuredValue` from `@auditor/meta-social` next to the constant and import it in all five checks.

### IN-02: `.slice()` on the measured value can split a surrogate pair

**File:** `packages/meta-social/src/thresholds.ts:45` (consumers: `ogImage.ts:16`, `ogUrl.ts:17`, `ogType.ts:44`, `twitterCard.ts:22`)
**Issue:** Cutting at UTF-16 index 80 can leave a lone surrogate at the boundary, which Node re-encodes as U+FFFD on the way to Postgres — a garbage character in a user-visible field.
**Fix:** Cap with `[...value].slice(0, MAX_MEASURED_VALUE_CHARS).join("")` in the shared helper from IN-01.

### IN-03: A malformed absolute `og:image` is reported as "URL relativa"

**File:** `packages/checks/src/checks/social/ogImage.ts:96-115`
**Issue:** `https:/example.com/a.png` (single slash) parses fine via `normalizeUrl` but fails the literal `https://` prefix test, so the user is told to "convertir en una URL absoluta con dominio y protocolo" for a value that already has both. Verified: title `og:image con URL relativa`.
**Fix:** Decide relative-vs-absolute from the parse (`new URL(value).href === resolved`-style comparison, or check `resolved` against `normalizeUrl(value)` without a base) rather than from a string prefix.

### IN-04: Every check re-walks the whole `<meta>` set

**File:** `packages/checks/src/checks/social/ogTitle.ts:12`, `ogDescription.ts:12`, `ogImage.ts:29`, `ogUrl.ts:36`, `ogType.ts:15`, `ogDuplicates.ts:24`, `twitterCard.ts:41`
**Issue:** `extractMetaSocial($)` runs seven times per page with identical input and identical output. Beyond the redundant work, it is a duplication smell: the extraction contract is "single entry point every social check uses", yet nothing memoizes it and each check silently pays for it. (Flagged as quality, not performance — runtime cost is out of v1 scope.)
**Fix:** Extend `PageCheckCtx` with a lazily-computed `metaSocial` (or memoize by `$` in the engine with a `WeakMap`) so the walk happens once per page.

### IN-05: The extractor is not scoped to `<head>`

**File:** `packages/meta-social/src/extract.ts:34`
**Issue:** `$("meta")` matches meta tags anywhere in the document, including inside `<body>`, `<template>` and `<noscript>`. Whether those should count is a real product decision (some platform crawlers honour body-level OG tags, the protocol says head), but neither the code comment nor any test states which behaviour is intended, so a future scoping change cannot be distinguished from a regression.
**Fix:** Pin the decision with a test (a fixture carrying an `og:title` only inside `<body>`) and document it in the extractor header.

### IN-06: Test reaches an unreachable branch via `undefined as never`

**File:** `packages/checks/src/checks/social/charset.test.ts:69`
**Issue:** `charsetCheck.run({ page, $: undefined as never })` exercises a guard the code comment itself says `runAllChecks` makes unreachable. The type assertion hides that the context is being faked, and the case only documents a defensive branch.
**Fix:** Keep the guard, but assert it through the real context shape (`$: cheerio.load("")`) so no `as never` is needed.

### IN-07: Calibration fixtures are read across package boundaries by relative filesystem path

**File:** `packages/checks/src/checks/social/social-calibration.test.ts:121-126`
**Issue:** `new URL("../../../../meta-social/src/__fixtures__/…", import.meta.url)` couples this suite to the on-disk layout of a sibling package. The rationale (not adding a dependency edge) is sound, but a package move turns into an opaque `ENOENT` in an unrelated suite.
**Fix:** Resolve the fixture directory once through the workspace root (or expose a `__fixtures__` path constant from `@auditor/meta-social` under a `./fixtures` export that carries no runtime code) and assert the directory exists with a clear message.

### IN-08: An empty first tag hides the real first-wins verdict

**File:** `packages/meta-social/src/extract.ts:41-48` with `packages/checks/src/checks/social/ogImage.test.ts:88-97`
**Issue:** Tags with empty `content` never enter the map, so `<meta property="og:image" content="">` followed by a valid `og:image` reports `ok`, even though the document-order/first-wins invariant the test file pins would say the first declaration is the empty one. The two rules (drop-empty and first-wins) interact and neither test covers the intersection.
**Fix:** Add the case to `extract.test.ts` and state in the header which rule wins.

---

_Reviewed: 2026-08-03T10:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
