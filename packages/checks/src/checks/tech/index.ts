import type { PageCheck, SiteCheck } from "../../types";
import { httpStatusCheck } from "./httpStatus";
import { canonicalCheck } from "./canonical";
import { canonicalDeep } from "./canonicalDeep";
import { indexabilityCheck } from "./indexability";
import { redirectsCheck } from "./redirects";
import { viewportCheck } from "./viewport";
import { mixedContentCheck } from "./mixedContent";
import { robotsTxtCheck } from "./robotsTxt";
import { sitemapCheck } from "./sitemap";
import { duplicateContentCheck } from "./duplicateContent";
import { orphanPagesCheck } from "./orphanPages";
import { hreflangCheck } from "./hreflang";

export const techPageChecks: PageCheck[] = [
  httpStatusCheck,
  canonicalCheck,
  indexabilityCheck,
  redirectsCheck,
  viewportCheck,
  mixedContentCheck,
];

export const techSiteChecks: SiteCheck[] = [
  robotsTxtCheck,
  sitemapCheck,
  duplicateContentCheck,
  orphanPagesCheck,
  hreflangCheck,
  canonicalDeep,
];

export {
  httpStatusCheck,
  canonicalCheck,
  canonicalDeep,
  indexabilityCheck,
  redirectsCheck,
  viewportCheck,
  mixedContentCheck,
  robotsTxtCheck,
  sitemapCheck,
  duplicateContentCheck,
  orphanPagesCheck,
  hreflangCheck,
};
