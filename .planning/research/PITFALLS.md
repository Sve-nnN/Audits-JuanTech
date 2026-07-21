# Pitfalls Research

**Domain:** Tech-stack fingerprinting (CMS/builder/CDN/hosting/framework JS/analytics detection) + motor de recomendaciones de fix personalizadas por CMS, sumado a un crawler de auditoría SEO existente (Crawlee, 500 URLs, Cheerio-first + Playwright selectivo)
**Researched:** 2026-07-21
**Confidence:** MEDIUM (web search cruzado en múltiples fuentes independientes; sin fuente única "oficial" porque el dominio — fingerprinting heurístico — es inherentemente basado en consenso de la comunidad, no en un spec)

## Critical Pitfalls

### Pitfall 1: Tratar el fingerprint como un booleano en vez de una detección probabilística

**What goes wrong:**
El motor de fix personalizado (y la tabla de stack en el reporte) afirma "Esto es WordPress" o "Esto es Elementor" cuando en realidad el fingerprint coincidió con 2-3 señales débiles de 6 posibles. El usuario recibe una recomendación de fix "para WordPress" en un sitio que en realidad es un WordPress headless, o al revés, un sitio no-WP recibe instrucciones de WP porque alguna librería JS coincidencial (ej. un plugin de terceros que reusa nombres de clase `wp-*`) disparó una regla.

**Why it happens:**
Los devs migran de "detectar features" a "generar copy de recomendación" sin mantener el score de confianza en el camino. Es fácil escribir `if (isWordPress) { return wpFix(issue) }` porque simplifica el código, pero borra la incertidumbre real del fingerprint (que Wappalyzer mismo modela como score de confianza combinado, no como sí/no binario).

**How to avoid:**
- El fingerprinter interno debe devolver siempre `{ platform, builder, confidence: 0-100, signals: [...] }`, nunca solo un string.
- Definir umbrales explícitos (ej. ≥80 = "detectado", 40-79 = "probable", <40 = "no detectado, fallback genérico") y usar los tres estados en el motor de recomendaciones, no solo dos.
- El motor de fix debe aceptar el nivel de confianza como parámetro y ajustar tanto el copy ("Como parece que usas WordPress...") como el fallback (mostrar SIEMPRE también la versión genérica cuando confidence < umbral alto).

**Warning signs:**
- El tipo de dato que devuelve el detector es `string | null` en vez de un objeto con score.
- Los tests solo cubren "detecta WordPress" / "no detecta nada", sin casos "detecta con baja confianza".
- El copy de recomendación nunca usa condicionales de incertidumbre ("parece", "probablemente"), siempre afirma con seguridad.

**Phase to address:**
Fase de diseño del fingerprinter (la primera fase de esta milestone) — el contrato de datos (confidence incluido) debe fijarse antes de escribir el motor de recomendaciones, porque cambiarlo después implica retocar cada adapter.

---

### Pitfall 2: Confiar en headers de servidor como señal primaria sin fallback

**What goes wrong:**
El detector de CDN/hosting/servidor se basa principalmente en `Server`, `X-Powered-By`, `X-Generator`. Cuando el sitio está detrás de Cloudflare, Fastly o Akamai (mayoría de sitios de producción en 2026), estos headers llegan strippeados o reescritos por el proxy — el fingerprint reporta "servidor desconocido" en la mayoría de auditorías reales, no solo en casos raros.

**Why it happens:**
Es la señal más fácil de implementar (una línea: `headers['server']`), y funciona perfecto en local/staging sin CDN delante, dando falsa confianza durante desarrollo. El problema solo aparece al auditar sitios reales de clientes, que casi siempre están detrás de un CDN/WAF.

**How to avoid:**
- Diseñar el fingerprint de hosting/CDN como multi-señal desde el día uno: headers (`server`, `via`, `cf-ray`, `x-served-by`, `x-amz-cf-pop`), DNS/CNAME cuando sea viable, cookies (`__cfduid`, `_shopify_s`, `wordpress_logged_in_`), y paths de assets estáticos (`/wp-content/`, `cdn.shopify.com`, `assets-static.wixstatic.com`).
- Nunca reportar "no se detectó CDN" como ausencia de CDN — reportarlo como "no se pudo determinar" (ligado al pitfall 1: confianza explícita).
- CDN y CMS/hosting-de-origen son preguntas DISTINTAS: un sitio puede estar en Cloudflare (CDN) y WordPress en Kinsta (hosting) al mismo tiempo — no colapsar ambas señales en un solo campo "stack".

