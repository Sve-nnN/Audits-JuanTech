---
phase: 31-validaci-n-de-og-image
plan: 04
subsystem: checks
tags: [og-image, umbrales, clasificacion, img-02, img-03, img-04, meta-social, vitest]

requires:
  - phase: 31-01
    provides: "ogImageNetwork.ts con recoleccion, dedupe, cap y la rama de inalcanzable; ssrfGuard.ts con REASON_NOT_PUBLIC y REASON_UNRESOLVABLE"
  - phase: 31-02
    provides: "ImageProbeResult con las cuatro señales completas (status, contentType, totalBytes, dimensions)"
provides:
  - "Nueve umbrales de imagen social en packages/meta-social/src/thresholds.ts, el hogar unico de umbrales de la categoria, re-exportados por el index del paquete"
  - "UNVERIFIABLE_PROBE_REASONS exportada desde imageProbe.ts como contrato compartido entre el sondeo y el check"
  - "classifyImageProbe: funcion exportada que separa la decision de la emision y devuelve de cero a dos descriptores por imagen"
  - "Las nueve ramas de clasificacion de IMG-01, con las cuatro terminales cortando y las cinco evaluables aportando a lo sumo una fila de dimension y una de peso"
affects: [Phase 32 (panel de vista previa social pinta contra estos mismos nueve umbrales), scoring de la categoria social, cualquier recalibracion futura de los umbrales de imagen]

tech-stack:
  added: []
  patterns:
    - "Decision separada de emision: una funcion pura clasifica el resultado del sondeo y el bucle del check hace el fan-out por pagina"
    - "Regla de dos señales: una cabecera sospechosa sola nunca alcanza para declarar un defecto; hacen falta las dos señales a la vez"
    - "Banda declarada con dos extremos explicitos en vez de objetivo mas o menos tolerancia, para que el veredicto del borde sea representable"
    - "Redondeo estrictamente de presentacion: el veredicto se decide sobre el entero de bytes"

key-files:
  created: []
  modified:
    - packages/meta-social/src/thresholds.ts
    - packages/meta-social/src/index.ts
    - packages/checks/src/checks/network/imageProbe.ts
    - packages/checks/src/checks/network/ogImageNetwork.ts
    - packages/checks/src/checks/network/ogImageNetwork.test.ts
    - packages/checks/src/checks/network/ssrfGuard.ts

key-decisions:
  - "Sin carve-out por status de bloqueo. 401, 402, 403, 405, 406, 429 y 999 se clasifican exactamente como un 404: error de imagen inalcanzable. brokenExternalLinks.ts (TECH-12) degrada esos mismos status a informativo para enlaces externos, y esa funcion no se importo, no se copio y no se reescribio: 31-CONTEXT.md lockeo lo contrario para og:image. Un muro que rechaza al auditor tambien rechaza al rastreador de Facebook, X y LinkedIn."
  - "La rama de no verificable va ANTES que la de inalcanzable y no mira el codigo de respuesta, porque en sus dos casos posibles no hay respuesta que mirar."
  - "Los dos avisos de dimension (tamaño subóptimo y proporcion fuera de banda) comparten el subtipo og-image-suboptimal a proposito: son la misma señal y no pueden coexistir, porque la proporcion solo se evalua si la rama de tamaño no entro."
  - "Se retiro isGuardRejection de ssrfGuard.ts: UNVERIFIABLE_PROBE_REASONS lo reemplazo como contrato y el predicado quedo sin llamadores."

requirements-completed: [IMG-02, IMG-03, IMG-04]

