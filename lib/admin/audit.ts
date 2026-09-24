import { adminDb } from "@/lib/firebase/admin";

export type AdminAuditAction =
  | "simulation.publish"
  | "simulation.rollback"
  | "simulation.rollback_legacy"
  | "simulation.archive"
  | "simulation.restore"
  | "simulation.delete";

export function makeAuditEvent(
  action: AdminAuditAction,
  actorEmail: string,
  targetId: string,
  details: Record<string, unknown> = {},
) {
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const ref = adminDb.collection("audit_events").doc();
  return {
    ref,
    data: {
      action,
      actorEmail: actorEmail.toLowerCase(),
      targetId,
      details,
      createdAt: new Date().toISOString(),
    },
  };
}
