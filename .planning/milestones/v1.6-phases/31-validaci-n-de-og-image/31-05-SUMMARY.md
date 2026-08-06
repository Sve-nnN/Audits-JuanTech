---
phase: 31-validaci-n-de-og-image
plan: 05
subsystem: checks
tags: [guardarrail, integracion, fingerprints, registro, mutacion, vitest, cierre-de-fase]

requires:
  - phase: 31-03
    provides: "defensa de destino aplicada en los tres NetworkCheck del catalogo"
  - phase: 31-04
    provides: "las nueve ramas de clasificacion de IMG-01 con sus nueve subtipos de ambito"
provides:
  - "registry.test.ts con sus dos primeros casos de red activa: IMG-01 corre por el camino de produccion y los tres checks de la capa de red emiten"
  - "social-guardrail.test.ts con un bloque nuevo que cubre al noveno identificador de la categoria social, incluido el caso de dos ramas sobre la misma pagina"
  - "Los dos guardarrailes nuevos demostrados por mutacion y reversion"
affects: [cualquier fase futura que agregue un NetworkCheck (queda cubierta por el guardarrail de registro), Phase 32]

tech-stack:
  added: []
  patterns:
    - "Un caso con la red activa por cada camino de registro que el catalogo tiene, con las puertas de red simuladas a nivel de modulo"
    - "Guarda anti vacuidad como primer caso de todo bloque de guardarrail, para que los casos siguientes no pasen por vacuidad"
    - "Prueba de dientes por mutacion y reversion: un guardarrail que nunca se vio en rojo es indistinguible de un comparador roto"

key-files:
  created: []
  modified:
    - packages/checks/src/registry.test.ts
    - packages/checks/src/checks/social/social-guardrail.test.ts

key-decisions:
  - "Se simulan tres modulos y no dos: al sondeo de imagen y a la defensa de destino se suma el verificador de enlaces, porque el caso hermano necesita que TECH-12 y TECH-13 emitan fila y sin simularlo saldrian a internet."
  - "El bloque nuevo del guardarrail social simula ademas la funcion de fetch global: llmsTxtCheck es un NetworkCheck del grupo AEO que pide por su cuenta, y sin el stub activar la red haria que ese archivo saliera a internet de verdad."
  - "El escenario del bloque nuevo es una imagen a la vez chica y pesada a proposito: es el unico caso donde IMG-01 emite DOS filas sobre una misma pagina, que es exactamente el que puede autocolisionar."

requirements-completed: [IMG-01, IMG-02, IMG-03, IMG-04]

coverage:
  - id: D1
    description: "IMG-01 corre por el camino de produccion con la red activa, emite categoria social con el pageId de la pagina, y dedupea la peticion tambien ahi"
    requirement: "IMG-01"
    verification:
      - kind: integration
        ref: "packages/checks/src/registry.test.ts#emite filas de IMG-01 con categoría social y el pageId de la página, y dedupea la petición"
        status: pass
    human_judgment: false
  - id: D2
    description: "El conjunto de identificadores emitidos con la red activa contiene los tres checks de la capa de red"
    requirement: "IMG-01"
    verification:
      - kind: integration
        ref: "packages/checks/src/registry.test.ts#emite filas de los tres checks de la capa de red, lo que convierte el registro en invariante"
        status: pass
    human_judgment: false
  - id: D3
    description: "El guardarrail de registro detecta el defecto que existe para detectar (mutacion A: entrada quitada del array del barrel)"
    requirement: "IMG-01"
    verification:
      - kind: manual
        ref: "mutacion aplicada y revertida; los dos casos del bloque de red activa se pusieron en rojo, transcrito en el SUMMARY"
        status: pass
    human_judgment: false
  - id: D4
    description: "La categoria social emite nueve identificadores distintos con la red activa, y ningun fingerprint de IMG-01 colisiona con los ocho de la fase 30, consigo mismo, ni con el del check retirado"
    requirement: "IMG-02"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#emite filas del check de red y nueve identificadores distintos en la categoría social"
        status: pass
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#no comparte ningún fingerprint con los ocho checks de la fase 30 sobre la misma URL"
        status: pass
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#no repite ningún fingerprint dentro de su propia colección, con dos ramas disparadas"
        status: pass
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#no emite ningún fingerprint igual al del check retirado ONPAGE-05 sobre la misma URL"
        status: pass
    human_judgment: false
  - id: D5
    description: "El diff entre auditorias no colapsa ninguna fila social con la red activa"
    requirement: "IMG-02"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#no colapsa ninguna fila social en el diff entre auditorías con la red activa"
        status: pass
    human_judgment: false
  - id: D6
    description: "El guardarrail de colision detecta el defecto que existe para detectar (mutacion B: subtipo quitado de la composicion del fingerprint)"
    requirement: "IMG-02"
    verification:
      - kind: manual
        ref: "mutacion aplicada y revertida; el caso de repetidos y el del diff se pusieron los dos en rojo, transcrito en el SUMMARY"
        status: pass
    human_judgment: false
  - id: D7
    description: "Ningun test del paquete abre una conexion de red real"
    verification:
      - kind: other
        ref: "3 vi.mock en registry.test.ts y 2 en social-guardrail.test.ts, mas vi.stubGlobal('fetch') en los dos; registry.test.ts corre en 0.7s"
        status: pass
    human_judgment: true
    rationale: "Se verifica que las cuatro puertas conocidas (probeImages, checkLinks, assertPublicDestination y fetch) estan simuladas y que el tiempo de corrida es incompatible con conexiones reales. Que no exista una quinta puerta no descubierta es un juicio sobre el codigo leido, no una asercion que un test pueda hacer."
  - id: D8
    description: "El gate de cierre de fase pasa: suite completa del monorepo, comprobacion de tipos y chequeo de frontera"
    verification:
      - kind: other
        ref: "pnpm test (14 tareas), pnpm typecheck (17 tareas), pnpm assert:web-boundary (PASS)"
        status: pass
    human_judgment: false

