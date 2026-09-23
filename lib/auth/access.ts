import type { AccessRole } from "@/lib/data/types";

export type PrivilegedUserRecord = {
  email: string;
  role: Exclude<AccessRole, "student">;
  active: boolean;
};

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasStudentDomainAccess(email: string, domains: string[]): boolean {
  const normalised = normaliseEmail(email);
  return domains.some((domain) => normalised.endsWith(`@${domain.trim().toLowerCase()}`));
}

export function resolveRole(
  email: string,
  domains: string[],
  privileged?: PrivilegedUserRecord | null,
): AccessRole | null {
  if (privileged?.active && normaliseEmail(privileged.email) === normaliseEmail(email)) {
    return privileged.role;
  }

  return hasStudentDomainAccess(email, domains) ? "student" : null;
}