**Warning signs:**
- El fingerprint funciona en pruebas locales (contra sitios sin CDN) pero devuelve "unknown" en la mayoría de auditorías de sitios reales/clientes.
- El código solo lee un header (`Server`) para determinar hosting.

**Phase to address:**
Fase de fingerprinting — incluir explícitamente un fixture de prueba con sitio detrás de Cloudflare (el propio juan-tech.com si usa Cloudflare, o un sitio WP conocido en Kinsta/WP Engine) para validar que el detector no depende solo de headers de origen.

---

### Pitfall 3: Firmas de builder de WordPress rotas por el patrón "Gutenberg no deja huella propietaria"

**What goes wrong:**
El sub-detector de builder para WordPress (Elementor, WPBakery, Divi, etc.) asume que SIEMPRE hay una firma positiva que buscar. Pero Gutenberg (el editor nativo, mayoría de sitios WP modernos) no inyecta clases propietarias — genera HTML limpio con comment delimiters (`<!-- wp:paragraph -->`) que pueden no sobrevivir en el HTML renderizado final servido al navegador. Resultado: sitios con Gutenberg nativo se detectan como "sin builder" en vez de "Gutenberg", y el fix recomendado no distingue bien dónde vive la edición (bloques nativos del editor vs. un builder de terceros).

**Why it happens:**
Los devs escriben reglas positivas para cada builder conocido (`elementor-*`, `et_pb_*`, `vc_row`) y dejan Gutenberg como "default/else" implícito, sin una firma positiva real de Gutenberg (bloques con clases `wp-block-*` sí sobreviven en el HTML final y son una firma válida, pero se olvida agregarla).

**How to avoid:**
- Tratar Gutenberg como un detector positivo más, no como default: buscar clases `wp-block-*`, contenedores `wp-block-group`/`wp-block-columns` en el HTML servido.
- El fallback real de "sin builder identificado" debe ser un cuarto estado distinto de "Gutenberg detectado" y de "builder de terceros detectado" — cada uno mapea a un fix distinto (dónde vive el fix: editor de bloques nativo vs. plugin de terceros vs. tema custom sin builder).
- Documentar explícitamente en el adapter de WordPress: Elementor/Divi/WPBakery rompen visualmente el contenido si se desactiva el plugin (contenido en postmeta propietario/shortcodes) — esto es relevante para el copy del fix ("no desactives el plugin sin antes...").

**Warning signs:**
- El adapter de WordPress tiene reglas para Elementor/Divi/WPBakery pero ninguna regla positiva para Gutenberg.
- El fix recomendado para "alt text faltante" en WP no distingue entre "edítalo en el bloque de imagen de Gutenberg" vs. "edítalo en el widget de imagen de Elementor" — dando instrucciones que no matchean la UI real del cliente.

**Phase to address:**
Fase del adapter de WordPress + builder — incluir Gutenberg como caso explícito en la matriz de builders, no como ausencia de señal.

---

### Pitfall 4: Meta generator como única señal de versión/CMS, sin considerar que se remueve intencionalmente

**What goes wrong:**
El fingerprint usa `<meta name="generator">` como señal fuerte (o única) para CMS y versión. Sitios WordPress con hardening de seguridad activo (plugins como "Remove Meta Generators", muy comunes en agencias/consultores que saben de seguridad — el público objetivo de este auditor) remueven ese tag deliberadamente. El resultado es que los sitios MÁS cuidados con su seguridad (justo los que probablemente ya trabajan con alguien como Juan) son los que MENOS se detectan bien, generando una paradoja incómoda para un lead magnet.

**Why it happens:**
El meta generator es la señal más simple y "gratis" de implementar (un `$('meta[name=generator]').attr('content')`), así que suele ser la primera y a veces única señal para versión.

