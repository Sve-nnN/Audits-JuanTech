# Feature Research

**Domain:** Auditoría de meta tags / Open Graph / preview social (categoría nueva dentro de un auditor SEO ya construido)
**Researched:** 2026-07-31
**Confidence:** MEDIUM-HIGH (especificaciones de plataforma y catálogo de checks: HIGH; fórmulas de score de la competencia: MEDIUM, ninguna herramienta publica su algoritmo; taxonomía error/warning: MEDIUM, derivada de convergencia entre herramientas, no de un estándar)

## Contexto: qué ya existe en el repo (verificado en código, no de memoria)

Esto condiciona todo el resto del documento.

| Pieza existente | Ubicación | Impacto en v1.6 |
|---|---|---|
| `ONPAGE-05` — presencia de og:title/og:description/og:image/og:url, severidad `warning` | `packages/checks/src/checks/onpage/openGraph.ts` | **Colisión directa.** Si v1.6 agrega checks OG en categoría nueva sin retirar/migrar este check, el mismo problema se cuenta dos veces (en On-Page y en Meta/Social) y aparece duplicado en la tabla de issues y en los 3 exports. |
| `TECH-07` — viewport | `packages/checks/src/checks/tech/viewport.ts` | Ya cubierto. **No re-implementar** viewport en la categoría nueva; referenciarlo o dejarlo donde está. |
| charset / favicon | No existen | Hueco real. Son checks nuevos. |
| Categorías de score: `tech .30 / perf .30 / onpage .15 / schema .10 / aeo .15` | `packages/scoring/src/overallScore.ts` (`Category` union + `WEIGHTS`) | Agregar una 6ª categoría obliga a **re-balancear pesos** (deben sumar 1.0). Rompe comparabilidad del score general con auditorías previas y con el diff entre corridas. Decisión de producto, no técnica. |
| `Page` (Prisma) sin `responseTimeMs` ni `htmlBytes`; sí guarda `html` completo | `packages/db/prisma/schema.prisma:107` | Response time exige instrumentar el crawler (migración + código). HTML size se puede derivar de `html` sin migración, pero conviene persistir el número. |
| Crawler Cheerio con `requestHandler` que ya tiene `response` y `body` en mano | `packages/crawler/src/crawl.ts:100` | Response time y tamaño se miden **sin requests extra**. Mismo patrón que FPRINT-01 (headers curados). |
| `packages/cms-adapters` — `resolveCmsRecommendation` con fallback garantizado, resuelto en lectura en `buildReportModel` | v1.5, Phase 27 | Los snippets de fix de v1.6 deben **enchufarse acá**, no crear un segundo motor de recomendaciones. |
| `buildReportModel` como única fuente de verdad (UI + PDF + Markdown + PPTX) | `packages/report-model` | Todo lo que se agregue al modelo llega gratis a los 3 exports. El panel visual de preview, en cambio, es solo web (no exportable como card interactiva). |

## Feature Landscape

### Table Stakes (los usuarios los dan por hechos)

Faltando cualquiera de estos, la categoría "Meta Tags/Social" se siente incompleta frente a opengraph.to / Meta Tags.io / el reporte Social Tags de Ahrefs.

