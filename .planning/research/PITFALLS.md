# Pitfalls Research

**Domain:** Ampliar un auditor SEO en producción (5 features nuevas: schema-contenido, profundidad de clics, diagnósticos Lighthouse, agrupación por plantilla, visualizador de arquitectura) sobre un pipeline validado (v1.0-v1.2)
**Researched:** 2026-07-08
**Confidence:** HIGH (todos los hallazgos verificados leyendo el código fuente real del repo: `packages/crawler/src/crawl.ts`, `packages/psi/src/{client,parser,cache}.ts`, `packages/checks/src/checks/tech/orphanPages.ts`, `packages/report-model/src/build.ts`, `packages/scoring/src/categoryScore.ts`, `packages/db/prisma/schema.prisma`)

## Critical Pitfalls

### Pitfall 1: `Page.depth` no es profundidad de clics real en el modo de crawl dominante (sitemap-seeded)

**What goes wrong:**
El check de profundidad de clics se construiría asumiendo que `Page.depth` (ya persistido) refleja distancia real de navegación desde el home, tal como asume el propio milestone ("Page.depth ya persistido por el crawler, falta el check"). Pero leyendo `crawl.ts` (líneas 60-61, 144, 215): cuando el sitio tiene sitemap (`seedFromSitemap = true`, el caso más común en producción), **todas** las URLs semilla se insertan con `depth: 0` y el bloque que incrementa `depth` vía BFS de enlaces (`depth: (userData?.depth ?? 0) + 1`) está guardado detrás de `if (!seedFromSitemap)` — es decir, nunca se ejecuta cuando hay sitemap. Sólo en el fallback sin sitemap (link-crawl puro) `depth` refleja distancia real de clics.

**Why it happens:**
El campo se diseñó originalmente sólo para desempatar orden de descubrimiento en el fallback de link-crawl, no como una métrica de arquitectura. Nadie necesitó "profundidad de clics real" hasta ahora; nadie revisó esa semántica al escribir el requisito del milestone.

**How to avoid:**
No reusar `Page.depth` tal cual para el check. Calcular profundidad de clics real como un grafo BFS separado —mismo patrón que `orphanPages.ts` (parsear `page.html` de todas las páginas crawleadas, extraer `a[href]` internos, normalizar, filtrar por dominio)— partiendo del home como raíz, en un paso nuevo del pipeline de checks (no en el crawler). Persistir el resultado (profundidad calculada) como parte del `IssueDraft`/scope del check, no sobrescribir `Page.depth` (evita romper cualquier otro consumidor de ese campo). Si el grafo BFS no alcanza una página (no hay camino de enlaces desde el home, típico si sólo se sembró por sitemap y el sitio tiene enlazado interno pobre), tratarla como "profundidad desconocida" (severidad `ok`/informativa), no como profundidad infinita ni como error crítico — evita duplicar el rol ya cubierto por `orphanPages.ts` (TECH-09) y evita falsos positivos de "muy profundo" en páginas que en realidad son inalcanzables (huérfanas), un problema distinto.

**Warning signs:**
En pruebas contra el fixture/sitio real, si el check reporta 0 páginas con profundidad >3 en un sitio grande con sitemap (porque todo tiene `depth=0`), o reporta profundidad idéntica para todas las páginas — señal de que se está leyendo el campo crudo del crawler en vez de recalcular el grafo.

**Phase to address:**
Fase que implemente el check de profundidad de clics — debe incluir explícitamente el cálculo del grafo BFS como sub-tarea, no asumir que el dato ya existe.

---

### Pitfall 2: Diagnósticos de Lighthouse no son gratis si se leen después del cacheo actual — requieren extender el parser/caché ANTES de la llamada, o se pierden

