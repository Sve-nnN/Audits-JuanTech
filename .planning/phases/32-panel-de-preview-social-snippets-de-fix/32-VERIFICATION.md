---
phase: 32-panel-de-preview-social-snippets-de-fix
verified: 2026-08-06T17:18:54Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Abrir /audits/[id] de una auditoría real con al menos un issue critical/warning de categoría social y confirmar visualmente el panel 'Vista previa al compartir' con datos reales (Google preview)."
    expected: "El panel se ve montado dentro de Meta Tags/Social con favicon decorativo, dominio, título, URL y descripción reales de la página; ningún placeholder genérico."
    why_human: "Verificación visual de layout renderizado; jsdom no calcula geometría ni pintura real del navegador."
  - test: "Backstop: en GooglePreview, un título de 300 caracteres se trunca a 1 línea con line-clamp/ellipsis sin desbordar el contenedor ni crecerlo."
    expected: "El título queda en una sola línea truncada, el contenedor no crece ni se rompe el layout de la tarjeta."
    why_human: "must_haves.backstops de 32-01-PLAN.md, verification: backstop — jsdom no calcula layout/geometría; el test unitario sólo confirma que la clase de clamp está aplicada y que el texto completo llegó al DOM."
  - test: "Contra una auditoría real con al menos una og:image válida y una marcada critical por IMG-01: en la pestaña Network del navegador, confirmar que la primera imagen carga vía /api/audits/[id]/preview-image y que la segunda (imageStatus unavailable) no emite ningún request de red."
    expected: "Sólo la imagen 'ok' genera un request al proxy; la imagen 'unavailable' muestra el placeholder sin ningún intento de red."
    why_human: "Requiere inspección de la pestaña Network de un navegador real contra un servidor corriendo; no es observable por grep/test estático."
  - test: "Abrir /audits/[id] de una auditoría con una página a la que le falten etiquetas Open Graph y confirmar visualmente el bloque de snippet de fix, el botón de copiar y, con valores largos, que el bloque queda scrolleable sin desbordar la card."
    expected: "El snippet se ve dentro de un bloque <pre> con scroll, el botón de copiar queda siempre visible fuera del scroll, y copiar/descargar funciona."
    why_human: "Verificación visual + interacción real con Clipboard API del navegador."
  - test: "Backstop: un snippet con el máximo de 5 etiquetas y valores largos permanece scrolleable (overflow-x:auto, white-space:pre, max-height con scroll vertical) sin desbordar la card ni tapar el botón de copiar."
    expected: "El bloque de código nunca empuja al botón de copiar fuera de vista ni desborda el contenedor de la tarjeta."
    why_human: "must_haves.backstops de 32-03-PLAN.md, verification: backstop — geometría no verificable en jsdom."
  - test: "Contra una auditoría real con issues de categoría social: navegar los 3 tabs (Google, Facebook/LinkedIn, X) con teclado (flechas, Home, End) y con mouse; confirmar que el indicador --accent del tab activo es legible en tema oscuro y claro, y que el snippet de fix queda alcanzable sin que el scroll horizontal del bloque atrape el foco."
    expected: "Navegación por teclado fluida, indicador visual legible en ambos temas, snippet siempre alcanzable con Tab."
    why_human: "Verificación visual de contraste/legibilidad entre temas y de comportamiento de foco real de navegador; jsdom no pinta CSS ni evalúa contraste."
  - test: "Backstop: un título de 300 caracteres en SocialCardPreview/XPreview se trunca sin desbordar el contenedor 1.91:1 ni el 1:1 (1 línea de título, 2 de descripción)."
    expected: "Ninguna de las dos tarjetas se desborda ni rompe su aspect-ratio con texto largo."
    why_human: "must_haves.backstops de 32-04-PLAN.md, verification: backstop — geometría no verificable en jsdom."
---

# Phase 32: Panel de preview social + snippets de fix Verification Report