duration: 9 min
completed: 2026-08-03
status: complete
---

# Phase 31 Plan 05: Guardarrailes de integracion y cierre de fase Summary

**`IMG-01` esta probado como registrado y corriendo por el camino de produccion con los checks de red activos, sus fingerprints estan probados como no colisionantes incluso con dos ramas sobre la misma pagina, y los dos guardarrailes nuevos se vieron en rojo antes de darlos por buenos.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-03T21:04:00Z
- **Completed:** 2026-08-03T21:13:00Z
- **Tasks:** 3
- **Files modified:** 2 (los dos de test; cero archivos de produccion)

## Accomplishments

- `registry.test.ts` gana sus **dos primeros casos con la red activa**. Hasta ahora sus cuatro casos la apagaban, asi que la capa de red —que se registra por su propio barrel y su propio spread— no la recorria nadie. Un check agregado al barrel pero no al catalogo, o al reves, pasaba completamente desapercibido.
- El primer caso afirma que `IMG-01` emite filas de la categoria social **con el pageId de la pagina**, que es lo que prueba que el fan-out por pagina llego vivo hasta el catalogo, y que el dedupe funciona tambien por el camino de produccion (una llamada, un arreglo de una URL).
- El caso hermano convierte el registro en invariante y no en casualidad: afirma que los **tres** identificadores de la capa de red emiten fila.
- El guardarrail de fingerprints sociales cubre al **noveno identificador**, con un escenario elegido a proposito: una imagen a la vez chica y pesada, que es el unico caso donde `IMG-01` emite dos filas sobre la misma pagina y por lo tanto el unico capaz de autocolisionar.
- El bloque original de la fase 30 quedo **intacto**, aserto de ocho identificadores incluido. Corre con la red apagada, asi que no se rompe al sumar el check nuevo, y es la guarda anti vacuidad de todo el archivo.
- Los dos guardarrailes se **vieron en rojo** con una mutacion deliberada cada uno, revertida por completo. El arbol quedo limpio.
- El paquete de checks pasa de 318 a **325 casos**.

## Prueba de dientes A: guardarrail de registro

**Mutacion:** se quito `ogImageNetworkCheck` del array de `packages/checks/src/checks/network/index.ts`, dejando el import y el re-export nominal intactos — exactamente la forma que toma este defecto en un merge mal resuelto.

**Fallo observado** (`vitest run src/registry.test.ts`, 2 de 10 casos en rojo):

```
FAIL  src/registry.test.ts > registry — runAllChecks con los checks de red activos
      > emite filas de IMG-01 con categoría social y el pageId de la página, y dedupea la petición
AssertionError: expected 0 to be greater than or equal to 1
 ❯ src/registry.test.ts:308:25
    expect(rows.length).toBeGreaterThanOrEqual(1);

FAIL  src/registry.test.ts > registry — runAllChecks con los checks de red activos
      > emite filas de los tres checks de la capa de red, lo que convierte el registro en invariante
AssertionError: expected [ 'ONPAGE-01', 'ONPAGE-02', …(26) ] to include 'IMG-01'
 ❯ src/registry.test.ts:340:23
    expect(emitted).toContain(id);
```