**How to avoid:**
- Nunca depender solo del meta generator para el CMS en sí (usarlo como señal de alta confianza SI está presente, pero el CMS debe poder determinarse igual sin él vía paths de wp-content/wp-includes, cookies, patrones de REST API `/wp-json/`).
- Reservar el meta generator para intentar version fingerprinting cuando esté disponible (nice-to-have), no para la detección de plataforma en sí (must-have).

**Warning signs:**
- Al desactivar/remover el meta generator del fixture de prueba, el fingerprint pasa de "WordPress, alta confianza" a "no detectado" en vez de mantenerse en "WordPress, confianza media/alta" vía otras señales.

**Phase to address:**
Fase de fingerprinting de CMS — test explícito con fixture sin meta generator (simulando hardening de seguridad) debe seguir detectando WordPress.

---

### Pitfall 5: Arquitecturas headless/desacopladas (WordPress headless, Shopify Hydrogen) rompen las firmas clásicas y el detector falla en silencio

**What goes wrong:**
WordPress headless con WPGraphQL sirve HTML mínimo/vacío en el dominio principal (el contenido real se renderiza en un frontend Next.js/Astro separado, a veces en otro dominio). Shopify Hydrogen igual: no hay `cdn.shopify.com` en los assets ni las cookies clásicas `_shopify_s` porque el storefront es una app React custom sobre Oxygen. El crawler termina auditando el frontend desacoplado (que es indistinguible de "sitio Next.js custom") y el CMS real queda invisible — el fingerprint reporta "framework JS: Next.js" y nada más, cuando en realidad hay un WordPress o Shopify detrás gestionando el contenido.

**Why it happens:**
Las firmas clásicas de WP/Shopify se escriben pensando en el patrón monolítico (WP sirve el HTML final, Shopify Liquid sirve el HTML final). Nadie prueba contra el patrón headless/JAMstack porque es una minoría de casos, pero es una minoría creciente y son justo los clientes técnicamente más sofisticados (leads de mayor valor).

**How to avoid:**
- Para este caso, la salida honesta NO es "detectar WordPress a través del desacople" (con Cheerio-first eso es prácticamente imposible sin llamar a endpoints GraphQL/REST específicos) — es reconocer el patrón "headless/JAMstack" como una categoría de detección propia: framework JS detectado con alta confianza (Next.js/Astro/Remix) + ausencia de señales de CMS tradicional = reportar "Frontend desacoplado (JAMstack) — CMS de contenido no identificado desde el HTML público" en vez de fallar silenciosamente a "sin CMS detectado" (que suena a "sitio hecho a mano", una conclusión distinta y potencialmente incorrecta).
- Intentar una señal secundaria de bajo costo cuando el framework JS es fuerte: sondear `/wp-json/` (WPGraphQL suele coexistir con REST API habilitado) con una sola request HEAD/GET barata — si responde con la firma JSON de WP REST, se recupera la detección sin necesidad de Playwright.
- Documentar explícitamente en el adapter genérico que "framework JS detectado pero CMS no identificado" es un resultado válido y esperado (no un bug), y el motor de recomendaciones debe caer al fallback genérico en ese caso, no fallar o mostrar un CMS incorrecto por defecto.

**Warning signs:**
- El detector nunca produce el estado "headless/JAMstack, CMS no identificado" en ningún fixture de prueba — señal de que ese caso no se contempló.
- Auditar un sitio headless conocido (ej. cualquier sitio Shopify Hydrogen público) produce un fingerprint vacío o, peor, un falso positivo de otro CMS.

**Phase to address:**
Fase de fingerprinting — agregar fixtures de WordPress headless y Shopify Hydrogen a la suite de pruebas desde el inicio, no como edge case descubierto en producción.

---

### Pitfall 6: El motor de recomendaciones asume "un adapter = una plataforma = un lugar donde vive el fix", ignorando que el builder cambia la ubicación real del fix dentro de la misma plataforma

