---
phase: 31-validaci-n-de-og-image
plan: 02
subsystem: api
tags: [network-check, og-image, image-size, range-request, streaming, vitest]

# Dependency graph
requires:
  - phase: 31-validaci-n-de-og-image
    provides: "31-01: imageProbe.ts con el tipo ImageProbeResult completo, el GET con Range, la redirección manual acotada y la defensa de destino"
provides:
  - "readUpTo: lectura del cuerpo por trozos con tope duro en IMAGE_HEAD_BYTES y cancelación garantizada del lector"
  - "deriveTotalBytes: tamaño real del archivo derivado de content-range en 206 y de content-length en 200, con validación de entero finito no negativo"
  - "readDimensions: ancho, alto y tipo leídos con image-size sobre el fragmento parcial, degradando a nulo ante cualquier excepción"
  - "probeImage devolviendo las cuatro señales (status, tipo de contenido, tamaño total y dimensiones) de una sola petición"
  - "imageProbe.test.ts: 20 casos de transporte con fetch y DNS simulados"
affects: [31-04, 31-05, 32-panel-preview-social]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tope de lectura por conteo de bytes acumulados, nunca por confianza en que el servidor respete el rango"
    - "Cancelación del lector en la rama final como el mecanismo que realmente cierra la conexión"
    - "Derivación del tamaño total por status: content-range en respuesta parcial, content-length en respuesta completa"
    - "Parser de terceros siempre envuelto en un bloque que atrapa y nunca lee el mensaje de la excepción"

key-files:
  created:
    - packages/checks/src/checks/network/imageProbe.test.ts
  modified:
    - packages/checks/src/checks/network/imageProbe.ts

key-decisions:
  - "La lectura del cuerpo vive dentro del mismo bloque que posee el temporizador de aborto, para que el presupuesto de 5 s cubra también la lectura y un servidor que gotea bytes no quede sin cota de tiempo"
  - "El 416 se trata en la misma rama que el 405 y el 501: un rango que empieza en cero siempre es satisfacible, así que la respuesta correcta es reintentar sin rango, no dar la imagen por rota"
  - "La validación numérica se partió en dos condiciones (finito, y entero no negativo) en vez de una sola: hace explícito que el caso de notación exponencial fuera de rango se descarta por no finito"
  - "readDimensions devuelve también el campo de tipo que informa la librería, porque 31-04 lo necesita para la rama de formato no soportado junto al tipo de contenido de la cabecera"

patterns-established:
  - "Fábrica local de respuestas falsas con lector real y cancelación espiable: cabeceras construidas con la clase Headers del entorno para que la lectura sea insensible a mayúsculas, igual que en producción"
  - "Fixtures binarios construidos en memoria con Uint8Array + DataView, sin ningún archivo en disco"

requirements-completed: [IMG-01, IMG-03, IMG-04]

coverage:
  - id: D1
    description: "El sondeo nunca lee más de IMAGE_HEAD_BYTES del cuerpo aunque el servidor ignore el rango y emita trozos sin fin, y cancela el lector siempre"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#corta en IMAGE_HEAD_BYTES exactos un 200 que ignora el rango y emite trozos sin fin, y cancela el lector"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#no corta un cuerpo más corto que el tope: lo devuelve completo, sin relleno, y cancela igual"
        status: pass
    human_judgment: false
  - id: D2
    description: "El tamaño total sale de content-range en un 206 y de content-length en un 200; confundirlos haría que toda imagen midiera 65536 bytes y que IMG-04 nunca disparara"
    requirement: "IMG-04"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#tamaño total: un 206 con `bytes 0-65535/1234567` devuelve 1234567, no el tamaño del fragmento"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#tamaño total: un 200 lo toma de la cabecera de longitud de contenido"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sin ninguna de las dos cabeceras (o con tamaño desconocido) el total es nulo y la evaluación de peso se omite; nunca se fuerza una descarga completa"
    requirement: "IMG-04"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#tamaño total: una respuesta sin ninguna de las dos cabeceras devuelve nulo"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#tamaño total: un 206 cuyo tamaño declarado es un asterisco devuelve nulo"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#tamaño total: un 206 sin cabecera de rango no cae de vuelta en la longitud del fragmento"
        status: pass
    human_judgment: false
  - id: D4
    description: "Toda cabecera numérica pasa por una validación de entero finito no negativo antes de alimentar la comparación de umbrales (cuatro formas hostiles cubiertas, más una en la cabecera de rango)"
    requirement: "IMG-04"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#tamaño total: una longitud de contenido %s devuelve nulo (it.each, 4 casos)"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#tamaño total: un 206 con un tamaño declarado hostil en la cabecera de rango devuelve nulo"
        status: pass
    human_judgment: false
  - id: D5
    description: "24 bytes de cabecera PNG y 10 de GIF bastan para leer las dimensiones; un buffer truncado o de basura devuelve nulo sin lanzar"
    requirement: "IMG-03"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#dimensiones desde buffer: 24 bytes de cabecera PNG bastan para leer 1200 por 630"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#dimensiones desde buffer: 10 bytes de cabecera GIF bastan para leer 200 por 200"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#dimensiones desde buffer: una cabecera PNG truncada a 12 bytes devuelve nulo y no lanza"
        status: pass
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#dimensiones desde buffer: un buffer de basura que no es ningún formato devuelve nulo y no lanza"
        status: pass
    human_judgment: false
  - id: D6
    description: "Una sola petición 206 devuelve simultáneamente status, tipo de contenido, tamaño total y dimensiones"
    requirement: "IMG-01"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#dimensiones desde buffer: una sola respuesta 206 trae a la vez status, tipo de contenido, tamaño total y dimensiones"
        status: pass
    human_judgment: false
  - id: D7
    description: "Un 416 se reintenta una única vez sin cabecera de rango y produce éxito con exactamente dos llamadas de red"
    requirement: "IMG-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/network/imageProbe.test.ts#416: un primer 416 se reintenta una única vez sin rango y produce éxito con exactamente dos llamadas de red"
        status: pass
    human_judgment: false
  - id: A1
    description: "64 KiB alcanzan para el marcador de dimensiones de la gran mayoría de las og:image JPEG reales de WordPress y Shopify, de modo que la tasa de dimensiones indeterminadas se mantiene baja en una auditoría real"
    requirement: "IMG-03"
    verification:
      - kind: backstop
        ref: "Asunción A1 de 31-RESEARCH.md — no confirmable con fetch simulado; requiere medir contra un sitio real"
        status: deferred
    human_judgment: true