**Phase Goal:** El usuario ve, dentro del reporte, cómo se vería su página al compartirse en Google/Facebook/LinkedIn/X, y puede copiar el snippet HTML exacto para arreglar cada problema detectado.
**Verified:** 2026-08-06T17:18:54Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | El reporte muestra un panel de preview social por página con 3 layouts: Google/SERP, Facebook/LinkedIn (1.91:1 compartido) y X/Twitter (summary vs summary_large_image). | ✓ VERIFIED | `SocialPreviewPanel.tsx` monta un `role="tablist"` de 3 tabs (Google/Facebook‑LinkedIn/X) que renderizan `GooglePreview`, `SocialCardPreview` y `XPreview` respectivamente. `SocialCardPreview.tsx` exporta `SocialCardLayout`/`SocialCardText` compartidos por Facebook/LinkedIn y por la variante ancha de X. `XPreview.tsx` selecciona la variante `summary`/`summary_large_image` en base a `data.twitterCardVariant` (nunca fuerza la ancha). Tests: `SocialPreviewPanel.test.tsx`, `SocialCardPreview.test.tsx`, `XPreview.test.tsx` — todos en verde, corridos independientemente. |
| 2 | Las imágenes de terceros del preview se cargan vía proxy server-side con allowlist del origen auditado, nunca vía hotlink directo. | ✓ VERIFIED | `apps/web/app/api/audits/[id]/preview-image/route.ts` compara `target.origin` contra `new URL(audit.resolvedUrl).origin` antes de cualquier I/O (403 si difiere), reusa `assertPublicDestination`/`pinnedDispatcher`/`resolveRedirect` de Phase 31 (importados de `@auditor/checks/network`, nunca reimplementados), nunca usa `redirect: "follow"` (grep confirma 0 coincidencias), fuerza el `Content-Type` a un allowlist cerrado de 5 tipos de imagen. `PreviewImage.tsx` construye siempre `src="/api/audits/{auditId}/preview-image?url=..."` — nunca la URL cruda del sitio auditado. Tests: `route.test.ts`, `PreviewImage.test.tsx` en verde. |
| 3 | Cada issue de meta/social muestra un snippet HTML de fix prellenado con los valores reales de esa página (title/URL existentes), no un template genérico. | ✓ VERIFIED | `collectFixFields` en `socialPreview.ts` sólo agrega un campo cuando la etiqueta está ausente Y hay un valor real que ofrecer (`title`/`description` ya extraídos de esa página, `pageUrl` real, `og:type` con default técnico estándar, `twitter:card` derivado del propio `ogImage`). `og:title`/`og:description` se omiten explícitamente si no hay valor real (`title == null` → no se agrega el campo). `buildFixSnippet` (en `@auditor/meta-social`) sólo ensambla HTML a partir de esos valores, con escape de atributo (`escapeAttr`). `fixSnippet.test.ts` y `socialPreview.test.ts` cubren el criterio de inclusión con fixtures HTML reales. |
| 4 | El snippet es accesible por teclado y copiable con un botón dentro del panel Meta Tags/Social. | ✓ VERIFIED | `FixSnippet.tsx` usa `<button type="button">` real (no `div onClick`), con `min-height: 44px`, confirmación `role="status"`/`aria-live="polite"`, fallback a descarga cuando Clipboard API está ausente o `writeText` rechaza. Montado condicionalmente en `SocialPreviewPanel` sólo cuando `data.fixSnippet !== null`. `FixSnippet.test.tsx` en verde, incluyendo los 3 casos de comportamiento de Clipboard/fallback. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/report-model/src/socialPreview.ts` | `extractSocialPreview(html, pageUrl)` puro | ✓ VERIFIED | 144 líneas, sin red/Prisma, resuelve fallback OG→nativo, cap de 500 chars, computa `fixSnippet` vía `collectFixFields` + `buildFixSnippet`. |
| `packages/report-model/src/model.ts` | `SocialPreviewData`, `ReportModel.socialPreviews` | ✓ VERIFIED | `SocialPreviewData` con los 16 campos exactos del plan; `ReportModel.socialPreviews?` opcional (degradation-safe). |
| `packages/meta-social/src/fixSnippet.ts` | `buildFixSnippet(fields)` puro | ✓ VERIFIED | Escapa `&`, `"`, `<`, `>` en orden correcto; `property=` para `og:*`, `name=` para `twitter:card`; `null` si array vacío. |
| `packages/meta-social/src/imageSubtypes.ts` | vocabulario público de subtipos IMG-01 + `subtypeFromImgFingerprint` | ✓ VERIFIED | Movido acá (no a `packages/checks`) tras detectar en 32-01 que el barrel de `@auditor/checks` arrastra Crawlee/`tls` al bundle de Next — desviación documentada y coherente con el precedente de `TWITTER_CARD_VALUES`. |
| `apps/web/app/audits/[id]/social/GooglePreview.tsx` | preview SERP | ✓ VERIFIED | Favicon decorativo + dominio + título/URL/descripción reales, fallback "Sin {campo}". |
| `apps/web/app/audits/[id]/social/SocialCardPreview.tsx` | preview Facebook/LinkedIn 1.91:1 | ✓ VERIFIED | Exporta `SocialCardText`/`SocialCardLayout` reusados por X (variante ancha). |
| `apps/web/app/audits/[id]/social/XPreview.tsx` | preview X con 2 variantes | ✓ VERIFIED | Usa `data.twitterCardVariant`/`twitterTitle`/`twitterDescription`/`twitterImage` (nunca los campos `og*` planos). |
| `apps/web/app/audits/[id]/social/PreviewImage.tsx` | imagen vía proxy + placeholder por estado | ✓ VERIFIED | 4 estados (`ok`/`unavailable`/`none`/`onError`) implementados; `alt=""` `role="presentation"` `loading="lazy"`. |
| `apps/web/app/audits/[id]/social/FixSnippet.tsx` | bloque de snippet + botón copiar | ✓ VERIFIED | Botón real, Clipboard con fallback a descarga, confirmación accesible. |
| `apps/web/app/api/audits/[id]/preview-image/route.ts` | proxy Node runtime | ✓ VERIFIED | `runtime="nodejs"`, `dynamic="force-dynamic"`, allowlist de origin + SSRF guard + allowlist de Content-Type. |
| `apps/web/app/audits/[id]/social/SocialPreviewPanel.tsx` | tablist WAI-ARIA de 3 tabs + FixSnippet condicional | ✓ VERIFIED | Roving tabindex, `ArrowLeft`/`ArrowRight` con wrap, `Home`/`End`, paneles inactivos con `hidden` (no desmontados). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `buildReportModel` (`packages/report-model/src/build.ts`) | `prisma.page.findMany` (select `id/url/finalUrl/html`) → `extractSocialPreview` → `ReportModel.socialPreviews` | consulta acotada fuera del `Promise.all` existente | ✓ WIRED | `build.ts` líneas 322-355: `socialProblemPageIds` derivado de issues `social` critical/warning con `pageId`; consulta `select` acotado; `resolveImageStatus` aplica la tabla de decisión completa de Gap 2. |
| `apps/web/app/audits/[id]/page.tsx` | `IssueTypeGroup(socialPreviews, auditId)` | `socialPreviewsFor(problems, model)` sólo cuando `category === "social"` | ✓ WIRED | Líneas 388-393 de `page.tsx`; helper `socialPreviewsFor` (líneas 60-70) deriva `pageId` únicos preservando orden de aparición. |
| `IssueTypeGroup.tsx` | `SocialPreviewPanel` | `socialPreviews.map(p => <SocialPreviewPanel key={p.pageId} data={p} auditId={auditId} />)` antes de la lista de grupos | ✓ WIRED | Confirmado por grep e inspección directa del archivo. |
| `PreviewImage` | `GET /api/audits/[id]/preview-image?url=<ogImage>` | `src` construido con `encodeURIComponent`, nunca hotlink directo | ✓ WIRED | Confirmado en `PreviewImage.tsx` línea 60. |
| `route.ts` (proxy) | `assertPublicDestination` + `pinnedDispatcher` + `resolveRedirect` (`@auditor/checks/network`) | import de subpath dedicado (no el barrel `@auditor/checks`) | ✓ WIRED | Desviación documentada en 32-02-SUMMARY.md: se creó `packages/checks/src/network.ts` como subpath seguro porque el barrel arrastra Crawlee/`tls`; `next build` compila y `assert:web-boundary` pasa. |
| `socialPreview.ts` (missing tags + valores reales) | `buildFixSnippet` (`@auditor/meta-social`) → `SocialPreviewData.fixSnippet` → `FixSnippet.tsx` | `collectFixFields` computa el array, `buildFixSnippet` lo ensambla, `SocialPreviewPanel` monta `FixSnippet` sólo si `fixSnippet !== null` | ✓ WIRED | Confirmado en los tres archivos. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PREVIEW-01 | 32-01 | Preview Google (estilo SERP) | ✓ SATISFIED | `GooglePreview.tsx` montado end-to-end desde `page.tsx` → `IssueTypeGroup` → `SocialPreviewPanel`. |
| PREVIEW-02 | 32-04 | Preview Facebook/LinkedIn (1.91:1 compartido) | ✓ SATISFIED | `SocialCardPreview.tsx`, layout único reusado. |
| PREVIEW-03 | 32-04 | Preview X/Twitter (summary vs summary_large_image) | ✓ SATISFIED | `XPreview.tsx`, variante real derivada de `twitterCardVariant`, sin forzar la ancha. |
| PREVIEW-04 | 32-02 | Proxy server-side de imagen con allowlist de origen | ✓ SATISFIED | `route.ts` + `PreviewImage.tsx`, dos capas de defensa (origin exacto + `assertPublicDestination`). |
| FIX-01 | 32-03 | Snippet HTML prellenado con valores reales | ✓ SATISFIED | `collectFixFields` + `buildFixSnippet`, nunca placeholders genéricos ni `og:image` inventado. |
| FIX-02 | 32-03 | Snippet accesible/copiable en el panel | ✓ SATISFIED | `FixSnippet.tsx`, botón real + Clipboard con fallback. |