**What goes wrong:**
El adapter de WordPress genera el mismo texto de fix para "falta alt text" sin importar si el sitio usa Gutenberg, Elementor, Divi o WPBakery — todos dicen algo genérico tipo "edita la imagen en el editor de WordPress y agrega el texto alternativo", que es técnicamente cierto pero inútil como instrucción accionable, porque la UI real donde el usuario hace clic es distinta en cada caso (panel de bloque de Gutenberg vs. panel de configuración de Elementor vs. módulo de Divi).

**Why it happens:**
Es más rápido escribir un fix por plataforma (4 adapters: WP, Shopify, Webflow, Wix/Squarespace) que un fix por (plataforma × builder) — la combinatoria explota rápido y no está claro cuánto detalle vale la pena en la primera vuelta.

**How to avoid:**
- Diseñar el adapter de WordPress con dos niveles desde el modelo de datos: `platform: 'wordpress'` + `builder: 'elementor' | 'divi' | 'wpbakery' | 'gutenberg' | 'unknown'`, y que el catálogo de fixes tenga un override opcional por builder (no obligatorio) — si no hay override específico, cae al fix genérico de WordPress (que a su vez cae al fix genérico universal si no hay adapter).
- Priorizar overrides específicos de builder SOLO para los checks de mayor volumen/impacto (alt text, meta title/description, headings) en la primera vuelta, dejando el resto en el fix genérico de plataforma — esto es consistente con el alcance ya definido en el PROJECT.md ("la mayor cantidad de checks posible en esta primera vuelta", no todos).
- Esto es exactamente el patrón adapter con "niveles de fallback" (plataforma → builder específico → genérico universal), evitando el pitfall de plugin-architecture donde el core termina lleno de if-else: la resolución del override debe vivir en una función central de "lookup con fallback en cadena", no repetida en cada checker.

**Warning signs:**
- El catálogo de fixes tiene un mapa `platform -> fixText` sin campo de builder en absoluto.
- QA manual: pedir el fix de "alt text faltante" en un sitio Elementor real y en un sitio Gutenberg real debería producir instrucciones visiblemente distintas; si son idénticas, el nivel de builder no se está usando.

**Phase to address:**
Fase del motor de recomendaciones — el modelo de datos del catálogo de fixes (plataforma + builder + fallback en cadena) debe diseñarse antes de escribir el primer fix real, para no tener que migrar el esquema a mitad de catálogo.

---

## Technical Debt Patterns

Atajos que parecen razonables pero generan problemas a largo plazo.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Copiar/adaptar el set de firmas público de Wappalyzer (enthec/webappanalyzer) en vez de escribir firmas propias desde cero | Ahorra semanas de investigación de patrones (CSS classes, headers, cookies por plataforma) | Firmas de terceros cambian de formato/licencia y requieren revisión periódica; heredas también sus falsos positivos conocidos si no filtras | Aceptable para el MVP de esta milestone SIEMPRE que se documente la fuente y se filtre/adapte solo el subconjunto relevante (CMS/builder/CDN/analytics), no importar el dataset completo (cientos de tecnologías irrelevantes al auditor) |
| Detectar CMS con una sola señal fuerte (ej. solo meta generator, o solo un header) y no combinar señales con scoring | Rápido de implementar, código simple | Falsos negativos sistemáticos ante hardening de seguridad o CDN (pitfalls 2 y 4); usuarios notan que el "stack detectado" está mal en sitios reales y pierden confianza en todo el reporte | Nunca aceptable ni para MVP — el costo de combinar 3-4 señales con scoring es bajo comparado con el daño reputacional de un fingerprint visiblemente incorrecto en un lead magnet |
| Mapear el fix recomendado solo por plataforma, ignorando builder (ver Pitfall 6) | Cubre 4 adapters simples más rápido | Instrucciones inútiles/genéricas para el ~60%+ de sitios WP que usan un builder (Elementor es el más usado del mercado); el "valor agregado" prometido del fix personalizado se diluye | Aceptable en la primera vuelta SOLO si el override por builder se agrega para los 3-5 checks de mayor volumen (alt text, title, meta description, H1) y se deja documentado como deuda explícita para el resto |
| No re-chequear el fingerprint si el sitio migra de plataforma entre auditorías (usar el fingerprint cacheado de la corrida anterior) | Evita recalcular fingerprint en cada corrida, más rápido | El feature de "comparación entre corridas" (ya validado en v1) mostraría un diff de stack incorrecto/desactualizado si el sitio cambió de CMS entre auditorías | Nunca aceptable — el fingerprint debe recalcularse en cada auditoría completa, es barato (Cheerio-first, sin Playwright) comparado con el resto del crawl |

