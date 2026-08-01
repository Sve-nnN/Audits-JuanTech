---
phase: 29-scoring-categor-a-social-retiro-de-onpage-05
verified: 2026-08-01T23:39:34Z
status: human_needed
score: 20/21 must-haves verified
behavior_unverified: 1
overrides_applied: 0
deferred:
  - truth: "Guardarraíl de cero issues duplicados por fingerprint entre ONPAGE-05 (retirado) y los checks SOCIAL-01..08"
    addressed_in: "Phase 30"
    evidence: "29-CONTEXT.md: 'La comparación real de cero issues duplicados por fingerprint ... sólo puede verificarse cuando esos checks existan — eso se retoma explícitamente en Phase 30, no en esta fase.' ADVERTENCIA: los Success Criteria de Phase 30 en ROADMAP.md NO nombran este guardarraíl (ver WARNING W-06)."
behavior_unverified_items:
  - truth: "La reubicación de CATEGORY_ORDER en apps/web no cambia comportamiento: la página renderiza las mismas tarjetas de score y las mismas secciones de detalle, en el mismo orden, con la categoría social agregada al final. (29-03 T5)"
    test: "Abrir un reporte existente en /audits/[id] y comparar contra el render previo al cambio: 6 tarjetas de score en orden tech, perf, onpage, schema, aeo, social; la tarjeta 'Meta Tags / Social' aparece última y sin score; las secciones de detalle por categoría mantienen el mismo orden y no aparece una sección social vacía."
    expected: "Mismas tarjetas y secciones, mismo orden, social al final y sin datos. Sin errores de hidratación ni secciones duplicadas."
    why_human: "Ningún test renderiza apps/web/app/audits/[id]/page.tsx — los 10 archivos de test de apps/web cubren componentes UI y la API de export, ninguno la página. El grep confirma que el import y el .map existen, pero la equivalencia de render (orden de tarjetas, ausencia de sección social vacía) es una invariante de presentación que la presencia de símbolos no puede probar."
human_verification:
  - test: "Render de la página de reporte tras reubicar CATEGORY_ORDER (ver behavior_unverified_items)"
    expected: "6 tarjetas en orden, social última y sin datos, secciones de detalle sin cambios"
    why_human: "Sin cobertura de test sobre page.tsx"
  - test: "PROHIBICIÓN judgment-tier 29-01 — 'MUST NOT presentar un score numérico de una categoría sin datos medidos como si hubiera sido medida'. Exportar un PPTX de una auditoría actual y mirar la slide 'Scores por categoría'."
    expected: "Decidir si la barra 'Meta Tags / Social' en 0 con el valor 0 impreso (showValue: true) + la nota 'Sin datos: Meta Tags / Social (se muestran como 0)' en 11pt al pie es aceptable, o si hay que excluir del gráfico las categorías sin score (fix propuesto en 29-REVIEW WR-07)."
    why_human: "Verificación judgment-tier sin resolver (status unverified en 29-01-PLAN). La nota SÍ cubre social (derivada de CATEGORY_ORDER, verificado en pptx.ts:502-505), así que la letra de la prohibición se cumple; si el 0 impreso comunica una medición falsa es un juicio de producto que sólo Juan puede cerrar."
  - test: "PROHIBICIÓN judgment-tier 29-02 — 'MUST NOT mutar, borrar ni backfillear ninguna fila persistida anterior a v1.6'."
    expected: "Confirmar que no hace falta acción. Evidencia automatizada: git diff daaca34..HEAD -- packages/db/ está vacío (cero cambios de schema/migración) y las 6 referencias a ONPAGE-05 en packages/cms-adapters siguen intactas."
    why_human: "Verificación judgment-tier sin resolver (status unverified en 29-02-PLAN). La evidencia mecánica es fuerte y consistente con la decisión registrada en 29-CONTEXT.md; sólo falta la aceptación explícita."
  - test: "PROHIBICIÓN judgment-tier 29-03 — 'MUST NOT resolver la exhaustividad duplicando la lista de categorías en una constante paralela'."
    expected: "Confirmar que se cumple. Evidencia: los tres tests de exhaustividad derivan de Object.keys(CATEGORY_WEIGHTS); el ALL_CATEGORIES de packages/export/src/labels.test.ts:25 NO es un literal paralelo, es (Object.keys(CATEGORY_WEIGHTS) as Category[]).sort()."
    why_human: "Verificación judgment-tier sin resolver (status unverified en 29-03-PLAN)."
  - test: "PROHIBICIÓN judgment-tier 29-04 — 'MUST NOT presentar como logro del usuario los issues que quedan resueltos sólo porque cambió el catálogo'."
    expected: "Confirmar que documentar (sin capar) es suficiente. Evidencia: no se agregó lógica de cap/filtrado (el diff completo de build.ts en la fase es una sola línea) y la consecuencia está escrita en PROJECT.md:153 y en el docblock de registry.test.ts."
    why_human: "Verificación judgment-tier sin resolver (status unverified en 29-04-PLAN). La compensación elegida es documental; aceptar que alcanza es decisión de producto."
