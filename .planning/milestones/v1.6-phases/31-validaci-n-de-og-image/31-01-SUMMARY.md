---
phase: 31-validaci-n-de-og-image
plan: 01
subsystem: api
tags: [network-check, ssrf, og-image, image-size, fetch, range-request, dns, vitest]

# Dependency graph
requires:
  - phase: 30-checks-de-meta-tags-social
    provides: "@auditor/meta-social (extractMetaSocial, firstValue, MAX_MEASURED_VALUE_CHARS) como motor puro de lectura de etiquetas sociales"
  - phase: 29-scoring-categoria-social
    provides: "categoría `social` en CATEGORY_WEIGHTS, que es la que puntúa las filas de IMG-01"
provides:
  - "ogImageNetworkCheck (checkId IMG-01, categoría social) registrado en networkChecks y emitiendo filas por el camino de producción"
  - "imageProbe.ts: transporte HTTP con un solo GET con cabecera Range, redirección manual acotada y timeout duro"
  - "ssrfGuard.ts: primera defensa de destino del proyecto (isPrivateAddress + assertPublicDestination)"
  - "concurrency.ts: mapWithConcurrency, runner de concurrencia acotada compartible que preserva el orden"
  - "image-size@2.0.2 como dependencia directa nueva de @auditor/checks"
affects: [31-02, 31-03, 31-04, 31-05, 32-panel-preview-social]

# Tech tracking
tech-stack:
  added: [image-size@2.0.2]
  patterns:
    - "Dedupe del fetch y fan-out de la emisión como dos decisiones independientes"
    - "Validación de destino antes de conectar y en cada salto de redirección"
    - "Vocabulario propio y corto de motivos de fallo, nunca el mensaje del error de red"

key-files:
  created:
    - packages/checks/src/checks/network/ogImageNetwork.ts
    - packages/checks/src/checks/network/ogImageNetwork.test.ts
    - packages/checks/src/checks/network/imageProbe.ts
    - packages/checks/src/checks/network/ssrfGuard.ts
    - packages/checks/src/checks/network/ssrfGuard.test.ts
    - packages/checks/src/checks/network/concurrency.ts
  modified:
    - packages/checks/src/checks/network/index.ts
    - packages/checks/package.json
    - pnpm-lock.yaml

key-decisions:
  - "emision-por-pagina: IMG-01 deduplica el fetch por URL de imagen pero hace fan-out de la emisión, una fila por cada página afectada, cada una con su propio pageId y su propio fingerprint"
  - "El sondeo abre UNA sola petición GET con cabecera Range, nunca un HEAD previo; ante 405 o 501 reintenta el mismo GET sin la cabecera de rango"
  - "El fingerprint lleva el subtipo dentro del primer argumento de pageFingerprint (IMG-01:og-image-unreachable) y el campo checkId queda plano en IMG-01"
  - "La clave de dedupe es la URL normalizada, pero la petición se hace contra la forma absoluta sin normalizar, porque normalizeUrl reordena los parámetros de query e invalida firmas de CDN"
  - "Un destino rechazado por nuestra propia defensa no emite fila de imagen rota: es ausencia de prueba, no prueba de defecto"
  - "mapWithConcurrency se declara sin async (devuelve la promesa) para que su firma sea exactamente la del contrato del plan"

patterns-established:
  - "Defensa de destino: resolver pidiendo TODAS las direcciones y rechazar si alguna es privada; clasificación por octetos, nunca por expresión regular sobre el nombre del anfitrión"
  - "Revalidación por salto: validar sólo la URL inicial es el bypass clásico, así que la comprobación se repite en cada redirección"
  - "Hooks de Vitest 4 con cuerpo de bloque: un hook que devuelve un valor invocable (como el mock que devuelve mockReset) se interpreta como función de limpieza"

requirements-completed: [IMG-01, IMG-02]