| Feature | Por qué se espera | Complejidad | Notas de implementación |
|---|---|---|---|
| **og:title** presencia + longitud | Es el titular de la card. Todas las herramientas lo listan primero. | LOW | Se lee del `$` ya parseado. Longitud ideal 30–60 chars (Ahrefs: ~40 móvil / ~60 desktop, sin guía oficial de Meta). |
| **og:description** presencia + longitud | Segundo elemento visible de la card. | LOW | 55–200 chars. Facebook trunca cerca de 200; X trunca antes. |
| **og:image** presencia + URL absoluta HTTPS | Sin imagen la card colapsa a texto plano; es el issue #1 reportado por todas las herramientas. | LOW (presencia) | URL relativa = roto en la práctica: los scrapers no resuelven relativos de forma fiable. |
| **og:image** alcanzable + dimensiones + peso | opengraph.io/opengraph.to venden justamente esto: "la etiqueta está pero la imagen está rota o es muy chica". | **HIGH** | Requiere requests HTTP adicionales fuera del crawl. Ver restricción de costo en Anti-Features. |
| **og:url** presencia + coherencia con canonical | og:url discrepante con canonical fragmenta señales sociales y de indexación. | LOW | Reusa el canonical ya calculado en v1.2 (CANON-01..04). |
| **og:type** presencia | Es de los 4 tags **requeridos** por el protocolo Open Graph (junto a title/url/image); `og:description` técnicamente es opcional. | LOW | Corrección al check actual: `ONPAGE-05` pide description y **no** pide `og:type`. |
| **twitter:card** presencia + valor válido | X/Twitter no siempre hereda bien de OG; `summary_large_image` vs `summary` cambia el tamaño de la card. | LOW | Valores válidos: `summary`, `summary_large_image`, `app`, `player`. Cualquier otro = error. |
| **Tags OG duplicados** | Bug clásico de WordPress: Yoast + tema + plugin social emiten 2-3 `og:image`; el scraper elige uno, a menudo el equivocado. | LOW | Contar ocurrencias por propiedad. Alta señal, costo casi cero. |
| **charset declarado** | Sin `<meta charset>` los acentos y la ñ salen rotos en la card social y en el SERP. | LOW | Además debe estar dentro del primer 1 KB del documento (regla de sniffing del HTML spec). |
| **favicon** presente + alcanzable | Aparece en el preview de Google y en las cards de Slack/Discord. Toda herramienta de "meta tags" lo incluye. | MEDIUM | Presencia = LOW. Verificar que responda 200 = un request extra por origen (no por página): barato si se dedupe. |
| **viewport** | Ya lo esperan; ya existe como `TECH-07`. | — | **Dependencia, no feature nueva.** Decidir si se re-expone en el panel Meta/Social sin duplicar el issue. |
| **Score 0–100 de la categoría** + "N errores y M advertencias" | Es el formato de la referencia y del resto del reporte. | LOW | El motor health-ratio size-independent de v1.0 ya lo da; solo hay que sumar la categoría. |
| **Preview visual: Google + Facebook + X/Twitter + LinkedIn** | Es *la* razón por la que alguien usa una herramienta de OG en vez de leer el HTML. | MEDIUM | El riesgo real es cargar imágenes de terceros; ver preguntas abiertas. |
| **Snippet HTML de fix, listo para copiar** | Pedido explícito del milestone y diferencial de las herramientas modernas. | MEDIUM | Debe prellenarse con los valores reales de la página (title existente, URL canónica), no ser un template genérico. |

### Differentiators (ventaja competitiva)

| Feature | Propuesta de valor | Complejidad | Notas |
|---|---|---|---|
| **Auditoría OG a escala de sitio (500 URLs), no de una URL** | opengraph.to, Meta Tags.io, opengraph.io y los clones son **single-URL**. Ahrefs sí es site-wide pero es de pago y no muestra preview visual. Este producto ya tiene el crawler: preview visual + cobertura de sitio completo en free tier es un hueco real del mercado. | LOW (el crawl ya existe) | El diferencial sale casi gratis. Explotarlo en el copy del panel: "X de Y páginas sin og:image". |
| **Detección de og:image por defecto compartida en todo el sitio** | Síntoma clásico: 400 páginas comparten la misma imagen genérica del tema. Ninguna herramienta single-URL puede verlo. | MEDIUM | Agrupar por URL de imagen. Se apoya en la agrupación por plantilla de v1.3 (TEMPLATE-01/02) para no gritar donde compartir imagen es legítimo. |
| **Imagen rota / muy pesada / mal dimensionada** | Es el fallo que el usuario *no puede ver* leyendo el HTML. Alto factor "wow". | HIGH | Requiere fetch de la imagen. |
| **Snippets de fix por CMS** (dónde poner el tag en Yoast/RankMath vs Shopify `theme.liquid` vs ajustes SEO de Webflow) | v1.5 ya construyó el motor de adaptadores; extenderlo a checks de meta/social es incremental y ninguna herramienta social hace esto. | MEDIUM | Reusar `resolveCmsRecommendation`. **No** construir un segundo motor. |
| **Response time + HTML size por página** | Métrica propia, no derivada de PSI, disponible en las 500 URLs (PSI solo cubre la muestra). Cubre el hueco "PSI no me dice nada de estas 480 páginas". | LOW-MEDIUM | Sin requests extra. Es tiempo de respuesta visto desde el worker, no TTFB de usuario real: etiquetarlo así evita una promesa falsa. |
| **Preview con imagen rota renderizada tal cual la vería el usuario** | Mostrar el placeholder gris real en vez de decir "error 404". | MEDIUM | Depende del fetch de imagen. |
| **Diff entre corridas para la categoría nueva** | Ya existe el motor de diff por fingerprint (v1.0). Sale gratis si los checks nuevos emiten `fingerprint` con el patrón existente (`pageFingerprint(CHECK_ID, url)`). | LOW | Requisito de no romper: usar el mismo helper. |

