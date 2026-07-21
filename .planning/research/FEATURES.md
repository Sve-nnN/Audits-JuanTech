# Feature Research

**Domain:** SEO/technical web auditor — v1.5 milestone: fingerprint de stack técnico + recomendaciones de fix personalizadas por CMS
**Researched:** 2026-07-21
**Confidence:** MEDIUM (patrones de ecosistema bien establecidos vía búsqueda web cruzada; sin acceso directo a UI interna de herramientas comerciales pagas)

## Feature Landscape

### Table Stakes (Users Expect These)

En herramientas de "technology profiling" dedicadas (Wappalyzer, BuiltWith, SE Ranking CMS Detector) mostrar el stack detectado ES la tabla stakes — es todo el producto. Pero en herramientas de **site audit SEO** (Screaming Frog, Ahrefs Site Audit, SEMrush Site Audit) la detección de CMS/stack NO aparece como feature central del reporte de auditoría — vive como utilidad separada o no aparece en absoluto. Para el auditor de Juan, que se posiciona como "Screaming Frog pero más completo", el listón de tabla stakes es más bajo de lo que parece: no hace falta igualar a BuiltWith (112,000+ tecnologías, 673M sitios, histórico desde 1985), sólo cubrir las categorías que la auditoría de referencia y el usuario no técnico necesitan para entender "en qué está construido mi sitio".

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Detección de CMS principal (WordPress, Shopify, Webflow, Wix, Squarespace, "otro/desconocido") | Sin esto no hay forma de personalizar nada; es el prerequisito de todo lo demás en el milestone. Señal más confiable de todas (meta generator tag, paths de assets `/wp-content/`, `cdn.shopify.com`, cookies de plataforma) | LOW-MEDIUM | Ya se tiene el HTML crudo + headers HTTP de cada página vía el pase Cheerio existente (`packages/crawler`); es reutilizar datos ya crawleados, no una llamada nueva |
| Tabla de "stack detectado" visible apenas termina el escaneo | Es exactamente el patrón de Wappalyzer/BuiltWith: mostrar resultado categorizado (CMS, hosting, CDN, analytics, framework) de forma tabular, no como texto libre | LOW | Requiere sólo un componente de tabla nuevo en el reporte + persistir el resultado del fingerprint en `Audit` o tabla nueva |
| Fallback "no se pudo detectar con certeza" | Todo fingerprinting por heurísticas (headers pueden ser eliminados/enmascarados por CDN/WAF, WordPress puede ocultar el meta generator por hardening) tiene falsos negativos; un reporte que afirma con seguridad un CMS incorrecto daña la credibilidad del lead magnet más que no mostrar nada | LOW | Diseño de UI + lógica: nivel de confianza (alto/medio/bajo) o directamente omitir la fila si no hay señal suficiente, en vez de forzar una respuesta |

### Differentiators (Competitive Advantage)

