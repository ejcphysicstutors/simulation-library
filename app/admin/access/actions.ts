"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";

import { normaliseEmail } from "@/lib/auth/access";
import { getInitialAdminEmails } from "@/lib/auth/config";
import { requireAdminAccess } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";

export async function upsertAccessUser(formData: FormData) {
  const session = await requireAdminAccess();
  if (!adminDb) throw new Error("Firebase Admin is not configured.");

  const email = normaliseEmail(String(formData.get("email") || ""));
  const role = String(formData.get("role") || "");
  if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
  if (role !== "contributor" && role !== "admin") throw new Error("Choose a valid access role.");

  const ref = adminDb.collection("access_users").doc(email);
  const existing = await ref.get();
  await ref.set(
    {
      email,
      role,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.email,
      ...(!existing.exists ? {
        createdAt: FieldValue.serverTimestamp(),
        createdBy: session.email,
      } : {}),
    },
    { merge: true },
  );
  revalidatePath("/admin/access");
}

export async function removeAccessUser(formData: FormData) {
  const session = await requireAdminAccess();
  if (!adminDb) throw new Error("Firebase Admin is not configured.");

  const email = normaliseEmail(String(formData.get("email") || ""));
  if (!email || email === session.email) throw new Error("You cannot remove your own active admin access here.");
  if (getInitialAdminEmails().includes(email)) {
    throw new Error("Bootstrap admins must be removed from INITIAL_ADMIN_EMAILS, then the deployment must be restarted.");
  }

  await adminDb.collection("access_users").doc(email).set(
    {
      email,
      active: false,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: session.email,
    },
    { merge: true },
  );
  revalidatePath("/admin/access");
}
