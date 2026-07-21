---
phase: 25-fingerprint-de-stack-t-cnico-contrato-de-datos-y-motor-de-de
verified: 2026-07-21T17:22:00Z
status: passed
score: 21/21 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
notes:
  - "db:push/db:generate a Neon lo ejecutó Juan out-of-band el 2026-07-21 (confirmado por el humano). El schema declara ambas columnas; el apply en runtime queda human-confirmed, no como item abierto."
---

# Phase 25: Fingerprint de stack técnico — contrato de datos y motor de detección — Verification Report

**Phase Goal:** El sistema puede determinar, a partir de headers/cookies/HTML ya capturados durante el crawl (sin requests adicionales), el stack técnico de un sitio —CMS+builder, CDN/proxy, hosting, framework JS, analytics— con nivel de confianza tipado por eje, sin nunca forzar una respuesta cuando la señal es insuficiente.
**Verified:** 2026-07-21T17:22:00Z
**Status:** passed
**Re-verification:** No — verificación inicial

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | `@auditor/fingerprint` es paquete workspace puro (solo cheerio runtime) | ✓ VERIFIED | `packages/fingerprint/package.json` dependencies = únicamente `cheerio ^1.2.0`; sin `@auditor/db`, `@auditor/crawler`, `@auditor/checks` |
| 2  | Contrato completo exportado (DetectedStack/AxisResult/Confidence/Signal/Signature/PageFingerprintInput) | ✓ VERIFIED | `src/index.ts` reexporta los 9 tipos + `detectStack`; `src/types.ts` los define |
| 3  | Confidence es unión cerrada `alto\|medio\|bajo\|no-detectado` | ✓ VERIFIED | `types.ts:25` |
| 4  | DetectedStack: un eje AxisResult por categoría, analytics como AxisResult[] | ✓ VERIFIED | `types.ts:65-74` (`analytics: AxisResult[]`) |
| 5  | Signature.test devuelve number (conteo), no boolean | ✓ VERIFIED | `types.ts:130` `test(ctx): number`; usado para desempate de builders |
| 6  | PageFingerprintInput no importa Page de @auditor/db (desacoplado en runtime) | ✓ VERIFIED | `types.ts:86-95` define forma mínima propia; sin import de @auditor/db |
| 7  | Registry con ≥1 signature por eje (cms/builder/cdn/hosting/jsFramework/analytics) | ✓ VERIFIED | `registry.ts` mapea los 6 ejes; conteos: cms 15, builder 4, cdn 4, hosting 5, jsFramework 4, analytics 3 |
| 8  | Gutenberg vía marcador POSITIVO (wp-block-*, `<!-- wp:`), nunca default | ✓ VERIFIED | `builder.ts:62-70` |
| 9  | Signatures multi-señal (header+cookie+path/HTML) para WordPress/Shopify/Webflow/Wix/Squarespace | ✓ VERIFIED | `cms.ts`: WordPress 4 firmas (paths/generator/cookie/apiLink), Shopify 3, Webflow 2, Wix 3, etc. |
| 10 | Sin regex de backtracking (mitiga ReDoS) — cheerio + includes()/indexOf() | ✓ VERIFIED | `builder.ts` usa `countOccurrences`/`htmlIncludes`; selectores `ctx.$(...)` |
| 11 | detectStack resuelve cada eje independientemente (nunca winner-take-all) | ✓ VERIFIED | `detectStack.ts:208-222`; test "Independencia de ejes" pasa (WP+Cloudflare+Next coexisten) |
| 12 | Umbrales de confianza (2+ fuertes→alto; 1 inequívoca→alto; 1 fuerte→medio; débil→bajo; 0→no-detectado) | ✓ VERIFIED | `resolveConfidence` `detectStack.ts:93-99`; tests de confianza pasan |
| 13 | WordPress sin builder matcheando → builder no-detectado (nunca Gutenberg) | ✓ VERIFIED | `resolveBuilder` retorna `emptyAxis()` sin match; test dedicado pasa (`detectStack.test.ts:79`) |
| 14 | Empate real de conteo entre builders → no-detectado | ✓ VERIFIED | `detectStack.ts:172`; test "empate real...→ no-detectado" pasa |
| 15 | analytics devuelve array con GA4+GTM+Meta Pixel coexistiendo | ✓ VERIFIED | `resolveAnalytics`; test "array con GA4+GTM+Meta Pixel coexistiendo" pasa |
| 16 | hosting no-detectado cuando un CDN fuerte enmascara el origen | ✓ VERIFIED | test `detectStack.test.ts:102` pasa |
| 17 | aggregate normaliza headers a minúscula, une cookieNames, elige HTML home→fallback, trunca ~256KB | ✓ VERIFIED | `aggregate` `detectStack.ts:54-78`; `MAX_HTML_BYTES = 256*1024`; test "usa HTML de subpágina cuando home no tiene html" pasa |
| 18 | Prisma Page declara responseHeaders + cookieNames | ✓ VERIFIED | `schema.prisma:123` `responseHeaders Json?`, `:125` `cookieNames String[]` |
| 19 | Crawler captura headers curados + nombres de cookie sin requests adicionales | ✓ VERIFIED | `crawl.ts:112-113` usan `response` ya cargado; `captureHeaders.ts` cura por allowlist y extrae solo nombres |
| 20 | cookieNames solo nombres (nunca valores/expiry/domain/flags) | ✓ VERIFIED | `parseCookieNames` `captureHeaders.ts:63-74` toma `split(";")[0]` → `split("=")[0]` |
| 21 | curateHeaders solo devuelve keys del allowlist CURATED_HEADER_KEYS | ✓ VERIFIED | `captureHeaders.ts:47-57` itera solo sobre `CURATED_HEADER_KEYS` (previene prototype pollution) |