Aquí está el verdadero valor del milestone. Ni Screaming Frog ni Ahrefs ni SEMrush combinan auditoría técnica completa + fingerprint de stack + recomendaciones de fix **reescritas para el admin específico del CMS detectado**. Wappalyzer/BuiltWith se detienen en "esto es lo que usa el sitio" — no dan el paso siguiente de "y así lo arreglás en tu panel". Ese paso siguiente es exactamente lo que un dueño de sitio no técnico necesita para actuar solo, y es lo que hace que el lead magnet demuestre expertise real de agencia (uno "sabe cómo se arregla en cada plataforma", no sólo "sabe qué está roto").

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Detección de builder de WordPress (Elementor, WPBakery, Divi) | WordPress es una porción muy grande de la web; sin saber el builder, la recomendación de fix para "falta alt text" o "agregar JSON-LD" es genérica de WP y pierde precisión (el flujo en Elementor no es el mismo que en Gutenberg puro) | MEDIUM | Señales confiables por prefijo de clase: Divi → `et_pb_*`; WPBakery → `vc_row`/`vc_column`/`wpb_wrapper` + meta generator + `/js_composer/`; Elementor deja marcadores propios en comentarios/assets. Reutiliza el mismo HTML ya crawleado |
| Motor de recomendaciones adaptador-por-plataforma (WordPress / Shopify / Webflow / Wix-Squarespace + fallback genérico) | Convierte cada issue genérico ("falta alt text en 12 imágenes") en instrucciones accionables paso a paso en el admin real que el usuario va a abrir. Este es el diferenciador central del milestone y del producto frente a cualquier competidor mencionado | HIGH | Patrón adaptador (una clase/módulo por plataforma implementando la misma interfaz `getFixInstructions(checkId, context)`) con fallback genérico obligatorio cuando no hay adaptador o no hay CMS detectado con confianza suficiente. Este patrón ya está decidido en PROJECT.md — validado por la práctica de la industria de mantener guías SEO separadas por plataforma (Shopify, Webflow, Wix, Squarespace tienen documentación de ayuda completamente distinta para el mismo problema, confirmando que un fallback único no sirve) |
| Detección de CDN/proxy y hosting/servidor | Explica por qué ciertos headers pueden faltar o estar "sanitizados" (Cloudflare/WAFs comunes remueven o normalizan headers de origen), y es información de contexto técnico que un consultor SEO da naturalmente en una auditoría manual | MEDIUM | Señal principal: header `Server`/`CF-Ray`/`X-Powered-By`. Ojo: cuando hay CDN/proxy delante, el header de origen real puede no llegar nunca — esto limita la precisión de "hosting" específicamente (ver PITFALLS.md) |
| Detección de analytics/tag manager | Bajo esfuerzo (grep de scripts conocidos: gtag.js, GTM container, Meta Pixel, Hotjar, etc.) y da una señal más de "expertise completo" sin trabajo adicional de fix-copy (no es un issue a corregir, es sólo información) | LOW | Puramente informativo, no alimenta el motor de recomendaciones — no gasta presupuesto de las 4 plataformas |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Fingerprint exhaustivo estilo BuiltWith (cientos de categorías: pagos, email marketing, chat widgets, fuentes, ad networks) | "Si BuiltWith lo hace, deberíamos mostrarlo todo" | Scope creep enorme: mantener un catálogo de cientos de firmas regex es trabajo continuo (rot de firmas cuando las plataformas cambian su HTML/JS) sin aportar valor al objetivo real del milestone (personalizar fixes). BuiltWith es un producto entero dedicado a esto — no es competencia real para un lead magnet de auditoría SEO | Limitar a las 5 categorías que PROJECT.md ya define: CMS(+builder), CDN/proxy, hosting/servidor, framework JS, analytics/tag manager. Nada más en esta vuelta |
| Cubrir "todos los checks posibles" con fix personalizado por CMS en la primera vuelta | Se siente incompleto si un issue no tiene fix personalizado | El catálogo actual de checks ronda ~25-30 tipos distintos (on-page: title/meta/H1/alt/OG/lang; técnico: robots/sitemap/canonical/redirects/404/viewport/duplicados/huérfanas/hreflang/mixed-content/enlaces-rotos/canonicals-profundos/headings/click-depth; datos estructurados: presencia/validez JSON-LD/schema-content-mismatch). Escribir 4 variantes de plataforma + 1 fallback por cada uno son ~125-150 piezas de copy a mantener, y varios de esos checks (hreflang, cadenas de canonical, mixed content, profundidad de clics) son técnicamente iguales sin importar el CMS — no ganan nada con personalización y sólo inflan el trabajo | Priorizar personalización donde el CMS realmente cambia el "cómo": alt text, title/meta tags, H1, canonical, JSON-LD/datos estructurados, sitemap/robots.txt. Para checks CMS-agnósticos (hreflang, cadenas de canonical, mixed content, enlaces rotos, profundidad de clics), un solo texto genérico técnico es suficiente y correcto — no forzar personalización donde no aporta |
| Detectar el CMS con 100% de certeza siempre | Se asume que "si el sitio es X, el crawler debería saberlo siempre" | CDNs/WAFs (Cloudflare, etc.) frecuentemente alteran o eliminan headers de origen; sitios "headless" (WordPress headless + WPGraphQL, Shopify Hydrogen) rompen las firmas clásicas basadas en paths/generator-tag porque el HTML servido ya no tiene los patrones esperados; hardening de seguridad en WordPress a veces remueve el meta generator a propósito | Diseñar el fingerprint con niveles de confianza explícitos (alta/media/baja) y mostrar "no detectado con certeza" en vez de forzar una respuesta — ver PITFALLS.md para el detalle |
| Auto-corrección de los issues detectados (aplicar el fix automáticamente en el sitio del usuario) | Sería "el siguiente paso lógico" después de detectar y explicar el fix | Explícitamente fuera de alcance de todo el producto (PROJECT.md: "la herramienta detecta y recomienda, no modifica sitios ajenos"). Requeriría credenciales/OAuth por plataforma, superficie de ataque y responsabilidad legal enormes | Mantener el output como instrucciones accionables paso a paso; el "hacer por vos" queda como pitch de venta de la agencia, no como feature del producto |

## Ejemplos concretos: mismo fix explicado por plataforma

Para calibrar el nivel de detalle esperado en el motor de recomendaciones (formato accionable para un usuario no técnico):

