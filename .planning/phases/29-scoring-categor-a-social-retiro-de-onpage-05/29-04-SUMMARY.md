---
phase: 29-scoring-categor-a-social-retiro-de-onpage-05
plan: 04
subsystem: docs
tags: [documentacion, key-decisions, gate-de-fase, turborepo, typecheck, vitest]

# Dependency graph
requires:
  - phase: 29-scoring-categor-a-social-retiro-de-onpage-05
    provides: "el rebalanceo de pesos (29-01), el retiro de ONPAGE-05 (29-02) y los guardarrailes de exhaustividad (29-03), que son lo que esta fila documenta"
provides:
  - "fila de Key Decisions en `.planning/PROJECT.md` con el corte de version v1.6 (pesos rebalanceados + check retirado)"
  - "la no comparabilidad de scores pre y post v1.6 declarada en el registro de decisiones del proyecto, no solo en docblocks de codigo"
  - "el falso 'Resuelto' de la primera auditoria posterior al corte documentado y explicitamente no compensado con logica de cap ni de filtrado"
  - "gate de fase verificado sin cache: 16 tareas de typecheck y 13 de test en verde, lockfile y esquema de base de datos intactos"
affects: [30-checks-meta-tags-social, 31-validacion-og-image, 32-panel-preview-social]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "el corte de version se escribe en tres sitios que cuentan la misma historia: el docblock de la constante que cambio, el docblock del guardarrail que protege el retiro, y la fila de Key Decisions que un lector futuro va a encontrar sin leer codigo"
    - "gate de fase con `--force`: una corrida cacheada de turbo da un verde falso sobre un cambio de tipos que rompe compilacion en paquetes que no se tocaron"

key-files:
  created: []
  modified:
    - .planning/PROJECT.md

key-decisions:
  - "Phase 29: el corte de version v1.6 se registra como UNA fila de Key Decisions que junta el rebalanceo de pesos y el retiro del check, no como dos filas separadas: son la misma decision de producto y sus consecuencias en el diff son inseparables"
  - "Phase 29: la fila declara explicitamente que el falso 'Resuelto' NO se capa ni se filtra en esta fase — capar o filtrar es alcance de producto de una fase con UI (Phase 32), y dejarlo escrito es la unica compensacion honesta mientras tanto"
  - "Phase 29: la categoria social vacia durante la ventana entre Phase 29 y Phase 30 queda registrada como estado conocido y deliberado, para que no se reporte como defecto"

patterns-established:
  - "Una decision que cambia el baseline de una metrica historica necesita su fila en el registro de decisiones del proyecto, no solo un comentario en el archivo que cambio: el comentario lo lee quien ya esta en ese archivo, la fila la encuentra quien se pregunta por que el score se movio"

requirements-completed: [SCORE-02, SOCIAL-09]