**What goes wrong:**
El milestone asume "cero costo extra de API" porque los datos ya vienen en la respuesta de PSI que se paga hoy. Es cierto para la llamada en sí, pero **falso para la disponibilidad del dato**: `packages/psi/src/parser.ts` (`parsePsiResponse`) descarta toda la respuesta cruda de PSI excepto 5 campos (`performanceScore`, `lcpMs`, `cls`, `inpMs`, `ttfbMs`) antes de que `client.ts` la devuelva, y `cache.ts` sólo persiste ese objeto `PsiMetrics` reducido en Redis (TTL 24h). Los audits de Lighthouse (`render-blocking-resources`, `unused-css-rules`, `modern-image-formats`/WebP, etc.) nunca llegan a persistirse en ningún lado — ni en caché ni en Postgres. Si el nuevo check de diagnósticos intenta leerlos desde el caché existente, no están ahí.

**Why it happens:**
El diseño original de PSI se optimizó deliberadamente para guardar sólo lo que el score de 4 métricas necesitaba (decisión de v1.0/Phase 6), sin anticipar una fase futura que quisiera más audits de la misma respuesta.

**How to avoid:**
Extender `RawPsiResponse` y `parsePsiResponse` (o añadir un extractor hermano) para capturar los audits adicionales **en el mismo punto** donde hoy se llama `parsePsiResponse(json)` dentro de `client.ts` (línea 60), es decir, en el momento en que la respuesta cruda de PSI todavía existe en memoria — ahí sí es gratis, sin llamada extra. Ampliar el shape de `PsiMetrics` (o crear un tipo `PsiDiagnostics` separado) y el JSON cacheado en Redis para incluir esos campos nuevos desde ese commit en adelante. Aceptar que las entradas cacheadas *antes* del cambio (dentro de su TTL de 24h) no tendrán diagnósticos — degradar con gracia (sección de diagnósticos vacía/"no disponible" para esa página hasta que expire el caché o se re-audite), nunca fallar el check.

**Warning signs:**
El check de diagnósticos devuelve "no disponible" para el 100% de páginas durante las primeras 24h post-deploy — esperado y transitorio, no un bug, pero debe estar documentado como tal para no generar pánico en QA.

**Phase to address:**
Fase de diagnósticos de Lighthouse — el guardrail concreto (verificar en tests que la extracción ocurre en `client.ts`/`parser.ts` antes del cacheo, no en un lugar que lea sólo `PsiMetrics` ya reducido) debe ser un criterio de aceptación explícito de esa fase.

---

### Pitfall 3: Doble conteo de severidad entre diagnósticos nuevos y las 4 métricas de performance ya scoreadas

**What goes wrong:**
`packages/scoring/src/categoryScore.ts` computa el score de una categoría como el promedio de salud (`ok=1, warning=0.5, critical=0`) sobre **todas** las issues de esa categoría, sin ponderar por "importancia" ni por página. Hoy la categoría `perf` tiene 5 issues por página (Score, LCP, CLS, TTFB, INP). Si se agregan 3-4 diagnósticos más por página (WebP, render-blocking, CSS/JS sin usar) que en la práctica son la MISMA causa raíz que ya penalizó LCP (p. ej. render-blocking-resources es casi siempre la causa de un LCP alto), el mismo problema real penaliza el score de `perf` dos o tres veces — inflando artificialmente cuán "roto" luce el rendimiento de un sitio, y generando incoherencia con el score de performance de 4 métricas que ya existe (LCP puede decir "mejorable" mientras 3 diagnósticos redundantes lo pintan como crítico).

**Why it happens:**
El modelo de scoring trata cada `IssueDraft` como una unidad de salud independiente; no tiene noción de "estas 2 issues son la misma causa raíz". Es fácil, al implementar diagnósticos, tratarlos como issues de primera clase con severidad propia sin revisar cómo interactúan con el score ya existente.

**How to avoid:**
Los diagnósticos de Lighthouse deben entrar como severidad **informativa (`ok`) por diseño**, o no entrar en el cómputo de `scoreCategory` en absoluto (excluir esa categoría de issue del array que se le pasa a `scoreCategory`, igual que otras señales puramente informativas del proyecto — ver el precedente de INP "no disponible" que se marca `ok` en vez de penalizar). Presentarlos como contexto adicional adjunto a la issue de performance existente (mismo `pageId`/`source`) en vez de como filas nuevas independientes en la tabla de issues priorizados. Nunca asignarles `critical` — son estimaciones de ahorro de Lighthouse, no medición directa como LCP/CLS.

