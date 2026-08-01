import type { PageCheck } from "../../types";
import { responseTimeCheck } from "./responseTime";

export const perfPageChecks: PageCheck[] = [responseTimeCheck];

export { responseTimeCheck };