### Anti-Features (parecen buenas, generan problemas)

| Feature | Por qué se pide | Por qué es problemática | Alternativa |
|---|---|---|---|
| **Re-fetch en vivo del preview desde el reporte** | Es lo que hace opengraph.to y se siente inmediato. | Rompe el modelo del producto: el reporte es un snapshot de una auditoría con cuota (1/semana/email). Un botón de re-fetch es un crawler sin cuota disfrazado y abre abuso/SSRF por URL arbitraria. | El preview se renderiza desde el HTML ya persistido en `Page.html`. Para re-verificar, se corre una auditoría nueva. |
| **Integrar Facebook Sharing Debugger / X Card Validator vía API** | "Que lo valide la plataforma real". | El Card Validator de X fue retirado; la Graph API de Meta para scraping de URLs requiere app token y tiene rate limits agresivos. Dependencia frágil y con auth para un free tier. | Validar contra las especificaciones publicadas (dimensiones, ratio, peso, valores de `twitter:card`). Es lo que hacen todas las herramientas gratuitas. |
| **Fetch de og:image en las 500 páginas** | "Validar la imagen de todas". | 500 requests extra por auditoría, muchos a la misma imagen; infla el tiempo de crawl y el riesgo de rate-limit del sitio auditado. | Deduplicar por URL de imagen (en la práctica un sitio tiene 1–20 imágenes OG distintas), `HEAD` primero para `content-type`/`content-length`, y GET parcial (rango de bytes) solo para leer dimensiones de la cabecera del archivo. `image-size@2.0.2` lee dimensiones de un buffer; `probe-image-size@7.3.0` corta el stream apenas tiene el header. **No usar `sharp`**: binario nativo, complica el contenedor sin aportar nada acá. |
| **Screenshot real de la card renderizada por cada plataforma** | Máxima fidelidad. | Exige Playwright por página y por plataforma, y las plataformas no exponen un renderizador. Costo absurdo. | Reproducir las cards en CSS con los tokens del design system. Es lo que hace toda la competencia. |
| **Tratar todos los `twitter:*` como obligatorios** | "Faltan tags de Twitter". | X hereda de OG cuando los `twitter:*` no están. Marcarlos como error genera falsos positivos masivos en sitios bien configurados. | Solo `twitter:card` se evalúa por sí mismo (no tiene equivalente OG). El resto: warning **solo si** falta también el OG equivalente. |
| **Cargar las og:image de terceros directamente en el `<img>` del reporte** | Es lo obvio. | Hotlinking desde el dominio del reporte: filtra a terceros qué sitios se auditan, puede romper por protección de hotlink, y choca con la política estricta de CSP que el proyecto se autoimpuso (decisión v1.4, Phase 22). | Proxy de imagen server-side con allowlist del origen auditado, límite de tamaño y timeout; o miniatura ya validada durante el crawl. Decidir en la fase de UI. |
| **Sumar la categoría nueva al score general sin más** | Parece lo natural. | Cambia el peso de las 5 categorías existentes y hace incomparables las auditorías históricas; el diff entre corridas mostraría un salto de score sin que el sitio haya cambiado. | Decisión explícita de Juan: (a) re-balancear y aceptar el corte histórico, o (b) mostrar la categoría con score propio y peso 0 en el general durante v1.6. |