**Warning signs:**
El score de `perf` cae notablemente en el fixture de referencia (juan-tech.com, target ~86-91) sin que LCP/CLS/TTFB/INP hayan cambiado — señal de doble conteo.

**Phase to address:**
Fase de diagnósticos de Lighthouse — criterio de aceptación: correr el fixture de referencia antes/después y confirmar que el score de `perf` no se mueve por la sola adición de diagnósticos informativos.

---

### Pitfall 4: Falsos positivos sistemáticos en el check schema-contenido para páginas fuera de la muestra renderizada

**What goes wrong:**
Los checks de schema (`packages/checks/src/checks/schema/*`) son `PageCheck`s que operan sobre el `$` de Cheerio, es decir, sobre HTML crudo — igual que casi todos los checks del catálogo. El paquete `@auditor/render` (CSR/SSR, v1.2) sólo renderiza una muestra acotada (`MAX_RENDER_PAGES=10` de hasta 500). Si el check schema-contenido compara "hay FAQPage declarado" contra "hay contenido FAQ visible en el HTML crudo", cualquier página con FAQ inyectado por JS (fuera de las 10 muestreadas) se marcará sistemáticamente como "declarado sin contenido visible" — un falso positivo puro, no un caso límite raro. A esto se suma el riesgo de markup no estándar mencionado en el contexto (`<details>/<summary>` en vez de `div/dt/dd`).

**Why it happens:**
El check se escribe contra el HTML crudo por default (como el resto del catálogo), sin cruzar con la señal de renderizado ya existente (RENDER-01..03) que sabe qué páginas son CSR.

**How to avoid:**
Severidad máxima **`warning`, nunca `critical`** para este check — es heurístico por definición, tal como el propio milestone context ya intuye. Cuando la página en cuestión está en la muestra renderizada y se detectó CSR (o cuando no hay dato de renderizado disponible para esa página), degradar a informativo/omitir el check en vez de marcar mismatch — nunca tratar "no encontré el patrón esperado en HTML crudo" como equivalente a "no hay contenido". Ampliar la detección de contenido más allá de `div/dt/dd`: aceptar `<details>/<summary>`, roles ARIA (`role="region"` con encabezados), y buscar coincidencia aproximada de texto entre las preguntas declaradas en el JSON-LD (`FAQPage.mainEntity[].name`) y CUALQUIER texto visible de la página, no un patrón de markup específico. Redactar la recomendación como "verificar manualmente" en vez de una afirmación categórica de incumplimiento, dado el riesgo de erosionar confianza en un producto lead-magnet.

**Warning signs:**
Tasa alta de esta issue en sitios conocidos por usar FAQ accesible con `<details>` (frameworks modernos, WordPress con bloques nativos) o en sitios con mucho contenido CSR fuera de la muestra de 10 páginas — si aparece en >30-40% de páginas con FAQPage declarado, es señal de falso positivo sistemático, no de un problema real generalizado.

**Phase to address:**
Fase del check schema-contenido — criterio de aceptación explícito: probar contra al menos una página con FAQ en `<details>/<summary>` y una página CSR fuera de la muestra renderizada, confirmar que no dispara falso positivo.

---

### Pitfall 5: Fingerprints sin sub-tipo colapsan hallazgos múltiples por página (lección de Phase 11 no aplicada automáticamente)

