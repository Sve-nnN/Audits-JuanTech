import type { NetworkCheck } from "../../types";
import { brokenExternalLinksCheck } from "./brokenExternalLinks";
import { brokenResourcesCheck } from "./brokenResources";
import { ogImageNetworkCheck } from "./ogImageNetwork";

export const networkChecks: NetworkCheck[] = [
  brokenExternalLinksCheck,
  brokenResourcesCheck,
  ogImageNetworkCheck,
];

export { brokenExternalLinksCheck, brokenResourcesCheck, ogImageNetworkCheck };
