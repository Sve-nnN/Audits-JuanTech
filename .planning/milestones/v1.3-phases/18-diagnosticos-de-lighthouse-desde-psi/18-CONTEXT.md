# Phase 18: Diagnósticos de Lighthouse desde PSI - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

El auditor extrae diagnósticos accionables de Lighthouse (formatos de imagen modernos, CSS sin usar, recursos que bloquean el renderizado, compresión de texto, CSS/JS sin minificar) de la respuesta PSI que ya obtiene por página muestreada — sin llamadas extra a la API — y los reporta como issues nuevos `warning`/`ok` (nunca `critical`), sin duplicar las métricas LCP/CLS/TTFB/INP existentes.

</domain>

<decisions>
## Implementation Decisions

### Extracción
- Extender `RawPsiResponse.audits` en `packages/psi/src/parser.ts` para tipar `score` (0-1 o null) y `displayValue` (string opcional) de estos 6 audit IDs de Lighthouse: `modern-image-formats`, `unused-css-rules`, `render-blocking-resources`, `uses-text-compression`, `unminified-css`, `unminified-javascript`.
- Nueva función `extractDiagnostics(raw: RawPsiResponse)` en `parser.ts`, separada de `parsePsiResponse` (que sigue devolviendo solo las métricas LCP/CLS/TTFB/INP/score existentes).
- El resultado se agrega como campo **opcional** `diagnostics?: PsiDiagnostics` en `PsiMetrics` (`packages/psi/src/types.ts`) — opcional para no romper deserialización de entradas ya cacheadas en Redis que no tienen el campo (`getCached` sigue funcionando, entradas viejas se tratan como "sin datos de diagnóstico", no lanzan error ni se recomputan).

### Agrupación de diagnósticos
- `unminified-css` + `unminified-javascript` se combinan en **un solo** diagnóstico "CSS/JS sin minificar" — toma el peor (menor) de los dos scores.
- Los otros 4 (`modern-image-formats`, `unused-css-rules`, `render-blocking-resources`, `uses-text-compression`) quedan 1:1, un issue cada uno.
- Total: **5 checkIds nuevos**.

### Check IDs
- Secuenciales desde el próximo `PERF-0x` libre. **Verificar en vivo** con `grep -rhn "checkId: \"PERF-" packages/psi/src/issues.ts` antes de asignar (no confiar ciegamente en el valor de este documento si el código cambió) — al momento de este discuss, `PERF-01..04` están ocupados, próximo libre es `PERF-05`.

### Severidad
- Regla dura: score del propio audit Lighthouse (0-1) `>= 0.9` → `"ok"`, `< 0.9` → `"warning"`. **Nunca `"critical"`** — mismo patrón que SD-06 (Phase 17) y TECH-14 (Phase 16): hardcodeado, no derivado dinámicamente de otra escala.
- Audit ausente en la respuesta PSI (campo no presente) → no emitir issue para ese diagnóstico en esa página (degradación silenciosa, no error).

### No duplicar señal existente
- Estos 5 diagnósticos son datos nuevos (no están en `METRIC_SPECS` de `packages/psi/src/issues.ts` hoy) — no hay riesgo de duplicar PERF-01/PERF-02-LCP/CLS/TTFB/INP, que siguen intactos.

### Claude's Discretion
- Redacción exacta de título/criterion/recommendation por diagnóstico.
- Formato exacto de `measuredValue` (usar `displayValue` de Lighthouse cuando esté presente, si no, describir el score).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/psi/src/issues.ts` — patrón `METRIC_SPECS`/`MetricSpec` (checkId, title, criterion, recommendation, format, grade, pick) ya establecido para mapear métricas a `PerfIssueDraft`; reusar la misma forma para los diagnósticos nuevos.
- `packages/psi/src/thresholds.ts` — patrón de umbrales oficiales, aunque los diagnósticos usan su propio `score` de Lighthouse en vez de un umbral custom.
- `packages/psi/src/parser.ts` — `RawPsiResponse`/`parsePsiResponse` ya parsean la misma respuesta cruda; extender ahí, no duplicar el fetch.

### Established Patterns
- `PerfIssueDraft` (category `"perf"`) es shape-compatible con `IssueDraft` de `@auditor/checks`, sin importar ese paquete — mismo patrón a seguir para los drafts de diagnóstico.
- Severidad hardcodeada nunca-critical ya es un patrón repetido en Phase 16 (TECH-14) y Phase 17 (SD-06) — consistente con esta fase.
- Degradación silenciosa ante datos ausentes (best-effort) es el patrón dominante en todo `apps/worker/src/index.ts` y `packages/psi`.

### Integration Points
- `packages/psi/src/issues.ts`: nueva función (ej. `mapDiagnosticIssues`) o extensión de `mapPerfIssues`, exportada desde `packages/psi/src/index.ts`.
- `apps/worker/src/index.ts`: donde ya se llama `mapPerfIssues` dentro de `runOnePage` — agregar el nuevo mapeo ahí mismo, sin llamadas PSI adicionales (los diagnósticos vienen de la misma respuesta ya obtenida en `runPsi`/`getCached`).

</code_context>

<specifics>
## Specific Ideas

No hay referencias específicas adicionales — PERF-05/PERF-06 en REQUIREMENTS.md ya son LOCKED y cubren el detalle funcional.

</specifics>

<deferred>
## Deferred Ideas

None — discusión se mantuvo dentro del alcance de la fase.

</deferred>
