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

## Milestone: v1.4 — Visualización avanzada + resolución de URL

**Shipped:** 2026-07-10
**Phases:** 4 (21-24) | **Plans:** 10

### What Was Built

`resolveCanonicalUrl` (https→http fallback, sigue redirects del home, timeout acotado) reemplazó la mitigación puntual `resolveHomeKey` de v1.3, con `Audit.resolvedUrl` como origin único de todo el pipeline y error claro en dominios muertos. El árbol de arquitectura pasó de filas planas por profundidad a un dendrograma real (jerarquía reconstruida desde `graph.edges`) con conectores SVG, cap "+N más" por rama, banda de huérfanas y un mapa navegable (`ArchitectureMap`, zoom/pan/reset) en ruta propia. El grafo de entidades JSON-LD (`EntityGraphSvg`) ganó layout radial por componente conexo. El detalle de página ganó un panel Classy Schema: código JSON-LD formateado por entidad + validación por propiedad/tipo contra un subconjunto de schema.org, persistido vía `Page.schemaJson` y consumido por `SchemaEntities.tsx`, con un check de scoring (SD-07) que nunca falla dura.

### What Worked

- Secuencia de riesgo ascendente (backend puro → rework de SVG conocido → rework acotado → pieza más pesada) permitió aislar el único cambio de infra real (resolución de URL) antes de tocar UI.
- Reusar patrones ya establecidos (SVG puro tokens-only, sin dependencias nuevas, CSP estricta) hizo que 3 fases de UI no introdujeran ni una librería nueva.
- Checkpoints de verificación humana (`checkpoint:human-verify`) capturaron correctamente que el código estaba completo pero el look/comportamiento necesitaba ojos humanos antes de cerrar el requirement.

### What Was Inefficient

- Los checkpoints humanos de las Fases 21 y 22 quedaron con el código comiteado y el `SUMMARY.md` diciendo "pendiente de aprobación", pero nunca se escribió un `VERIFICATION.md`/`HUMAN-UAT.md` cuando Juan efectivamente los validó en una sesión en vivo. El resultado: el milestone-audit los marcó como `gaps_found` y hubo que reconstruir la aprobación retroactivamente (vía `/gsd-autonomous`) para poder cerrar v1.4 — trabajo evitable si el checkpoint se cierra con un artefacto en el momento en que ocurre, no después.
- El `pre_close_artifact_audit` del cierre de milestone encontró una sesión de debug abierta y no relacionada (`pdf-export-crash-reading-s`, crash de export PDF) que quedó sin resolver desde antes de v1.4 — no bloqueó el cierre (se documentó como diferido) pero es una señal de que las sesiones de debug abiertas deberían revisarse con más frecuencia, no solo al cerrar milestone.

### Patterns Established

- Layout de árbol/dendrograma determinista en dos pasadas (asignar X a hojas por contador, X de nodo interno = promedio de hijos) sin motor de layout en cliente — reutilizable para cualquier visualización jerárquica futura bajo la misma CSP estricta.
- Viewport de zoom/pan como `transform: translate() scale()` movido por estado de React, sin dependencias — patrón para cualquier visualización grande que necesite navegación futura.
- Cerrar un checkpoint humano requiere un artefacto escrito en el momento (VERIFICATION.md o SUMMARY.md con nota explícita de aprobación), no solo la palabra de que "ya se validó" — de lo contrario el milestone-audit lo marca como gap y hay que reconstruir la aprobación después.

### Key Lessons

- Un checkpoint `human-verify` que Juan aprueba verbalmente en una sesión debe registrarse por escrito en ese mismo momento (VERIFICATION.md o nota en el SUMMARY.md), no confiar en que quede "implícito" en el historial de sesión — el costo de reconstruir la aprobación retroactivamente es pequeño pero real, y es evitable.
- Las sesiones de debug abiertas (`.planning/debug/`) deberían revisarse periódicamente, no solo aparecer como sorpresa en el audit de cierre de milestone.

### Cost Observations

- Modo GSD: YOLO, granularidad standard.
- 4 fases entregadas en ~1 día calendario (2026-07-09 → 2026-07-10), más una sesión adicional el 2026-07-10 para cerrar los gaps de proceso y archivar el milestone.
- Notable: el gap de proceso (checkpoints sin cerrar por escrito) costó una sesión extra completa de reconciliación documental — el fix es barato (cerrar en el momento) comparado con el costo de reconstrucción después.

## Milestone: v1.5 — Fingerprinting técnico + fixes personalizados por CMS

**Shipped:** 2026-07-25
**Phases:** 3 (25-27) | **Plans:** 12

### What Was Built

Motor de fingerprint propio (`@auditor/fingerprint`, única dep runtime `cheerio`) que detecta CMS+builder, CDN/proxy, hosting, framework JS y analytics a partir de headers/cookies/HTML ya capturados durante el crawl, sin requests adicionales, con confianza tipada por eje (nunca winner-take-all). El worker invoca la detección una sola vez por auditoría y la persiste en `Audit.stack`; el reporte muestra una tabla "Stack técnico detectado" tokens-only al inicio. Sobre ese fingerprint, `@auditor/cms-adapters` implementa un patrón adaptador (WordPress con resolución por builder, Shopify, Webflow, Wix/Squarespace combinado) con fallback genérico garantizado, que `buildReportModel` resuelve en lectura (nunca persistido) para personalizar la recomendación de fix de los 10 checks de mayor volumen — llegando gratis a la UI y a los 3 exports sin tocar `packages/export`.