Todos los IDs de requisitos del ROADMAP para la Fase 32 (PREVIEW-01..04, FIX-01/02) aparecen declarados en el frontmatter de algún PLAN — sin huérfanos.

### Anti-Patterns Found

Ninguno. Grep de `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|coming soon|not yet implemented` sobre los 15 archivos modificados/creados de la fase: sin coincidencias de código (sólo nombres de clase CSS legítimos como `styles.placeholder`). Sin `dangerouslySetInnerHTML` en ningún componente de `apps/web/app/audits/[id]/social/`. Sin `redirect: "follow"` en el proxy.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Tests de `report-model` (socialPreview + build) | `pnpm --filter @auditor/report-model test -- socialPreview build` | 5 archivos, 85 tests en verde | ✓ PASS |
| Tests de `web` (los 8 componentes/rutas de la fase) | `pnpm --filter web test -- GooglePreview IssueTypeGroup SocialCardPreview XPreview SocialPreviewPanel PreviewImage FixSnippet preview-image` | 17 archivos, 125 tests en verde | ✓ PASS |
| Typecheck raíz (17 workspaces) | `pnpm typecheck` | 17/17 en verde (cache hit + replay) | ✓ PASS |
| Boundary de Playwright fuera de `apps/web` | `pnpm assert:web-boundary` | PASS | ✓ PASS |

