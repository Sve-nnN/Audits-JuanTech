# Pitfalls Research

**Domain:** Auditoría de meta tags / Open Graph / Twitter Card / favicon + preview social, agregada a un crawler SEO existente (500 URLs, score health-ratio size-independent, `buildReportModel` como single source of truth)
**Researched:** 2026-07-31
**Confidence:** HIGH en los pitfalls de arquitectura (verificados leyendo el código de este repo), MEDIUM en los de comportamiento de plataformas (Facebook/X/LinkedIn no documentan sus límites de truncado y cambian sin aviso — eso es, en sí mismo, uno de los pitfalls)

**Nombres de fase provisionales usados abajo** (el roadmap todavía no existe; v1.6 arranca alrededor de Phase 28):

| Ref | Fase provisional |
|-----|------------------|
| **A** | Captura de datos en el crawler (response time, tamaño de HTML, headers extra) |
| **B** | Categoría + scoring (nueva categoría "social", rebalanceo de pesos, retiro/ajuste de ONPAGE-05) |
| **C** | Checks de meta tags / OG / Twitter Card / favicon / charset / viewport |
| **D** | Validación de red de `og:image` (muestreada, deduplicada) |
| **E** | Panel visual de preview social en el reporte |
| **F** | Snippets HTML de fix |

---

## Critical Pitfalls

### Pitfall 1: Doble penalización por convivir con ONPAGE-05

**What goes wrong:**
`packages/checks/src/checks/onpage/openGraph.ts` (ONPAGE-05) ya evalúa `og:title`, `og:description`, `og:image`, `og:url` y emite una fila `Issue` por página con `category: "onpage"`. Si v1.6 agrega checks equivalentes con `category: "social"`, un sitio sin Open Graph pierde puntos dos veces: una en el score On-Page y otra en el score Meta Tags/Social. Como ambos entran ponderados a `scoreOverall`, el peso efectivo del Open Graph en el score general se duplica sin que nadie lo haya decidido.

**Why it happens:**
El nuevo catálogo de checks se diseña "desde cero" mirando el objetivo del milestone, no el catálogo existente. ONPAGE-05 está enterrado en una carpeta de 12 archivos y es fácil no verlo.

**How to avoid:**
Decidir explícitamente una de estas tres, y dejarla escrita en Key Decisions antes de escribir checks:
1. **Retirar ONPAGE-05** del registry y reemplazarlo por los checks `SOCIAL-*` (lo más limpio conceptualmente, pero dispara el Pitfall 13 sobre el diff).
2. **Reducir ONPAGE-05** a un check de presencia mínima y mover todo el detalle (longitudes, imagen, Twitter, favicon) a `social`.
3. Mantener ambos y **bajar el peso** de `onpage` en `CATEGORY_WEIGHTS` para compensar.

Verificación mecánica: un test que recorra el registry y falle si dos `checkId` de categorías distintas leen el mismo tag OG.

**Warning signs:**
Un fixture sin ninguna etiqueta OG baja el overall más de lo que bajaba en v1.5 por el mismo defecto. En el reporte aparecen dos filas con títulos casi idénticos ("Sin etiquetas Open Graph" y "Falta og:title") para la misma URL.

**Phase to address:** B (decisión + rebalanceo), C (implementación de los checks nuevos ya sabiendo qué pasa con ONPAGE-05)

---

### Pitfall 2: Sumar la 6ª categoría sin rebalancear `CATEGORY_WEIGHTS` — renormalización silenciosa

**What goes wrong:**
`CATEGORY_WEIGHTS` en `packages/scoring/src/overallScore.ts` suma exactamente 1.0 (tech .30, perf .30, onpage .15, schema .10, aeo .15). Si se agrega `social: 0.1` sin restar de otras, `totalWeight` pasa a 1.1 y `scoreOverall` **no falla**: renormaliza dividiendo por `totalWeight`. El resultado es que todas las categorías existentes pierden ~9% de peso relativo de forma invisible, y todo score histórico deja de ser comparable con los nuevos. No hay ningún assert que proteja la suma = 1.0.

**Why it happens:**
La renormalización existe por una buena razón (una categoría ausente no debe contar como 0), pero convierte un error de configuración en un cambio de comportamiento silencioso en vez de una excepción.

**How to avoid:**
- Agregar un test en `overallScore.test.ts`: la suma de `CATEGORY_WEIGHTS` debe ser 1.0. Debería existir aunque no se agregue la categoría.
- Decidir de dónde sale el peso de `social` de forma explícita. Sugerencia defendible: `social` 0.10 tomado de `onpage` (0.15 → 0.10) y `schema` (0.10 → 0.05), dejando tech/perf/aeo intactos — porque social es literalmente un desprendimiento de on-page (ver Pitfall 1), no una dimensión nueva de calidad.
- Recalcular el fixture de referencia (juan-tech.com, overall 91 en v1.0) **antes y después** y registrar el delta en el ROADMAP. Si el delta es grande, es una decisión de producto, no un detalle de implementación.

**Warning signs:**
El overall de la auditoría de fixture se mueve varios puntos sin que ningún check nuevo haya detectado nada. La pantalla de historial muestra un salto de score entre la última auditoría v1.5 y la primera v1.6 del mismo sitio.

**Phase to address:** B

---

### Pitfall 3: Dilución del health-ratio con checks que casi siempre pasan

**What goes wrong:**
`scoreCategory` es un promedio plano sobre filas de `Issue`: cada fila vale 1 (ok), 0.5 (warning) o 0 (critical). Los checks de meta tags que más fácil se implementan (`charset` presente, `viewport` presente) pasan en prácticamente el 100% de las páginas de cualquier sitio hecho con CMS. Si se emite una fila `ok` por página por cada uno de esos checks, el denominador se llena de aprobados triviales y el score "Meta Tags/Social" queda anclado arriba de 90 para todo el mundo, incluso para un sitio sin ni una sola etiqueta OG. La categoría deja de discriminar y el panel nuevo pierde sentido como lead magnet.

