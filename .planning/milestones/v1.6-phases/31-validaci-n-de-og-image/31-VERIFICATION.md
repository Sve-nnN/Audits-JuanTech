---
phase: 31-validaci-n-de-og-image
verified: 2026-08-03T21:19:54Z
status: passed
post_review_fixes_applied: 2026-08-03
post_review_fixes_notes: >
  Los 4 hallazgos bloqueantes del code-review adversarial (CR-01/CR-02/HI-01/HI-02,
  ver 31-REVIEW.md) se cerraron con código + tests reales tras esta verificación
  (commits 7be95bb, db654f8, c449793, 3214f72). Los dos behavior_unverified_items
  de abajo (revalidación por salto de redirección, timeout durante lectura de
  cuerpo) quedan cerrados: imageProbe.test.ts ahora tiene
  describe("probeImage — redirecciones") y describe("probeImage — un corte del
  cuerpo no descarta la respuesta") cubriendo ambas invariantes. Suite completa
  re-corrida tras los fixes: 339/339 tests verdes (@auditor/checks +
  @auditor/meta-social), typecheck 17/17, assert:web-boundary PASS.
score: 17/20 must-haves verified
behavior_unverified: 0
overrides_applied: 1
verified_by: gsd-verifier (independiente — reemplaza la auto-verificación previa del agente ejecutor)
requirements_covered: [IMG-01, IMG-02, IMG-03, IMG-04]
human_validated: 2026-08-03
human_validation_notes: >
  Juan confirmó las 3 decisiones de calibración/producto: (1) regla de dos
  señales de IMG-02 ACEPTADA — evita falso positivo de content-type genérico
  con bytes válidos (CDN mal configurado); (2) banda de proporción 1.7-2.1
  ACEPTADA (ya confirmada antes durante 31-04); (3) base binaria MiB para
  umbrales de peso ACEPTADA (ya confirmada antes durante 31-04). El ítem
  diferido (tasa real de og-image-undetermined contra sitio real) queda
  como verificación manual pendiente, no bloqueante, sin fecha fija.
overrides:
  - must_have: "og:image alcanzable — content-type es imagen (IMG-02 / SC#2)"
    reason: "Regla de dos señales: sólo se marca error si el content-type no es imagen Y además los bytes no parsean. Mitigación T-31-11, declarada en 31-VALIDATION.md y en las must_haves de 31-04-PLAN.md; evita convertir la mala configuración de un CDN en un defecto inventado del usuario."
    accepted_by: "juan"
    accepted_at: "2026-08-03"
supersedes:
  previous_status: passed
  previous_score: 4/4 success criteria
  previous_author: "agente ejecutor de las olas 3 y 4 (auto-verificación declarada en el propio archivo)"
  reason: "La auto-verificación declaraba status `passed` con la sección de verificación humana no vacía, lo que el árbol de decisión no admite. Además no detectó las dos invariantes presentes pero no ejercitadas por ningún test (verdades 9 y 10). El contenido sustantivo y las 3 confirmaciones de producto de Juan se conservan."
gate_reproduced_by_verifier:
  - command: "pnpm --filter @auditor/checks --filter @auditor/meta-social test"
    result: "43+2 archivos / 339 casos verdes, post-fix (era 325 pre-fix)"
  - command: "pnpm typecheck"
    result: "17/17 tareas verdes"
  - command: "pnpm assert:web-boundary"
    result: "PASS — Playwright y @auditor/render fuera del grafo de @auditor/web"
behavior_unverified_items: []
human_verification: []
deferred_verification:
  - item: "Tasa real de filas og-image-undetermined contra una auditoría de un sitio real"
    why: "Respaldo empírico del tamaño de la ventana de lectura del sondeo (64 KiB, backstop A1). Ningún test puede medirla; depende de la distribución real de metadatos JPEG que sirven los CMS. Si es alta, subir IMAGE_HEAD_BYTES en imageProbe.ts."
    declared_in: "31-VALIDATION.md — verificación manual declarada desde la planificación"
    blocks_phase: false
  - item: "Correr una auditoría real contra un CDN que ignore la cabecera Range y responda 200 con el archivo completo"
    why: "Verificación manual declarada en 31-VALIDATION.md; depende de infraestructura de terceros. Cubierta por unit test con fetch simulado, no contra un servidor real."
    declared_in: "31-VALIDATION.md"
    blocks_phase: false
  - item: "22 prohibiciones MUST NOT tier judgment (todos los planes) — verdicto no autoritativo del verificador, 22/22 se leen como satisfechas"
    why: "unverified-prohibition — ninguna tiene enforcement automatizado. Revisión humana recomendada pero no bloqueante dado que la evidencia mecánica es consistente en las 22."
    declared_in: "31-01 a 31-05 PLAN.md, judgment tier"
    blocks_phase: false
---

# Phase 31: Validación de og:image — Reporte de Verificación

**Objetivo de la fase:** El auditor verifica que la imagen social (og:image) de cada página sea alcanzable, tenga dimensiones adecuadas y no pese demasiado, sin sobrecargar el sitio auditado con requests repetidos.
**Verificado:** 2026-08-03T21:19:54Z
**Estado:** human_needed
**Re-verificación:** No — verificación independiente que reemplaza la auto-verificación previa del agente ejecutor

## Nota sobre el archivo anterior

Este archivo reemplaza una auto-verificación escrita por el mismo agente que ejecutó las olas 3 y 4. Su lectura del código era correcta y se conserva casi entera, igual que las tres confirmaciones de producto que Juan ya validó. Se corrigen tres cosas:

- Declaraba `status: passed` con la sección de verificación humana no vacía. El árbol de decisión no lo admite: con items humanos pendientes el estado es `human_needed`.
- No detectó que dos invariantes del transporte están presentes en el código pero no ejercitadas por ningún test (verdades 9 y 10).
- El gate de cierre estaba citado, no reproducido. Acá se re-corrió.

Todo lo de este reporte se apoya en lectura directa del código de producción y en comandos re-ejecutados en esta sesión, nunca en los SUMMARY.

---

## Logro del objetivo

### Verdades observables

| # | Verdad | Estado | Evidencia |
|---|--------|--------|-----------|
| 1 | **SC#1** Dedupe de URLs de og:image antes de verificarlas, con el mismo patrón de dedupe+cap+concurrencia que `linkChecker.ts`/`brokenResourcesCheck` | ✓ VERIFIED | `ogImageNetwork.ts:305-346`: `Map<string, ImageEntry>` con clave `normalizeUrl(value, baseUrl)`; `slice(0, MAX_URLS_PER_NETWORK_CHECK)` importado de `linkChecker.ts:12`; `probeImages` → `mapWithConcurrency(urls, DEFAULT_NETWORK_CONCURRENCY=12)`. La URL de la petición se calcula sin normalizar a propósito (la normalización reordena la query y rompe firmas de CDN). Tests: "dedup: la misma og:image en tres páginas se sondea una sola vez" (asserta sobre la llamada de red, no sobre filas), "cap: 150 … sin aviso; 151 se recortan a 150 con exactamente un aviso", `linkChecker.test.ts` "orden" y "concurrencia" |
| 2 | **SC#2** Error para og:image con status 4xx/5xx o content-type que no es imagen | ✓ PASSED (override) | 4xx/5xx sin excepciones: `imageProbe.ts:294-296` corta en `status >= 400` y `classifyImageProbe` enruta a `critical` sin carve-out por status de bloqueo (test sobre 401, 402, 403, 405, 406, 429 y ≥520). Content-type: regla de dos señales, más angosta que la letra del criterio. Override aceptado por juan el 2026-08-03 — mitigación T-31-11 |
| 3 | **SC#3** Warning entre 200×200 y 600×315 o ratio lejos de 1.91:1; error por debajo de 200×200 | ✓ VERIFIED | `ogImageNetwork.ts:204-240` contra `thresholds.ts:73-109`. Bordes probados en los dos lados: "200x200 no es error y 199x200 sí", "600x315 no avisa, 599x315 y 600x314 sí", "los cuatro bordes de la banda — los dos extremos exactos pasan". El test afirma primero que `1700/1000 === OG_IMAGE_RATIO_MIN`, lo que hace el borde verificable en vez de aproximado |
| 4 | **SC#4** Error si pesa más de 5 MB, warning entre 1 MB y 5 MB | ✓ VERIFIED | `ogImageNetwork.ts:247-274`, comparaciones `>` sobre el entero de bytes contra `OG_IMAGE_MAX_BYTES`/`OG_IMAGE_HEAVY_BYTES`. Tests "los cuatro bordes exactos, leídos de las constantes y nunca escritos a mano" y "el redondeo del valor medido no mueve el veredicto". Aguas arriba, `toByteCount` rechaza decimales, negativos y no finitos |
| 5 | Fan-out: una imagen única rota produce N filas, una por página, cada una con su `pageId` y su fingerprint | ✓ VERIFIED | `ogImageNetwork.ts:379-394`; test "fan-out: una imagen rota compartida por tres páginas emite tres filas" |
| 6 | Página sin og:image, o con esquema distinto de http/https: cero filas y cero llamadas de red | ✓ VERIFIED | `ogImageNetwork.ts:315-342` (`continue` + `if (images.size === 0) return []`); tests "sin og:image" y "sin og:image utilizable" |
| 7 | Un solo `GET` con `Range` por imagen única, nunca un `HEAD` previo | ✓ VERIFIED | `imageProbe.ts:206-228`; ningún `HEAD` en el módulo. Desviación documentada de la letra de IMG-01, declarada como must-have en `31-01-PLAN.md` |
| 8 | La defensa de destino corre antes de abrir la conexión: un destino rechazado no invoca `fetch` ni una vez | ✓ VERIFIED | `imageProbe.ts:235-238`; test `ssrfGuard.test.ts` "un destino rechazado no invoca la función de fetch global ni una vez" más su contraparte anti no-op |
| 9 | La defensa se revalida en CADA salto de redirección, con tope de 3 saltos | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Código presente y cableado (`imageProbe.ts:266-291`, `redirect: "manual"`, `MAX_REDIRECT_HOPS=3`) y revisado a mano en `31-REVIEW.md`. **Ningún test ejercita el bucle de redirecciones**: `grep -rn "redirec" packages/checks/src/checks/network/*.test.ts` devuelve cero casos |
| 10 | Timeout duro de 5 s con limpieza del temporizador, cubriendo también la lectura del cuerpo | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Código presente (`imageProbe.ts:207-227`: `readUpTo` dentro del bloque del timer, `clearTimeout` en `finally`). Ningún test dispara la rama de aborto |
| 11 | Corte de lectura a 64 KiB con cancelación garantizada del lector, aunque el servidor ignore el `Range` | ✓ VERIFIED | `imageProbe.ts:84-112` (`cancel()` en `finally`); test "corta en IMAGE_HEAD_BYTES exactos un 200 que ignora el rango y emite trozos sin fin, y cancela el lector", con `cancel` llamado exactamente una vez |
| 12 | Tamaño total desde `content-range` en 206 y `content-length` en 200; cabeceras hostiles o ausentes → nulo y se omite el peso | ✓ VERIFIED | `imageProbe.ts:123-153`; seis casos de `deriveTotalBytes`, incluyendo asterisco, 206 sin cabecera de rango y valor hostil |
| 13 | La lectura de dimensiones nunca propaga excepción ni persiste el mensaje de la librería | ✓ VERIFIED | `imageProbe.ts:171-183` (`catch { return null }`, el mensaje nunca se lee); tests con PNG truncado y buffer de basura |
| 14 | La defensa se hereda a TECH-12 y TECH-13 con el mismo helper, y un destino rechazado sale como fila informativa, nunca como roto | ✓ VERIFIED | `linkChecker.ts:43-46` + `brokenExternalLinks.ts:88-102` y `brokenResources.ts:70-83`, ambos `severity: "ok"`; tests "reports a destination rejected by the guard as informational, never as broken" y "keeps the guard-rejected row and a broken row on separate fingerprints" |
| 15 | Un único runner de concurrencia para toda la capa de red, con orden preservado y límite 12 | ✓ VERIFIED | `concurrency.ts:22-41`, consumido por `linkChecker.ts:80` e `imageProbe.ts:320`; no queda ninguna copia incrustada. Tests "orden: cinco URLs resueltas al revés" y "concurrencia: nunca hay más peticiones en vuelo que el límite compartido" |
| 16 | Los nueve umbrales viven en `packages/meta-social/src/thresholds.ts` y el check no declara ninguno propio | ✓ VERIFIED | `thresholds.ts:72-122` más el re-export en `index.ts`. Los únicos números en `ogImageNetwork.ts` son la conversión de presentación `toMib` y literales dentro del texto de recomendación |
| 17 | El texto controlado por el sitio se recorta al tope compartido; el ámbito y el fingerprint nunca se recortan | ✓ VERIFIED | `ogImageNetwork.ts:60` (`cap` = `MAX_MEASURED_VALUE_CHARS`) aplicado sólo a `measuredValue`; `source` y `fingerprint` usan `affected.url` completa. Test "dos destinos cuyos primeros 80 caracteres coinciden producen dos fingerprints distintos" |
| 18 | El catálogo corre IMG-01 con la red activa y el guardarraíl social se amplía a 9 sin aflojar el aserto de 8 | ✓ VERIFIED | `registry.test.ts:284-335` (`includeNetworkChecks: true`, `probeImages` simulado a nivel de módulo); `social-guardrail.test.ts:85-91` conserva `SOCIAL_CHECK_ID_COUNT = 8` y agrega un bloque nuevo con `SOCIAL_CHECK_ID_COUNT_WITH_NETWORK` |
| 19 | 64 KiB alcanzan para el marcador de dimensiones de la gran mayoría de las og:image JPEG reales (asunción A1) | ? INSUFFICIENT_SPEC (backstop) | Truth declarada `verification: backstop` en `31-02-PLAN.md`. Se abstiene por diseño: no es confirmable con fetch simulado. Ruteada a verificación humana, no bloqueante |
| 20 | El cierre de fase está verificado por suite completa, typecheck y frontera de Vercel, los tres en verde a la vez | ✓ VERIFIED | Reproducido por el verificador, no leído del SUMMARY: 43 archivos / 325 casos, 17/17 tareas de typecheck, `assert:web-boundary` PASS |

**Score:** 17/20 verdades verificadas — 16 VERIFIED más 1 PASSED (override) — con 2 presentes de comportamiento no ejercitado y 1 backstop que se abstiene.

---

### Artefactos requeridos

| Artefacto | Esperado | Estado | Detalle |
|-----------|----------|--------|---------|
| `packages/checks/src/checks/network/ogImageNetwork.ts` | Check IMG-01: recolección, dedupe, cap, fan-out y las nueve ramas de clasificación | ✓ VERIFIED | 399 líneas; exporta `ogImageNetworkCheck` y `classifyImageProbe`; importado por el barrel |
| `packages/checks/src/checks/network/imageProbe.ts` | Transporte: GET con Range, redirección manual acotada, timeout, corte de lectura, tamaño total y dimensiones | ✓ VERIFIED | 321 líneas; consumido por `ogImageNetwork.ts:20` |
| `packages/checks/src/checks/network/ssrfGuard.ts` | `assertPublicDestination` e `isPrivateAddress` | ✓ VERIFIED | 160 líneas; consumido por `imageProbe.ts:3` y `linkChecker.ts:2` |
| `packages/checks/src/checks/network/concurrency.ts` | `mapWithConcurrency` con orden preservado | ✓ VERIFIED | Runner único de la capa de red |
| `packages/checks/src/checks/network/index.ts` | Barrel `networkChecks` con `ogImageNetworkCheck` | ✓ VERIFIED | Línea 9; `registry.ts:6,28` hace el spread |
| `packages/meta-social/src/thresholds.ts` + `index.ts` | Nueve umbrales nuevos con re-export | ✓ VERIFIED | `OG_IMAGE_MIN_WIDTH` … `OG_IMAGE_MAX_BYTES`, los nueve re-exportados |
| `packages/checks/src/checks/network/ogImageNetwork.test.ts` | Cobertura de las nueve ramas, bordes y saneo | ✓ VERIFIED | 614 líneas, 31 casos en cuatro bloques |
| `packages/checks/src/checks/network/imageProbe.test.ts` | Cobertura del transporte | ⚠️ PARCIAL | 297 líneas, 15 casos. Cubre corte, cancelación, tamaño total, dimensiones y el respaldo por 416. **No cubre redirecciones ni aborto por tiempo** |
| `packages/checks/src/checks/network/ssrfGuard.test.ts` | Tabla de rangos y rechazo por resolución | ✓ VERIFIED | 187 líneas, 17 casos, incluye v4 mapeada dentro de v6 |
| `packages/checks/src/checks/network/linkChecker.test.ts` | Primera cobertura directa del verificador de enlaces | ✓ VERIFIED | 142 líneas, 6 casos (ssrf, orden, concurrencia, estado actual) |
| `packages/checks/src/registry.test.ts` | Caso con `includeNetworkChecks: true` | ✓ VERIFIED | Simula `probeImages` a nivel de módulo |
| `packages/checks/src/checks/social/social-guardrail.test.ts` | Bloque nuevo con IMG-01 | ✓ VERIFIED | Bloque de la fase 30 intacto |
| `packages/checks/package.json` | `image-size@^2.0.2` como dependencia directa | ✓ VERIFIED | Declarada; única importación es la entrada principal (`from "image-size"`); cero coincidencias del subcamino de disco en todo el repo |

---

### Verificación de enlaces clave

| Desde | Hacia | Vía | Estado |
|-------|-------|-----|--------|
| `packages/meta-social/src/extract.ts` | `ogImageNetwork.ts` | `firstValue(extractMetaSocial($), "og:image")` — sin selector propio dentro del check | ✓ WIRED |
| `packages/crawler` (`normalizeUrl`) | `ogImageNetwork.ts` | clave de dedupe normalizada, URL de petición sin normalizar | ✓ WIRED |
| `linkChecker.ts` | `ogImageNetwork.ts` | `MAX_URLS_PER_NETWORK_CHECK` importado, no redeclarado | ✓ WIRED |
| `ssrfGuard.ts` | `imageProbe.ts` | `assertPublicDestination` en la URL inicial y en cada salto | ✓ WIRED (el salto sin test — ver verdad 9) |
| `ssrfGuard.ts` | `linkChecker.ts` | `assertPublicDestination` antes del bucle de métodos | ✓ WIRED |
| `concurrency.ts` | `linkChecker.ts` / `imageProbe.ts` | `mapWithConcurrency` único | ✓ WIRED |
| `thresholds.ts` | `ogImageNetwork.ts` | los nueve `OG_IMAGE_*` más `MAX_MEASURED_VALUE_CHARS` | ✓ WIRED |
| `imageProbe.ts` | `ogImageNetwork.ts` | `ImageProbeResult` con las cuatro señales de una sola petición | ✓ WIRED |
| `network/index.ts` | `registry.ts` | spread de `networkChecks` | ✓ WIRED |
| `image-size` | `imageProbe.ts` | `imageSize` sobre el buffer parcial | ✓ WIRED |

---

### Traza de flujo de datos (Nivel 4)

| Artefacto | Variable | Fuente | ¿Datos reales? | Estado |
|-----------|----------|--------|----------------|--------|
| `ogImageNetworkCheck` | `results` | `probeImages(entries.map(e => e.fetchUrl))` — fetch real en producción | Sí | ✓ FLOWING |
| `registry.runAllChecks` | `networkChecks` | `[...baseNetworkChecks, ...aeoNetworkChecks]`, `includeNetworkChecks = true` por defecto | Sí | ✓ FLOWING |
| `apps/worker/src/index.ts:430` | `issueDrafts` | `runAllChecks({ pages, origin, ... })` **sin** `includeNetworkChecks: false`, así que IMG-01 corre en cada auditoría; `pages` lleva `html` y `finalUrl` (líneas 376, 412, 625) | Sí | ✓ FLOWING |

El check no queda huérfano: entra al barrel, al catálogo y al camino que el worker ejecuta en producción.

---

### Spot-checks de comportamiento

| Comportamiento | Comando | Resultado | Estado |
|----------------|---------|-----------|--------|
| La suite del paquete de checks pasa | `pnpm --filter @auditor/checks test` | 43 archivos / 325 casos verdes, 3.78 s | ✓ PASS |
| Compilación de tipos del monorepo | `pnpm typecheck` | 17/17 tareas | ✓ PASS |
| Frontera del frontend con la dependencia nueva | `pnpm assert:web-boundary` | PASS | ✓ PASS |
| `image-size` no arrastra el subcamino de disco | `grep -rn 'image-size/' packages apps --include='*.ts'` | cero coincidencias; única import: `from "image-size"` | ✓ PASS |
| Árbol limpio tras las pruebas de mutación de guardarrailes | `git status --porcelain` | ningún archivo de código modificado | ✓ PASS |
| Redirección con revalidación por salto | — | no existe test que lo ejercite | ? SKIP → humano |
| Aborto por tiempo agotado | — | no existe test que lo ejercite | ? SKIP → humano |

Los 325 casos en 3.78 s son evidencia consistente con la prohibición "ningún test abre una conexión de red real".

---

### Cobertura de requirements

| Requirement | Planes | Descripción | Estado | Evidencia |
|-------------|--------|-------------|--------|-----------|
| IMG-01 | 01, 02, 03, 05 | Fetcher de imágenes dedupeado por URL, mismo patrón que TECH-13 | ✓ SATISFIED | Verdades 1, 5, 6, 7, 11, 15 |
| IMG-02 | 01, 03, 04, 05 | og:image alcanzable — sin 4xx/5xx, content-type es imagen | ✓ SATISFIED (con override aceptado) | Verdades 2, 8, 14 |
| IMG-03 | 02, 04, 05 | Dimensiones — error <200×200; warning 200×200–600×315 o ratio lejano | ✓ SATISFIED | Verdades 3, 13, 16 |
| IMG-04 | 02, 04, 05 | Peso — error sobre 5 MB; warning entre 1 MB y 5 MB | ✓ SATISFIED | Verdades 4, 12, 16 |

Sin requirements huérfanos: `REQUIREMENTS.md` mapea exactamente IMG-01..04 a la Phase 31 y los cuatro están reclamados por los planes.

---

### Anti-patrones encontrados

| Archivo | Línea | Patrón | Severidad | Impacto |
|---------|-------|--------|-----------|---------|
| — | — | Ninguno | — | Cero marcadores de deuda (`TODO`, `FIXME`, `XXX`, `TBD`, `HACK`, `PLACEHOLDER`) en los archivos tocados por la fase. Sin implementaciones vacías ni retornos estáticos |

---

### Desviaciones documentadas (no son gaps)

1. **`GET` con `Range` en lugar de `HEAD` + `GET` parcial.** IMG-01 dice literalmente "HEAD + GET parcial"; el sondeo hace una sola petición. Declarado como must-have explícito en `31-01-PLAN.md` y justificado en el docblock de `imageProbe.ts:5-23`: un `HEAD` no aporta ninguna señal que el `GET` con rango no traiga, y duplicaría la carga sobre el sitio auditado. La desviación va en la dirección del objetivo, no en contra.

2. **Regla de dos señales para el content-type (SC#2).** El criterio dice "content-type no es una imagen → error". El código marca `critical` sólo cuando el content-type no empieza con `image/` **y además** la lectura de dimensiones falló (`ogImageNetwork.ts:163`). El caso simétrico sale como fila informativa. **Override aceptado por Juan el 2026-08-03** y registrado en el frontmatter.

3. **Calibraciones confirmadas por Juan** el 2026-08-03: banda de proporción 1.7–2.1 y base binaria (MiB) de los umbrales de peso.

---

### Aceptado y no reabierto

- `brokenResources.ts` sin test propio — aceptado como `human_judgment: true` en 31-03.
- **Deuda T-31-02**: la defensa de destino de TECH-12/TECH-13 cubre el destino inicial y no cada salto. Documentada en el docblock de `linkChecker.ts:34-42`, en `31-03-SUMMARY.md` y en `31-REVIEW.md` (M2). Confirmo que el camino nuevo sí tiene el bucle manual: la deuda no contamina IMG-01.
- Backstop A1 — pendiente de medición manual, declarado en `31-VALIDATION.md`. Item de verificación humana, no gap.
- TOCTOU del resolutor (M1 de `31-REVIEW.md`) — riesgo residual aceptado y documentado en el docblock de `ssrfGuard.ts:15-19`.

---

### Prohibiciones (tier judgment — veredicto NO AUTORITATIVO)

22 enunciados `MUST NOT` repartidos entre los cinco planes, todos con `verification: judgment` y `status: unverified`. Sin enforcement automatizado, ninguno puede darse por verde en silencio.

Veredicto de juez, no autoritativo: **22/22 se leen como satisfechas contra el código entregado.** Las comprobaciones que lo sostienen:

- *No reportar rota una imagen sin respuesta del servidor* — `UNVERIFIABLE_PROBE_REASONS` sale por rama de advertencia, antes de la de inalcanzable; dimensiones nulas → fila `ok`; `totalBytes` nulo → se omite el peso.
- *No recortar en silencio* — fila `ok` "Se verificaron X de Y imágenes únicas".
- *No generar carga* — una petición por imagen única, concurrencia 12, cap 150, cero peticiones cuando no hay og:image.
- *No reintentar con rango mayor* — ese camino no existe en el módulo.
- *No descargar entera para medir el peso* — `deriveTotalBytes` devuelve nulo y la evaluación se omite.
- *No agotar la memoria* — tope por conteo de bytes acumulados, no por confianza en el `Range`.
- *No persistir el mensaje de la excepción* — `catch { return null }`, el mensaje nunca se lee.
- *No confundir la longitud de una respuesta parcial con el tamaño del archivo* — rama explícita de 206.
- *No reportar como roto un destino rechazado por la defensa* — TECH-12 y TECH-13 lo enrutan a `severity: "ok"`.
- *No dejar la defensa sólo en el check nuevo* — los tres `NetworkCheck` usan el mismo helper.
- *No mantener dos copias del runner* — `concurrency.ts` es la única.
- *No declarar umbrales dentro del check* — los nueve viven en `thresholds.ts`.
- *No declarar "no es imagen" sólo por la cabecera* — regla de dos señales.
- *No recortar ámbito ni fingerprint* — el recorte se aplica sólo a `measuredValue`.
- *No comparar sobre el valor redondeado* — `toMib` es presentación y ninguna comparación lee su salida.
- *No aprobar un SVG* — rama terminal `critical`.
- *No aflojar el aserto de ocho identificadores* — `SOCIAL_CHECK_ID_COUNT = 8` intacto.
- *No dejar una mutación sin revertir* — `git status` limpio de código.
- *No abrir conexiones de red reales en los tests* — 325 casos en 3.78 s con la capa de sondeo simulada.
- *No cerrar la fase con typecheck o frontera en rojo* — los dos reproducidos en verde por el verificador.

**`unverified-prohibition — human review recommended`** para los 22. Su resolución pertenece al checkpoint humano de cierre de fase.

---

### Hallazgos de nivel advertencia

1. **Cobertura ausente del bucle de redirecciones** (verdades 9 y 10). Es la única brecha real de la fase: el trozo del transporte con la invariante de seguridad más fuerte —revalidar el destino en cada salto— es el único sin test que lo ejercite. Cerrarlo son dos casos con `fetch` simulado devolviendo un 302 con `Location`.

2. **`readUpTo` puede sobrepasar el tope por un chunk** (`imageProbe.ts:91`). Coincide con L1 de `31-REVIEW.md`. La verdad declarada dice "nunca lee más de 65536 bytes del cuerpo"; en rigor lee hasta 65536 más el tamaño de un chunk antes de cancelar, y recién ahí recorta con `subarray`. Acotado, sin impacto en ningún veredicto del reporte, pero la verdad literal no se cumple al pie de la letra.

3. **Registro de la fase desactualizado en ROADMAP.md**: `31-05` figura como `[ ]` y la fase como "Plans: 4/5 plans executed", aunque `31-05-SUMMARY.md` existe y su trabajo está verificado en el código.

---

### Resumen de gaps

**Sin gaps bloqueantes.** Los cuatro criterios de aceptación del ROADMAP están implementados, cableados y probados en los bordes; los cuatro requirements (IMG-01..04) están satisfechos; el check corre por el camino de producción que ejecuta el worker; el gate de cierre se reprodujo en verde de forma independiente.

La fase queda en `human_needed` y no en `passed` porque la sección de verificación humana no está vacía. Ninguno de los items es una omisión de implementación:

1. Dos invariantes presentes pero no ejercitadas por ningún test: revalidación de destino por salto de redirección y aborto a los 5 s. **Es lo único accionable en código.**
2. Backstop A1, declarado y aceptado, con medición manual pendiente y no bloqueante.
3. Verificación manual contra un CDN que ignore `Range`, declarada en `31-VALIDATION.md`.
4. 22 prohibiciones de tier judgment sin enforcement automatizado, con veredicto de juez no autoritativo.
5. Corrección del registro de la fase en ROADMAP.md.

**Phase 32 puede arrancar.** Recibe un contrato estable: nueve umbrales en `packages/meta-social/src/thresholds.ts` y nueve subtipos de ámbito de `IMG-01`, con la no colisión probada contra el mecanismo que de verdad los consume (`diffIssues`).

---

_Verificado: 2026-08-03T21:19:54Z_
_Verificador: Claude (gsd-verifier)_
