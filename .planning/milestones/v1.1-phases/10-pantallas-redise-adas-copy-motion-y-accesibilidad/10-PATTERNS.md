# Phase 10: Pantallas rediseñadas, copy, motion y accesibilidad - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 13 (10 modified screens/components + 3 new motion files) + 2 shared (tokens.css, globals.css)
**Analogs found:** 13 / 13 (all analogs live in-repo; this is a re-skin of existing screens, so every file is its own primary analog)

> Phase 10 is a composition/re-skin phase, not greenfield. The strongest analog for each screen is almost always **its own current file** (structure + data-fetching to preserve) plus a **Phase 9 component** (markup to swap in) plus a **convention exemplar** (ThemeToggle for client hooks, ScoreGauge/Badge for token-only CSS). Classification below reflects that.

---

## File Classification

| File | Role | Data Flow | Closest Analog(s) | Match Quality |
|------|------|-----------|-------------------|---------------|
| `app/page.tsx` | route (server) | request-response | itself (thin server wrapper) | exact / preserve |
| `app/HomeClient.tsx` | component (client) | request-response (fetch POST) | itself + Field/Input/Button | exact / re-skin |
| `app/home.module.css` | styles | — | ScoreGauge.module.css (token-only) | role-match |
| `app/verify/page.tsx` | route (server) | request-response | `app/page.tsx` wrapper pattern | exact / preserve |
| `app/verify/VerifyClient.tsx` | component (client) | request-response (fetch POST) | itself + Button/EmptyState/ErrorState | exact / re-skin |
| `app/audits/[id]/AuditProgress.tsx` | component (client) | streaming (polling) | itself (poll) + Skeleton (shimmer) | exact / preserve poll, re-skin UI |
| `app/audits/[id]/page.tsx` | route (server) | CRUD (Prisma read) | itself + ScoreGauge/CategoryCard/IssuesTable/CategoryAccordion/Badge | exact / re-skin (primary consumer) |
| `app/audits/[id]/report.module.css` | styles | — | ScoreGauge.module.css / Badge.module.css | role-match |
| `app/audits/[id]/pages/page.tsx` | route (server) | CRUD (Prisma read) | itself + Badge + EmptyState + url.ts | exact / re-skin + tokenize hex |
| `app/audits/[id]/pages/[pageId]/page.tsx` | route (server) | CRUD (Prisma read) | itself + SeverityBadge + EmptyState + EntityGraphSvg | exact / re-skin + tokenize hex |
| `app/components/EntityGraphSvg.tsx` | component (server-safe SVG) | transform (graph→SVG) | itself (logic untouched, restyle only) | exact / tokenize only |
| `app/history/page.tsx` | route (server) | CRUD (Prisma read) + form GET | itself + Field/Input/Button + Badge | exact / re-skin |
| `app/components/motion/useCountUp.ts` | hook (client) | event-driven (rAF + IntersectionObserver) | `ThemeToggle.tsx` (mounted-guard hook) + ScoreGauge `--gauge-offset` | role-match |
| `app/components/motion/useReveal.ts` | hook (client) | event-driven (IntersectionObserver) | `ThemeToggle.tsx` (mounted-guard hook) | role-match |
| `tokens.css` (extend) | config | — | existing `--radius-*` / `--ring` block | role-match |
| `globals.css` (extend) | config | — | itself (add reduced-motion safety net + `@property`) | exact |

---

## Conventions (apply to every file — extracted from the codebase)