El error espejo también existe: si se emiten filas **sólo cuando el check falla**, `scoreCategory` devuelve 100 con cero filas (caso "sin datos" = perfecto) y, apenas aparece un fallo, la categoría cae en picada porque el denominador es minúsculo.

**Why it happens:**
El modelo health-ratio funciona bien en las categorías existentes porque ahí los checks tienen tasas de fallo realistas y variadas. Nadie revisa la distribución esperada de resultados antes de agregar un check.

**How to avoid:**
- Antes de fijar el catálogo, correr los checks candidatos sobre 5-6 sitios reales de perfiles distintos (WordPress, Shopify, Webflow, un sitio a código) y mirar la **tasa de aprobación de cada check**. Cualquier check que pase en >95% de páginas en todos los perfiles no aporta poder discriminante: convertirlo en site-level (Pitfall 4) o sacarlo del score y dejarlo como informativo.
- Mantener el patrón `ok` explícito (es lo que hace hoy el resto del catálogo y es lo correcto para el health-ratio), pero equilibrar el catálogo: apuntar a que la categoría tenga cantidades comparables de checks fáciles y exigentes.
- Dejar registrado en el ROADMAP cuál es el score esperado de la categoría para un sitio "promedio" (debería caer en 60-80, no en 95+).

**Warning signs:**
El score de la categoría nueva es el más alto del reporte en todos los sitios de prueba. La desviación del score social entre un sitio bien optimizado y uno sin ninguna etiqueta OG es menor a 20 puntos.

**Phase to address:** C (diseño del catálogo), B (calibración contra fixtures)

---

### Pitfall 4: Checks site-level implementados como page-level (favicon sobre todo)

**What goes wrong:**
El favicon es un recurso del **sitio**, no de la página: Google lo busca en el home y usa uno solo para todo el dominio. Si se implementa como `PageCheck`, se emiten 500 filas idénticas ("favicon presente") que inundan el denominador del health-ratio (Pitfall 3), inflan la tabla de Issues con 500 entradas redundantes, y consumen 500 filas de Postgres por auditoría por un único hecho. Lo mismo aplica, con matices, a `charset` y `viewport`: son casi siempre propiedades de la plantilla, no de la página.

**Why it happens:**
`PageCheck` es la interfaz más cómoda: ya recibe el `$` de Cheerio parseado. Hacer `SiteCheck` obliga a re-parsear el HTML del home, y se toma el atajo.

**How to avoid:**
- Favicon → `SiteCheck` con `scope: "favicon"`, evaluado sobre la página home (identificable por `Audit.resolvedUrl` de v1.4). Emite 1 fila.
- `charset` / `viewport` → decidir entre `SiteCheck` con muestreo, o `PageCheck` que reporte **agregado** (una fila site-level del tipo "X de Y páginas sin viewport"), siguiendo el precedente de DEPTH-03 (issue agregado de % de páginas a >3 clics) que ya existe en v1.3.
- Regla de oro para el roadmap: si el valor medido es idéntico en el 100% de las páginas de un sitio típico, es site-level.

**Warning signs:**
El conteo de filas `Issue` por auditoría se dispara varios miles respecto a v1.5. La tabla de issues del reporte muestra la misma recomendación 500 veces (el agrupador por tipo de v1.2 lo va a esconder visualmente, lo que hace que el problema pase inadvertido hasta que se mira la DB).

**Phase to address:** C

---

### Pitfall 5: Selector de meta tags que pierde la mitad de las etiquetas (`property` vs `name`)

**What goes wrong:**
ONPAGE-05 hoy hace `$("meta[property]")`. Ese selector:
- **Pierde** las etiquetas `og:` que muchos CMS y plugins emiten como `<meta name="og:title">` (técnicamente incorrecto según el protocolo OG, pero tolerado por las plataformas y común en el mundo real) → falso positivo "falta og:title".
- **No sirve** para Twitter Card, que el estándar define con `name="twitter:card"` — pero que Yoast, RankMath y varios themes emiten como `property="twitter:card"`. Un check que sólo mire uno de los dos atributos va a reportar falsos positivos en una porción grande de sitios WordPress, que es justo el perfil de usuario del lead magnet.

Además, la comparación es case-sensitive: `<meta property="OG:Title">` existe en la naturaleza y `Set.has("og:title")` falla.

**Why it happens:**
Se implementa contra la especificación en vez de contra el HTML real. La especificación dice `property` para OG y `name` para Twitter; la realidad es que ambos se mezclan.

**How to avoid:**
Un único extractor compartido, testeado, que:
1. Recorre `$("meta")` una sola vez.
2. Lee `property || name` (en ese orden de preferencia), lo normaliza a minúsculas y hace trim.
3. Devuelve un `Map<string, string[]>` (array, no string — ver Pitfall 6) construido en un `Map` o en un objeto sin prototipo, ya que las claves vienen del sitio auditado y esto es el mismo riesgo de prototype pollution que `curateHeaders` ya mitiga con allowlist en v1.5.
4. Ignora `<meta>` con `content` vacío o sólo whitespace — una etiqueta presente pero vacía es un fallo, no un aprobado.

Fixtures obligatorios: Yoast, RankMath, Shopify default, Webflow, Next.js Metadata API, y un caso con `property` y `name` duplicados y contradictorios.

**Warning signs:**
El check reporta "falta twitter:card" en sitios donde el validador de X sí muestra la card. Discrepancia entre lo que dice el reporte y lo que devuelve un validador externo sobre la misma URL.

**Phase to address:** C

---

### Pitfall 6: `og:image` — relativa, protocol-relative, múltiple y con fallback cruzado a `twitter:image`

**What goes wrong:**
Cuatro fallos distintos que se suelen tratar como uno:

1. **Relativa.** El crawler de Facebook trae la página desde sus propios servidores y no resuelve rutas relativas: `og:image="/img/og.png"` produce preview roto. Un check que sólo verifique presencia lo da por aprobado. Este es probablemente el hallazgo de mayor valor de todo el milestone y es fácil no implementarlo.
2. **Protocol-relative** (`//cdn.ejemplo.com/og.png`) y **http:// en un sitio https**: se resuelven, pero fallan o degradan en plataformas que exigen https. Un `new URL(value, base)` los normaliza en silencio y el check pasa.
3. **Múltiples `og:image`.** El protocolo lo permite explícitamente y la primera es la que se usa como principal. Un extractor que colapse a un solo valor (último gana, típico de `Map.set` en loop) va a validar la imagen equivocada — reportando OK sobre la segunda cuando la primera, que es la que se muestra, está rota.
4. **`twitter:image` ausente NO es un error.** X cae de vuelta a `og:image` cuando no hay `twitter:image`. Reportarlo como issue genera un falso positivo en la mayoría de los sitios correctamente configurados, y es exactamente el tipo de ruido que destruye la credibilidad de un lead magnet.

**Why it happens:**
El modelo mental es "un tag, un valor". El protocolo OG es multivaluado y con fallbacks entre vocabularios.

**How to avoid:**
- El extractor devuelve arrays (ver Pitfall 5); la validación de imagen corre sobre **la primera** `og:image` y lo dice explícitamente en `criterion`.
- Check dedicado a "og:image absoluta y https": comparar el valor crudo contra el resuelto; si difieren, es relativa → issue de severidad alta (rompe el preview en Facebook y LinkedIn). Rechazar también `//` y `http:` en sitios https.
- La ausencia de `twitter:image` se evalúa **sólo** si tampoco hay `og:image`. Documentar la cadena de fallback (twitter:image → og:image; twitter:title → og:title → `<title>`) en el `criterion` de cada check, porque es la parte que el usuario no sabe y es donde está el valor educativo.

**Warning signs:**
Un sitio con preview visiblemente roto en Facebook saca 100 en la categoría social. El reporte recomienda agregar `twitter:image` a sitios que ya tienen `og:image`.

**Phase to address:** C (parsing y resolución), D (verificación de red de que la imagen existe)

---

### Pitfall 7: Un request HTTP por `og:image` sobre 500 URLs

**What goes wrong:**
Verificar que la `og:image` existe (200, tipo de imagen correcto, tamaño suficiente) requiere red. Hacerlo ingenuamente son 500 requests extra por auditoría — sumados a los 500 del crawl, más los de TECH-12/TECH-13, más PSI. En un sitio con CDN lento eso agrega varios minutos al tiempo de auditoría y hace que el job parezca colgado, que es exactamente el modo de fallo que `MAX_URLS_PER_NETWORK_CHECK` ya existe para prevenir.

Lo irónico: en la gran mayoría de los sitios reales **la `og:image` es la misma en todas las páginas** (imagen por defecto del theme). Sin deduplicar se hacen 500 requests para verificar 1 imagen.

**Why it happens:**
El check se escribe como `PageCheck` (que es síncrono, así que ni siquiera puede hacer red) o como `NetworkCheck` que itera páginas sin construir el set único primero.

**How to avoid:**
Reusar tal cual el patrón ya probado de `brokenResourcesCheck` (TECH-13):
1. `NetworkCheck`, no `PageCheck`.
2. `Map<urlNormalizada, páginaOrigen>` para deduplicar antes de tocar la red.
3. `slice(0, MAX_URLS_PER_NETWORK_CHECK)` + la fila `ok` de "verificación limitada" que ya se emite en TECH-13, para ser transparente sobre el muestreo.
4. `checkLinks()` de `linkChecker.ts`, que ya trae HEAD→GET fallback, timeout de 5s y concurrencia 12.

No escribir un cliente HTTP nuevo. Si hace falta leer `content-length` o `content-type` de la respuesta, extender `LinkCheckResult` en `linkChecker.ts` (cambio pequeño, un solo lugar) en vez de duplicar el fetcher.

**Warning signs:**
El tiempo de auditoría del fixture sube más de ~20% respecto a v1.5. Aparecen timeouts o rate-limit del CDN del sitio auditado durante la fase de checks (no durante el crawl).

**Phase to address:** D

---

### Pitfall 8: Medir "response time" de forma no representativa

**What goes wrong:**
El crawler corre con `maxConcurrency: 5`, `maxRequestsPerMinute: 120` y `maxRequestRetries: 2` (`packages/crawler/src/crawl.ts`). Si el response time se mide con reloj de pared alrededor del handler o de la request encolada, se está midiendo **la propia auto-limitación del crawler**, no la velocidad del servidor: a 120 req/min el rate limiter inserta esperas de cientos de milisegundos que se atribuirían injustamente al sitio auditado. Peor: si la request fue un reintento, el tiempo puede incluir el backoff de Crawlee.

Encima, el número resultante va a contradecir al TTFB que PSI/CrUX ya muestra en el mismo reporte (que es de campo, desde clientes reales, con otra geografía y otra red). Dos métricas de "velocidad" que no coinciden, en el mismo PDF, sin explicación, es un problema de credibilidad, no de código.

**Why it happens:**
`Date.now()` antes y después es la implementación de una línea, y el sesgo por la cola no se ve en desarrollo (donde se prueba con pocas URLs y sin saturar el limiter).

**How to avoid:**
- Medir **sólo la transacción HTTP**, no el tiempo en cola ni el parseo. Con `got-scraping` (lo que usa `CheerioCrawler` por debajo) esto sale de los timings del propio request, no de un cronómetro externo. Si no se puede acceder a los timings sin tocar el hot path, es preferible **no** enviar la métrica que enviarla sesgada.
- Descartar explícitamente las mediciones de requests que tuvieron reintentos.
- Etiquetar la métrica de forma honesta en la UI: "tiempo de respuesta medido por el crawler (1 muestra, sin caché de navegador, desde el datacenter del worker)" — y decir en la propia UI que **no** es comparable con el TTFB de campo de la sección de rendimiento.
- Reportar mediana/p75 del sitio, nunca el promedio: una sola página lenta distorsiona la media y genera una recomendación falsa.
- **Riesgo de proceso:** esto obliga a tocar `packages/crawler`, el único componente que todos los milestones v1.1-v1.5 evitaron modificar (todos fueron aditivos). Aislarlo en su propia fase, con el fixture de crawl corriendo antes y después.

