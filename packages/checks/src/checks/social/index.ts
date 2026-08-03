import type { PageCheck } from "../../types";
import { ogTitleCheck } from "./ogTitle";
import { ogDescriptionCheck } from "./ogDescription";
import { ogImageCheck } from "./ogImage";
import { ogUrlCheck } from "./ogUrl";
import { ogTypeCheck } from "./ogType";
import { ogDuplicatesCheck } from "./ogDuplicates";
import { twitterCardCheck } from "./twitterCard";
import { charsetCheck } from "./charset";

export const socialPageChecks: PageCheck[] = [
  ogTitleCheck,
  ogDescriptionCheck,
  ogImageCheck,
  ogUrlCheck,
  ogTypeCheck,
  ogDuplicatesCheck,
  twitterCardCheck,
  charsetCheck,
];

export {
  ogTitleCheck,
  ogDescriptionCheck,
  ogImageCheck,
  ogUrlCheck,
  ogTypeCheck,
  ogDuplicatesCheck,
  twitterCardCheck,
  charsetCheck,
};
