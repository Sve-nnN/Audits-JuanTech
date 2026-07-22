# Phase 26: Wiring en el worker + tabla de stack en el reporte - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

El usuario ve, apenas termina el escaneo, una tabla del stack técnico detectado de su sitio, consistente con el design system existente, calculada una sola vez por auditoría. Cubre FPRINT-09, STACKUI-01..03. No incluye el motor de recomendaciones por CMS (Phase 27) ni inclusión en exports (fuera de scope explícito de esta fase).

</domain>

<decisions>
## Implementation Decisions

### Wiring del fingerprint en el worker
- `detectStack` se corre una única vez, después del crawl completo, en el mismo punto del pipeline donde ya corren checks/scoring en `apps/worker/src/index.ts`.
- Input: todas las páginas crawleadas exitosamente (con `html` no nulo), usando `Page.responseHeaders`/`Page.cookieNames`/`Page.html` ya persistidos (Phase 25) — sin requests adicionales.
- Persistencia: columna nueva `Audit.stack` (Json?, aditiva) — mismo patrón que `Audit.scores`.
- Idempotencia: igual que `scores`, se sobreescribe en cada corrida completa del audit (no versionado, no se mantiene historial de stacks por corrida).

### Posición y contenido de la tabla en el reporte
- Ubicación: al inicio del reporte, justo después del ScoreGauge/header, antes de las CategoryCards.
- Filas: 5 (no 6) — CMS con builder combinado si es WordPress (ej. "WordPress (Elementor)"), CDN/proxy, Hosting, Framework JS, Analytics (lista si hay múltiples herramientas).
- "No detectado con certeza": la fila se muestra igual (nunca se oculta), con texto explícito "No detectado con certeza" + Badge variant neutral/outline — no es un badge de error/warning/critical, es informativo.
- Componente base: tabla simple nueva, reusa el `Badge` existente para representar confianza (4 variantes visuales: alto/medio/bajo/no-detectado). No se reusa `CategoryCard`.

### Estilo visual y estados de la tabla
- Mapeo de color de confianza: alto→ok (verde), medio→warning (ámbar), bajo→warning tenue/outline, no-detectado→neutral/gris. La confianza de detección NUNCA se mapea a "critical" (rojo) — no es severidad de error de auditoría.
- Layout responsive: tabla simple con CSS Grid/tokens existentes, colapsa a lista vertical en mobile (mismo patrón que `IssuesTable`).
- Analytics múltiples: se muestran como lista de badges/chips separados (uno por herramienta: GA4, GTM, Meta Pixel) dentro de la misma fila, no como texto plano separado por comas.
- Título de sección: "Stack técnico detectado" (fuente Khand, mismo nivel jerárquico que los títulos de categoría existentes).

### Integración con exports y report-model
- `Audit.stack` se lee y transforma en `buildReportModel` (packages/report-model) — mismo single-source-of-truth que scores/issues, evita el ensamblado divergente ya anotado como riesgo latente en v1.2 (query JSON-LD paralela en pages/page.tsx).
- No se incluye en exports (PDF/Markdown/PPTX) en esta fase — STACKUI-01..03 solo pide la tabla en el reporte web; agregarlo a exports es scope creep de Phase 26, no requisito.
- `Audit.stack` es nullable; si es `null` (auditorías pre-v1.5 o corrida sin stack), la sección completa de la tabla no se renderiza — nunca se muestra una tabla vacía con todos los ejes en "no detectado" artificialmente.
- Tipo compartido: `DetectedStack` de `@auditor/fingerprint` se importa directamente en `packages/report-model` y `apps/worker` — paquete puro, sin problema de acoplamiento al importarlo como tipo.

### Claude's Discretion
Ninguna decisión quedó en discreción total de Claude — las 4 áreas se resolvieron con "Aceptar todo" sobre las propuestas recomendadas.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/components/ui/Badge.tsx` + `Badge.module.css` — componente de badge ya tokenizado, con variantes de severidad (ok/warning/critical) reusable para representar confianza, sumando una variante neutral/outline para "no-detectado".
- `apps/web/app/components/ui/CategoryCard.tsx` — patrón de card existente, no se reusa directamente pero sirve de referencia de composición con tokens.
- `apps/web/app/audits/[id]/page.tsx` — punto de ensamblado del reporte: importa `buildReportModel`, `ScoreGauge`, `CategoryCard`, `Badge`, etc. La tabla nueva se inserta acá, después del header/ScoreGauge.
- `apps/worker/src/index.ts` (~línea 540-555) — punto donde ya se persisten `Page.schemaGraph`/`schemaJson` tras el crawl y antes del cálculo de scores; mismo punto de inserción natural para invocar `detectStack` y persistir `Audit.stack`.
- `@auditor/fingerprint` (Phase 25) — `detectStack(input: { pages: PageFingerprintInput[] }): DetectedStack`, función pura ya lista para consumir.

### Established Patterns
- Patrón de columna Json aditiva en `Audit` (`stats`, `scores`) — mismo patrón aplica para `Audit.stack`.
- `buildReportModel` es el single source of truth ya establecido en v1.2 para ensamblar datos del reporte (evita queries divergentes).
- Componentes tokens-only (cero hex hardcodeado), tema claro/oscuro, responsive sin overflow horizontal — convención de todo el design system desde v1.1.
- `pnpm db:push` contra Neon requerido tras agregar `Audit.stack` al schema (misma convención que Phase 25).

### Integration Points
- `apps/worker/src/index.ts` — invoca `detectStack` tras el crawl, persiste `Audit.stack`.
- `packages/report-model` — lee `Audit.stack`, lo transforma/expone en el modelo de reporte consumido por `apps/web/app/audits/[id]/page.tsx`.
- `apps/web/app/audits/[id]/page.tsx` — renderiza la tabla nueva usando el modelo de report-model.

</code_context>

<specifics>
## Specific Ideas

- CMS y builder se muestran combinados en una sola fila/celda cuando aplica (ej. "WordPress (Elementor)"), no como filas separadas.
- La tabla nunca oculta ejes sin detección — siempre muestra las 5 filas, con estado visual neutral para "no detectado con certeza".
- Analytics es la única fila que puede mostrar múltiples badges simultáneos (coexistencia GA4+GTM+Meta Pixel, ya fijado como array en Phase 25).

</specifics>

<deferred>
## Deferred Ideas

- Incluir la tabla de stack técnico en los exports (PDF/Markdown/PPTX) — explícitamente fuera de scope de Phase 26, posible extensión futura si surge demanda.

</deferred>