**Warning signs:**
El response time medido correlaciona con la posición de la URL en el orden de crawl (señal inequívoca de contaminación por la cola). Los valores se agrupan sospechosamente cerca de 500ms (= 60000/120). El sitio del propio Juan mide "lento" y el navegador dice lo contrario.

**Phase to address:** A

---

### Pitfall 9: "HTML size" que mide algo distinto a lo que el usuario cree

**What goes wrong:**
`Page.html` ya está persistido, así que el tamaño parece gratis: `Buffer.byteLength(page.html)`. Pero ese es el tamaño **descomprimido y ya decodificado** del HTML. Lo que le importa al usuario (y lo que reporta Lighthouse en "Total Byte Weight", que ya aparece en la sección de rendimiento del mismo reporte desde v1.3) es el tamaño **transferido**, con gzip/brotli aplicado — típicamente 4-6× menor. Reportar 480 KB donde Lighthouse dice 95 KB, en el mismo documento, sin aclaración, es un bug de credibilidad.

Segundo problema: `content-length` y `content-encoding` **no están** en `CURATED_HEADER_KEYS` (`packages/crawler/src/captureHeaders.ts`), así que el dato real de transferencia no se está persistiendo hoy.

**Why it happens:**
El campo ya está en la DB y "tamaño de HTML" suena inequívoco. No lo es.

**How to avoid:**
- Agregar `content-length` y `content-encoding` al allowlist de `CURATED_HEADER_KEYS`. Respetar la invariante documentada ahí: el allowlist es la única superficie que se persiste y es control de seguridad (T-25-02/03) — se extiende agregando claves a la lista, nunca iterando las keys entrantes.
- Reportar **los dos** números con etiquetas distintas: "HTML transferido (comprimido)" y "HTML sin comprimir". La diferencia entre ambos es en sí misma un hallazgo accionable: si son iguales, el sitio **no tiene compresión activada**, que es un issue real y valioso (y complementa, sin duplicar, el diagnóstico de compresión de Lighthouse de v1.3 — verificar el solapamiento antes de emitir ambos).
- Si `content-length` viene ausente (respuesta con `transfer-encoding: chunked`, muy común detrás de CDN), degradar limpio: reportar sólo el tamaño sin comprimir, marcado como tal. Nunca inventar el dato.

**Warning signs:**
El número de "HTML size" del reporte es sistemáticamente ~5× el de la sección de rendimiento. Sitios detrás de Cloudflare reportan tamaño nulo o faltante.

**Phase to address:** A

---

### Pitfall 10: Umbrales de longitud de `og:title`/`og:description` tratados como reglas duras

**What goes wrong:**
Se codifican límites tipo "og:title ≤ 60 caracteres, og:description ≤ 120" y se emite `critical`/`warning` al pasarlos. El problema: **ninguna plataforma publica límites oficiales de Open Graph**. Facebook explícitamente no da tope para `og:description`, sólo recomienda 2-4 oraciones. Los números que circulan son observaciones de truncado visual, que dependen de plataforma, desktop vs móvil, ancho del viewport, idioma, y del rediseño de turno. Las fuentes secundarias que los publican se contradicen entre sí (60-70 vs 40-50 caracteres para el mismo `og:title` según dispositivo). Un check que diga "excede el límite" está afirmando algo falso, y va a envejecer mal y en silencio.

**Why it happens:**
Es el patrón mental heredado del `<title>`/meta description de SEO clásico, donde sí hay umbrales establecidos (y donde igual son píxeles, no caracteres).

**How to avoid:**
- Severidad máxima `warning`, nunca `critical`, para cualquier check de longitud social.
- Redactar el `measuredValue`/`criterion` como **riesgo**, no como violación: "78 caracteres — puede recortarse en el preview móvil de Facebook" en vez de "excede el límite de 60".
- Centralizar los umbrales en **un solo módulo de constantes** con comentario de fecha y fuente. Cuando (no si) cambien, es un archivo.
- Emitir `critical` sólo por hechos verificables y estables: tag ausente, `content` vacío, `og:image` relativa, `og:image` que devuelve 404. Esos no dependen del diseño de nadie.
- El caso de longitud **cero o casi cero** (`og:description` de 12 caracteres) es más accionable que el de exceso y casi nadie lo chequea.

**Warning signs:**
Sitios bien optimizados reciben `critical` por longitud. Las recomendaciones citan un número exacto de caracteres como si fuera normativo.

**Phase to address:** C

---

### Pitfall 11: Vender el panel de preview como "así se va a ver", cuando no es cierto

**What goes wrong:**
El panel visual promete mostrar el preview de Google/Twitter/Facebook/LinkedIn. Tres razones por las que va a mentir:

1. **X cambió el formato del preview en 2023**: primero eliminó título y descripción dejando sólo la imagen con el dominio superpuesto, y después reincorporó parcialmente los headlines (la descripción no volvió). Cualquier mockup de "tarjeta de Twitter" con título + descripción está dibujando un formato que la plataforma ya no usa así.
2. **LinkedIn cachea agresivamente** por URL. Aunque los tags estén perfectos, el preview real puede mostrar contenido viejo hasta que se fuerza un re-scrape en su Post Inspector. Un usuario que "arregla" los tags según el reporte y ve el preview viejo en LinkedIn va a concluir que la herramienta está mal.
3. Cada plataforma trunca en píxeles según el viewport, no en caracteres, así que el punto de corte del mockup nunca coincide exactamente.

**Why it happens:**
Se copia el look de herramientas de preview conocidas sin verificar si el formato que replican sigue vigente. Los mockups de referencia que circulan por internet están congelados en el diseño de 2021.

**How to avoid:**
- Rebautizar la promesa: "Vista previa aproximada de tus etiquetas" con un disclaimer de una línea. No "así se ve en X".
- Verificar el formato actual de cada plataforma en el momento de implementar la fase (no confiar en este documento ni en el conocimiento del modelo — es el dato de vida más corta de todo el milestone).
- Para LinkedIn, agregar en la recomendación el enlace al Post Inspector con la instrucción de forzar re-scrape después de corregir. Eso convierte una fuente de reclamos en un consejo útil, que es exactamente el tipo de detalle que diferencia al lead magnet.
- Que el panel muestre el **dato crudo** (el valor exacto de cada tag) junto al mockup. El dato crudo no envejece; el mockup sí.

