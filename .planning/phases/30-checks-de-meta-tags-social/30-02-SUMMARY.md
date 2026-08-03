---
phase: 30-checks-de-meta-tags-social
plan: 02
subsystem: checks
tags: [open-graph, meta-tags, social, thresholds, vitest, tdd]

requires:
  - phase: 30-01
    provides: "paquete `@auditor/meta-social` con `extractMetaSocial`/`firstValue`, carpeta `checks/social/` con su barrel cableado al registry, y convenciones C-1 a C-6"
provides:
  - "`ogDescriptionCheck` (SOCIAL-02): presencia de og:description más longitud de 55 a 200 caracteres, con las tres ramas compartiendo un único fingerprint"
  - "`ogTypeCheck` (SOCIAL-05): presencia de og:type y nada más, sin comparar el valor contra ninguna colección"
  - "`OG_DESC_MIN` (55) y `OG_DESC_MAX` (200): segundo par de umbrales calibrables de la categoría, que Phase 32 lee para pintar el preview"
  - "`MAX_MEASURED_VALUE_CHARS` (80): tope único de la fase para todo texto controlado por el sitio que llegue a `measuredValue`; lo consumen 30-03 y 30-04 sin redeclararlo"
  - "`socialPageChecks` con tres entradas, sin volver a tocar el registry global"
affects: [30-03, 30-04, 30-05, 30-06, phase-32-panel-preview-social]

tech-stack:
  added: []
  patterns:
    - "umbrales calibrables sólo en el paquete puro, nunca en el archivo del check"
    - "tope compartido de recorte de texto controlado por el sitio, importado por toda la categoría"
    - "expansión horizontal de la categoría por copia del molde del tracer, con el barrel como único punto de extensión"

key-files:
  created:
    - packages/checks/src/checks/social/ogDescription.ts
    - packages/checks/src/checks/social/ogDescription.test.ts
    - packages/checks/src/checks/social/ogType.ts
    - packages/checks/src/checks/social/ogType.test.ts
  modified:
    - packages/meta-social/src/thresholds.ts
    - packages/meta-social/src/index.ts
    - packages/checks/src/checks/social/index.ts

key-decisions:
  - "El rango social de og:description (55-200) es deliberadamente distinto del de la meta description de buscadores (70-160): el corte del preview social y el del resultado de búsqueda no ocurren en el mismo punto. Los dos bordes exactos están probados como `ok` para que la copia accidental de los números de buscadores salga en rojo"
  - "`MAX_MEASURED_VALUE_CHARS` se declara una sola vez para toda la categoría, en `packages/meta-social/src/thresholds.ts`, en vez de un tope por check: un tope por archivo se desincroniza en cuanto alguien recalibre uno solo, y Phase 32 pinta el mismo texto en el panel de preview"
  - "SOCIAL-05 verifica presencia y nada más: un og:type con errata pasa como correcto. Es el costo aceptado a cambio de cero falsos positivos sobre los vocabularios extendidos legítimos del protocolo (Deferred Idea de 30-CONTEXT.md)"
  - "El ciclo TDD se commiteó con la separación de gates que exige el flujo: un commit `test(...)` en rojo y un commit `feat(...)` en verde por cada uno de los dos checks"

patterns-established:
  - "Molde de expansión de la categoría: test primero contra el módulo inexistente, luego umbrales en el paquete puro, luego el check, y el barrel al final"
  - "Todo check que copie texto del sitio auditado a `measuredValue` importa `MAX_MEASURED_VALUE_CHARS` y lo aplica con `slice`"

requirements-completed: [SOCIAL-02, SOCIAL-05]

