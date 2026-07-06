# Retrospective: Auditor Web (SEO/Técnico)

Living retrospective. Newest milestone first; cross-milestone trends at the end.

## Milestone: v1.1 — Overhaul de UI/UX y marca

**Shipped:** 2026-07-06
**Phases:** 3 (8-10) | **Plans:** 19

### What Was Built

Design system tokenizado con 4 fuentes de marca (Array/Khand/Geist Sans/Geist Mono) y tema claro/oscuro dark-first sin FOUC; librería de componentes tokens-only (ScoreGauge, CategoryCard, Badge, IssuesTable, CategoryAccordion, Button/Input/Field, EmptyState/ErrorState, Skeleton); las 6 pantallas rediseñadas con copy humanizado en español neutro, motion sutil (count-up, reveals, progreso animado) que respeta prefers-reduced-motion, y barrido de accesibilidad AA. Todo UI-only sobre el pipeline de v1.0.

### What Worked

- Secuencia de fundamentos hacia afuera (tokens → componentes → pantallas): evitó rework porque cada capa consumía la anterior ya estabilizada.
- Regla tokens-only (cero hex crudo) hizo el theming claro/oscuro casi gratis y coherente.
- UI-FEEDBACK.md de Juan tras la Fase 8 dirigió las Fases 9/10 con decisiones de marca lockeadas (Khand para títulos, no Array) y gaps concretos (dead-space del home, voceo).
- Gate de UI-only respetado: el flujo e2e de v1.0 quedó verbatim; audit confirmó pipeline intacto.

### What Was Inefficient

- Agentes concurrentes en la Fase 10 dejaron un typecheck error transitorio (`Input` sin `forwardRef` en HomeClient) que hubo que reconciliar entre planes hermanos.
- Skeleton (COMP-08) se construyó en Fase 9 sin consumidor y quedó como código muerto hasta cablearse en `loading.tsx` durante el audit.
- Validación visual de componentes diferida a Fase 10 (sin `/styleguide`): correcto para no sobre-construir, pero concentró el descubrimiento de ajustes en las pantallas reales.

### Patterns Established

- Componentes de UI consumen exclusivamente CSS variables de `tokens.css`.
- Acordeones/disclosure sobre `details/summary` nativos para teclado accesible por defecto.
- Cada pantalla con su propio `*.module.css` desacoplado (verify/progress/history), sin colgarse de `home.module.css`.
- Hooks de motion (`useCountUp`, `useReveal`) centralizados y reduced-motion-aware.

### Key Lessons

- Recoger feedback humano dirigido después de la fase de fundamentos (no al final) ahorra rework de pantallas.
- Un componente sin consumidor es deuda: cablear al crearlo o marcarlo explícitamente pendiente.
- En ejecución paralela, fijar el contrato de props compartidos (p. ej. `forwardRef` en Input) antes de repartir planes hermanos.

### Cost Observations

- Modo GSD: YOLO, granularidad standard.
- Fases entregadas en ~1 día calendario (2026-07-05 → 2026-07-06).
- Notable: la disciplina de tokens redujo el costo de iteración visual entre temas.

## Cross-Milestone Trends

| Milestone | Phases | Plans | Shipped | Nota |
|-----------|--------|-------|---------|------|
| v1.0 MVP | 7 | 7 | 2026-07-06 | Pipeline funcional, 63/63 req, 6 bugs reales cazados en verificación |
| v1.1 UI/UX | 3 | 19 | 2026-07-06 | UI-only, 31/31 req, pipeline v1.0 intacto |

**Tendencias:**
- Verificación con datos reales (juan-tech.com) sigue siendo la que caza los bugs de mayor impacto.
- Separar milestones por naturaleza (pipeline vs UI) mantuvo el blast radius chico y el audit limpio.
