---
phase: 30-checks-de-meta-tags-social
plan: 06
subsystem: checks
tags: [guardrail, fingerprint, calibracion, fixtures, scoring, vitest, cierre-de-fase]

# Dependency graph
requires:
  - phase: 30-01
    provides: "packages/meta-social con su patrón de fixtures de perfil, carpeta checks/social con su barrel cableado al registry, convenciones C-1 a C-6, checkId plano (option-a)"
  - phase: 30-02
    provides: "SOCIAL-02 (og:description) y SOCIAL-05 (og:type), MAX_MEASURED_VALUE_CHARS"
  - phase: 30-03
    provides: "SOCIAL-03 (og:image) y SOCIAL-04 (og:url), aserciones de barrel no frágiles"
  - phase: 30-04
    provides: "SOCIAL-06 y SOCIAL-07, los dos checks multi hallazgo que componen subtipo dentro del fingerprint"
  - phase: 30-05
    provides: "SOCIAL-08 (charset en el primer KB), octava y última entrada del barrel socialPageChecks"
provides:
  - "guardarraíl del Success Criterion #5: cero colisión de fingerprint con el retirado ONPAGE-05, probado llamando a la función real y con autoprueba de detección"
  - "cobertura de registro y de alcanzabilidad de punta a punta de los ocho checkIds sociales en registry.test.ts"
  - "cinco fixtures de perfil de emisor nuevos (seis en total con el de 30-01), base reutilizable para las fases 31 y 32"
  - "arnés de calibración con la tabla de detección por perfil fijada y las cuatro propiedades de discriminación exigidas por test"
  - "banda de score de la categoría social MEDIDA: promedio 83.67, mínimo 45, máximo 100, separación 55"
affects: [31-checks-de-red-de-imagen-social, 32-reporte-social]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "guardarraíl de fingerprint que reconstruye el identificador de un check BORRADO del árbol llamando a la función real, sin importar ni restaurar el módulo retirado"
    - "arnés de calibración de categoría: tabla de detección por perfil fijada como constante escrita a mano antes de la primera corrida"
    - "lectura de fixtures de otro paquete del workspace por ruta relativa con import.meta.url, sin arista nueva en el grafo de dependencias"

key-files:
  created:
    - packages/checks/src/checks/social/social-guardrail.test.ts
    - packages/checks/src/checks/social/social-calibration.test.ts
    - packages/meta-social/src/__fixtures__/rankmath.html
    - packages/meta-social/src/__fixtures__/shopify.html
    - packages/meta-social/src/__fixtures__/webflow.html
    - packages/meta-social/src/__fixtures__/next-metadata.html
    - packages/meta-social/src/__fixtures__/no-og.html
  modified:
    - packages/checks/src/registry.test.ts

key-decisions:
  - "El perfil yoast se mide con la URL que su propio fixture declara (https://ejemplo.com/guia-auditoria-seo/) y no con el prefijo de perfil: yoast.html es artefacto de 30-01 y sujeta las aserciones de extract.test.ts, así que modificarlo para uniformar la URL habría reabierto un plan hermano por una cuestión cosmética"
  - "El aserto de intersección con las otras cinco categorías se hace sobre INTERSECCIÓN y no sobre unicidad global: un duplicado preexistente en el catálogo viejo es deuda ajena a esta fase y no debe poner en rojo su cierre"
  - "La remediación mecánica que contempla la convención C-4 NO se aplicó: SOCIAL-06 y SOCIAL-08 conservan su fila de aprobado explícita. Ver la sección de calibración para los tres motivos y la decisión devuelta a planeación"
  - "El caso de alcanzabilidad del registry asserta fila de PROBLEMA y no fila de aprobado, así que sigue siendo válido aunque una fase futura le quite a algún check su fila ok"
  - "La autoprueba de detección usa datos sintéticos dentro del test y nunca una mutación de código de producción: una edición sin revertir persistiría exactamente el defecto que el guardarraíl existe para impedir"

