import type { PageCheck } from "../../types";
import { ogTitleCheck } from "./ogTitle";
import { ogDescriptionCheck } from "./ogDescription";
import { ogTypeCheck } from "./ogType";

export const socialPageChecks: PageCheck[] = [ogTitleCheck, ogDescriptionCheck, ogTypeCheck];

export { ogTitleCheck, ogDescriptionCheck, ogTypeCheck };