**What goes wrong:**
El patrón de fingerprint del proyecto es `checkId:scope` (ver `siteFingerprint`/`pageFingerprint` en `util.ts`, y el uso literal `${spec.checkId}:${url}` en `packages/psi/src/issues.ts`). Si el nuevo check de diagnósticos de Lighthouse emite un solo `checkId` (p. ej. `PERF-DIAG`) para múltiples tipos de diagnóstico (WebP, render-blocking, CSS sin usar) en la misma página, todos comparten el mismo fingerprint `PERF-DIAG:url` — el diff (`scoring/src/diff.ts`, que es puramente por fingerprint) verá sólo una entrada por página en vez de una por tipo de diagnóstico, y un cambio de WebP a resuelto mientras persiste el render-blocking se reportaría incorrectamente como "resuelto" o se perdería en el conteo. Riesgo análogo (menor) en el check de profundidad de clics si se usa un solo checkId sin incluir la URL de la página en el scope.

**Why it happens:**
Es el mismo bug que ya ocurrió en Phase 11 (mencionado explícitamente en el contexto del milestone): fácil de repetir porque el patrón "un checkId por feature" es intuitivo pero no basta cuando una sola ejecución del check produce varios hallazgos distintos por página.

**How to avoid:**
Sub-tipar el fingerprint por tipo de diagnóstico, no sólo por página: `${checkId}-${diagnosticType}:${url}` (p. ej. `PERF-DIAG-webp:url`, `PERF-DIAG-renderblocking:url`), replicando el patrón `PERF-02-LCP` / `PERF-02-CLS` ya usado para separar métricas de PSI en checkIds distintos. Igual para el check de plantilla si llega a emitir hallazgos por combinación plantilla+problema.

**Warning signs:**
Tests de diff que fijan un fixture con 2+ diagnósticos por página y verifican que cada uno tiene diffStatus independiente — si faltan, es la señal de alerta temprana (exactamente el tipo de test que Phase 11 tuvo que añadir después del bug).

**Phase to address:**
Fase de diagnósticos de Lighthouse (y, en menor medida, agrupación por plantilla) — code review explícito del formato de fingerprint antes de mergear, con un test de diff dedicado.

---

### Pitfall 6: El visualizador de arquitectura rompe la filosofía "sólo datos persistidos" de `report-model` y puede ser lento en cada vista del reporte

**What goes wrong:**
`buildReportModel` (comentario explícito en `build.ts`: "assemble ... from persisted data only ... no checks are recomputed") hoy sólo hace queries a `Audit.scores/stats` (JSON ya calculado) y filas `Issue` — nunca toca `Page.html`. El visualizador de arquitectura, para construir el grafo de enlaces internos, necesita re-parsear con Cheerio el HTML de **todas** las páginas crawleadas (mismo patrón que `orphanPages.ts`, que hoy corre una sola vez en el worker durante el procesamiento del audit). Si esa misma lógica se ejecuta "on-demand" dentro de la ruta del reporte (Next.js, en Vercel) en cada carga de página como sugiere el milestone ("computado on-demand... reusa el patrón de orphanPages.ts"), implica: (a) traer de Postgres hasta 500 filas de `html String @db.Text` (potencialmente varios MB en total) por cada visita al reporte, y (b) hacer hasta 500 parses de Cheerio de forma síncrona en el request path de una función serverless — un costo que hoy el pipeline nunca paga en el camino de lectura del reporte, sólo en el camino de escritura (worker, una vez por audit).

**Why it happens:**
"Reusar el patrón de orphanPages.ts" es válido para el *algoritmo* (parseo de enlaces internos) pero engañoso para el *lugar de ejecución*: `orphanPages.ts` corre en el worker, una vez, como parte del pipeline de checks — no en cada carga de página del reporte servido a visitantes.

**How to avoid:**
Computar el grafo de enlaces (adjacency list ligero: `{ url, depth, outboundUrls[] }`, sin el HTML crudo) **una sola vez en el worker**, en el mismo paso donde ya se calculan orphans/profundidad de clics (reusar el mismo parseo de HTML, no duplicarlo dos veces: hoy `orphanPages.ts` ya parsea todo el HTML con Cheerio buscando enlaces — el nuevo check de profundidad de clics y el visualizador deberían compartir ESA misma pasada de parseo en vez de que cada feature reparse el HTML de las 500 páginas por separado). Persistir el resultado compacto (grafo + niveles) en `Audit.stats` (mismo mecanismo ya usado para `stats.perf`), y que `buildReportModel`/la ruta del visualizador lean ese JSON ya calculado — preservando la filosofía "sólo datos persistidos" y evitando cualquier parseo de HTML en el camino de lectura del reporte.

