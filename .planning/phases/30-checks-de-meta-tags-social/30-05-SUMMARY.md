---
phase: 30-checks-de-meta-tags-social
plan: 05
subsystem: checks
tags: [charset, bytes, utf-8, meta-social, social, vitest, regex-safety]

requires:
  - phase: 30-01
    provides: "paquete @auditor/meta-social con su barrel y tsconfig con types node; carpeta checks/social con su barrel y las convenciones C-1 a C-6"
  - phase: 30-04
    provides: "socialPageChecks con siete entradas (SOCIAL-01..07) y las aserciones de barrel por membresía, orden ascendente y no duplicados"
provides:
  - "`hasCharsetInFirstKB(html)` y `CHARSET_WINDOW_BYTES`: única medición por bytes de la fase, exportadas desde @auditor/meta-social"
  - "`charsetCheck` (SOCIAL-08) emitiendo la octava y última fila de la categoría social, cableado al barrel y presente en el catálogo global"
  - "precedente de check que lee `page.html` crudo en vez del árbol parseado, dentro de la categoría social"
affects: [30-06, phase-32-panel-preview-social]

tech-stack:
  added: []
  patterns:
    - "ventana de bytes recortada con Buffer.from + subarray antes de evaluar la expresión regular (mitigación de ReDoS por recorte, no por regex compleja)"
    - "limitación de observabilidad declarada en el criterio que lee el usuario en vez de ampliar la captura de datos del crawler"

key-files:
  created:
    - packages/meta-social/src/charset.ts
    - packages/meta-social/src/charset.test.ts
    - packages/checks/src/checks/social/charset.ts
    - packages/checks/src/checks/social/charset.test.ts
  modified:
    - packages/meta-social/src/index.ts
    - packages/checks/src/checks/social/index.ts

key-decisions:
  - "La ventana de 1024 se mide sobre los bytes UTF-8 del HTML con Buffer.from + subarray, nunca sobre unidades de cadena: la prueba de dientes demostró que el caso multibyte distingue las dos implementaciones"
  - "El recorte de la ventana es a la vez el criterio del check y la mitigación de T-30-03: la expresión regular nunca ve el documento completo, así que su costo es independiente del tamaño de entrada"
  - "Severidad acotada a warning y limitación de charset por header declarada textualmente en el criterion (resolución D-3), sin ampliar el alcance a packages/crawler"
  - "Las dos ramas comparten pageFingerprint(CHECK_ID, url) sin subtipo, según la convención C-5 de 30-01"
  - "Los dos measuredValue son literales fijos y no copian ni un byte del HTML auditado (mitigación de T-30-05 hacia el panel de Phase 32)"

patterns-established:
  - "Check de la categoría social que consume el HTML crudo de la fila Page en vez del CheerioAPI, con el mismo guard de dato ausente que usa perf/htmlSize.ts"

requirements-completed: [SOCIAL-08]

coverage:
  - id: D1
    description: "hasCharsetInFirstKB mide la ventana de 1024 sobre bytes UTF-8 reales y acepta las dos formas de declaración que nombra 30-CONTEXT.md"
    requirement: "SOCIAL-08"
    verification:
      - kind: unit
        ref: "packages/meta-social/src/charset.test.ts#hasCharsetInFirstKB (9 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "El caso multibyte discrimina la implementación por bytes de la implementación por caracteres, demostrado por mutación y revertido"
    requirement: "SOCIAL-08"
    verification:
      - kind: other
        ref: "mutación a html.substring(0, CHARSET_WINDOW_BYTES) en charset.ts: 1 failed | 16 passed, único caso rojo el multibyte; restaurado, 17 passed"
        status: pass
    human_judgment: false
  - id: D3
    description: "charsetCheck emite SOCIAL-08 con severidad warning en las tres variantes de problema y ok con declaración temprana, con la limitación de header en el criterio"
    requirement: "SOCIAL-08"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/charset.test.ts#charsetCheck (SOCIAL-08) (9 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Contrato de fingerprint estable entre las dos ramas e igual a pageFingerprint(SOCIAL-08, url), construido con la función real"
    requirement: "SOCIAL-08"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/charset.test.ts#emite el mismo fingerprint en las dos ramas sobre la misma URL"
        status: pass
    human_judgment: false
  - id: D5
    description: "El check corre en producción: pageChecks del registry real contiene exactamente un SOCIAL-08 y el barrel de la categoría no tiene duplicados"
    requirement: "SOCIAL-08"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/charset.test.ts#está cableado exactamente una vez en el catálogo global de checks"
        status: pass
    human_judgment: false
  - id: D6
    description: "Alcance contenido: sin cambios en packages/crawler, registry.ts, index.ts del paquete, manifiestos ni lockfile"
    verification:
      - kind: other
        ref: "git diff --name-only -- packages/crawler packages/checks/src/registry.ts packages/checks/src/index.ts packages/checks/package.json packages/meta-social/package.json pnpm-lock.yaml (salida vacía)"
        status: pass
    human_judgment: false

