---
phase: 32-panel-de-preview-social-snippets-de-fix
plan: 01
subsystem: report-model + web report UI
tags: [social, preview, report-model, ui, img-01]
status: complete
requires:
  - "Issue.pageId (columna ya existente, Phase 31 la escribe en IMG-01 y en la categoría social)"
  - "@auditor/meta-social (extractMetaSocial/firstValue/TWITTER_CARD_VALUES)"
provides:
  - "ReportIssue.pageId"
  - "ReportModel.socialPreviews: Record<pageId, SocialPreviewData>"
  - "extractSocialPreview(html, pageUrl)"
  - "resolveImageStatus(ogImage, imgIssues)"
  - "Vocabulario público de subtipos de IMG-01 + subtypeFromImgFingerprint"
  - "GooglePreview / SocialPreviewPanel montados desde IssueTypeGroup"
affects:
  - "packages/checks/src/checks/network/ogImageNetwork.ts (subtipos ahora importados, no redeclarados)"
  - "Todos los fixtures de ReportIssue (campo pageId nuevo)"
tech-stack:
  added: []
  patterns:
    - "El vocabulario compartido entre un check y la UI del reporte vive en @auditor/meta-social, nunca en packages/checks: ese barrel arrastra Crawlee y rompe el bundle de Next"
    - "report-model deriva en lectura; el cliente nunca re-parsea HTML"
key-files:
  created:
    - packages/report-model/src/socialPreview.ts
    - packages/report-model/src/socialPreview.test.ts
    - packages/meta-social/src/imageSubtypes.ts
    - packages/meta-social/src/imageSubtypes.test.ts
    - apps/web/app/audits/[id]/social/GooglePreview.tsx
    - apps/web/app/audits/[id]/social/GooglePreview.module.css
    - apps/web/app/audits/[id]/social/GooglePreview.test.tsx
    - apps/web/app/audits/[id]/social/SocialPreviewPanel.tsx
    - apps/web/app/audits/[id]/social/SocialPreviewPanel.module.css
  modified:
    - packages/report-model/src/model.ts
    - packages/report-model/src/build.ts
    - packages/report-model/src/build.test.ts
    - packages/report-model/src/index.ts
    - packages/report-model/package.json
    - packages/checks/src/checks/network/ogImageNetwork.ts
    - packages/checks/src/checks/network/index.ts
    - apps/web/app/components/ui/IssueTypeGroup.tsx
    - apps/web/app/audits/[id]/page.tsx
decisions:
  - "El vocabulario de subtipos de IMG-01 vive en @auditor/meta-social y no en packages/checks: report-model lo consume y el bundle de Next no puede arrastrar el grafo de Crawlee"
  - "SocialPreviewData.socialPreviews es opcional (patrón degradation-safe de perf?/architecture?/stack?), así ningún fixture existente de ReportModel se rompe"
  - "La consulta de HTML de páginas va fuera del Promise.all existente, para no alterar el orden de llamadas que mockean los tests de arquitectura"
  - "twitterCardVariant nunca se fuerza a summary_large_image: sólo un valor explícito y admitido ensancha la tarjeta"
metrics:
  duration: 13min
  tasks: 2
  files: 20
  completed: 2026-08-05
---

# Phase 32 Plan 01: Tracer del panel de preview social Summary

Preview de Google (PREVIEW-01) derivado server-side de `Page.html` y montado en el reporte real, con el vocabulario de subtipos de `IMG-01` ya público para decidir si la imagen declarada se puede pintar.

## Qué se construyó

**Gap 1 — `ReportIssue.pageId`.** `Issue.pageId` ya existía como columna y ya la escribían los checks sociales de Phase 30/31, pero `toReportIssue()` no la mapeaba, así que el modelo del reporte no podía asociar un issue con su página. Ahora la mapea, y los cinco fixtures que construyen un `ReportIssue`/`IssueRow` literal completo se actualizaron para seguir compilando.