**Warning signs:**
El mockup del preview no se parece a lo que sale al pegar la URL en la plataforma real. Feedback del tipo "arreglé lo que me dijeron y LinkedIn sigue mostrando lo viejo".

**Phase to address:** E

---

### Pitfall 12: Renderizar contenido controlado por el sitio auditado en el panel de preview

**What goes wrong:**
El panel de preview muestra, por diseño, strings y una imagen que vienen del HTML de un sitio de terceros arbitrario que el usuario eligió. Superficies de riesgo concretas:

1. **XSS.** React escapa texto, pero no protege si el valor se mete en `dangerouslySetInnerHTML`, en `style`, o como `href`/`src` — un `og:url` con `javascript:` puesto en un `<a href>` es ejecutable. Lo mismo aplica a los snippets de fix (fase F) si se generan concatenando el valor actual del tag dentro del HTML de ejemplo.
2. **Hotlink de `og:image` desde el navegador del usuario.** Carga un recurso de un dominio arbitrario en la sesión del usuario del reporte: filtra su IP/User-Agent al sitio auditado, puede fallar por protección de hotlinking (preview roto que parece bug propio), y arrastra el `Referer` del reporte.
3. **Proxear la imagen desde el servidor para evitar (2) crea SSRF**: una `og:image` apuntando a `http://169.254.169.254/` o a una IP privada convierte el proxy en un lector de la red interna.
4. **`<iframe>` del sitio auditado** para "previsualizar" no funciona en la práctica (la mayoría de los sitios envía `X-Frame-Options`/`frame-ancestors`) y además le entrega la superficie de clickjacking al sitio ajeno. No usarlo.
5. **CSP.** El proyecto ya tomó una decisión de arquitectura por CSP estricta (v1.4 Phase 22: dendrograma sin librerías de layout en cliente), aunque no encontré cabeceras CSP declaradas en `apps/web/next.config.ts` — hay que confirmar dónde se aplican realmente antes de asumir cualquier cosa. Si existe una `img-src` restrictiva, la `og:image` de un dominio arbitrario será bloqueada y el panel se verá roto sólo en producción, no en desarrollo.

**How to avoid:**
- Validar y normalizar toda URL extraída con una allowlist de esquemas (`https:`, `http:` y nada más) **antes** de que llegue a la UI. Zod ya está en el stack.
- Los valores de tag se renderizan siempre como texto, nunca como HTML ni como atributo de navegación.
- Para los snippets de fix (F): escapar el contenido interpolado, o mejor, generar snippets con **placeholders** (`TU_TITULO_AQUI`) en vez de reinyectar el valor actual del sitio.
- Decidir explícitamente entre no cargar la imagen (mostrar el estado "imagen: URL X, verificada 200 OK" con un placeholder gráfico) o cargarla con `referrerpolicy="no-referrer"`. Si se opta por proxy, rechazar IPs privadas/loopback/link-local tras resolver DNS y limitar el tamaño de la respuesta.
- Verificar la CSP efectiva en producción con la `og:image` de un dominio externo antes de dar la fase por cerrada.

**Warning signs:**
El panel funciona en local y se ve roto en Vercel. Errores de CSP en la consola sólo en producción. Cualquier ruta nueva que reciba una URL por query param y haga fetch.

**Phase to address:** E (renderizado y CSP), F (generación de snippets), y una revisión del `SECURITY.md` que v1.5 inauguró

---

### Pitfall 13: El diff entre corridas se llena de ruido en la primera auditoría v1.6

**What goes wrong:**
`diffIssues` compara por `fingerprint`. Dos efectos combinados en la primera auditoría v1.6 de un sitio ya auditado:
- Todos los `SOCIAL-*` son fingerprints nuevos → aparecen como **"nuevos"**, aunque el sitio no haya cambiado nada. Un usuario recurrente ve "aparecieron 340 problemas nuevos" y concluye que su sitio empeoró.
- Si se retira ONPAGE-05 (Pitfall 1), todos sus fingerprints desaparecen del set actual → `diffIssues` los marca como **"resueltos"**, felicitando al usuario por arreglar algo que nunca arregló.

**Why it happens:**
El diff es puro y correcto; el supuesto implícito es que el catálogo de checks es estable entre corridas. Ningún milestone anterior agregó checks a categorías ya diffeadas de forma masiva.

**How to avoid:**
- La opción barata y honesta: detectar en la UI del historial cuándo la auditoría previa fue de una versión anterior del catálogo y mostrar un aviso ("esta auditoría incluye una categoría nueva; los cambios respecto a la anterior no son comparables"). Requiere versionar el catálogo — un entero en `Audit`, no un sistema.
- Alternativa más cara: excluir del diff los `checkId` que no existían en la auditoría previa. Más correcto, pero necesita saber qué checks corrieron en cada auditoría.
- Lo que **no** hay que hacer es reusar los fingerprints de ONPAGE-05 en los checks nuevos para "preservar continuidad": eso hace que el diff mienta en la dirección opuesta y ensucia el catálogo permanentemente.

**Warning signs:**
La primera auditoría v1.6 de juan-tech.com muestra cientos de issues "nuevos" y decenas de "resueltos" sin que el sitio haya cambiado.

**Phase to address:** B (versionado del catálogo), y verificación en la fase que cierre el milestone

---

### Pitfall 14: La categoría nueva llega al reporte web pero desaparece de los exports

**What goes wrong:**
`buildReportModel` es single source of truth **de los datos**, no de las etiquetas. Las etiquetas de categoría están duplicadas en al menos dos lugares (`packages/export/src/labels.ts` y `apps/web/app/components/ui/labels.ts`), y `CATEGORY_ORDER` está hardcodeado en `packages/report-model/src/build.ts` como `["tech", "perf", "onpage", "schema", "aeo"]`. Una categoría nueva que no se agregue a `CATEGORY_ORDER` queda fuera del orden de renderizado; una que no esté en cada `labels.ts` se muestra sin nombre o directamente se omite. El efecto típico: se ve perfecto en la web y falta en el PDF/PPTX, que es lo que el usuario comparte con su cliente.