## Integration Gotchas

Errores comunes al conectar con señales/servicios externos para fingerprinting.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Headers HTTP de origen (`Server`, `X-Powered-By`) | Asumir que reflejan el servidor/stack real | Tratarlos como señal de baja confianza por sí solos; combinarlos con paths de assets, cookies y patrones de HTML. Nunca reportar ausencia de header como "no usa X" — reportar como señal no disponible |
| CDN/WAF (Cloudflare, Fastly, Akamai) | Detectar solo un CDN cuando hay CDN chaining (ej. Cloudflare al frente + CloudFront/Fastly detrás para origin shielding) | Reportar el CDN "externo" (el que ve el crawler, vía DNS/CNAME si es viable o headers como `cf-ray`) como el dato principal, y aclarar en el copy que puede haber capas adicionales no visibles desde fuera |
| Meta generator / firmas de versión | Usarlo como única fuente de verdad de plataforma y versión | Usarlo solo como bonus de alta confianza cuando está presente; el CMS en sí debe determinarse por señales estructurales (paths, cookies, patrones de API) que sobreviven a su remoción |
| WordPress REST API (`/wp-json/`) como señal de refuerzo | No sondearla nunca, perdiendo la oportunidad de recuperar detección en sitios headless/hardened | Una request HEAD/GET barata a `/wp-json/` (dentro del presupuesto de Cheerio-first, sin Playwright) puede confirmar WordPress incluso cuando el HTML servido no lo delata |
| Wappalyzer / bases de firmas de terceros | Importar el dataset completo sin filtrar y sin plan de actualización, dejándolo desactualizarse silenciosamente | Importar solo el subconjunto relevante al alcance de este auditor (CMS, builders, CDN, hosting, framework JS, analytics) y versionarlo como código propio revisable, no como dependencia externa sin control de cambios |
| Analytics/Tag Manager (GTM, GA4, etc.) | Detectar solo el contenedor de GTM y asumir que revela qué analytics real corre dentro (GTM enmascara las tags reales que dispara) | Reportar "Google Tag Manager detectado" como su propia categoría, distinta de "Google Analytics detectado directamente" — no colapsar ambas en una sola conclusión, porque GTM puede no tener GA4 configurado o tener otras herramientas |

## Performance Traps

Patrones que funcionan a pequeña escala pero fallan al crecer.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Correr el fingerprinting completo (todas las señales) en cada una de las 500 URLs del crawl | El crawl completo se vuelve notablemente más lento por URL, sin beneficio — el stack no cambia página a página en el 99% de los casos | Fingerprintear solo una vez por auditoría, usando la home o las primeras N páginas representativas (reusar el mismo patrón de sampling que ya usa Lighthouse/PSI en v1); persistir el resultado a nivel de `Audit`, no de `Page` | A partir de auditorías con >50-100 URLs, el costo extra ya es perceptible en tiempo total de crawl |
| Sondear `/wp-json/` u otros endpoints de refuerzo en cada página en vez de una sola vez | Requests HTTP adicionales innecesarias que compiten con el presupuesto de 500 URLs del crawl y pueden disparar rate-limiting/WAF del sitio auditado | Ejecutar las señales de refuerzo (una request extra tipo `/wp-json/`) una sola vez a nivel de auditoría, no por página, y con manejo de error silencioso (si falla, simplemente no suma esa señal) | Se nota primero como falsos "bloqueos"/429 en sitios con WAF agresivo cuando el crawler además del crawl normal dispara requests de sondeo por cada URL |

## Security Mistakes