**Motor de derivación.** `extractSocialPreview(html, pageUrl)` en `packages/report-model/src/socialPreview.ts`: función pura, sin red ni Prisma. Lee las etiquetas Open Graph con `extractMetaSocial`/`firstValue` de `@auditor/meta-social` (el único motor de parseo de la categoría) y el `<title>` nativo y la meta description con selectores propios, porque ese paquete sólo colecta los prefijos `og:`/`twitter:`. Resuelve el respaldo OG→nativo y conserva aparte la bandera de si la etiqueta Open Graph estaba declarada, que es lo que el snippet de fix del Plan 32-03 necesita saber.

**Cableado en `buildReportModel`.** Tras resolver `issuesForDetail`, junta los `pageId` únicos de los issues `social` con severidad `critical`/`warning`, y sólo si el conjunto no está vacío ejecuta UNA consulta adicional acotada a `{ id, url, finalUrl, html }`. Va deliberadamente fuera del `Promise.all` existente: ese orden de llamadas es lo que mockean los tests de arquitectura con `mockResolvedValueOnce`. El resultado es `ReportModel.socialPreviews`, opcional, con el mismo patrón degradation-safe de `perf?`/`architecture?`/`stack?`.

**Gap 2 — subtipos de `IMG-01`.** Los 9 subtipos, el `checkId` y `subtypeFromImgFingerprint` son ahora públicos y testeados. `resolveImageStatus` implementa la tabla de decisión completa: sin imagen declarada es `none`; los seis subtipos que impiden la carga (inalcanzable, no verificable, SVG, no-imagen, muy chica, muy grande) dan `unavailable`; los avisos que no la impiden (subóptima, pesada, indeterminada) y la ausencia de filas dan `ok`. Un fingerprint con forma inesperada devuelve `null` al parsearse y cae en `ok`: degradado, nunca inseguro.

**UI.** `GooglePreview` imita la jerarquía de un resultado de búsqueda (favicon decorativo + dominio + título + URL real + descripción) con la escala tipográfica y los tokens del proyecto, jamás con colores de marca: el "link azul" del SERP es `--accent-text`. Cada campo ausente pinta el literal `Sin {campo}` en `--text-muted` cursiva. `SocialPreviewPanel` lo envuelve con el encabezado y el subtítulo del contrato de copy, y `IssueTypeGroup` lo monta antes de la lista de grupos únicamente cuando `page.tsx` le pasa previews, que sólo ocurre en la categoría social.

## Desviaciones del plan

### Auto-corregidas

**1. [Regla 3 — bloqueante] `report-model` no puede importar el barrel de `@auditor/checks`**

- **Encontrado en:** Task 2, al correr `pnpm --filter web build`
- **Problema:** el plan pedía agregar `@auditor/checks` como dependencia de `packages/report-model` e importar de ahí los subtipos. El barrel de ese paquete arrastra `network/index.ts` → `brokenResources.ts` → `@auditor/crawler` → Crawlee/got-scraping, que dependen de `tls`. El build de Next falló con `Module not found: Can't resolve 'tls'`, con la traza pasando por `report-model/src/build.ts`. El razonamiento del plan (que `apps/web` ya declara `@auditor/checks`) no se sostiene: las únicas importaciones reales de `apps/web` a ese paquete son de TIPO (borradas en compilación) o van por la subruta dedicada `@auditor/checks/validate`, nunca por el barrel.
- **Arreglo:** el vocabulario canónico (9 subtipos + `OG_IMAGE_CHECK_ID` + `subtypeFromImgFingerprint`) se declara en `packages/meta-social/src/imageSubtypes.ts`, el motor puro cuya única dependencia de runtime es Cheerio. `ogImageNetwork.ts` lo consume como alias locales de sus constantes privadas (una sola fuente de verdad para cadenas que se persisten en fingerprints) y lo re-exporta, igual que `network/index.ts`, así que el contrato que el Plan 32-02 espera del paquete de checks queda intacto. `report-model` importa de `@auditor/meta-social`, que ya era dependencia suya. Es el mismo precedente que STATE.md ya fija para `TWITTER_CARD_VALUES` y los umbrales de `og:image`.
- **Archivos:** `packages/meta-social/src/imageSubtypes.ts`, `packages/meta-social/src/index.ts`, `packages/checks/src/checks/network/ogImageNetwork.ts`, `packages/report-model/src/build.ts`, `packages/report-model/package.json`
- **Commit:** c296cb5

