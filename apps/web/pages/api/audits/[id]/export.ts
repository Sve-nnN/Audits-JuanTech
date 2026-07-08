import type { NextApiRequest, NextApiResponse } from "next";
import { buildReportModel } from "@auditor/report-model";
import { toPdf, toMarkdown, toPptx } from "@auditor/export";

// Deliberately a Pages Router API route (NOT App Router). App Router route
// handlers run under Next's `react-server` export condition, which loads
// React's RSC build (no client internals) process-wide — @react-pdf/renderer's
// bundled reconciler dereferences `.S` on those missing internals and crashes
// with "Cannot read properties of undefined (reading 'S')". `serverExternalPackages`
// does NOT fix this because `react` itself is server-conditioned, not just
// `@react-pdf/renderer`. Pages Router API routes run in a plain Node context
// without the `react-server` condition, so `react` resolves to its client
// build and @react-pdf renders correctly. See apps/web/next.config.ts for the
// (partial, insufficient on its own) serverExternalPackages entry.

/** Supported export formats and their download metadata. */
const FORMATS = {
  pdf: {
    ext: "pdf",
    contentType: "application/pdf",
  },
  md: {
    ext: "md",
    contentType: "text/markdown; charset=utf-8",
  },
  pptx: {
    ext: "pptx",
    contentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
} as const;

type ExportFormat = keyof typeof FORMATS;

function isFormat(value: unknown): value is ExportFormat {
  return value === "pdf" || value === "md" || value === "pptx";
}

/**
 * Sanitize an arbitrary id into a header/filesystem-safe filename segment.
 * Strips anything outside `[A-Za-z0-9._-]` so a crafted route param cannot
 * inject a quote/CR/LF into the `Content-Disposition` header value.
 */
function sanitizeFilenameSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "") || "id";
}

/** Sanitize the audited domain into a filesystem/header-safe filename token. */
function slugifyDomain(domain: string): string {
  return (
    domain
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sitio"
  );
}

// Binary export payloads (rendered PDFs/PPTX) can exceed the default Pages
// API response-size warning threshold; disable the size check for this route.
export const config = {
  api: {
    responseLimit: false,
  },
};

/**
 * GET /api/audits/[id]/export?format=pdf|md|pptx
 *
 * Reads the shared ReportModel (Plan 01) and streams the requested format via
 * the matching serializer (Plans 02/03) as an attachment. Access is by
 * `auditId` only — same free-tier visibility as the on-screen report — and the
 * response NEVER carries PII (the ReportModel excludes email/verification
 * token by construction).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const { id: rawId, format: rawFormat } = req.query;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const format = Array.isArray(rawFormat) ? rawFormat[0] : rawFormat;

  if (!id || !isFormat(format)) {
    res
      .status(400)
      .json({ error: "Invalid or missing format. Use ?format=pdf|md|pptx" });
    return;
  }

  const { ext, contentType } = FORMATS[format];

  // Everything that can throw at runtime — the model build (DB access) and the
  // serializers (font registration, @react-pdf/renderer render, pptxgenjs write)
  // — is wrapped so a failure yields a controlled 500 with a generic body (no
  // PII, no stack) plus a single server-side log line for diagnosis. The 400
  // (invalid format, before any DB access) and 404 (missing audit) paths stay
  // intact.
  let body: string | Uint8Array;
  let filename: string;
  try {
    const model = await buildReportModel(id);
    if (!model) {
      res.status(404).json({ error: "Audit not found" });
      return;
    }

    filename = `auditoria-${slugifyDomain(model.audit.domain)}-${sanitizeFilenameSegment(id)}.${ext}`;

    if (format === "md") {
      body = toMarkdown(model);
    } else if (format === "pdf") {
      body = await toPdf(model);
    } else {
      body = await toPptx(model);
    }
  } catch (err) {
    console.error(`export ${format} failed for audit ${id}:`, err);
    res.status(500).json({ error: "Export generation failed" });
    return;
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );
  res.status(200).send(typeof body === "string" ? body : Buffer.from(body));
}
