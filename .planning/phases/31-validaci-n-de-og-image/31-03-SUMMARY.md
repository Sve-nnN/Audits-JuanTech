---
phase: 31-validaci-n-de-og-image
plan: 03
subsystem: checks
tags: [ssrf, seguridad, red, concurrencia, tech-12, tech-13, vitest]

requires:
  - phase: 31-01
    provides: "assertPublicDestination (ssrfGuard.ts) y mapWithConcurrency + DEFAULT_NETWORK_CONCURRENCY (concurrency.ts)"
provides:
  - "checkOne valida el destino con el helper compartido antes de abrir cualquier conexion: los tres NetworkCheck del catalogo (TECH-12, TECH-13, IMG-01) pasan por la misma defensa"
  - "UNVERIFIABLE_DESTINATION_REASON como unico contrato entre el verificador de enlaces y sus dos checks consumidores"
  - "TECH-12 y TECH-13 enrutan el destino rechazado a una rama informativa de severidad ok con subtipo de ambito propio, nunca a la rama de roto"
  - "checkLinks consume el unico runner de concurrencia de la capa de red; se eliminaron la copia incrustada y la constante local"
  - "linkChecker.ts con su primera cobertura directa: 6 casos"
affects: [capa de red de checks, futuras fases que toquen TECH-12 o TECH-13, cualquier fase que cierre la deuda de redirecciones]

tech-stack:
  added: []
  patterns:
    - "Defensa de destino aplicada en el punto unico de paso de cada transporte de red, antes del primer fetch"
    - "El motivo del rechazo viaja como constante exportada, no como cadena escrita a mano en cada lado"
    - "Un destino que la defensa rechazo se reporta como no verificable (severidad ok) con subtipo de ambito propio, nunca como defecto"

key-files:
  created:
    - packages/checks/src/checks/network/linkChecker.test.ts
  modified:
    - packages/checks/src/checks/network/linkChecker.ts
    - packages/checks/src/checks/network/brokenExternalLinks.ts
    - packages/checks/src/checks/network/brokenExternalLinks.test.ts
    - packages/checks/src/checks/network/brokenResources.ts

key-decisions:
  - "Un solo motivo publico para los dos veredictos internos de la defensa (no publico y no resoluble): al lector del reporte se le dice que no pudimos verificar el destino, no cual de las dos razones internas se cumplio. Los dos consumidores comparan contra una sola constante en lugar de contra un vocabulario de dos entradas."
  - "La validacion va fuera del bucle de metodos de checkOne: la URL es la misma en el intento HEAD y en el GET, y resolverla dos veces duplica la consulta al sistema de nombres sin aportar nada."
  - "La condicion del destino rechazado se coloca antes de isBlockedStatus en TECH-12, porque esa funcion devuelve falso ante un status nulo y el rechazo llega justamente con status nulo: puesta despues, el caso caeria en la rama de enlace roto."
  - "Riesgo residual T-31-02 aceptado y registrado en docblock: checkOne conserva el modo de redireccion automatico, asi que la defensa cubre el destino inicial y no cada salto."

patterns-established:
  - "Contrato por constante exportada: cuando dos modulos tienen que reconocer el mismo caso, el reconocedor exporta la constante y el consumidor la importa"
  - "Un unico runner de concurrencia para toda la capa de red, con el limite tomado de la constante compartida"

requirements-completed: [IMG-01, IMG-02]

