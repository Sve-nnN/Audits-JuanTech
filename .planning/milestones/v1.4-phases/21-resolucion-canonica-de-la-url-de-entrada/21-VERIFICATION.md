---
phase: 21-resolucion-canonica-de-la-url-de-entrada
verified: 2026-07-09T15:05:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Auditar un dominio real que redirige a www (ej. un sitio bare→www) y abrir el reporte"
    expected: "El árbol de arquitectura/grafo NO queda vacío (bug de v1.3 corregido); el header muestra 'Analizamos: https://www.<dominio>/' cuando difiere del dominio ingresado"
    why_human: "Requiere un crawl en vivo contra red externa; la corrección del síntoma raíz de v1.3 (grafo vacío en sitios que redirigen) solo se confirma en runtime, no por grep/tsc"
    result: "passed — confirmado retroactivamente por Juan"
  - test: "Auditar un dominio que no responde en ningún protocolo (ej. dominio inexistente)"
    expected: "La auditoría falla con status 'failed' y el mensaje en español 'No pudimos conectar con <dominio>. Verifica que el sitio esté en línea e intenta de nuevo.' se muestra en la rama failed de AuditProgress — no un crawl vacío"
    why_human: "Comportamiento en tiempo de ejecución del worker + render del mensaje de error en la UI; no verificable programáticamente sin correr el worker"
    result: "passed — confirmado retroactivamente por Juan"
retroactive_confirmation:
  date: 2026-07-10
  via: /gsd-autonomous
  note: "Juan confirmó que ya había validado en vivo, en una sesión previa, tanto el crawl de un dominio con redirección a www como el mensaje de error de dominio muerto. Ambos ítems se marcan aquí como passed en base a esa confirmación retroactiva; no se re-ejecutó un crawl nuevo en esta sesión."
---

# Phase 21: Resolución canónica de la URL de entrada Verification Report

**Phase Goal:** El auditor resuelve la URL canónica real del dominio antes de crawlear y la usa como origin único en todo el pipeline, reemplazando la mitigación puntual de v1.3.
**Verified:** 2026-07-09T15:05:00Z
**Status:** passed
**Re-verification:** No — initial verification (status actualizado a `passed` el 2026-07-10 tras confirmación retroactiva de Juan sobre los 2 ítems human_needed, vía /gsd-autonomous)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | resolveCanonicalUrl prueba https→http, sigue redirects y devuelve finalUrl real o null | VERIFIED | `packages/crawler/src/resolveCanonicalUrl.ts`: loop `SCHEMES = ["https","http"]`, `fetch(..., redirect:"follow")`, devuelve `res.url`; `null` en fallo total sin throw; `AbortController` + `RESOLVE_TIMEOUT_MS=10_000`. 6/6 tests verdes. |
| 2 | El worker resuelve la URL antes de runCrawl y la usa como startUrl/origin único, persistiendo resolvedUrl | VERIFIED | `apps/worker/src/index.ts:286` `resolveCanonicalUrl(audit.site.domain)` antes de runCrawl; `:300` `const startUrl = resolvedUrl`; `:348` `origin = new URL(startUrl).origin`; persistencia temprana (`:297 data:{resolvedUrl}`) y final (`:602`). Guess `https://${audit.site.domain}` eliminado (count 0). |
| 3 | resolveHomeKey eliminado de buildLinkGraph; home lookup por match exacto | VERIFIED | `packages/graph/src/buildLinkGraph.ts`: `grep -c resolveHomeKey`=0; línea 70-72 `normalizeUrl(origin)` + `byUrl.has(normalizedOrigin)`; degradación a grafo vacío intacta. 9/9 tests verdes. |
| 4 | Dominio muerto falla la auditoría con mensaje español neutro (no crawl vacío) | VERIFIED | `apps/worker/src/index.ts:287-292` `if(!resolvedUrl) throw new Error("No pudimos conectar con ...")`; sin voceo (grep verificá/intentá/ingresá = 0); capturado por `worker.on("failed")` → status:failed. Confirmación de render en UI queda para human. |

