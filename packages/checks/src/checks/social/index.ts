import type { PageCheck } from "../../types";
import { ogTitleCheck } from "./ogTitle";
import { ogDescriptionCheck } from "./ogDescription";

export const socialPageChecks: PageCheck[] = [ogTitleCheck, ogDescriptionCheck];

export { ogTitleCheck, ogDescriptionCheck };
