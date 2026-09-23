import { adminDb } from "@/lib/firebase/admin";
import type { AccessRole } from "@/lib/data/types";
import { getInitialAdminEmails, getStudentDomains } from "./config";
import { hasStudentDomainAccess, normaliseEmail } from "./access";

export type AccessRecord = {
  email: string;
  role: "contributor" | "admin";
  active: boolean;
  createdAt?: string;
  createdBy?: string;
};

export async function getPrivilegedAccessRecord(email: string): Promise<AccessRecord | null> {
  const normalised = normaliseEmail(email);

  if (getInitialAdminEmails().includes(normalised)) {
    return { email: normalised, role: "admin", active: true, createdBy: "environment" };
  }

  if (!adminDb) return null;

  const snapshot = await adminDb.collection("access_users").doc(normalised).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data() as Partial<AccessRecord> | undefined;
  if (!data || !data.active || (data.role !== "contributor" && data.role !== "admin")) return null;

  return {
    email: normalised,
    role: data.role,
    active: true,
    createdAt: data.createdAt,
    createdBy: data.createdBy,
  };
}

export async function resolveServerRole(email: string): Promise<AccessRole | null> {
  const privileged = await getPrivilegedAccessRecord(email);
  if (privileged?.active) return privileged.role;

  return hasStudentDomainAccess(email, getStudentDomains()) ? "student" : null;
}
