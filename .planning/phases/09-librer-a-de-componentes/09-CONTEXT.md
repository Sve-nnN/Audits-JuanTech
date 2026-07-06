# Phase 9: Librería de componentes - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Construir la librería de componentes reutilizables y pulidos sobre los tokens/fuentes de la Fase 8. Cubre COMP-01..08: score gauge, cards por categoría, badges (severidad + diff), tabla de issues responsive, acordeón de detalle, botones/inputs/formularios con estados, estados vacíos/error, skeletons. Componentes con estados estáticos listos para ensamblarse en las pantallas de la Fase 10. NO incluye ensamblar pantallas, copy humanizado final, ni motion vivo (Fase 10).

</domain>

<decisions>
## Implementation Decisions

### Arquitectura de componentes
- Ubicación: `apps/web/app/components/ui/` (junto al shell existente de Fase 8). No paquete separado.
- Estilo: CSS Modules por componente (patrón establecido del repo; camelCase, una palabra).
- API: client components tipados, named exports, variantes por prop (`variant`, `size`, `state`).
- Librería de íconos: `lucide-react` (tree-shakeable, sin CDN, CSP-safe). Verificar legitimidad en npm antes de instalar.
- Todo consume tokens de `tokens.css`; cero hex hardcodeado.

### Implementación clave
- Score gauge: SVG circular con `stroke-dashoffset`, color por estado (good/needs_improvement/critical vía tokens), número legible en Geist Mono. Estructura preparada para animar en Fase 10 (sin animación viva ahora).
- Tabla de issues: responsive vía scroll horizontal con columna de URL sticky y clickeable. No colapsa a cards.
- Skeletons: componente `Skeleton` con shimmer CSS que respeta `prefers-reduced-motion`.
- Empty/error states: componente con slot de ícono (lucide) + título + descripción + acción opcional.
- Badges: severidad (crítico/advertencia/ok) y diff (nuevo/persistente/resuelto) como componentes reutilizables sobre tokens.
- Cards por categoría: score + estado + etiqueta, consistentes entre sí.
- Acordeón: detalle por categoría (problemas vs correctos), accesible por teclado.
- Botones/inputs/formularios: estados hover/focus/disabled/error accesibles (foco visible lima de marca).

### Validación y alcance
- SIN ruta `/styleguide` (Juan la declinó). La validación visual ocurre al ensamblar pantallas en Fase 10.
- Motion en Fase 9: solo estructura + estados estáticos. Motion vivo (score que cuenta, reveals, transiciones) va en Fase 10.
- Copy en componentes: placeholders neutros SIN voceo. Copy final humanizado en Fase 10.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Fase 8 entregó: `tokens.css` (color/spacing/radii/shadows/z-index, dark :root + light [data-theme]), `fonts.ts` (array/khand/geistSans/geistMono), shell (`components/shell.module.css`, AppHeader, AppFooter), `ThemeToggle`, `globals.css` migrado a tokens.
- Patrón cliente: `"use client"` + named export (HomeClient, VerifyClient, AuditProgress, ThemeToggle).
- CSS Modules camelCase junto al componente, imports relativos dentro de `app/`.

### Established Patterns
- Sin Tailwind. tokens.css + CSS Modules.
- CSP-safe: sin fuentes/CSS de CDN. lucide-react renderiza SVG inline (compatible).

### Integration Points
- Componentes consumidos por las pantallas de Fase 10 (home, verify, progreso, reporte, pages+grafo, historial). El reporte `/audits/[id]` es el mayor consumidor (score gauge, cards, tabla, acordeón, badges).
- Roles tipográficos ya fijados: métricas/números=Geist Mono, headings=Khand, body=Geist Sans, Array NO en títulos.

</code_context>

<specifics>
## Specific Ideas

- Ver `.planning/UI-FEEDBACK.md`: feedback visual de Juan tras validar Fase 8 (contraste, spacing, componentes del reporte). Aplicar al construir cards/tabla/gauge.
- Array NO se aplica a títulos (preferencia de Juan). Headings=Khand.
- Reporte de referencia (juan-tech.com, 86/100) define el look objetivo de score gauge, cards por categoría y tabla de issues.

</specifics>

<deferred>
## Deferred Ideas

- Ensamblar pantallas, copy humanizado, motion vivo, a11y/responsive de punta a punta → Fase 10.
- Ruta /styleguide → descartada por Juan.
- Export PDF / branding compartible → v2.

</deferred>