**Warning signs:**
Tiempo de carga del reporte notablemente más lento cuando el audit tiene cerca de 500 páginas comparado con uno de 20; cualquier import de Cheerio o lectura de `page.html` dentro de `apps/web` (en vez de `apps/worker`) es una señal de alarma inmediata dado que el proyecto ya tiene un guardrail de "boundary" (`assert:web-boundary`) para mantener dependencias pesadas fuera del bundle de Vercel — el mismo principio aplica aquí aunque Cheerio no sea tan pesado como Chromium.

**Phase to address:**
Fase del visualizador de arquitectura — debe ser la fase que defina explícitamente "grafo se calcula en el worker y se persiste en `Audit.stats`, el reporte sólo lo lee" como decisión de arquitectura, idealmente reusando/extendiendo el mismo parseo que ya hace el check de profundidad de clics (evitar 2-3 pasadas independientes de Cheerio sobre las mismas 500 páginas de HTML entre profundidad de clics + orphans + visualizador).

---

### Pitfall 7: Clasificación de plantilla por heurística de URL sin fallback explícito genera etiquetas incorrectas y confusas

**What goes wrong:**
No existe hoy ningún campo `template` en el modelo `Page` (verificado contra `schema.prisma`) ni lógica de clasificación. Una heurística basada en patrones de URL (`/product/`, `/blog/`, `/category/`) funciona razonablemente en WordPress/Shopify con URLs convencionales, pero falla silenciosamente —y de forma **incorrecta, no sólo incompleta**— en sitios custom, SPAs con rutas planas, o sitios que usan slugs sin prefijo semántico (p. ej. `/mi-producto-buenisimo` sin `/product/`). Una clasificación errónea (etiquetar una página de producto como "artículo") es peor que no clasificar, porque el usuario del reporte confía en la etiqueta para entender la estructura de su sitio.

**Why it happens:**
Las heurísticas de URL son la vía más barata de implementar y suelen "verse bien" contra el sitio de prueba de referencia (juan-tech.com), pero no generalizan a la diversidad real de convenciones de URL de otros sitios que auditará el lead magnet.

**How to avoid:**
Diseñar la heurística con un bucket explícito "plantilla desconocida" como resultado por default, y sólo asignar una plantilla conocida cuando la confianza es alta (múltiples señales coincidentes: patrón de URL + presencia de tipos schema.org específicos ya extraídos por SD-03, p. ej. `Product` JSON-LD + URL con segmento de categoría — no un solo patrón de URL aislado). Nunca fallar duro ni bloquear el resto del reporte si la clasificación no puede determinarse. Mostrar el bucket "desconocido" como agrupación válida en la UI (no como error), tal como el proyecto ya trata otras señales heurísticas informativas (CSR/SSR con "riesgo informativo, no falla dura del score" — mismo principio aplicado aquí).

**Warning signs:**
Porcentaje alto de páginas en un solo bucket de plantilla no-"desconocido" para un sitio con URLs atípicas (custom/SPA) — señal de sobre-confianza en el patrón; probar contra al menos dos sitios con convenciones de URL distintas (WordPress típico + un sitio custom) antes de dar por buena la heurística.

