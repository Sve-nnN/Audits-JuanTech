import type { SiteCheck } from "../../types";
import { siteFingerprint } from "../../util";

const CHECK_ID = "TECH-02";
const SCOPE = "sitemap.xml";

/** TECH-02: sitemap presence and URL count. */
export const sitemapCheck: SiteCheck = {
  checkId: CHECK_ID,
  run({ origin, sitemapUrls }) {
    const url = `${origin}/sitemap.xml`;

    if (sitemapUrls.length === 0) {
      return [
        {
          checkId: CHECK_ID,
          category: "tech",
          title: "Sin sitemap detectado",
          severity: "critical",
          measuredValue: "0 URLs",
          source: url,
          criterion: "El sitio debe publicar un sitemap.xml con las URLs indexables",
          recommendation: "Genera y publica un sitemap.xml (o sitemap index) con las URLs indexables del sitio, y declaralo en robots.txt.",
          fingerprint: siteFingerprint(CHECK_ID, SCOPE),
          scope: SCOPE,
        },
      ];
    }

    return [
      {
        checkId: CHECK_ID,
        category: "tech",
        title: "Sitemap presente",
        severity: "ok",
        measuredValue: `${sitemapUrls.length} URLs declaradas`,
        source: url,
        criterion: "El sitio debe publicar un sitemap.xml con las URLs indexables",
        recommendation: "Sin acción necesaria.",
        fingerprint: siteFingerprint(CHECK_ID, SCOPE),
        scope: SCOPE,
      },
    ];
  },
};
