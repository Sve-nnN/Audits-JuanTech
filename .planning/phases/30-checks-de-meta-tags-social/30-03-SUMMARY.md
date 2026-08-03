---
phase: 30-checks-de-meta-tags-social
plan: 03
subsystem: checks
tags: [open-graph, og-image, og-url, canonical, url-normalization, cheerio, vitest]

# Dependency graph
requires:
  - phase: 30-01
    provides: "packages/meta-social (extractMetaSocial, firstValue), barrel social/index.ts cableado en registry.ts, convenciones C-1 a C-6, checkId plano decidido como option-a"
  - phase: 30-02
    provides: "MAX_MEASURED_VALUE_CHARS (80) en packages/meta-social/src/thresholds.ts y su primer consumidor ogType.ts"
provides:
  - "ogImageCheck (SOCIAL-03): og:image presente y con URL absoluta HTTPS, con cinco ramas de fallo criticas distinguibles entre si"
  - "ogUrlCheck (SOCIAL-04): og:url presente y coherente con la canonical releida del contexto, sin depender de TECH-04"
  - "socialPageChecks pasa de tres a cinco entradas, en orden ascendente por checkId"
  - "Invariante de no contradiccion entre ogUrlCheck y canonicalCheck assertada en test"
  - "Invariante de orden y no duplicacion del barrel convertida en aserto automatico"
affects: [30-04, 30-05, 30-06, 31-checks-de-red-de-imagen-social, 32-reporte-social]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Resolucion de URL dentro de la capa de checks (import de normalizeUrl desde @auditor/crawler), nunca dentro del motor puro"
    - "Deteccion de URL relativa por prefijo de esquema sobre copia en minusculas, no por igualdad crudo/resuelto"
    - "Recorte de texto controlado por el sitio con helper local de una linea sobre la constante compartida de la categoria"

key-files:
  created:
    - packages/checks/src/checks/social/ogImage.ts
    - packages/checks/src/checks/social/ogImage.test.ts
    - packages/checks/src/checks/social/ogUrl.ts
    - packages/checks/src/checks/social/ogUrl.test.ts
  modified:
    - packages/checks/src/checks/social/index.ts
    - packages/checks/src/checks/social/ogType.test.ts

key-decisions:
  - "SOCIAL-03: las cinco ramas de fallo (ausente, sin protocolo, esquema no utilizable, relativa, insegura) salen todas critical; la rama de esquema no utilizable, que C-4 no enumeraba, se resolvio como critical por pertenecer a la misma familia y ser estrictamente peor que la relativa"
  - "La deteccion de URL absoluta compara el prefijo del esquema (http:// o https://) sobre una copia en minusculas, en vez de startsWith(\"http\") a secas, para no clasificar como absoluta una ruta relativa que empiece con las letras http"
  - "La rama de valor no utilizable va antes que la de relativa en SOCIAL-03 y antes que la de coherencia en SOCIAL-04: es la funcion de normalizacion la que decide que esquema es aceptable, no una lista propia dentro del check"
  - "SOCIAL-04 relee la canonical del objeto de consulta con el mismo selector y el mismo fallback que canonicalCheck, y normaliza los dos lados antes de comparar, para que el reporte no pueda contener dos veredictos opuestos sobre la misma pagina"
  - "El measuredValue comparativo de la rama incoherente de SOCIAL-04 recorta cada mitad por separado, no la cadena ya compuesta, para que un valor hostil no deje fuera la mitad que explica el hallazgo"
  - "La asercion de barrel de ogType.test.ts pasa de longitud exacta a pertenencia, para que cada ola posterior no ponga en rojo un archivo ajeno"

patterns-established:
  - "Invariante de no contradiccion entre categorias: un check que compara contra otra senal de la misma pagina importa el check existente en su propio test y afirma los dos veredictos sobre una unica pagina construida con diferencias que la normalizacion absorbe"
  - "Invariante de barrel: orden ascendente por checkId y ausencia de duplicados assertados automaticamente, no por prosa"
  - "Prueba de dientes por mutacion y reversion como cierre de plan cuando los tests se escriben despues del codigo"

