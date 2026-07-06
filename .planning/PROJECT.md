# Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## What This Is

Herramienta de auditoría web tipo "Screaming Frog pero más completo y automatizado". Un crawler entra a todas las páginas de un sitio (a partir del sitemap), las rastrea y detecta todo tipo de errores: SEO técnico, contenido, on-page, datos estructurados, rendimiento/Core Web Vitals (vía Lighthouse/unlighthouse) y visibilidad en IA (AEO). El resultado es un reporte con score general, scores por categoría e issues priorizados por severidad. Sirve como lead magnet para atraer clientes a juan-tech.com: las personas dejan su email, lo verifican, y ganan acceso a auditar una web.

## Core Value

Que cualquier persona ingrese una URL y reciba una auditoría completa, precisa y accionable de su web (con errores reales priorizados por severidad), a cambio de su email verificado. Si todo lo demás falla, el crawler + reporte de auditoría debe funcionar y ser confiable.

## Current Milestone: ninguno abierto — v1.0 y v1.1 shipped

**Estado:** v1.0 MVP (pipeline funcional) y v1.1 (overhaul de UI/UX y marca) están shipped (ambos 2026-07-06). No hay milestone en curso.

**Próximo trabajo previsto** (scope por definir vía `/gsd:new-milestone`, sin roadmap todavía):
- **Deploy a producción:** web → Vercel; worker → Railway/VPS; Resend con dominio verificado (hoy dev-mode loguea el link); revisión GDPR ligera como compuerta pre-lanzamiento.
- **v2 monetización:** planes de pago, auditorías/URLs ilimitadas, Stripe.
- **v2 enriquecimiento (ENRICH):** Playwright raw-vs-rendered sobre muestra, export PDF / reporte compartible con branding, SSE, Domain Rating como contexto.

**Cierre v1.1:** design system tokenizado + 4 fuentes de marca, librería de componentes reutilizable y las 6 pantallas rediseñadas con copy humanizado, motion sutil y accesibilidad AA. UI-only: el pipeline crawl/checks/PSI/scoring/email de v1.0 quedó intacto. Detalle en `.planning/MILESTONES.md` y `.planning/milestones/v1.1-ROADMAP.md`.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Crawler sitemap + fallback link-crawl, respeta robots.txt, rate-limit, 500 URLs — v1 (verificado juan-tech.com)
- ✓ SEO técnico: robots/sitemap/HTTP/canonical/indexabilidad/redirects/404 internos/viewport/duplicados+SimHash/huérfanas/hreflang/mixed content/enlaces+recursos rotos — v1
- ✓ On-page: title/meta/H1/alt/OG/longitud/lang — v1
- ✓ Datos estructurados: presencia+validez JSON-LD, validación schema.org (Classy Schema), grafo de entidades — v1
- ✓ Rendimiento/CWV vía PageSpeed Insights (score/LCP/CLS/INP/TTFB móvil+desktop), muestreado+cacheado — v1
- ✓ AEO: crawlers IA, llms.txt, datos estructurados IA, formato de contenido — v1
- ✓ Score general + por categoría con estados (health-ratio size-independent) — v1
- ✓ Reporte web con issues priorizados (valor medido/fuente/criterio/recomendación) — v1
- ✓ Email + double opt-in + normalización antes de auditar — v1
- ✓ Almacenamiento email↔auditorías + historial — v1
- ✓ Cuota free 1/semana/email + 500 URLs — v1
- ✓ Comparación entre corridas (diff nuevos/persistentes/resueltos por fingerprint) — v1
- ✓ Crawls largos en worker de fondo con cola BullMQ (sin bloquear/sin timeouts, lock robusto) — v1
- ✓ Fuentes de marca: Array (display, self-hosted), Khand (títulos/UI), Geist Sans (body), Geist Mono (métricas), con fallbacks y font-display swap — v1.1 (FONT-01..04, Phase 8)
- ✓ Design system tokenizado (color/tipografía/espaciado/radios/sombras/z-index) + tema claro/oscuro dark-first persistente sin FOUC + layout base compartido — v1.1 (DS-01..04, Phase 8)
- ✓ Librería de componentes tokens-only: ScoreGauge, CategoryCard, Badge severidad/diff, IssuesTable responsive, CategoryAccordion, Button/Input/Field, EmptyState/ErrorState, Skeleton — v1.1 (COMP-01..08, Phase 9)
- ✓ 6 pantallas rediseñadas (home, verificación, progreso, reporte, páginas + grafo, historial) ensambladas con la librería — v1.1 (SCREEN-01..06, Phase 10)
- ✓ Copy humanizado en español neutro sin voceo (UI, errores, cuota, verificación, recomendaciones) — v1.1 (COPY-01..03, Phase 10)
- ✓ Motion sutil (score count-up, reveals, progreso animado) que respeta prefers-reduced-motion — v1.1 (MOTION-01..03, Phase 10)
- ✓ Responsive sin overflow horizontal + contraste AA + foco visible + roles/labels ARIA + navegación por teclado — v1.1 (A11Y-01..03, Phase 10)

