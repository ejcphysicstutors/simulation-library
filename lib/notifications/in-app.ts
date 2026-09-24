import { getInitialAdminEmails } from "@/lib/auth/config";
import { adminDb } from "@/lib/firebase/admin";
import type { SubmissionRecord } from "@/lib/submissions/types";

export type AppNotificationType =
  | "submission-received"
  | "admin-review"
  | "changes-requested"
  | "published";

export type AppNotification = {
  notificationId: string;
  userEmail: string;
  type: AppNotificationType;
  title: string;
  message: string;
  href: string;
  relatedSubmissionId?: string;
  createdAt: string;
  readAt?: string | null;
};

function safeId(value: string): string {
  return encodeURIComponent(value.toLowerCase()).replace(/%/g, "_");
}

async function listAdminEmails(): Promise<string[]> {
  const emails = new Set(getInitialAdminEmails());
  if (!adminDb) return Array.from(emails).sort();

  const snapshot = await adminDb.collection("access_users").get();
  for (const doc of snapshot.docs) {
    const data = doc.data() as { email?: string; role?: string; active?: boolean };
    if (data.active && data.role === "admin" && data.email) {
      emails.add(data.email.trim().toLowerCase());
    }
  }
  return Array.from(emails).filter(Boolean).sort();
}

async function putNotification(notification: AppNotification) {
  if (!adminDb) return;
  await adminDb.collection("notifications").doc(notification.notificationId).set(notification, { merge: true });
}

export async function notifySubmissionReceivedInApp(record: SubmissionRecord) {
  const now = new Date().toISOString();
  await putNotification({
    notificationId: `submission-received__${record.submissionId}__${safeId(record.contributorEmail)}`,
    userEmail: record.contributorEmail.toLowerCase(),
    type: "submission-received",
    title: "Submission received",
    message: `“${record.title}” was uploaded successfully and is ready for review.`,
    href: "/contribute",
    relatedSubmissionId: record.submissionId,
    createdAt: now,
    readAt: null,
  });

  const admins = await listAdminEmails();
  await Promise.all(
    admins.map((email) =>
      putNotification({
        notificationId: `admin-review__${record.submissionId}__${safeId(email)}`,
        userEmail: email,
        type: "admin-review",
        title: "New simulation to review",
        message: `${record.title} was submitted by ${record.contributorName || record.contributorEmail}.`,
        href: `/admin/submissions/${encodeURIComponent(record.submissionId)}`,
        relatedSubmissionId: record.submissionId,
        createdAt: now,
        readAt: null,
      }),
    ),
  );
}

export async function notifyChangesRequestedInApp(record: SubmissionRecord, note: string) {
  const now = new Date().toISOString();
  await putNotification({
    notificationId: `changes-requested__${record.submissionId}__${safeId(record.updatedAt || now)}__${safeId(record.contributorEmail)}`,
    userEmail: record.contributorEmail.toLowerCase(),
    type: "changes-requested",
    title: "Changes requested",
    message: note?.trim() || `Please review the requested changes for “${record.title}”.`,
    href: "/contribute",
    relatedSubmissionId: record.submissionId,
    createdAt: now,
    readAt: null,
  });
}

export async function notifyPublishedInApp(record: SubmissionRecord, slug: string) {
  const now = new Date().toISOString();
  await putNotification({
    notificationId: `published__${record.submissionId}__${safeId(record.contributorEmail)}`,
    userEmail: record.contributorEmail.toLowerCase(),
    type: "published",
    title: "Simulation published",
    message: `“${record.title}” is now live in the simulation library.`,
    href: `/library/${encodeURIComponent(slug)}`,
    relatedSubmissionId: record.submissionId,
    createdAt: now,
    readAt: null,
  });
}

export async function listNotificationsForUser(email: string, limit = 30): Promise<AppNotification[]> {
  if (!adminDb) return [];
  const snapshot = await adminDb.collection("notifications").where("userEmail", "==", email.toLowerCase()).get();
  return snapshot.docs
    .map((doc) => doc.data() as AppNotification)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function countUnreadNotifications(email: string): Promise<number> {
  const notifications = await listNotificationsForUser(email, 100);
  return notifications.filter((item) => !item.readAt).length;
}

export async function markNotificationRead(notificationId: string, email: string) {
  if (!adminDb) return;
  const ref = adminDb.collection("notifications").doc(notificationId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  const data = snapshot.data() as Partial<AppNotification>;
  if (data.userEmail?.toLowerCase() !== email.toLowerCase()) return;
  await ref.update({ readAt: new Date().toISOString() });
}

export async function markAllNotificationsRead(email: string) {
  if (!adminDb) return;
  const snapshot = await adminDb.collection("notifications").where("userEmail", "==", email.toLowerCase()).get();
  const unread = snapshot.docs.filter((doc) => !(doc.data() as Partial<AppNotification>).readAt);
  if (!unread.length) return;
  const batch = adminDb.batch();
  const readAt = new Date().toISOString();
  unread.forEach((doc) => batch.update(doc.ref, { readAt }));
  await batch.commit();
}