## Feature Dependencies

```
[Checks de meta/social]
    └──requiere──> [Retirar/migrar ONPAGE-05]        (evitar doble conteo)
    └──requiere──> [Categoría "social" en scoring]   (Category union + re-balanceo de WEIGHTS)

[Validación de og:image (dimensiones/peso/roto)]
    └──requiere──> [Fetcher de imágenes deduplicado] (HEAD + GET parcial, fuera del crawl principal)

[Panel de preview social]
    └──requiere──> [Meta tags extraídos y persistidos]  (o re-parseo de Page.html en report-model)
    └──requiere──> [Estrategia de carga de imagen]      (proxy vs miniatura vs placeholder)
    └──enriquecido por──> [Validación de og:image]      (mostrar la rota tal cual)

[Snippets HTML de fix]
    └──requiere──> [Checks con el valor medido]      (el snippet se prellena con datos reales)
    └──enriquecido por──> [cms-adapters v1.5]        (dónde pegar el snippet según el CMS)

[Response time + HTML size]
    └──requiere──> [Instrumentar crawl.ts + migración Prisma en Page]
    └──independiente de──> [todo lo demás de meta/social]   ← se puede hacer en paralelo

[og:image por defecto compartida en todo el sitio]
    └──requiere──> [Checks de meta a nivel de sitio]
    └──enriquecido por──> [TEMPLATE-01/02 v1.3]      (suprimir falsos positivos por plantilla)
```

### Notas de dependencia

- **ONPAGE-05 es el nudo.** Es la única pieza que obliga a tocar código validado de v1.0. Opciones: retirar el check y absorberlo en la categoría nueva (más limpio, cambia el score de On-Page de auditorías nuevas), o dejarlo y que la categoría nueva no evalúe presencia básica de OG (evita el cambio pero deja la categoría coja). Recomendación: **retirar y absorber**, en su propia fase, con test de guardarraíl que verifique cero issues duplicados por fingerprint.
- **Response time / HTML size no depende de nada de OG.** Candidato natural a primera fase (toca crawler + schema, riesgo aislado, valor inmediato), siguiendo el patrón de riesgo ascendente que ya funcionó en v1.2.
- **El fetcher de imágenes es la única infra nueva del milestone.** Aislarlo en una fase propia, igual que se hizo con render+Docker en v1.2 Phase 12.

## Criterios de severidad: error crítico vs advertencia

No existe estándar de industria. La convergencia observada entre herramientas es: **error = la card se rompe o se ve mal en al menos una plataforma mayor; warning = la card funciona pero pierde efectividad.** Traducido a criterios accionables:

### Error (crítico)

| Condición | Por qué es error |
|---|---|
| `og:image` ausente | La card colapsa a texto plano en Facebook/LinkedIn/WhatsApp. Fallo visible. |
| `og:image` devuelve 4xx/5xx o `content-type` no es imagen | Card rota. Peor que no tener el tag: el usuario cree que funciona. |
| `og:image` con URL relativa o `http://` en un sitio HTTPS | Los scrapers no resuelven relativos de forma fiable; mixed content bloquea la carga. |
| `og:image` menor a 200×200 px | Por debajo del mínimo que Facebook acepta: descarta la imagen por completo. |
| `og:image` sobre 5 MB | Sobre el límite de X (5 MB; Facebook aguanta hasta 8 MB). La card queda sin imagen en X. |
| `og:title` ausente | El scraper cae al `<title>`, que suele traer el sufijo de marca y sale truncado. |
| `og:url` ausente **o** apuntando a una URL distinta del canonical | Fragmenta contadores sociales y puede compartir la URL equivocada (con parámetros de tracking). |
| `twitter:card` con un valor inválido | X ignora la card entera; ni siquiera hace fallback. |
| Sin `<meta charset>` (o fuera del primer 1 KB) | Acentos y ñ rotos en la card y en el SERP. Impacto visible para un producto en español. |
| Múltiples `og:image` / `og:title` con valores distintos | Comportamiento no determinista: cada plataforma elige uno diferente. |

