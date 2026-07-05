import type { NetworkCheck } from "../../types";
import { brokenExternalLinksCheck } from "./brokenExternalLinks";
import { brokenResourcesCheck } from "./brokenResources";

export const networkChecks: NetworkCheck[] = [brokenExternalLinksCheck, brokenResourcesCheck];

export { brokenExternalLinksCheck, brokenResourcesCheck };