Errores de seguridad específicos del dominio, más allá de lo genérico de seguridad web.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Reportar en el reporte público/exportable la versión exacta de WordPress/plugins detectada (si se llega a implementar version fingerprinting) | El reporte de auditoría (PDF/Markdown exportable, ya existe en v1.2) podría filtrar información de vulnerabilidad explotable del sitio del cliente si cae en manos equivocadas (el propio dueño lo comparte, o queda en un enlace no protegido) | Mantener el fingerprint de versión (si se agrega en el futuro) como dato interno de contexto para el motor de fix, no como dato expuesto verbatim en el reporte exportable; si se muestra, evitar precisión de versión exacta de plugins vulnerables conocidos |
| Sondear activamente endpoints no documentados del sitio auditado (más allá de `/wp-json/`) para "confirmar" fingerprint | Empieza a parecerse a un scan de vulnerabilidades activo sin consentimiento explícito del dueño del dominio de destino — riesgo legal/ético distinto de un crawl SEO normal | Limitar las señales de refuerzo a endpoints públicos estándar y no invasivos (rutas conocidas de assets, robots.txt, sitemap, endpoints REST documentados de la plataforma), nunca fuzzing de rutas ni intentos de login |

## UX Pitfalls

Errores comunes de experiencia de usuario en este dominio.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Mostrar el stack detectado con el mismo peso visual/certeza sin importar el nivel de confianza (ver Pitfall 1) | El usuario confía ciegamente en una detección de baja confianza, y si resulta incorrecta, pierde confianza en TODO el reporte (incluidos los checks SEO que sí son 100% verificables) | Usar un indicador visual de confianza (badge "detectado" vs. "probable" vs. "no identificado") en la tabla de stack, consistente con los badges de severidad que ya existen en el design system del proyecto |
| Usar lenguaje que suena a fallo del sistema ("no se pudo detectar", "error") cuando el resultado es simplemente "no identificado" | Sensación de que la herramienta está rota o es de baja calidad, cuando en realidad "no identificado" es un resultado legítimo (ej. sitio headless, o CMS custom real) | Reformular como información útil ("Frontend desacoplado detectado — no se identificó un CMS tradicional desde el HTML público"), nunca como error del sistema |
| Recomendaciones de fix genéricas que mencionan "tu plataforma" sin nombrarla cuando el fallback genérico está activo, sonando como que sí se detectó algo | Confunde al usuario sobre si su plataforma fue reconocida o no | El fallback genérico debe ser explícito sobre que es genérico ("No identificamos tu CMS con certeza; esta recomendación aplica en general a cualquier plataforma") en vez de fingir personalización |
| Mostrar builder de WordPress con la misma confianza que el CMS en sí, cuando en la práctica el builder es una señal más débil y más propensa a error | El usuario recibe instrucciones específicas de Elementor cuando en realidad tiene Divi, generando fricción y desconfianza | Aplicar el mismo sistema de confianza en dos niveles independientes: confianza de plataforma (WordPress: alta) puede ser alta mientras confianza de builder (Elementor: media) es menor — comunicarlas por separado |

## "Looks Done But Isn't" Checklist

Cosas que parecen completas pero les falta una pieza crítica.

- [ ] **Fingerprint de CMS:** Suele faltar el manejo del estado "headless/JAMstack, CMS no identificado" — verificar con un fixture real de WordPress headless o similar (Pitfall 5)
- [ ] **Fingerprint de builder WordPress:** Suele faltar una regla positiva para Gutenberg (queda como "default/else" implícito) — verificar que un sitio Gutenberg puro se detecte como "Gutenberg", no como "sin builder" (Pitfall 3)
- [ ] **Motor de recomendaciones:** Suele faltar el nivel de override por builder dentro de la plataforma WordPress — verificar que el fix de alt text difiera visiblemente entre un fixture Elementor y uno Gutenberg (Pitfall 6)
- [ ] **Comunicación de incertidumbre:** Suele faltar el estado visual "confianza media/baja" en la tabla de stack — verificar que existan al menos 3 estados visuales distintos (alta/media/no identificado), no solo detectado/no-detectado (Pitfall 1)
- [ ] **CDN detection:** Suele faltar el manejo de "CDN externo detectado, hosting de origen desconocido" como resultado válido y distinto de "sin CDN" — verificar contra un fixture detrás de Cloudflare (Pitfall 2)
- [ ] **Persistencia del fingerprint:** Suele faltar recalcular el fingerprint en auditorías subsecuentes del mismo sitio (queda cacheado de la primera corrida) — verificar que el campo se recompute en cada `Audit`, no se copie del anterior
- [ ] **Exportación del reporte:** Suele faltar decidir si el stack detectado y su nivel de confianza viajan también a PDF/Markdown/PPTX (ya existentes en v1.2) — verificar que `buildReportModel` (single source of truth ya establecida) incluya el fingerprint con su confidence, no solo la UI web

