---
phase: 27-motor-de-recomendaciones-por-cms-patr-n-adaptador-fallback
verdict: SECURED
threats_open: 0
threats_closed: 7
asvs_level: 1
security_block_on: high
verified: 2026-07-25
---

# Phase 27: Motor de recomendaciones por CMS — Security Audit

**Verdict:** SECURED
**Threats Closed:** 7/7
**ASVS Level:** 1

## Threat Verification

| Threat ID | Category | Severity | Disposition | Evidence |
|-----------|----------|----------|-------------|----------|
| T-27-01-01 | Tampering (XSS aguas abajo) | low | accept | Los 5 catálogos (`wordpress.ts`, `shopify.ts`, `webflow.ts`, `wixSquarespace.ts`) son `Record<string,string>` 100% literal, sin interpolación de datos del sitio. `recommendation` nunca pasa por `dangerouslySetInnerHTML` (0 matches relevantes); se renderiza como texto JSX plano (auto-escapado por React) en `apps/web/app/audits/[id]/pages/[pageId]/page.tsx:148`, y como texto de librería (no HTML) en `packages/export/src/{pdf.tsx,pptx.ts,markdown.ts}`. |
| T-27-01-SC | Tampering (supply chain) | low | accept | `packages/cms-adapters/package.json`: única dependency es `@auditor/fingerprint: workspace:*`; devDependencies coinciden con las ya presentes en `packages/fingerprint`/`packages/report-model` — cero superficie nueva de paquetes externos. |
| T-27-02-01 | Tampering/DoS (índice con checkId/label inesperado) | low | mitigate | `resolveCmsRecommendation.ts:41-42` valida `CMS_LABELS.includes(value)` antes de indexar el registry; `adapter.lookup(...) ?? generic`; nunca lanza. Cubierto por tests de label inválido/null — 21/21 verdes. |
| T-27-02-02 | Tampering (reescritura de genérico fuera de los 10) | low | mitigate | Catálogo scopeado a los 10 `SUPPORTED_CHECK_IDS`; cualquier otro checkId cae a `?? generic`. Test de identidad estricta con `TECH-10` en motor y coverage (post-fix WR-01 contra `registry` real). |
| T-27-03-01 | Tampering (reescritura de recomendación en checks OK o fuera de los 10) | low | mitigate | `build.ts:124-128` guarda `severity === "ok"` → verbatim; 3 call sites pasan `rawStack` (confirmado por grep). 4 tests de integración nuevos en `build.test.ts` — 48/48 verdes. |
| T-27-03-02 | Information Disclosure (recommendation serializada a cliente/exports) | low | accept | Copy 100% estático; `toReportStackAxis` descarta `signals`/`evidence`, solo expone `{value, confidence}`. |
| T-27-03-03 | Information Disclosure (`verify-cms-fix.mts` lee audit real) | low | accept | Script read-only, no loguea `DATABASE_URL`, `console.dir` limitado a `{checkId, severity, recommendation}` + stack sin signals, degrada limpio a P1001 offline, `$disconnect()` en éxito y error. |

## Unregistered Flags

Ninguno. La superficie nueva de la fase (`@auditor/cms-adapters`, `verify-cms-fix.mts`, deps workspace en `report-model`/`worker`) está completamente mapeada a los 7 threats de arriba.

Nota residual no bloqueante: los hallazgos Info del code review (IN-01 orden de type-assertion, IN-03 fallback implícito Wix) quedaron sin tocar por decisión explícita de scope (solo Critical+Warning) — no representan amenaza nueva, ya cubiertos por el guard de T-27-02-01 y el tipo `CmsLabel` (unión cerrada).

**Primer `SECURITY.md` del proyecto** — no existía log previo de riesgos aceptados contra el cual comparar; este es el baseline.