- **Client marker:** `"use client";` as line 1 for any file using hooks/state/effects/IntersectionObserver/WAAPI (`HomeClient.tsx:1`, `ThemeToggle.tsx:1`, `ScoreGauge.tsx:1`). Server route files (`page.tsx`) have NO directive and are `async function` reading `await params`/`await searchParams`.
- **Exports:** named function exports (`export function HomeClient(...)`), never default — except Next.js route files which use `export default async function`.
- **Imports:** relative paths only (`./home.module.css`, `../home.module.css`, `../../../../components/EntityGraphSvg`). Workspace packages via `@auditor/*` (`@auditor/db`, `@auditor/email`, `@auditor/scoring`, `@auditor/checks`). Icons from `lucide-react`. Component library imported per-file from `./components/ui/<Name>` (no barrel index exists — import each component directly).
- **CSS Modules:** every styled element uses `className={styles.x}`; CSS lives in a sibling `*.module.css`. Class names are single-word camelCase (`heroBody`, `scoreCircle`). Multi-class via template literal: `` className={`${styles.hero} ${STATUS_CLASS[status]}`} ``.
- **Tokens only, zero raw hex:** ScoreGauge.module.css and Badge.tsx are the reference for "no crudo hex" — every color is a `var(--token)`. This is the DS-01 bar all four hex-carrying files must reach.
- **CSP-safe motion:** no external libs, no CDN, no `eval`. WAAPI (`element.animate`) and CSS transitions only (mandated 10-CONTEXT.md + confirmed by EntityGraphSvg self-contained SVG comment at `EntityGraphSvg.tsx:34-38`).
- **A11y baseline already in components:** Field injects `aria-describedby`/`aria-invalid` via `cloneElement`; Button renders real `<button type>`; ScoreGauge/EntityGraphSvg use `role="img"`+`aria-label`; Badge is static (color never sole signal). Reuse these instead of re-implementing.
- **Reduced-motion guard:** every animated CSS Module ends with `@media (prefers-reduced-motion: reduce)` (see `ScoreGauge.module.css:107-111`, `Skeleton.module.css:101-107`). Every new/edited motion CSS must follow.

---

## Pattern Assignments

### `app/page.tsx` + `app/HomeClient.tsx` + `app/home.module.css` (SCREEN-01)

**Data-fetching to preserve (do NOT change):**
- `page.tsx` stays a thin server wrapper: `await searchParams` → `<HomeClient initialEmail={...} />` (`page.tsx:7-10`).
- `HomeClient` keeps its 3-state machine (`Step = "email" | "check-email" | "url"`, `HomeClient.tsx:8,16`) and both `fetch` calls exactly: POST `/api/request-verification` (`HomeClient.tsx:29-45`, branches on `data.verified` / `data.devVerifyUrl`) and POST `/api/audits` then `router.push(/audits/${data.auditId})` (`HomeClient.tsx:59-75`, keep the `403 + needsVerification` branch).

**Markup swap (current → Phase 9 component):**
| Current markup | Replace with |
|----------------|--------------|
| `<input className={styles.input}>` (`HomeClient.tsx:93-100,128-135`) | `<Field label htmlFor hint error>` wrapping `<Input type inputSize="lg" mono>` (`Field.tsx:43`, `Input.tsx:23` — `inputSize`, `invalid` props) |
| `<button className={styles.button}>` + `{submitting ? "…" : "…"}` (`HomeClient.tsx:101-103,136-138`) | `<Button size="lg" loading={submitting} type="submit">` (`Button.tsx:51`, `loading` handles spinner+aria-busy+disable) |
| `<button className={styles.linkButton}>&larr; Usar otro email</button>` (`HomeClient.tsx:119`) | `<Button variant="ghost" iconLeft={ArrowLeft}>` (`Button.tsx:8,14`) |
| inline error `<p className={styles.error}>` | `Field error` prop (gets `role="alert"` free) for field errors; keep a top-level error for network |
| "qué revisamos" chips (new) | `<Badge variant="neutral">` ×5 (`Badge.tsx:14-22,58`) |
| check-email confirmation panel | `--surface-raised` panel + `MailCheck` lucide icon (not EmptyState — spec says overkill) |

**Copy fix (voceo → neutral):** `HomeClient.tsx:87` "Ingresá…te damos", `:70` "Volvé a pedir", `:111` "Abrilo…podés", `:137` "Encolando", `:144-145` "podés". Final strings in 10-UI-SPEC SCREEN-01 copy table.

**home.module.css note:** this module is imported by home, **verify**, and **history**. Re-skinning it affects all three — coordinate. The dead-space fix (kill `min-height:100vh` centering of `.page`/`.card`) lives here.

---

