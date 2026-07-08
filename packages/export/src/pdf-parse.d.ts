/**
 * Minimal ambient types for the deep import `pdf-parse/lib/pdf-parse.js`
 * (used only in tests to extract text from generated PDFs). pdf-parse ships no
 * types and the deep entry avoids its main-module debug block.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  export default function pdfParse(
    data: Buffer | Uint8Array,
    options?: unknown
  ): Promise<PdfParseResult>;
}