---

# Phase 29: Scoring — categoría Social + retiro de ONPAGE-05 — Verification Report

**Phase Goal:** El score general reconoce una sexta categoría "Meta Tags/Social" con pesos rebalanceados explícitamente, y el check ONPAGE-05 (ahora redundante con la categoría nueva) se retira sin duplicar issues.
**Verified:** 2026-08-01T23:39:34Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

Los tres Success Criteria del ROADMAP se cumplen y están respaldados por evidencia ejecutada, no por lectura de SUMMARY. Verifiqué los pesos y la renormalización corriendo el código real en un probe propio, no confiando en los asserts del repo (que, como se documenta abajo, no discriminan el denominador).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC1** — El modelo reconoce `social` y los 6 pesos suman 1.0, con onpage .15→.10 y schema .10→.05 cediendo peso a social .10 | ✓ VERIFIED | `overallScore.ts:12` union con `social`; `:31-38` weights. Probe ejecutado: `PROBE sum: 1`, `PROBE weights: {"tech":0.3,"perf":0.3,"onpage":0.1,"schema":0.05,"aeo":0.15,"social":0.1}`. Comentarios inline `// .15 → .10 (SCORE-02)` y `// .10 → .05 (SCORE-02)` hacen explícito el origen del peso cedido |
| 2 | **SC2** — `ONPAGE-05` ya no está activo; ninguna auditoría nueva produce issues duplicados por fingerprint entre `onpage` y `social` | ✓ VERIFIED | `openGraph.ts` borrado del árbol (`git log --diff-filter=D` → commit `cdf9fb1`); barrel con 7 checks, sin import/export/entrada; `registry.test.ts` asserta `not.toContain("ONPAGE-05")` en `pageChecks` **y** end-to-end que `runAllChecks` sobre una página con las 4 etiquetas OG devuelve `[]`. Grep confirma que **ningún** check emite `category: "social"` hoy, así que la duplicación es imposible por construcción. 152 tests de `@auditor/checks` en verde (corrida forzada) |
| 3 | **SC3** — El cambio de catálogo documentado como corte de versión (scores pre/post v1.6 no comparables) | ✓ VERIFIED | Tres sitios independientes: `PROJECT.md:153` (fila de Key Decisions), `overallScore.ts:25-29` (docblock de `CATEGORY_WEIGHTS`), `registry.test.ts:24-51` (docblock del guardarraíl, con las 3 consecuencias enumeradas) |
| 4 | Contrato de precisión: comparación por epsilon, no igualdad estricta (29-01 T3) | ✓ VERIFIED | `overallScore.test.ts:6-12` usa `toBeCloseTo(1.0, 5)` con comentario explicando por qué `=== 1` fallaría |
| 5 | Contrato de borde: un peso alterado deja el test en rojo; `social` sin datos queda fuera de `present` y `totalWeight` renormaliza a 0.90 (29-01 T4) | ✓ VERIFIED | Rojo ante rebalanceo roto: doble guardarraíl (`toBeCloseTo` sobre la suma + `toEqual` del objeto entero, que además falla ante clave extra o faltante). Renormalización **probada conductualmente por mí**: `scoreOverall({tech:100, onpage:0, schema:0, aeo:0}, PSI 100/100)` → `overall: 67`. Con denominador 1.0 daría 60; 67 sólo es alcanzable dividiendo por 0.90. Ver WARNING W-02: el test del repo **no** puede ver esto |
| 6 | Un issue con `category: "social"` sobrevive hasta `model.issuesByCategory.social` (29-01 T5) | ✓ VERIFIED | `build.test.ts:217-236`, assert `expect(model!.issuesByCategory.social).toHaveLength(1)`; 50 tests de `@auditor/report-model` en verde (forzado) |
| 7 | `pnpm typecheck --continue --force` verde con 16 tareas ejecutadas (29-01 T6) | ✓ VERIFIED | Corrida propia forzada: `Tasks: 16 successful, 16 total`, cero `error TS` |
| 8 | El módulo del check queda eliminado del árbol, no comentado ni como código muerto (29-02 T2) | ✓ VERIFIED | `git diff --name-status` → `D packages/checks/src/checks/onpage/openGraph.ts`; el barrel no lo importa, no lo lista ni lo re-exporta |
| 9 | Ningún test queda huérfano (29-02 T3) | ✓ VERIFIED | `ls` del directorio `onpage/`: los `.test.ts` presentes son altText, h1, headings, metaDescription, title — no había ni quedó test de openGraph |
| 10 | `packages/cms-adapters` intacto, sirviendo copy a reportes históricos (29-02 T4) | ✓ VERIFIED | 6 referencias a `"ONPAGE-05"` vivas en `types.ts:42`, `wordpress.ts:42`, `shopify.ts:20`, `webflow.ts:20`, `wixSquarespace.ts:23,48`; 21 tests del paquete en verde. Alineado con la decisión de 29-CONTEXT (sin migración de datos) |
| 11 | `onPageChecks` pasa de 8 a 7 y `pageChecks` no tiene checkIds duplicados (29-02 T5) | ✓ VERIFIED | `index.ts`: 7 entradas en el array y 7 en el bloque de exports; `registry.test.ts` asserta `new Set(registered).size === registered.length` |
| 12 | Los tres arrays `Category[]` cubren todas las claves de `CATEGORY_WEIGHTS`, cada uno con test en runtime (29-03 T1) | ✓ VERIFIED | `export/labels.test.ts:25-42`, `report-model/build.test.ts:142`, `web/labels.test.ts:24-30` — los tres comparan contra `(Object.keys(CATEGORY_WEIGHTS) as Category[]).sort()` |
| 13 | La omisión de una categoría en esos arrays deja de ser silenciosa (29-03 T2) | ✓ VERIFIED | Cubierto para los tres arrays nombrados. Ver WARNING W-03: existe un cuarto sitio con cast `as` sin cubrir, fuera del alcance literal de esta truth |
| 14 | `apps/web` deja de declarar `CATEGORY_ORDER` dentro de un archivo de página; vive en `labels.ts` y `page.tsx` la importa (29-03 T3) | ✓ VERIFIED | `web/labels.ts:11` `export const CATEGORY_ORDER`; `page.tsx:21` la importa y la consume en `:199` y `:346` |
| 15 | Las fixtures de `packages/export` ejercitan la categoría social (29-03 T4) | ✓ VERIFIED | `test-fixtures.ts:44` `CATS` incluye `social`; `:68-75` el literal `issuesByCategory` incluye `social: []`; `markdown.test.ts:17` asserta `toContain("Meta Tags / Social")` |
| 16 | La reubicación de `CATEGORY_ORDER` no cambia el comportamiento de render de la página (29-03 T5) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Import y `.map` presentes y cableados, pero **ningún** test renderiza `page.tsx` (los 10 test files de apps/web cubren componentes UI y la API de export). Invariante de presentación no ejercitada — ver Human Verification |
| 17 | La consecuencia del corte en el diff queda escrita (29-04 T2) | ✓ VERIFIED | `PROJECT.md:153` describe la fila "Resuelto" por página que el usuario no corrigió; replicado en `registry.test.ts:47-51` |
| 18 | La fase NO agrega lógica de cap ni de filtrado sobre `resolvedIssues` (29-04 T3) | ✓ VERIFIED | `git diff daaca34..HEAD -- packages/report-model/src/build.ts` es **una sola línea** (el `CATEGORY_ORDER`); no hay cambios en la página de reporte que filtren resueltos |
| 19 | La categoría social se muestra vacía: "sin datos" en markdown y PDF, 0 + nota en PPTX (29-04 T4) | ✓ VERIFIED | `markdown.ts:49-51` `\`sin datos\``; `pdf.tsx:191-194` ternario a `"sin datos"`; `pptx.ts:502-505` nota `Sin datos: ${names} (se muestran como 0).` derivada de `CATEGORY_ORDER`, por lo que cubre `social` automáticamente |
| 20 | Cierre de fase: typecheck 16 tareas y test 13 tareas en verde, sin caché (29-04 T5) | ✓ VERIFIED | Corridas propias forzadas: `pnpm typecheck --continue --force` → 16/16; `pnpm test --continue --force` → 13/13. La corrida sin `--force` volvió `FULL TURBO` (caché), por eso se rehízo forzada |
| 21 | La fase no alteró el árbol de dependencias (29-04 T6) | ✓ VERIFIED | `git diff --stat daaca34..HEAD -- pnpm-lock.yaml` vacío |