coverage:
  - id: D1
    description: "Los nueve umbrales viven en el motor puro y el check no declara ninguno propio"
    requirement: "IMG-03"
    verification:
      - kind: other
        ref: "grep -c 'export const OG_IMAGE_' packages/meta-social/src/thresholds.ts == 9; grep -c 'OG_IMAGE_' packages/meta-social/src/index.ts == 9; grep -v '^\\s*[/*]' ogImageNetwork.ts | grep -cE '^\\s*const [A-Z_]+ *= *[0-9]' == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Todo 4xx y 5xx sobre la og:image produce error, sin ninguna excepcion por status de bloqueo"
    requirement: "IMG-02"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#alcanzabilidad: los status de bloqueo de TECH-12 producen error igual que un 404, sin ninguna excepción"
        status: pass
      - kind: unit
        ref: "ogImageNetwork.test.ts#alcanzabilidad: 404, 410, 500 y un tiempo agotado producen error de imagen inalcanzable"
        status: pass
    human_judgment: false
  - id: D3
    description: "La rama de no verificable la disparan unicamente los dos motivos de la defensa de destino"
    requirement: "IMG-02"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#alcanzabilidad: sólo los dos motivos de la defensa de destino salen por la rama de no verificable"
        status: pass
    human_judgment: false
  - id: D4
    description: "Regla de dos señales: un tipo generico con bytes legibles nunca se marca como no siendo una imagen"
    requirement: "IMG-02"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#content-type: un tipo genérico de flujo de octetos con dimensiones legibles NO se marca como no siendo una imagen"
        status: pass
      - kind: unit
        ref: "ogImageNetwork.test.ts#content-type: un tipo de texto plano con dimensiones nulas sí produce error de no es una imagen"
        status: pass
      - kind: unit
        ref: "ogImageNetwork.test.ts#content-type: una cabecera ausente con dimensiones legibles no produce fila de no es una imagen"
        status: pass
    human_judgment: false
  - id: D5
    description: "Una imagen vectorial produce error de formato y cero filas de dimension, detectada por las dos señales"
    requirement: "IMG-02"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#svg: la cabecera vectorial produce error de formato y cero filas de dimensión pese a dimensiones válidas"
        status: pass
      - kind: unit
        ref: "ogImageNetwork.test.ts#svg: un tipo genérico con el tipo de dimensión reportado como vectorial entra por la misma rama"
        status: pass
    human_judgment: false
  - id: D6
    description: "Los bordes exactos de dimension probados en los dos lados: 200x200 no es error, 199x200 si; 600x315 no avisa, 599x315 y 600x314 si"
    requirement: "IMG-03"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#dimensiones: los dos bordes exactos del piso — 200x200 no es error y 199x200 sí lo es"
        status: pass
      - kind: unit
        ref: "ogImageNetwork.test.ts#dimensiones: los tres bordes del umbral chico — 600x315 no avisa, 599x315 y 600x314 sí"
        status: pass
    human_judgment: false
  - id: D7
    description: "Los cuatro bordes de la banda de proporcion: los dos extremos exactos pasan y un paso afuera avisa"
    requirement: "IMG-03"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#ratio: los cuatro bordes de la banda — los dos extremos exactos pasan y un paso afuera avisa"
        status: pass
      - kind: unit
        ref: "ogImageNetwork.test.ts#ratio: 1200x1200 avisa, 1200x630 no avisa y una 16:9 grande tampoco"
        status: pass
    human_judgment: false
  - id: D8
    description: "Los cuatro bordes exactos de peso y el contrato de precision: el redondeo no mueve el veredicto"
    requirement: "IMG-04"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#peso: los cuatro bordes exactos, leídos de las constantes y nunca escritos a mano"
        status: pass
      - kind: unit
        ref: "ogImageNetwork.test.ts#peso: el redondeo del valor medido no mueve el veredicto"
        status: pass
      - kind: unit
        ref: "ogImageNetwork.test.ts#peso: seis mebibytes da error, dos da advertencia, cuatrocientos kilobytes y un tamaño nulo no dan fila"
        status: pass
    human_judgment: false
  - id: D9
    description: "Unas dimensiones ilegibles se reportan como informativo y nunca como defecto del sitio auditado"
    requirement: "IMG-03"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#dimensiones: unas dimensiones nulas dan exactamente una fila informativa y ninguna de defecto"
        status: pass
    human_judgment: false
  - id: D10
    description: "Una imagen chica y pesada emite dos filas por pagina con dos fingerprints distintos"
    requirement: "IMG-04"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#dimensiones: una imagen chica y pesada emite exactamente dos filas por página, con fingerprints distintos"
        status: pass
    human_judgment: false
  - id: D11
    description: "El recorte de texto controlado por el sitio llega al valor medido y nunca a la clave de identidad (T-31-05)"
    requirement: "IMG-02"
    verification:
      - kind: unit
        ref: "ogImageNetwork.test.ts#saneo: una URL de imagen larga se recorta en el valor medido y jamás en la clave de identidad"
        status: pass
      - kind: unit
        ref: "ogImageNetwork.test.ts#saneo: dos destinos cuyos primeros 80 caracteres coinciden producen dos fingerprints distintos"
        status: pass
    human_judgment: false
  - id: D12
    description: "Las dos asunciones marcadas (banda de proporcion 1.7-2.1 y base binaria de los umbrales de peso) quedan registradas para que Juan pueda ajustarlas"
    verification: []
    human_judgment: true
    rationale: "Son decisiones de calibracion sin oraculo externo: ninguna fuente oficial define que significa 'lejos de 1.91:1' ni si '1MB' es binario o decimal. Lo verificable es que los numeros viven en un solo archivo y que cambiarlos son dos ediciones; que la banda elegida sea la correcta para el universo real de sitios es un juicio que solo una auditoria real puede respaldar."