requirements-completed: [SOCIAL-03, SOCIAL-04]

coverage:
  - id: D1
    description: "SOCIAL-03 distingue las cinco formas de fallo de og:image con severidad critica y emite fila ok con la cadena literal sin accion cuando la URL es absoluta y segura"
    requirement: "SOCIAL-03"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogImage.test.ts#marca como crítica la ausencia de og:image"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogImage.test.ts#marca como crítica una og:image con ruta relativa"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogImage.test.ts#marca como crítica una og:image sin protocolo y la distingue de la relativa"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogImage.test.ts#marca como crítica una og:image sobre http en una página servida sobre https"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogImage.test.ts#marca como crítica una og:image con un esquema que no es http ni https"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogImage.test.ts#aprueba la misma imagen escrita como URL absoluta https"
        status: pass
    human_judgment: false
  - id: D2
    description: "SOCIAL-03 resuelve el veredicto con la primera etiqueta og:image en orden de documento, segun la regla de precedencia del protocolo Open Graph"
    requirement: "SOCIAL-03"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogImage.test.ts#resuelve el veredicto con la primera etiqueta og:image en orden de documento"
        status: pass
    human_judgment: false
  - id: D3
    description: "SOCIAL-04 compara la og:url normalizada contra la canonical releida del contexto y normalizada con la misma funcion, con la URL de la pagina como referencia declarada cuando no hay canonical"
    requirement: "SOCIAL-04"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#aprueba una og:url igual a la canonical explícita de la página"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#marca como advertencia una og:url que apunta a otra URL que la canonical"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#aprueba una og:url igual a la URL de la página cuando no hay canonical"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#marca como advertencia una og:url que apunta a otra dirección cuando no hay canonical"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#resuelve la canonical relativa contra la página antes de comparar"
        status: pass
    human_judgment: false
  - id: D4
    description: "El reporte no puede contener dos veredictos contradictorios sobre la misma pagina: canonicalCheck y ogUrlCheck emiten los dos fila ok ante diferencias de barra final y parametro de tracking"
    requirement: "SOCIAL-04"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#no contradice a canonicalCheck sobre una página con diferencias cosméticas"
        status: pass
    human_judgment: false
  - id: D5
    description: "Los dos checks recortan todo texto controlado por el sitio al tope compartido MAX_MEASURED_VALUE_CHARS (mitigacion T-30-06 y T-30-07)"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogImage.test.ts#recorta el valor medido al tope compartido de la categoría"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#recorta el valor medido al tope compartido de la categoría"
        status: pass
    human_judgment: false
  - id: D6
    description: "Todas las ramas de cada check comparten un unico fingerprint por pagina, construido con la funcion real y sin subtipo (C-5)"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogImage.test.ts#emite el mismo fingerprint en todas las ramas sobre la misma URL"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#emite el mismo fingerprint en todas las ramas sobre la misma URL"
        status: pass
    human_judgment: false
  - id: D7
    description: "Los dos checks estan en socialPageChecks en orden ascendente por checkId y sin duplicados, assertado automaticamente"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#mantiene los checkId en orden ascendente"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/social/ogUrl.test.ts#no repite ningún checkId"
        status: pass
    human_judgment: false
  - id: D8
    description: "Ninguno de los dos checks abre conexiones de red ni importa un cliente HTTP (frontera T-30-06 no cruzada en esta fase)"
    verification:
      - kind: other
        ref: "grep -v '^\\s*[/*]' packages/checks/src/checks/social/{ogImage,ogUrl}.ts | grep -Ec 'fetch\\(|axios|undici|node-fetch|https?\\.get' == 0 y grep -c 'async' == 0 en ambos archivos"
        status: pass
    human_judgment: false
  - id: D9
    description: "Las dos regresiones que el plan existe para prevenir (og:image relativa dada por buena, comparacion cruda contra la canonical) estan demostradas como detectables por mutacion y reversion"
    verification:
      - kind: other
        ref: "Mutacion A (rama relativa eliminada) y Mutacion B (comparacion cruda) ejecutadas contra pnpm --filter @auditor/checks test; ambas exit 1 con los casos esperados en rojo; archivos restaurados con git diff vacio"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-02
