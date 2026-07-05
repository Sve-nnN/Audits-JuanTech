/** Name of the BullMQ queue used for audit jobs. */
export const AUDIT_QUEUE = "audit" as const;

/**
 * Data payload for an audit job. Phase 1 keeps this to a no-op wiring test:
 * the worker looks up the Audit by id, transitions queued -> running -> done
 * (or -> failed on error), with no real crawl logic yet.
 */
export interface AuditJobData {
  auditId: string;
}

/** Job return value on success. */
export interface AuditJobResult {
  auditId: string;
  status: "done";
}