duration: 18 min
completed: 2026-08-03
status: complete
---

# Phase 31 Plan 04: Clasificacion completa de og:image Summary

**Los nueve umbrales de imagen social viven en el motor puro y `ogImageNetworkCheck` pasa de una rama a nueve, con los seis bordes exactos probados en los dos lados y sin pedir un solo byte mas de red.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-03T20:45:00Z
- **Completed:** 2026-08-03T21:03:00Z
- **Tasks:** 2 (mas un retiro de codigo muerto)
- **Files modified:** 6

## Accomplishments

- Los nueve umbrales de imagen social entran a `packages/meta-social/src/thresholds.ts`, el hogar unico de umbrales de la categoria, cada uno con su docblock. El check no declara ni uno propio: Phase 32 va a pintar el panel de vista previa contra exactamente estos numeros.
- `classifyImageProbe` separa la decision de la emision. Recibe un resultado del sondeo y devuelve de cero a dos descriptores; el bucle del check los convierte en una fila por cada pagina que declara la imagen. Es lo que permite probar las nueve ramas sin construir un contexto de paginas en cada caso.
- **Los dos defectos de producto que la investigacion identifico quedan cerrados con tests en los dos lados.** Una imagen servida con tipo generico pero con bytes legibles nunca se marca como rota (regla de dos señales, Pitfall 6). Una imagen vectorial nunca recibe un aprobado ni una fila de dimension: corta antes, con severidad de error.
- Los seis bordes exactos estan probados a cada lado y leen las constantes en lugar de escribir el numero a mano: 200x200 contra 199x200, 600x315 contra 599x315 y 600x314, los dos extremos de la banda de proporcion contra un paso afuera de cada uno, y los cuatro bordes de peso.
- El contrato de precision de IMG-04 tiene su propio caso: dos tamaños que se **muestran con la misma cifra** reciben veredictos distintos, porque la comparacion va sobre el entero de bytes y el redondeo vive solo en el texto.
- El paquete de checks pasa de 306 a **318 casos**, todos en verde.

## Los nueve subtipos de ambito que emite IMG-01

Son los identificadores que Phase 32 va a agrupar, y las claves de continuidad del diff entre auditorias:

| Subtipo | Severidad | Corta |
|---|---|---|
| `og-image-unverifiable` | warning | si |
| `og-image-unreachable` | critical | si |
| `og-image-svg` | critical | si |
| `og-image-not-image` | critical | si |
| `og-image-undetermined` | ok | no (bloque de dimension) |
| `og-image-too-small` | critical | no (bloque de dimension) |
| `og-image-suboptimal` | warning | no (bloque de dimension, tamaño y proporcion) |
| `og-image-heavy` | warning | no (bloque de peso) |
| `og-image-too-large` | critical | no (bloque de peso) |