patterns-established:
  - "Guarda anti vacuidad como PRIMER caso de todo archivo de guardarraíl: sin ella el resto de las aserciones pasa por vacuidad y el guardarraíl se vuelve un falso PASS silencioso"
  - "Calibración de banda de score de una categoría contra un conjunto declarado de perfiles de emisor, con la tabla de veredictos fijada como diff legible"

requirements-completed: [SOCIAL-01, SOCIAL-02, SOCIAL-03, SOCIAL-04, SOCIAL-05, SOCIAL-06, SOCIAL-07, SOCIAL-08]

coverage:
  - id: D1
    description: "Success Criterion #5 del ROADMAP: sobre la página con las cuatro etiquetas Open Graph básicas ningún fingerprint social iguala el del retirado ONPAGE-05, con el fingerprint de referencia construido llamando a pageFingerprint"
    requirement: "SOCIAL-01..SOCIAL-08"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#no emite ningún fingerprint igual al del check retirado ONPAGE-05 sobre la misma URL"
        status: pass
      - kind: other
        ref: "prueba de dientes: RETIRED_CHECK_ID mutado a SOCIAL-03 pone en rojo exactamente ese caso (1 failed | 5 passed); revertido, 6 passed"
        status: pass
    human_judgment: false
  - id: D2
    description: "El guardarraíl demuestra su propia capacidad de detección con datos sintéticos, sin tocar código de producción"
    requirement: "SOCIAL-01..SOCIAL-08"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#detecta la colisión cuando existe (autoprueba con fingerprints sintéticos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Guarda anti vacuidad: la categoría social emite filas de los ocho checks distintos por el camino de producción"
    requirement: "SOCIAL-01..SOCIAL-08"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#emite filas de los ocho checks de la categoría social por el camino de producción"
        status: pass
    human_judgment: false
  - id: D4
    description: "Unicidad interna de fingerprints de la categoría y cero intersección con las otras cinco categorías de la misma corrida"
    requirement: "SOCIAL-01..SOCIAL-08"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#no repite ningún fingerprint dentro de la propia categoría social"
        status: pass
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#no comparte ningún fingerprint con las otras cinco categorías de la misma corrida"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ninguna fila social colapsa en el diff entre auditorías: una entrada por fila, todas nuevas, cero resueltas"
    requirement: "SOCIAL-01..SOCIAL-08"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/social-guardrail.test.ts#no colapsa ninguna fila social en el diff entre auditorías"
        status: pass
    human_judgment: false
  - id: D6
    description: "Los ocho checkIds están registrados en pageChecks y son alcanzables por runAllChecks, cada uno con al menos una fila de severidad distinta de ok, category social y el identificador de la página"
    requirement: "SOCIAL-01..SOCIAL-08"
    verification:
      - kind: unit
        ref: "packages/checks/src/registry.test.ts#incluye los ocho checks de la categoría social"
        status: pass
      - kind: integration
        ref: "packages/checks/src/registry.test.ts#emite al menos una fila de problema de cada uno de los ocho checks sociales"
        status: pass
    human_judgment: false
  - id: D7
    description: "Los dos guardarrailes previos del test del registry siguen intactos y verdes, y el cambio es puramente aditivo"
    verification:
      - kind: other
        ref: "git diff -- packages/checks/src/registry.test.ts | grep -c '^-[^-]' devuelve 0; RETIRED_CHECK_ID 3 apariciones, PERF_CHECK_IDS 4"
        status: pass
    human_judgment: false
  - id: D8
    description: "La tabla de qué checks disparan sobre qué perfil de emisor queda fijada dentro del test y coincide con la tabla de diseño escrita antes de la primera corrida"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/social-calibration.test.ts#dispara exactamente los checks que la tabla de diseño predice sobre cada perfil"
        status: pass
    human_judgment: false
  - id: D9
    description: "La banda de score de la categoría social queda medida y discrimina: piso estricto en el perfil sin etiquetas, separación de 55 puntos y 5 de 6 perfiles por debajo de 95"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/social-calibration.test.ts#discrimina entre un emisor bien configurado y uno sin ninguna etiqueta social"
        status: pass
      - kind: integration
        ref: "packages/checks/src/checks/social/social-calibration.test.ts#no satura: el promedio de los seis perfiles se mantiene acotado"
        status: pass
    human_judgment: false
  - id: D10
    description: "Cero cambios en código de producción, manifiestos, lockfile y registry"
    verification:
      - kind: other
        ref: "git status --short sobre packages/checks/src/checks/social/ (sólo .test.ts), packages/checks/package.json, packages/meta-social/package.json, pnpm-lock.yaml, registry.ts e index.ts: salida vacía"
        status: pass
    human_judgment: false
  - id: D11
    description: "Comparación de la banda medida contra la banda estimada de la asunción A3 (60-80) y decisión sobre la remediación de calibración"
    verification: []
    human_judgment: true
    rationale: "Única verificación manual declarada de la fase en 30-VALIDATION.md. El promedio medido es 83.67, por debajo del umbral de 85 que el plan fijó como falsificación, pero por encima del techo de 80 de la banda estimada. La decisión de aceptarlo para v1.6 o abrir un plan de remediación es de Juan."