**Phase to address:**
Fase de agrupación por plantilla — criterio de aceptación: incluir un caso de prueba con URLs sin convención reconocible y verificar que cae en "desconocido" en vez de una etiqueta errónea.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-----------------|
| Leer diagnósticos de Lighthouse re-solicitando la respuesta completa de PSI en vez de extenderla en el parser existente | Evita tocar `parser.ts`/`cache.ts` | Duplica llamadas a la API de PSI (rompe la promesa de "cero costo extra" y arriesga el rate limit de la clave keyless ~1 req/s) | Nunca — extender el parser existente es igual de simple y sí es gratis |
| Reusar `Page.depth` sin recalcular para el check de profundidad de clics | Ahorra escribir el BFS | Check inútil (siempre 0) en el modo de crawl dominante (sitemap-seeded); requiere reescritura completa después | Nunca |
| Clasificar plantilla sólo por regex de URL sin señal de contenido/schema | Implementación rápida | Etiquetas incorrectas que erosionan confianza; usuarios de sitios custom ven basura | Sólo como fallback de última instancia detrás de un bucket "desconocido" explícito |
| Recalcular el grafo de enlaces en cada carga del reporte en vez de persistirlo | Evita tocar el schema de `Audit.stats` | Reporte lento a 500 páginas, y ya no memoizado; contradice la filosofía "sólo datos persistidos" de `report-model` | Nunca en producción; aceptable sólo como prototipo local de un solo audit pequeño durante desarrollo |
| No marcar diagnósticos de Lighthouse como puramente informativos (severidad `ok`) | Se ve como "más issues detectadas" = más valor percibido | Doble conteo que distorsiona el score de `perf` frente a las 4 métricas ya validadas | Nunca |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|--------------|------------------|-----------------|
| PSI API (client.ts/parser.ts/cache.ts) | Asumir que "leer más de la misma respuesta" es gratis en cualquier punto del flujo | Extender la extracción exactamente en `client.ts` línea donde se llama `parsePsiResponse(json)`, antes de que la respuesta cruda se descarte; ampliar el shape cacheado desde ahí |
| Crawler (`Page.depth`) | Asumir que un campo persistido por el crawler tiene la semántica que su nombre sugiere sin leer cómo se llena en los dos modos de seed (sitemap vs link-crawl) | Verificar siempre contra `crawl.ts` qué invariantes realmente mantiene un campo antes de construir un check nuevo sobre él |
| `@auditor/render` (muestra CSR/SSR) | Construir un check de contenido sobre HTML crudo sin cruzar con qué páginas están en la muestra renderizada / marcadas CSR | Consultar el resultado de RENDER-01..03 para la página en cuestión antes de emitir un mismatch de contenido; degradar si es CSR o está fuera de muestra |
| `report-model` (`buildReportModel`) | Añadir una nueva fuente de datos (HTML crudo) al camino de lectura del reporte, rompiendo la invariante "sólo datos persistidos, sin checks recomputados" | Persistir cualquier cómputo nuevo pesado (grafo de enlaces, profundidad) en `Audit.stats` en el worker; `buildReportModel` sólo lee JSON ya calculado |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-parsear HTML de todas las páginas en el camino de lectura del reporte (visualizador) | Carga de la página de reporte notablemente más lenta en audits grandes; picos de memoria en la función serverless de Vercel | Calcular el grafo una vez en el worker, persistir en `Audit.stats`, leer JSON en el reporte | A partir de ~100-150 páginas ya es perceptible; a 500 (el cap del producto) es garantizado |
| Tres pasadas independientes de Cheerio sobre el mismo conjunto de 500 páginas (orphans existente + profundidad de clics nueva + visualizador nuevo) | Tiempo de procesamiento del worker por audit crece linealmente con features añadidas aunque ninguna cambie de complejidad individual | Compartir una sola pasada de parseo de enlaces internos entre las tres features (construir el grafo una vez, derivar orphans + profundidad + visualizador del mismo resultado) | Se nota en el tiempo total de audit incluso antes de 500 páginas, porque son 3x el trabajo de I/O+parseo que hoy hace sólo `orphanPages.ts` |
| Diagnósticos de Lighthouse ampliando el objeto cacheado en Redis sin revisar tamaño | Payloads de caché más grandes por página+estrategia, mismo TTL de 24h — no rompe nada de inmediato pero aumenta uso de memoria de Redis (Upstash, con límites de plan) | Mantener el objeto extendido acotado (sólo los campos de diagnóstico realmente usados en el reporte, no el árbol completo de `audits`) | Notorio si Upstash está en un plan free/bajo con límite de memoria estricto |