**Reversion:** `git checkout -- packages/checks/src/checks/network/index.ts`. `git diff --stat` sobre el archivo devuelve vacio.

## Prueba de dientes B: guardarrail de colision

**Mutacion:** se cambio la composicion del fingerprint de `ogImageNetwork.ts`, de `pageFingerprint(\`${CHECK_ID}:${finding.subtype}\`, affected.url)` a `pageFingerprint(CHECK_ID, affected.url)`, de modo que las dos ramas disparadas sobre la misma pagina producen la misma clave.

**Fallo observado** (`vitest run src/checks/social/social-guardrail.test.ts`, 2 de 11 casos en rojo). Salio por los dos casos correctos —el de repetidos dentro de la propia coleccion y el del diff— y **no** por el de interseccion, que es lo esperado: la colision es interna al check, no cruza la frontera con los ocho de la fase 30.

```
FAIL  ... > no repite ningún fingerprint dentro de su propia colección, con dos ramas disparadas
 ❯ src/checks/social/social-guardrail.test.ts:300:86
    expect(findDuplicateFingerprints(networkSocialIssues.map((i) => i.fingerprint))).toEqual([]);

FAIL  ... > no colapsa ninguna fila social en el diff entre auditorías con la red activa
AssertionError: expected 9 to be 10 // Object.is equality
 ❯ src/checks/social/social-guardrail.test.ts:314:43
    expect(diff.statusByFingerprint.size).toBe(socialIssues.length);
```

El `9 to be 10` es literalmente la colision: diez filas sociales entran al diff y salen nueve entradas, porque dos colapsaron en una. Es el modo de fallo silencioso contra el que existe el archivo entero.

**Reversion:** `git checkout -- packages/checks/src/checks/network/ogImageNetwork.ts`. Las dos mutaciones se hicieron **de a una**, con reversion completa entre ellas.

## Los nueve subtipos de ambito de IMG-01

`og-image-unverifiable`, `og-image-unreachable`, `og-image-svg`, `og-image-not-image`, `og-image-undetermined`, `og-image-too-small`, `og-image-suboptimal`, `og-image-heavy`, `og-image-too-large`.

Identificadores distintos de la categoria social **con la red activa: 9** (los ocho de `pageChecks` mas `IMG-01`).

## Task Commits

1. **Tarea 1: el catalogo corre IMG-01 con los checks de red activos** — `d9b7b29` (test)
2. **Tarea 2: el guardarrail de fingerprints sociales cubre a IMG-01** — `9ae0588` (test)
3. **Tarea 3: pruebas de dientes y cierre de fase** — sin commit de codigo a proposito: las dos mutaciones se revirtieron y lo unico que persiste es esta transcripcion.

## Files Created/Modified

- `packages/checks/src/registry.test.ts` — parrafo nuevo en el docblock; tres `vi.mock` de modulo (sondeo de imagen, verificador de enlaces, defensa de destino) mas `vi.stubGlobal("fetch")`; constantes `SOCIAL_NETWORK_CHECK_ID`, `NETWORK_CHECK_IDS` y `NETWORK_PAGE_HTML`; bloque nuevo con dos casos. Los cuatro casos originales quedaron sin tocar.
- `packages/checks/src/checks/social/social-guardrail.test.ts` — parrafo nuevo en el docblock; dos `vi.mock` de modulo mas `vi.stubGlobal("fetch")`; constantes `SOCIAL_NETWORK_CHECK_ID` y `SOCIAL_CHECK_ID_COUNT_WITH_NETWORK`; bloque nuevo con cinco casos, reusando los dos comparadores que el archivo ya exportaba. El bloque original y sus seis casos quedaron sin tocar.

## Salida de los comandos verificados

| Comando | Resultado |
|---|---|
| `vitest run src/registry.test.ts` | 1 archivo, **10 casos**, en verde, **0.68s** (muy por debajo del techo de 30s: ninguna conexion real se abre) |
| `vitest run src/checks/social/social-guardrail.test.ts` | 1 archivo, **11 casos**, en verde |
| `pnpm --filter @auditor/checks test` | 43 archivos, **325 casos**, en verde (eran 318) |
| `pnpm test` (raiz) | **14 tareas**, todas en verde |
| `pnpm typecheck` (raiz) | **17 tareas**, todas en verde |
| `pnpm assert:web-boundary` | **PASS** — Playwright fuera del bundle de `@auditor/web`, sin dependencia directa, sin `@auditor/render` en el grafo y sin arista no-peer a playwright |