# Metrics
duration: 32min
completed: 2026-08-03
status: complete
---

# Phase 30 Plan 06: cierre de la categoría social Summary

**Los ocho checks sociales quedan probados como registrados, alcanzables por `runAllChecks` y sin una sola colisión de fingerprint con el retirado `ONPAGE-05`, con el fingerprint de referencia reconstruido llamando a la función real; y la banda de score de la categoría pasa de estimación a medición contra seis perfiles de emisor: promedio 83.67, piso 45, techo 100, separación 55.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-08-03T02:40:07Z
- **Completed:** 2026-08-03T03:11:52Z
- **Tasks:** 3
- **Files modified:** 8 (7 creados, 1 modificado)

## Accomplishments

- El Success Criterion #5 del ROADMAP, arrastrado como diferimiento W-06 de la verificación de la fase 29, deja de ser una propiedad cierta por casualidad de nombres y pasa a ser una propiedad vigilada. El fingerprint del check retirado se reconstruye llamando a `pageFingerprint`, la misma función que usan los ocho checks, así que el día que cambie el formato el guardarraíl se rompe en vez de seguir pasando en verde.
- El guardarraíl demuestra su propia capacidad de detección de dos formas independientes: la autoprueba con fingerprints sintéticos dentro del test, y la prueba de dientes por mutación de la constante del identificador retirado, que puso en rojo exactamente el caso del criterio cinco y ningún otro.
- La guarda anti vacuidad va como primer caso de los dos archivos nuevos, a propósito. Sin ella, el día que el spread del registry se caiga en un merge la colección social sale vacía y todo lo demás pasa por vacuidad: el guardarraíl se convertiría en un falso PASS silencioso, y la calibración daría cien porque una categoría sin filas puntúa perfecto por definición del modelo.
- Los ocho checkIds quedan probados como alcanzables y no sólo como presentes en un array: sobre una página rota en las ocho dimensiones a la vez, cada uno emite al menos una fila de severidad distinta de correcta, con `category: "social"` y el identificador de la página.
- La asunción A3 de la investigación deja de ser una estimación de confianza media. La banda está medida contra seis documentos de perfil, con la tabla de veredictos por emisor fijada dentro del test.
- La tabla de detección coincidió con la tabla de diseño en la PRIMERA corrida. No hubo que ajustar ninguna expectativa después de medir, que era el riesgo explícito de esta tarea.
- Cero líneas de código de producción tocadas. Los ocho archivos de check, el barrel de la categoría, el registry, los dos manifiestos y el lockfile quedan byte a byte como los dejaron los planes anteriores.

## Task Commits

Cada tarea se commiteó de forma atómica:

1. **Tarea 1: guardarraíl del Success Criterion #5** — `03bcd45` (test)
2. **Tarea 2: los ocho checkIds registrados y alcanzables** — `66c339e` (test)
3. **Tarea 3: fixtures de perfil y calibración medida** — `8038d06` (test)

## Tabla medida de calibración

Seis perfiles de emisor, con el score real de `scoreCategory`, el mismo que produce el número del reporte.