metrics:
  duration: 6min
  tasks: 2
  files: 6

completed: 2026-08-03
status: complete
---

# Phase 30 Plan 05: charset dentro del primer kilobyte Summary

**`hasCharsetInFirstKB` mide la ventana de 1024 sobre los bytes UTF-8 reales del HTML (`Buffer.from` + `subarray`, nunca unidades de cadena) y `charsetCheck` emite SOCIAL-08 como advertencia con la limitación de charset por header declarada en su criterio, cerrando los 8 checks de la categoría social.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-03T02:28:00Z
- **Completed:** 2026-08-03T02:34:00Z
- **Tasks:** 2
- **Files modified:** 6 (4 creados, 2 modificados)

## Accomplishments

- La regla lockeada de 30-CONTEXT.md quedó encarnada en código: la ventana se recorta con `Buffer.from(html, "utf8").subarray(0, CHARSET_WINDOW_BYTES)`, exactamente la mecánica de `truncateHtml` de `packages/fingerprint/src/detectStack.ts`, y no existe ninguna medición por unidades de cadena en el archivo.
- El caso multibyte no es decorativo: la mutación a recorte por caracteres lo puso en rojo y dejó los otros ocho casos en verde, así que el test discrimina entre las dos implementaciones en vez de transcribir lo que el código hace.
- El recorte de la ventana cumple doble función: es el criterio del check y es la mitigación de T-30-03. Un documento de 3 MB con una etiqueta meta abierta y nunca cerrada resuelve en tiempo constante porque la expresión regular nunca ve más de 1024 bytes.
- SOCIAL-08 se emite con severidad de advertencia y su criterio dice textualmente que un charset enviado sólo en el header HTTP `Content-Type` no es visible para esta auditoría (resolución D-3), en vez de ampliar el alcance a la captura de headers del crawler.
- El check es el octavo y último de la categoría: `socialPageChecks` pasa de siete a ocho entradas y el catálogo global contiene exactamente un `SOCIAL-08`, verificado desde el test contra `pageChecks` del registry real.
- `packages/checks/src/registry.ts`, `packages/checks/src/index.ts`, `packages/crawler`, los dos manifiestos y el lockfile quedan sin una sola línea de diferencia.

## Task Commits

Cada tarea se commiteó de forma atómica:

1. **Tarea 1: `hasCharsetInFirstKB` en el motor puro** — `45306b4` (feat)
2. **Tarea 2: `charsetCheck` (SOCIAL-08), cableado y tests** — `94bcc54` (feat)

## Ciclo TDD de la Tarea 1

El plan pedía rojo antes que verde y así se ejecutó.

**Rojo por ausencia.** Con `charset.test.ts` escrito y sin `charset.ts` en disco:

```
FAIL  src/charset.test.ts [ src/charset.test.ts ]
Error: Cannot find module './charset' imported from .../packages/meta-social/src/charset.test.ts
Test Files  1 failed | 1 passed (2)
```

**Verde tras la implementación.** `Test Files 2 passed (2)`, `Tests 17 passed (17)` — los 8 casos de `extract.test.ts` que dejó 30-01 más los 9 nuevos. `tsc --noEmit` sale con código 0.

## Prueba de dientes por mutación (Tarea 1, paso 4)

**Mutación aplicada** en `packages/meta-social/src/charset.ts`, cambiando el recorte por bytes por un recorte de caracteres:

```
- const buf = Buffer.from(html, "utf8");
- const head = buf.subarray(0, CHARSET_WINDOW_BYTES).toString("utf8");
+ const head = html.substring(0, CHARSET_WINDOW_BYTES);
```

**Resultado con la mutación aplicada.** La suite del paquete sale con código distinto de cero:

