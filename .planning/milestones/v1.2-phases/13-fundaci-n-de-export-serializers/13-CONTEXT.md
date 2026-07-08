# Phase 13: Fundación de export + serializers - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

El reporte se genera on-demand en tres formatos (PDF con branding, Markdown-para-LLM, PPTX) desde una route Node de Next.js, leyendo datos ya persistidos con librerías JS puras — sin Chromium en el bundle web. Incluye extraer un `buildReportModel` compartido (single source of truth) y un paquete `@auditor/export` puro. No entra: el botón de export en la UI (Phase 14), formatos extra DOCX/CSV (v2, EXPORT-06), exports async/en cola (out of scope), branding configurable por usuario (out of scope).

</domain>

<decisions>
## Implementation Decisions

### buildReportModel (modelo compartido)
- Nuevo paquete puro **`@auditor/report-model`** (sin React): toma datos ya persistidos (`Audit.scores`, `Issue` rows, `Page` rows) y devuelve un `ReportModel` serializable (score general + status, scores por categoría, issues, páginas). Consumido por `apps/web/app/audits/[id]/page.tsx` (refactor) y por `@auditor/export`.
- Refactorizar `page.tsx` para consumir `buildReportModel` como single source of truth, SIN cambiar el render visual actual (mismas secciones, mismos datos en pantalla). La lógica de ensamblado que hoy vive inline en el server component se mueve al paquete.
- El `ReportModel` refleja TODOS los issues persistidos, incluyendo los nuevos de Phase 11 (canonical profundo `TECH-04:*`, headings `ONPAGE-08:*`) y Phase 12 (render CSR/SSR `RENDER-01:*`, category `aeo`).
- PII: el `ReportModel` NUNCA incluye email ni verification token; solo datos de la auditoría (URL auditada, score, categorías, issues, páginas).

### Paquete @auditor/export + serializers
- Libs (cero Chromium, per CLAUDE.md out-of-scope "PDF vía Chromium en Vercel"): PDF con `@react-pdf/renderer`, PPTX con `pptxgenjs`, Markdown-LLM con un builder de strings puro (sin dependencia pesada).
- Markdown-LLM estructurado (EXPORT-02): por issue → página/selector → valor medido → criterio → recomendación, listo para que un LLM entienda y aplique los fixes.
- PPTX (EXPORT-03): 7–12 slides — portada + score general, score por categoría, e issues priorizados por severidad.
- Cap top-N (EXPORT-05): **top 50 issues** ordenados por severidad + cantidad, con nota explícita "mostrando N de M" cuando M > N. N tuneable (constante exportada). Aplica a los tres formatos.

### Route + branding + frontera
- Route: `GET /api/audits/[id]/export?format=pdf|md|pptx`, runtime **Node** (no edge; `export const runtime = "nodejs"`), responde el archivo con `Content-Disposition: attachment` y el `Content-Type` correcto por formato.
- Branding PDF (EXPORT-01): respetar los roles tipográficos validados de v1.1 (preferencia de Juan, memoria `array-no-titulos`): **headings en Khand**, **body en Geist Sans** (Array NO va en títulos; queda reservada a usos display puntuales). Embeber Khand + Geist Sans como TTF/OTF (formato que `@react-pdf/renderer` soporta; ambas son Google Fonts con cobertura Latin completa). Acentos y ñ correctos (áéíóúñ¿¡) — validar tanto en body como en el texto de HEADINGS renderizado con Khand (p.ej. "Scores por categoría").
- Frontera Chromium: aserción/test de que `@auditor/export` (y por transitividad la route) no arrastra Playwright/Chromium al bundle web — equivalente a `pnpm why playwright` vacío en el paquete web. Reusar/extender el guardarraíl de Phase 12 (`scripts/assert-no-playwright-in-web.mjs`).
- Acceso a la route: misma visibilidad que el reporte (accesible por `auditId`, sin auth extra en free tier — el reporte ya es accesible así en `page.tsx`). Sin exponer PII (email/token) en la respuesta ni en los archivos.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/audits/[id]/page.tsx` — hoy ensambla el reporte inline: consulta prisma, lee `Audit.scores` (shape `AuditScores`: overall, status, byCategory, diff), agrupa issues y páginas. Esta lógica se extrae a `buildReportModel`. NO cambiar el JSX de render.
- `@auditor/scoring` → tipos `Category`, `ScoreStatus`, `CategoryScoreResult`; `CATEGORY_ORDER = ["tech","perf","onpage","schema","aeo"]`; `STATUS_BADGE_VARIANT`. Reusar tipos en `ReportModel`.
- `@auditor/db` → `prisma`, modelos `Audit`, `Issue`, `Page`. La route y buildReportModel leen de aquí (datos ya persistidos, sin recomputar checks).
- `apps/web/app/fonts/Array-Regular.woff2` — fuente de marca (headings). Necesita versión TTF/OTF para `@react-pdf`.
- `scripts/assert-no-playwright-in-web.mjs` (Phase 12) — patrón de aserción de frontera de bundle; extender para cubrir @auditor/export.

### Established Patterns
- API routes en `apps/web/app/api/**/route.ts` (ya existen `request-verification`, `verify`, `audits`, `audits/[id]`, `audits/[id]/pages`). La nueva route sigue el mismo patrón con `runtime = "nodejs"`.
- Issues persistidos llevan: checkId, category, title, severity (critical|warning|ok), measuredValue, source, criterion, recommendation, fingerprint, pageId, diffStatus.
- Categorías de scoring fijas: tech|onpage|schema|perf|aeo (render vive bajo aeo).

### Integration Points
- `apps/web/app/audits/[id]/page.tsx` — pasa a consumir `buildReportModel(auditId)`.
- `apps/web/app/api/audits/[id]/export/route.ts` — nueva route Node que llama buildReportModel + el serializer del formato pedido.
- `apps/web/package.json` — añade `@auditor/report-model`, `@auditor/export`; el bundle web NO debe incluir Chromium.
- Fuentes: la fuente TTF de marca se empaqueta con `@auditor/export` (o apps/web) para el PDF.

</code_context>

<specifics>
## Specific Ideas

- EXPORT-05 es guardarraíl doble: (1) cap top-N con nota "mostrando N de M" en los tres formatos, y (2) cero PII — añadir un test que verifique que ninguna salida (PDF texto, MD, PPTX) contiene email/token. La aserción de "cero Chromium en web" es la tercera compuerta crítica (reusa el script de Phase 12).
- Validar acentos/ñ: incluir un issue de fixture con "áéíóúñ¿¡" y verificar que el PDF (extracción de texto) y el MD/PPTX lo preservan.

</specifics>

<deferred>
## Deferred Ideas

- Botón "Exportar" en la UI del reporte (Phase 14, EXPORT-04).
- Formatos extra DOCX/CSV (v2, EXPORT-06).
- Exports async/en cola (out of scope — la decisión es on-demand en route Node).
- Branding configurable por usuario (out of scope — branding fijo juan-tech).

</deferred>