## Security Mistakes

No se identificaron riesgos de seguridad específicos de dominio para estas 5 features más allá de las prácticas ya establecidas del proyecto (validación de input con zod, sin ejecución de código de terceros). El HTML re-parseado para el grafo de arquitectura ya proviene de HTML previamente sanitizado/tratado como datos por Cheerio en el resto del catálogo — mismo perfil de riesgo que `orphanPages.ts`, sin superficie nueva.

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|------------------|
| Marcar el mismatch schema-contenido como severidad alta/crítica | Usuario ve "error crítico" por una heurística que puede estar equivocada (FAQ en `<details>` o CSR) → pierde confianza en todo el reporte, especialmente dañino en un lead magnet donde la primera impresión importa | Tope máximo `warning`, wording de "verificar manualmente" en vez de afirmación categórica |
| Etiqueta de plantilla incorrecta mostrada con la misma confianza visual que datos medidos (LCP, status HTTP) | Usuario de un sitio custom ve una etiqueta claramente falsa junto a datos objetivos y empieza a dudar de la precisión del resto del reporte | Bucket "desconocido" explícito, tratado visualmente como neutral/informativo, no como un hallazgo definitivo |
| Visualizador de arquitectura lento en sitios grandes | Usuario espera varios segundos extra en la carga del reporte sólo para ver el grafo, incluso si no le interesa esa sección | Persistir el grafo precomputado (Pitfall 6) para que la sección cargue tan rápido como el resto del reporte ya cargado |

## "Looks Done But Isn't" Checklist

