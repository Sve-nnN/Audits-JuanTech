# Auditor Web (SEO/Técnico) — Lead Magnet para juan-tech.com

## What This Is

Herramienta de auditoría web tipo "Screaming Frog pero más completo y automatizado". Un crawler entra a todas las páginas de un sitio (a partir del sitemap), las rastrea y detecta todo tipo de errores: SEO técnico, contenido, on-page, datos estructurados, rendimiento/Core Web Vitals (vía Lighthouse/unlighthouse) y visibilidad en IA (AEO). El resultado es un reporte con score general, scores por categoría e issues priorizados por severidad. Sirve como lead magnet para atraer clientes a juan-tech.com: las personas dejan su email, lo verifican, y ganan acceso a auditar una web.

## Core Value

Que cualquier persona ingrese una URL y reciba una auditoría completa, precisa y accionable de su web (con errores reales priorizados por severidad), a cambio de su email verificado. Si todo lo demás falla, el crawler + reporte de auditoría debe funcionar y ser confiable.

## Current Milestone: v1.1 — Overhaul de UI/UX y marca

**Goal:** Elevar toda la interfaz del auditor a nivel profesional (design system coherente, tipografía y estética alineadas a juan-tech.com) y humanizar todos los textos, sin tocar la lógica de auditoría de v1.0.

**Target features:**
- Design system propio (tokens de color, tipografía, espaciado, radios, sombras, estados) en modo claro y oscuro con toggle.
- Fuentes de marca alineadas a juan-tech.com: **Array** (display, self-hosted Fontshare), **Khand** (títulos/UI), **Geist Sans** (body) y **Geist Mono** (código).
- Todas las pantallas elevadas: home, verificación de email, progreso de auditoría, reporte, páginas + grafo de entidades, historial.
- Componentes reutilizables pulidos: score gauge, cards por categoría, badges de severidad/diff, tabla de issues, acordeones, botones, inputs, estados vacíos y skeletons de carga.
- Motion sutil y profesional (score que cuenta, progreso vivo, transiciones, hover) respetando `prefers-reduced-motion`.
- Todos los textos humanizados en español neutro sin voceo (skill humanizer).
- Responsive y accesible (contraste, foco, roles) en todas las vistas.

**Key context:** UI-only. No cambia el pipeline crawl/checks/PSI/scoring/email de v1.0. Fuentes: mismo stack que juan-tech.com. Skills a aplicar: gsd-ui-phase (contrato de diseño), web-animation-design (motion), humanizer (copy). Español neutro, sin voceo (regla dura del usuario).

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

### Active

<!-- Current scope. Building toward these. -->

(v1 completo — próximo milestone: deploy a producción + v2 monetización)

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
| Frontend Next.js (Vercel) + worker/cola en contenedor propio | Crawl+Lighthouse de 500 URLs no cabe en funciones serverless cortas | — Pending |
| Modo de trabajo GSD: YOLO | Usuario delegador, ejecuta end-to-end | — Pending |
| Granularidad Standard (5-8 fases) | Balance entre MVP rápido y estructura | — Pending |
| Cuota free: 1 auditoría/semana, 500 URLs | Validar propuesta antes de monetizar | — Pending |
| Cobro (ilimitado) diferido a v2 | Primero validar con free tier | — Pending |

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
*Last updated: 2026-07-05 after initialization*
