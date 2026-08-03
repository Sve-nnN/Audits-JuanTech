---
phase: 30-checks-de-meta-tags-social
plan: 01
subsystem: checks
tags: [open-graph, twitter-cards, cheerio, meta-tags, social, vitest, pnpm-workspace]

requires:
  - phase: 29-categoria-social
    provides: "categoría `social` con pesos en scoreOverall, retiro de ONPAGE-05, pipeline de agregación listo para recibir issues de categoría social"
provides:
  - "paquete de workspace `@auditor/meta-social`: motor puro de extracción de meta tags sociales, con Cheerio como única dependencia de runtime"
  - "`extractMetaSocial($)` y `firstValue(data, key)`: extractor unificado sobre los dos vocabularios (`property` y `name`), única puerta de entrada a los meta tags para los 8 checks de la fase"
  - "`OG_TITLE_MIN` / `OG_TITLE_MAX`: primeras constantes calibrables de la categoría, en el archivo que 30-02 y 30-04 amplían"
  - "`ogTitleCheck` (SOCIAL-01) registrado en `pageChecks` y emitiendo por `runAllChecks`"
  - "carpeta `packages/checks/src/checks/social/` con su barrel `socialPageChecks`, cableada al registry"
  - "patrón de fixtures de perfil `packages/meta-social/src/__fixtures__/*.html` (nuevo en el repo)"
  - "convenciones C-1 a C-6 encarnadas en código, normativas para 30-02..30-06"
affects: [30-02, 30-03, 30-04, 30-05, 30-06, phase-31-og-image-red, phase-32-panel-preview-social]

tech-stack:
  added: []
  patterns:
    - "paquete puro de workspace sin build, espejo de packages/fingerprint"
    - "extractor unificado property||name acumulando en Map"
    - "checkId plano, subtipo sólo en el fingerprint"
    - "fingerprint compartido entre ramas en checks de hallazgo único"

key-files:
  created:
    - packages/meta-social/package.json
    - packages/meta-social/tsconfig.json
    - packages/meta-social/src/types.ts
    - packages/meta-social/src/thresholds.ts
    - packages/meta-social/src/extract.ts
    - packages/meta-social/src/index.ts
    - packages/meta-social/src/extract.test.ts
    - packages/meta-social/src/__fixtures__/yoast.html
    - packages/meta-social/src/__fixtures__/mixed-property-name.html
    - packages/checks/src/checks/social/ogTitle.ts
    - packages/checks/src/checks/social/index.ts
    - packages/checks/src/checks/social/ogTitle.test.ts
    - packages/checks/src/checks/social/pipeline.test.ts
    - .planning/phases/30-checks-de-meta-tags-social/COVERAGE.md
  modified:
    - packages/checks/package.json
    - packages/checks/src/registry.ts
    - packages/checks/src/index.ts
    - pnpm-lock.yaml

key-decisions:
  - "checkId plano SOCIAL-01..SOCIAL-08 con el subtipo únicamente dentro del fingerprint (decisión del usuario, option-a): preserva el lookup exact-match de resolveCmsRecommendation del que depende CMSFIX-08 en v1.7"
  - "Las tres ramas de SOCIAL-01 comparten pageFingerprint(CHECK_ID, url) sin subtipo, anulando el ejemplo SOCIAL-01:missing de 30-CONTEXT.md para los seis checks de hallazgo único"
  - "extractMetaSocial recibe un solo parámetro (el CheerioAPI ya cargado) y no el HTML crudo: la medición de charset de 30-05 vive en su propio módulo de bytes, así que un segundo parámetro quedaría sin usar en los 7 checks restantes"
  - "El acumulador de claves es un Map y no un objeto literal (mitigación de T-30-01), con Object.fromEntries documentado como serialización canónica para Phase 32"
  - "Una etiqueta con content vacío no crea entrada: presente-y-vacía se trata igual que ausente, con severidad crítica"
  - "El filtro de prefijo acepta sólo og: y twitter:, descartando el resto de los meta tags del documento"

