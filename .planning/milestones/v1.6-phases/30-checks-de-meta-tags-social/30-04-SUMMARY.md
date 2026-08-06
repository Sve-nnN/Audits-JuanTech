---
phase: 30-checks-de-meta-tags-social
plan: 04
subsystem: checks
tags: [open-graph, twitter-cards, duplicados, fingerprint-subtipado, cheerio, vitest]

# Dependency graph
requires:
  - phase: 30-01
    provides: "packages/meta-social (extractMetaSocial, firstValue, Map de claves normalizadas), barrel social/index.ts cableado en registry.ts, convenciones C-1 a C-6, checkId plano decidido como option-a"
  - phase: 30-02
    provides: "MAX_MEASURED_VALUE_CHARS (80) en packages/meta-social/src/thresholds.ts, tope compartido de toda la categoria"
  - phase: 30-03
    provides: "Aserciones de barrel no fragiles (pertenencia, orden ascendente, sin duplicados) y el helper cap de una linea sobre la constante compartida"
provides:
  - "ogDuplicatesCheck (SOCIAL-06): primer check multi hallazgo de la categoria, marca solo duplicados de Open Graph con contenidos contradictorios"
  - "twitterCardCheck (SOCIAL-07): evalua twitter:card en toda pagina y aplica la regla de fallback a Open Graph sobre los tres campos secundarios"
  - "TWITTER_CARD_VALUES en el paquete puro, lista unica de valores admitidos que Phase 32 reusa para el preview"
  - "socialPageChecks pasa de cinco a siete entradas, en orden ascendente por checkId, con registry.ts intacto"
  - "Subtipado de fingerprint estrenado en la categoria social: clave de Open Graph en SOCIAL-06 y cinco subtipos literales en SOCIAL-07"
affects: [30-05, 30-06, 31-checks-de-red-de-imagen-social, 32-reporte-social]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Agrupacion multi hallazgo leyendo directamente el Map del extractor, sin acumulador propio indexado por clave controlada por el sitio (T-30-01)"
    - "Subtipos de fingerprint declarados como literales en una tabla de campos, no compuestos por template, para que sigan siendo encontrables por busqueda de texto en el codigo"
    - "Regla anti falso positivo escrita como una sola expresion de dos terminos, nunca como rama que marca mas rama que perdona"

key-files:
  created:
    - packages/checks/src/checks/social/ogDuplicates.ts
    - packages/checks/src/checks/social/ogDuplicates.test.ts
    - packages/checks/src/checks/social/twitterCard.ts
    - packages/checks/src/checks/social/twitterCard.test.ts
  modified:
    - packages/meta-social/src/thresholds.ts
    - packages/meta-social/src/index.ts
    - packages/checks/src/checks/social/index.ts

key-decisions:
  - "SOCIAL-06 devuelve array vacio cuando la pagina no tiene ninguna etiqueta de Open Graph: sin nada que duplicar, una fila de aprobado seria un aprobado trivial justo en el perfil de sitio que peor puntua (Pitfall 5)"
  - "El subtipo de fingerprint de SOCIAL-06 es la clave normalizada cruda (og:title, og:image), inyectiva por construccion: cualquier reescritura de caracteres podria dar el mismo fingerprint a dos claves distintas"
  - "El measuredValue de SOCIAL-06 son dos numeros derivados (cantidad de etiquetas y cantidad de valores distintos) y nunca el contenido de las etiquetas, asi que el vector de T-30-06 no existe en ese check por diseno y no por recorte"
  - "La fila ok de SOCIAL-06 concuerda en numero gramatical: 1 propiedad og distinta en singular, N propiedades og distintas en plural"
  - "Los cinco subtipos de SOCIAL-07 se declaran como cadenas literales en la tabla FALLBACK_FIELDS en vez de componerse como missing-${field}: son valores persistidos que se leen tal cual en el diff entre auditorias y tienen que poder encontrarse por busqueda de texto"
  - "La comparacion del valor de twitter:card baja a minusculas y aplica trim antes de buscar en la lista, para no marcar como invalido un valor que solo difiere en capitalizacion"
  - "La fila ok de SOCIAL-07 usa cap(card ?? \"\") porque es inalcanzable con la tarjeta ausente, pero el estrechamiento de tipos no lo puede probar; el comentario deja constancia en vez de forzar un casteo"

patterns-established:
  - "Prueba de dientes por mutacion y reversion, una mutacion por regla de negocio lockeada, con transcripcion de codigo de salida y casos rotos en el SUMMARY"
  - "Multi hallazgo con helper push de firma fija (subtype, title, criterion, recommendation, measuredValue?) cuando hay cinco formas de fila, y sin helper cuando hay una sola forma repetida por clave"