**"Falta alt text en imágenes":**
- **WordPress:** Ir a Medios (Media Library) o directamente al editor de la página/entrada, hacer clic en la imagen, y en el panel derecho de bloque completar el campo "Texto alternativo". Si usa Elementor: seleccionar el widget de imagen, panel de Contenido, campo "Alt". Si usa WPBakery/Divi: el campo alt vive dentro de las opciones del módulo de imagen específico del builder.
- **Shopify:** Admin → Productos (o Contenido → Archivos) → seleccionar la imagen → en el editor del tema o en la ficha de medios completar el campo "Alt text" → Guardar.
- **Webflow:** Seleccionar el elemento de imagen en el Designer → panel Settings (ícono de engranaje) → campo "Alt Text". Para sitios con CMS de Webflow, vincular el campo alt a un campo de la colección para que se complete automáticamente en todos los ítems.
- **Wix:** Media Manager → seleccionar la imagen → Settings → campo "Alt Text".
- **Squarespace:** Editar el bloque de imagen → Edit → completar el campo "Filename"/"Alt Text" en las opciones de la imagen.
- **Fallback genérico:** "Agregá una descripción breve y descriptiva de la imagen en el atributo `alt` del HTML, o en el campo equivalente que ofrezca tu editor de contenido."

**"Falta canonical / canonical incorrecto":**
- **WordPress:** Con Yoast SEO o Rank Math instalado, el campo canonical está en la pestaña de SEO de cada entrada/página (sección "Avanzado"). Sin plugin SEO, requiere edición de tema/código — recomendar instalar uno de los dos plugins.
- **Shopify:** Shopify genera canonicals automáticamente en la mayoría de los casos; issues de canonical suelen deberse a paginación de colecciones o URLs duplicadas — la corrección típica requiere ajuste en `theme.liquid` o una app de SEO, tarea que probablemente necesite a un desarrollador o soporte de tema.
- **Webflow:** No hay campo nativo de canonical editable en todos los planes — requiere agregar código personalizado en la configuración de la página (Custom Code) o el elemento Embed.
- **Wix:** Editor → Páginas y Menú → ícono de más acciones en la página → SEO Basics → campo de URL canónica personalizable.
- **Squarespace:** Control de canonical limitado y dependiente de la plantilla; generalmente requiere inyección de código en la sección de código de la página.
- **Fallback genérico:** "Agregá una etiqueta `<link rel=\"canonical\" href=\"...\">` en el `<head>` de la página apuntando a la versión preferida de la URL, o usá la función de SEO/canonical de tu plataforma si la tiene."

**"Falta JSON-LD / datos estructurados":**
- **WordPress:** Yoast SEO y Rank Math generan JSON-LD básico automáticamente (Organization, Article, breadcrumbs); para tipos adicionales (FAQPage, Product, Review) se necesita el schema del plugin SEO activado, un plugin de schema dedicado, o bloques específicos del builder (Elementor Pro incluye widgets de schema).
- **Shopify:** Temas modernos como Dawn ya incluyen schema de Product/Organization/BreadcrumbList por defecto; para tipos adicionales o personalización se recomienda una app de la App Store (ej. JSON-LD for SEO, Schema Plus).
- **Webflow:** Sin soporte nativo de schema — se debe generar el JSON-LD y pegarlo manualmente en la configuración de la página (Custom Code, sección head) o en un elemento Embed dentro del contenido.
- **Wix:** Wix genera automáticamente algo de schema básico por tipo de página, pero es incompleto y no editable; para schema adicional o personalizado hace falta el editor de código personalizado de Wix en el `<head>` del sitio.
- **Squarespace:** Incluye schema básico limitado; para schema personalizado se agrega JSON-LD directamente vía inyección de código de la página o bloques de código en entradas de blog.
- **Fallback genérico:** "Agregá un bloque `<script type=\"application/ld+json\">` con el schema correspondiente en el `<head>` de la página, o usá la función de datos estructurados de tu plataforma si la ofrece."

## Feature Dependencies

```
Crawler existente (HTML crudo + headers HTTP por página, Cheerio)
    └──requires (ya existe)──> Fingerprint de stack técnico
                                    └──requires──> Tabla "stack detectado" en el reporte
                                    └──requires──> Motor de recomendaciones por CMS
                                                        └──requires──> Catálogo de checks existentes (on-page, técnico, datos estructurados)
                                                        └──requires──> Adaptadores por plataforma (WordPress/Shopify/Webflow/Wix-Squarespace)
                                                        └──requires──> Fallback genérico (obligatorio, no opcional)

Detección de builder WordPress ──enhances──> Motor de recomendaciones (WordPress)
    (afina el "cómo" dentro del adaptador WordPress, no es prerequisito duro)

Nivel de confianza del fingerprint ──gates──> Qué adaptador se usa
    (confianza baja o CMS no reconocido → fuerza fallback genérico, nunca adivinar)
```