**Score:** 4/4 truths verified (a nivel de código)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/crawler/src/resolveCanonicalUrl.ts` | Función pura resolveCanonicalUrl | VERIFIED | 69 líneas; https→http, GET redirect:follow, res.url, timeout acotado, null en fallo |
| `packages/crawler/src/resolveCanonicalUrl.test.ts` | Tests con fetch mockeado | VERIFIED | 6 tests: https ok, fallback http, ambos fallan, timeout, no-2xx, normalización input |
| `packages/crawler/src/index.ts` | Re-export en barrel | VERIFIED | Línea 4 `export { resolveCanonicalUrl } from "./resolveCanonicalUrl"` |
| `packages/graph/src/buildLinkGraph.ts` | Sin resolveHomeKey, match exacto | VERIFIED | JSDoc actualizado; home lookup exacto; adjacency conserva sameRegistrableDomain |
| `packages/graph/src/buildLinkGraph.test.ts` | Suite ajustada | VERIFIED | Test www valida match exacto con origin resuelto; comentario cita resolveCanonicalUrl (línea 94) |
| `packages/db/prisma/schema.prisma` | Audit.resolvedUrl String? | VERIFIED | Línea 89 nullable/aditivo; sin carpeta migrations (schema-first) |
| `apps/worker/src/index.ts` | resolveCanonicalUrl + persistencia + fallo | VERIFIED | Import línea 6; llamada, throw español, persistencia temprana+final |
| `apps/web/app/audits/[id]/page.tsx` | Render de resolvedUrl | VERIFIED | Helper `resolvedDiffersFromDomain` + render condicional "Analizamos: {resolvedUrl}" (líneas 54, 135-136) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| index.ts (crawler) | resolveCanonicalUrl.ts | re-export | WIRED | Barrel export presente |
| worker/index.ts | @auditor/crawler resolveCanonicalUrl | import + await antes de runCrawl | WIRED | Import + llamada línea 286, precede runCrawl (línea 346) |
| worker startUrl | pipeline origin | new URL(startUrl).origin | WIRED | origin derivado alimenta sitemap/robots/grafo/checks |
| page.tsx | audit.resolvedUrl | render condicional en header | WIRED | Render solo cuando difiere del dominio |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| page.tsx header | audit.resolvedUrl | prisma.audit.findUnique (escalar) | Poblado por worker desde resolveCanonicalUrl | FLOWING (persistencia temprana+final confirmada; render condicional en runtime → human) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| resolveCanonicalUrl tests | vitest run resolveCanonicalUrl.test.ts | 6 passed | PASS |
| buildLinkGraph tests | vitest run buildLinkGraph.test.ts | 9 passed | PASS |
| crawler typecheck | tsc --noEmit | EXIT:0 | PASS |
| graph typecheck | tsc --noEmit | EXIT:0 | PASS |
| worker typecheck | tsc --noEmit | EXIT:0 | PASS |
| web typecheck | tsc --noEmit | EXIT:0 | PASS |
| Prisma client regenerado | grep resolvedUrl en client .d.ts | 55 matches | PASS |

### Probe Execution

No aplica — la fase no declara probes `scripts/*/tests/probe-*.sh`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| URLRES-01 | 21-01 | Resolución canónica https→http + redirects del home | SATISFIED | resolveCanonicalUrl implementada + 6 tests |
| URLRES-02 | 21-02, 21-03 | URL resuelta como origin único + persistida + reemplaza resolveHomeKey + maneja dominio muerto | SATISFIED | resolveHomeKey eliminado, worker cableado, Audit.resolvedUrl persistido, throw español |

No hay requirements huérfanos: REQUIREMENTS.md mapea solo URLRES-01/02 a Phase 21, ambos reclamados por los planes.

### Anti-Patterns Found

Ninguno. Escaneo de TBD/FIXME/XXX/HACK/PLACEHOLDER en los 4 archivos modificados: limpio.

### Human Verification Required

#### 1. Crawl en vivo de dominio que redirige a www

**Test:** Auditar un dominio real que redirige de bare a www y abrir el reporte.
**Expected:** El grafo/árbol de arquitectura NO queda vacío (corrige el síntoma raíz de v1.3); el header muestra "Analizamos: https://www.<dominio>/" cuando la URL resuelta difiere del dominio ingresado.
**Why human:** Requiere un crawl en vivo contra red externa; el fix del grafo vacío solo se confirma en runtime.
**Result:** PASSED — confirmado retroactivamente por Juan (ya validado en una sesión previa; confirmación registrada el 2026-07-10 vía /gsd-autonomous).

#### 2. Dominio que no responde

**Test:** Auditar un dominio inexistente/caído.
**Expected:** Auditoría con status "failed" y mensaje "No pudimos conectar con <dominio>. Verifica que el sitio esté en línea e intenta de nuevo." visible en la rama failed de AuditProgress — no un crawl vacío.
**Why human:** Comportamiento del worker en runtime + render del error en UI.
**Result:** PASSED — confirmado retroactivamente por Juan (ya validado en una sesión previa; confirmación registrada el 2026-07-10 vía /gsd-autonomous).

### Gaps Summary

No se encontraron gaps bloqueantes. Las 4 verdades observables y ambos requirements (URLRES-01, URLRES-02) están verificados a nivel de código: la función de resolución existe con fallback y timeout y 6 tests verdes, el worker la llama antes de crawlear y deriva el origin único de ella, la mitigación resolveHomeKey fue eliminada del grafo (9 tests verdes), el campo Audit.resolvedUrl existe en el schema y en el cliente Prisma regenerado, y el reporte lo renderiza condicionalmente. Los cuatro typechecks (crawler, graph, worker, web) pasan limpios.

El estado pasó de `human_needed` a `passed` el 2026-07-10: los 2 ítems de verificación humana (redirección a www sin grafo vacío, y mensaje de error de dominio muerto en la UI) fueron confirmados retroactivamente por Juan — ya los había validado en vivo en una sesión previa, solo no se había dejado registro escrito. Confirmación recibida y documentada vía /gsd-autonomous. La cadena está completamente cableada, unit-testeada, y ahora con el checkpoint humano cerrado.

---

_Verified: 2026-07-09T15:05:00Z_
_Verifier: Claude (gsd-verifier)_
_Actualizado: 2026-07-10 — status human_needed → passed, confirmación retroactiva de Juan vía /gsd-autonomous_