requirements-completed: [SOCIAL-06, SOCIAL-07]

coverage:
  - id: D1
    description: "SOCIAL-06 marca una etiqueta de Open Graph repetida con contenidos distintos y no marca la repetida con contenido identico, incluido el cruce de los atributos property y name"
    requirement: "SOCIAL-06"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogDuplicates.test.ts#marca una única advertencia cuando la misma clave og trae contenidos distintos"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogDuplicates.test.ts#no marca nada cuando la clave repetida trae exactamente el mismo contenido"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogDuplicates.test.ts#marca el cruce de los dos atributos de emisor con contenidos distintos"
        status: pass
      - kind: other
        ref: "Mutacion A: quitar el termino distinct.size > 1 pone en rojo el caso de contenido identico (exit 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SOCIAL-06 limita su alcance a Open Graph y no emite ninguna fila en una pagina sin etiquetas og"
    requirement: "SOCIAL-06"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogDuplicates.test.ts#deja fuera de alcance los duplicados del vocabulario de X"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogDuplicates.test.ts#no emite ninguna fila en una página sin etiquetas de Open Graph"
        status: pass
    human_judgment: false
  - id: D3
    description: "SOCIAL-07 evalua twitter:card en toda pagina, con ausencia y valor no admitido como hallazgos distintos y comparacion insensible a mayusculas"
    requirement: "SOCIAL-07"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/twitterCard.test.ts#emite las cuatro filas en una página sin tarjeta y sin Open Graph"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/twitterCard.test.ts#marca un valor de tarjeta que no está en la lista admitida"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/twitterCard.test.ts#acepta un valor admitido escrito con mayúsculas y con espacios alrededor"
        status: pass
    human_judgment: false
  - id: D4
    description: "SOCIAL-07 solo marca un campo secundario cuando falta tambien su equivalente de Open Graph (regla anti falso positivo)"
    requirement: "SOCIAL-07"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/twitterCard.test.ts#no marca la falta de twitter:image cuando og:image está presente"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/twitterCard.test.ts#marca la imagen exactamente una vez cuando faltan twitter:image y og:image"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/twitterCard.test.ts#no marca el título cuando existe twitter:title aunque falte og:title"
        status: pass
      - kind: other
        ref: "Mutacion B: quitar el termino del equivalente og pone en rojo tres casos (exit 1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Ningun texto controlado por el sitio entra sin acotar al measuredValue persistido (mitigacion T-30-06)"
    requirement: "SOCIAL-07"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/twitterCard.test.ts#acota el valor medido de una tarjeta de longitud hostil"
        status: pass
    human_judgment: false
  - id: D6
    description: "Los dos checks corren dentro de pageChecks por el spread del barrel, con registry.ts sin una sola linea cambiada"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogType.test.ts (aserciones de pertenencia, orden ascendente y no duplicacion del barrel)"
        status: pass
      - kind: other
        ref: "git diff --numstat -- packages/checks/src/registry.ts packages/checks/src/index.ts (salida vacia)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Calibracion de la banda de score de la categoria social contra los cinco fixtures de perfil"
    verification: []
    human_judgment: true
    rationale: "Es la unica verificacion manual de la fase y esta asignada a 30-06, que la corre una vez que existan los ocho checks. Este plan solo aporta el insumo observado, no la decide."

# Metrics
duration: 9min
completed: 2026-08-02
status: complete
---

# Phase 30 Plan 04: Duplicados de Open Graph y Twitter Card Summary

**SOCIAL-06 marca etiquetas og repetidas solo cuando se contradicen y SOCIAL-07 evalua twitter:card en toda pagina aplicando fallback a Open Graph en los tres campos secundarios, los dos primeros checks multi hallazgo de la categoria**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-03T02:14:00Z
- **Completed:** 2026-08-03T02:23:00Z
- **Tasks:** 3
- **Files modified:** 7 (4 creados, 3 modificados)

## Accomplishments

- `ogDuplicatesCheck` (SOCIAL-06) agrupa sobre el `Map` del extractor y emite una fila por clave en conflicto, con la clave como subtipo de fingerprint. La regla queda escrita como las dos condiciones juntas (`values.length > 1 && distinct.size > 1`), asi que repetir la misma etiqueta con el mismo valor no produce ruido.
- El caso cruzado de D-2 (la misma clave emitida por `property` y por `name` con contenidos distintos) tiene test propio y sale en rojo el dia que alguien reintroduzca una lectura restringida a un solo vocabulario de atributo.
- `twitterCardCheck` (SOCIAL-07) emite cinco formas de hallazgo con fingerprints distintos entre si, y solo marca `twitter:title`, `twitter:description` o `twitter:image` cuando falta tambien su equivalente de Open Graph.
- `TWITTER_CARD_VALUES` vive en `packages/meta-social/src/thresholds.ts` con anotacion `readonly string[]`, exportada por el barrel del paquete: el archivo del check no redeclara la lista, asi que el preview de Phase 32 y el issue no se pueden contradecir.
- Las dos reglas de negocio lockeadas quedaron probadas por mutacion y no por transcripcion.
- `socialPageChecks` pasa de cinco a siete entradas manteniendo el orden ascendente por checkId, con `registry.ts` y `packages/checks/src/index.ts` sin una sola linea cambiada.