**Why it happens:**
La lección de v1.5 (resolver en `buildReportModel` para que llegue gratis a los exports) se generaliza de más: llega gratis lo que fluye por el modelo, no lo que está hardcodeado en los serializers.

**How to avoid:**
- Derivar las etiquetas de un único mapa exportado y tipado por la union `Category`, de modo que TypeScript falle al compilar cuando falte un caso (`Record<Category, string>` ya lo hace si el tipo se extiende correctamente — verificar que ambos `labels.ts` estén tipados así y no como `Record<string, string>`).
- Test de export: generar los 3 formatos desde un fixture que incluya la categoría social y afirmar que el nombre de la categoría aparece en el output de cada uno.
- Recordar que el bug abierto de export PDF (`pdf-export-crash-reading-s`) puede enmascarar este fallo: si el PDF no genera, nadie va a notar que además le falta una categoría.

**Warning signs:**
El PDF tiene 5 tarjetas de categoría y la web 6. Suma de porcentajes que no cierra en algún export.

**Phase to address:** E, con verificación en la fase de cierre del milestone

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Dejar ONPAGE-05 vivo junto a los `SOCIAL-*` "por ahora" | Cero riesgo de romper el diff y el score histórico | Doble penalización permanente; el peso real del OG en el overall queda indefinido y nadie recuerda por qué | Sólo si se compensa bajando el peso de `onpage` **en el mismo commit** y se registra en Key Decisions |
| Emitir el favicon como `PageCheck` para reusar el `$` ya parseado | Ahorra escribir un `SiteCheck` con re-parseo del home | 500 filas idénticas por auditoría, denominador del health-ratio contaminado, tabla de issues inflada | Nunca — el costo aparece en la primera auditoría real |
| Medir response time con `Date.now()` alrededor del handler | Una línea, funciona en dev | Métrica sesgada por el propio rate limiter que se publica como si fuera del sitio auditado; destruye credibilidad y es difícil de detectar después | Nunca. Preferible no enviar la métrica |
| Reportar tamaño de HTML desde `Page.html` sin `content-length` | El dato ya está en la DB, cero cambios al crawler | Contradice al Total Byte Weight de Lighthouse en el mismo reporte; se pierde el hallazgo de "sin compresión" | Aceptable en MVP **sólo** si la etiqueta dice explícitamente "sin comprimir" |
| Hardcodear umbrales de longitud dispersos en cada check | Rápido de escribir | Cuando una plataforma cambie el truncado hay que tocar N archivos y nadie sabe cuáles | Nunca — centralizar cuesta 10 minutos |
| Verificar `og:image` sin deduplicar | Implementación directa | 500 requests para verificar 1 imagen; minutos de auditoría; riesgo de rate-limit del CDN ajeno | Nunca — `brokenResourcesCheck` ya tiene el patrón hecho |
| Panel de preview con mockups estáticos copiados de otra herramienta | Se ve bien de inmediato | Replica formatos de plataforma ya obsoletos; envejece sin que nadie se entere | Aceptable si va con disclaimer y se muestra el valor crudo del tag al lado |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Crawlee / `CheerioCrawler` | Cronometrar el `requestHandler` y llamarlo "response time" del sitio | Usar los timings del request HTTP; descartar reintentos; si no se accede a ellos sin tocar el hot path, no publicar la métrica |
| `curateHeaders` (v1.5) | Leer `content-length` de `response.headers` en el check, asumiendo que se persistió | No se persiste: el allowlist es cerrado. Agregar `content-length` y `content-encoding` a `CURATED_HEADER_KEYS`, respetando la invariante de que el allowlist es superset de todo lo que se lee |
| `linkChecker` / `checkLinks` | Escribir un fetcher nuevo para validar `og:image` | Reusar `checkLinks` + `MAX_URLS_PER_NETWORK_CHECK`; extender `LinkCheckResult` en un solo lugar si hacen falta `content-type`/`content-length` |
| Crawlers de Facebook / LinkedIn | Asumir que resuelven `og:image` relativa como lo hace un navegador | No lo hacen: traen la página desde sus servidores. Exigir URL absoluta con https y reportar la relativa como fallo real |
| X (Twitter) | Reportar `twitter:*` ausentes como error; dibujar la card con título + descripción | La cadena de fallback a `og:*` es válida; el formato de preview de X cambió en 2023-2024 (sin descripción). Verificar el formato vigente al implementar |
| LinkedIn | Asumir que el preview se actualiza solo al corregir los tags | Cachea por URL. La recomendación debe incluir forzar re-scrape en el Post Inspector |
| Google (favicon) | Chequear favicon por página | Google toma un favicon por sitio, descubierto desde el home. Cuadrado, ≥ 48×48 recomendado, cualquier formato válido (ICO/PNG/SVG) |
| PSI / Lighthouse (ya integrado) | Publicar "response time" y "HTML size" propios sin relacionarlos con el TTFB de campo y el byte weight ya presentes | Etiquetar explícitamente metodología y alcance de cada número, o unificarlos en una sola sección de rendimiento |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Un request por `og:image` por página | La auditoría tarda minutos más; el job parece colgado; el CDN del sitio auditado empieza a rate-limitear | Dedupe por URL normalizada + cap de 150 + `checkLinks` | Ya a ~100 URLs con imágenes distintas por página (blogs, e-commerce) |
| Filas `ok` por página para checks site-level (favicon, charset, viewport) | Filas de `Issue` por auditoría se multiplican; queries del reporte más lentas; Postgres crece rápido | `SiteCheck` o issue agregado (patrón DEPTH-03) | Inmediatamente, en cualquier sitio de 500 páginas |
| Re-parsear el HTML con Cheerio una vez por check nuevo | CPU del worker sube; el paso de checks se alarga notoriamente | Un solo extractor de meta tags por página, resultado compartido entre todos los checks `SOCIAL-*` (ARCH-03 ya establece "sin re-parseo de HTML" como invariante) | A partir de ~6 checks nuevos × 500 páginas |
| Cargar N `og:image` de dominios arbitrarios en el panel del reporte | El reporte tarda en pintar; imágenes rotas por hotlink protection; layout shift | Mostrar sólo la imagen de la muestra visible / lazy loading / placeholder con el resultado de la verificación de red | Cuando el panel liste más de un puñado de páginas |
| Guardar el HTML del preview o los snippets generados por página en Postgres | Crecimiento de la DB, backups más lentos | Generar los snippets en lectura dentro de `buildReportModel` (mismo patrón que las recomendaciones por CMS de v1.5), nunca persistirlos | Al segundo o tercer sitio grande auditado |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Renderizar `og:url`/`og:image` de terceros como `href`/`src` sin validar esquema | XSS vía `javascript:`; carga de recursos arbitrarios | Allowlist de esquemas (`http`/`https`) validada con Zod antes de llegar a la UI |
| Interpolar el valor actual del tag dentro del snippet HTML de fix | Inyección en la UI y en los exports; el snippet copiado por el usuario puede llevar payload a su sitio | Snippets con placeholders, o escapado explícito del contenido interpolado |
| Proxear `og:image` desde el servidor para esquivar hotlink/CSP | SSRF: lectura de red interna / metadata de la nube desde el worker o desde Vercel | Si se proxea: rechazar IPs privadas, loopback y link-local después de resolver DNS; timeout y límite de tamaño de respuesta |
| `<iframe>` del sitio auditado para "previsualizar" | Clickjacking + no funciona en la mayoría de los sitios | No usar iframes de sitios de terceros |
| Construir el mapa de meta tags con un objeto literal indexado por claves del sitio auditado | Prototype pollution (`__proto__` como nombre de tag) | `Map` u objeto sin prototipo — mismo criterio que ya aplica `curateHeaders` |
| Persistir valores completos de meta tags sin revisar | Los meta tags pueden contener datos personales; el proyecto ya declara "exports sin PII" como requisito de v1.2 | Revisar qué se persiste y qué llega a los exports; truncar valores largos |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Preview presentado como fiel a la plataforma | El usuario corrige y no ve el cambio (caché de LinkedIn, formato distinto en X) → concluye que la herramienta miente | "Vista previa aproximada" + valor crudo del tag + instrucción de forzar re-scrape |
| 500 issues de "falta og:image", uno por página | La tabla de issues se vuelve inusable; el problema real (la plantilla) se pierde | Agregar por plantilla — el agrupador por template de v1.3 ya existe y aplica perfecto acá |
| Reportar `twitter:*` faltantes en sitios que ya tienen `og:*` correctos | Ruido; el usuario aprende a desconfiar de la lista | Evaluar la cadena de fallback antes de emitir |
| Recomendaciones genéricas ("agrega og:image") en un producto que desde v1.5 personaliza por CMS | Retroceso perceptible de calidad respecto al milestone anterior | Extender `packages/cms-adapters` con los `SOCIAL-*` de mayor volumen (dónde se pone la imagen social en Yoast, en Shopify, en Webflow) |
| Snippet de fix que no se puede copiar de un click, o que no aclara dónde pegarlo | El usuario no lo usa; la feature no genera el "aha" | Botón de copiar + una línea de "dónde va esto" resuelta por CMS detectado |
| Mostrar response time sin contexto de qué es rápido y qué es lento | Número sin significado | Umbral explícito y comparación con la mediana del propio sitio |

