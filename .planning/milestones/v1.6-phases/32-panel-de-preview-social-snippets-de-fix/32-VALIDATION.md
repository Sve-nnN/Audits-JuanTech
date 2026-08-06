---
phase: 32
slug: panel-de-preview-social-snippets-de-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (`apps/web`, `@auditor/report-model`, `@auditor/checks`, `@auditor/meta-social` — misma versión en todo el workspace) |
| **Config file** | `apps/web/vitest.config.ts` (component tests con `@vitest-environment jsdom` docblock; route/API tests en entorno `node` por defecto) |
| **Quick run command** | `pnpm --filter web test -- <ComponentName>` / `pnpm --filter @auditor/report-model test` |
| **Full suite command** | `pnpm test` (raíz, corre todos los workspaces) |
| **Estimated runtime** | ~60 segundos (suite completa del monorepo) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <package> test -- <file/pattern>` acotado al módulo tocado
- **After every plan wave:** Run `pnpm test` (raíz) + `pnpm typecheck` + `pnpm assert:web-boundary`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 32-XX-XX | TBD | 1 | PREVIEW-01 | — | Google preview renderiza título/dominio/descripción truncados con datos reales | unit (RTL, jsdom) | `pnpm --filter web test -- GooglePreview` | ❌ Wave 0 | ⬜ pending |
| 32-XX-XX | TBD | 1 | PREVIEW-02 | — | Facebook/LinkedIn preview comparte layout 1.91:1, usa `imageStatus` para placeholder | unit (RTL, jsdom) | `pnpm --filter web test -- SocialCardPreview` | ❌ Wave 0 | ⬜ pending |
| 32-XX-XX | TBD | 1 | PREVIEW-03 | — | X preview elige variante `summary`/`summary_large_image` según `twitter:card` real, default `summary` si ausente | unit (RTL, jsdom) + unit puro | `pnpm --filter web test -- XPreview` / `pnpm --filter @auditor/report-model test -- socialPreview` | ❌ Wave 0 | ⬜ pending |
| 32-XX-XX | TBD | 1 | PREVIEW-04 | T-32-01 | Proxy rechaza origin distinto al auditado (403, sin detalle); reusa SSRF guard; fuerza allowlist de Content-Type | unit (Request/Response nativos, mock de `@auditor/db`) | `pnpm --filter web test -- preview-image` | ❌ Wave 0 (primer test de route handler App Router en el repo) | ⬜ pending |
| 32-XX-XX | TBD | 1 | FIX-01 | — | Snippet contiene valores reales de la página (title/URL), nunca placeholders genéricos | unit puro | `pnpm --filter @auditor/meta-social test -- fixSnippet` (o `report-model`, según ubicación final) | ❌ Wave 0 | ⬜ pending |
| 32-XX-XX | TBD | 1 | FIX-02 | — | Botón copiar: éxito con Clipboard API, fallback a descarga sin ella, foco visible, `role="status"` en confirmación | unit (RTL, jsdom) | `pnpm --filter web test -- FixSnippet` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/tests/app/api/audits/[id]/preview-image/route.test.ts` — primer test de un route handler App Router en el repo. Precedente existente (`apps/web/tests/pages/api/audits/[id]/export.test.ts`) testea Pages Router, contrato distinto. Patrón recomendado: `new Request(url)` real, invocar `GET(request, { params: Promise.resolve({ id }) })` directamente, aserciones sobre `Response` nativo. Mock de `@auditor/db` con `vi.mock("@auditor/db", ...)`.
- [ ] Fixtures de `SocialPreviewData` para tests de componentes (título largo, sin descripción, sin imagen, `imageStatus: "unavailable"`) — no existen hoy.
- [ ] Test de `packages/report-model` que verifique la regla completa de mapeo de los 9 subtipos de IMG-01 → placeholder/proxy, siguiendo el patrón de `packages/checks/src/checks/network/ogImageNetwork.test.ts`.

*Wave 0 debe cerrarse antes de continuar con las siguientes waves — cubre infraestructura de test sin precedente directo en el repo.*

---

## Manual-Only Verifications

*None: All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