coverage:
  - id: D1
    description: "SOCIAL-02 emite advertencia por ausencia y por contenido vacío, advertencia fuera del rango 55-200, y fila ok dentro del rango"
    requirement: "SOCIAL-02"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogDescription.test.ts#ogDescriptionCheck (SOCIAL-02) (9 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Los dos bordes exactos del rango social (55 y 200) salen ok, demostrando que la calibración no se copió de la de buscadores"
    requirement: "SOCIAL-02"
    verification:
      - kind: unit
        ref: "ogDescription.test.ts#aprueba una og:description de exactamente 55 caracteres + #aprueba una og:description de exactamente 200 caracteres"
        status: pass
    human_judgment: false
  - id: D3
    description: "SOCIAL-05 aprueba cualquier valor no vacío, incluido un valor de vocabulario extendido, sin ninguna comprobación de pertenencia"
    requirement: "SOCIAL-05"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogType.test.ts#aprueba un og:type del vocabulario extendido del protocolo"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mitigación T-30-06: un og:type de 500 caracteres deja un measuredValue de exactamente 80 caracteres, el tope compartido de la categoría"
    requirement: "SOCIAL-05"
    verification:
      - kind: unit
        ref: "ogType.test.ts#recorta el valor medido al tope compartido de la categoría"
        status: pass
    human_judgment: false
  - id: D5
    description: "Los dos checks leen exclusivamente por el extractor unificado: una etiqueta emitida con el atributo name produce el mismo veredicto (regresión del Pitfall 1)"
    verification:
      - kind: unit
        ref: "ogDescription.test.ts#aprueba la misma og:description emitida con el atributo name + ogType.test.ts#aprueba el mismo og:type emitido con el atributo name"
        status: pass
    human_judgment: false
  - id: D6
    description: "Contrato de fingerprint estable: las ramas de cada check comparten un único pageFingerprint(CHECK_ID, url), calculado con la función real"
    verification:
      - kind: unit
        ref: "ogDescription.test.ts#emite el mismo fingerprint en todas las ramas + ogType.test.ts#emite el mismo fingerprint en las dos ramas"
        status: pass
    human_judgment: false
  - id: D7
    description: "Los dos checks quedan registrados en socialPageChecks en la misma ola que los crea, y el barrel cierra con exactamente tres entradas"
    verification:
      - kind: unit
        ref: "ogType.test.ts#queda registrado en el barrel socialPageChecks junto a los otros dos checks de la ola"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-03
status: complete
---

# Phase 30 Plan 02: og:description y og:type Summary

**Primera expansión horizontal sobre la arquitectura del tracer: `SOCIAL-02` (og:description con rango social propio de 55 a 200) y `SOCIAL-05` (og:type sólo por presencia), más el tope compartido `MAX_MEASURED_VALUE_CHARS` que va a consumir el resto de la categoría.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-03T01:53:59Z
- **Completed:** 2026-08-03T01:59:01Z
- **Tasks:** 2 (4 commits: dos ciclos rojo a verde)
- **Files modified:** 7 (4 creados, 3 modificados)

## Accomplishments

- El molde del tracer se copió dos veces sin fricción: cero cambios en `registry.ts`, cero paquetes nuevos en el lockfile, cero renegociación de las convenciones C-1 a C-6. Es exactamente lo que esta ola existía para demostrar.
- La calibración social quedó separada de la de buscadores con prueba, no con comentario: una og:description de 55 caracteres y otra de 200 salen `ok`, dos longitudes que el check de meta description de buscadores (70-160) marcaría fuera de rango. Si alguien reusa los números de buscadores, esos dos casos se ponen en rojo.
- `MAX_MEASURED_VALUE_CHARS` quedó como el tope único de la fase para el texto controlado por el sitio auditado. SOCIAL-05 es su primer consumidor; 30-03 (`ogImage.ts`, `ogUrl.ts`) y 30-04 (`twitterCard.ts`) lo importan del mismo lugar en vez de declarar el suyo.
- SOCIAL-05 termina donde el requisito manda: verifica presencia y nunca compara el valor contra una colección. El caso `music.playlist` es el guardarraíl de ese límite de alcance.
- Los dos checks leen sólo por `firstValue` sobre el extractor del paquete puro, con el caso del atributo `name` probado en las dos suites: la regresión del Pitfall 1 queda cubierta también en esta ola.
- El barrel `socialPageChecks` cierra la ola con tres entradas y un test lo asserta, así que un check implementado y no registrado no puede pasar en verde.

## Task Commits

Cada tarea se commiteó con la separación de gates del ciclo TDD:

1. **Tarea 1 (SOCIAL-02) — RED:** `83e33b0` (`test`) — los 9 casos escritos contra el módulo inexistente
2. **Tarea 1 (SOCIAL-02) — GREEN:** `d526c91` (`feat`) — umbrales, barrel del paquete, check y entrada en `socialPageChecks`
3. **Tarea 2 (SOCIAL-05) — RED:** `2cd15bf` (`test`) — los 8 casos escritos contra el módulo inexistente
4. **Tarea 2 (SOCIAL-05) — GREEN:** `0ae2e07` (`feat`) — check de presencia, recorte del valor medido y tercera entrada en el barrel

## Ciclos rojo a verde observados

El plan exige transcribir los dos rojos. Se observaron y se commitearon como gate `test(...)` antes de cada implementación.

**Tarea 1, rojo observado** (`pnpm --filter @auditor/checks test`):

```
FAIL  src/checks/social/ogDescription.test.ts [ src/checks/social/ogDescription.test.ts ]
Error: Cannot find module './ogDescription' imported from .../social/ogDescription.test.ts
 Test Files  1 failed | 30 passed (31)
      Tests  162 passed (162)
```

**Tarea 1, verde:** `Test Files 31 passed (31)`, `Tests 171 passed (171)`. Los 9 casos nuevos entran completos.

**Tarea 2, rojo observado:**

```
FAIL  src/checks/social/ogType.test.ts [ src/checks/social/ogType.test.ts ]
Error: Cannot find module './ogType' imported from .../social/ogType.test.ts
 Test Files  1 failed | 31 passed (32)
      Tests  171 passed (171)
```

**Tarea 2, verde:** `Test Files 32 passed (32)`, `Tests 179 passed (179)`. Línea base 152 del 2026-08-01, más los 10 casos de 30-01, más los 17 de este plan.

## Files Created/Modified

- `packages/meta-social/src/thresholds.ts` — `OG_DESC_MIN` (55), `OG_DESC_MAX` (200) y `MAX_MEASURED_VALUE_CHARS` (80), con el rationale de por qué el rango social no es el de buscadores y por qué el tope es uno solo para toda la categoría. Las constantes de og:title quedan intactas
- `packages/meta-social/src/index.ts` — las tres constantes nuevas salen por el barrel, que es la condición para que resuelvan desde `@auditor/checks`
- `packages/checks/src/checks/social/ogDescription.ts` — `ogDescriptionCheck` (SOCIAL-02), tres ramas, sin ningún umbral propio
- `packages/checks/src/checks/social/ogDescription.test.ts` — 9 casos: ausencia, contenido vacío, 54, 55, 200, 201, atributo `name`, fingerprint estable y registro en el barrel
- `packages/checks/src/checks/social/ogType.ts` — `ogTypeCheck` (SOCIAL-05), dos ramas, recorte del valor al tope compartido
- `packages/checks/src/checks/social/ogType.test.ts` — 8 casos: ausencia, contenido vacío, valor común, vocabulario extendido, atributo `name`, recorte a 80, fingerprint estable y barrel con tres entradas
- `packages/checks/src/checks/social/index.ts` — de una a tres entradas en `socialPageChecks`, con import y re-export nominal por check

## Decisions Made

Las decisiones están arriba en `key-decisions`. Dos con rationale expandido:

- **El tope de recorte vive en el paquete puro, no en el check.** La alternativa obvia era un `const MAX_VALUE = 80` dentro de `ogType.ts`, más corto de escribir. Se descartó porque 30-03 y 30-04 crean tres checks más que copian texto del sitio a `measuredValue`, y cuatro copias del mismo número se desincronizan en la primera recalibración. Phase 32 pinta ese mismo texto en el panel de preview, así que el número tiene que ser uno solo y legible desde el paquete puro.
- **El criterio de SOCIAL-05 dice explícitamente que no se valida el valor.** El texto del `criterion` que ve el usuario aclara que la auditoría verifica la presencia de la etiqueta y no el valor declarado. Sin esa aclaración, una fila `ok` sobre un og:type con errata se lee como una validación que el check no hace.

## Deviations from Plan

