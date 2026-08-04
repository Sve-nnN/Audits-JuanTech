# Phase 32: Panel de preview social + snippets de fix - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

El usuario ve, dentro del reporte, cómo se vería su página al compartirse en Google/Facebook/LinkedIn/X, y puede copiar el snippet HTML exacto para arreglar cada problema detectado. Cubre PREVIEW-01..04, FIX-01/02. Última fase de v1.6, tiene UI real (a diferencia de las 4 anteriores). Consume los checks de Phase 30 (`SOCIAL-01..08`) y la validación de Phase 31 (`IMG-01..04`).

</domain>

<decisions>
## Implementation Decisions

### Ubicación y estructura del panel

- Sección nueva dentro del reporte existente en `/audits/[id]` — no ruta propia (a diferencia de `/arquitectura` de v1.4, que necesitaba viewport propio para zoom/pan).
- Sólo se muestra para páginas con al menos un issue de categoría `social` — evita ruido en páginas ya perfectas. Sin cap adicional de cantidad de páginas más allá de ese filtro.
- Los 3 layouts (Google/FB-LinkedIn/X) van en tabs (o sub-vistas equivalentes) dentro de la misma card de página — 1 página = 1 componente con 3 sub-vistas, no 3 secciones separadas del reporte.
- Extender `CategoryAccordion`/`IssueTypeGroup` ya existentes para insertar el panel dentro del flujo de issues de la categoría social, en vez de crear un componente de nivel superior nuevo y desconectado del resto del reporte.

### Los 3 layouts de preview

- Preview Google (SERP): mockup CSS puro (favicon + dominio + título + URL + descripción, tipografía/tamaños que imitan el resultado real) — nunca screenshot real (explícitamente Out of Scope en REQUIREMENTS.md).
- Preview Facebook/LinkedIn: un solo componente compartido (mismo layout 1.91:1, imagen + dominio + título + descripción truncada), ya que REQUIREMENTS.md especifica que comparten layout.
- Preview X/Twitter: un componente con 2 variantes (`summary` vs `summary_large_image`) derivadas del valor real de `twitter:card` ya extraído en Phase 30 — no forzar siempre la variante grande.
- Fuente de los datos del preview: reusar `packages/meta-social` (motor puro de Phase 30) para extraer los valores ya parseados, nunca volver a tocar `page.html` crudo desde el componente React ni parsear en el browser.

### Proxy de imágenes (PREVIEW-04) + snippets de fix

- Route del proxy: `apps/web/app/api/audits/[id]/preview-image/route.ts`, Node runtime (no Edge — necesita fetch a un origen arbitrario del sitio auditado).
- Allowlist: sólo permite proxear URLs cuyo origin coincide EXACTAMENTE con el origin del sitio auditado en esa auditoría (`audit.resolvedUrl` origin) — rechaza cualquier otro dominio, sin excepciones ni parámetros de bypass. Nunca hotlink directo a la imagen del sitio del usuario desde el cliente.
- Snippet de fix: reusa `packages/meta-social` para saber qué tag falta o está mal configurado, genera el HTML con los valores REALES ya extraídos de esa página específica (title/URL existentes) — nunca un template genérico con placeholders.
- Botón de copiar: extiende el patrón de Clipboard API con fallback ya resuelto en `ExportMenu.tsx` — no un componente nuevo desde cero.

### Integración con IMG-01 (Phase 31) y accesibilidad

- Si una og:image ya fue marcada `critical`/no verificable por los checks de Phase 31 (IMG-01), el preview muestra un placeholder visual + nota "imagen no disponible" — el proxy nunca intenta cargar una URL que Phase 31 ya determinó rota, en vez de dejar que falle silenciosamente en el navegador.
- El botón "copiar" es un `<button>` real con foco visible, mismo patrón de accesibilidad ya validado en v1.1 (A11Y-01..03) — nunca un `div` con `onClick`.
- Coherente con el filtro de Área 1: el panel no se renderiza en absoluto para páginas sin ningún issue de categoría `social`.

### Claude's Discretion

- Nombres exactos de los componentes nuevos (ej. `SocialPreviewPanel`, `GooglePreview`, `SocialCardPreview`) y su ubicación exacta dentro de `apps/web/app/components/ui/` vs. una carpeta propia bajo `apps/web/app/audits/[id]/`.
- Estructura exacta de tabs vs. acordeón interno para los 3 layouts dentro de la card de página.
- Redacción exacta de los textos/labels de cada preview y del placeholder de imagen no disponible — seguir el tono ya validado (español neutro, sin voceo).
- Estrategia exacta de CSP/allowlist adicional si hace falta configurar `next.config.ts` para el proxy (research debe confirmar si algo más allá del route handler es necesario).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/components/ui/CategoryAccordion.tsx`, `IssueTypeGroup.tsx` — flujo de issues por categoría ya existente, punto de inserción del panel.
- `apps/web/app/components/ui/ExportMenu.tsx` — patrón ya validado de Clipboard API con fallback a descarga si `navigator.clipboard` no está disponible; reusar el mismo patrón para el botón de copiar snippet.
- `packages/meta-social` (Phase 30) — motor puro de extracción OG/Twitter/charset, único dependiente de runtime es Cheerio; ya diseñado explícitamente para ser reusado por esta fase sin necesitar `@auditor/db`/`@auditor/checks`.
- `apps/web/app/api/audits/[id]/pages/` — patrón existente de route API anidada bajo `[id]`, referencia para la ruta del proxy nueva.
- `apps/web/app/components/ui/CategoryCard.tsx` — patrón de card con accesibilidad ya resuelta (single tab-stop, foco visible, roles ARIA) como referencia de calidad para los componentes nuevos.

### Established Patterns
- Todo el design system es tokens-only (cero hex crudo) — los 3 layouts de preview deben construirse con los tokens existentes, no colores hardcodeados imitando cada plataforma.
- `apps/web/next.config.ts` no tiene CSP configurada hoy — research debe confirmar si el proxy necesita algo adicional ahí o si el route handler solo alcanza.
- `serverExternalPackages`/`transpilePackages` en `next.config.ts` — si `packages/meta-social` necesita transpilarse para uso en `apps/web`, agregar ahí siguiendo el patrón ya usado para otros paquetes workspace.

### Integration Points
- `apps/web/app/audits/[id]/page.tsx` — punto de ensamblado del reporte, donde se inserta la nueva sección del panel.
- `apps/web/app/api/audits/[id]/preview-image/route.ts` (nuevo) — proxy server-side.
- Consume `IssueDraft`/`Issue` de categoría `social` ya persistidas (Phase 30) y el resultado de IMG-01 (Phase 31) para saber si la imagen es proxeable o debe mostrar placeholder.

</code_context>

<specifics>
## Specific Ideas

Ninguna referencia específica adicional — las 4 áreas grises fueron aceptadas con la respuesta recomendada en las 4 rondas.

</specifics>

<deferred>
## Deferred Ideas

- Previews de WhatsApp/Discord/Slack/Telegram (SOCIAL-10) — explícitamente diferido a v1.6.x/v1.7 en REQUIREMENTS.md.
- Editor de preview interactivo (cambiar texto y ver la card actualizarse en vivo) — explícitamente v2, fuera del modelo "detecta y recomienda, no produce".
- CMSFIX-08 (snippets por CMS vía cms-adapters) — diferido a v1.7/backlog (WR-05, ya documentado desde Phase 30).

</deferred>