status: complete
---

# Phase 30 Plan 03: Checks de URL social (og:image y og:url) Summary

**SOCIAL-03 detecta og:image relativa, protocol-relative, de esquema no utilizable e insegura como cinco fallos criticos distinguibles, y SOCIAL-04 compara og:url contra la canonical releida del contexto con la misma normalizacion que canonicalCheck, con la no contradiccion entre ambos checks assertada en test.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-02T22:02:40Z
- **Completed:** 2026-08-02T22:14:20Z
- **Tasks:** 3
- **Files modified:** 6 (4 creados, 2 modificados)

## Accomplishments

- `ogImageCheck` (SOCIAL-03), el hallazgo que la investigacion de milestone califica como el de mayor valor: una og:image escrita como ruta relativa rompe la vista previa en Facebook y LinkedIn y hasta ahora ningun check del catalogo la detectaba. Las cinco formas de fallo se distinguen por el titulo del issue y ninguna se confunde con la rama correcta.
- `ogUrlCheck` (SOCIAL-04), el unico check de la fase que compara contra otra senal de la misma pagina. Relee la canonical del objeto de consulta con el mismo selector y el mismo fallback que `canonicalCheck`, sin importar nada de la carpeta `tech` y sin asumir que TECH-04 haya corrido.
- La invariante de no contradiccion quedo encodada: un caso de test construye una unica pagina donde URL, canonical y og:url difieren solo por barra final y parametro de tracking, corre los dos checks sobre ella y exige fila `ok` en ambos.
- La regla de orden del barrel dejo de ser prosa: `socialPageChecks` tiene ahora aserto automatico de orden ascendente por checkId y de ausencia de duplicados, y se mantiene verde por construccion cuando 30-04 y 30-05 agreguen sus checks al final.
- Las dos regresiones que el plan existe para prevenir se demostraron detectables por mutacion temporal y reversion, no por transcripcion de lo que el codigo ya hace.

## Task Commits

1. **Tarea 1: SOCIAL-03, og:image presente y con URL absoluta HTTPS** - `08bac0c` (feat)
2. **Tarea 2: SOCIAL-04, og:url presente y coherente con la canonical releida del contexto** - `f7acca3` (feat)
3. **Tarea 3: prueba de dientes y cierre de la ola** - sin commit propio: la tarea es de verificacion pura y sus dos mutaciones se revirtieron antes de commitear, dejando `git diff` vacio sobre los dos archivos de produccion. Sus resultados quedan transcritos abajo.

## Files Created/Modified

- `packages/checks/src/checks/social/ogImage.ts` - `ogImageCheck` (SOCIAL-03): seis ramas (ausencia, sin protocolo, valor no utilizable, relativa, insegura, correcta), todas con el mismo `CRITERION` y el mismo `pageFingerprint(CHECK_ID, url)`.
- `packages/checks/src/checks/social/ogImage.test.ts` - diez casos: las cinco ramas obligatorias de `30-VALIDATION.md`, el recorte de 500 a 80 caracteres, la precedencia de la primera etiqueta en las dos direcciones, el atributo alterno y el contrato de fingerprint.
- `packages/checks/src/checks/social/ogUrl.ts` - `ogUrlCheck` (SOCIAL-04): cuatro ramas (ausencia, valor no utilizable, incoherente, correcta), con la canonical releida del contexto y los dos lados de la comparacion normalizados.
- `packages/checks/src/checks/social/ogUrl.test.ts` - diez casos del check (incluida la no contradiccion con `canonicalCheck`) mas dos del bloque de barrel.
- `packages/checks/src/checks/social/index.ts` - `socialPageChecks` pasa de tres a cinco entradas, en orden SOCIAL-01, 02, 03, 04, 05.
- `packages/checks/src/checks/social/ogType.test.ts` - aserto de barrel relajado de longitud exacta a pertenencia (ver deviacion 1).