coverage:
  - id: D1
    description: "El corte de version queda documentado en el registro de decisiones del proyecto: `.planning/PROJECT.md` tiene una fila de Key Decisions que nombra el rebalanceo de pesos y el retiro del check"
    requirement: SCORE-02
    verification:
      - kind: other
        ref: "`grep -c '^| ' .planning/PROJECT.md` = 30 (era 29); `grep -Ec '^\\| .*v1\\.6.*\\|'` = 1 (era 0); `grep -Eo '0\\.10|0\\.05|0\\.15' | sort -u | wc -l` = 3 (era 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "La fila declara que los scores generales anteriores a v1.6 no son directamente comparables con los posteriores"
    requirement: SCORE-02
    verification:
      - kind: other
        ref: "`grep -Eci 'no (son )?directamente comparables' .planning/PROJECT.md` = 1 (era 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "La consecuencia del corte en el diff queda escrita: la primera auditoria posterior al corte marca como resueltos hasta un fingerprint por pagina que el usuario nunca corrigio"
    requirement: SOCIAL-09
    verification:
      - kind: other
        ref: "`grep -ci 'resuelto' .planning/PROJECT.md` = 4 (baseline 3, las tres previas no relacionadas con esta fase)"
        status: pass
    human_judgment: false
  - id: D4
    description: "La fase NO agrega logica de cap ni de filtrado sobre `resolvedIssues` en `packages/report-model/src/build.ts` ni en la pagina de reporte"
    requirement: SOCIAL-09
    verification:
      - kind: other
        ref: "`git diff --stat packages apps` vacio en toda la ejecucion del plan; el unico archivo modificado es `.planning/PROJECT.md`"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cierre de fase verificable: typecheck y suite completos del monorepo en verde, sin cache"
    requirement: SCORE-02
    verification:
      - kind: other
        ref: "`pnpm typecheck --continue --force` = 16 successful, 16 total, 0 cached; `pnpm test --continue --force` = 13 successful, 13 total, 0 cached"
        status: pass
    human_judgment: false
  - id: D6
    description: "La fase no altero el arbol de dependencias ni el esquema de base de datos"
    requirement: SOCIAL-09
    verification:
      - kind: other
        ref: "`git diff --stat pnpm-lock.yaml` y `git diff --stat packages/db` sin salida"
        status: pass
    human_judgment: false
  - id: D7
    description: "La categoria social se muestra vacia durante la ventana de una fase, hasta que Phase 30 aterrice los checks — estado conocido y aceptado"
    requirement: SOCIAL-09
    verification: []
    human_judgment: true
    rationale: "Es una declaracion de estado aceptado, no un comportamiento verificable por test. Su registro escrito en la fila de Key Decisions es la evidencia; que un lector futuro la interprete como estado conocido y no como defecto es juicio editorial."

# Metrics
duration: 2min
completed: 2026-08-01
status: complete
---

# Phase 29 Plan 04: Corte de version v1.6 documentado y gate de fase Summary

**El rebalanceo de pesos y el retiro de ONPAGE-05 quedan registrados como una decision de proyecto con sus tres consecuencias declaradas por escrito, y el monorepo completo compila y pasa tests sin cache con el lockfile y el esquema intactos**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-01T23:23:22Z
- **Completed:** 2026-08-01T23:25:24Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- La tabla Key Decisions de `.planning/PROJECT.md` gana exactamente una fila, la unica del archivo que menciona `v1.6` y los tres pesos que cambian. Cierra el tercer criterio de exito del ROADMAP para esta fase, que es documental y no de codigo: los planes 29-01 y 29-02 dejaron la nota en los docblocks de los dos archivos que cambiaron, pero un docblock lo lee quien ya esta dentro de ese archivo. La fila la encuentra quien se pregunta meses despues por que el score general de un sitio se movio sin que el sitio cambiara.
- La consecuencia mas incomoda del corte queda escrita en vez de descubrirse en produccion: el check retirado emitia siempre una fila por pagina, nunca cero, asi que la primera auditoria posterior al corte de un sitio ya auditado va a marcar como resueltos hasta un fingerprint por pagina que el usuario no corrigio. El diff compara por fingerprint y no distingue "el usuario lo arreglo" de "el check dejo de existir".
- La fila declara explicitamente que eso NO se capa ni se filtra en esta fase, y por que: capar o filtrar es alcance de producto de una fase con UI. Mientras tanto, que el corte este escrito y sea recuperable al leer un reporte posterior es la unica compensacion honesta.
- La ventana entre Phase 29 y Phase 30 con la categoria social sin datos queda registrada como estado deliberado, para que no entre como defecto en una revision.
- El gate de fase corrio completo y sin cache. Es el unico mecanismo que detecta los tres sitios donde ampliar el union `Category` rompe compilacion en paquetes que la fase no toco; una corrida cacheada habria dado verde sin compilar nada.

## Task Commits

1. **Tarea 1: registrar el corte de version v1.6 en Key Decisions de PROJECT.md** - `b18266d` (docs)
2. **Tarea 2: gate de fase — typecheck y suite completos sin cache** - sin commit propio: es una tarea de verificacion que no modifica archivos (`<files>` del plan: ninguno). Sus resultados quedan transcritos abajo.

