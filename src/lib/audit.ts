/**
 * Sankofa — Audit logging
 * Logs actions to the AuditLog Prisma model for traceability.
 * Never throws — audit logging should never break the main flow.
 */

import { db } from "@/lib/db";

export async function logAudit(params: {
  anonymousId?: string;
  userId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        anonymousId: params.anonymousId,
        userId: params.userId,
        action: params.action,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (err) {
    console.error("[Audit] Failed to log:", err);
  }
}