## Decisions Made

- **La rama de esquema no utilizable de SOCIAL-03 sale `critical`.** C-4 no la enumeraba porque solo aparece al leer el comportamiento real de `normalizeUrl`, que devuelve nulo para todo protocolo distinto de http y https. Se resolvio como `critical` por pertenecer a la misma familia que las otras cuatro y ser estrictamente peor que la relativa, que al menos resuelve a un recurso alcanzable. Resultado: SOCIAL-03 no tiene ninguna rama de fallo en `warning`.
- **La deteccion de absoluta compara el prefijo completo del esquema.** El plan pedia comparar contra "el prefijo del esquema http" sobre una copia en minusculas. Se implemento como `startsWith("http://") || startsWith("https://")` en vez de `startsWith("http")` a secas: con el prefijo corto, una ruta relativa como `http-images/preview.png` se clasificaria como absoluta y pasaria a la rama correcta. Es mas estricto que lo pedido y no cambia ningun veredicto de los casos del plan.
- **El orden de ramas es el que fija quien decide.** En los dos checks la rama de valor no utilizable va antes de cualquier comparacion o clasificacion de formato, de modo que es `normalizeUrl` la que decide que esquema es aceptable y el check no mantiene una lista propia de esquemas que se desincronice.
- **La rama incoherente de SOCIAL-04 recorta cada mitad por separado.** Si se recortara la cadena ya compuesta, un valor hostil de 500 caracteres en og:url dejaria fuera toda la parte de la canonical y la fila perderia justo la mitad que explica el hallazgo.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Aserto de longitud exacta del barrel en un test de 30-02**

- **Found during:** Tarea 1 (registro de `ogImageCheck` en el barrel)
- **Issue:** `ogType.test.ts`, escrito en 30-02, afirmaba `expect(socialPageChecks).toHaveLength(3)`. Agregar un check al array del barrel (que es exactamente lo que este plan hace por diseno, y lo que haran 30-04 y 30-05) ponia ese archivo ajeno en rojo y bloqueaba el `verify` de la Tarea 1.
- **Fix:** El aserto pasa de longitud exacta a pertenencia. La cobertura real que ese caso buscaba (que SOCIAL-05 quedo registrado junto a sus hermanos de ola) se mantiene intacta via `expect.arrayContaining`. La cobertura de longitud y unicidad se reconstituye, y de forma no fragil, en el bloque de barrel de `ogUrl.test.ts` que la Tarea 2 agrega: orden ascendente y ausencia de duplicados.
- **Files modified:** `packages/checks/src/checks/social/ogType.test.ts`
- **Verification:** `pnpm --filter @auditor/checks test` en verde; los dos asertos nuevos del bloque de barrel cubren lo que el conteo fijo cubria peor.
- **Committed in:** `08bac0c` (commit de la Tarea 1)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** El arreglo era necesario para completar la Tarea 1 y no amplia el alcance: toca un unico aserto de un test existente y su intencion queda mejor cubierta que antes. Sin scope creep.

## Prueba de dientes (Tarea 3)

Los tests de las Tareas 1 y 2 se escribieron despues del codigo, asi que el rojo se produjo por mutacion temporal y se revirtio antes de commitear.

**Mutacion A — regresion del Pitfall 6.** Se elimino de `ogImage.ts` la rama de URL relativa, de modo que un valor de ruta relativa cayera hasta la rama correcta.