**Score:** 20/21 truths verified (1 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Guardarraíl de cero duplicados por fingerprint contra los checks SOCIAL-01..08 reales | Phase 30 | 29-CONTEXT.md línea 21 lo difiere explícitamente. **Riesgo:** los Success Criteria de Phase 30 en ROADMAP.md no lo nombran (ver W-06) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/scoring/src/overallScore.ts` | union con social, pesos rebalanceados, nota de corte v1.6 | ✓ VERIFIED | `social: 0.1` presente; docblock de corte en `:25-29` |
| `packages/scoring/src/overallScore.test.ts` | asserts de los 6 pesos + renormalización | ✓ VERIFIED (con reserva) | `toEqual` de los 6 valores es sólido; el test de renormalización no discrimina (W-02) |
| `packages/report-model/src/build.ts` | `CATEGORY_ORDER` exportado incluyendo social | ✓ VERIFIED | `:25 export const CATEGORY_ORDER` con 6 entradas |
| `packages/report-model/src/build.test.ts` | test e2e del issue social | ✓ VERIFIED | `:217-236` |
| `packages/export/src/labels.ts` | `CATEGORY_ORDER` + `CATEGORY_LABEL` con social | ✓ VERIFIED | `"Meta Tags / Social"` presente |
| `packages/export/src/labels.test.ts` | exhaustividad de ORDER, LABEL y CATS | ✓ VERIFIED | 3 asserts contra `Object.keys(CATEGORY_WEIGHTS)` |
| `packages/export/src/test-fixtures.ts` | fixtures que cubren las 6 categorías | ✓ VERIFIED | `CATS` y el literal incluyen social; ver W-03 sobre el cast |
| `apps/web/app/components/ui/labels.ts` | `CATEGORY_ORDER` reubicado + label social verbatim | ✓ VERIFIED | Gemelo verbatim del mapa de export |
| `apps/web/app/components/ui/labels.test.ts` | exhaustividad de ORDER y LABEL de la web | ✓ VERIFIED | 2 asserts contra `Object.keys(CATEGORY_WEIGHTS)`; ver W-04 sobre la paridad de copy |
| `packages/checks/src/registry.test.ts` | guardarraíl negativo + e2e + nota de corte | ✓ VERIFIED | 3 asserts nuevos + docblock de 28 líneas |
| `packages/checks/src/checks/onpage/index.ts` | barrel con 7 checks | ✓ VERIFIED | Sin rastro de `openGraphCheck` |
| `packages/checks/src/checks/onpage/openGraph.ts` | ausente (retirado) | ✓ VERIFIED (ausencia intencional) | `D` en el diff de la fase |
| `.planning/PROJECT.md` | fila de Key Decisions con el corte v1.6 | ✓ VERIFIED | `:153`, contiene `v1.6` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scoring/overallScore.ts` | `report-model/build.ts` | union `Category` tipa `CATEGORY_ORDER` | ✓ WIRED | `import type { Category }`; array con las 6 |
| `scoring/overallScore.ts` | `export/labels.ts` | `Record<Category, string>` exige la clave social | ✓ WIRED | Typecheck 16/16 verde con la clave presente |
| `scoring/overallScore.ts` | `web/labels.ts` | mismo `Record<Category, string>` | ✓ WIRED | Mapa gemelo verbatim |
| `web/labels.ts` | `web/audits/[id]/page.tsx` | `page.tsx` importa `CATEGORY_ORDER` | ✓ WIRED | `:21` import, `:199` y `:346` uso |
| `checks/onpage/index.ts` | `checks/registry.ts` | `registry.ts` importa sólo el array `onPageChecks` | ✓ WIRED | Retirarlo del barrel lo retira del catálogo global; confirmado por el assert e2e sobre `runAllChecks` |
| `checks/registry.test.ts` | `checks/registry.ts` | el test asserta el CONTENIDO del catálogo | ✓ WIRED | Importa `pageChecks` y `runAllChecks` |
| `scoring/overallScore.ts` | `.planning/PROJECT.md` | docblock y Key Decisions cuentan el mismo corte | ✓ WIRED | Ambos textos nombran `v1.6`, los mismos deltas de peso y la no comparabilidad |
| `scoring/overallScore.ts` | `worker/src/index.ts` | el loop de agregación no necesita cambios (blacklist sólo de `perf`) | ✓ WIRED | `:569-579` confirmado: `social` fluye sin tocar el loop |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `build.ts` `issuesByCategory` | buckets por categoría | `CATEGORY_ORDER.map` + filas `Issue` de DB | Sí (probado e2e con un issue `social`) | ✓ FLOWING |
| `page.tsx` tarjetas de score | `byCategory[category]` | `Audit.scores` persistido por el worker | Sí para las 5 categorías medidas; `social` `undefined` **a propósito** hasta Phase 30 | ✓ FLOWING (social vacía por diseño, documentado) |
| `pptx.ts` gráfico de barras | `model.byCategory[c]?.score ?? 0` | mismo `Audit.scores` | `social` se grafica como 0 real | ⚠️ Ver W-05 |
| `CATEGORY_WEIGHTS` | pesos | constante literal | Sí | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Los 6 pesos suman 1.0 y valen lo declarado | probe vitest sobre `CATEGORY_WEIGHTS` | `sum: 1`, `{"tech":0.3,"perf":0.3,"onpage":0.1,"schema":0.05,"aeo":0.15,"social":0.1}` | ✓ PASS |
| `scoreOverall` renormaliza sobre 0.90 cuando falta `social` | probe con scores diferenciados (tech 100, resto 0) | `overall: 67` (denominador 1.0 daría 60) | ✓ PASS |
| Una categoría fuera de `CATEGORY_WEIGHTS` NaNea el overall | probe con clave `"sociall"` | `overall: NaN`, `finite? false`, `JSON: {"overall":null}` | ✗ FAIL → W-01 |
| Suite completa sin caché | `pnpm test --continue --force` | `Tasks: 13 successful, 13 total` (521 tests) | ✓ PASS |
| Typecheck completo sin caché | `pnpm typecheck --continue --force` | `Tasks: 16 successful, 16 total` | ✓ PASS |
| Lockfile intacto | `git diff --stat -- pnpm-lock.yaml` | vacío | ✓ PASS |

### Probe Execution

No aplica: el repositorio no tiene `scripts/*/tests/probe-*.sh` y ningún PLAN de la fase declara probes. La verificación conductual se hizo con los probes de vitest documentados arriba (ejecutados y luego eliminados; el árbol quedó limpio).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCORE-01 | 29-01, 29-03 | categoría "social" nueva en `Category` union + `WEIGHTS` | ✓ SATISFIED | `overallScore.ts:12,37`; fan-out a los 3 arrays de presentación con guardarrailes de exhaustividad |
| SCORE-02 | 29-01, 29-04 | rebalanceo (onpage .15→.10, schema .10→.05, social .10), documentado como corte de versión | ✓ SATISFIED | Pesos verificados por probe; corte documentado en `PROJECT.md:153` + docblock `overallScore.ts:25-29` |
| SOCIAL-09 | 29-02, 29-04 | retiro de ONPAGE-05 con guardarraíl de cero issues duplicados por fingerprint | ✓ SATISFIED (parcial por diseño) | Retiro completo y con guardarraíl doble. La mitad "cero duplicados contra los SOCIAL-01..08" está deferida a Phase 30 por decisión registrada — ver Deferred Items y W-06 |

**Requisitos huérfanos:** ninguno. `REQUIREMENTS.md:92-94` mapea exactamente SCORE-01, SCORE-02 y SOCIAL-09 a Phase 29, y los tres aparecen reclamados en el frontmatter de los PLANs.

### Anti-Patterns Found

Escaneo de marcadores de deuda (`TBD`, `FIXME`, `XXX`, `HACK`, `PLACEHOLDER`, `not yet implemented`) sobre los 10 archivos fuente modificados por la fase: **cero coincidencias**. No hay implementaciones vacías, `console.log` de relleno ni retornos estáticos introducidos.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | ninguno | — | — |

### Warnings

Ninguno de estos falsifica un Success Criterion, pero todos son hallazgos reproducidos sobre el código real.

**W-01 (el más grave) — Una categoría fuera de `CATEGORY_WEIGHTS` convierte el score general en `NaN` y lo persiste como `null`.**
`overallScore.ts:93-101`. Reproducido por mí, independientemente de 29-REVIEW: `overall: NaN`, `JSON.stringify` → `{"overall":null}`. El guard `totalWeight === 0` no atrapa `NaN`. La cadena está abierta de punta a punta: `IssueDraft.category` es `string` (no `Category`), el worker lo persiste verbatim y lo castea desnudo en `apps/worker/src/index.ts:574` (`row.category as Category`), y la columna es `String` sin enum. **No falla ningún must-have de esta fase** — ninguna truth cubre robustez ante categoría desconocida —, pero esta fase amplió el radio de exposición y Phase 30 va a escribir a mano `category: "social"` en 8 checks nuevos contra un campo `string`. Un solo typo (`"Social"`, `"sociales"`, `"social "`) NaNea el score general de todas las auditorías **en silencio**, y `build.ts:246-249` descarta el issue sin log, así que no queda ni rastro. **Recomendación fuerte: cerrarlo antes de arrancar Phase 30**, con el filtro de `CATEGORY_WEIGHTS[cat] !== undefined` + `Number.isFinite(totalWeight)` en el punto de cálculo (fix en 29-REVIEW CR-01).

**W-02 — El test de renormalización de `social` no puede ver lo que dice verificar.**
`overallScore.test.ts:69-81` pasa **exactamente el mismo input** que el test de `:48-56` (las cuatro categorías en 100). Con todo en 100, `900/9` y `90/0.9` dan igual: ningún assert del archivo distingue el denominador. El único assert agregado (`byCategory.social` es `undefined`) es trivialmente cierto porque `social` nunca entró al input — pasaría igual con el bloque de renormalización borrado. El comportamiento **sí es correcto** (lo probé con scores diferenciados: `overall: 67`), pero el guardarraíl del repo no lo protege. 29-01-SUMMARY registra esto como cobertura D5 `status: pass`: la afirmación de cobertura es más fuerte que el test.

**W-03 — Queda un sitio con cast `as` sin cubrir dentro del paquete que 29-03 declara cerrado.**
`test-fixtures.ts:68-75`: el objeto `issuesByCategory` que los serializadores consumen es un literal con `as Record<Category, ReportIssue[]>`. El cast suprime la exhaustividad y ningún test mira sus claves (`labels.test.ts` compara `CATS`, que es otro array). Una séptima categoría agregada al union y a `CATS` pero no a este literal reproduce el mismo falso verde que 29-03 dice haber eliminado. `build.ts:244` ya usa el patrón correcto (`Object.fromEntries(CATEGORY_ORDER.map(...))`); el fixture no lo adoptó.

**W-04 — La página de reporte le sigue diciendo al usuario que el score son cinco categorías.**
`apps/web/app/audits/[id]/page.tsx:174-175`: *"Promedio ponderado de SEO técnico, rendimiento, on-page, datos estructurados y AEO"*, mientras 25 líneas abajo (`:199`) renderiza seis tarjetas desde `CATEGORY_ORDER`, una de ellas "Meta Tags / Social". Es el único punto del fan-out sin cerrar y es el que el usuario lee. Dado el perfil de Juan (UX pixel-perfect, verificar el output renderizado), esto debería cerrarse. Comentarios con la cardinalidad vieja también quedaron en `pptx.ts:21`, `CategoryCard.tsx:34` y `AuditProgress.tsx:22`.

**W-05 — El PPTX grafica la categoría no medida como una barra en 0 con el valor impreso.**
`pptx.ts:478` resuelve con `?? 0` y el gráfico tiene `showValue: true`. Durante toda la ventana 29→30, cada PPTX exportado lleva una barra "Meta Tags / Social" en 0 con un `0` impreso encima, compensada sólo por una nota de 11pt al pie. Markdown y PDF sí dicen "sin datos". La nota **existe y cubre social** (se deriva de `CATEGORY_ORDER`), así que la letra de la prohibición de 29-01 se cumple — pero es exactamente el caso que la prohibición apunta a evitar. Enrutado a decisión humana.

**W-06 — El guardarraíl anti-duplicados de SOCIAL-09 podría caerse entre fases.**
`REQUIREMENTS.md:20` define SOCIAL-09 como "retiro de ONPAGE-05 **con guardarraíl de cero issues duplicados por fingerprint**", y ya está marcado `[x]` y `Complete` en la tabla de trazabilidad. La mitad "cero duplicados" está correctamente diferida a Phase 30 (29-CONTEXT.md línea 21), pero **ninguno de los 4 Success Criteria de Phase 30 en ROADMAP.md la menciona**. Con SOCIAL-09 ya marcado completo, nada obliga a Phase 30 a escribir ese guardarraíl. Recomendación: agregar el criterio explícitamente al ROADMAP de Phase 30 antes de planificarla.

**W-07 — Docblock de `CATEGORY_WEIGHTS` internamente contradictorio.**
`overallScore.ts:14-19` sigue afirmando *"AEO the least (its ranking impact is not yet confirmed)"*. Tras el rebalanceo AEO vale `.15` y es la tercera más pesada; las menores son `onpage`/`social` (.10) y `schema` (.05). 29-01 editó ese mismo docblock para agregarle la nota de corte y dejó en pie la frase que el rebalanceo acababa de invalidar.

**W-08 — La ventana 29→30 puntúa con una tercera distribución de pesos no documentada.**
Con `social` en `.10` y cero checks emitiendo, `scoreOverall` renormaliza sobre 0.90: los pesos efectivos de hoy (tech/perf .333, onpage .111, schema .056, aeo .167) no son ni los de v1.5 ni los declarados en `CATEGORY_WEIGHTS`. El comportamiento es correcto y deseado, pero el corte está documentado en tres sitios como "de v1.5 a v1.6" sin mencionar este tercer baseline intermedio. `PROJECT.md:153` sólo describe el síntoma visual ("la categoría social aparece en el reporte sin datos"), no el efecto sobre el score.

### Human Verification Required

#### 1. Render de la página de reporte tras reubicar `CATEGORY_ORDER`

**Test:** Abrir un reporte existente en `/audits/[id]` y compararlo contra el render previo al cambio.
**Expected:** 6 tarjetas de score en orden tech, perf, onpage, schema, aeo, social; "Meta Tags / Social" última y sin datos; las secciones de detalle por categoría en el mismo orden y sin sección social vacía; sin errores de hidratación.
**Why human:** Ningún test renderiza `page.tsx`. El import y el `.map` están presentes y cableados, pero la equivalencia de render es una invariante de presentación que la presencia de símbolos no puede probar.

#### 2-5. Prohibiciones judgment-tier sin resolver

Las cuatro prohibiciones declaradas en los PLANs siguen con `status: unverified` y verificación `judgment`. Ninguna es un fallo — la evidencia mecánica que junté es consistente con las cuatro —, pero requieren aceptación explícita y no pueden absorberse en un verde silencioso. El detalle de cada una, con su evidencia, está en el frontmatter (`human_verification`). Resumen:

- **29-01 (PPTX / score no medido):** la nota "Sin datos" cubre social; falta decidir si el `0` impreso en la barra es aceptable (ver W-05).
- **29-02 (no mutar historial):** cero cambios en `packages/db/`, cms-adapters intacto. Sólo falta aceptar.
- **29-03 (no duplicar la lista de categorías):** cumplida — todo deriva de `Object.keys(CATEGORY_WEIGHTS)`.
- **29-04 (no presentar como logro los resueltos por cambio de catálogo):** cero lógica de cap/filtrado agregada; compensación documental en su lugar. Falta aceptar que alcanza.

### Gaps Summary

**Sin gaps.** Los tres Success Criteria del ROADMAP están cumplidos con evidencia ejecutada, no declarada:

1. El modelo de scoring reconoce `social`, los seis pesos suman exactamente 1.0 y el rebalanceo de onpage y schema es explícito tanto en los valores como en comentarios inline que citan SCORE-02. Verificado corriendo el código, no leyendo el SUMMARY.
2. `ONPAGE-05` está borrado del árbol (no comentado, no muerto), fuera del barrel y fuera del catálogo, con un guardarraíl doble: negativo sobre el contenido de `pageChecks` y end-to-end sobre `runAllChecks` con una página que tiene las cuatro etiquetas OG. La duplicación entre `onpage` y `social` es imposible hoy porque ningún check emite `social`.
3. El corte de versión está escrito en tres sitios independientes, incluyendo el registro de decisiones del proyecto y no sólo comentarios de código.

La fase se detiene en `human_needed`, no en `passed`, por dos motivos: una truth de render (29-03 T5) que ningún test ejercita, y las cuatro prohibiciones judgment-tier que siguen sin resolución explícita.

**Lo que más importa antes de Phase 30:** W-01 no rompe esta fase, pero Phase 30 es exactamente el escenario que lo dispara — ocho checks nuevos escribiendo `category: "social"` a mano contra un campo tipado `string`, donde un typo NaNea el score general de todas las auditorías sin dejar rastro. Cerrarlo cuesta dos líneas en `overallScore.ts`; descubrirlo en producción cuesta el dato de score de cada auditoría afectada. Junto a eso, W-04 (el copy que dice cinco categorías sobre seis tarjetas) es lo único que el usuario final ve roto hoy, y W-06 es el riesgo de que el guardarraíl anti-duplicados de SOCIAL-09 quede sin dueño.

---

_Verified: 2026-08-01T23:39:34Z_
_Verifier: Claude (gsd-verifier)_
