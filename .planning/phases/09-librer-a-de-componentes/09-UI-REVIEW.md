# Phase 9 — UI Review

**Audited:** 2026-07-06
**Baseline:** `09-UI-SPEC.md` (design contract) + Phase 8 `tokens.css`
**Screenshots:** not captured — no dev server, and by design there is NO `/styleguide` route (Juan declined). Components are not yet wired into screens. This is a **code-level audit**; live rendering and screen assembly are Phase 10.
**Nature:** Advisory / non-blocking.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Contract placeholder strings reproduced verbatim, all voceo-free; two dropped accents in placeholders (Phase 10 humanizes) |
| 2. Visuals | 4/4 | Clear hierarchy (48px mono gauge, Khand titles, soft-fill badges); icon-only aria-label documented but not enforced in code |
| 3. Color | 3/4 | Zero hardcoded hex, full semantic-token discipline, DS-02 coherence — but IssuesTable focus outline uses `--accent` instead of `--ring`, a real light-theme visibility regression |
| 4. Typography | 4/4 | Khand headings, Geist Mono metrics, Geist Sans body, Array correctly absent from all titles; one raw 11px `dt` (contract-specified but off the token scale) |
| 5. Spacing | 4/4 | All padding/gap via `--space-*` tokens; only legit geometry values (44/48/56/132px) are non-token |
| 6. Experience Design | 4/4 | Loading/error/empty/disabled/null states all covered; reduced-motion guards on every animation; native keyboard semantics throughout |

**Overall: 23/24**

---

## Top 3 Priority Fixes

1. **IssuesTable focus outlines use `--accent`, not `--ring`** (`IssuesTable.module.css:26` scroll region, `:117` link) — In the light theme `--accent` is `#c3f53c` (bright lime, low contrast on `#f8fafc`) while the contract deliberately set `--ring` to `#4d7c0f` (lime-700, AA-visible) for exactly this reason. Keyboard focus on the scroll region and clickable URLs will be barely visible in light mode, and it breaks consistency with every other component (Button/Input/Card/Accordion all correctly use `--ring`). **Fix:** replace `var(--accent)` with `var(--ring)` on both `.scroll:focus-visible` and `.link:focus-visible`.

2. **EmptyState hardcodes `aria-level={2}`** (`EmptyState.tsx:148`) — Every empty/error block announces as an `<h2>` regardless of context. Inside the report (`/audits/[id]`, which has an `h1` page title and `h3`/`h4` category sections) an empty state nested in a category panel would inject a level-2 heading mid-outline, producing a non-monotonic heading structure for screen-reader users. **Fix:** expose an optional `titleLevel?: 2 | 3` prop (default 2) and pass it to `aria-level`, so Phase 10 consumers set the correct level per placement.

3. **CategoryCard renders an empty status caption when `statusLabel` is omitted** (`CategoryCard.tsx:62-64`) — With a non-null `status` but no `statusLabel`, the caption `<p>` renders `""`: the status color is applied to the score, but no status *word* appears. That silently violates the "color is never the only signal" contract for that card. **Fix:** derive a default label from `status` (reuse `STATUS_LABEL` from `labels.ts`) so a word always renders, or make `statusLabel` required when `status` is non-null.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)
- All COMP-03/07 contract strings are reproduced **verbatim** and centralized: `labels.ts` (`SEVERITY_LABEL`, `DIFF_LABEL`, `STATUS_LABEL`, `CATEGORY_LABEL`, `STRATEGY_LABEL`) and `EmptyState.tsx:37-53` (`DEFAULT_COPY`). Matches the Copywriting Contract table 1:1: `Crítico`/`Advertencia`/`Correcto`, `Nuevo`/`Persistente`/`Resuelto`, `Todavia no hay nada por aca`, `Algo salio mal`, error/empty bodies verbatim.
- All strings are voceo-free (no "ingresá/podés/te damos") per UI-FEEDBACK.md hard rule. Field placeholders (`Correo`, `URL del sitio`, `Auditar mi sitio`, `Reintentar`) are consumer-supplied, so no generic-label leakage inside primitives.
- No generic labels found (grep for `Submit`/`OK`/`Cancel`/`Save`/`went wrong` — none present as literals).
- WARNING (trivial, Phase 10 owns): two placeholder strings dropped Spanish accents vs the contract — `CategoryAccordion.tsx:85` `"Sin problemas en esta categoria."` (contract: "categoría") and the deliberately-ASCII empty/error bodies (`informacion`, `auditoria`, `salio`). The contract itself uses ASCII in its copy table and flags final humanization as Phase 10 (COPY-01/02), so this does not lower the score.