## Recovery Strategies

Cuando los pitfalls ocurren pese a la prevención, cómo recuperarse.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Fingerprint sin campo de confianza ya implementado y usado en varios lugares | MEDIUM | Agregar el campo `confidence` como opcional con default alto (backward-compatible), migrar el motor de recomendaciones para leerlo, y solo después bajar la confianza real donde corresponda; evitar un big-bang rewrite |
| Catálogo de fixes mapeado solo por plataforma (sin builder) ya con decenas de entradas escritas | MEDIUM | No reescribir todo el catálogo: agregar el campo `builder` opcional al lookup con fallback en cadena (plataforma+builder → plataforma → genérico) y overridear solo los checks de mayor volumen primero (alt text, title, meta description) |
| Se detectó un falso positivo de plataforma reportado por un usuario/cliente real ya en producción | LOW | Es exactamente el ciclo de vida esperado de un sistema de firmas (igual que Wappalyzer): documentar el caso como fixture de regresión, ajustar/afinar la firma que causó el falso positivo, no intentar prevenir todos los casos posibles de antemano |
| El adapter genérico (fallback) resultó ser el más usado en producción por errores de detección de plataformas específicas | LOW | Señal útil, no un fallo: revisar qué señales fallan más seguido y priorizar reforzarlas; el fallback genérico bien escrito sigue dando valor real al usuario mientras tanto |

## Pitfall-to-Phase Mapping

Cómo las fases del roadmap deberían atender estos pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Fingerprint tratado como booleano sin confianza (Pitfall 1) | Fase de diseño del fingerprinter (contrato de datos) | El tipo de retorno del detector incluye `confidence` desde el primer commit; tests cubren un caso de confianza media explícitamente |
| Headers de servidor como única señal, CDN enmascarando origen (Pitfall 2) | Fase de fingerprinting de CDN/hosting | Fixture de prueba con sitio real detrás de Cloudflare/Fastly produce un resultado útil (CDN detectado, hosting de origen marcado como no determinado), no un fallo silencioso |
| Gutenberg sin regla positiva (Pitfall 3) | Fase del adapter WordPress + builder | Fixture de sitio WP con Gutenberg puro se detecta explícitamente como "Gutenberg", verificado en test |
| Meta generator como única señal de CMS (Pitfall 4) | Fase de fingerprinting de CMS | Fixture sin meta generator (hardening simulado) sigue detectando WordPress vía otras señales |
| Arquitecturas headless rompen firmas clásicas (Pitfall 5) | Fase de fingerprinting de CMS | Fixtures de WordPress headless/WPGraphQL y Shopify Hydrogen incluidos en la suite desde el inicio; producen el estado "headless/JAMstack, CMS no identificado" en vez de falso positivo/negativo silencioso |
| Fix mapeado solo por plataforma, ignorando builder (Pitfall 6) | Fase del motor de recomendaciones | El fix de alt text (o el primer check implementado) difiere visiblemente entre fixture Elementor y fixture Gutenberg en QA manual |
| Comunicación de incertidumbre al usuario | Fase de UI de la tabla de stack en el reporte | Diseño incluye al menos 3 estados visuales de confianza, revisado contra el design system tokenizado existente (Badge de severidad ya establecido en v1.1) |

## Sources

