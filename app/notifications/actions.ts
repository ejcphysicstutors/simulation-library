"use server";

import { revalidatePath } from "next/cache";
import { getAccessSession } from "@/lib/auth/session";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/in-app";

async function requireGoogleUser() {
  const session = await getAccessSession();
  if (!session || session.kind !== "google" || (session.role !== "contributor" && session.role !== "admin")) {
    throw new Error("Contributor access is required to manage notifications.");
  }
  return session;
}

export async function markOneRead(formData: FormData) {
  const session = await requireGoogleUser();
  const notificationId = String(formData.get("notificationId") ?? "");
  if (notificationId) await markNotificationRead(notificationId, session.email);
  revalidatePath("/notifications");
  revalidatePath("/contribute");
  revalidatePath("/admin");
}

export async function markAllRead() {
  const session = await requireGoogleUser();
  await markAllNotificationsRead(session.email);
  revalidatePath("/notifications");
  revalidatePath("/contribute");
  revalidatePath("/admin");
}