Maximo por pagina: **dos filas**, una de dimension y una de peso.

## Los seis bordes exactos, con el valor probado a cada lado

Es el contrato que una recalibracion futura tiene que respetar o cambiar a proposito:

| Borde | No produce fila | Si produce fila |
|---|---|---|
| Piso de ancho (200) | 200x200 | 199x200 |
| Piso de alto (200) | 200x200 | 200x199 |
| Umbral chico de ancho (600) | 600x315 | 599x315 |
| Umbral chico de alto (315) | 600x315 | 600x314 |
| Banda de proporcion (1.7 y 2.1) | 1700x1000 y 2100x1000 | 1699x1000 y 2101x1000 |
| Peso (1 MiB y 5 MiB) | exactamente 1048576 | 1048577 (aviso), 5242880 (aviso), 5242881 (error) |

## Task Commits

1. **Tarea 1 (parte a): los nueve umbrales en el motor puro** — `c6df0e7` (feat)
2. **Tarea 1 (parte b): las cuatro ramas terminales de IMG-02** — `f0adb1b` (feat)
3. **Tarea 2: ramas de dimension, proporcion y peso** — `ae40d2c` (feat)
4. **Retiro de codigo muerto:** `isGuardRejection` sin llamadores — `613a254` (refactor)

## Files Created/Modified

- `packages/meta-social/src/thresholds.ts` — nueve constantes nuevas al final del archivo, cada una con su docblock. Las cinco existentes y la lista de valores de tarjeta quedaron intactas.
- `packages/meta-social/src/index.ts` — los nueve nombres entran al bloque de re-export existente.
- `packages/checks/src/checks/network/imageProbe.ts` — un unico agregado: `UNVERIFIABLE_PROBE_REASONS`, con anotacion de tipo explicita y no asercion de constante, por la misma razon que la lista de valores de tarjeta.
- `packages/checks/src/checks/network/ogImageNetwork.ts` — el bloque de clasificacion pasa de una rama a nueve, dentro de `classifyImageProbe`; el bucle de emision hace el fan-out.
- `packages/checks/src/checks/network/ogImageNetwork.test.ts` — de 6 a 28 casos, con las etiquetas que exige el mapa de verificacion.
- `packages/checks/src/checks/network/ssrfGuard.ts` — se retiro `isGuardRejection`, sin llamadores tras el cambio.

## Salida de los comandos verificados

| Comando | Resultado |
|---|---|
| `vitest run src/checks/network/ogImageNetwork.test.ts` | 1 archivo, **28 casos**, todos en verde |
| `-t "alcanzabilidad"` / `-t "content-type"` / `-t "svg"` | codigo 0 |
| `-t "dimensiones"` / `-t "ratio"` / `-t "peso"` / `-t "saneo"` | codigo 0 |
| `pnpm --filter @auditor/meta-social test` | 2 archivos, 22 casos, en verde |
| `pnpm --filter @auditor/checks test` | 43 archivos, **318 casos**, todos en verde (eran 306) |
| `pnpm typecheck` (raiz) | 17 tareas, todas en verde |

Mapa de severidades verificado por grep sobre el archivo del check: 5 `critical`, 4 `warning`, 2 `ok`, exactamente el declarado.

## Decisions Made

- **Sin carve-out por status de bloqueo.** El precedente de TECH-12 existe y quedo anotado, no aplicado. `31-CONTEXT.md` lockeo lo contrario y el criterio de aceptacion 2 del ROADMAP lo repite. Un caso de test recorre 401, 402, 403, 405, 406, 429 y 999 y afirma error de inalcanzable y **cero** filas de no verificable, para que el dia que alguien quiera heredar la excepcion tenga que cambiar un test a proposito.
- **El orden de las ramas terminales importa.** La de no verificable va primera y no mira el status: sus dos casos posibles llegan con status nulo, y puesta despues caerian en la rama de inalcanzable, que es exactamente el falso positivo que existe para impedir.
- **Un solo subtipo para los dos avisos de dimension.** `og-image-suboptimal` cubre tamaño subóptimo y proporcion fuera de banda. No pueden coexistir (la proporcion solo se evalua si la rama de tamaño no entro), asi que dos subtipos prometerian una fila que nunca aparece.
- **La proporcion se compara contra dos extremos y nunca contra el objetivo mas o menos una tolerancia.** El test afirma primero que `1700/1000` es exactamente `OG_IMAGE_RATIO_MIN` y `2100/1000` exactamente `OG_IMAGE_RATIO_MAX`: es lo que hace verificable el borde. Con una tolerancia, el extremo no seria representable y el veredicto del borde quedaria indefinido.