coverage:
  - id: D1
    description: "Una og:image que responde 404 produce filas IMG-01 críticas de categoría social por el camino de producción completo (runAllChecks con los checks de red activos)"
    requirement: "IMG-02"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/network/ogImageNetwork.test.ts#una og:image que responde 404 llega al resultado como fila crítica de la categoría social"
        status: pass
    human_judgment: false
  - id: D2
    description: "Una misma URL de og:image declarada en N páginas produce exactamente UNA llamada de red (dedupe del fetch, medido sobre invocaciones del sondeo)"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/ogImageNetwork.test.ts#dedup: la misma og:image en tres páginas se sondea una sola vez"
        status: pass
    human_judgment: false
  - id: D3
    description: "Esa misma imagen rota produce N filas, una por página, cada una con su propio pageId y su propio fingerprint (emision-por-pagina)"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/ogImageNetwork.test.ts#fan-out: una imagen rota compartida por tres páginas emite tres filas, una por página"
        status: pass
    human_judgment: false
  - id: D4
    description: "Una página sin og:image, o con una og:image de esquema no utilizable, no produce fila ni llamada de red"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/ogImageNetwork.test.ts#sin og:image"
        status: pass
    human_judgment: false
  - id: D5
    description: "El cap compartido MAX_URLS_PER_NETWORK_CHECK se comporta en los dos bordes: 150 sin fila informativa, 151 con exactamente una que declara cuántas de cuántas"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/ogImageNetwork.test.ts#cap: 150 imágenes únicas se sondean sin aviso; 151 se recortan a 150 con exactamente un aviso"
        status: pass
    human_judgment: false
  - id: D6
    description: "Ninguna petición sale hacia un destino privado, de bucle local, de enlace local o de metadatos de nube; la validación corre antes de abrir la conexión"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/ssrfGuard.test.ts#ssrf: un destino rechazado no invoca la función de fetch global ni una vez"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/ssrfGuard.test.ts (tabla de rangos, 14 casos)"
        status: pass
    human_judgment: false
  - id: D7
    description: "image-size@2.0.2 entra al grafo que Vercel resuelve sin romper la frontera del frontend"
    verification:
      - kind: other
        ref: "pnpm assert:web-boundary"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-08-03
status: complete
---

# Phase 31 Plan 01: Rebanada de punta a punta de IMG-01 Summary

**IMG-01 lee la og:image con el extractor social, la deduplica por URL normalizada, la sondea con un solo GET con rango validado contra una defensa de destino nueva, y emite una fila crítica por cada página afectada que llega viva hasta `runAllChecks`.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-03T17:10:00Z
- **Completed:** 2026-08-03T17:26:00Z
- **Tasks:** 3 de 3 (una de ellas checkpoint de decisión ya resuelto)
- **Files modified:** 9

## Accomplishments

- La rebanada está viva: una og:image inalcanzable atraviesa extracción, dedupe, cap, sondeo y clasificación, y sale como fila `IMG-01` de severidad crítica por el catálogo real de producción, no sólo en aislamiento.
- Primera capa de transporte HTTP con lectura de cuerpo del repositorio (`imageProbe.ts`), con el contrato de resultado completo desde el principio: 31-02 llena `totalBytes` y `dimensions` sin tocar la firma ni el tipo.
- Primera defensa de destino que el proyecto haya tenido (`ssrfGuard.ts`), cableada dos veces dentro del sondeo: la URL inicial y cada uno de los hasta tres saltos de redirección.
- El runner de concurrencia salió de dentro de `checkLinks` a `concurrency.ts` como función genérica que preserva el orden, sin tocar todavía al consumidor original (eso es de 31-03).
- 27 casos de test nuevos, ninguno abre una conexión HTTP ni hace una consulta DNS real.

## Task Commits

1. **Tarea 1: modelo de emisión de filas de IMG-01** — checkpoint de decisión, sin commit de código. Resuelto antes de ejecutar (ver Decisiones).
2. **Tarea 2: rebanada de punta a punta, una og:image inalcanzable** — `5c6e1cd` (feat)
3. **Tarea 3: defensa de destino contra falsificación de peticiones del lado del servidor** — `f1cad1e` (feat)

## Files Created/Modified

- `packages/checks/src/checks/network/ogImageNetwork.ts` — el `NetworkCheck` IMG-01: recolección desde el extractor social, dedupe por URL normalizada, cap compartido, fan-out de filas por página y clasificación.
- `packages/checks/src/checks/network/imageProbe.ts` — transporte: un solo GET con `Range`, redirección manual acotada a 3 saltos, timeout de 5 s con limpieza en `finally`, clasificación de status y el tipo `ImageProbeResult`.
- `packages/checks/src/checks/network/ssrfGuard.ts` — `isPrivateAddress` (clasificación por octetos de la tabla de rangos v4 y v6, incluidas las v4 mapeadas en v6) y `assertPublicDestination` (resolución pidiendo todas las direcciones).
- `packages/checks/src/checks/network/concurrency.ts` — `mapWithConcurrency` y `DEFAULT_NETWORK_CONCURRENCY`.
- `packages/checks/src/checks/network/ogImageNetwork.test.ts` — 7 casos: dedupe, fan-out, dos de omisión sin og:image utilizable, cap en los dos bordes, alcanzabilidad, y el de punta a punta por `runAllChecks`.
- `packages/checks/src/checks/network/ssrfGuard.test.ts` — 20 casos: tabla de rangos, resolución de nombres y los dos casos etiquetados `ssrf`.
- `packages/checks/src/checks/network/index.ts` — barrel `networkChecks` de dos a tres entradas.
- `packages/checks/package.json` y `pnpm-lock.yaml` — `image-size@^2.0.2` pineada a 2.0.2 por el lockfile.

