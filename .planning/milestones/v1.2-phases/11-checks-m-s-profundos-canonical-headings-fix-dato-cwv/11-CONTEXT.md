# Phase 11: Checks más profundos (canonical + headings) + fix dato CWV - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Reglas Cheerio puras sobre el HTML ya almacenado (sin tocar infra, sin migraciones, sin fetch de red): canonicals profundos (destino noindex/redirección/error, cadenas, cross-domain, relativo, múltiples conflictivos, mismatch vs URL final), jerarquía de encabezados (saltos de nivel, vacíos, fuera de orden, H1 que duplica el title) y el fix del dato faltante de URL en los issues de Rendimiento/CWV. No entra: detección de render (Phase 12), export (13-14), agrupación UI del reporte (15).

</domain>

<decisions>
## Implementation Decisions

### Arquitectura checks canonical profundos
- Mantener `checkId: "TECH-04"` con **fingerprint sub-tipado** por hallazgo (`TECH-04:noindex-target`, `TECH-04:chain`, `TECH-04:redirect-target`, `TECH-04:http-error-target`, `TECH-04:cross-domain`, `TECH-04:relative`, `TECH-04:multiple-conflicting`, `TECH-04:noindex-conflict`, `TECH-04:final-url-mismatch`). SC#5 exige subtipos para que el diff no colapse múltiples hallazgos por página.
- El canonical profundo se implementa como **SiteCheck nuevo** (`canonicalDeep`) que indexa las páginas por URL normalizada: resolver el estado del destino (noindex / 3xx / 4xx / 5xx / cadena) requiere el set completo de páginas. El `canonicalCheck` page-level actual (TECH-04) se conserva para presencia / única / self-consistencia.
- Resolución del estado del destino **contra el set ya crawleado** (por URL normalizada), sin fetch de red. Destino same-domain no presente en el set crawleado → skip silencioso (cero falso positivo). Cross-domain se detecta por comparación de host.

### Severidades de nuevos hallazgos
- Canonical → destino noindex / 3xx redirect / 4xx-5xx / cadena canonical→canonical / conflicto canonical+noindex: **crítico** (rompen indexación tanto como el caso noindex fijado por SC#1).
- Canonical cross-domain / relativo (no absoluto) / mismatch vs URL final resuelta / múltiples conflictivos: **warning** (puede ser intencional o error leve).
- Headings: salto de nivel (H1→H3 sin H2) / heading vacío / fuera de orden: **warning**.
- H1 que solo duplica el title: **warning** (leve).

### Headings + fix CWV
- Jerarquía de encabezados = **nuevo `checkId: "ONPAGE-08"`** con fingerprint sub-tipado (`ONPAGE-08:skip`, `ONPAGE-08:empty`, `ONPAGE-08:order`, `ONPAGE-08:h1-dup-title`). El conteo/unicidad de H1 se queda en `ONPAGE-03` existente sin tocar.
- Múltiples hallazgos de heading en una misma página → **una fila (IssueDraft) por subtipo** vía fingerprint sub-tipado (consistente con SC#5). No se agregan en una sola fila.
- Fix REPORT-03: añadir campo `source` a `PerfIssueDraft` (`@auditor/psi`), setearlo con la `url` de la página en `mapPerfIssues`, y en `apps/worker/src/index.ts` mapear `source: draft.source` en lugar del `null` hardcodeado (línea ~368). Así cada issue de Rendimiento/CWV muestra la URL analizada en vez de "—".

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/checks/src/checks/tech/canonical.ts` (TECH-04, PageCheck) — presencia/única/self; se conserva. Nuevo `canonicalDeep` como SiteCheck hermano.
- `packages/checks/src/util.ts` → `pageFingerprint(checkId, url)` — usar con checkId sub-tipado (`TECH-04:chain`) para no colapsar el diff.
- `@auditor/crawler` → `normalizeUrl(href, base)` — ya usado en canonical.ts para resolver/normalizar destinos.
- `packages/checks/src/checks/tech/indexability.ts` — patrón para detectar noindex (reutilizar la lógica de lectura de robots/meta al evaluar el destino).
- `packages/checks/src/checks/onpage/h1.ts` (ONPAGE-03) — patrón de headings; el nuevo ONPAGE-08 vive junto a este en `onpage/`.
- `packages/psi/src/issues.ts` → `PerfIssueDraft` + `mapPerfIssues` — añadir `source`.

### Established Patterns
- Checks devuelven `IssueDraft[]` con severidad `critical | warning | ok` y `fingerprint` estable.
- `SiteCheck.run({ pages, origin, robotsTxt, sitemapUrls })` recibe el set completo — encaja con la resolución de destino canonical.
- Registro en `packages/checks/src/checks/tech/index.ts` (`techSiteChecks`) y `onpage/index.ts`; `runAllChecks` los orquesta.
- Fixture de validación: juan-tech.com; el score no debe desviarse de forma inesperada por las nuevas filas (SC#5).

### Integration Points
- `packages/checks/src/registry.ts` — `siteChecks` incluye `techSiteChecks`; agregar `canonicalDeep` ahí vía `tech/index.ts`.
- `apps/worker/src/index.ts:~368` — mapeo de `perfIssues` a filas: cambiar `source: null` por `source: draft.source ?? null`.

</code_context>

<specifics>
## Specific Ideas

- SC#5 es el guardarraíl central: fingerprints sub-tipados en TODO hallazgo nuevo (canonical y headings) + verificar que el score de la fixture juan-tech.com no se desvíe inesperadamente. Añadir/actualizar tests de diff que prueben que dos hallazgos distintos en la misma página no colapsan.

</specifics>

<deferred>
## Deferred Ideas

None — la discusión se mantuvo dentro del alcance de la fase.

</deferred>