### Warning (advertencia)

| Condición | Por qué no es error |
|---|---|
| `og:description` ausente | La card se ve, sin el párrafo. Pérdida de CTR, no fallo. |
| `og:title` > 60 chars o `og:description` > 200 chars | Se trunca con puntos suspensivos. Feo, no roto. |
| `og:title` < 10 chars o `og:description` < 55 chars | Card pobre. |
| `og:image` entre 200×200 y 600×315 | Facebook la acepta pero la renderiza como miniatura cuadrada en vez de card grande. |
| Ratio de `og:image` lejos de 1.91:1 | Recorte impredecible por plataforma. |
| `og:image` entre 1 MB y 5 MB | Dentro de límites pero lento; WhatsApp rinde mejor por debajo de ~300 KB. |
| `og:type` ausente | Las plataformas asumen `website`, correcto para la mayoría de páginas. |
| `twitter:card` ausente | X hereda de OG. Se pierde `summary_large_image` (card chica en vez de grande). |
| `og:image:alt` / `twitter:image:alt` ausente | Accesibilidad. Ninguna plataforma lo exige. |
| Favicon ausente o roto | Afecta el preview de Google/Slack, no la card social. |
| `og:site_name`, `og:locale` ausentes | Cosmético. |
| Response time > 600 ms | Lento pero funcional. Sobre 1500 ms pasa a error. |
| HTML > 100 KB | Documento pesado. Sobre 300 KB pasa a error. |

**Regla anti-falso-positivo** (heredada del criterio de v1.2/v1.3): cualquier check de `twitter:*` distinto de `twitter:card` se evalúa **solo si** falta también el OG equivalente. Y las páginas con `noindex` o no-HTML no deben entrar en esta categoría.

## Cómo calcula el score la industria

Ninguna herramienta publica su fórmula. Lo verificable:

- **Suma ponderada de puntos por check, normalizada a porcentaje.** El único desglose público encontrado (Meta Tag Checker) asigna 2 puntos a title, 2 a meta description y 2 al conjunto completo de los 4 OG esenciales, y convierte el porcentaje a nota A–F (90+ = A, 75 = B, 55 = C, 35 = D). Confianza MEDIUM: es una herramienta menor, pero el patrón (puntos por check + porcentaje) se repite en SEO Site Checkup y SEOptimer.
- **opengraph.to y opengraph.io** muestran score 0–100 más lista de issues, sin exponer pesos.
- **Ahrefs** no da score por categoría social: solo cuenta issues clasificados en Error / Warning / Notice, que es exactamente la taxonomía de tres niveles que este proyecto ya usa.

**Recomendación:** no inventar una fórmula nueva. El motor health-ratio size-independent de v1.0 ya produce scores en el rango correcto (validado: 91 vs 86 de la referencia) y resuelve la independencia del tamaño del sitio, cosa que las herramientas single-URL ni necesitan. Sumar la categoría al motor existente y dejar que el peso relativo salga de la severidad, no de puntos ad-hoc. El indicador "N errores y M advertencias" de la referencia es un **conteo**, no el score: mostrar ambos, como hace la referencia.

## MVP Definition

### Launch With (v1.6)

- [ ] **Checks de meta/social por página** (og:title, og:description, og:image presencia+formato, og:url vs canonical, og:type, duplicados, twitter:card, charset) — es la categoría; sin esto no hay milestone.
- [ ] **Retiro/migración de ONPAGE-05** con guardarraíl anti-duplicados — sin esto el reporte muestra el mismo issue dos veces.
- [ ] **Categoría "social" en el scoring** + decisión explícita de pesos — objetivo declarado del milestone.
- [ ] **Response time + HTML size por página** con sus issues de umbral — métrica propia pedida explícitamente y la pieza de menor riesgo.
- [ ] **Panel de preview: Google + Facebook + X/Twitter + LinkedIn** — el diferencial visible; LinkedIn comparte el layout 1.91:1 con Facebook, así que son 3 layouts, no 4.
- [ ] **Snippets HTML de fix prellenados con los valores reales de la página** — pedido explícito.
- [ ] **Validación de og:image alcanzable + dimensiones + peso** (con dedupe por URL) — el check de mayor factor "wow" y el que separa esto de un parser de HTML.