**2. [Regla 3] Ciclo RED/GREEN separado no aplicado en Task 1**

- La task venía marcada `tdd="true"`, pero es un tracer que abarca modelo, derivación, consulta y tres componentes de UI a la vez; un commit RED sobre ese alcance no habría sido una prueba fallando por una razón, sino un árbol que no compila. Se entregó como un único commit atómico con tests e implementación. El plan es `type: execute`, no `type: tdd`, así que el guardarraíl de gates a nivel de plan no aplica. Los tests sí existen y cubren los 6 casos de `<behavior>` con fixtures HTML reales.

## Decisión sobre `transpilePackages`

`Pitfall 4` de la investigación estaba marcado `[ASSUMED]`: no se sabía si `@auditor/meta-social` necesitaba entrar a `transpilePackages` de `apps/web/next.config.ts`. **Medido: no hace falta.** `pnpm --filter web build` compila las 15 rutas sin tocar ese archivo, así que no se agregó configuración especulativa. `next.config.ts` queda sin modificar.

## Verificación

| Comando | Resultado |
|---------|-----------|
| `pnpm --filter @auditor/report-model test` | 73 tests en verde (5 archivos) |
| `pnpm --filter @auditor/checks test -- ogImageNetwork` | 341 tests en verde; ninguna aserción preexistente modificada |
| `pnpm --filter web test` | 82 tests en verde (11 archivos) |
| `pnpm typecheck` (raíz) | 17/17 workspaces en verde |
| `pnpm test` (raíz) | 14/14 workspaces en verde |
| `pnpm --filter web build` | compila sin error |
| `node scripts/assert-no-playwright-in-web.mjs` | PASS |

Cobertura del contrato de seguridad: ningún `dangerouslySetInnerHTML` en `GooglePreview.tsx` ni `SocialPreviewPanel.tsx` (T-32-01, con test explícito de que un `<img onerror>` en el título se escapa); cap de 500 caracteres en título y descripción (T-32-02, con test); `select` acotado en la consulta nueva (T-32-03, aserto sobre el objeto de consulta exacto); parseo de fingerprint que falla cerrado (T-32-04, con test).

## Verificación manual pendiente

Abrir `/audits/[id]` de una auditoría con al menos un issue `critical`/`warning` de categoría social y confirmar visualmente el panel "Vista previa al compartir" con datos reales. Queda diferido al gate de fin de fase, según `human_verify_mode: end-of-phase` de `config.json`.

El backstop de long-text de `32-UI-SPEC.md` (título de 300 caracteres que no desborda ni crece el contenedor) tiene test en `GooglePreview.test.tsx`, pero jsdom no calcula layout: el test verifica que la regla de clamp esté aplicada y que el texto entre completo al DOM, no la geometría renderizada. La confirmación geométrica requiere el ojo humano en el mismo gate de fin de fase.

## Known Stubs

| Campo | Archivo | Motivo | Se resuelve en |
|-------|---------|--------|----------------|
| `SocialPreviewData.fixSnippet` siempre `null` | `packages/report-model/src/socialPreview.ts` | El generador de snippets es alcance explícito del Plan 32-03 (FIX-01/02); el campo se declara ahora para no cambiar la forma del tipo en una wave posterior | Plan 32-03 |
| `SocialPreviewPanel` recibe `auditId` y no lo usa | `apps/web/app/audits/[id]/social/SocialPreviewPanel.tsx` | Lo consume el proxy de imágenes; se recibe desde ahora por instrucción explícita del plan, para no cambiar la firma del componente en una wave posterior | Plan 32-02 |

Ninguno impide el objetivo del plan: el preview de Google no muestra imagen ni snippet en esta wave por diseño (single-view, sólo Google).

## Self-Check: PASSED

Todos los archivos declarados existen en disco y los dos commits existen en el historial.
