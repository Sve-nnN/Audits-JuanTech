import type { PageCheck } from "../../types";
import { ogTitleCheck } from "./ogTitle";
import { ogDescriptionCheck } from "./ogDescription";
import { ogImageCheck } from "./ogImage";
import { ogTypeCheck } from "./ogType";

export const socialPageChecks: PageCheck[] = [
  ogTitleCheck,
  ogDescriptionCheck,
  ogImageCheck,
  ogTypeCheck,
];

export { ogTitleCheck, ogDescriptionCheck, ogImageCheck, ogTypeCheck };