### Dependency Notes

- **Fingerprint de stack requiere el crawler existente:** no hace falta ninguna llamada de red nueva ni fase de crawl adicional — el HTML crudo y los headers HTTP de cada página ya se capturan en el pase Cheerio de v1.0. El fingerprint es una función pura sobre datos ya persistidos (o casi: puede requerir agregar el guardado de headers HTTP si aún no se persisten todos los necesarios).
- **Motor de recomendaciones requiere el catálogo de checks existente:** cada adaptador de plataforma necesita mapear `checkId → instrucciones específicas`; esto ata el trabajo de este milestone a la lista de checks ya implementados en `packages/checks`, no a checks nuevos.
- **Nivel de confianza gatea el adaptador usado:** si el fingerprint no está seguro del CMS (o el CMS no tiene adaptador, ej. Squarespace agrupado con Wix en la primera vuelta), el motor debe caer siempre al fallback genérico — nunca mostrar instrucciones de una plataforma incorrecta. Esta es la salvaguarda de credibilidad más importante del milestone.
- **Detección de builder WordPress mejora pero no bloquea:** si no se logra detectar el builder específico, el adaptador WordPress genérico (asumiendo Gutenberg/editor por defecto) sigue siendo válido y útil.

## MVP Definition

### Launch With (v1 del milestone)

Mínimo para validar el concepto sin escalar el trabajo de copy indefinidamente.

- [ ] Fingerprint de CMS principal (WordPress, Shopify, Webflow, Wix, Squarespace, "no detectado") con nivel de confianza — esencial: sin esto no hay personalización posible
- [ ] Fingerprint de CDN/proxy, hosting/servidor, framework JS, analytics/tag manager — esencial: es el alcance ya acordado en PROJECT.md, informativo y de bajo costo relativo
- [ ] Tabla de stack detectado al inicio del reporte — esencial: es el output visible que valida el trabajo de fingerprint ante el usuario
- [ ] Detección de builder WordPress (Elementor, WPBakery, Divi) — esencial dentro de WordPress porque es el CMS más común y el que más varía en "cómo se edita"
- [ ] Motor de recomendaciones con patrón adaptador (WordPress, Shopify, Webflow, Wix/Squarespace) + fallback genérico — esencial: es el corazón del milestone
- [ ] Fix personalizado para los checks donde el CMS realmente cambia el "cómo": alt text, title/meta, H1, OG tags, canonical, JSON-LD/datos estructurados, sitemap/robots.txt — esencial: son los checks de mayor volumen de issues y mayor valor percibido por un dueño de sitio no técnico

### Add After Validation (v1.x)

- [ ] Fix personalizado extendido a checks restantes de on-page/técnico donde la personalización aporta menos pero sigue siendo posible (viewport, lang, longitud de contenido) — trigger: si Juan ve que el fallback genérico se siente insuficiente en la práctica
- [ ] Adaptador Squarespace separado de Wix (si en la primera vuelta se agruparon) — trigger: volumen real de auditorías de sitios Squarespace lo justifica
- [ ] Más builders de WordPress (Beaver Builder, Oxygen, Bricks) — trigger: aparecen en auditorías reales y el fallback WordPress genérico no alcanza
- [ ] Detección de plugins SEO de WordPress (Yoast, Rank Math) para afinar aún más la instrucción (ej. "ya tenés Yoast, el campo está en la pestaña Yoast SEO del editor") — trigger: alto valor percibido, bajo riesgo, pero es trabajo adicional no comprometido en este milestone

### Future Consideration (v2+)