## Task Commits

1. **Tarea 1: SOCIAL-06 — duplicados de Open Graph con valores contradictorios** — `6a73f4e` (feat)
2. **Tarea 2: SOCIAL-07 — twitter:card y la regla de fallback a Open Graph** — `6a0ae81` (feat)
3. **Tarea 3: prueba de dientes por mutacion y cierre de ola** — sin commit propio por diseno: las dos mutaciones son cambios temporales que se revierten antes de commitear, asi que la tarea no deja diff. Su entregable es la transcripcion de abajo.

## Files Created/Modified

- `packages/checks/src/checks/social/ogDuplicates.ts` — SOCIAL-06, primer check multi hallazgo de la categoria
- `packages/checks/src/checks/social/ogDuplicates.test.ts` — 8 casos: conflicto, repeticion identica, cruce property/name, mayusculas mezcladas, dos claves en conflicto, alcance fuera de X, pagina sin og, fila ok
- `packages/checks/src/checks/social/twitterCard.ts` — SOCIAL-07, cinco subtipos de hallazgo mas fila ok
- `packages/checks/src/checks/social/twitterCard.test.ts` — 10 casos, incluidos los tres de la regla anti falso positivo y el de acotado de valor hostil
- `packages/meta-social/src/thresholds.ts` — agrega `TWITTER_CARD_VALUES`; `MAX_MEASURED_VALUE_CHARS` sigue declarado una sola vez con valor 80
- `packages/meta-social/src/index.ts` — reexporta la constante nueva en el bloque de constantes existente
- `packages/checks/src/checks/social/index.ts` — barrel de cinco a siete entradas, triple patron respetado

## Prueba de dientes por mutacion (Tarea 3)

Los tests se escribieron despues del codigo, asi que no pudieron arrancar en rojo por ausencia. El rojo se produjo por mutacion, una por regla de negocio lockeada, las dos revertidas.

**Mutacion A — regla de duplicados.** En `ogDuplicates.ts` se quito el termino `distinct.size > 1`, dejando solo `values.length > 1`.

- Codigo de salida de `pnpm --filter @auditor/checks test`: **1**
- Caso roto (unico): `no marca nada cuando la clave repetida trae exactamente el mismo contenido` — es exactamente el caso que la regla protege.
- Tras revertir con `git checkout --` sobre el archivo: codigo de salida **0**, 219 tests en verde.

**Mutacion B — regla anti falso positivo.** En `twitterCard.ts` se quito el termino `&& !firstValue(data, ogKey)`, dejando que la ausencia del campo del vocabulario de X marque siempre.

- Codigo de salida de `pnpm --filter @auditor/checks test`: **1**
- Casos rotos (tres): `no marca la falta de twitter:image cuando og:image está presente`, `emite una sola fila de aprobado con tarjeta válida y los tres equivalentes de Open Graph`, y `acepta un valor admitido escrito con mayúsculas y con espacios alrededor` — los dos ultimos son paginas bien configuradas que dejan de devolver una sola fila de aprobado.
- Tras revertir: codigo de salida **0**, 219 tests en verde.

**Observacion sobre la expectativa del plan.** El plan anticipaba que la mutacion B tambien pondria en rojo el caso `no marca el título cuando existe twitter:title aunque falte og:title`. No lo hace, y es correcto que no lo haga: en ese caso el `twitter:title` esta presente, asi que el primer termino de la condicion ya evita el hallazgo y el termino mutado no participa. Ese caso ejerce el otro termino de la expresion, no el del fallback. La cobertura no tiene hueco: la regla del fallback queda sujeta por los otros tres casos rotos.

`git diff` de los dos archivos de produccion quedo vacio al cerrar la tarea, verificado con `git diff --stat` sobre ambos.

## Gate de cierre de ola