## Decisions Made

**Respuesta del checkpoint de la Tarea 1, transcrita literalmente: `emision-por-pagina`.**

Es decir: fan-out. Cuando una misma URL de og:image aparece en varias páginas, IMG-01 emite **una fila por cada página afectada**, cada una con su propio `pageId` y su propio `fingerprint`, y **no** una sola fila a nivel de sitio por imagen única. El dedupe del **fetch** se cumple literal (una petición por imagen única); lo que hace fan-out es la **emisión**. Las dos cosas son decisiones independientes y esta fase las separa a propósito.

La decisión ya estaba resuelta por el orquestador antes de planificar, así que el ejecutor no se detuvo: el checkpoint quedó en el plan como registro auditable de una decisión irreversible (los fingerprints se persisten en la tabla `Issue` sin migración). Sólo se reabre si Juan pide explícitamente `emision-site-level`.

Otras decisiones:

- **Un solo GET con `Range`, nunca un HEAD previo.** Desviación documentada de la letra de IMG-01 y de `31-CONTEXT.md`: el HEAD no aporta ninguna señal que el GET con rango no traiga, y duplicaría la carga sobre el sitio auditado (amenaza T-31-04). El respaldo por método rechazado se conserva invertido: ante 405 o 501 se reintenta el mismo GET sin la cabecera de rango.
- **La clave de dedupe se calcula con `normalizeUrl`, pero la petición va contra la forma absoluta sin normalizar.** La normalización reordena los parámetros de query, y eso invalida las firmas de los CDN que firman por query.
- **`mapWithConcurrency` se declara sin `async`** y devuelve `Promise.all(...).then(() => results)`. La firma resultante es exactamente `(items, limit, fn) => Promise<R[]>`, el contrato que el plan declara.
- **`image-size` quedó con rango caret (`^2.0.2`) y pineada a 2.0.2 por el lockfile**, siguiendo la convención del resto de las dependencias del repositorio. La 1.2.1 transitiva de `pptxgenjs` sigue intacta: las dos versiones conviven en el lockfile sin conflicto.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Un destino rechazado por nuestra propia defensa se habría reportado como imagen rota**

- **Found during:** Tarea 3 (defensa de destino)
- **Issue:** Al cablear `assertPublicDestination` dentro del sondeo, sus rechazos empiezan a llegar al clasificador como resultados de fallo. La rama de clasificación de la Tarea 2 los habría convertido en filas `critical` de "Imagen social inalcanzable", violando una prohibición dura del propio plan: *"MUST NOT reportar una og:image como rota cuando el sondeo nunca obtuvo una respuesta del servidor... un destino que nuestra propia defensa rechazó antes de conectar son ausencia de prueba, no prueba de defecto"*.
- **Fix:** `ssrfGuard.ts` exporta los dos motivos como constantes (`REASON_NOT_PUBLIC`, `REASON_UNRESOLVABLE`) más el predicado `isGuardRejection`, y `ogImageNetwork.ts` omite esos resultados sin emitir fila. Deliberadamente **no** se acuñó un subtipo nuevo de fingerprint: la rama de advertencia por "no verificable" es alcance de 31-04, que es el plan al que el `<source_audit>` asigna los casos bloqueados. Así el conjunto de subtipos persistidos que introduce esta ola sigue siendo exactamente el declarado en `<artifacts_produced>`.
- **Files modified:** `packages/checks/src/checks/network/ssrfGuard.ts`, `packages/checks/src/checks/network/ogImageNetwork.ts`
- **Verification:** `pnpm --filter @auditor/checks test` (269 casos en verde) y el caso `ssrf` que afirma que el fetch global no se invoca.
- **Committed in:** `f1cad1e` (parte del commit de la Tarea 3)

**2. [Rule 1 - Bug] El caso de punta a punta habría hecho una consulta DNS real**

