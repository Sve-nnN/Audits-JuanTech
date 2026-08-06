---
phase: 29-scoring-categor-a-social-retiro-de-onpage-05
plan: 02
subsystem: checks
tags: [typescript, vitest, checks, registry, refactor, deprecation]

# Dependency graph
requires:
  - phase: 29-scoring-categor-a-social-retiro-de-onpage-05
    provides: "categoría `social` en el modelo de scoring (29-01), contra la que ONPAGE-05 queda redundante"
provides:
  - "`onPageChecks` con siete checks: el catálogo activo ya no registra `ONPAGE-05`"
  - "guardarraíl de contenido del registry: `pageChecks` no contiene el checkId retirado"
  - "guardarraíl end-to-end sobre `runAllChecks`: una página con las cuatro etiquetas Open Graph no emite ninguna fila del check retirado"
  - "nota de corte de versión v1.6 en el docblock de `registry.test.ts`, con la consecuencia en el diff histórico documentada"
affects: [30-checks-meta-tags-social, 31-validacion-og-image, 32-panel-preview-social]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "guardarraíl negativo de catálogo: escribir el `not.toContain` ANTES del borrado y verificarlo en rojo, para que el retiro tenga dientes contra reintroducciones futuras"
    - "el docblock del archivo de test como sede de la nota de corte de versión, no el barrel del que se elimina el símbolo (la nota vive donde está el guardarraíl)"

key-files:
  created: []
  modified:
    - packages/checks/src/registry.test.ts
    - packages/checks/src/checks/onpage/index.ts
  deleted:
    - packages/checks/src/checks/onpage/openGraph.ts

key-decisions:
  - "Phase 29: el módulo del check retirado se borra del árbol con `git rm`, no se comenta ni se deja como código muerto sin usar (decisión lockeada en 29-CONTEXT.md)"
  - "Phase 29: sin migración, backfill ni script de limpieza sobre filas `Issue` históricas — el historial ya emitido es un registro inmutable que el usuario puede volver a abrir"
  - "Phase 29: `packages/cms-adapters` conserva sus cinco referencias al checkId retirado; su copy de fix se resuelve en tiempo de lectura vía `resolveCmsRecommendation` para reportes ya emitidos"
  - "Phase 29: el falso 'Resuelto' que la primera auditoría posterior al corte va a producir se documenta y NO se capa ni se filtra en la UI — la lógica de cap es alcance de producto de una fase posterior"
  - "Phase 29: el guardarraíl end-to-end usa el caso de las cuatro etiquetas OG presentes (la rama `ok` del check retirado) porque es la que garantiza una fila si el check siguiera vivo"

patterns-established:
  - "Retiro de un check en dos commits: primero el guardarraíl negativo verificado en rojo, después el borrado que lo pone en verde sin editarlo"
  - "Igualdad exacta (no cota superior) en los criterios de aceptación de un borrado, para que el sobre-borrado no pase como éxito"

requirements-completed: [SOCIAL-09]

coverage:
  - id: D1
    description: "El check retirado ya no está en el catálogo activo: ningún elemento de `pageChecks` tiene ese `checkId`"
    requirement: SOCIAL-09
    verification:
      - kind: unit
        ref: "packages/checks/src/registry.test.ts#registry — pageChecks > ya no incluye el check retirado en v1.6"
        status: pass
    human_judgment: false
  - id: D2
    description: "`runAllChecks` no emite ningún `IssueDraft` con el checkId retirado, de punta a punta sobre una página con HTML real que declara las cuatro etiquetas Open Graph"
    requirement: SOCIAL-09
    verification:
      - kind: unit
        ref: "packages/checks/src/registry.test.ts#registry — runAllChecks ... > no devuelve ninguna fila del check retirado sobre una página con las cuatro etiquetas Open Graph"
        status: pass
    human_judgment: false
  - id: D3
    description: "El módulo queda eliminado del árbol, no comentado ni como código muerto, y el barrel no lo importa, lista ni re-exporta"
    requirement: SOCIAL-09
    verification:
      - kind: other
        ref: "`test ! -f packages/checks/src/checks/onpage/openGraph.ts` exit 0; `grep -rl 'openGraph' packages/checks/src` sin resultados; `grep -c 'Check,$' onpage/index.ts` = 14 (era 16); `grep -c '^import ' onpage/index.ts` = 8 (era 9)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ningún test queda huérfano: el directorio `onpage/` no tenía archivo de test propio para este check"
    requirement: SOCIAL-09
    verification:
      - kind: other
        ref: "`ls packages/checks/src/checks/onpage/` antes del borrado: los únicos `*.test.ts` son altText, h1, headings, metaDescription y title — no existía openGraph.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "`packages/cms-adapters` queda intacto y su suite sigue en verde; ninguna fila persistida se mutó"
    requirement: SOCIAL-09
    verification:
      - kind: other
        ref: "`git diff --stat packages/cms-adapters` y `git diff --stat packages/db` vacíos (working tree y staged); `pnpm --filter @auditor/cms-adapters test` 21 passed"
        status: pass
    human_judgment: false
  - id: D6
    description: "El corte de versión v1.6 y su consecuencia en el diff histórico quedan documentados para un lector futuro"
    requirement: SOCIAL-09
    verification: []
    human_judgment: true
    rationale: "Es redacción de documentación en código; su suficiencia para un lector futuro es juicio editorial, no verificable por test. El grep sólo prueba que la cadena 'v1.6' aparece."

