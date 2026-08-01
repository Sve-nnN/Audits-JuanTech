import type { PageCheck } from "../../types";
import { titleCheck } from "./title";
import { metaDescriptionCheck } from "./metaDescription";
import { h1Check } from "./h1";
import { altTextCheck } from "./altText";
import { contentLengthCheck } from "./contentLength";
import { langCheck } from "./lang";
import { headingsCheck } from "./headings";

export const onPageChecks: PageCheck[] = [
  titleCheck,
  metaDescriptionCheck,
  h1Check,
  altTextCheck,
  contentLengthCheck,
  langCheck,
  headingsCheck,
];

export {
  titleCheck,
  metaDescriptionCheck,
  h1Check,
  altTextCheck,
  contentLengthCheck,
  langCheck,
  headingsCheck,
};