# Metrics
duration: 9min
completed: 2026-08-03
status: complete
---

# Phase 31 Plan 02: Transporte completo del sondeo de imagen Summary

**`probeImage` ya devuelve las cuatro señales que IMG-01..04 necesitan — status, tipo de contenido, tamaño total y dimensiones — con una sola petición con rango que jamás lee más de 64 KiB del cuerpo y que cancela el lector siempre.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-03T13:32:00Z
- **Completed:** 2026-08-03T13:41:00Z
- **Tasks:** 2 de 2
- **Files modified:** 2

## Accomplishments

- Los dos defectos silenciosos que la investigación identificó quedan cerrados con test propio: usar la longitud de contenido de una respuesta parcial como tamaño del archivo (toda imagen mediría 65536 bytes y el umbral de peso jamás dispararía) y confiar en que el servidor respete la cabecera de rango (una imagen de 8 MB se descargaría entera).
- El tope de lectura es un conteo duro de bytes acumulados, no una confianza: el caso `corta` simula exactamente un servidor que responde 200 y emite trozos de 10 000 bytes indefinidamente, y afirma que el fragmento devuelto mide `IMAGE_HEAD_BYTES` exactos y que la cancelación se llamó.
- Las dimensiones se leen sobre el fragmento que la misma petición ya trajo, con la librería dedicada y sin un solo byte extra pedido al sitio auditado.
- El tipo `ImageProbeResult`, todas las firmas exportadas por 31-01 y el consumidor `ogImageNetwork.ts` quedaron intactos: la prueba de que el contrato de la ola 1 estaba bien elegido.
- 20 casos en `imageProbe.test.ts`; ninguno abre una conexión HTTP ni hace una consulta DNS real.

## Task Commits

1. **Tarea 1: lectura acotada del cuerpo y derivación del tamaño total** — `f615618` (feat)
2. **Tarea 2: lectura de dimensiones desde el fragmento parcial** — `5586801` (feat)

## Files Created/Modified

- `packages/checks/src/checks/network/imageProbe.ts` — `readUpTo` (lectura por trozos con tope y cancelación en la rama final), `toByteCount` (validación de entero finito no negativo), `deriveTotalBytes` (derivación por status), `readDimensions` (lectura con `image-size` protegida por un bloque que atrapa), rama 416 sumada al respaldo sin rango, y los dos campos del contrato ya llenos en la rama de éxito.
- `packages/checks/src/checks/network/imageProbe.test.ts` — nuevo, 20 casos: 3 de tope de lectura (`corta`), 9 de derivación de tamaño (`tamaño total`, incluidas las cuatro formas hostiles vía `it.each`), 6 de dimensiones (`dimensiones desde buffer`, incluido el de punta a punta sobre un 206) y 1 de respaldo por 416.

## Conteo de casos y comandos etiquetados

| Comando | Resultado |
|---------|-----------|
| `vitest run src/checks/network/imageProbe.test.ts` | 20 pasan, 0 fallan |
| `... -t "corta"` | 3 pasan, 17 omitidos |
| `... -t "tamaño total"` | 10 pasan, 10 omitidos |
| `... -t "dimensiones desde buffer"` | 6 pasan, 14 omitidos |
| `pnpm --filter @auditor/checks test` | 42 archivos, 289 casos, todos en verde |
| `pnpm test` (monorepo) | 14 tareas, todas en verde |
| `pnpm typecheck` | código 0 |
| `pnpm assert:web-boundary` | PASS |