# Metrics
duration: 4min
completed: 2026-08-01
status: complete
---

# Phase 29 Plan 02: Retiro de ONPAGE-05 Summary

**El check de presencia de Open Graph sale del catálogo activo con su módulo borrado del árbol y dos guardarrailes negativos escritos antes del borrado, verificados en rojo, que convierten cualquier reintroducción futura en suite roja**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-01T23:09:28Z
- **Completed:** 2026-08-01T23:13:00Z
- **Tasks:** 2
- **Files modified:** 2 (más 1 borrado)

## Accomplishments

- `packages/checks/src/checks/onpage/openGraph.ts` está borrado del árbol con `git rm`, no comentado ni dejado como módulo huérfano. El barrel de on-page perdió sus tres referencias (import, entrada del array, re-export nombrado) y `onPageChecks` pasó de ocho a siete checks conservando el patrón intacto: un import por línea, array plano en el mismo orden que los imports, bloque de re-export en el mismo orden.
- Los dos guardarrailes se escribieron primero y se verificaron en rojo contra HEAD antes del borrado. La salida de la corrida roja mostró exactamente los dos casos nuevos fallando (2 failed | 150 passed), con el diff del end-to-end imprimiendo la fila `ONPAGE-05` de severidad `ok` que el check todavía emitía. Eso es la prueba empírica de que el guardarraíl tiene dientes: no pasó por accidente ni por vacuidad.
- El docblock de `registry.test.ts` documenta el corte de versión v1.6 con sus tres consecuencias asumidas: scores pre/post no comparables, filas históricas conservadas intactas en base de datos con su copy de fix resuelta en lectura por `cms-adapters`, y el falso "Resuelto" que la primera auditoría posterior al corte va a producir sobre un sitio ya auditado (el check emitía siempre una fila por página, nunca cero, así que todos esos fingerprints van a marcarse resueltos sin que el usuario haya corregido nada).
- Cero cambios en `packages/cms-adapters`, en `packages/db` y en datos persistidos, verificado con `git diff --stat` sobre working tree y staging.

## Task Commits

Cada tarea se commiteó atómicamente:

1. **Tarea 1: guardarrailes negativos en registry.test.ts (arrancan en rojo)** - `dd99663` (test)
2. **Tarea 2: eliminar el módulo del check y sus tres referencias en el barrel** - `cdf9fb1` (refactor)

## Files Created/Modified

- `packages/checks/src/registry.test.ts` - constante `RETIRED_CHECK_ID` junto a las constantes existentes, un `it` de contenido con `not.toContain` dentro del `describe` de `pageChecks`, un `it` end-to-end dentro del `describe` de `runAllChecks` que arma con `makePage` una página cuyo HTML declara `og:title`, `og:description`, `og:image` y `og:url` con atributo `property`, y el bloque de corte de versión v1.6 agregado al docblock de cabecera.
- `packages/checks/src/checks/onpage/index.ts` - siete checks en los tres bloques; se eliminaron el import, la entrada del array y la entrada del re-export del check retirado, sin dejar líneas en blanco de más.
- `packages/checks/src/checks/onpage/openGraph.ts` - **borrado** (74 líneas).

## Decisions Made

- El `it` end-to-end se agregó dentro del `describe` existente de `runAllChecks` (cuyo título nombra los checks de performance) en vez de abrir un `describe` nuevo, siguiendo la instrucción literal del plan. El título del `describe` no se renombró: renombrarlo no estaba pedido y habría metido ruido en el diff de un plan cuyo alcance es un retiro.
- El HTML del caso end-to-end va dentro de un template literal en una sola línea, interpolando `URL` en `og:url`. El criterio de aceptación del plan cuenta ocurrencias distintas y no líneas justamente para admitir esta forma.
- La nota de corte de versión vive en el docblock de `registry.test.ts` y el barrel no lleva ninguna tumba ni comentario del check retirado: la nota está donde está el guardarraíl, que es donde un lector futuro la va a encontrar cuando se pregunte por qué existe el `not.toContain`.

## Verificación de la prueba de dientes (Tarea 1)

- **Contra HEAD (antes del borrado):** `pnpm --filter @auditor/checks test` salió con exit status 1. Fallaron **exactamente dos** casos, los dos nuevos. El end-to-end imprimió la fila real que el check emitía: `checkId: "ONPAGE-05"`, `severity: "ok"`, `measuredValue: "4/4 etiquetas OG"`, `fingerprint: "ONPAGE-05:https://example.com/page"`. Confirmado que el caso elegido (cuatro etiquetas presentes) sí dispara una fila, o sea que el guardarraíl mide lo que dice medir.
- **Después del borrado (Tarea 2):** 152 passed en 28 archivos, exit 0, sin tocar los tests. Los tres `it` del `describe` de `pageChecks` y los tres del `describe` de `runAllChecks` aparecen en verde en la salida verbose.

