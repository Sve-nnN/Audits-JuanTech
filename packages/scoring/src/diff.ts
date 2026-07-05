export type DiffStatus = "new" | "persistent" | "resolved";

/** Minimal shape `diffIssues` needs from an Issue row. */
export interface DiffableIssue {
  fingerprint: string;
}

export interface DiffResult {
  /** Status for each CURRENT issue, keyed by fingerprint: 'new' or 'persistent'. */
  statusByFingerprint: Map<string, "new" | "persistent">;
  /** Fingerprints present in the previous audit but absent from the current one. */
  resolved: string[];
}

/**
 * Diffs two audits' issue sets by fingerprint (DIFF-01/02).
 *
 * - A current issue whose fingerprint also existed in `previous` is
 *   `persistent` (still there since the last audit).
 * - A current issue whose fingerprint is new is `new`.
 * - A fingerprint present in `previous` but missing from `current` is
 *   `resolved` (fixed since the last audit).
 *
 * Pure and deterministic — no DB access, so it can run either in the worker
 * (persisting `Issue.diffStatus`) or at request time in the report endpoint.
 */
export function diffIssues(current: DiffableIssue[], previous: DiffableIssue[]): DiffResult {
  const previousFingerprints = new Set(previous.map((issue) => issue.fingerprint));
  const currentFingerprints = new Set<string>();

  const statusByFingerprint = new Map<string, "new" | "persistent">();
  for (const issue of current) {
    currentFingerprints.add(issue.fingerprint);
    statusByFingerprint.set(
      issue.fingerprint,
      previousFingerprints.has(issue.fingerprint) ? "persistent" : "new"
    );
  }

  const resolved = [...previousFingerprints].filter((fp) => !currentFingerprints.has(fp));

  return { statusByFingerprint, resolved };
}