### `app/verify/page.tsx` + `app/verify/VerifyClient.tsx` (SCREEN-02)

**Data-fetching to preserve:**
- `page.tsx` reads `await searchParams` for `token`, passes `CONSENT_TEXT` from `@auditor/email` (`verify/page.tsx:1,9-16`). Keep.
- `VerifyClient` keeps `Status = "idle" | "verifying" | "done" | "error"` and the single POST `/api/verify` with `{ token, consentText }` (`VerifyClient.tsx:12,24-28`). Keep the missing-token early return (`:43-45`).

**Markup swap:**
| Current | Replace with |
|---------|--------------|
| `<button className={styles.button}>` confirm (`VerifyClient.tsx:63`) | `<Button loading={status==="verifying"}>Confirmar y aceptar</Button>` |
| error `<p className={styles.error}>` (`:66`) | Phase 9 **ErrorState** (`variant="error"`, `AlertTriangle`) — `EmptyState.tsx:171` exports `ErrorState` with `action` for "Volver al inicio" |
| missing-token `<p className={styles.subtitle}>` (`:44`) | `ErrorState` with expired/invalid copy |
| `done` state `<Link className={styles.button} style={{...}}>` (`:53`) | `<Button>`-styled link; add `CheckCircle2` success icon (`--success`) |
| `idle` state | add `ShieldCheck` lucide icon (`--accent-text`) |

**Copy fix:** `verify/page.tsx:15` "Confirmá", `VerifyClient.tsx:51` "podés", `:44` phrasing. Add `role="status"` on done, focus-to-heading on state change.

---

### `app/audits/[id]/AuditProgress.tsx` (SCREEN-03) — preserve poll, re-skin + tokenize

**Data-fetching to preserve (LOCKED — do not rewrite):**
- The polling effect: `fetch(/api/audits/${auditId})` every 2500ms via `setInterval`, `clearInterval` + `window.location.reload()` on `status === "done" | "failed"` (`AuditProgress.tsx:35-51`). Keep verbatim.
- The `AuditStats` shape with `phase: "crawling" | "analyzing" | "performance"` and `crawled/total/discovered/failed` (`:6-12`) drives the new phase bar. Reuse as-is.

**DS-01 tokenize (inline hex/style → module classes):**
| Location | Current | Fix |
|----------|---------|-----|
| `AuditProgress.tsx:83` | `style={{ marginTop: 10, color: "#dc2626" }}` | `styles.errorText` → `color: var(--critical)`; wrap in `role="alert"` |
| `:65` | `style={{ marginTop: 14, fontSize: 15, fontWeight: 600 }}` | `styles.phaseLabel` (font-size token + `--weight-*`) |
| `:69,74` | `style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}` | `styles.phaseCaption` → `color: var(--text-secondary)` |

**New markup (MOTION-02 phase bar):** 3-segment stepper (`crawling`→`analyzing`→`performance`): current `--accent`, completed `--success`, pending `--border`. Crawling segment `width` transition on `crawled/total`; analyzing/performance use the **Skeleton shimmer** — reuse `@keyframes shimmer` from `Skeleton.module.css:30` (guarded at `:101-107`). Add `role="progressbar"` (aria-valuenow during crawling, `aria-busy` in indeterminate phases) + `role="status" aria-live="polite"` region for phase-label announcements. Optionally preview with `<Skeleton variant="gauge"/>` + `variant="card"` ×5 (`Skeleton.tsx:47`).

**Note:** this file imports `report.module.css` (`:4`) — phase-bar classes land there alongside the report styles.

---

### `app/audits/[id]/page.tsx` + `report.module.css` (SCREEN-04) — primary component consumer

**Data-fetching to preserve (server component, do NOT change):**
- `notFound()` on missing audit, `audit.status !== "done"` gate that renders `<AuditProgress>` (`page.tsx:145-164`).
- The `Promise.all` fetching `priorityIssues` / `issuesForDetail` / `resolvedIssues` + `count` (`:170-193`), `issuesByCategory` bucketing (`:195-200`), and the `AuditScores`/`AuditStats`/`PerfStatsSummary` typed reads (`:63-100`). Keep all.
- Local helpers `formatDate` (`es` locale, `:105`), `issueUrl`, `shortUrl` (`:120-135`) — note `shortUrl`/`issueUrl` now also exist in `components/ui/url.ts`; migrate to importing those to dedupe.