- `pnpm --filter @auditor/meta-social typecheck` — codigo 0
- `pnpm --filter @auditor/meta-social test` — codigo 0, 8 tests
- `pnpm --filter @auditor/checks test` — codigo 0, **219 tests en 36 archivos** (linea base de 152 del 2026-08-01 mas lo agregado por 30-01 a 30-04)
- `pnpm typecheck` — codigo 0, 17 tareas
- `pnpm test` — codigo 0, todos los paquetes del monorepo en verde
- Latencia de feedback combinada (`meta-social` mas `checks`): **4.78 s**, dentro del maximo de 10 s de `30-VALIDATION.md`
- `git diff --numstat -- packages/checks/src/registry.ts packages/checks/src/index.ts` — salida vacia
- `git diff --stat pnpm-lock.yaml` — sin cambios, cero dependencias agregadas

## Insumo para la calibracion de 30-06

Ninguno de los dos checks aprueba en todos sus casos de prueba, asi que no hay senal de check trivialmente permisivo. Lo que si conviene mirar en 30-06 es el volumen: una pagina sin ninguna etiqueta social recibe cuatro filas solo de SOCIAL-07 (tarjeta mas los tres campos secundarios), mientras que SOCIAL-06 no aporta ninguna en ese mismo perfil por su rama de no aplicabilidad. En el extremo opuesto, una pagina bien configurada recibe exactamente dos filas `ok` de este plan. Ese reparto asimetrico entre el perfil peor y el mejor es el dato relevante para calibrar la banda de score de la categoria; no se toco nada de codigo por esta observacion.

## Decisions Made

Las decisiones estan arriba en `key-decisions`. Dos merecen rationale expandido:

- **Los subtipos de SOCIAL-07 van literales y no compuestos.** El plan describia recorrer los tres nombres de campo y derivar todo por concatenacion de prefijo. Las claves (`twitter:image`, `og:image`) si se derivan asi, pero el subtipo se declara literal en la tabla `FALLBACK_FIELDS`. El subtipo es un valor persistido que participa del diff entre auditorias, y un `missing-${field}` lo vuelve inencontrable por busqueda de texto en el codigo: quien audite manana que subtipos existen no puede leerlos, y la propia acceptance del plan (`grep -oE 'missing-title|...'`) lo pedia literal. Las claves no tienen ese problema porque no se persisten como identidad.
- **La fila `ok` de SOCIAL-06 concuerda en numero.** `1 propiedades og distintas` es incorrecto en castellano y el texto de un issue es copy de cara al usuario, no una etiqueta de debug. La redaccion es discrecion explicita de la convencion C-6.

## Deviations from Plan

Ninguna deviacion de las Reglas 1 a 4: ningun bug auto-corregido, ninguna funcionalidad critica faltante, ningun bloqueo, ningun cambio arquitectonico.

Dos precisiones de ejecucion, ninguna de las cuales cambia comportamiento respecto de lo planeado:

1. **Subtipos literales en SOCIAL-07** en vez de compuestos por template, explicado arriba. Es la lectura que la propia acceptance del plan exigia.
2. **Concordancia de numero en el `measuredValue` de la fila ok de SOCIAL-06**, dentro de la discrecion de redaccion de C-6.

**Total deviations:** 0 auto-fixed.
**Impact on plan:** ninguno. Sin scope creep: los 7 archivos del plan son los 7 archivos tocados, mas el SUMMARY.

## Issues Encountered

Ninguno. La precondicion de la Tarea 1 (los cinco checks de 30-01 a 30-03 presentes en el barrel) se verifico antes de editar y salio limpia, y `MAX_MEASURED_VALUE_CHARS = 80` seguia declarado una sola vez en `thresholds.ts`, asi que no hubo que parar por dependencia incompleta.

## Known Stubs

Ninguno. Los dos checks estan cableados de punta a punta: leen del extractor real, emiten filas reales y corren dentro de `pageChecks` por el spread del barrel.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Quedan dos checks de los ocho de la fase: SOCIAL-05 ya existe desde 30-02, asi que lo pendiente es SOCIAL-08 (charset en el primer KB) en 30-05 y el cierre de categoria en 30-06.
- El barrel esta en siete entradas y sus aserciones de pertenencia y orden siguen verdes, asi que 30-05 agrega la octava sin tocar nada mas.
- `TWITTER_CARD_VALUES` queda disponible para Phase 32: el preview social debe pintarse contra esa misma constante, no contra una copia.
- Asuncion abierta que 31 y 32 heredan: el retiro de los valores `photo`, `gallery` y `product` es conocimiento de ecosistema (A1), no un hecho verificado contra fuente oficial, porque X retiro su validador publico. Si se comprobara lo contrario, el arreglo es agregar el valor a la constante, no tocar el check.

## Self-Check: PASSED

Los cuatro archivos de codigo y el SUMMARY existen en disco, y los dos commits de tarea (`6a73f4e`, `6a0ae81`) estan en el historial.

---
*Phase: 30-checks-de-meta-tags-social*
*Completed: 2026-08-02*