Ninguna. Cero deviaciones de las Reglas 1 a 4: ningún bug auto-corregido, ninguna funcionalidad crítica faltante y ningún bloqueo.

Una nota de forma, no de alcance: el plan describe cada tarea como una unidad, y el flujo de ejecución exige que una tarea `tdd="true"` deje el gate rojo y el gate verde como commits separados. Se aplicó lo segundo, así que el plan tiene 2 tareas y 4 commits en vez de 2. No cambia ni un archivo ni una línea respecto de lo planificado.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** ninguno. Los 7 archivos del plan son los 7 archivos tocados, más el SUMMARY.

## Issues Encountered

Ninguno. La precondición de la Tarea 1 se verificó antes de escribir código: `test -L packages/checks/node_modules/@auditor/meta-social` salió con código 0, así que no hizo falta correr `pnpm install`.

## Verificación final

- `pnpm --filter @auditor/meta-social test`: 8 de 8. Las constantes nuevas no rompen los tests del motor que dejó 30-01.
- `pnpm --filter @auditor/checks test`: 179 de 179, con los `describe` nuevos `ogDescriptionCheck (SOCIAL-02)` y `ogTypeCheck (SOCIAL-05)` en la salida.
- Corrida combinada de las dos suites: **3.17 s**, por debajo de los 10 s de latencia máxima de `30-VALIDATION.md`.
- `pnpm typecheck` (monorepo): 17 de 17 tareas exitosas. Prueba que las tres constantes resuelven desde `@auditor/checks` a través del barrel del paquete puro.
- `pnpm test` (monorepo): 14 de 14. `pnpm build`: 2 de 2.
- `pnpm assert:web-boundary`: PASS.
- `git diff --numstat -- packages/checks/src/registry.ts`: salida vacía. El plan no tocó el registro global.
- `git diff --stat pnpm-lock.yaml`: sin cambios. Cero paquetes nuevos (T-30-SC verificado).
- Gates estructurales de los dos checks, todos en 0: ningún selector de meta propio (`$("meta`), ningún `load(` que reabra el HTML, ningún umbral ni tope redeclarado, y en `ogType.ts` ninguna comprobación de pertenencia (`.includes(`, `.indexOf(`, `new Set(`, `.some(`).
- El literal de la rama sin acción coincide byte a byte con el de `ogTitle.ts` en los dos checks nuevos, verificado con `test "$(grep -o ...)" = "$(grep -o ...)"`, código 0 en ambos.
- Ninguna de las dos suites castea un objeto literal al tipo `Page`: las dos usan `makePage`.

## Known Stubs

Ninguno. Los checks SOCIAL-03, SOCIAL-04, SOCIAL-06, SOCIAL-07 y SOCIAL-08 son alcance planificado de 30-03 a 30-05, no stubs de este plan.

## User Setup Required

Ninguno. El plan no agrega variables de entorno, ni claves, ni servicios externos, ni dependencias.

## Next Phase Readiness

- **30-03 (og:image y og:url)** puede arrancar directo: importa `MAX_MEASURED_VALUE_CHARS` desde `@auditor/meta-social` en vez de declarar un tope propio, y agrega sus entradas al array del barrel entre `ogDescriptionCheck` y `ogTypeCheck`, que se mantiene ordenado por número de identificador.
- **30-04 (`twitterCard.ts`)** aplica el mismo tope compartido, importado del mismo lugar.
- **Phase 32** lee `OG_DESC_MIN` y `OG_DESC_MAX` del paquete puro para pintar el preview con el mismo criterio con el que el check puntúa, sin una segunda copia de los números.
- **Traspaso de seguridad pendiente (T-30-06):** el recorte a 80 caracteres acota el tamaño de la fila, pero no sanea el contenido. Phase 32 debe revalidar el texto antes de usarlo como atributo al renderizarlo en el panel de preview.

## Self-Check: PASSED

Los 7 archivos declarados como creados o modificados existen en disco y los 4 hashes de commit existen en el historial de git. Verificado con `test -f` por archivo y `git log --oneline --all | grep` por hash.

---
*Phase: 30-checks-de-meta-tags-social*
*Completed: 2026-08-03*
