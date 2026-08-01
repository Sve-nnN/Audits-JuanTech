# Phase 29: Scoring — categoría Social + retiro de ONPAGE-05 - Context

**Gathered:** 2026-08-01
**Status:** Ready for planning

<domain>
## Phase Boundary

El modelo de scoring reconoce una sexta categoría `"social"` con pesos rebalanceados explícitamente (onpage .15→.10, schema .10→.05, social .10 nuevo), y el check `ONPAGE-05` (presencia básica de Open Graph, ahora redundante con los checks nuevos de meta/social que vienen en Phase 30) se retira del catálogo activo sin duplicar issues ni tocar el historial ya persistido. Cubre SCORE-01, SCORE-02, SOCIAL-09. Cambio de tipos/constantes en `packages/scoring` + retiro de un check en `packages/checks`, sin UI.

</domain>

<decisions>
## Implementation Decisions

### Retiro de ONPAGE-05

- Eliminar `packages/checks/src/checks/onpage/openGraph.ts` completo (archivo + su export/import en `packages/checks/src/checks/onpage/index.ts`), no dejarlo como código muerto sin usar.
- No tocar filas `Issue` con `checkId="ONPAGE-05"` ya persistidas de auditorías anteriores — quedan como historial, tal como SOCIAL-09 ya lo especifica como "corte de versión" (scores pre/post v1.6 no comparables). Sin migración de datos.
- Agregar un test guardarraíl explícito que confirme que `onPageChecks`/el registry completo ya no contiene ningún check con `checkId === "ONPAGE-05"`.
- La comparación real de "cero issues duplicados por fingerprint" entre lo que hacía ONPAGE-05 y los checks nuevos de Open Graph (SOCIAL-01..08) sólo puede verificarse cuando esos checks existan — eso se retoma explícitamente en Phase 30, no en esta fase. Esta fase sólo garantiza que ONPAGE-05 ya no está activo.

### Pesos y tipos (`Category` / `CATEGORY_WEIGHTS`)

- Insertar `"social"` al final del union type `Category` y del objeto `CATEGORY_WEIGHTS` (después de `aeo`), siguiendo el orden cronológico de introducción que ya usa el objeto (no alfabético).
- Actualizar el comentario de cabecera de `Category`/`CATEGORY_WEIGHTS` en `packages/scoring/src/overallScore.ts` ("The five report categories..." → seis, mencionando social).
- `"social"` sigue el patrón normal issue-derived (como `tech`/`onpage`/`schema`/`aeo`), NO el patrón especial de `"perf"` (que se excluye por blacklist y se calcula aparte desde PSI). El loop de agregación en `apps/worker/src/index.ts` (líneas ~572-585) ya filtra por blacklist explícita de `"perf"` (`if (row.category === "perf") continue`), así que `"social"` fluye automáticamente sin tocar ese loop — sólo hace falta que el tipo `Category` lo incluya.
- Agregar un test que verifique `Object.values(CATEGORY_WEIGHTS).reduce((a,b)=>a+b,0) === 1` (protección contra futuros rebalanceos que rompan la suma).

### Claude's Discretion

- Nombres exactos de archivos de test nuevos y su ubicación (`packages/scoring/src/overallScore.test.ts` ya existe, extender ahí vs archivo nuevo).
- Redacción exacta del comentario actualizado en `overallScore.ts`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/scoring/src/overallScore.ts` — `Category` union (línea 10) y `CATEGORY_WEIGHTS` (línea 23-29), único lugar que necesita el nuevo valor de tipo + peso.
- `packages/checks/src/checks/onpage/openGraph.ts` — check a eliminar (`ONPAGE-05`, presencia de 4 tags OG básicos), y su registro en `packages/checks/src/checks/onpage/index.ts` (`onPageChecks` array + exports nombrados).
- `apps/worker/src/index.ts` líneas ~562-590 — loop de agregación de issues por categoría (`issuesByCategory`, `categoryScores`) que ya excluye `"perf"` por blacklist; confirmado que no necesita cambios para soportar `"social"`.

### Established Patterns
- El objeto `CATEGORY_WEIGHTS` ya documenta explícitamente que los pesos deben sumar 1.0 y que `scoreOverall` renormaliza si una categoría está ausente — mientras Phase 30 no exista, ninguna auditoría va a emitir issues `category: "social"`, así que `categoryScores.social` queda `undefined` y `scoreOverall` renormaliza automáticamente excluyendo "social" del promedio ponderado hasta que Phase 30 aterrice checks reales. Comportamiento esperado, no requiere código adicional en esta fase.
- `packages/checks/src/checks/onpage/index.ts` sigue el patrón array-plano + named exports (mismo patrón que `tech/index.ts`, `schema/index.ts`, `aeo/index.ts`) — quitar `openGraphCheck` de ambos lugares (array y exports) es suficiente para retirarlo del registry global (`packages/checks/src/registry.ts` sólo importa `onPageChecks` como array, no cada check individual).

### Integration Points
- `packages/scoring/src/overallScore.ts` — único archivo que define `Category`/`CATEGORY_WEIGHTS`, consumido por `packages/scoring/src/index.ts` (re-export) y `apps/worker/src/index.ts` (uso).
- No hay cambios necesarios en `packages/report-model` ni en el reporte web para esta fase (Phase 29 no tiene UI, per ROADMAP).

</code_context>

<specifics>
## Specific Ideas

Ninguna referencia específica adicional — ambas áreas grises fueron aceptadas con la respuesta recomendada.

</specifics>

<deferred>
## Deferred Ideas

- Verificación cruzada de fingerprint entre ONPAGE-05 (retirado) y los checks nuevos SOCIAL-01..08 — diferida explícitamente a Phase 30, cuando esos checks existan.

</deferred>