- [ ] **Check de profundidad de clics:** ¿Se probó específicamente contra un audit sembrado por sitemap (el modo dominante)? Si sólo se probó contra el fallback de link-crawl, el resultado en producción real será distinto (posiblemente inútil).
- [ ] **Diagnósticos de Lighthouse:** ¿La extracción ocurre antes del cacheo (en `client.ts`/`parser.ts`) o se intentó leer del caché `PsiMetrics` ya reducido? Verificar con un test que falle si se lee un campo no presente en el `PsiMetrics` actual.
- [ ] **Diagnósticos de Lighthouse:** ¿Se corrió el fixture de referencia antes/después para confirmar que el score de `perf` no cambia sólo por agregar diagnósticos informativos?
- [ ] **Schema-contenido:** ¿Se probó contra al menos una página con `<details>/<summary>` y una página fuera de la muestra CSR? Si sólo se probó contra el fixture de referencia (que probablemente usa markup convencional), el riesgo de falso positivo sigue sin validar.
- [ ] **Agrupación por plantilla:** ¿Existe un bucket "desconocido" y se probó contra URLs sin convención semántica reconocible?
- [ ] **Visualizador de arquitectura:** ¿El grafo se calcula en el worker y se persiste, o se recalcula en cada request del reporte? Medir tiempo de carga del reporte con un audit de ~500 páginas antes de dar la fase por cerrada.
- [ ] **Fingerprints nuevos:** ¿Cada tipo de diagnóstico/hallazgo dentro de un mismo check tiene su propio sub-tipo en el fingerprint, o comparten uno solo por página?

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Check de profundidad de clics inútil por depender de `Page.depth` sin recalcular | MEDIUM | Reescribir el check para construir su propio BFS reusando el parseo de `orphanPages.ts`; no requiere migración de datos porque nada se persistió incorrectamente, sólo el check estaba mal |
| Diagnósticos de Lighthouse ausentes por leerse desde caché ya reducido | LOW | Extender `parser.ts`/tipo `PsiMetrics`, dejar que el caché existente expire naturalmente en 24h (no hace falta invalidación manual) |
| Score de `perf` distorsionado por doble conteo de diagnósticos | LOW | Cambiar la severidad de los diagnósticos a `ok`/excluirlos de `scoreCategory`; no requiere cambio de schema, es un cambio de mapeo en el checker |
| Visualizador lento por recomputar en cada request | MEDIUM | Mover el cómputo del grafo al worker, persistir en `Audit.stats`; requiere backfill opcional para audits ya existentes (o degradar con gracia mostrando "no disponible para auditorías previas a esta versión") |
| Etiquetas de plantilla incorrectas ya mostradas a usuarios | LOW | Es un campo derivado/no persistido de forma crítica (a menos que se decida guardarlo) — ajustar la heurística y que el próximo audit del usuario muestre la corrección; no requiere migración si no se persiste `template` en `Page` |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| `Page.depth` no es profundidad real en modo sitemap | Fase: Check de profundidad de clics | Test contra fixture sembrado por sitemap con arquitectura de enlaces conocida; confirmar profundidades no-cero |
| Diagnósticos de Lighthouse "gratis" sólo si se extraen antes del cacheo | Fase: Diagnósticos de Lighthouse | Test unitario de `parser.ts` que verifique los nuevos campos; code review confirma que no hay una segunda llamada a `runPsi`/`fetch` |
| Doble conteo de severidad en score de `perf` | Fase: Diagnósticos de Lighthouse | Test de regresión de score con fixture de referencia antes/después |
| Falsos positivos de schema-contenido en CSR/markup no estándar | Fase: Check schema-contenido | Test con página `<details>/<summary>` y página CSR fuera de muestra; severidad tope `warning` verificada en test |
| Fingerprints colapsados por falta de sub-tipo | Fase: Diagnósticos de Lighthouse (y agrupación por plantilla si aplica) | Test de diff con 2+ hallazgos por página del mismo check, verificando diffStatus independiente por sub-tipo |
| Visualizador recalculando HTML en cada request | Fase: Visualizador de arquitectura | Medición de tiempo de carga del reporte con audit de ~500 páginas; código del visualizador no importa Cheerio/lee `Page.html` en `apps/web` |
| Clasificación de plantilla incorrecta sin fallback | Fase: Agrupación por plantilla | Test con URLs de al menos 2 convenciones distintas + caso sin convención reconocible cayendo en "desconocido" |
| 3 pasadas redundantes de Cheerio sobre las mismas 500 páginas | Fase: Visualizador de arquitectura (última de las 3 en tocar el grafo de enlaces) | Code review: confirmar que profundidad de clics + visualizador comparten el mismo cómputo de grafo que ya usa `orphanPages.ts`, no cada uno el suyo |

## Sources

- Lectura directa del código fuente (HIGH confidence, verificado línea por línea):
  - `packages/crawler/src/crawl.ts` — semántica real de `Page.depth` en ambos modos de seed
  - `packages/psi/src/{client,parser,cache}.ts` — qué se extrae y qué se cachea de la respuesta de PSI
  - `packages/checks/src/checks/tech/orphanPages.ts` — patrón existente de parseo de grafo de enlaces desde HTML almacenado
  - `packages/checks/src/checks/schema/schemaTypes.ts` — cómo opera hoy un check de schema (sobre HTML crudo, sin cruce con CSR/render)
  - `packages/report-model/src/build.ts` — filosofía "sólo datos persistidos, sin checks recomputados" del reporte
  - `packages/scoring/src/{categoryScore,diff}.ts` — modelo de score por promedio de salud y diff puro por fingerprint
  - `packages/db/prisma/schema.prisma` — confirma ausencia de campo `template` en `Page` y que `html` es `String @db.Text`
- `.planning/PROJECT.md` — contexto del milestone v1.3, decisiones previas (v1.1 UI-only, v1.2 aditivo, render como riesgo informativo — precedentes reutilizados como guía de severidad para los checks nuevos)

---
*Pitfalls research for: Auditor Web (SEO/Técnico) — milestone v1.3*
*Researched: 2026-07-08*
