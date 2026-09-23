import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { adminAuth } from "@/lib/firebase/admin";
import type { AccessRole } from "@/lib/data/types";
import { DEMO_SESSION_COOKIE, FIREBASE_SESSION_COOKIE } from "./config";
import { verifyDemoSessionToken } from "./demo-session";
import { resolveServerRole } from "./server-access";

export type AccessSession =
  | { kind: "google"; email: string; name?: string; role: AccessRole }
  | { kind: "demo"; role: "student" };

export async function getAccessSession(): Promise<AccessSession | null> {
  const cookieStore = await cookies();
  const firebaseCookie = cookieStore.get(FIREBASE_SESSION_COOKIE)?.value;

  if (firebaseCookie && adminAuth) {
    try {
      const decoded = await adminAuth.verifySessionCookie(firebaseCookie, true);
      const email = decoded.email?.toLowerCase();
      if (email && decoded.email_verified !== false) {
        const role = await resolveServerRole(email);
        if (role) return { kind: "google", email, name: decoded.name, role };
      }
    } catch {
      // Invalid/expired cookies are treated as signed out.
    }
  }

  const demoCookie = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  if (verifyDemoSessionToken(demoCookie)) return { kind: "demo", role: "student" };

  return null;
}

export async function requireStudentAccess(): Promise<AccessSession> {
  const session = await getAccessSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireContributorAccess(): Promise<Extract<AccessSession, { kind: "google" }>> {
  const session = await getAccessSession();
  if (!session) redirect("/login");
  if (session.kind !== "google" || (session.role !== "contributor" && session.role !== "admin")) {
    redirect("/library");
  }
  return session;
}

export async function requireAdminAccess(): Promise<Extract<AccessSession, { kind: "google" }>> {
  const session = await getAccessSession();
  if (!session) redirect("/login");
  if (session.kind !== "google" || session.role !== "admin") redirect("/library");
  return session;
}