Corridas de forma independiente por el verificador (no se confió en los números reportados en SUMMARY.md).

### Probe Execution

No aplica — la fase no declara probes (`scripts/*/tests/probe-*.sh`); es una fase de UI/API, no de migración/tooling.

## Human Verification Required

7 items necesitan confirmación humana — todos son verificaciones visuales/geométricas o de interacción de red real que jsdom no puede evaluar, explícitamente diferidas por cada plan al gate de fin de fase (`human_verify_mode: end-of-phase` en `.planning/config.json`), más los 3 backstops declarados con `verification: backstop` en el frontmatter de los PLAN (32-01, 32-03, 32-04):

### 1. Panel de Google visible con datos reales
**Test:** Abrir `/audits/[id]` de una auditoría con al menos un issue `critical`/`warning` de categoría social.
**Expected:** El panel "Vista previa al compartir" se ve con favicon, dominio, título, URL y descripción reales de esa página.
**Why human:** Verificación visual de renderizado real, no observable por grep/test estático.

### 2. Backstop — truncado de título de 300 caracteres en GooglePreview
**Test:** Página con `og:title` de 300 caracteres.
**Expected:** El título se trunca a 1 línea sin desbordar ni crecer el contenedor.
**Why human:** jsdom no calcula layout/geometría; declarado explícitamente `verification: backstop` en 32-01-PLAN.md.