### Pillar 2: Visuals (4/4)
- Strong, contract-faithful hierarchy: focal `ScoreGauge` number at `--font-size-5xl` (48px) Geist Mono weight 700, Khand UI titles, `CategoryCard` score at 24px mono, soft-tinted severity badges via `color-mix` @12%. Differentiation is by size + weight + color, not color alone.
- Icon discipline is correct: every decorative lucide icon is `aria-hidden` (`Badge.tsx:61`, `Button.tsx:82-87`, `CategoryAccordion.tsx:44`, `EmptyState.tsx:146`, `Field.tsx:95`, `ScoreGauge` circles), and text always carries meaning.
- WARNING (minor): the icon-only-button contract ("requires `aria-label` and 44×44") is documented in `Button.tsx:47` but not enforced at the type/runtime level — a consumer can ship an unlabeled icon-only button. Consider a dev-time invariant or a dedicated `IconButton` wrapper in Phase 10.
- Minor smell: `IssuesTable.module.css:132-134` colors the empty-state icon green by locally remapping `--text-muted: var(--success)` on the `.empty` subtree rather than passing an explicit color. It works (the chip reads `--text-muted`) and stays hex-free, but it is a fragile token-override; any future `--text-muted` content in that subtree would also turn green.

### Pillar 3: Color (3/4)
- Excellent token discipline: grep for `#[0-9a-fA-F]` and `rgb(` across all 8 components returns **zero** hardcoded colors. Every color is a semantic token (`var(--surface)`, `var(--critical)`, etc.); soft fills use `color-mix(in srgb, var(--token) 12%, transparent)` (Badge, Button destructive, EmptyState chip, Skeleton shimmer).
- DS-02 coherence upheld: ScoreGauge and CategoryCard share the identical `good→--success / needs_improvement→--warning / critical→--critical` map; severity axis stays separate from brand accent.
- Accent (10%) reservation respected: `--accent`/`--accent-hover`/`--accent-foreground` appear only on the primary Button fill; `--accent-text` only on inline/table links. Severity never substitutes accent.
- **WARNING → the score cap:** `IssuesTable.module.css:26` (`.scroll:focus-visible`) and `:117` (`.link:focus-visible`) use `outline: 2px solid var(--accent)` instead of `var(--ring)`. In dark theme these tokens are identical, so it hides in code review — but in light theme `--accent` (#c3f53c) is a low-contrast bright lime while `--ring` (#4d7c0f) was chosen specifically to hold focus visibility on light surfaces (tokens.css:189-193). This is the one genuine contract deviation (cross-cutting a11y contract mandates `--ring` on every focus ring) and the only inconsistency among the 6 components that otherwise all use `--ring`.

### Pillar 4: Typography (4/4)
- Role mapping matches the contract exactly. Khand (`--font-khand`) is used on UI titles only — `CategoryAccordion.module.css:40` (summary title, 20px/500) and `EmptyState.module.css:44` (state title, 20px/500). **Array is confirmed absent from all titles** (the only `Array` grep hit is `Array.from(...)` JS in `Skeleton.tsx:70`, not the font) — satisfies the locked UI-FEEDBACK.md brand rule.
- Geist Mono (`--font-geist-mono`) is correctly scoped to metrics: gauge number, `CategoryCard` score, `IssuesTable` mono cells, accordion `[checkId]` and the 2nd `<dl>` field ("Valor medido"), each with `font-feature-settings:"tnum" 1`.
- Geist Sans for all body/label/help text; sizes drawn from the token scale (`--font-size-xs/sm/base/xl`). Distinct sizes stay within the contract's role set.
- WARNING (minor): `CategoryAccordion.module.css:158` sets `font-size: 11px` raw for the `dt` field label. This is *contract-specified* (COMP-05 says "uppercase 11px"), but 11px does not exist on the Phase 8 token scale (smallest is `--font-size-xs` = 12px). It's a spec-sanctioned off-scale value, not an implementation error — noted for token-scale hygiene only.

### Pillar 5: Spacing (4/4)
- All padding, gap, and margin values reference `--space-*` tokens (grep confirms `var(--space-1..12)` throughout; no raw `p-`/`m-` arbitrary values — this is CSS Modules, not Tailwind).
- Non-token pixel values are all legitimate geometry, not spacing: interactive min-heights (36/44/48/52px), touch/icon chip sizes (56px, 40px), gauge dimensions (132/96px), table `min-width:640px`, `.dl` grid `minmax(220px)`, sr-only 1px clip, and outline offsets (1/2/-2px). None of these belong on the spacing scale.
- Card padding correctly steps `--space-4` (mobile) → `--space-5` (≥640px) per COMP-02; EmptyState uses `--space-10 --space-8`; accordion body `--space-5`; all match the Spacing Scale table.
- Note: the CategoryCard grid host (`repeat(auto-fit, minmax(170px,1fr))`, gap `--space-6`) is intentionally NOT in the component — it is the consuming screen's responsibility (Phase 10), consistent with the contract.

### Pillar 6: Experience Design (4/4)
- **State coverage is comprehensive** and matches each COMP contract:
  - Loading: `Button` `loading` → `Loader2` spinner + `aria-busy` + real `disabled` + label retained for width stability (`Button.tsx:64-89`); `Skeleton` with 6 variants.
  - Error: `EmptyState`/`ErrorState` `role="alert"` + critical chip; `Field` error `role="alert"` + `aria-invalid` + `aria-describedby` linkage + mandatory error text (`Field.tsx:93-104`).
  - Empty: `EmptyState` default copy; `IssuesTable` renders EmptyState when `rows.length === 0` (`IssuesTable.tsx:80`).
  - Null/"sin datos": ScoreGauge (track-only + `—` + "Score sin datos" aria-label) and CategoryCard both handle `null`.
  - Disabled: `Button:disabled` and `Input:disabled` use the real attribute + non-interactive styling.
- **Reduced-motion guards are present on every animation** (mandatory per contract): Button transition+spinner, Accordion chevron, Skeleton shimmer, Input/Card transitions, and ScoreGauge ships static with the guard stub. No unguarded motion found.
- Keyboard/semantics: native `<details>/<summary>` (accordion), real `<button type>`, real `<a>` links, real `<table>` with `<caption>`/`<th scope>`, and the horizontal scroll region is keyboard-reachable (`tabindex=0` + `role="region"` + `aria-label`, `IssuesTable.tsx:94-98`).
- Security hardening beyond contract: `IssuesTable.renderCell` only linkifies `http(s)://` values (blocks `javascript:`/`data:`); `EmptyState` action drops non-`/`, non-`http(s)` hrefs. Good.
- The `IssuesTable` focus-visibility issue (Pillar 3 finding) is also an a11y concern but is scored once, under Color.

---

## Registry Safety

Not applicable. `components.json` absent (NO_SHADCN confirmed); the contract's Registry Safety table declares no shadcn and no third-party code registries. `lucide-react` is an npm icon dependency (SVG inline, CSP-safe), not a code registry — no registry gate runs.

---

## Files Audited
- `apps/web/app/components/ui/ScoreGauge.tsx` + `.module.css` (COMP-01)
- `apps/web/app/components/ui/CategoryCard.tsx` + `.module.css` (COMP-02)
- `apps/web/app/components/ui/Badge.tsx` + `.module.css` (COMP-03)
- `apps/web/app/components/ui/IssuesTable.tsx` + `.module.css` (COMP-04)
- `apps/web/app/components/ui/CategoryAccordion.tsx` + `.module.css` (COMP-05)
- `apps/web/app/components/ui/Button.tsx` + `.module.css`, `Input.tsx` + `.module.css`, `Field.tsx` + `.module.css` (COMP-06)
- `apps/web/app/components/ui/EmptyState.tsx` + `.module.css` (COMP-07)
- `apps/web/app/components/ui/Skeleton.tsx` + `.module.css` (COMP-08)
- `apps/web/app/components/ui/labels.ts`, `url.ts` (shared helpers)
- `apps/web/app/tokens.css` (token source, Phase 8)
- Baselines: `09-UI-SPEC.md`, `09-CONTEXT.md`, `UI-FEEDBACK.md`