---

## "Looks Done But Isn't" Checklist

- [ ] **Checks de OG:** ¿el extractor lee `property` **y** `name`, en minúsculas, con trim, y trata `content` vacío como fallo? Verificar con fixtures de Yoast, RankMath, Shopify, Webflow y Next.js Metadata API.
- [ ] **`og:image`:** ¿se detecta la relativa, la protocol-relative y la `http:` en sitio https? ¿Se valida la **primera** cuando hay varias?
- [ ] **`twitter:*`:** ¿la cadena de fallback a `og:*` está implementada, y no sólo documentada?
- [ ] **Favicon:** ¿es un check site-level de 1 fila y no 500? ¿Acepta ICO, PNG, SVG y `apple-touch-icon`?
- [ ] **Scoring:** ¿la suma de `CATEGORY_WEIGHTS` = 1.0 está testeada? ¿Se registró el delta del overall del fixture antes/después?
- [ ] **Doble penalización:** ¿ONPAGE-05 fue retirado, reducido o compensado con peso? ¿Está escrito en Key Decisions?
- [ ] **Poder discriminante:** ¿la categoría social da resultados distintos entre un sitio bien optimizado y uno sin ninguna etiqueta? ¿Cuál es el score esperado de un sitio promedio?
- [ ] **Response time:** ¿la medición excluye la espera del rate limiter y los reintentos? ¿Correlaciona con el orden de crawl (señal de contaminación)?
- [ ] **HTML size:** ¿está etiquetado como comprimido o sin comprimir? ¿Degrada limpio cuando falta `content-length`?
- [ ] **Red:** ¿la verificación de `og:image` deduplica y respeta `MAX_URLS_PER_NETWORK_CHECK`? ¿Cuánto subió el tiempo total de auditoría del fixture?
- [ ] **Exports:** ¿la categoría nueva aparece en PDF, Markdown **y** PPTX, con su etiqueta correcta? (Ojo con el crash abierto de PDF, que puede tapar este fallo.)
- [ ] **CSP en producción:** ¿el panel de preview carga una `og:image` de un dominio externo en Vercel, no sólo en local?
- [ ] **Diff:** ¿la primera auditoría v1.6 de un sitio ya auditado se explica en la UI, o muestra cientos de falsos "nuevos" y "resueltos"?
- [ ] **Seguridad:** ¿hay una entrada en `SECURITY.md` para el contenido de terceros renderizado en el panel y para los snippets generados?

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Doble penalización detectada tras el lanzamiento | LOW | Retirar ONPAGE-05 del registry y ajustar pesos. Los scores viejos quedan no comparables; anotarlo en el historial |
| Pesos que no suman 1.0 | LOW | Corregir constantes + test. Los scores emitidos con el bug quedan mal calculados: decidir si se recalculan (los `Issue` están persistidos, así que se puede) |
| Score social sin poder discriminante | MEDIUM | Recalibrar el catálogo (mover checks triviales a site-level o fuera del score) y recalcular desde los `Issue` persistidos |
| Response time sesgado ya publicado | MEDIUM | Ocultar la métrica en la UI de inmediato (es una lectura de `buildReportModel`, no hay migración), arreglar la captura y re-medir en la próxima auditoría. Los datos viejos quedan inutilizables |
| Filas por página que debían ser site-level | MEDIUM | Cambiar la implementación del check + limpiar filas viejas; los scores históricos de la categoría cambian |
| Preview que muestra un formato de plataforma obsoleto | LOW | Es UI pura: ajustar el mockup y el copy |
| SSRF/XSS en el panel | HIGH | Deshabilitar el panel, parchear la validación, revisar logs de acceso del proxy si existió |
| Verificación de `og:image` que hace estallar el tiempo de auditoría | LOW | Es un cap y un dedupe; cambio contenido en un archivo |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Doble penalización con ONPAGE-05 | B (decisión), C (implementación) | Test que falle si dos checkId de categorías distintas leen el mismo tag OG; delta del overall del fixture registrado |
| 2. Pesos que no suman 1.0 | B | Test de suma = 1.0; comparación del score del fixture antes/después |
| 3. Health-ratio diluido | C (catálogo), B (calibración) | Score de la categoría medido sobre 5-6 sitios reales de perfiles distintos; spread mínimo esperado documentado |
| 4. Checks site-level como page-level | C | Conteo de filas `Issue` por auditoría del fixture vs v1.5; favicon = 1 fila |
| 5. Selector `property` vs `name` | C | Fixtures de Yoast/RankMath/Shopify/Webflow/Next.js; contraste contra un validador externo sobre la misma URL |
| 6. `og:image` relativa / múltiple / fallback de Twitter | C (parsing), D (red) | Fixtures con relativa, protocol-relative, múltiples imágenes y sin `twitter:image` |
| 7. Un request por imagen sobre 500 URLs | D | Tiempo total de auditoría del fixture (+20% máximo); conteo de requests de red del check |
| 8. Response time no representativo | A | Ausencia de correlación con el orden de crawl; los reintentos se descartan; el fixture se mide dos veces con resultados estables |
| 9. HTML size ambiguo | A | `content-length` presente en `CURATED_HEADER_KEYS`; ambos números etiquetados; degradación limpia con `transfer-encoding: chunked` |
| 10. Umbrales de longitud como reglas duras | C | Ningún `critical` por longitud; umbrales en un solo módulo con fecha y fuente |
| 11. Preview presentado como fiel | E | Copy revisado; formato de cada plataforma verificado en el momento de implementar; valor crudo del tag visible |
| 12. Contenido de terceros en la UI (XSS/SSRF/CSP) | E, F | Validación de esquema con Zod; prueba en producción con `og:image` de dominio externo; entrada en `SECURITY.md` |
| 13. Ruido en el diff | B (versionado de catálogo) | Diff de la primera auditoría v1.6 sobre un sitio ya auditado en v1.5 |
| 14. Categoría ausente en exports | E + cierre | Test de los 3 exports desde un fixture con categoría social |