coverage:
  - id: D1
    description: "checkOne valida el destino con assertPublicDestination antes del bucle de metodos: un destino no publico no produce ninguna llamada a fetch"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/linkChecker.test.ts#ssrf: un destino rechazado por la defensa no abre ni una conexión"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/linkChecker.test.ts#ssrf: un destino aceptado por la defensa sigue el flujo normal"
        status: pass
    human_judgment: false
  - id: D2
    description: "checkLinks consume el runner compartido preservando el orden de entrada y el limite efectivo de 12"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/linkChecker.test.ts#orden: cinco URLs resueltas al revés devuelven resultados alineados con la entrada"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/linkChecker.test.ts#concurrencia: nunca hay más peticiones en vuelo que el límite compartido"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*[/*]' packages/checks/src/checks/network/linkChecker.ts | grep -c 'async function worker' == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "El comportamiento observable previo de checkLinks no cambio: HEAD con reintento GET, fallo con status y exito"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/linkChecker.test.ts#estado actual: un status de error en los dos métodos devuelve fallo con ese status"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/linkChecker.test.ts#estado actual: una respuesta correcta devuelve éxito en el primer método"
        status: pass
      - kind: unit
        ref: "pnpm --filter @auditor/checks test (43 archivos, 297 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "TECH-12 reporta el destino rechazado como fila informativa y cero filas de enlace roto, con fingerprint propio"
    requirement: "IMG-02"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/brokenExternalLinks.test.ts#reports a destination rejected by the guard as informational, never as broken"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/brokenExternalLinks.test.ts#keeps the guard-rejected row and a broken row on separate fingerprints"
        status: pass
    human_judgment: false
  - id: D5
    description: "TECH-13 gana su primera rama informativa por resultado con el subtipo resource-unverifiable-destination"
    requirement: "IMG-02"
    verification:
      - kind: other
        ref: "grep -c 'resource-unverifiable-destination' packages/checks/src/checks/network/brokenResources.ts == 1; grep -c 'severity: \"ok\"' == 2; pnpm typecheck"
        status: pass
    human_judgment: true
    rationale: "El enrutamiento de TECH-13 quedo verificado por grep y por typecheck, pero brokenResources.ts no tiene archivo de test propio en el repositorio, asi que ningun caso ejecuta esa rama. La equivalencia con la rama ya probada de TECH-12 es un juicio, no una asercion."
  - id: D6
    description: "La deuda de redirecciones de TECH-12 y TECH-13 (T-31-02) queda registrada como deuda conocida y no como omision"
    verification: []
    human_judgment: true
    rationale: "Es una decision de alcance documentada en prosa dentro del codigo. Ningun test puede afirmar que una limitacion esta bien registrada; lo que se verifica es que el riesgo residual sigue aceptado a conciencia."

duration: 12 min
completed: 2026-08-03
status: complete
---

# Phase 31 Plan 03: Defensa de destino en el verificador de enlaces Summary

**`checkOne` valida el destino con el helper compartido antes del primer fetch, `checkLinks` pasa al unico runner de concurrencia de la capa de red, y TECH-12 y TECH-13 reportan el destino rechazado como no verificable con severidad informativa en lugar de como roto.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-03T16:39:00Z
- **Completed:** 2026-08-03T16:51:00Z
- **Tasks:** 2
- **Files modified:** 5 (1 creado, 4 modificados)

## Accomplishments

- El agujero que la ola 1 cerro para la imagen social queda cerrado tambien por los otros dos caminos que ya corrian en produccion: los tres `NetworkCheck` del catalogo (TECH-12, TECH-13 e IMG-01) validan el destino con el mismo `assertPublicDestination` antes de abrir conexion.
- Un destino rechazado por la defensa no produce ninguna llamada a `fetch`. La asercion del test es sobre la llamada de red, no sobre el valor devuelto: si la defensa corriera despues, el resultado seria identico pero la conexion ya estaria abierta.
- El rechazo se reporta como **no verificable** (severidad `ok`) y nunca como roto, en los dos checks consumidores, cada uno con su propio subtipo de ambito para que los fingerprints no colapsen con ninguna fila existente.
- La capa de red queda con un solo runner de concurrencia: se eliminaron el runner incrustado de `checkLinks` y su constante local, reemplazados por `mapWithConcurrency` con `DEFAULT_NETWORK_CONCURRENCY`.
- `linkChecker.ts` pasa de cero cobertura a **6 casos propios**, incluidos los tres etiquetados que el plan pidio verificar por separado.

## Task Commits

Cada tarea se commiteo atomicamente:

1. **Tarea 1: defensa de destino y runner compartido dentro del verificador de enlaces** — `526625f` (feat)
2. **Tarea 2: el destino rechazado se reporta como no verificable, nunca como roto** — `a6c68bb` (feat)

## Files Created/Modified

- `packages/checks/src/checks/network/linkChecker.ts` — `checkOne` valida el destino antes del bucle de metodos; nueva constante exportada `UNVERIFIABLE_DESTINATION_REASON`; `checkLinks` delega en el runner compartido; se borraron el runner incrustado y `const CONCURRENCY`.
- `packages/checks/src/checks/network/linkChecker.test.ts` (nuevo) — primera cobertura directa del modulo: 2 casos `ssrf`, 1 `orden`, 1 `concurrencia` y 2 de regresion del estado actual.
- `packages/checks/src/checks/network/brokenExternalLinks.ts` — rama informativa nueva con ambito `external-link-unverifiable-destination:{url}`, colocada antes de `isBlockedStatus`.
- `packages/checks/src/checks/network/brokenExternalLinks.test.ts` — dos casos nuevos que importan la constante del motivo en lugar de escribir la cadena.
- `packages/checks/src/checks/network/brokenResources.ts` — primera rama informativa por resultado de este check, con ambito `resource-unverifiable-destination:{url}`.