| Perfil | Filas sociales | crítica / advertencia / correcta | Score | Checks que disparan |
|---|---|---|---|---|
| `yoast` (WordPress + Yoast) | 8 | 0 / 1 / 7 | **94** | SOCIAL-02 |
| `rankmath` (WordPress + Rank Math) | 8 | 0 / 0 / 8 | **100** | (ninguno) |
| `shopify` | 8 | 1 / 0 / 7 | **88** | SOCIAL-03 |
| `webflow` | 8 | 0 / 3 / 5 | **81** | SOCIAL-04, SOCIAL-05, SOCIAL-07 |
| `next-metadata` (Next.js Metadata API) | 8 | 0 / 1 / 7 | **94** | SOCIAL-02 |
| `no-og` (sitio sin etiquetas sociales) | 10 | 2 / 7 / 1 | **45** | SOCIAL-01, SOCIAL-02, SOCIAL-03, SOCIAL-04, SOCIAL-05, SOCIAL-07 |

**Agregados:** promedio **83.67**, mínimo **45**, máximo **100**, separación **55**, perfiles por debajo de 95: **5 de 6**.

Las cuatro propiedades de discriminación se cumplen con margen:

- El perfil sin ninguna etiqueta social es el mínimo **estricto** del conjunto (45, único en ese valor) y queda muy por debajo del techo exigido de 65.
- La separación entre el mejor y el peor emisor es de 55 puntos, contra los 30 exigidos.
- Cinco de los seis perfiles quedan por debajo de 95, contra los tres exigidos.
- El promedio es 83.67, por debajo del techo de 92 que el plan fijó como señal de saturación.

Dos observaciones que salen de la tabla y no de la teoría:

1. **El volumen de filas, y no sólo su gravedad, es lo que mueve el número.** El perfil sin etiquetas emite 10 filas en vez de 8, porque SOCIAL-07 aporta cuatro (la tarjeta más los tres campos secundarios sin equivalente de Open Graph) mientras SOCIAL-06 no aporta ninguna por su rama de no aplicabilidad. Es exactamente el reparto asimétrico que 30-04 dejó anotado como insumo, y es lo que hunde el piso a 45.
2. **SOCIAL-06 y SOCIAL-08 no disparan sobre ningún perfil real.** Es el hallazgo que la Pitfall 5 de la investigación predijo textualmente: un emisor real no repite etiquetas con contenidos contradictorios ni declara el charset tarde.

## Decisión sobre la remediación de calibración (no aplicada, devuelta a planeación)

La convención C-4 de `30-01-PLAN.md` decía que si algún check pasa en más del 95 por ciento de los perfiles, este plan le quita la fila de severidad correcta. Medido: SOCIAL-06 y SOCIAL-08 pasan en los seis. La remediación **no se aplicó**, por los tres motivos que `<calibration_decision>` del plan ya había razonado y que la medición confirma:

1. Con seis perfiles la granularidad es de 16.7 puntos: no existe ningún resultado entre 95 y 100 por ciento, así que la regla literal sólo puede significar "pasa en los seis".
2. Quitarle la fila de aprobado a SOCIAL-08 pone en falso un criterio de aceptación ya aceptado de `30-05-PLAN.md` y rompe tests verdes de 30-04 y 30-05. Eso no es remediación, es una regresión aplicada al final de la fase sobre trabajo ya cerrado.
3. El modo de falla real que la investigación describe es la saturación, y la medición muestra que **no hay saturación**: la separación es de 55 puntos y sólo un perfil de seis llega a 100.

**Condición de parada del plan: no se disparó.** Ningún check distinto de SOCIAL-06 y SOCIAL-08 pasa en los seis perfiles, y el promedio (83.67) queda por debajo del techo de 92. No hubo que detener la ejecución ni tocar la rama de ningún check.

## Prueba de dientes del guardarraíl (Tarea 1)

Los tests de este plan se escribieron sobre código ya existente, así que no podían arrancar en rojo por ausencia. El rojo se produjo mutando **la constante del propio test**, nunca un archivo de producción.