- `Test Files 1 failed | 1 passed (2)`, `Tests 1 failed | 16 passed (17)`
- El único caso rojo es `rechaza la declaración que queda antes del carácter 1024 pero después del byte 1024`, y falla justo en la línea del veredicto: `expected true to be false`.

Que el resto de los casos siga en verde es tan informativo como el rojo: confirma que el caso multibyte es el único que discrimina las dos implementaciones, y que sin él la regla lockeada de la fase quedaría sin cobertura real.

**Resultado con el archivo restaurado.** `pnpm --filter @auditor/meta-social test` sale con código 0 (17 de 17). `git diff packages/meta-social/src/charset.ts` no muestra diferencias respecto de lo que dejó la implementación: la mutación vivió dentro del paso y se revirtió en él antes del commit.

## Files Created/Modified

- `packages/meta-social/src/charset.ts` — `CHARSET_WINDOW_BYTES` (1024) y `hasCharsetInFirstKB`, con el docblock que explica los tres porqués: bytes y no caracteres, el sesgo conservador del re-encoding (Pitfall 7) y la aproximación aceptada de la expresión regular
- `packages/meta-social/src/charset.test.ts` — 9 casos del motor: las dos formas de declaración, ausencia, empuje por relleno de un byte, multibyte, declaración partida por la frontera, cadena vacía, valor de la constante y documento de 3 MB en tiempo acotado
- `packages/checks/src/checks/social/charset.ts` — `charsetCheck` (SOCIAL-08), único check de los ocho que lee `page.html` en vez del árbol
- `packages/checks/src/checks/social/charset.test.ts` — 9 casos del check, incluido el cableado contra el registry real
- `packages/meta-social/src/index.ts` — un bloque de export nuevo para la función y la constante; los exports de 30-01 quedan intactos
- `packages/checks/src/checks/social/index.ts` — tres apariciones de `charsetCheck` (import, entrada del array y re-export nominal), sin reordenar ni quitar nada

## Decisions Made

Las decisiones están arriba en `key-decisions`. Dos merecen rationale expandido:

- **El guard de HTML ausente devuelve array vacío y no una fila de problema.** Por el camino de producción el caso no es alcanzable, porque `runAllChecks` filtra las páginas sin HTML antes de correr cualquier `PageCheck`. El guard existe para las invocaciones directas desde los tests y desde el guardarraíl de 30-06, y lleva el mismo comentario explicativo que el analog `perf/htmlSize.ts` para que no se lea como código muerto.
- **La aproximación de la expresión regular se documenta pero no se fija con un test.** Cualquier etiqueta meta que contenga el token de charset dentro de la ventana se lee como declaración, incluso una no relacionada que lo mencione en su contenido. Es el precio de un patrón sin retroceso, queda escrito en el docblock, y deliberadamente ningún caso lo asserta: fijarlo con un test convertiría una aproximación tolerada en contrato.

## Deviations from Plan

Ninguna. El plan se ejecutó exactamente como está escrito: cero deviaciones de las Reglas 1 a 4, ningún bug auto-corregido, ninguna funcionalidad crítica faltante y ningún bloqueo. Los 6 archivos declarados son los 6 archivos tocados, más este SUMMARY.

**Total deviations:** 0
**Impact on plan:** ninguno.

## Issues Encountered

Ninguno que haya requerido corrección. Una observación de medición vale la pena registrarla: la primera corrida combinada de las dos suites, en frío, tardó 16.2 s, por encima de los 10 s de latencia máxima de `30-VALIDATION.md`. Es el costo de la caché de transformación vacía de Vitest, no del código de este plan. La corrida en caliente inmediatamente posterior tardó **3.79 s**, y `pnpm test` del monorepo completo cierra en 3.35 s con caché de turbo. El presupuesto de feedback se cumple; el número en frío queda anotado para que 30-06 no lo lea como una regresión.

## Verificación final