## Salida de los comandos verificados

Los tres comandos etiquetados que pide el plan, mas la suite y el typecheck de cierre:

| Comando | Resultado |
|---|---|
| `vitest run src/checks/network/linkChecker.test.ts` | 1 archivo, **6 casos**, todos en verde |
| `vitest run src/checks/network/linkChecker.test.ts -t "ssrf"` | codigo 0 |
| `vitest run src/checks/network/linkChecker.test.ts -t "orden"` | codigo 0 |
| `vitest run src/checks/network/linkChecker.test.ts -t "concurrencia"` | codigo 0 |
| `vitest run src/checks/network/brokenExternalLinks.test.ts` | 1 archivo, 5 casos, todos en verde |
| `pnpm --filter @auditor/checks test` | 43 archivos, **297 casos**, todos en verde (eran 295 antes de la Tarea 2) |
| `pnpm test` (raiz) | 14 tareas, todas en verde |
| `pnpm typecheck` (raiz) | 17 tareas, todas en verde |
| `pnpm assert:web-boundary` | PASS |

El `git diff 526625f~1..HEAD --name-only` devuelve exactamente los 5 archivos del plan: `imageProbe.ts`, `ogImageNetwork.ts`, `concurrency.ts`, `ssrfGuard.ts` e `index.ts` quedaron intactos, asi que la ola 2 no invadio los archivos del plan hermano.

## Decisions Made

- **Un solo motivo publico para los dos veredictos internos.** `ssrfGuard.ts` distingue "destino no público" de "destino no resoluble", pero hacia afuera los dos colapsan en `UNVERIFIABLE_DESTINATION_REASON` = `"destino no verificable"`. Al lector del reporte se le dice que no pudimos verificar el destino; cual de las dos condiciones internas se cumplio no cambia nada de lo que puede hacer al respecto, y un vocabulario de dos entradas obligaria a los dos consumidores a reconocer las dos.
- **La validacion va fuera del bucle de metodos.** La URL es la misma en el intento `HEAD` y en el `GET`; resolverla dos veces duplica la consulta al sistema de nombres sin aportar nada.
- **La condicion nueva de TECH-12 va antes de `isBlockedStatus`.** Esa funcion devuelve falso cuando el status es nulo y el rechazo de la defensa llega justamente con status nulo: puesta despues, el caso caeria en la rama de enlace roto, que es lo que este plan existe para impedir. La misma logica aplica al orden relativo elegido en TECH-13.

## Deuda conocida registrada: redirecciones de TECH-12 y TECH-13 (T-31-02)

Transcripcion de lo que quedo escrito en `linkChecker.ts`, para que la proxima fase que toque la capa de red lo encuentre sin tener que abrir el archivo:

> Deuda conocida, no olvido (amenaza T-31-02): esta validacion cubre el destino inicial y no cada salto, porque el fetch de abajo sigue con el modo de redireccion automatico que TECH-12 y TECH-13 usan hoy en produccion. Cerrar tambien los saltos exige el bucle manual de redirecciones que `imageProbe.ts` ya tiene, y eso es reescribir el transporte de dos checks en produccion: queda para la fase que toque la capa de red.

El vector queda cerrado por completo en el camino que esta fase introduce (el sondeo de imagen), que es el unico donde el destino lo elige un valor de meta tag.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** ninguno. Los dos comportamientos que el plan definia como no negociables (cero llamadas de red ante un rechazo, y cero filas de roto para un destino rechazado) quedaron afirmados por tests, no por inspeccion.

## Known Stubs

Ninguno.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- La ola 2 queda cerrada: 31-02 (transporte del sondeo de imagen) y 31-03 (defensa en el verificador de enlaces) estan los dos en verde y no se pisaron ningun archivo.
- La fase puede avanzar a lo que siga en el roadmap. La unica pieza que este plan deja abierta a proposito es la deuda de redirecciones de TECH-12 y TECH-13, documentada arriba y en el registro de amenazas como riesgo residual aceptado.
- `brokenResources.ts` sigue sin archivo de test propio en el repositorio: su rama nueva quedo verificada por grep y typecheck, no por un caso ejecutado. Es candidata natural para la primera fase que quiera subir la cobertura de la capa de red.

## Self-Check: PASSED

- Los 5 archivos declarados existen en disco.
- Los dos commits de tarea (`526625f`, `a6c68bb`) existen en el historial.
- Los criterios de aceptacion de las dos tareas se re-corrieron y dieron los valores exactos que pide el plan.

---
*Phase: 31-validaci-n-de-og-image*
*Completed: 2026-08-03*
