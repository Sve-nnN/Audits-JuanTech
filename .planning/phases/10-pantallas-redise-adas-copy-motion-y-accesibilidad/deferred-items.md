# Deferred Items — Phase 10

Out-of-scope discoveries logged during execution (not fixed here).

## From 10-05 (Report re-skin)

- **`apps/web/app/HomeClient.tsx` typecheck errors (TS2322, lines 182 & 248):**
  `Input` component is rendered with a `ref` prop but `InputProps` does not accept
  `ref` (needs `forwardRef`). This is SCREEN-01 (home) territory, owned by plan
  10-02, and was present in the working tree from a concurrent sibling agent — NOT
  caused by 10-05's changes. The 10-05 files (`audits/[id]/page.tsx`,
  `report.module.css`, `components/ui/CategoryAccordion.tsx`) are type-clean.
  Owner: whoever finishes the SCREEN-01/Input work must add `forwardRef` to `Input`.

## From 10-06 (Pages + Entity graph re-skin)

- **Same `apps/web/app/HomeClient.tsx` TS2322 errors (lines 182 & 248):** still
  present in the working tree from the concurrent SCREEN-01 sibling agent while
  10-06 ran. 10-06's scoped files (`audits/[id]/pages/page.tsx`,
  `pages/[pageId]/page.tsx`, `pages.module.css`, `components/EntityGraphSvg.tsx`,
  `EntityGraphSvg.module.css`) are all type-clean in isolation. Out of scope for
  10-06 — not fixed here.

## From 10-02 (Home SCREEN-01 re-skin)

- **RESOLVED here:** the earlier `HomeClient.tsx` TS2322 `ref`-on-`Input` errors
  (noted by 10-05/10-06 above) are gone. 10-02 rewrote `HomeClient.tsx` and moved
  step focus from an `Input` `ref` to `document.getElementById("email"|"url")`
  (Field injects the id), so no `forwardRef` change to `Input` is needed.
- **`apps/web/app/audits/[id]/page.tsx` — JSX error TS17002 (line 337, "Expected
  corresponding JSX closing tag for 'Reveal'"):** pre-existing in the working tree
  from a concurrent SCREEN-04 report agent (untracked `ScoreGaugeAnimated.tsx` is
  from the same WIP). NOT caused by 10-02 and OUT OF SCOPE (10-02 only touches
  `app/page.tsx`, `app/HomeClient.tsx`, `app/home.module.css`). This sibling error
  is the sole reason the app-wide `pnpm --filter @auditor/web typecheck` is red;
  10-02's three files are type-clean (no errors reported in any of them). Owner:
  the SCREEN-04/report plan (10-04/10-05) must close the unbalanced `<Reveal>` tag.