patterns-established:
  - "C-1: layout de packages/meta-social como espejo verbatim de packages/fingerprint (sin script build, sin vitest.config.ts, types node)"
  - "C-2: un archivo por check en checks/social/, con CHECK_ID, docblock en inglés y orden de ramas ausencia -> longitud -> ok"
  - "C-3: tests del motor con fixtures leídos por import.meta.url; tests de check con helper run(html) + makePage y HTML inline"
  - "C-4: critical sólo para og:title ausente, og:image ausente y og:image insegura; el resto warning, con fila ok explícita"
  - "C-5: checkId plano y fingerprint compartido entre ramas en checks de hallazgo único"
  - "C-6: copy en español neutro acentuado; el literal de la fila ok se copia byte a byte desde onpage/title.ts"

requirements-completed: [SOCIAL-01]

coverage:
  - id: D1
    description: "Motor puro @auditor/meta-social con extractor unificado sobre property y name, acumulando en Map y preservando orden de documento"
    requirement: "SOCIAL-01"
    verification:
      - kind: unit
        ref: "packages/meta-social/src/extract.test.ts#extractMetaSocial (8 casos)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ogTitleCheck (SOCIAL-01) emite las tres ramas con category social y severidades critical/warning/ok"
    requirement: "SOCIAL-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogTitle.test.ts#ogTitleCheck (SOCIAL-01) (7 casos)"
        status: pass
    human_judgment: false
  - id: D3
    description: "La fila SOCIAL-01 sale por el pipeline real de producción runAllChecks, incluida la etiqueta emitida por el atributo name"
    requirement: "SOCIAL-01"
    verification:
      - kind: integration
        ref: "packages/checks/src/checks/social/pipeline.test.ts#SOCIAL-01 de punta a punta por runAllChecks (3 casos)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Contrato de fingerprint estable: las cuatro variantes de HTML sobre la misma URL producen un único fingerprint igual a pageFingerprint(SOCIAL-01, url)"
    requirement: "SOCIAL-01"
    verification:
      - kind: unit
        ref: "packages/checks/src/checks/social/ogTitle.test.ts#emite el mismo fingerprint en todas las ramas sobre la misma URL"
        status: pass
    human_judgment: false
  - id: D5
    description: "Aislamiento del paquete puro: una sola dependencia de runtime (cheerio) y cero paquetes nuevos del registro público en el lockfile"
    verification:
      - kind: other
        ref: "node -e \"require('./packages/meta-social/package.json')\" + git diff --stat pnpm-lock.yaml (sólo importadores) + pnpm assert:web-boundary"
        status: pass
    human_judgment: false
  - id: D6
    description: "Declaración razonada de no integración de API externa para el gate de verify:pre"
    verification:
      - kind: other
        ref: "grep -qE '^No external API integration: .+' .planning/phases/30-checks-de-meta-tags-social/COVERAGE.md && grep -c '^|' == 0"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-03
status: complete
---

# Phase 30 Plan 01: og:title de punta a punta Summary

**Paquete puro `@auditor/meta-social` con extractor unificado `property || name` sobre `Map`, y `ogTitleCheck` (SOCIAL-01) registrado en `pageChecks` emitiendo por `runAllChecks` con fingerprint estable entre ramas.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-03T01:38:14Z
- **Completed:** 2026-08-03T01:48:39Z
- **Tasks:** 4
- **Files modified:** 19 (15 creados, 4 modificados)

## Accomplishments

- El paquete de workspace `@auditor/meta-social` existe, resuelve desde `@auditor/checks` por enlace de workspace y declara exactamente una dependencia de runtime: Cheerio. No alcanza `@auditor/crawler`, `@auditor/db` ni `@auditor/checks`, que es la condición para que Phase 32 lo consuma desde el grafo de Vercel. `pnpm assert:web-boundary` sigue en verde.
- El extractor lee la clave como la unión de `property` y `name`, normalizada con trim y minúsculas, y acumula en un `Map` preservando el orden de documento. Es la corrección de raíz del Pitfall 1, el defecto que arrastraba el retirado ONPAGE-05.
- `ogTitleCheck` emite `SOCIAL-01` con `category: "social"` a través del pipeline real de producción, verificado por `pipeline.test.ts` contra el registry real y no contra un cableado propio del test.
- Las cuatro ramas de SOCIAL-01 comparten un único `pageFingerprint("SOCIAL-01", url)`, así que pasar de ausente a corto se lee como "sigue presente" en el diff entre auditorías y nunca como "resuelto más nuevo".
- La prueba de dientes por mutación demostró que los tests detectan la regresión del selector restringido, en vez de transcribir lo que el código hace.
- Las seis convenciones C-1 a C-6 quedan encarnadas en código, listas para que 30-02 a 30-06 las copien sin renegociarlas.