### What Worked

- Secuencia de riesgo ascendente (contrato de datos completo → wiring end-to-end mínimo → motor de recomendaciones) evitó retrabajo en cascada: el tipo `DetectedStack` se fijó antes de escribir ningún adaptador o UI consumidora.
- Verificar el copy de UI de terceros (`[REVISAR]`) contra documentación oficial vigente vía `WebSearch` en vez de asumir el research original — 5 de 7 rutas de menú habían cambiado de nombre/ubicación desde que se escribió el catálogo inicial.
- Cerrar el checkpoint de validación humana (redacción de copy, rutas de menú) en el mismo momento con Juan, en vez de diferirlo, evitó repetir el gap de proceso de v1.4 (checkpoints sin artefacto escrito).
- El chain completo code-review → fix → verify → nyquist → security corrió sin intervención manual salvo las 2 decisiones genuinamente humanas (aprobar redacción, decidir revisar las rutas de menú).

### What Was Inefficient

- La sesión anterior se cortó justo después de ejecutar los 3 plans de Phase 27 (commits + SUMMARY.md ya en `main`) pero antes de correr code-review/verify — el reinicio de `/gsd-autonomous` tuvo que reconciliar el estado en disco contra `STATE.md`/tasks desactualizados antes de poder continuar. Costo bajo (unos minutos de lectura de estado), pero evitable si la sesión hubiera dejado un `.continue-here.md` explícito antes de cortar.
- `27-SECURITY.md` es el primer `SECURITY.md` del proyecto — no hubo un baseline previo contra el cual comparar, así que la primera pasada de security-auditor tuvo que decidir criterio de aceptación (`accept` vs `mitigate`) sin precedente. Quedó documentado como baseline para milestones futuros.

### Patterns Established

- Paquetes de dominio puro (`@auditor/fingerprint`, `@auditor/cms-adapters`) desacoplados de `@auditor/db`/`@auditor/crawler`/`@auditor/checks` en runtime, con el `checkId` string como único punto de contacto — mismo patrón que `packages/graph`/`packages/scoring` de milestones anteriores, ahora consolidado como convención explícita del proyecto (ver `STATE.md` → Notas de ejecución).
- Recomendaciones/derivados costosos de recalibrar se resuelven en lectura dentro de `buildReportModel`, nunca persistidos pre-calculados — mismo principio para fingerprint (v1.5 Phase 25/26) y CMS-fix (v1.5 Phase 27).
- Verificar copy de UI de terceros contra la documentación oficial vigente (no solo contra el research original) antes de cerrar un checkpoint humano de "rutas de menú".

### Key Lessons

- Cuando una sesión autónoma se corta a mitad de fase, el primer paso del reinicio debe ser reconciliar disco vs. `STATE.md`/task list antes de re-planificar o re-ejecutar nada — el estado en disco (commits, SUMMARY.md) es la fuente de verdad, no la última entrada de `STATE.md`.
- Un `SECURITY.md` nuevo sin precedente en el proyecto necesita declarar explícitamente que es el baseline, para que futuras corridas sepan que no hay regresión que comparar todavía.

### Cost Observations

- Modo GSD: YOLO, granularidad standard.
- 3 fases entregadas en 5 días calendario (2026-07-21 → 2026-07-25), con una interrupción/reconciliación de sesión en Phase 27.
- Notable: 2 pausas explícitas para decisión humana (validar copy, decidir revisar rutas de menú) — ambas resueltas en la misma sesión, sin diferir a una corrida separada.

## Cross-Milestone Trends

| Milestone | Phases | Plans | Shipped | Nota |
|-----------|--------|-------|---------|------|
| v1.0 MVP | 7 | 7 | 2026-07-06 | Pipeline funcional, 63/63 req, 6 bugs reales cazados en verificación |
| v1.1 UI/UX | 3 | 19 | 2026-07-06 | UI-only, 31/31 req, pipeline v1.0 intacto |
| v1.4 Visualización avanzada + resolución URL | 4 | 10 | 2026-07-10 | 7/7 req, audit inicial gaps_found (proceso, no funcional) resuelto por confirmación retroactiva |
| v1.5 Fingerprinting técnico + fixes por CMS | 3 | 12 | 2026-07-25 | 18/18 req, audit `passed`, integración 10/10 wired, primer `SECURITY.md` del proyecto |

**Tendencias:**
- Verificación con datos reales (juan-tech.com) sigue siendo la que caza los bugs de mayor impacto.
- Separar milestones por naturaleza (pipeline vs UI) mantuvo el blast radius chico y el audit limpio.
- Los checkpoints `human-verify` necesitan cerrarse con un artefacto escrito en el momento de la aprobación — de lo contrario el milestone-audit los marca como gap y hay que reconstruir la aprobación retroactivamente al cerrar (visto en v1.4, Fases 21/22; evitado en v1.5 cerrando en el momento).
- Copy de UI de terceros se desactualiza entre el research y el cierre de fase — verificar contra documentación oficial vigente al momento de la validación humana, no solo confiar en el research inicial (v1.5, Phase 27).
