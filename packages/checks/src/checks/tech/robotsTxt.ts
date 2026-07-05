import type { SiteCheck } from "../../types";
import { siteFingerprint } from "../../util";

const CHECK_ID = "TECH-01";
const SCOPE = "robots.txt";

/** TECH-01: robots.txt accessibility and basic content sanity. */
export const robotsTxtCheck: SiteCheck = {
  checkId: CHECK_ID,
  run({ origin, robotsTxt }) {
    const url = `${origin}/robots.txt`;

    if (robotsTxt === null || robotsTxt === undefined) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "robots.txt no accesible",
          severity: "warning",
          measuredValue: "no encontrado o error al obtenerlo",
          source: url,
          criterion: "robots.txt debería existir y responder 200",
          recommendation:
            "Publica un archivo robots.txt accesible en la raíz del dominio, aunque sea permisivo, para controlar explícitamente el acceso de los crawlers.",
          fingerprint: siteFingerprint(CHECK_ID, SCOPE),
          scope: SCOPE,
        },
      ];
    }

    const trimmed = robotsTxt.trim();
    if (trimmed.length === 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "robots.txt vacío",
          severity: "warning",
          measuredValue: "0 bytes",
          source: url,
          criterion: "robots.txt debería declarar al menos una regla o directiva Sitemap",
          recommendation: "Agrega contenido a robots.txt: al menos un User-agent con reglas y, si corresponde, la directiva Sitemap.",
          fingerprint: siteFingerprint(CHECK_ID, SCOPE),
          scope: SCOPE,
        },
      ];
    }

    const hasSitemapDirective = /^sitemap:/im.test(trimmed);
    const hasUserAgent = /^user-agent:/im.test(trimmed);

    if (!hasUserAgent) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "robots.txt sin directivas User-agent",
          severity: "warning",
          measuredValue: `${trimmed.length} bytes, sin User-agent`,
          source: url,
          criterion: "robots.txt debería declarar al menos un User-agent",
          recommendation: "Agrega al menos una directiva User-agent con sus reglas correspondientes en robots.txt.",
          fingerprint: siteFingerprint(CHECK_ID, SCOPE),
          scope: SCOPE,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "tech",
        title: "robots.txt accesible y válido",
        severity: "ok",
        measuredValue: `${trimmed.length} bytes${hasSitemapDirective ? ", incluye Sitemap" : ""}`,
        source: url,
        criterion: "robots.txt debería existir, responder 200 y declarar reglas",
        recommendation: "Sin acción necesaria.",
        fingerprint: siteFingerprint(CHECK_ID, SCOPE),
        scope: SCOPE,
      },
    ];
  },
};
