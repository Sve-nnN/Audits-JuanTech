# Phase 8: Fundamentos de marca — fuentes y design system - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Establecer la base visual del auditor: fuentes de marca, tokens de diseño (color, tipografía, espaciado, radios, sombras, z-index), theming claro/oscuro con toggle sin FOUC, y layout base consistente. Cubre FONT-01..04 y DS-01..04. UI-only, sin tocar lógica de v1.0. NO incluye la librería de componentes (Fase 9) ni el rediseño de pantallas (Fase 10) — solo los cimientos que ambas consumen.

</domain>

<decisions>
## Implementation Decisions

### Paleta de marca
- Tema base: dark-first. Fondo casi negro (`#0a0b0f` aprox), texto claro. Casa con el posicionamiento "code-forward, ingeniería aplicada al SEO" de juan-tech.com.
- Color primario/acento: verde-lima técnico estilo terminal/data (`#c3f53c` aprox).
- Escala de severidad: crítico=rojo (`#ef4444`), advertencia=ámbar (`#f59e0b`), ok=verde (`#22c55e`).
- Estados de score (good/needs_improvement/critical) derivados de la misma escala de severidad para coherencia.
- Neutrales: escala slate (blue-gray) 50→950.
- Ambos temas (claro y oscuro) se generan a partir de estos tokens; el tema claro es la inversión coherente del dark-first.

### Theming
- Librería: `next-themes` (sin flash de tema incorrecto, class/attribute strategy, estándar en Next App Router).
- Estrategia CSS: atributo `[data-theme]` en `<html>`.
- Persistencia: localStorage + respeta `prefers-color-scheme` como valor inicial.

### Arquitectura de tokens (sin Tailwind)
- Tokens como CSS variables centralizadas en `tokens.css`, importado por `globals.css`.
- Estilos de componentes: se mantiene el patrón actual del repo — CSS Modules por componente. NO se introduce Tailwind (decisión explícita de Juan: mantener CSS Modules).
- Escala de espaciado base 4px; radios sm/md/lg/full como variables; sombras y z-index tokenizados.

### Fuentes
- Array (display): self-hosted woff2 de Fontshare en `apps/web/app/fonts/`, vía `next/font/local`, expuesta como `--font-array`.
- Khand (títulos/UI): `next/font/google`, pesos 400/500/600/700, expuesta como `--font-khand`.
- Geist Sans + Geist Mono: vía paquete `geist` de npm (optimizado para Vercel), expuestas como `--font-geist-sans` / `--font-geist-mono`.
- Roles: display=Array, headings/UI=Khand, body=Geist Sans, código/métricas=Geist Mono. Con fallbacks y `font-display: swap`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/app/layout.tsx` — RootLayout mínimo (lang="es", importa globals.css). Punto de integración para fuentes, ThemeProvider y `data-theme`.
- `apps/web/app/globals.css` — reset mínimo + colores slate hardcodeados y `@media (prefers-color-scheme: dark)`. A reemplazar por tokens.
- CSS Modules existentes: `app/home.module.css`, `app/audits/[id]/report.module.css`. Patrón a seguir.

### Established Patterns
- Monorepo pnpm workspaces: `apps/web` (Next 15, React 19, App Router) + `packages/*` (checks, crawler, scoring, etc.).
- Sin Tailwind, sin PostCSS config. Estilos = globals.css + CSS Modules por pantalla.
- Colores hoy hardcodeados (slate `#f8fafc`/`#0f172a`/`#020617`/`#f1f5f9`).

### Integration Points
- `layout.tsx`: envolver con `ThemeProvider` de next-themes, aplicar variables de fuente al `<body>`/`<html>`, setear `suppressHydrationWarning`.
- `globals.css`: importar `tokens.css`; migrar colores hardcodeados a `var(--...)`.
- Toda pantalla existente (home, verify, audits, history) hereda tokens automáticamente al migrar globals.

</code_context>

<specifics>
## Specific Ideas

- Fuentes pinneadas por REQUIREMENTS (FONT-01..04): Array, Khand, Geist Sans, Geist Mono. No negociable.
- Palette debe sentirse alineada a juan-tech.com (no se pudo extraer hex exacto del sitio en vivo; se usa aproximación code-forward aprobada por Juan). Si más adelante Juan pasa hex exactos, se ajustan los tokens.
- Español neutro sin voceo (regla dura) aplica a cualquier texto que aparezca (aunque el copy pleno es Fase 10).

</specifics>

<deferred>
## Deferred Ideas

- Librería de componentes (score gauge, cards, badges, tabla issues, etc.) → Fase 9.
- Rediseño de pantallas, copy humanizado, motion, accesibilidad de punta a punta → Fase 10.
- Export PDF / branding compartible → v2.

</deferred>