**Markup swap (this file has the most hand-rolled markup → Phase 9 components):**
| Current hand-rolled | Replace with (Phase 9) |
|---------------------|------------------------|
| `.scoreCircle` / `.scoreCircleNumber` (`page.tsx:225-229`) | `<ScoreGauge size="lg" value={overall} status={...} aria-label/>` (`ScoreGauge.tsx:61`) — **count-up anchor** |
| `.categoryCard` grid (`:246-262`) | `<CategoryCard>` ×5 (`CategoryCard.tsx:49`) |
| local `SEVERITY_BADGE_CLASS` / `DIFF_BADGE_CLASS` spans (`:40-56,340-352`) | `<SeverityBadge severity>` / `<DiffBadge diff>` (`Badge.tsx:88,117`) |
| hand-rolled `<table className={styles.table}>` (`:304-358`) | `<IssuesTable columns rows caption note emptyLabel>` (`IssuesTable.tsx:73`; columns support `sticky`/`mono`; auto URL→`<a>` for `http(s)` at `:47-71`) |
| `.categoryGroup` `<details>` + `.issueDetail` `<dl>` (`:475-502`) | `<CategoryAccordion>` + `<AccordionSubgroup>` + `<IssueDetail>` (`CategoryAccordion.tsx:32,66,119`) |
| empty issues `.emptyState` div (`:301`) | IssuesTable built-in empty (`CheckCircle2`/`--success`) or `<EmptyState>` |
| perf missing `.emptyState` (`:373-377`) | `<EmptyState>` / `<ErrorState>` with accurate reason |
| local `CATEGORY_LABEL`/`STATUS_LABEL`/`SEVERITY_LABEL`/`DIFF_LABEL`/`STRATEGY_LABEL` (`:14-61`) | import from `components/ui/labels.ts` (identical maps already exported there) to dedupe |

**Motion (MOTION-01):** wrap sections in `useReveal` (fade+slide, staggered); ScoreGauge count-up + arc fill on viewport entry (900ms). Reduced-motion → final state instantly.

**A11y:** single `<h1>` (domain), `<h2>`/`<h3>` in order, ScoreGauge `role="img"` aria-label already provided, IssuesTable is a real scrollable `<table>` region (built-in).

---

### `app/audits/[id]/pages/page.tsx` + `pages/[pageId]/page.tsx` (SCREEN-05) — tokenize + re-skin

**Data-fetching to preserve:** both are server components with direct Prisma reads + `notFound()` (`pages/page.tsx:13-20`, `[pageId]/page.tsx:32-44`). Keep the queries and the `schemaGraph`→node-count derivation (`pages/page.tsx:30-31`).

**DS-01 — these two files are the worst offenders (raw inline styles everywhere). Migrate to a new `pages.module.css`:**
| Location | Current raw value | Token |
|----------|-------------------|-------|
| `pages/page.tsx:23` | `fontFamily:"system-ui"`, `maxWidth:900` | `var(--font-geist-sans)`, `--container-narrow`/`--container-max` |
| `pages/page.tsx:37` | `borderBottom:"1px solid #e2e8f0"` | `var(--border)` |
| `pages/page.tsx:50` | `#16a34a` / `#94a3b8` presence text | `<Badge variant="ok">{n} entidad(es) JSON-LD` / `variant="neutral">sin JSON-LD` (`Badge.tsx`) |
| `[pageId]/page.tsx:19-23` | `SEVERITY_COLOR` `#dc2626/#d97706/#16a34a/#64748b` | `--critical`/`--warning`/`--success`/`--text-muted` (or use `<SeverityBadge>`) |
| `[pageId]/page.tsx:47,52,58,64,71,75,80,85` | `system-ui`, `#475569`, `#e2e8f0`, `#f8fafc`, borderLeft hex | `--font-geist-sans`, `--text-secondary`, `--border`, `--surface`, token severity border |