---

## Sources

- Código de este repositorio (HIGH — lectura directa): `packages/scoring/src/{categoryScore,overallScore,diff}.ts`, `packages/checks/src/checks/onpage/openGraph.ts`, `packages/checks/src/types.ts`, `packages/checks/src/checks/network/{linkChecker,brokenResources}.ts`, `packages/crawler/src/{crawl,captureHeaders}.ts`, `packages/report-model/src/build.ts`, `packages/db/prisma/schema.prisma`, `apps/web/next.config.ts`
- `.planning/PROJECT.md` — Key Decisions de v1.0-v1.5 (health-ratio, CSP estricta, buildReportModel como SSOT, resolución en lectura de recomendaciones por CMS) — HIGH
- [Google Search Central — Define Website Favicon for Search Results](https://developers.google.com/search/docs/appearance/favicon-in-search) — favicon site-level descubierto desde el home, cuadrado, ≥48×48 recomendado, cualquier formato válido — HIGH (documentación oficial)
- [Social Media Today — X's Updated Link Preview Format Is Now Live](https://www.socialmediatoday.com/news/xs-updated-link-preview-format-removes-headlines-descriptions/695681/) y [Headlines Are Now Returning to Link Previews on X](https://www.socialmediatoday.com/news/headlines-now-returning-link-previews-on-x/703479/) — cambio de formato de preview de X (títulos y descripciones removidos, headlines reincorporados parcialmente) — MEDIUM (prensa especializada, dos fuentes coincidentes; X no documenta esto)
- [Veonr — Relative vs Absolute URL for Open Graph Image](https://veonr.com/blog/relative-vs-absolute-og-image-video-urls) y [PreviewOG — OG Image Guide](https://previewog.com/og-image-guide/) — el crawler de Facebook no resuelve rutas relativas; mínimo 200×200, recomendado 1200×630 — MEDIUM (fuentes secundarias coincidentes, consistentes con la especificación del protocolo OG que exige URL válida con esquema http/https)
- [OGTester — maximum length of og:title and og:description](https://ogtester.com/blog/what-is-maximum-length-of-og-title-and-og-description) y [Letter Counter — Open Graph Character Limits](https://lettercounter.org/blog/og-title-character-limit/) — no hay límites oficiales; los números publicados son observaciones de truncado y **se contradicen entre fuentes** (60-70 vs 40-50 para `og:title` según dispositivo) — LOW en los números concretos, HIGH en la conclusión de que no deben tratarse como reglas duras
- [dev.to — 7 Open Graph Tag Mistakes That Make Your Links Look Broken](https://dev.to/levinunnink/7-open-graph-tag-mistakes-that-make-your-links-look-broken-5h2g) — errores frecuentes de OG en la práctica (relativas, caché de plataformas) — MEDIUM

---
*Pitfalls research for: auditoría de meta tags / Open Graph / social preview sobre un crawler SEO existente*
*Researched: 2026-07-31*
