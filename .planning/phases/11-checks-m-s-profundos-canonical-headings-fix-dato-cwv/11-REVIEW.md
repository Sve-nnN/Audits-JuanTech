---
phase: 11-checks-mas-profundos-canonical-headings-fix-dato-cwv
reviewed: 2026-07-06T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - packages/checks/src/checks/tech/canonicalDeep.ts
  - packages/checks/src/checks/tech/index.ts
  - packages/checks/src/checks/onpage/headings.ts
  - packages/checks/src/checks/onpage/index.ts
  - packages/psi/src/issues.ts
  - apps/worker/src/index.ts
  - packages/checks/src/checks/phase11-guardrail.test.ts
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: findings
---

# Phase 11: Code Review Report

**Reviewed:** 2026-07-06
**Depth:** deep
**Files Reviewed:** 7
**Status:** findings

## Summary

Revisión adversarial de TECH-04 (`canonicalDeep`), ONPAGE-08 (`headingsCheck`), el campo `source` en `PerfIssueDraft` y el guardrail SC#5. Verificaciones estructurales: los archivos protegidos `tech/canonical.ts` y `onpage/h1.ts` están **intactos** (`git diff 35931f1^..HEAD` vacío para ambos); `canonicalDeep` es **offline puro** (no hay `fetch`/`axios`/import de red; solo lee el set crawleado y `cheerio.load`); la protección contra ciclos en la cadena de canonicals es correcta por **no ser recursiva** (solo mira un nivel del destino, imposible loop). El mapeo de severidades coincide 1:1 con la tabla de diseño en los 9 subtipos de TECH-04 y en los 4 de ONPAGE-08. Los 9 fingerprints de TECH-04 y los 4 de ONPAGE-08 son literales distintos, sin colisión intra-check ni inter-check (validado además por el guardrail). Manejo de nulos correcto: `statusCode ?? 0` no dispara falsos críticos, `!page.html`/`!target.html` se saltan, `finalUrl ?? url` en todas partes.

No hay BLOCKERs: ningún crash, fuga de red, bypass ni pérdida de datos. Los hallazgos son riesgos de **falso positivo** en dos comparaciones y aristas menores de normalización.

## Warnings

### WR-01: `cross-domain` compara host exacto → falso positivo en www/no-www y subdominios

**File:** `packages/checks/src/checks/tech/canonicalDeep.ts:130-147`
**Issue:** El subtipo `cross-domain` usa `safeHost()` (`new URL(url).host`, host exacto) y compara `targetHost !== pageHost`. Esto marca como cross-domain el patrón de canonicalización más común y legítimo: una página en `https://example.com/p` cuya canonical apunta a `https://www.example.com/p` (o viceversa), y cualquier canonical entre subdominios del mismo sitio (`blog.example.com` → `example.com`). El propósito real del check (contenido sindicado a OTRO dominio registrable) queda contaminado con ruido en sitios que canonicalizan www↔no-www. El repo ya expone el helper correcto para esto.
**Fix:**
```ts
import { sameRegistrableDomain } from "@auditor/crawler";
// ...
if (targetHost && pageHost && !sameRegistrableDomain(canonicalUrl, selfUrl)) {
  // emitir cross-domain
}
```

### WR-02: `multiple-conflicting` cuenta hrefs crudos sin normalizar → falso positivo

**File:** `packages/checks/src/checks/tech/canonicalDeep.ts:71-72`
**Issue:** `const distinctHrefs = new Set(hrefs)` cuenta destinos "distintos" comparando la cadena literal del atributo. Dos etiquetas canonical que apuntan al MISMO destino lógico expresado distinto (`href="/p"` + `href="https://example.com/p"`, o `/p` + `/p/`, o con un parámetro de tracking) se cuentan como 2 destinos y disparan "Múltiples canonical conflictivas", cuando en realidad no hay conflicto tras la resolución/normalización que el resto del check sí aplica (`normalizeUrl(primary, url)`).
**Fix:** Normalizar antes de deduplicar, consistente con el resto del check:
```ts
const distinctHrefs = new Set(
  hrefs.map((h) => normalizeUrl(h, url) ?? h)
);
```

## Info

### IN-01: `chain` puede falso-positivar cuando el destino se alcanzó vía redirección

**File:** `packages/checks/src/checks/tech/canonicalDeep.ts:177-196`
**Issue:** `targetSelf` se calcula desde `target.finalUrl ?? target.url`, pero si el destino B se crawleó vía redirección (su `url` de request ≠ `finalUrl`) y su HTML declara una canonical self-referente hacia su `url` de request, entonces `targetCanonical (= B.url)` ≠ `targetSelf (= B.finalUrl)` y se marca "cadena de canonicals" (CRITICAL) sin que exista un tercer salto real. Probabilidad baja (queda tras el guard `if (target.html)`, y las páginas 3xx rara vez traen html), pero la severidad es crítica.
**Fix:** Comparar `targetCanonical` contra AMBAS formas del destino (`target.url` y `target.finalUrl`) normalizadas antes de declarar cadena; solo marcar si difiere de las dos.

### IN-02: índice "el primero gana" ante claves normalizadas colisionantes

**File:** `packages/checks/src/checks/tech/canonicalDeep.ts:45-51`
**Issue:** `if (key && !index.has(key)) index.set(key, page)` conserva la primera página vista para una clave dada. Si dos páginas normalizan a la misma clave (p. ej. una request-url y la finalUrl de otra página coinciden tras normalizar), la canonical podría resolverse contra la página equivocada y evaluar estado/cadena del destino incorrecto. Escenario raro en un set same-origin bien formado, pero silencioso.
**Fix:** Priorizar el match por `finalUrl` sobre `url`, o registrar/ignorar colisiones de clave explícitamente.

### IN-03: `redirect-target` y `final-url-mismatch` disparan juntos sobre un destino 3xx

**File:** `packages/checks/src/checks/tech/canonicalDeep.ts:202-248`
**Issue:** Una canonical hacia un destino que devuelve 3xx puede emitir tanto `redirect-target` (CRITICAL) como `final-url-mismatch` (WARNING) para el mismo hecho subyacente. Fingerprints distintos, así que no hay colapso ni bug de diff, pero genera dos filas para el mismo problema y puede leerse como ruido en el reporte.
**Fix (opcional):** Suprimir `final-url-mismatch` cuando ya se emitió `redirect-target`/`http-error-target` para el mismo destino.

### IN-04: `hasNoindex` ignora `meta[name="googlebot"]` y cabecera `X-Robots-Tag`

**File:** `packages/checks/src/checks/tech/canonicalDeep.ts:11-14`
**Issue:** La detección de noindex (usada por `noindex-conflict` y `noindex-target`) solo mira `meta[name="robots"]`. Un destino con `noindex` declarado vía `X-Robots-Tag` en cabecera o `meta[name="googlebot"]` no se detecta → falso negativo. Es **consistente y documentado** respecto a `indexability.ts` (TECH-05), así que no es una regresión nueva; se anota por completitud, no requiere acción en esta fase.
**Fix:** Ninguno requerido; documentar la limitación si se amplía TECH-05 a futuro.

---

_Reviewed: 2026-07-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