**Markup swap:** page URLs → `--accent-text` `<a>` with `shortUrl` display + full-URL `title` (import `shortUrl` from `components/ui/url.ts:19`). Empty page set / empty findings → `<EmptyState>`. Findings list → `--surface` cards with token severity left-border + `<SeverityBadge>`. Graph card wraps restyled `<EntityGraphSvg>` in `--surface`/`--border`/`--radius-lg` container.

**Copy fix:** `[pageId]/page.tsx:64` "AEO para esta página" phrasing; final strings in SCREEN-05 copy table.

---

### `app/components/EntityGraphSvg.tsx` (SCREEN-05) — restyle ONLY, logic untouched

**Preserve:** the circular layout math, `positions` map, edge/node rendering, `role="img"`+`aria-label`, empty-graph branch (`EntityGraphSvg.tsx:39-119`). Do NOT touch layout/dedup logic.

**Tokenize (the map from 10-UI-SPEC Color section):**
| Location | Current | Token target |
|----------|---------|--------------|
| `:12-24` `TYPE_COLORS` map | raw hex per `@type` | semantic tokens (Organization→`--accent-text`, Person→`--accent`, WebSite/WebPage→`--text-secondary`, FAQPage→`--success`, Article/BlogPosting→`--warning`, ProfessionalService/Product→`--accent-text`, fallback→`--text-muted`). Drive via `fill: currentColor` + a token-backed class rather than inline hex |
| `:27` fallback `#475569` | `--text-muted` |
| `:67` arrow marker `fill="#94a3b8"` | `var(--text-muted)` |
| `:84` edge `stroke="#cbd5e1"` | `var(--border)` |
| `:88` edge-label `fill="white"` | `var(--surface)` |
| `:89` edge-label text `#64748b` | `var(--text-secondary)` |
| `:56,89,102-113` `fontFamily="system-ui"` | `var(--font-geist-sans)` (labels) / `var(--font-geist-mono)` (type tags) |
| `:110` node type `fill="white"` | `--surface` / `--accent-foreground` for contrast on fill |
| `:113` node caption `#1e293b` | `var(--text)` |
| `:56` empty text `#64748b` | `var(--text-secondary)` |

Wrap in responsive container (`width:100%; height:auto; max-width:720px; margin-inline:auto`) so the fixed 720×480 viewBox scales without horizontal overflow. Since this is a server component, tokens must be reachable via CSS (className/CSS var), not JS theme lookup.

---

### `app/history/page.tsx` (SCREEN-06)

**Data-fetching to preserve:** server component, `normalizeEmail` from `@auditor/email`, Prisma `email.findUnique` + `audit.findMany` (`history/page.tsx:22-37`), and the `method="get"` search form (`:45`). Keep the GET form (server-driven search).

**Markup swap:**
| Current | Replace with |
|---------|--------------|
| `<input className={styles.input}>` (`:46-53`) | `<Field label="Correo"><Input type="email" mono/></Field>` |
| `<button className={styles.button}>Buscar` (`:54`) | `<Button type="submit">Buscar` |
| raw `<table className={styles.table}>` (`:66-91`) | `<IssuesTable>` or token-styled table; score as Geist Mono + status `<Badge>` |
| not-found `<p className={styles.error}>` (`:59-63`) | `<EmptyState>` (distinguish "no search yet" vs "no audits") |
| local `STATUS_LABEL` (`:11-15`) | import from `components/ui/labels.ts` |

**Fixes:** `formatDate` uses `es-AR` (`:18`) → standardize to `es` (match report `page.tsx:107`). Copy: `:43` "Consultá". `role="status"` on not-found.

---

## Shared Patterns

### Motion hooks — analog: ThemeToggle mounted-guard client hook

**Source:** `app/components/ThemeToggle.tsx:22-42` (`useEffect(() => setMounted(true), [])` guard so client-only behavior never causes hydration mismatch / SSR divergence).
**New location:** `app/components/motion/useCountUp.ts` and `app/components/motion/useReveal.ts` (new `motion/` dir alongside `ui/`; both `"use client"`, named exports).
**Apply to:** report ScoreGauge (count-up), all report/history/pages reveal sections.