### Active

<!-- Current scope. Building toward these. -->

(v1.0 + v1.1 completos — sin milestone abierto. Próximo: deploy a producción + v2 monetización/enriquecimiento, scope por definir vía `/gsd:new-milestone`.)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Cobro / planes de pago / auditorías ilimitadas / URLs ilimitadas — v2. La v1 valida la propuesta con cuota gratuita antes de monetizar.
- Métricas propietarias externas como Domain Rating de Ahrefs como parte del score — contexto opcional, no parte del cálculo del score de auditoría (evita dependencia de datos de terceros pagos en el core).
- Corrección automática de errores en el sitio del usuario — la herramienta detecta y recomienda, no modifica sitios ajenos.
- App móvil nativa — v1 es web.

## Context

- **Origen:** Juan (juan-tech.com) es ingeniero de software y consultor SEO técnico freelance. La herramienta es a la vez lead magnet y demostración de expertise.
- **Referencia funcional:** Ya existe un reporte de ejemplo generado por una herramienta parecida (auditoría de juan-tech.com, score 86/100). Define el formato objetivo del output: score general, scores por categoría (SEO Técnico, Rendimiento/CWV, On-Page, Datos Estructurados, AEO), tabla de issues priorizados y detalle por issue (valor medido, fuente, criterio, recomendación).
- **Categorías y checks del reporte de referencia** son la base del catálogo de checks a implementar.
- **Rendimiento:** Se usa Lighthouse (unlighthouse para crawl multi-página) + Google PageSpeed Insights API (Lighthouse + CrUX) para datos de campo.
- **Extracción HTML:** el reporte de referencia usa Cheerio para parsear HTML crudo; JS rendering (Playwright) es deseable para comparar HTML crudo vs renderizado.
- **Ecosistema:** entorno con Vercel disponible; Next.js App Router como default de frontend.
- **Estado actual (post-v1.1):** monorepo pnpm+Turborepo con `apps/web` (Next.js, Vercel) y `apps/worker` (Crawlee, contenedor propio); paquetes db, queue, crawler, checks, psi, scoring, email, quota. Postgres (Neon) + Redis/BullMQ (Upstash). UI con design system tokenizado, 4 fuentes de marca y tema claro/oscuro. 140 tests verdes (pipeline). Pendiente: deploy a producción (env/keys/Resend/GDPR).

## Constraints

- **Tech stack**: Frontend Next.js (App Router) desplegado en Vercel; el crawl corre en un worker de fondo con cola (BullMQ/Redis o equivalente) en un contenedor propio (Railway/Fly/VPS) — Decidido por el usuario. Razón: crawl + Lighthouse sobre 500 URLs excede los límites de duración/CPU de funciones serverless cortas.
- **Performance**: Una auditoría gratuita rastrea hasta 500 URLs; debe completar sin timeouts y reportar progreso.
- **Cuota**: 1 auditoría/semana/email en free tier — requiere rate limiting persistente por email.
- **Verificación**: acceso a auditar sólo tras verificar el email (double opt-in) para evitar abuso.
- **Datos**: almacenar email, website auditado, stats, historial de auditorías y estado de corrección de errores.
- **APIs externas**: Google PageSpeed Insights API (rate limits/clave); considerar caché.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Frontend Next.js (Vercel) + worker/cola en contenedor propio | Crawl+Lighthouse de 500 URLs no cabe en funciones serverless cortas | ✓ Good — probado e2e en v1.0 (web encola, worker ejecuta) |
| Modo de trabajo GSD: YOLO | Usuario delegador, ejecuta end-to-end | ✓ Good — 10 fases entregadas sin fricción |
| Granularidad Standard (5-8 fases) | Balance entre MVP rápido y estructura | ✓ Good — 7 fases v1.0 + 3 v1.1 |
| Cuota free: 1 auditoría/semana, 500 URLs | Validar propuesta antes de monetizar | — Pending (falta lanzamiento a producción) |
| Cobro (ilimitado) diferido a v2 | Primero validar con free tier | — Pending |
| Scoring health-ratio size-independent | Penalización absoluta tanqueaba sitios grandes | ✓ Good — overall 91 vs 86 de referencia (v1.0 Phase 6) |
| Fuentes de marca: Khand para títulos, Array sólo como token display | Decisión de marca de Juan; a Juan le gustan los títulos en Khand | ✓ Good — v1.1 (UI-FEEDBACK.md) |
| Componentes tokens-only (cero hex crudo) | Coherencia dark/light y theming sin duplicar valores | ✓ Good — v1.1 Phase 9 |
| No construir ruta `/styleguide` | Validar componentes en las pantallas reales de la Fase 10 | ✓ Good — v1.1 (validación visual diferida a Phase 10) |
| v1.1 estrictamente UI-only | Proteger el pipeline validado de v1.0 | ✓ Good — flujo e2e preservado verbatim |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-06 after v1.1 milestone (Overhaul de UI/UX y marca)*