- [Wappalyzer: How to hide technologies from Wappalyzer](https://www.wappalyzer.com/articles/how-to-hide-technologies-from-wappalyzer/) — MEDIUM confidence
- [Wappalyzer GitHub issue #852: false-positive app detection](https://github.com/wappalyzer/wappalyzer/issues/852) — MEDIUM confidence
- [enthec/webappanalyzer — mantenimiento comunitario de firmas Wappalyzer](https://github.com/enthec/webappanalyzer) — MEDIUM confidence
- [YesWeHack — HTTP fingerprinting: reconning for web apps' hidden flaws](https://www.yeswehack.com/learn-bug-bounty/recon-series-http-fingerprinting) — MEDIUM confidence
- [Cloudflare Community — Cloudflare proxy stripping response CORS headers](https://community.cloudflare.com/t/cloudflare-proxy-stripping-response-cors-headers/173809) — MEDIUM confidence (discusión comunitaria, cruzada con comportamiento documentado de CDNs)
- [Medium — TIL Cloudflare fingerprints your TLS handshake, not just your headers](https://medium.com/@michaeloblak/til-cloudflare-fingerprints-your-tls-handshake-not-just-your-headers-and-how-to-impersonate-113829b18889) — MEDIUM confidence
- [WordPress.com — What Is Headless WordPress](https://wordpress.com/blog/2025/03/20/headless-wordpress/) — MEDIUM confidence
- [WPGraphQL extensions directory](https://www.wpgraphql.com/extensions) — MEDIUM confidence
- ["Remove Meta Generators" plugin, WordPress.org](https://wordpress.org/plugins/remove-meta-generators/) y ["Meta Generator and Version Info Remover"](https://wordpress.org/plugins/meta-generator-and-version-info-remover/) — MEDIUM confidence
- [SERT Media — How To Remove WordPress Generator Meta Tag & Does It Matter?](https://sertmedia.com/remove-wordpress-generator-meta-tag/) — MEDIUM confidence
- [Stackcrawler — WordPress Website Builder Detector](https://stackcrawler.com/wordpress-website-builder-detector) — MEDIUM confidence (firmas de Elementor/Divi/WPBakery/Gutenberg)
- [WPBakery — How to edit a WordPress website without coding: comparación de builders](https://wpbakery.com/blog/how-to-edit-wordpress-website-without-coding/) — MEDIUM confidence
- [Screaming Frog Review 2026](https://thestacc.com/reviews/screaming-frog/) y [SEO Tool Insider — Screaming Frog Review 2026](https://www.seotoolinsider.com/screaming-frog-review) — MEDIUM confidence (limitaciones generales del tool de referencia del dominio)
- [AI UX Playground — Confidence Score pattern](https://aiuxplayground.com/pattern/confidence-score/) — MEDIUM confidence
- [Medium — UX Patterns for AI Confidence Scores and Risk Alerts](https://medium.com/@vamsiparasar1992/ux-patterns-for-ai-confidence-scores-and-risk-alerts-e8624e34cfd9) — MEDIUM confidence
- [CoCreate Field Notes — Probabilistic UX Design: Designing for AI Uncertainty and Confidence](https://cocreate.consulting/field-notes/probabilistic-ux-design-patterns) — MEDIUM confidence
- [Stack Interface — 7 Adapter Design Pattern Secrets Every Developer Must Know](https://stackinterface.com/adapter-design-pattern/) — MEDIUM confidence
- [Medium — Plug-in Architecture and the story of the data pipeline](https://medium.com/omarelgabrys-blog/plug-in-architecture-dec207291800) — MEDIUM confidence
- [DetectZeStack — How to Detect What CMS a Website Uses](https://detectzestack.com/blog/detect-what-cms-website-uses) — MEDIUM confidence (cookies/CNAME por plataforma: Shopify, WordPress, Squarespace)
- [DetectZeStack — CDN Checker: Find Any Website's CDN & Hosting](https://detectzestack.com/blog/detect-cdn-hosting-provider) — MEDIUM confidence (CDN chaining, multi-señal DNS/headers/TLS)
- [WebReveal — How to Detect if a Website Uses a CDN](https://webreveal.io/blog/how-to-detect-website-cdn.html) — MEDIUM confidence

---
*Pitfalls research for: Tech-stack fingerprinting + CMS-personalized fix recommendations (v1.5)*
*Researched: 2026-07-21*