- `pnpm --filter @auditor/meta-social test`: 17 de 17 (8 de 30-01 más 9 nuevos).
- `pnpm --filter @auditor/meta-social typecheck`: código 0.
- `pnpm --filter @auditor/checks test`: 228 de 228, por encima de la línea base de 152 documentada en `30-VALIDATION.md` y con los 9 casos nuevos de `charsetCheck` en la salida.
- Corrida combinada de las dos suites en caliente: 3.79 s, por debajo de los 10 s de `30-VALIDATION.md`.
- `pnpm typecheck` (monorepo): 17 de 17 tareas exitosas.
- `pnpm test` (monorepo): 14 de 14 tareas exitosas.
- `pnpm build` (monorepo): 2 de 2 tareas exitosas.
- Gates estructurales de la Tarea 1, todos en el valor esperado: `CHARSET_WINDOW_BYTES = 1024` (1), `export function hasCharsetInFirstKB` (1), `Buffer.from(html` (1), `subarray(0, CHARSET_WINDOW_BYTES)` (1), medición por unidades de cadena (0), comodín codicioso (0), clase negada de cierre de etiqueta (1), exports en el barrel (1 y 1), casos de test (9), usos de la constante en el test (6).
- Gates estructurales de la Tarea 2, todos en el valor esperado: `CHECK_ID = "SOCIAL-08"` (1), `pageFingerprint(CHECK_ID, url)` (2, uno por rama), `CHARSET_WINDOW_BYTES` (2, import e interpolación), `header HTTP` (1), `critical` fuera de comentarios (0), `load(` fuera de comentarios (0), `page.html` (1), `charsetCheck` en el barrel (3), casos de test (9), `makePage` (4), casteos al tipo de página (0).
- El literal de la fila sin problema coincide byte a byte con `packages/checks/src/checks/onpage/title.ts`, verificado con `diff` entre los dos `grep -o`: salida vacía y código 0.
- Ningún barrel perdió símbolos: el `comm -23` contra `HEAD` no imprime nada, ni para `packages/meta-social/src/index.ts` ni para `packages/checks/src/checks/social/index.ts`.
- `git diff --name-only -- packages/crawler packages/checks/src/registry.ts packages/checks/src/index.ts packages/checks/package.json packages/meta-social/package.json pnpm-lock.yaml`: salida vacía.

## Known Stubs

Ninguno. SOCIAL-08 queda implementado completo y cableado; con él los 8 checks de la categoría social están en producción.

## Threat Flags

Ninguno. Este plan no crea superficie de red, ni endpoints, ni variables de entorno, ni cambios de esquema. Las dos filas del registro STRIDE del plan quedan así:

- **T-30-03 (DoS por expresión regular sobre HTML adversario):** mitigada y verificada. La expresión regular corre exclusivamente sobre la ventana recortada, usa una clase negada con cuantificador simple y no tiene comodín codicioso, verificado por gate estructural. El caso del documento de 3 MB resuelve en menos de 500 ms.
- **T-30-SC (legitimidad de paquetes):** aceptada sin acción. El plan instala cero paquetes: `Buffer` viene de los tipos de Node que el tsconfig del paquete ya declaraba desde 30-01. Diff del lockfile vacío.

## User Setup Required

Ninguno.

## Next Phase Readiness

- **30-06** puede arrancar directo. Hereda los 8 checks completos en `socialPageChecks`, el contrato de fingerprint de SOCIAL-08 assertado con la función real (`pageFingerprint("SOCIAL-08", url)`) y las aserciones de barrel por membresía y no duplicados, que siguen sin ser frágiles. Dos cosas que ese plan debe tener presentes: la fila `ok` de SOCIAL-08 existe por la convención C-4 y es candidata a quitarse si la calibración muestra que el check pasa en más del 95 por ciento de los perfiles de fixture; y el número de corrida en frío de las suites (16.2 s) no es una regresión de rendimiento sino caché vacía de Vitest.
- **Phase 32** consume `hasCharsetInFirstKB` y `CHARSET_WINDOW_BYTES` desde el barrel del paquete puro sin arrastrar crawler ni base de datos. Los dos `measuredValue` de SOCIAL-08 son literales fijos, así que esta fila específica no aporta superficie al traspaso de seguridad T-30-05: el riesgo sigue acotado a los checks que copian el valor del meta tag.
- **Limitación viva, no defecto:** un sitio que declara el charset únicamente en el header HTTP `Content-Type` recibe la advertencia. Si Juan observa que aparece seguido en sitios bien configurados, la corrección es de otra fase y toca la lista curada de headers del crawler, no este check.

## Self-Check: PASSED

Los 4 archivos declarados como creados existen en disco y los 2 hashes de commit existen en el historial de git. Verificado con `test -f` por archivo y `git log --oneline --all | grep` por hash.

---
*Phase: 30-checks-de-meta-tags-social*
*Completed: 2026-08-03*