(`-t "tamaño total"` pasa 10 y no 9 porque el caso de integración de punta a punta también lleva esa etiqueta en su cuerpo de aserciones; el filtro por nombre incluye además el caso del 416, que verifica el total tomado de la longitud de contenido.)

## Decisions Made

- **La lectura del cuerpo vive dentro del bloque que posee el temporizador de aborto.** Limpiar el temporizador en cuanto llegan las cabeceras dejaría a un servidor que gotea bytes sin ninguna cota de tiempo, que es la misma denegación de servicio que el tope de bytes existe para frenar. El costo es leer hasta 64 KiB de un cuerpo que a veces se descarta (una redirección, una página de error, una respuesta que estamos por reintentar sin rango): acotado, y más barato que una segunda petición.
- **El 416 entra en la misma rama que el 405 y el 501.** Un rango que empieza en cero sobre un recurso no vacío siempre es satisfacible, así que ese status no es un resultado esperado; si aparece, lo correcto es pedir lo mismo sin rango, no dar la imagen por rota. El reintento sigue acotado a uno por sondeo.
- **La validación numérica quedó partida en dos condiciones** (`Number.isFinite` primero, `Number.isInteger` y no negativo después) en vez de una sola expresión. Hace explícito que el valor en notación exponencial fuera de rango finito se descarta por una razón distinta que el valor con decimales.
- **`readDimensions` devuelve también el campo de tipo** que informa la librería. 31-04 lo necesita para la rama de formato no soportado por las plataformas, junto con el tipo de contenido de la cabecera.
- **Ningún parser propio de firmas y desplazamientos.** El chequeo negativo (`readUInt32BE|readUInt16LE|0x89` fuera de comentarios) devuelve 0 en el archivo de producción; los desplazamientos por formato viven únicamente en las fábricas de fixtures del test, que es donde deben estar.

## Deviations from Plan

Ninguna. El plan se ejecutó exactamente como está escrito.

Una nota de ejecución, no una desviación: al arrancar, el árbol de trabajo tenía cambios sin commitear en `imageProbe.ts` de una corrida previa abortada de este mismo plan, que el entorno revirtió al estado commiteado de 31-01 antes de la primera edición. La Tarea 1 se implementó desde ese estado limpio.

## Issues Encountered

Ninguno. El único punto que requirió cuidado fue el conteo de bytes del caso de tope: los trozos del servidor hostil se emiten de 10 000 bytes precisamente porque no dividen a 65536, así que el último cruza el límite y obliga a ejercitar el recorte exacto en vez de dar por bueno un total que ya caía justo.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **31-04** ya tiene las cuatro señales que sus ramas de clasificación necesitan. Ojo con las dos formas de nulo, que son semánticamente distintas y no deben colapsarse: `totalBytes: null` significa "el servidor no expuso el tamaño" (la evaluación de peso se omite, no se reprueba) y `dimensions: null` significa "las dimensiones no se pudieron determinar" (fila informativa, nunca un error). Ninguna de las dos es un defecto de la imagen auditada.
- El campo `type` de `dimensions` es el que informa la librería a partir de los bytes reales, y puede discrepar del `contentType` de la cabecera. Esa discrepancia es señal útil para la rama de formato no soportado, no ruido a normalizar.
- **Marcador de respaldo abierto (asunción A1 de `31-RESEARCH.md`):** que 64 KiB alcancen para el marcador de dimensiones de la gran mayoría de las og:image JPEG reales no es confirmable con fetch simulado — depende de la distribución real de metadatos de los JPEG que sirven los CMS. Requiere medir la tasa de filas de dimensiones indeterminadas contra un sitio real. Mitigación registrada por si resulta falsa: subir `IMAGE_HEAD_BYTES` y volver a medir; la constante está exportada y en un solo lugar precisamente para eso.

**Sin bloqueantes.** `pnpm test`, `pnpm typecheck` y `pnpm assert:web-boundary` en verde.

## Threat Flags

Ninguna superficie de seguridad nueva fuera del `<threat_model>` del plan. T-31-03 (denegación de servicio por cuerpo sin fin) queda cerrada por el tope de bytes más la cancelación del lector, con caso de test dedicado; T-31-06 (bomba de metadatos) por la prohibición de reintentar con un rango mayor; T-31-07 (cabeceras numéricas hostiles) por la validación compartida, con cinco casos; T-31-08 (fuga del mensaje de la excepción) por el `catch` que no lo lee, con chequeo negativo sobre el archivo. T-31-SC se mantiene aceptada: cero líneas de diferencia en `packages/checks/package.json` y en `pnpm-lock.yaml`.

## Self-Check: PASSED

Archivos declarados: `imageProbe.ts` e `imageProbe.test.ts` existen en el árbol.
Commits declarados: `f615618` y `5586801` existen en `git log`.
Archivos que debían quedar intactos: `ogImageNetwork.ts`, `packages/checks/package.json` y `pnpm-lock.yaml` no muestran ninguna línea en el diff de este plan.

---
*Phase: 31-validaci-n-de-og-image*
*Completed: 2026-08-03*