- [ ] Historial de cambios de stack técnico entre corridas (ej. "el sitio migró de Wix a WordPress") — defer: requiere diseño de diffing adicional sobre el fingerprint, no es parte del valor central de v1.5
- [ ] Confianza cuantitativa visible en UI (ej. "85% de certeza") en vez de alto/medio/bajo — defer: nice-to-have de presentación, no cambia la funcionalidad
- [ ] Cobertura de checks AEO y render CSR/SSR con fix personalizado por CMS — defer: son categorías más técnicas donde la personalización por CMS aporta menos (la solución de renderizado depende más del hosting/tema que del panel de admin)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Fingerprint CMS principal + tabla de stack | HIGH | MEDIUM | P1 |
| Detección CDN/proxy/hosting/framework/analytics | MEDIUM | LOW | P1 |
| Detección builder WordPress | MEDIUM | MEDIUM | P1 |
| Motor de recomendaciones (patrón adaptador + fallback) | HIGH | HIGH | P1 |
| Fix personalizado on-page/canonical/JSON-LD/sitemap | HIGH | HIGH | P1 |
| Fix personalizado checks CMS-agnósticos (hreflang, mixed content, etc.) | LOW | LOW (ya es genérico, no requiere trabajo extra) | P2 |
| Adaptador Squarespace separado | LOW-MEDIUM | MEDIUM | P2 |
| Detección de plugins SEO WordPress (Yoast/Rank Math) | MEDIUM | MEDIUM | P3 |
| Historial de cambios de stack entre corridas | LOW | MEDIUM | P3 |
| Confianza cuantitativa en UI | LOW | LOW | P3 |

**Priority key:**
- P1: Must have para este milestone
- P2: Should have, agregar cuando el P1 esté validado
- P3: Nice to have, futuro

## Competitor Feature Analysis

| Feature | Wappalyzer / BuiltWith | Screaming Frog / Ahrefs / SEMrush | Nuestro enfoque |
|---------|--------------------------|--------------------------------------|------------------|
| Mostrar stack técnico detectado | Es el producto entero: cientos de categorías, extensión de navegador + reporte web dedicado | No lo muestran como feature central del reporte de auditoría (viven herramientas separadas tipo "CMS Detector" de SE Ranking) | Tabla acotada a 5 categorías (CMS+builder, CDN/hosting, framework, analytics) dentro del mismo reporte de auditoría, no como producto aparte |
| Fix accionable ligado al stack detectado | No — se detienen en "esto usa el sitio", cero guía de "cómo arreglarlo" | No — dan el issue genérico (ej. "falta alt text en 12 imágenes") sin adaptar la instrucción a la plataforma | Sí — es el diferenciador central: cada issue relevante trae instrucciones paso a paso en el admin real de la plataforma detectada, con fallback genérico cuando no hay match |
| Confianza/certeza de la detección | Generalmente presentan el resultado como hecho, sin exponer incertidumbre al usuario final | N/A (no aplica, no detectan CMS) | Mostramos nivel de confianza y usamos fallback genérico ante duda — prioriza credibilidad del lead magnet sobre "siempre dar una respuesta" |
| Alcance de categorías fingerprinteadas | Exhaustivo (cientos: pagos, chat, fonts, ads, email marketing) | N/A | Acotado a lo que PROJECT.md define — evita mantenimiento de firmas fuera de alcance del producto |

## Sources

- [Wappalyzer articles — find out what CMS or framework a site is using](https://www.wappalyzer.com/articles/find-out-what-cms-or-framework-a-website-is-using/) — MEDIUM confidence (vendor-authored, técnicamente consistente con implementaciones open source conocidas)
- [Wappalyzer — how to hide technologies from Wappalyzer](https://www.wappalyzer.com/articles/how-to-hide-technologies-from-wappalyzer/) — MEDIUM confidence
- BuiltWith technology profiler overview (Martech Zone, Demand Gen Report) — MEDIUM confidence (marketing de terceros, cifras de escala no verificadas de forma independiente)
- Screaming Frog / Ahrefs / SEMrush comparativas (Luniq, Jelly Academy, Search Atlas, bseoa) — LOW confidence (artículos comparativos de terceros, ninguno confirma explícitamente ausencia de feature de CMS-detection en la UI real; inferencia razonable, no verificación directa)
- WordPress `body_class()` — WordPress Developer Resources (documentación oficial) — HIGH confidence
- Detección de page builders WordPress por clase HTML (Stackcrawler, themesniffer, cmsjunkie) — MEDIUM confidence (múltiples fuentes independientes coinciden en los mismos prefijos de clase)
- Webflow Help Center — Include alt text on images — HIGH confidence (documentación oficial de la plataforma)
- Shopify Help Center — Adding alt text to media / theme images — HIGH confidence (documentación oficial)
- Squarespace Help Center — Adding alt text to images — HIGH confidence (documentación oficial)
- Wix Support — Customizing your SEO settings / SEO panel — HIGH confidence (documentación oficial)
- Fudge.ai / Dharma Software / jsonschemaapp.com — guías de JSON-LD por plataforma (Shopify, Webflow, Wix, Squarespace) — MEDIUM confidence (contenido de terceros especializado en el tema, consistente entre sí sobre las limitaciones nativas de cada plataforma)

---
*Feature research for: SEO/technical web auditor — fingerprinting + CMS-personalized fixes*
*Researched: 2026-07-21*