## Asunciones marcadas registradas

Las dos son de calibracion y se ajustan cambiando **dos numeros** en `packages/meta-social/src/thresholds.ts`:

1. **Banda de proporcion 1.7 a 2.1**, y no una tolerancia alrededor de 1.91. El requisito dice "ratio lejos de 1.91:1" sin definir "lejos". La banda acepta las tres proporciones que las plataformas recomiendan (1.9048, 1.9108, 1.9139) y tambien 16:9 (1.7778), que sirve de hecho una parte grande del universo de CMS y penalizar seria un falso positivo masivo. Rechaza la cuadrada (1.0) y la de cuatro tercios (1.333).
2. **Base binaria de los umbrales de peso** (1 MiB = 1048576 y 5 MiB = 5242880). El requisito dice "1MB" y "5MB" sin especificar la base. La diferencia frente a la interpretacion decimal es de un 4.9 por ciento en cada borde, asi que solo cambia el veredicto de imagenes que caen exactamente en esa franja.

## Deviations from Plan

1. **Retiro de `isGuardRejection`** (no previsto por el plan). Al reemplazar el predicado por `UNVERIFIABLE_PROBE_REASONS` como contrato compartido, el predicado que 31-01 dejo en `ssrfGuard.ts` quedo sin un solo llamador. Se retiro en su propio commit en lugar de dejarlo como codigo muerto. Las dos constantes de motivo, que son el origen unico de la verdad, quedan intactas. Typecheck y las 318 pruebas confirman que nada dependia de el.
2. **Los dos casos de saneo se afirman sobre los dos textos que corresponden a la emision por pagina.** El plan los describe como si el ambito y el fingerprint llevaran la URL de la **imagen**; con `emision-por-pagina` (resuelto en el checkpoint de 31-01) el ambito y el fingerprint llevan la URL de la **pagina**. Los casos prueban las dos mitades de la regla tal como esta implementada: el valor medido lleva la URL de la imagen recortada, y el ambito y el fingerprint llevan la URL de la pagina completa y sin recortar. La propiedad que la regla protege (el recorte jamas toca la clave de identidad) queda afirmada, y el segundo caso lo confirma con dos paginas cuyos primeros 80 caracteres coinciden.

**Total deviations:** 2
**Impact on plan:** ninguno sobre el comportamiento. La primera es limpieza; la segunda alinea la redaccion del caso con la decision de emision que la fase ya habia tomado.

## Known Stubs

Ninguno.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 31-05 puede correr: las ramas de clasificacion existen y `grep -c 'og-image-too-small' packages/checks/src/checks/network/ogImageNetwork.ts` devuelve 1, que es su precondicion.
- Phase 32 tiene los nueve umbrales y los nueve subtipos como contrato estable, en un solo archivo cada uno.
- Queda sin medir, hasta que se corra una auditoria real, la tasa de filas de `og-image-undetermined`: es el respaldo de la asuncion sobre el tamaño de la ventana de lectura (backstop A1) y esta declarado como verificacion manual en el plan de validacion de la fase.

## Self-Check: PASSED

- Los 6 archivos declarados existen en disco con los cambios descritos.
- Los cuatro commits (`c6df0e7`, `f0adb1b`, `ae40d2c`, `613a254`) existen en el historial.
- Los criterios de aceptacion de las dos tareas se re-corrieron y dieron los valores exactos que pide el plan, incluido el mapa de severidades 5/4/2.

---
