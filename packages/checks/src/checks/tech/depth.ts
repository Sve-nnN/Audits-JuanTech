import type { IssueDraft, SiteCheck } from "../../types";
import { siteFingerprint } from "../../util";

const CHECK_ID = "TECH-14";
const SCOPE = "depth-3-clicks";

/**
 * TECH-14: click-depth from home — a single aggregated issue reporting the
 * percentage of pages that require more than 3 clicks from the homepage to
 * reach, per `ctx.depthByUrl` (BFS shortest-path depth computed once by the
 * worker via `@auditor/graph`). Never reads `Page.depth`, which is always 0
 * on sitemap-seeded crawls.
 */
export const depthCheck: SiteCheck = {
  checkId: CHECK_ID,
  run({ depthByUrl }) {
    if (!depthByUrl || Object.keys(depthByUrl).length === 0) return [];

    const total = Object.keys(depthByUrl).length;
    const over = Object.values(depthByUrl).filter((d) => d > 3).length;
    const pct = Math.round((over / total) * 100);

    const issue: IssueDraft = {
      checkId: CHECK_ID,
      category: "tech",
      title: over > 0 ? "Páginas a más de 3 clics de home" : "Profundidad de clics saludable",
      severity: over > 0 ? "warning" : "ok",
      measuredValue: `${over}/${total} páginas a más de 3 clics de home (${pct}%)`,
      criterion: "Ninguna página debería requerir más de 3 clics desde la home para ser alcanzada",
      recommendation:
        over > 0
          ? "Acorta la ruta de clics a estas páginas: enlázalas desde secciones más cercanas a la home o revisa la arquitectura de navegación."
          : "Sin acción necesaria.",
      fingerprint: siteFingerprint(CHECK_ID, SCOPE),
      scope: SCOPE,
    };

    return [issue];
  },
};
