# Requirements: Auditor Web (SEO/Técnico) — v1.5 Fingerprinting técnico + fixes personalizados por CMS

**Defined:** 2026-07-21
**Core Value:** Que cualquier persona ingrese una URL y reciba una auditoría completa, precisa y accionable de su web (con errores reales priorizados por severidad), a cambio de su email verificado.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Fingerprint de Stack Técnico

- [ ] **FPRINT-01**: El sistema captura headers HTTP relevantes y cookies (nombres, no valores) de cada página crawleada, sin requests adicionales
- [x] **FPRINT-02**: El sistema detecta el CMS principal del sitio (WordPress, Shopify, Webflow, Wix, Squarespace, o "no detectado") con un nivel de confianza (alto/medio/bajo)
- [ ] **FPRINT-03**: Si el CMS detectado es WordPress, el sistema detecta el builder de página en uso (Elementor, WPBakery, Divi, o Gutenberg/nativo por defecto)
- [ ] **FPRINT-04**: El sistema detecta CDN/proxy en uso (ej. Cloudflare, Fastly, Akamai) cuando hay señal suficiente
- [ ] **FPRINT-05**: El sistema detecta hosting/servidor de origen cuando hay señal suficiente (reconociendo que un CDN delante puede ocultar esta señal)
- [ ] **FPRINT-06**: El sistema detecta el framework JS en uso (ej. React, Next.js, Vue) cuando hay señal suficiente
- [x] **FPRINT-07**: El sistema detecta herramientas de analytics/tag manager en uso (ej. GA4, GTM, Meta Pixel)
- [x] **FPRINT-08**: Cuando la confianza de detección es baja o no hay señal, el sistema muestra "no detectado con certeza" en vez de forzar una respuesta incorrecta
- [ ] **FPRINT-09**: El resultado del fingerprint se persiste asociado a la auditoría (no requiere re-detección en cada vista del reporte)

### Reporte: Tabla de Stack Detectado

- [ ] **STACKUI-01**: El reporte muestra una tabla de "stack técnico detectado" al inicio, visible apenas termina el escaneo
- [ ] **STACKUI-02**: La tabla muestra cada categoría detectada (CMS+builder, CDN/proxy, hosting, framework JS, analytics) con su nivel de confianza cuando aplica
- [ ] **STACKUI-03**: La tabla es consistente con el design system existente (tokens, sin hex hardcodeado, ambos temas claro/oscuro)

### Motor de Recomendaciones por CMS

- [ ] **CMSFIX-01**: El sistema define un patrón adaptador por plataforma (WordPress, Shopify, Webflow, Wix/Squarespace combinado) con una interfaz común para resolver instrucciones de fix por check
- [ ] **CMSFIX-02**: El sistema tiene un fallback genérico obligatorio que se usa cuando no hay CMS detectado con confianza suficiente o no existe adaptador para la plataforma detectada
- [ ] **CMSFIX-03**: Los checks de alt text, title/meta, H1, Open Graph, canonical, JSON-LD/datos estructurados y sitemap/robots.txt muestran instrucciones de fix personalizadas según el CMS detectado (WordPress considerando el builder detectado)
- [ ] **CMSFIX-04**: Los checks no cubiertos por CMSFIX-03 (ej. hreflang, mixed content, enlaces rotos, profundidad de clics) mantienen la recomendación genérica actual sin cambios
- [ ] **CMSFIX-05**: La recomendación personalizada por CMS se resuelve al construir el modelo de reporte (report-model), no se persiste pre-calculada, de forma que quede disponible también en exports (PDF/Markdown/PPTX) sin trabajo adicional

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Fingerprint Extendido

- **FPRINT-10**: Detección de plugins SEO de WordPress (Yoast, Rank Math) para afinar aún más la instrucción de fix
- **FPRINT-11**: Adaptador Squarespace separado de Wix, si el volumen real de auditorías lo justifica
- **FPRINT-12**: Detección de builders adicionales de WordPress (Beaver Builder, Oxygen, Bricks)
- **FPRINT-13**: Historial de cambios de stack técnico entre corridas de auditoría del mismo sitio
- **FPRINT-14**: Confianza cuantitativa visible en UI (ej. "85% de certeza") en vez de alto/medio/bajo

### Fixes Extendidos

- **CMSFIX-06**: Fix personalizado por CMS extendido a checks restantes de on-page/técnico donde la personalización aporta menos (viewport, lang, longitud de contenido)
- **CMSFIX-07**: Fix personalizado por CMS para checks de AEO y render CSR/SSR

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Fingerprint exhaustivo estilo BuiltWith (cientos de categorías: pagos, chat, fuentes, ad networks) | Scope creep enorme, mantenimiento continuo de firmas sin aportar al objetivo real (personalizar fixes); no es el producto de Juan |
| Librería de fingerprinting empaquetada (ej. wappalyzer-core / dataset GPL de enthec/webappanalyzer) | Deprecada / sin mantenimiento / licencia GPL-3.0 incompatible con vendorizar en el repo — motor de firmas propio en su lugar |
| Servicios pagos de fingerprinting de terceros (Wappalyzer API, BuiltWith API) | Costo por request no encaja con auditoría gratis a escala de 500 URLs; requisito explícito de Juan de fingerprint propio |
| Cubrir el 100% de los checks existentes con fix personalizado por CMS en esta vuelta | ~125-150 piezas de copy a mantener; varios checks son técnicamente idénticos sin importar el CMS y no ganan nada con personalización |
| Auto-corrección de issues (aplicar el fix automáticamente en el sitio del usuario) | Fuera de alcance de todo el producto (PROJECT.md); requeriría credenciales/OAuth por plataforma y responsabilidad legal |
| Afirmar el CMS con 100% de certeza siempre | CDNs/WAFs alteran headers de origen; sitios headless rompen firmas clásicas; forzar una respuesta incorrecta daña la credibilidad del lead magnet |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FPRINT-01 | Phase 25 | Pending |
| FPRINT-02 | Phase 25 | Complete |
| FPRINT-03 | Phase 25 | Pending |
| FPRINT-04 | Phase 25 | Pending |
| FPRINT-05 | Phase 25 | Pending |
| FPRINT-06 | Phase 25 | Pending |
| FPRINT-07 | Phase 25 | Complete |
| FPRINT-08 | Phase 25 | Complete |
| FPRINT-09 | Phase 26 | Pending |
| STACKUI-01 | Phase 26 | Pending |
| STACKUI-02 | Phase 26 | Pending |
| STACKUI-03 | Phase 26 | Pending |
| CMSFIX-01 | Phase 27 | Pending |
| CMSFIX-02 | Phase 27 | Pending |
| CMSFIX-03 | Phase 27 | Pending |
| CMSFIX-04 | Phase 27 | Pending |
| CMSFIX-05 | Phase 27 | Pending |

**Coverage:**

- v1 requirements: 17 total
- Mapped to phases: 17/17 ✓
- Unmapped: 0

---
*Requirements defined: 2026-07-21*
*Last updated: 2026-07-21 after roadmap creation (v1.5) — 17/17 requirements mapped to Phases 25-27*