### 3. Proxy de imágenes — comportamiento de red real
**Test:** Auditoría con una `og:image` válida y otra marcada `critical` por IMG-01; inspeccionar la pestaña Network.
**Expected:** Sólo la imagen "ok" genera un request al proxy; la "unavailable" no emite ningún request.
**Why human:** Requiere navegador real contra servidor corriendo.

### 4. Bloque de snippet de fix — visual e interacción de Clipboard
**Test:** Página con etiquetas OG ausentes; abrir el panel y usar el botón de copiar.
**Expected:** Snippet visible en bloque scrolleable, botón siempre accesible, copiar funciona.
**Why human:** Interacción real con Clipboard API del navegador + verificación visual.

### 5. Backstop — snippet de 5 etiquetas con valores largos
**Test:** Snippet con las 5 etiquetas y valores de 300 caracteres.
**Expected:** Bloque scrolleable sin desbordar la card ni tapar el botón de copiar.
**Why human:** jsdom no calcula geometría; declarado `verification: backstop` en 32-03-PLAN.md.

### 6. Navegación por teclado de los 3 tabs + legibilidad del indicador
**Test:** Navegar con flechas/Home/End y mouse entre Google/Facebook-LinkedIn/X, en tema oscuro y claro.
**Expected:** Navegación fluida, indicador `--accent` legible en ambos temas, snippet alcanzable sin que el scroll horizontal atrape el foco.
**Why human:** Verificación visual de contraste/legibilidad y de foco real de navegador.

### 7. Backstop — truncado de título de 300 caracteres en SocialCardPreview/XPreview
**Test:** Título de 300 caracteres en las tarjetas 1.91:1 y 1:1.
**Expected:** Ninguna tarjeta se desborda ni rompe su aspect-ratio.
**Why human:** jsdom no calcula geometría; declarado `verification: backstop` en 32-04-PLAN.md.

## Gaps Summary

No se encontraron gaps. Los 4 must-haves del ROADMAP (Success Criteria 1-4) están verificados con evidencia de código de primera mano: artefactos existen, son sustantivos (sin stubs/placeholders), están cableados de punta a punta (`buildReportModel` → `page.tsx` → `IssueTypeGroup` → `SocialPreviewPanel` → los 3 layouts + `FixSnippet` → proxy de imágenes), y los tests de la fase (210 tests entre `report-model` y `web`) se corrieron de forma independiente por el verificador, en verde. Los 6 requisitos del ROADMAP (PREVIEW-01..04, FIX-01/02) están satisfechos sin huérfanos.

El único motivo por el que el estado no es `passed` es la existencia de verificaciones humanas legítimas y explícitamente diferidas por el propio diseño de la fase (`human_verify_mode: end-of-phase`): 4 confirmaciones visuales/de red real documentadas en las 4 SUMMARY.md como "Verificación manual pendiente", más 3 backstops geométricos declarados en el frontmatter `must_haves.backstops` de los PLAN con `verification: backstop`, que jsdom no puede evaluar por diseño. Ninguno de estos 7 ítems indica un defecto conocido — son el checkpoint de fin de fase que el propio proyecto configuró.

---

_Verified: 2026-08-06T17:18:54Z_
_Verifier: Claude (gsd-verifier)_