## Deviations from Plan

None - el plan se ejecutó exactamente como estaba escrito.

## Issues Encountered

- Ninguna fricción. Cero paquetes instalados, cero cambios de esquema, cero hooks de git en el repo (`core.hooksPath` sin configurar, `.husky` inexistente), así que los commits corrieron limpios sin necesidad de banderas.

## Verificación ejecutada

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter @auditor/checks test` (Tarea 1, contra HEAD) | exit 1 — 2 failed \| 150 passed, los dos casos nuevos |
| `pnpm --filter @auditor/checks test` (Tarea 2) | 152 passed (28 archivos), exit 0 |
| `pnpm --filter @auditor/checks exec vitest run src/registry.test.ts --reporter=verbose` | los 6 `it` del archivo en verde, los 2 nuevos visibles por nombre |
| `pnpm --filter @auditor/checks typecheck` | exit 0 |
| `pnpm --filter @auditor/cms-adapters test` | 21 passed (2 archivos), exit 0 |
| `pnpm typecheck --continue` (repo completo) | 16 successful, 16 total |
| `test ! -f packages/checks/src/checks/onpage/openGraph.ts` | exit 0 |
| `grep -rl 'openGraph' packages/checks/src` | 0 rutas |
| `grep -c 'Check,$' packages/checks/src/checks/onpage/index.ts` | 14 (igualdad exacta; en HEAD daba 16) |
| `grep -c '^import ' packages/checks/src/checks/onpage/index.ts` | 8 (igualdad exacta; en HEAD daba 9) |
| `grep -Ec '^const [A-Z_]+ =' packages/checks/src/registry.test.ts` | 4 |
| `grep -c 'not.toContain' packages/checks/src/registry.test.ts` | 1 |
| `grep -Eo 'og:(title\|description\|image\|url)' ... \| sort -u \| wc -l` | 4 (en HEAD daba 0) |
| `grep -c 'v1.6' packages/checks/src/registry.test.ts` | 4 |
| `git diff --stat packages/cms-adapters` y `git diff --stat packages/db` | vacíos (working tree y staged) |

## Threat Model — dispositions verificadas

- **T-29-02 (mitigate, integridad del historial):** cerrado. Cero cambios en `packages/cms-adapters` y `packages/db`, verificado con `git diff --stat` sobre working tree y staging; `pnpm --filter @auditor/cms-adapters test` en verde (21 passed), o sea que el producto exacto de etiquetas por identificadores que asserta `coverage.test.ts` sigue intacto. Ninguna fila persistida se leyó ni se escribió: esta fase no corrió ningún script contra la base.
- **T-29-06 (mitigate, retiro a medias):** cerrado. Los dos guardarrailes negativos existen y se verificaron en rojo ANTES del borrado. Un retiro parcial futuro (quitado del array pero no del re-export, o al revés) deja el `not.toContain` en verde pero no compila o no cambia nada; el caso que sí importa —reintroducir el check en el array— vuelve rojos los dos casos.
- **T-29-SC (accept):** confirmado, cero instalaciones de paquetes.

## Nota sobre SOCIAL-09 y su asunción marcada

El plan registra explícitamente que SOCIAL-09 se cubre a medias por construcción: "guardarraíl de cero issues duplicados por fingerprint" se interpretó como "el check retirado ya no produce ninguna fila", no como una comparación cruzada contra `SOCIAL-01..08`. Esa comparación no es verificable hasta que esos checks existan. **Phase 30 debe cerrarla.** Queda registrado acá para que no se pierda al marcar el requisito como completo.

## Ventana sin cobertura de Open Graph

Entre este commit y el aterrizaje de `SOCIAL-01..08` (Phase 30), el catálogo activo no tiene ningún check de Open Graph. Es deliberado: el ROADMAP secuencia 29 antes de 30 a propósito, para no escribir checks contra un modelo de scoring que todavía podía cambiar. Cualquier auditoría corrida en esa ventana no reporta nada sobre Open Graph.

## User Setup Required

None - no hay configuración de servicios externos ni cambios de esquema; no corre `pnpm db:push`.

## Next Phase Readiness

- Phase 30 puede definir `SOCIAL-01..08` sobre un catálogo limpio: no hay ningún check activo de Open Graph con el que puedan colisionar por fingerprint.
- Phase 30 hereda la verificación cruzada de fingerprint que esta fase no podía hacer.
- El plan 29-03 (guardarrailes de exhaustividad de `CATEGORY_ORDER` en los tres paquetes + mover la constante de `page.tsx`) no toca `packages/checks`, así que arranca sin conflicto con este commit.

## Self-Check: PASSED

- `packages/checks/src/registry.test.ts` existe en disco. `packages/checks/src/checks/onpage/index.ts` existe en disco. `packages/checks/src/checks/onpage/openGraph.ts` NO existe (borrado intencional, verificado).
- Los dos commits de tarea existen en el historial: `dd99663`, `cdf9fb1`.

---
*Phase: 29-scoring-categor-a-social-retiro-de-onpage-05*
*Completed: 2026-08-01*
