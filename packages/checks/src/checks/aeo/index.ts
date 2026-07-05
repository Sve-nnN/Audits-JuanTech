import type { NetworkCheck, PageCheck, SiteCheck } from "../../types";
import { aiCrawlersCheck } from "./aiCrawlers";
import { llmsTxtCheck } from "./llmsTxt";
import { aiStructuredDataCheck } from "./aiStructuredData";
import { contentFormatCheck } from "./contentFormat";

export const aeoPageChecks: PageCheck[] = [aiStructuredDataCheck, contentFormatCheck];
export const aeoSiteChecks: SiteCheck[] = [aiCrawlersCheck];
export const aeoNetworkChecks: NetworkCheck[] = [llmsTxtCheck];

export { aiCrawlersCheck, llmsTxtCheck, aiStructuredDataCheck, contentFormatCheck };