**Score:** 21/21 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `packages/fingerprint/package.json` | ✓ VERIFIED | Paquete puro, solo cheerio |
| `packages/fingerprint/src/types.ts` | ✓ VERIFIED | Contrato completo |
| `packages/fingerprint/src/index.ts` | ✓ VERIFIED | API pública exportada |
| `packages/fingerprint/src/detectStack.ts` | ✓ VERIFIED | Motor, 223 líneas, wired al registry |
| `packages/fingerprint/src/signatures/{cms,builder,cdn,hosting,jsFramework,analytics,registry}.ts` | ✓ VERIFIED | Todos poblados y agregados en registry |
| `packages/fingerprint/src/detectStack.test.ts` + `registry.test.ts` | ✓ VERIFIED | 2 archivos, 34 tests pasan |
| `packages/fingerprint/src/__fixtures__/{synthetic,realSites}.ts` | ✓ VERIFIED | Presentes |
| `packages/db/prisma/schema.prisma` | ✓ VERIFIED | Ambas columnas declaradas |
| `packages/crawler/src/captureHeaders.ts` + `.test.ts` | ✓ VERIFIED | Curación + parse cookies; tests pasan |
| `packages/crawler/src/crawl.ts` | ✓ VERIFIED | Escribe ambos campos en create y update del upsert |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `detectStack.ts` | `signatures/registry.ts` | `import { registry }` + `registry[axis]` | ✓ WIRED |
| `detectStack.ts` | `types.ts` | import de tipos | ✓ WIRED |
| `crawl.ts` | `captureHeaders.ts` | `import { curateHeaders, parseCookieNames }` + uso en upsert | ✓ WIRED |
| `crawl.ts` upsert | `Page.responseHeaders`/`cookieNames` | escrito en create+update (líneas 132-133, 143-144) | ✓ WIRED |
| `fingerprint` (independencia runtime) | @auditor/db/crawler/checks | typecheck verde sin esas deps | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| fingerprint typecheck | `pnpm --filter @auditor/fingerprint typecheck` | exit 0 | ✓ PASS |
| fingerprint tests | `pnpm --filter @auditor/fingerprint test` | 2 files, 34 tests passed | ✓ PASS |
| crawler typecheck | `pnpm --filter @auditor/crawler typecheck` | exit 0 | ✓ PASS |
| crawler tests | `pnpm --filter @auditor/crawler test` | 4 files, 31 tests passed | ✓ PASS |

Nota: las verdades dependientes de comportamiento (independencia de ejes, WP-sin-builder→no-detectado, empate→no-detectado, analytics array, hosting enmascarado por CDN) tienen cada una un test nombrado que las ejercita y pasa — no se marcan VERIFIED solo por presencia de símbolos.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| FPRINT-01 | Captura headers + nombres de cookie sin requests adicionales | ✓ SATISFIED | `captureHeaders.ts` + `crawl.ts` (usa response ya cargado); tests crawler pasan. Nota: checkbox en REQUIREMENTS.md aún marcado "Pending" — desfase de bookkeeping, el código está implementado y probado |
| FPRINT-02 | Detecta CMS con confianza | ✓ SATISFIED | `cms.ts` + test FPRINT-02 |
| FPRINT-03 | Builder WordPress (Gutenberg por regla positiva) | ✓ SATISFIED | `builder.ts` + tests FPRINT-03 |
| FPRINT-04 | Detecta CDN/proxy | ✓ SATISFIED | `cdn.ts` + test FPRINT-04 |
| FPRINT-05 | Detecta hosting (reconoce CDN que oculta origen) | ✓ SATISFIED | `hosting.ts` + test FPRINT-05 |
| FPRINT-06 | Detecta framework JS | ✓ SATISFIED | `jsFramework.ts` + test FPRINT-06 |
| FPRINT-07 | Detecta analytics/tag manager | ✓ SATISFIED | `analytics.ts` + test FPRINT-07 |
| FPRINT-08 | "No detectado con certeza" en vez de forzar | ✓ SATISFIED | `emptyAxis`/`resolveConfidence` + test FPRINT-08 |

### Anti-Patterns Found

Ninguno. Sin TODO/FIXME/XXX/TBD/placeholder en los archivos fuente de la fase.

### Human Verification Required

Ninguno abierto. El único paso no verificable programáticamente —`pnpm db:push` + `db:generate` contra Neon— ya fue ejecutado por Juan el 2026-07-21 (confirmado por el humano, per instrucción del orquestador y 25-02-SUMMARY). El schema declara ambas columnas; el apply en runtime queda human-confirmed.

### Gaps Summary

Sin gaps bloqueantes. El objetivo de la fase se cumple: el motor `detectStack` resuelve los seis ejes de forma independiente con confianza tipada, nunca fuerza respuesta (no-detectado de primera clase), Gutenberg solo por marcador positivo, WordPress-sin-builder → no-detectado, empate → no-detectado, analytics como array. El crawler captura headers curados + nombres de cookie sin requests extra, y el schema Prisma declara ambas columnas. Único apunte menor no bloqueante: el checkbox FPRINT-01 en REQUIREMENTS.md sigue "Pending" pese a estar implementado y probado (desfase de documentación).

---

_Verified: 2026-07-21T17:22:00Z_
_Verifier: Claude (gsd-verifier)_