## Files Created/Modified

- `.planning/PROJECT.md` - una fila nueva al final de la tabla Key Decisions, con el formato de tres columnas existente. La columna Decision nombra el paso de cinco a seis categorias con `social` en 0.10 tomando peso de on-page (0.15 a 0.10) y de datos estructurados (0.10 a 0.05), mas el retiro de `ONPAGE-05`. La columna Rationale explica que la categoria Meta Tags / Social absorbe la senal de Open Graph y que dejar el check viejo activo la duplicaria en dos categorias del score. La columna Outcome declara las tres consecuencias: no comparabilidad de scores pre y post v1.6, ausencia de migracion de datos con `packages/cms-adapters` sirviendo su copy de fix en tiempo de lectura, y el falso "Resuelto" no capado. Ninguna otra seccion del archivo se toco.

## Decisions Made

- Una sola fila en vez de dos (una para los pesos, otra para el retiro del check). Son la misma decision de producto: el check se retira porque la categoria nueva absorbe su senal, y las dos mitades comparten exactamente el mismo corte de version y las mismas consecuencias en el diff. Separarlas habria obligado a repetir el mismo Outcome dos veces y a que un lector reconstruyera la relacion.
- El texto de la fila reusa deliberadamente el vocabulario de los dos docblocks que ya existen (`packages/scoring/src/overallScore.ts` y `packages/checks/src/registry.test.ts`): "corte de version", "no directamente comparables", "sin migracion". Los tres textos cuentan la misma historia con las mismas palabras, asi que si los pesos vuelven a moverse, un `grep` de `v1.6` encuentra los tres sitios que hay que actualizar juntos.
- La palabra "Resuelto" va entrecomillada y con mayuscula inicial en la fila, igual que la usa la UI del reporte, para que quien lea la fila despues de ver ese estado en pantalla haga la conexion sin traducir.

## Gate de fase — salida observada

| Comando | Resultado |
|---------|-----------|
| `pnpm typecheck --continue --force` | `Tasks: 16 successful, 16 total` / `Cached: 0 cached, 16 total` — exit 0, sin marca `FULL TURBO` |
| `pnpm test --continue --force` | `Tasks: 13 successful, 13 total` / `Cached: 0 cached, 13 total` — exit 0, sin marca `FULL TURBO` |
| `git diff --stat pnpm-lock.yaml` | sin salida (arbol de dependencias intacto) |
| `git diff --stat packages/db` | sin salida (esquema intacto; `Issue.category` es `String`, no enum, asi que la fase no requiere `pnpm db:push`) |
| `test ! -f packages/checks/src/checks/onpage/openGraph.ts` | exit 0 |
| `grep -c 'Meta Tags / Social' packages/export/src/labels.ts` | 1 |
| `grep -c 'Meta Tags / Social' apps/web/app/components/ui/labels.ts` | 1 |
| paridad byte a byte de las dos etiquetas (`diff` de los dos `grep -o`) | identicas |

## Verificacion de la Tarea 1 — valores medidos

| Medicion | Baseline en HEAD | Despues de la edicion | Criterio |
|----------|------------------|-----------------------|----------|
| `grep -c '^| ' .planning/PROJECT.md` | 29 | 30 | igualdad exacta |
| `grep -Ec '^\| .*v1\.6.*\|'` | 0 | 1 | igualdad exacta |
| `grep -Eo '0\.10|0\.05|0\.15' \| sort -u \| wc -l` | 0 | 3 | igualdad exacta |
| `grep -Eci 'no (son )?directamente comparables'` | 0 | 1 | >= 1 |
| `grep -ci 'resuelto'` | 3 | 4 | >= 4 |
| `git diff --stat .planning/PROJECT.md` | — | `1 file changed, 1 insertion(+)` | solo lineas agregadas |
| `git diff --stat packages apps` | — | vacio | cambio exclusivamente documental |

## Deviations from Plan

None - el plan se ejecuto exactamente como estaba escrito.