`useCountUp(target, { duration = 900, enabled })` pattern:
- Same mounted/enabled guard as ThemeToggle so it is SSR-safe.
- rAF-stepped `Math.round` number 0→target, ease-out.
- Drives the gauge arc via the **already-exposed** `--gauge-offset` custom prop (`ScoreGauge.tsx:117` sets it inline; `ScoreGauge.module.css:44` consumes it with no transition today). Animate via WAAPI `element.animate([{ '--gauge-offset': circumference }, { '--gauge-offset': finalOffset }], {...fill:'forwards'})` OR register `@property --gauge-offset` in globals.css to make it CSS-transitionable.
- **Reduced motion:** return `target` immediately, gauge at final offset, no animation (mirror the guarded branch in `ScoreGauge.module.css:107`).

`useReveal()` pattern: IntersectionObserver (`threshold:0.15`, `rootMargin:'0px 0px -10% 0px'`, unobserve after first intersect), toggles `data-reveal="in"`. Content always in the DOM (no JS gating) so it is present for AT/no-JS.

### Tokens to add — analog: existing tokens.css var blocks

**Source:** `tokens.css` (has `--radius-*` `:103-106`, `--container-*` `:124-126`, `--ring`/`--shadow-focus` `:148,154` per-theme). NO motion tokens exist yet.
**Add:** `--motion-fast:150ms`, `--motion-base:300ms`, `--motion-reveal:500ms`, `--motion-count:900ms`, `--ease-out:cubic-bezier(0.22,1,0.36,1)`, `--ease-standard:cubic-bezier(0.4,0,0.2,1)` in the `:root` block. These are durations/easings (theme-invariant → put in `:root`, not per-theme).

### Global reduced-motion safety net — analog: per-component guards

**Source:** component-level guards exist (`ScoreGauge.module.css:107-111`, `Skeleton.module.css:101-107`) but `globals.css` currently has NO global block (confirmed — only reset + body + `a`).
**Add to `globals.css`:** the `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:0.001ms!important; animation-iteration-count:1!important; transition-duration:0.001ms!important; scroll-behavior:auto!important; } }` safety net, PLUS `@property --gauge-offset { syntax:'<number>'; inherits:false; initial-value:0 }` if using the CSS-transition path for the gauge.

### Form composition — analog: Field + Input + Button

**Source:** `Field.tsx:43` (label+hint/error+`aria-describedby`/`aria-invalid` via `cloneElement`), `Input.tsx:23` (`inputSize`/`invalid`), `Button.tsx:51` (`variant`/`size`/`loading`/`iconLeft`).
**Apply to:** home (email+url steps), verify (confirm), history (search). Always `<Field htmlFor>` wrapping `<Input id matching>`; errors via `Field error` (not bare red border).

### Status/severity/diff display — analog: Badge family + labels.ts

**Source:** `Badge.tsx:58/88/117` (Badge/SeverityBadge/DiffBadge), `labels.ts` (CATEGORY/STATUS/SEVERITY/DIFF/STRATEGY label maps).
**Apply to:** report, history, pages list, page detail. Replace every local label map + hand-rolled badge span with these. Color is never the sole signal (badge always carries the word).

---

## No Analog Found

None. Every Phase 10 file is a re-skin of an existing screen or a new hook modeled on the ThemeToggle client-hook pattern. The two genuinely-new files (`useCountUp.ts`, `useReveal.ts`) have a close structural analog (ThemeToggle mounted guard) and a concrete integration target (`--gauge-offset` on ScoreGauge), so no file falls back to RESEARCH.md-only patterns.

---

## Metadata

**Analog search scope:** `apps/web/app` (screens, `components/`, `components/ui/`, `tokens.css`, `globals.css`).
**Files scanned:** 13 screens/components + ScoreGauge/Button/Input/Field/Badge/EmptyState/IssuesTable/CategoryAccordion/CategoryCard/Skeleton APIs + labels.ts/url.ts + tokens.css/globals.css.
**Pattern extraction date:** 2026-07-06