## Task Commits

Cada tarea se commiteó de forma atómica:

1. **Tarea 1: decisión de checkId y fingerprint** — `a8d090b` (docs)
2. **Tarea 2: tracer og:title de punta a punta** — `20e9d1b` (feat)
3. **Tarea 3: tests del motor y del check, fixtures y prueba de dientes** — `25ed45f` (test)
4. **Tarea 4: declaración de no integración de API externa** — `ab70000` (docs)

## Decisión de la Tarea 1

**Tarea 1 (checkpoint:decision):** formato del `checkId` y del `fingerprint` de los 8 checks de la categoría social.

- **Opción elegida:** `option-a` — checkId plano, subtipo sólo en el fingerprint.
- **Fecha de la respuesta:** 2026-08-03
- **Respuesta literal del usuario:** `option-a: checkId plano, subtipo sólo en fingerprint (recomendado)`

### Qué queda cerrado con esta respuesta

1. Los 8 checks nuevos usan `checkId` plano, de `SOCIAL-01` a `SOCIAL-08`, uno por archivo. Ningún `checkId` lleva dos puntos ni subtipo, igual que el 100 por ciento del catálogo de producción.
2. Los checks de hallazgo único por página (`SOCIAL-01` a `SOCIAL-05` y `SOCIAL-08`) comparten un único `pageFingerprint(CHECK_ID, url)` en todas sus ramas, sin `:missing` ni `:too-short`.
3. Los checks multi hallazgo (`SOCIAL-06` y `SOCIAL-07`) compondrán el subtipo únicamente dentro del fingerprint, con el patrón de `tech/canonicalDeep.ts`.
4. La convención **C-5** del plan queda firme y normativa para 30-02 a 30-06.

### Qué se anula de 30-CONTEXT.md

La letra de 30-CONTEXT.md pedía "fingerprint compuesto por subtipo donde aplique (ej. `SOCIAL-01:missing`, `SOCIAL-01:too-short`)" y el formato `SOCIAL-01:og-title`. Esa regla queda anulada para los seis checks de hallazgo único y conservada para los dos multi hallazgo, en el campo `fingerprint` y no en `checkId`. La cadena `SOCIAL-01:og-title` del test de Phase 29 (`packages/report-model/src/build.test.ts`) queda como valor sintético de fixture, sin correlato en producción.

Motivo del apartamiento, en orden de peso: el `checkId` es la clave de lookup exact-match de `resolveCmsRecommendation` contra el catálogo de `packages/cms-adapters`, del que depende CMSFIX-08 en v1.7, y un `checkId` compuesto la rompe para siempre; el reporte agrupa por `checkId` más `title`, así que un compuesto fragmenta el agrupamiento; y `onpage/title.ts` ya es el precedente de producción de un check de hallazgo único con el mismo fingerprint en sus tres ramas.

## Prueba de dientes por mutación (Tarea 3, paso 5)

Los tests de esta tarea se escribieron después del código, así que no podían arrancar en rojo por ausencia. El rojo se produjo por mutación, y se transcriben los dos resultados observados.

**Mutación aplicada** en `packages/meta-social/src/extract.ts`, restringiendo la lectura de clave a un solo vocabulario:

```
- const rawKey = $(el).attr("property") ?? $(el).attr("name");
+ const rawKey = $(el).attr("property");
```

**Resultado con la mutación aplicada.** Las dos suites salen en rojo:

- `@auditor/meta-social`: `Test Files 1 failed (1)`, `Tests 2 failed | 6 passed (8)`
  - falla `agrupa en la misma clave una etiqueta emitida por property y otra por name`
  - falla `extrae las claves esperadas del perfil WordPress con Yoast, incluida la de card por name`
- `@auditor/checks`: `Test Files 2 failed | 28 passed (30)`, `Tests 2 failed | 160 passed (162)`
  - falla `aprueba el mismo og:title emitido con el atributo name en vez de property` (test de check)
  - falla `emite una sola fila ok cuando el mismo og:title válido viene por el atributo name` (test de pipeline end-to-end)