## Issues Encountered

- Ninguna friccion. Cero paquetes instalados, cero cambios de esquema, cero cambios en `packages` ni en `apps`.
- La Tarea 2 no produce commit porque no modifica archivos. Se documenta explicitamente para que la ausencia de un segundo commit de tarea no se lea como una tarea saltada.
- Quedan sin trackear en el arbol tres rutas ajenas a este plan (`.planning/phases/29-.../29-PATTERNS.md`, una entrada de `.planning/research/.cache/` y `scratchpad/`), mas una modificacion no committeada de `.planning/config.json`. Son artefactos del paso de planeacion y del orquestador, no de esta ejecucion, asi que no se tocaron.

## Threat Model — dispositions verificadas

- **T-29-05 (accept, salida enganosa no adversarial):** aceptado con racional documentado y compensacion entregada. La compensacion prometida en el plan era exactamente la fila de Key Decisions de la Tarea 1, que ahora existe y declara el efecto en el diff con la palabra que la UI usa para ese estado. Verificado que la fase no introdujo cap ni filtrado: `git diff --stat packages apps` vacio, o sea que `packages/report-model/src/build.ts` y la pagina de reporte quedaron sin tocar.
- **T-29-03 (accept, DoS por clausula `IN` sin `take`):** sin cambios. La consulta de `build.ts` sigue como estaba; el tamano de la lista escala con la cuota propia del producto (500 URLs por auditoria), no con entrada de un atacante. Queda registrada como deuda conocida para Phase 32, que si tiene UI y puede introducir el cap junto con el cambio de presentacion.
- **T-29-SC (accept, tampering por instalacion de paquetes):** confirmado, cero instalaciones. `git diff --stat pnpm-lock.yaml` vacio.

## Prohibicion del plan — verificada

`MUST NOT presentar como logro del usuario los issues que quedan marcados como resueltos solo porque cambio el catalogo de checks`: **respetada**. La fase no agrego ninguna logica que celebre esos fingerprints ni que los presente como mejora. La unica accion tomada es la opuesta: dejar por escrito, en el registro que un lector futuro va a consultar, que esos "Resuelto" no los gano el usuario. La verificacion es de juicio, no automatizable: el criterio es que alguien que lea la fila sin haber vivido la fase entienda la distincion, y el texto la hace explicita ("una fila 'Resuelto' por pagina que el usuario no corrigio").

## User Setup Required

None - no hay configuracion de servicios externos ni cambios de esquema; no corre `pnpm db:push`.

## Next Phase Readiness

- Phase 29 queda cerrada: los tres criterios de exito del ROADMAP estan cubiertos (sexta categoria con pesos rebalanceados por 29-01, retiro de ONPAGE-05 sin duplicados por 29-02 con guardarrailes por 29-03, y el corte de version documentado por este plan).
- Phase 30 arranca sobre un catalogo limpio y un modelo de scoring estable: puede definir `SOCIAL-01..08` sabiendo que sus issues llegan vivos al reporte web y a los tres exports, y que ninguna categoria omitida en un array va a desaparecer en silencio.
- Herencia explicita para Phase 30: la verificacion cruzada de fingerprint entre el check retirado y los checks nuevos, que esta fase no podia hacer porque esos checks no existian.
- Herencia explicita para Phase 32: la logica de cap o filtrado del falso "Resuelto", y el `take` faltante en la consulta de resueltos de `build.ts` (T-29-03).

## Self-Check: PASSED

- `.planning/PROJECT.md` existe en disco con la fila nueva (30 filas de tabla, 1 con `v1.6`).
- `.planning/phases/29-scoring-categor-a-social-retiro-de-onpage-05/29-04-SUMMARY.md` existe en disco.
- El commit de la Tarea 1 existe en el historial: `b18266d`.
- La Tarea 2 no tiene commit por diseno (tarea de verificacion sin archivos modificados), documentado arriba.

---
*Phase: 29-scoring-categor-a-social-retiro-de-onpage-05*
*Completed: 2026-08-01*