Arbol limpio al cerrar: `git diff --stat packages/checks/src/checks/network packages/meta-social` devuelve vacio, y `git status --porcelain` sobre los dos archivos mutados tampoco devuelve nada.

## Decisions Made

- **Tres modulos simulados y no dos.** El plan nombra el sondeo de imagen y la defensa de destino; al caso hermano le hace falta ademas el verificador de enlaces, porque `TECH-12` y `TECH-13` tienen que emitir fila para que el aserto de los tres identificadores no sea vacio, y sin simularlo saldrian a internet.
- **`vi.stubGlobal("fetch")` tambien en el guardarrail social.** `llmsTxtCheck` es un `NetworkCheck` del grupo AEO que pide por su cuenta con `fetch`. Activar la red en ese archivo sin el stub lo habria hecho salir a internet de verdad contra `example.com`, que es exactamente la frontera que este plan existe para cerrar.
- **El bloque nuevo del guardarrail social divide las filas sociales en dos colecciones** (las del check de red y las de los ocho de pagina) en lugar de comparar contra las otras categorias. La interseccion que importa aca es la de dentro de la propia categoria: es donde el formato de fingerprint es identico y donde la colision es posible.

## Deuda conocida registrada

1. **El identificador `IMG-01` cae al texto generico del catalogo de recomendaciones por sistema de gestion de contenidos**, igual que los ocho identificadores de la fase 30. Es decision explicita del orquestador y esta fuera de alcance de esta fase.
2. **La defensa de destino de `TECH-12` y `TECH-13` cubre el destino inicial pero no cada salto de redireccion** (amenaza T-31-02). La razon quedo escrita en el docblock de `linkChecker.ts` en 31-03: esos dos checks conservan el modo de redireccion automatico, y cerrar tambien los saltos exige reescribir el transporte de dos checks en produccion. El camino que esta fase introduce —el sondeo de imagen, el unico donde el destino lo elige un valor de meta tag— si tiene el bucle manual y queda cerrado por completo.
3. **La tasa de filas de `og-image-undetermined` queda sin medir** hasta que se corra una auditoria real sobre un sitio de verdad. Es la verificacion manual declarada en `31-VALIDATION.md` y el respaldo de la asuncion sobre el tamaño de la ventana de lectura del sondeo (backstop A1).

## Deviations from Plan

1. **Se simulo un tercer modulo (`linkChecker`) en `registry.test.ts`,** ademas de los dos que el plan nombra. Sin el, el caso hermano que exige fila de los tres checks de red no podia cumplirse sin abrir conexiones reales.
2. **Se agrego `vi.stubGlobal("fetch")` al bloque nuevo del guardarrail social,** que el plan solo pedia para `registry.test.ts`. `llmsTxtCheck` corre tambien ahi al activar la red, asi que sin el stub el archivo violaba la prohibicion de no abrir conexiones reales.

**Total deviations:** 2
**Impact on plan:** ninguno sobre el comportamiento verificado. Las dos son la misma correccion: la prohibicion de "ningun test sale a internet" exige simular todas las puertas del camino activado, no solo las del check nuevo.

## Known Stubs

Ninguno.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **La fase 31 queda cerrada.** Los cinco planes tienen SUMMARY, los tres comandos del gate salen en verde y el arbol no tiene ninguna modificacion de produccion sin commitear.
- Phase 32 recibe un contrato estable: los nueve umbrales en `packages/meta-social/src/thresholds.ts` y los nueve subtipos de ambito de `IMG-01`, con la no colision probada por el mecanismo que de verdad los consume.
- El guardarrail de registro cubre desde ahora a **cualquier** `NetworkCheck` futuro: agregar uno al barrel sin agregarlo al catalogo pone `registry.test.ts` en rojo.

## Self-Check: PASSED

- Los 2 archivos declarados existen en disco con los cambios descritos, y son los unicos dos que este plan modifico.
- Los dos commits de tarea (`d9b7b29`, `9ae0588`) existen en el historial.
- Las dos mutaciones se aplicaron, se observaron en rojo con la salida transcrita arriba, y se revirtieron: `git status --porcelain` sobre los dos archivos mutados devuelve vacio.
- Los criterios de aceptacion de las tres tareas se re-corrieron y dieron los valores exactos que pide el plan, incluidos los conteos de `awk` sobre el segundo bloque del guardarrail.

---