**Mutación aplicada** en `social-guardrail.test.ts`:

```
- const RETIRED_CHECK_ID = "ONPAGE-05";
+ const RETIRED_CHECK_ID = "SOCIAL-03";
```

**Resultado con la mutación aplicada.** `Tests 1 failed | 5 passed (6)`, código de salida 1. El único caso rojo es el del criterio cinco:

```
× no emite ningún fingerprint igual al del check retirado ONPAGE-05 sobre la misma URL
AssertionError: expected [ …(8) ] to not include 'SOCIAL-03:https://example.com/page'
```

Que los otros cinco casos sigan en verde es tan informativo como el rojo: confirma que el caso del criterio cinco es el que discrimina, y que la aserción no está pasando por vacuidad ni por un comparador roto.

**Resultado con la constante restaurada.** `diff` contra la copia previa a la mutación sale vacío, y `pnpm --filter @auditor/checks test` sale con código 0 y 234 tests en verde. La mutación vivió dentro del paso y se revirtió en él, antes del commit.

## Files Created/Modified

- `packages/checks/src/checks/social/social-guardrail.test.ts` — 6 casos: guarda anti vacuidad, cero colisión con el retirado, unicidad interna, cero intersección con las otras cinco categorías, no colapso en `diffIssues`, y autoprueba de detección. Exporta `findDuplicateFingerprints` y `findSharedFingerprints` para que la autoprueba corra sobre datos sintéticos
- `packages/checks/src/registry.test.ts` — +60 líneas, −0: la constante `SOCIAL_CHECK_IDS`, un caso de pertenencia en el primer bloque y un caso de alcanzabilidad de punta a punta en el segundo
- `packages/checks/src/checks/social/social-calibration.test.ts` — 4 casos: guarda anti vacuidad, tabla de detección por perfil, discriminación y no saturación
- `packages/meta-social/src/__fixtures__/rankmath.html` — perfil WordPress con Rank Math, emisor sin defectos (og:title 46, og:description 145)
- `packages/meta-social/src/__fixtures__/shopify.html` — perfil Shopify, con la imagen social escrita en forma protocol-relative
- `packages/meta-social/src/__fixtures__/webflow.html` — perfil Webflow, sin og:url, sin og:type y sin twitter:card, con los campos de X por el atributo alterno
- `packages/meta-social/src/__fixtures__/next-metadata.html` — perfil Next.js Metadata API, con og:description de 235 caracteres
- `packages/meta-social/src/__fixtures__/no-og.html` — sitio sin ninguna etiqueta social, piso del conjunto

## Decisions Made

Las decisiones están arriba en `key-decisions`. Dos merecen rationale expandido:

- **El perfil `yoast` se mide con la URL de su propio fixture.** Los cinco fixtures nuevos declaran su `og:url` con el prefijo `https://example.com/perfil/<nombre>` y la página se construye con esa misma URL, así que SOCIAL-04 compara contra la referencia correcta. `yoast.html` es artefacto de 30-01, declara `https://ejemplo.com/guia-auditoria-seo/` y sujeta las aserciones de `extract.test.ts`. Uniformar su URL habría reabierto un plan hermano por una cuestión cosmética, y medirlo con una URL que su propio documento no declara habría producido una fila de SOCIAL-04 que no dice nada sobre el emisor sino sobre el arnés. El mapa `PROFILE_PAGE_URL` deja la excepción explícita y documentada en vez de escondida.
- **El aserto de frontera entre categorías es de intersección y no de unicidad global.** Un fingerprint duplicado que ya existiera dentro de las cinco categorías viejas es deuda anterior a esta fase, y ponerla como condición de cierre de la fase 30 haría que el guardarraíl falle por un defecto del que esta fase no es responsable ni puede arreglar sin salirse de alcance. Lo que sí es responsabilidad de la categoría nueva es no pisar a las viejas, y eso es exactamente lo que se asserta.

## Deviations from Plan

Una precisión de ejecución, ninguna deviación de las Reglas 1 a 4: ningún bug auto-corregido, ninguna funcionalidad crítica faltante, ningún bloqueo y ningún cambio arquitectónico.