- **Found during:** Tarea 3
- **Issue:** Una vez cableada la defensa, el caso de `runAllChecks` de `ogImageNetwork.test.ts` pasa por `assertPublicDestination` con un anfitrión inventado, así que la suite habría hecho una resolución DNS real y el caso habría dependido de la red (y habría fallado, porque un nombre no resoluble se omite en vez de emitir fila).
- **Fix:** `node:dns/promises` se simula también en ese archivo, devolviendo una dirección pública.
- **Files modified:** `packages/checks/src/checks/network/ogImageNetwork.test.ts`
- **Verification:** El caso de punta a punta pasa sin red.
- **Committed in:** `f1cad1e`

---

**Total deviations:** 2 auto-corregidas (1 de Rule 2, 1 de Rule 1)
**Impact on plan:** Las dos son necesarias para la corrección. Ninguna amplía el alcance: la primera evita un falso positivo que el propio plan prohíbe y difiere la rama de advertencia a su plan dueño; la segunda quita una dependencia de red de la suite.

## Issues Encountered

**Los tres casos que usaban `mockImplementation` fallaban con `Cannot read properties of undefined`.** La causa no era el mock ni el check: `beforeEach(() => mockedProbeImages.mockReset())` con cuerpo de expresión **devuelve el propio mock**, que es invocable, y Vitest 4 trata todo valor invocable devuelto por un hook como función de limpieza — la llamaba sin argumentos al terminar cada caso, y la implementación explotaba al hacer `urls.map`. Resuelto pasando el hook a cuerpo de bloque, con un comentario que deja el hallazgo escrito.

El mismo patrón de expresión existe en `brokenExternalLinks.test.ts` (`beforeEach(() => mockedCheckLinks.mockReset())`). Ahí es inofensivo hoy, porque esos casos usan `mockResolvedValueOnce` y la llamada de limpieza sobrante no rompe nada, así que **no se tocó** (fuera del alcance de esta ola). Queda anotado abajo para 31-03, que sí modifica ese archivo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Listo para las olas siguientes:**

- **31-02** hereda `imageProbe.ts` con el tipo `ImageProbeResult` ya completo: sólo tiene que llenar `totalBytes` y `dimensions` leyendo el cuerpo por trozos con corte a `IMAGE_HEAD_BYTES`, sin cambiar la firma de `probeImage`. Ojo con la estructura actual: el temporizador se limpia en el `finally` de `requestOnce`, que devuelve la respuesta sin haber leído el cuerpo — si la lectura por trozos tiene que quedar cubierta por el mismo aborto, hay que moverla dentro de ese bloque. La importación admitida de `image-size` es sólo su entrada principal, en memoria; el subcamino de lectura de archivos no se importa jamás, y los dos greps de evidencia son de 31-02.
- **31-03** consume `mapWithConcurrency` desde `linkChecker.ts` (que esta ola dejó sin tocar a propósito) y extiende `assertPublicDestination` a TECH-12 y TECH-13. Al modificar `brokenExternalLinks.test.ts`, aprovechar para pasar su `beforeEach` a cuerpo de bloque (ver Issues Encountered).
- **31-04** agrega las ramas de tipo de contenido, dimensiones, peso y bloqueado sobre el bucle de clasificación de `ogImageNetwork.ts`, en el punto marcado con el comentario que lo nombra. **Relee de este SUMMARY la cadena `emision-por-pagina`** antes de escribir sus ramas. La rama de advertencia por "no verificable" para destinos rechazados por la defensa también es suya: hoy esos resultados se omiten sin fila.
- **Phase 32** debe revalidar `measuredValue` antes de usarlo como destino de un enlace o de una imagen: el fragmento de URL que lleva está recortado a `MAX_MEASURED_VALUE_CHARS` pero sigue siendo texto controlado por el sitio auditado (T-31-05).

**Sin bloqueantes.** `pnpm test` (todo el monorepo), `pnpm typecheck` y `pnpm assert:web-boundary` en verde.

## Threat Flags

Ninguna superficie de seguridad nueva fuera del `<threat_model>` del plan. Las mitigaciones de T-31-01, T-31-02, T-31-04 y T-31-05 quedaron implementadas y probadas en esta ola; T-31-03 queda parcialmente cubierta (prohibición de consumir el cuerpo entero, timeout y cap) y se cierra en 31-02 con la lectura por trozos.

## Self-Check: PASSED

Archivos declarados: los 6 creados y los 3 modificados existen en el árbol.
Commits declarados: `5c6e1cd` y `f1cad1e` existen en `git log`.

---
*Phase: 31-validaci-n-de-og-image*
*Completed: 2026-08-03*
