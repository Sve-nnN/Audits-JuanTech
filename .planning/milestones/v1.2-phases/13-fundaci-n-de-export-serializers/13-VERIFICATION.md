---
phase: 13-fundaci-n-de-export-serializers
verified: 2026-07-08T10:20:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir un PDF real generado por GET /api/audits/[id]/export?format=pdf y revisar visualmente la marca y los acentos."
    expected: "Los headings (portada, 'Scores por categoría', títulos de categoría, títulos de issue) se renderizan en Khand; el body en Geist Sans; los glifos áéíóúñ¿¡ se ven completos y sin cajas/tofus tanto en heading como en body; ningún título usa Array."
    why_human: "La correcta renderización de glifos con la fuente embebida y la calidad visual del branding no son verificables solo por extracción de texto; requieren abrir el archivo."
---

# Phase 13: Fundación de export + serializers — Verification Report

**Phase Goal:** El reporte se genera on-demand en 3 formatos (PDF con branding, Markdown-para-LLM, PPTX) desde una route Node de Next.js, leyendo datos ya persistidos con librerías JS puras — sin Chromium en el bundle web.
**Verified:** 2026-07-08
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Una petición a la route de export devuelve el reporte como PDF con branding (fuentes de marca) y acentos/ñ correctos | ✓ VERIFIED | `route.ts` mapea `format=pdf` → `toPdf` (Content-Type `application/pdf`, attachment). `pdf.tsx` registra Font.register×3: familia "Khand" (400/600) para headings, "GeistSans" (400) para body; `registerHyphenationCallback` desactiva el corte de palabras acentuadas; StyleSheet usa Khand solo en *coverTitle/sectionHeading/categoryHeading/issueHeading* y GeistSans en body. Los 3 TTF son sfnt válidos (sig `00010000`). `grep -ci Array` = 0. `pdf.test.ts` verde (extrae texto, asserta %PDF + acentos en heading Khand y body + nota N/M + cero PII). Detalle visual → human check. |
| 2 | Markdown estructurado por issue → página/selector → valor medido → criterio → recomendación, LLM-ready | ✓ VERIFIED | `markdown.ts` emite por issue el orden fijo: `Check` → `Página / selector` → `Valor medido` → `Criterio` → `Recomendación`, precedido de header (dominio, score general, status, scores por categoría en CATEGORY_ORDER). Alimenta `prioritizeIssues(model.priorityCandidates)`. `markdown.test.ts` verde. Route → Content-Type `text/markdown; charset=utf-8`. |
| 3 | PPTX de 7–12 slides con score general, scores por categoría e issues priorizados | ✓ VERIFIED | `pptx.ts` `buildPptxDeck`: BASE_SLIDES=7 fijas (portada + resumen + 5 categorías en CATEGORY_ORDER, "sin datos" si no puntúa) + 0..5 slides de issues (ISSUES_PER_SLIDE=10, MAX_ISSUE_SLIDES=5) → total garantizado [7,12]. `pptx.test.ts` cubre sparse=7 y rango. Binario ZIP (PK) vía `write({outputType:"uint8array"})`, sin disco. |
| 4 | Los 3 formatos acotan a top-N con nota "mostrando N de M" y sin PII; `pnpm why playwright` en web sin Chromium real | ✓ VERIFIED | `priority.ts` EXPORT_TOP_N=50, `prioritizeIssues` opera sobre `priorityCandidates` (M = totalPriorityCandidates), nota "Mostrando N de M issues" solo si total>50; los 3 serializers la consumen. PII: `buildReportModel` mapea whitelist (domain/createdAt/finishedAt/urlLimit/status), nunca incluye la relación email. Tests de fuga reales (canarios adyacentes) verdes en build.test.ts y no-pii.test.ts. `pnpm assert:web-boundary` PASS; todos los edges `playwright 1.61.1` son `peer` (tree-shaken), único no-peer es el wrapper `@crawlee/playwright`; sin edges reales de puppeteer/chromium/-core/scoped. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/report-model/src/build.ts` | buildReportModel single source of truth | ✓ VERIFIED | Devuelve ReportModel\|null; una query critical+warning sin take (priorityCandidates), slice(0,60) para priorityIssues, findMany detalle para issuesByCategory. |
| `packages/report-model/src/model.ts` | Tipos serializables sin PII | ✓ VERIFIED | ReportIssue/ReportModel sin campos email/token. |
| `packages/export/src/priority.ts` | EXPORT_TOP_N + prioritizeIssues | ✓ VERIFIED | =50, cap sobre candidates, nota condicional. |
| `packages/export/src/markdown.ts` | toMarkdown estructurado LLM | ✓ VERIFIED | Orden fijo de 5 campos por issue. |
| `packages/export/src/pptx.ts` | toPptx 7–12 slides | ✓ VERIFIED | BASE 7 + 0..5, pptxgenjs puro. |
| `packages/export/src/pdf.tsx` | toPdf Khand+Geist, sin Array | ✓ VERIFIED | Font.register×3, hyphenation off, renderToBuffer. |
| `packages/export/src/fonts/*.ttf` | Khand + Geist Sans TTF válidos | ✓ VERIFIED | 3 sfnt válidos; sin Array. |
| `apps/web/app/api/audits/[id]/export/route.ts` | Route Node 3 formatos | ✓ VERIFIED | runtime nodejs, 400/404/500 controlados, try/catch, filename sanitizado. |
| `scripts/assert-no-playwright-in-web.mjs` | Guardarrail Chromium extendido | ✓ VERIFIED | Checks A–D; Check D cubre -core/scoped con tracking de indentación peer. |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| page.tsx | @auditor/report-model | import buildReportModel | ✓ WIRED (3 refs; 0 `prisma.issue.findMany` inline) |
| markdown/pptx/pdf | priority.ts | prioritizeIssues(priorityCandidates) | ✓ WIRED |
| route.ts | report-model + export | buildReportModel + toPdf/toMarkdown/toPptx | ✓ WIRED (6 refs) |
| pptx.ts | pptxgenjs | generación slides | ✓ WIRED |
| pdf.tsx | fonts/*.ttf | Font.register | ✓ WIRED (×3) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| report-model suite | `pnpm --filter @auditor/report-model test` | 5 passed | ✓ PASS |
| export suite | `pnpm --filter @auditor/export test` | 25 passed | ✓ PASS |
| web export route suite | `pnpm --filter @auditor/web test -- export` | 7 passed | ✓ PASS |
| web typecheck | `pnpm --filter @auditor/web typecheck` | tsc clean | ✓ PASS |
| bundle boundary | `pnpm assert:web-boundary` | PASS (exit 0) | ✓ PASS |
| fuentes sfnt | node sig check | 3 TTF válidos, 0 Array | ✓ PASS |

### Code-Review Fix Confirmation (0 blockers; 3 warnings + 1 info FIXED)

| Finding | Fix | Status |
|---------|-----|--------|
| WR-01 guardrail no cubría -core/scoped | Check D enumera puppeteer-core/@puppeteer/browsers/@sparticuz/chromium/chrome-aws-lambda/playwright-core/@playwright/test; `realBrowserEdges` con boundary `[@\s]` y tracking de indentación peer | ✓ PRESENT |
| WR-02 tests PII tautológicos | Canarios adyacentes inyectados (email/emailId/token/verificationToken) en build.test.ts + buildModelWithLeakedPii en no-pii.test.ts; assert por familia de claves `/"(email\w*|token\w*|verification\w*)"/` | ✓ PRESENT |
| WR-03 route sin error boundary | try/catch alrededor de build+serializers → 500 controlado + log | ✓ PRESENT |
| IN-01 filename sin sanitizar | `sanitizeFilenameSegment(id)` en Content-Disposition | ✓ PRESENT |

### Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| EXPORT-01 (PDF branding) | ✓ SATISFIED | pdf.tsx Khand+Geist, acentos, route pdf |
| EXPORT-02 (Markdown-LLM) | ✓ SATISFIED | markdown.ts orden fijo por issue |
| EXPORT-03 (PPTX 7–12) | ✓ SATISFIED | pptx.ts piso 7 + techo 12 |
| EXPORT-05 (cap top-N + cero PII) | ✓ SATISFIED | priority.ts + tests PII con canarios + boundary |

### Anti-Patterns Found

Ninguno. Sin markers TBD/FIXME/XXX en los archivos de la fase; sin stubs (todos los serializers producen binarios/strings reales verificados por test); sin datos hardcodeados en flujo de render.

### Human Verification Required

**1. Inspección visual del PDF generado**
- **Test:** Generar un PDF vía `GET /api/audits/[id]/export?format=pdf` y abrirlo.
- **Expected:** Headings en Khand, body en Geist Sans, glifos áéíóúñ¿¡ completos en ambos roles, ningún título en Array.
- **Why human:** La renderización de glifos con fuente embebida y la calidad del branding no se verifican al 100% por extracción de texto; requieren abrir el archivo.

### Gaps Summary

Sin gaps. Los 4 criterios de éxito están verificados con evidencia de código y suites de test con dientes (fugas reales de PII detectables, conteo real de slides, firmas de binario, boundary determinista). El estado es `human_needed` únicamente por el spot-check visual del PDF (apariencia = concern humano por regla), no por ninguna deficiencia de implementación. Fixes del review (WR-01/02/03, IN-01) confirmados presentes.

---

_Verified: 2026-07-08_
_Verifier: Claude (gsd-verifier)_