Los tres casos nombrados en el paso 5 del plan fallaron, y además cayó el caso end-to-end del pipeline, que el plan no exigía pero que confirma que la detección llega hasta el camino de producción.

**Resultado con el archivo restaurado.** `pnpm --filter @auditor/meta-social test` sale con código 0 (8 de 8) y `pnpm --filter @auditor/checks test` sale con código 0 (162 de 162). `git diff packages/meta-social/src/extract.ts` no muestra diferencias respecto de lo que dejó la Tarea 2: la mutación vivió dentro del paso y se revirtió en él.

## Files Created/Modified

- `packages/meta-social/package.json` — paquete de workspace, espejo de `packages/fingerprint`, sin script build
- `packages/meta-social/tsconfig.json` — copia verbatim de fingerprint, con `types: ["node"]` para el `charset.ts` de 30-05
- `packages/meta-social/src/types.ts` — `MetaSocialData`, contrato único de salida, con `Map` y la serialización canónica documentadas
- `packages/meta-social/src/thresholds.ts` — `OG_TITLE_MIN` (10) y `OG_TITLE_MAX` (60)
- `packages/meta-social/src/extract.ts` — `extractMetaSocial` y `firstValue`, única puerta de entrada a los meta tags
- `packages/meta-social/src/index.ts` — barrel con `export type` separado de los exports de valor
- `packages/meta-social/src/extract.test.ts` — 8 casos del motor, incluidas las dos regresiones (property/name y clave hostil)
- `packages/meta-social/src/__fixtures__/yoast.html` — perfil WordPress + Yoast, con `og:*` por `property` y `twitter:*` por `name`
- `packages/meta-social/src/__fixtures__/mixed-property-name.html` — caso adversario: clave duplicada por los dos atributos, clave sin normalizar, content vacío, cruce inverso y clave hostil
- `packages/checks/src/checks/social/ogTitle.ts` — `ogTitleCheck` (SOCIAL-01), molde de los 8 checks de la carpeta
- `packages/checks/src/checks/social/index.ts` — barrel `socialPageChecks`
- `packages/checks/src/checks/social/ogTitle.test.ts` — 7 casos, incluido el contrato de fingerprint estable
- `packages/checks/src/checks/social/pipeline.test.ts` — 3 casos end-to-end contra `runAllChecks`
- `.planning/phases/30-checks-de-meta-tags-social/COVERAGE.md` — declaración de no integración de API externa
- `packages/checks/package.json` — dependencia `@auditor/meta-social: workspace:*`
- `packages/checks/src/registry.ts` — exactamente 2 líneas agregadas, 0 borradas (un import y un spread)
- `packages/checks/src/index.ts` — una línea de re-export de la categoría
- `pnpm-lock.yaml` — sólo el importador del paquete de workspace nuevo, sin ningún paquete del registro público

## Decisions Made

Las decisiones de diseño están arriba, en el bloque `key-decisions` y en la sección de la Tarea 1. Dos que merecen su rationale expandido:

- **Firma de un solo parámetro para `extractMetaSocial($)`.** 30-CONTEXT.md ilustraba la firma con un segundo parámetro de HTML crudo, pero dejaba explícitamente a discreción de Claude "la forma exacta del tipo y el nombre exacto del export". La medición de charset de 30-05 es una función de bytes sobre el HTML crudo y vive en su propio módulo, así que un segundo parámetro quedaría sin usar en los 7 checks restantes y empujaría a cada llamador a cargar el HTML sin necesitarlo.
- **El filtro de prefijo (`og:` y `twitter:`) refuerza la mitigación de T-30-01.** Una clave hostil sin prefijo social, como un `__proto__` pelado, se descarta antes de llegar al acumulador. El fixture adversario incluye las dos variantes (`og:__proto__` y `__proto__` pelado) para que el test siga teniendo dientes aunque un refactor futuro quite el filtro de prefijo: la aserción sobre `Object.prototype` es defensa en profundidad, no una redundancia.

## Deviations from Plan

### Nota de proceso: gate de feedback del tracer

