# Requirements: Auditor Web (SEO/Técnico) — Milestone v1.2

**Defined:** 2026-07-06
**Core Value:** Cualquier persona ingresa una URL y recibe una auditoría completa, precisa y accionable de su web (errores reales priorizados por severidad), a cambio de su email verificado.

Milestone v1.2 = **Detección de renderizado + exportación de reportes** (aditivo sobre v1.0/v1.1, sin romper el pipeline validado). REQ-IDs con prefijos nuevos; numeración de fases continúa desde la 11.

## v1.2 Requirements

### Canonicals (profundo) — extiende TECH-04

- [ ] **CANON-01**: El auditor detecta canonical que apunta a una URL no indexable (noindex) y lo reporta como crítico.
- [ ] **CANON-02**: El auditor detecta canonical que apunta a una redirección (3xx) o a un 4xx/5xx, y cadenas de canonical (canonical→canonical).
- [ ] **CANON-03**: El auditor detecta canonical cross-domain y mismatch entre el canonical y la URL final resuelta de la página.
- [ ] **CANON-04**: El auditor detecta múltiples canonicals conflictivos en una página, canonical relativo (no absoluto) y el conflicto canonical + noindex.

### Encabezados / Jerarquía (errores) — extiende ONPAGE-03

- [ ] **HEAD-01**: El auditor detecta saltos de nivel en la jerarquía de encabezados (ej. H1 → H3 sin H2).
- [ ] **HEAD-02**: El auditor detecta encabezados vacíos (H1–H6 sin texto).
- [ ] **HEAD-03**: El auditor detecta encabezados fuera de orden y H1 que solo duplica el title.

### Detección de renderizado (CSR vs SSR)

- [ ] **RENDER-01**: El auditor determina, sobre una muestra representativa, si cada página se renderiza server-side o client-side (compara HTML crudo vs DOM renderizado con Playwright) y lo reporta como issue.
- [ ] **RENDER-02**: Cuando contenido clave (título, H1, texto principal) falta en el HTML crudo y solo aparece tras render, el auditor lo marca como riesgo SEO/AEO con severidad acorde (no lo trata como falla dura del score).
- [ ] **RENDER-03**: La detección degrada limpiamente: si el render falla, se bloquea o hay timeout, reporta "no determinado" sin tumbar la auditoría.

### Exportación de reportes

- [ ] **EXPORT-01**: El usuario puede exportar el reporte como PDF con branding.
- [ ] **EXPORT-02**: El usuario puede exportar el reporte como Markdown optimizado para que un LLM lo entienda y aplique los fixes (estructurado: por issue → página/selector → valor medido → criterio → recomendación).
- [ ] **EXPORT-03**: El usuario puede exportar el reporte como PPTX (presentación de 7–12 slides).
- [ ] **EXPORT-04**: El reporte muestra un botón "Exportar" arriba a la derecha con un selector de tipo (PDF / Markdown / PPTX), accesible por teclado y con estado de carga durante la generación.
- [ ] **EXPORT-05**: Los exports acotan el volumen (top-N issues) con una nota explícita de "mostrando N de M", y renderizan correctamente acentos y ñ (español neutro), sin incluir PII (email/token).

### UX del reporte (agrupación y datos faltantes)

- [ ] **REPORT-01**: En "Issues prioritarios", los issues se agrupan por tipo en dropdowns (ej. "Imágenes sin alt text" agrupa todas las páginas afectadas), ordenados por severidad y cantidad, para que la tabla no se vea saturada.
- [ ] **REPORT-02**: En "Detalle por categoría", dentro de problemas y correctos los issues se agrupan por tipo en dropdowns y se ordenan de forma consistente.
- [ ] **REPORT-03**: Los issues de Rendimiento/CWV muestran la URL de la página analizada (hoy aparece "—"); corrige el dato faltante en la capa que genera los issues perf.
- [ ] **REPORT-04**: En la lista de páginas rastreadas + grafo de entidades, cada página muestra el estado de su JSON-LD (correcto / advertencia / error) en la misma lista.

## v2 Requirements (deferidos)

### Renderizado / Exports

- **RENDER-04**: Agrupación por plantilla del veredicto CSR/SSR en la UI del reporte (badges por template).
- **RENDER-05**: Re-crawl basado en render para descubrir enlaces internos solo-JS.
- **EXPORT-06**: Formatos adicionales de export (DOCX, CSV).
- **REPORT-05**: Columna persistida `Page.renderVerdict` para badge CSR/SSR por página en la lista de páginas.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Renderizar las 500 URLs con Playwright | 5–10× costo/tiempo; solo se renderiza una muestra representativa (reusa `selectSample`). |
| PDF vía Chromium/HTML→PDF en Vercel | Chromium no debe entrar al bundle de la función web; se usan libs JS puras (@react-pdf/renderer, pptxgenjs). |
| Marcar CSR como falla dura del score | CSR es informativo/riesgo, no un cero automático; evita penalizar SSR con hidratación parcial. |
| Exports async / en cola | Contradice la decisión "on-demand en route Node"; los exports son lecturas rápidas de datos ya persistidos. |
| Editor WYSIWYG del reporte / branding configurable por usuario | Fuera del alcance de un lead magnet; el branding es fijo (marca juan-tech). |
| Cobro / planes de pago / auditorías-URLs ilimitadas | Diferido a v2 (monetización). |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CANON-01 | Phase 11 | Pending |
| CANON-02 | Phase 11 | Pending |
| CANON-03 | Phase 11 | Pending |
| CANON-04 | Phase 11 | Pending |
| HEAD-01 | Phase 11 | Pending |
| HEAD-02 | Phase 11 | Pending |
| HEAD-03 | Phase 11 | Pending |
| REPORT-03 | Phase 11 | Pending |
| RENDER-01 | Phase 12 | Pending |
| RENDER-02 | Phase 12 | Pending |
| RENDER-03 | Phase 12 | Pending |
| EXPORT-01 | Phase 13 | Pending |
| EXPORT-02 | Phase 13 | Pending |
| EXPORT-03 | Phase 13 | Pending |
| EXPORT-05 | Phase 13 | Pending |
| EXPORT-04 | Phase 14 | Pending |
| REPORT-01 | Phase 15 | Pending |
| REPORT-02 | Phase 15 | Pending |
| REPORT-04 | Phase 15 | Pending |

**Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 19 ✅
- Unmapped: 0

**Por fase:**
- Phase 11 (checks profundos + fix CWV): CANON-01..04, HEAD-01..03, REPORT-03 (8)
- Phase 12 (render CSR/SSR): RENDER-01..03 (3)
- Phase 13 (fundación export): EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-05 (4)
- Phase 14 (botón Exportar): EXPORT-04 (1)
- Phase 15 (UX reporte): REPORT-01, REPORT-02, REPORT-04 (3)

---
*Requirements defined: 2026-07-06*
*Last updated: 2026-07-07 — roadmap v1.2 creado, 19/19 requisitos mapeados a fases 11-15*
</content>
