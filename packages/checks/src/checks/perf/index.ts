import type { PageCheck } from "../../types";
import { responseTimeCheck } from "./responseTime";
import { htmlSizeCheck } from "./htmlSize";

export const perfPageChecks: PageCheck[] = [responseTimeCheck, htmlSizeCheck];

export { responseTimeCheck, htmlSizeCheck };
