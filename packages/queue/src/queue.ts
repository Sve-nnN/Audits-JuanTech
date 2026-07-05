import { Queue, type QueueOptions } from "bullmq";
import { createRedisConnection } from "./connection";
import { AUDIT_QUEUE, type AuditJobData, type AuditJobResult } from "./types";

let auditQueue: Queue<AuditJobData, AuditJobResult> | undefined;

const defaultQueueOptions: Omit<QueueOptions, "connection"> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
    removeOnComplete: {
      count: 1_000,
    },
    removeOnFail: {
      count: 5_000,
    },
  },
};

/**
 * Returns a singleton BullMQ Queue for audit jobs. Safe to call repeatedly
 * (e.g. from Next.js API routes) — reuses one Queue/connection per process.
 */
export function getAuditQueue(): Queue<AuditJobData, AuditJobResult> {
  if (!auditQueue) {
    auditQueue = new Queue<AuditJobData, AuditJobResult>(AUDIT_QUEUE, {
      connection: createRedisConnection(),
      ...defaultQueueOptions,
    });
  }
  return auditQueue;
}