**Precisión: un helper exportado más de los que el plan nombraba.** El plan pedía un solo helper puro, `findDuplicateFingerprints`. El archivo exporta además `findSharedFingerprints`, por el mismo motivo que el plan da para el primero: el caso 6 exige que la autoprueba cubra también el comparador de intersección con el identificador retirado ("de modo que la aserción del caso dos tampoco pueda pasar por un comparador roto"), y un comparador inline dentro del `it` no se puede autoprobar. Es la lectura que el propio caso 6 del plan exigía, y no cambia comportamiento respecto de lo planeado.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** ninguno. Sin scope creep: los 8 archivos del plan son los 8 archivos tocados, más este SUMMARY.

## Issues Encountered

Ninguno que haya requerido corrección. Dos observaciones de medición:

- La tabla de detección de diseño coincidió con la medición en la primera corrida, así que no se dio el escenario que el plan advertía (fixture que no representa lo que dice, o rama de check mal escrita). No hubo que investigar ninguna diferencia ni ajustar ninguna expectativa después de medir.
- El número de corrida en frío que `30-05-SUMMARY.md` dejó anotado (16.2 s) no se reprodujo: la suite de `@auditor/checks` cierra en 3.80 s y el monorepo completo en 4.34 s, dentro del máximo de 10 s de `30-VALIDATION.md`.

## Verificación final

- `pnpm --filter @auditor/checks test`: **240 de 240 en 39 archivos**, contra la línea base de 152 tests en 28 archivos del 2026-08-01, y por encima del piso de 31 archivos que exigía el plan. Los 12 casos nuevos son los 6 del guardarraíl, los 2 del registry y los 4 de la calibración.
- `pnpm --filter @auditor/meta-social test`: 17 de 17 (sin cambios: este plan agrega fixtures, no tests, a ese paquete).
- `pnpm typecheck` (monorepo): 17 de 17 tareas exitosas.
- `pnpm test` (monorepo): 14 de 14 tareas exitosas, 4.34 s.
- `pnpm build` (monorepo): 2 de 2 tareas exitosas.
- `pnpm assert:web-boundary`: **PASS** — el paquete nuevo de la fase no ensució el grafo que resuelve la aplicación web.
- Gates estructurales de la Tarea 1: `pageFingerprint` (5), fingerprint del retirado escrito a mano como literal (0) y como plantilla interpolada (0), `runAllChecks` (3), import del barrel de la categoría (0).
- Gates estructurales de la Tarea 2: `SOCIAL_CHECK_IDS` (3), `RETIRED_CHECK_ID` (3), `PERF_CHECK_IDS` (4), líneas borradas del archivo (**0**).
- Gates estructurales de la Tarea 3: fixtures `.html` en el motor puro (**7**), `scoreCategory` (3), `__fixtures__` (1), `readFileSync` (3).
- Anfitriones que aparecen en los siete fixtures: `//cdn.example.com`, `https://ejemplo.com`, `https://example.com`. Todos del espacio de dominios de ejemplo, ninguno real, ninguna referencia externa que dispare una petición.
- `git status --short` sobre `packages/checks/src/checks/social/` filtrando los `.test.ts`: salida vacía. Sobre `packages/checks/package.json`, `packages/meta-social/package.json`, `pnpm-lock.yaml`, `packages/checks/src/registry.ts` y `packages/checks/src/index.ts`: salida vacía.

## Known Stubs

Ninguno. Este plan no crea código de producción: crea tests y fixtures. Los ocho checks de la categoría están implementados y cableados desde 30-05, y este plan lo prueba en vez de asumirlo.

## Threat Flags

Ninguno. El plan no crea superficie de red, ni endpoints, ni variables de entorno, ni cambios de esquema, ni instala paquetes. Las filas del registro STRIDE quedan así:

- **T-30-09 (guardarraíl que no puede fallar):** mitigada con los tres mitigantes exigidos — guarda anti vacuidad como primer caso, autoprueba de detección con datos sintéticos para los dos comparadores, y prueba de dientes por mutación de la constante del test, ejecutada y revertida.
- **T-30-10 (la medición habilitando una edición de rama):** mitigada. La condición de parada no se disparó y ninguna rama de ningún check se tocó; la remediación queda registrada y devuelta a planeación con el número a la vista.
- **T-30-11 (fixture con datos reales):** mitigada y verificada por la lista de anfitriones de arriba.
- **T-30-12 (costo de la corrida de calibración):** aceptada. Seis documentos de pocos kilobytes, 24 ms de tests en el archivo de calibración.
- **T-30-SC (legitimidad de paquetes):** aceptada sin acción. Cero paquetes instalados, diff del lockfile vacío.

**Traspaso vivo, no cubierto acá:** T-30-05, el valor de meta tag controlado por el sitio auditado que se persiste como texto en el campo de valor medido, sigue aceptado con traspaso a la fase 32. Ningún test de este plan lo cubre y no debe leerse como si lo hiciera.

## User Setup Required

Ninguno. La fase no agrega variables de entorno, ni claves, ni servicios externos.

## Verificación humana pendiente (única de la fase)

`30-VALIDATION.md` declara una sola verificación manual para toda la fase 30, y es esta. Juan revisa la tabla medida de arriba y responde una pregunta:

**El promedio medido es 83.67.** Queda por debajo del umbral de 85 que el plan fijó como falsificación de la banda estimada, pero por encima del techo de 80 de la banda objetivo de la asunción A3 (60-80). O sea: la banda estimada quedó corta por menos de cuatro puntos, y la categoría discrimina bien (separación de 55 puntos, piso de 45).

Las dos opciones sobre la mesa:

- **Aceptar para v1.6** y anotarlo como nota de calibración para una fase posterior. Es lo que el plan recomienda: no hay saturación, el modo de falla real no se manifestó, y el conjunto de seis perfiles es una medición sobre un conjunto declarado y no una estadística poblacional.
- **Abrir un plan de remediación** que le quite la fila de severidad correcta a SOCIAL-06 y SOCIAL-08, los dos que nunca disparan. Costo asumido: reabre 30-04 y 30-05, pone en falso un criterio de aceptación ya aceptado, cambia el volumen de filas persistidas por página y hace que la primera auditoría posterior marque como resueltos fingerprints que nadie corrigió.

## Next Phase Readiness

- **La fase 30 cierra sin ítems sin cubrir.** Las ocho filas de requisito, los cinco criterios de aceptación del ROADMAP, las tres discrepancias resueltas de la investigación (D-1, D-2, D-3) y las siete trampas documentadas quedan cubiertas entre 30-01 y 30-06, con la auditoría de fuentes sin filas MISSING.
- **Fase 31 (checks de red de imagen social)** hereda seis fixtures de perfil listos para reutilizar y el guardarraíl de fingerprint ya montado: cualquier checkId nuevo que colisione con la categoría social o con el retirado pone la suite en rojo sin escribir un test nuevo, siempre que se registre por el barrel.
- **Fase 32 (panel de preview social)** consume `@auditor/meta-social` desde el grafo de Vercel, con los seis fixtures como base de casos visuales, y debe revalidar el valor de meta tag antes de usarlo como atributo de enlace o de imagen (T-30-05).
- **Nota de calibración abierta:** si el mix real de clientes tiene más sitios sin etiquetas de los que representa un conjunto de seis, la banda real va a ser más baja que 83.67; si tiene más sitios con plugin de SEO bien configurado, más alta. Ampliar el conjunto es agregar un archivo HTML y una fila a la tabla del test: sin migración de datos y sin tocar ningún check. Falta Wix, que la investigación nombra dentro del universo objetivo.

## Self-Check: PASSED

Los 7 archivos declarados como creados existen en disco, el archivo modificado existe, y los 3 hashes de commit de tarea (`03bcd45`, `66c339e`, `8038d06`) están en el historial de git. Verificado con `test -f` por archivo y `git log --oneline --all | grep` por hash.

---
*Phase: 30-checks-de-meta-tags-social*
*Completed: 2026-08-03*
