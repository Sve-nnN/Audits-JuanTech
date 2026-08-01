---
status: testing
phase: 29-scoring-categor-a-social-retiro-de-onpage-05
source: [29-VERIFICATION.md]
started: 2026-08-01T23:45:00Z
updated: 2026-08-01T23:45:00Z
---

## Current Test

number: 1
name: Render de la página de reporte tras reubicar CATEGORY_ORDER
expected: |
  6 tarjetas en orden, social última y sin datos, secciones de detalle sin cambios.
awaiting: user response

## Tests

### 1. Render de la página de reporte tras reubicar CATEGORY_ORDER
expected: 6 tarjetas en orden, social última y sin datos, secciones de detalle sin cambios. Ningún test renderiza `apps/web/app/audits/[id]/page.tsx`, así que la equivalencia de render sólo se puede confirmar a ojo.
result: [pending]

### 2. PROHIBICIÓN judgment-tier 29-01 — score numérico de una categoría sin datos medidos
expected: Exportar un PPTX de una auditoría actual y mirar la slide "Scores por categoría". Decidir si la barra "Meta Tags / Social" en 0 con el valor 0 impreso (`showValue: true`) más la nota "Sin datos: Meta Tags / Social (se muestran como 0)" al pie es aceptable, o si hay que excluir del gráfico las categorías sin score (fix propuesto en 29-REVIEW WR-07).
result: [pending]

### 3. PROHIBICIÓN judgment-tier 29-02 — no mutar/borrar/backfillear filas previas a v1.6
expected: Confirmar que no hace falta acción. Evidencia automatizada: `git diff daaca34..HEAD -- packages/db/` vacío (cero cambios de schema/migración) y las 6 referencias a ONPAGE-05 en `packages/cms-adapters` intactas.
result: [pending]

### 4. PROHIBICIÓN judgment-tier 29-03 — no duplicar la lista de categorías en una constante paralela
expected: Confirmar que se cumple. Evidencia: los tres tests de exhaustividad derivan de `Object.keys(CATEGORY_WEIGHTS)`; el `ALL_CATEGORIES` de `packages/export/src/labels.test.ts:25` no es un literal paralelo sino `(Object.keys(CATEGORY_WEIGHTS) as Category[]).sort()`.
result: [pending]

### 5. PROHIBICIÓN judgment-tier 29-04 — no presentar como logro del usuario los issues resueltos por cambio de catálogo
expected: Confirmar que documentar sin capar alcanza. Evidencia: no se agregó lógica de cap/filtrado (el diff completo de `build.ts` en la fase es una sola línea) y la consecuencia está escrita en `PROJECT.md:153` y en el docblock de `registry.test.ts`.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