### Add After Validation (v1.6.x / v1.7)

- [ ] **Previews de WhatsApp / Discord / Slack / Telegram** — cuando el layout base de card esté validado; es más CSS, cero lógica nueva.
- [ ] **Snippets de fix por CMS** vía `cms-adapters` — cuando los snippets genéricos estén validados por Juan.
- [ ] **Issue agregado de og:image por defecto en todo el sitio** — necesita datos de sitios reales para calibrar el umbral sin falsos positivos.
- [ ] **Favicon alcanzable** (más allá de presencia) — un request por origen; agregar junto al fetcher de imágenes si ya está construido.
- [ ] **`og:image:alt` / `twitter:image:alt`** — warning de bajo impacto.

### Future Consideration (v2+)

- [ ] **Generador de og:image** — cambia la naturaleza del producto: pasa de detectar a producir. Choca con "la herramienta detecta y recomienda" del Out of Scope.
- [ ] **Editor de preview interactivo** (cambiar el texto y ver la card actualizarse) — es un producto distinto (Meta Tags.io), no una auditoría.
- [ ] **Validación de `og:video` / `og:audio` / tags de artículo (`article:published_time`)** — cola larga, poco volumen.
- [ ] **Comparación de la card contra la de competidores** — exige crawlear dominios de terceros, fuera del modelo de cuota.

## Feature Prioritization Matrix

| Feature | Valor para el usuario | Costo de implementación | Prioridad |
|---|---|---|---|
| Checks core de meta/social (OG + twitter:card + charset) | HIGH | LOW | P1 |
| Retiro/migración de ONPAGE-05 | MEDIUM (evita un bug visible) | LOW | P1 |
| Categoría "social" en el scoring | HIGH | LOW-MEDIUM (decisión de producto) | P1 |
| Response time + HTML size | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Panel de preview (Google / FB+LinkedIn / X) | HIGH | MEDIUM | P1 |
| Snippets HTML de fix | HIGH | MEDIUM | P1 |
| og:image alcanzable / dimensiones / peso | HIGH | HIGH (infra nueva) | P1 |
| Detección de duplicados de tags OG | MEDIUM-HIGH | LOW | P1 |
| Previews WhatsApp / Discord / Slack / Telegram | MEDIUM | LOW | P2 |
| Snippets de fix por CMS | MEDIUM-HIGH | MEDIUM (motor ya existe) | P2 |
| og:image por defecto compartida en el sitio | MEDIUM | MEDIUM | P2 |
| Favicon alcanzable | LOW-MEDIUM | MEDIUM | P2 |
| Tags de alt de imagen | LOW | LOW | P3 |
| og:site_name / og:locale / theme-color | LOW | LOW | P3 |

## Competitor Feature Analysis

| Feature | opengraph.to / opengraph.io | Meta Tags.io | Ahrefs Site Audit | Screaming Frog | Nuestro enfoque |
|---|---|---|---|---|---|
| Alcance | 1 URL | 1 URL | Sitio completo | Sitio completo | **Sitio completo (500 URLs), gratis** |
| Score 0–100 | Sí, fórmula no publicada | No | No (solo conteo Error/Warning/Notice) | No (extracción cruda) | Motor health-ratio existente, coherente con las otras 5 categorías |
| Preview visual | Sí, 8 plataformas | Sí, editable | No | No | Sí, 3 layouts (Google, 1.91:1 FB/LinkedIn, X) en v1.6; más plataformas después |
| Validación de imagen (rota/peso/dimensión) | Sí, es su diferencial | Parcial | No | No (solo extrae la URL) | Sí, con dedupe por URL de imagen |
| Snippets de fix | Recomendaciones en texto | Genera el bloque completo | Explicación del issue | No | **Snippet prellenado con datos reales + ubicación según CMS** |
| Response time / peso de HTML | No | No | Sí (en otro reporte) | Sí (columnas de respuesta y tamaño) | Sí, integrado a la categoría con umbrales de severidad |
| Precio | Free / freemium | Free | Pago | Licencia de escritorio | Free con email verificado |