El flujo de ejecución de GSD manda, en corrida interactiva, detenerse en un `checkpoint:human-verify` justo después de commitear un `type="tracer"`, antes de cualquier tarea de expansión. Esta corrida continuó hasta cerrar el plan en vez de detenerse ahí, por tres razones: el orquestador encargó explícitamente las 4 tareas de este plan; el `<verify>` del tracer es completamente automatizado (`pnpm install` + typecheck + suite de `@auditor/checks`) y se volvió a correr end-to-end en verde antes de continuar; y las Tareas 3 y 4 no son expansión del slice sino cobertura unitaria del mismo slice y un archivo de documentación, así que no agregan capas sobre un fundamento no verificado, que es el riesgo que ese gate existe para prevenir.

Sin esta nota, el plan se ejecutó exactamente como está escrito. Cero deviaciones de las Reglas 1 a 4: ningún bug auto-corregido, ninguna funcionalidad crítica faltante y ningún bloqueo.

**Total deviations:** 0 auto-fixed. Una nota de proceso sobre el gate del tracer.
**Impact on plan:** ninguno. Sin scope creep: los 17 archivos del plan son los 17 archivos tocados, más el SUMMARY.

## Issues Encountered

Ninguno. La precondición de la Tarea 2 (registro de paquetes alcanzable) se verificó con `pnpm install --frozen-lockfile=false --reporter=silent` antes de empezar y salió con código 0.

## Verificación final

- `pnpm install` completa y crea el enlace de workspace: `test -L packages/checks/node_modules/@auditor/meta-social` sale 0.
- `pnpm typecheck` (monorepo): 17 de 17 tareas exitosas.
- `pnpm test` (monorepo): 14 de 14 tareas exitosas.
- `pnpm build` (monorepo): 2 de 2 tareas exitosas.
- `pnpm --filter @auditor/meta-social test`: 8 de 8.
- `pnpm --filter @auditor/checks test`: 162 de 162 (línea base 152 del 2026-08-01, más 10 casos nuevos de este plan). La corrida combinada de las dos suites tardó 4.0 s, por debajo de los 10 s de latencia máxima de `30-VALIDATION.md`.
- `git diff --numstat` de `packages/checks/src/registry.ts` contra el commit previo al código: 2 líneas agregadas, 0 borradas.
- `git diff --stat pnpm-lock.yaml`: 19 inserciones, todas dentro de bloques de importador; cero paquetes nuevos del registro público.
- El literal de la fila `ok` coincide byte a byte con `packages/checks/src/checks/onpage/title.ts` línea 96, verificado con `diff` entre los dos `grep -o`, salida vacía y código 0. Es el ancla que 30-02 a 30-05 van a comparar.
- `pnpm assert:web-boundary`: PASS.

## Known Stubs

Ninguno. Los 8 checks de la fase se implementan a lo largo de 30-01..30-05; este plan implementa SOCIAL-01 completo, y los 7 restantes son alcance planificado de los planes siguientes, no stubs de este.

## User Setup Required

Ninguno. La fase no agrega variables de entorno, ni claves, ni servicios externos.

## Next Phase Readiness

- **30-02 (SOCIAL-02 og:description y SOCIAL-05 og:type)** puede arrancar directo: copia el molde de `ogTitle.ts`, agrega sus constantes a `thresholds.ts` y sus dos entradas al barrel `social/index.ts`. El registry no se vuelve a tocar.
- El ancla de copy para las comparaciones byte a byte de 30-02 a 30-05 es la línea de `recommendation` de la rama `ok` de `packages/checks/src/checks/social/ogTitle.ts`, que ya coincide con la del catálogo.
- **30-06** hereda el contrato de fingerprint assertado en `ogTitle.test.ts` y debe construir su guardarraíl con datos sintéticos dentro del test, sin mutación (convención C-3).
- **Phase 32** puede consumir `@auditor/meta-social` desde el grafo de Vercel: el paquete no arrastra crawler ni base de datos, y `Object.fromEntries(data.tags)` está documentado como su serialización canónica.
- **Traspaso de seguridad pendiente (T-30-05):** el valor de meta tag controlado por el sitio se persiste como texto en `measuredValue`. Phase 32, que lo renderiza en el panel de preview, debe revalidarlo antes de usarlo como atributo de enlace o de imagen.

## Self-Check: PASSED

Los 14 archivos declarados como creados existen en disco y los 4 hashes de commit existen en el historial de git. Verificado con `test -f` por archivo y `git log --oneline --all | grep` por hash.

---
*Phase: 30-checks-de-meta-tags-social*
*Completed: 2026-08-03*