- Codigo de salida de la corrida combinada: **1** (distinto de 0, como exige el criterio).
- Casos fallidos: `marca como crítica una og:image con ruta relativa`, `resuelve el veredicto con la primera etiqueta og:image en orden de documento` y `recorta el valor medido al tope compartido de la categoría` (este ultimo tambien usa un valor relativo, asi que cae con la misma rama). Total: 3 fallidos, 198 verdes de 201.
- **El caso de og:image sin protocolo siguio en verde**, porque tiene guarda propia antes de la resolucion. Esto demuestra que las dos ramas son independientes y que ninguna de las dos pasa por accidente de la otra.
- Tras revertir: `git diff` vacio sobre el archivo y suite en verde.

**Mutacion B — regresion de la contradiccion entre checks.** Se reemplazo en `ogUrl.ts` la comparacion entre valores normalizados por una comparacion entre el valor crudo de og:url y el valor crudo de la canonical.

- Codigo de salida de la corrida combinada: **1**.
- Casos fallidos: exactamente los dos esperados, `no contradice a canonicalCheck sobre una página con diferencias cosméticas` y `resuelve la canonical relativa contra la página antes de comparar`. Total: 2 fallidos, 199 verdes de 201. El resto del archivo siguio en verde, incluido el caso de coherencia con canonical explicita.
- Tras revertir: `git diff` vacio sobre el archivo y suite en verde.

## Cierre de la ola 3

- `pnpm typecheck`: exit 0, 17 tareas correctas.
- `pnpm test`: exit 0, 14 paquetes correctos.
- `pnpm build`: exit 0.
- `@auditor/checks`: **201 tests en 34 archivos**, arriba de los 179 en 32 archivos que dejo 30-02 (+22: diez de `ogImage.test.ts` y doce de `ogUrl.test.ts`). Linea base historica de la fase: 152 al 2026-08-01.
- `git status --porcelain packages/checks/package.json packages/meta-social`: sin cambios. El motor puro sigue con una sola dependencia de runtime y ninguna declaracion de dependencias se toco.
- `git diff --stat pnpm-lock.yaml`: sin lineas. Cero instalaciones.
- `git status --porcelain packages/checks/src/registry.ts`: sin cambios. El cableado con el catalogo global lo hizo 30-01 y este plan solo amplio el barrel de la categoria.

## Issues Encountered

Ninguno mas alla de la deviacion documentada. `normalizeUrl` se comporto exactamente como describe el bloque de interfaces del plan, incluido el retorno nulo para `javascript:` y `data:`, asi que la rama de valor no utilizable quedo cubierta sin ninguna lista de esquemas propia.

## Known Stubs

Ninguno. Los dos checks estan completamente cableados: leen del extractor real, resuelven con la funcion de normalizacion real, y sus dos entradas estan en el barrel que `registry.ts` ya consume.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 30-04 (SOCIAL-06 duplicados y SOCIAL-07 twitter) puede arrancar: el barrel acepta entradas nuevas al final sin tocar `registry.ts`, y el aserto de orden ascendente lo mantiene honesto por construccion.
- Phase 31 hereda una frontera declarada y aun no cruzada: la validacion por red de og:image. Debe traer su propia defensa (lista de destinos permitidos, rechazo de direcciones privadas y de bucle local, limite de redirecciones y de tiempo) porque `ogImageCheck` deja el valor validado como formato pero no como destino alcanzable.
- Phase 32 hereda el traspaso explicito de T-30-02: el `measuredValue` que pinta en el panel de vista previa puede contener texto controlado por el sitio auditado (recortado a 80 caracteres, pero no sanitizado), y debe revalidarlo antes de usarlo como destino de un enlace o de una imagen.

## Self-Check: PASSED

Los cuatro archivos declarados como creados existen en disco, el archivo modificado del barrel esta en el arbol de trabajo, y los dos hashes de commit de tarea (`08bac0c`, `f7acca3`) figuran en `git log`.

---
*Phase: 30-checks-de-meta-tags-social*
*Completed: 2026-08-02*