**Lectura estratégica:** el hueco defendible no es "otro checker de OG" — hay decenas y todos son single-URL. Es **preview visual + snippet de fix a escala de sitio completo**, que hoy exige combinar una herramienta gratuita single-URL con un crawler de pago. Ese es el argumento del panel en el reporte.

## Preguntas abiertas para el roadmap

1. **Pesos del score general.** ¿Re-balancear las 6 categorías (rompe comparabilidad histórica y el diff entre corridas) o mostrar "Meta Tags/Social" con score propio y peso 0 en el general durante v1.6? Decisión de Juan; bloquea la fase de scoring.
2. **Carga de imágenes de terceros en el reporte.** No hay CSP configurada en código hoy (`apps/web/next.config.ts` no define headers; la "CSP estricta" de las decisiones de v1.4 era criterio de diseño, no un header desplegado). Igual conviene decidir proxy vs miniatura persistida antes de la fase de UI, por hotlinking y privacidad.
3. **¿El fetcher de imágenes corre dentro del crawl o como paso posterior?** Recomendación: paso posterior en el worker, con su propio limitador de concurrencia, mismo patrón que la muestra de PSI/render de v1.2.
4. **Interpretación del response time.** Medido desde el worker, no es TTFB de usuario real. Definir el copy antes de exponerlo para no prometer un dato de campo.

## Sources

- [OpenGraph.to — checker, score y previews](https://www.opengraph.to/) — set de checks, score 0–100, plataformas de preview. MEDIUM-HIGH (producto de referencia del milestone; fórmula de score no publicada)
- [OpenGraph.io — OG Test / Link Preview Studio](https://www.opengraph.io/og-test) — validación de imagen (tamaño, dimensiones, HTTPS, alt). MEDIUM-HIGH
- [Ahrefs — Open Graph Meta Tags guide](https://ahrefs.com/blog/open-graph-meta-tags/) — tags requeridos (og:title/url/image/type) vs recomendados (og:description/og:locale), longitudes sugeridas, reporte Social tags. HIGH
- [OG Image Size Guide 2026 — Krumzi](https://www.krumzi.com/blog/open-graph-image-sizes-for-social-media-the-complete-2026-guide) y [OGImage.io](https://ogimage.io/resources/og-image-size) — 1200×630, ratio 1.91:1, mínimos, límites 5 MB (X) / 8 MB (Facebook), <300 KB para WhatsApp. MEDIUM-HIGH (varias fuentes independientes coinciden)
- [Meta Tag Checker — desglose de puntuación](https://meta-tag-checker.com/) — único desglose público de puntos por check y escala A–F. MEDIUM (herramienta menor; patrón corroborado por SEO Site Checkup y SEOptimer)
- [Scrawl OG & Twitter checker](https://scrawl.tools/tools/og-twitter-checker) y [PageChecks](https://pagechecks.com/tools/open-graph-checker/) — duplicados de og:image, URL absoluta obligatoria, causas de imagen no visible. MEDIUM
- Código del repo, leído directamente el 2026-07-31: `packages/checks/src/checks/onpage/openGraph.ts`, `packages/checks/src/checks/tech/viewport.ts`, `packages/scoring/src/overallScore.ts`, `packages/crawler/src/crawl.ts`, `packages/db/prisma/schema.prisma`, `apps/web/next.config.ts`. HIGH
- npm registry, consultado 2026-07-31: `image-size@2.0.2`, `probe-image-size@7.3.0`, `sharp@0.35.3`. HIGH

---
*Feature research for: auditoría de meta tags / Open Graph / preview social*
*Researched: 2026-07-31*
