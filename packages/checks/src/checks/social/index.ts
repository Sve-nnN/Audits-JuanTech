import type { PageCheck } from "../../types";
import { ogTitleCheck } from "./ogTitle";
import { ogDescriptionCheck } from "./ogDescription";
import { ogImageCheck } from "./ogImage";
import { ogUrlCheck } from "./ogUrl";
import { ogTypeCheck } from "./ogType";
import { ogDuplicatesCheck } from "./ogDuplicates";

export const socialPageChecks: PageCheck[] = [
  ogTitleCheck,
  ogDescriptionCheck,
  ogImageCheck,
  ogUrlCheck,
  ogTypeCheck,
  ogDuplicatesCheck,
];

export { ogTitleCheck, ogDescriptionCheck, ogImageCheck, ogUrlCheck, ogTypeCheck, ogDuplicatesCheck };
