import { getInitialAdminEmails } from "@/lib/auth/config";
import { adminDb } from "@/lib/firebase/admin";
import { listAllManagedSimulations } from "@/lib/library/managed";
import { listAllSubmissions } from "@/lib/submissions/data";
import { getEmailNotificationConfig, listAdminNotificationEmails } from "@/lib/notifications/email";

export async function getAdminDashboardData() {
  const [submissions, simulations, adminEmails] = await Promise.all([
    listAllSubmissions(),
    listAllManagedSimulations(),
    listAdminNotificationEmails(),
  ]);

  const accessRows: Array<{ email: string; role: "contributor" | "admin"; active: boolean }> = [];
  if (adminDb) {
    const access = await adminDb.collection("access_users").get();
    for (const doc of access.docs) {
      const data = doc.data() as Partial<{ email: string; role: "contributor" | "admin"; active: boolean }>;
      if (data.email && data.active && (data.role === "contributor" || data.role === "admin")) {
        accessRows.push({ email: data.email.toLowerCase(), role: data.role, active: true });
      }
    }
  }

  const bootstrapAdmins = new Set(getInitialAdminEmails());
  const admins = new Set([...adminEmails, ...bootstrapAdmins]);
  const contributors = new Set(
    accessRows.filter((row) => row.role === "contributor").map((row) => row.email),
  );

  const attentionStatuses = new Set(["awaiting-review", "needs-changes"]);
  const pendingReview = submissions.filter((item) => attentionStatuses.has(item.status));
  const validationFailures = submissions.filter(
    (item) => (item.validation?.errors ?? 0) > 0 && !["published", "rejected"].includes(item.status),
  );
  const archivedSubmissions = submissions.filter((item) => Boolean(item.archivedAt));
  const archivedSimulations = simulations.filter((item) => item.status === "archived");
  const liveManaged = simulations.filter((item) => item.status === "published");

  const now = Date.now();
  const cleanupScheduled = submissions.filter((item) => Boolean(item.stagingDeleteAfter));
  const cleanupDue = cleanupScheduled.filter((item) => {
    const at = item.stagingDeleteAfter ? Date.parse(item.stagingDeleteAfter) : Number.NaN;
    return Number.isFinite(at) && at <= now;
  });
  const cleanupCompleted = submissions.filter((item) => Boolean(item.stagingDeletedAt));

  const recentPublishes = submissions
    .filter((item) => item.status === "published" && item.publishedAt)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 6);

  return {
    submissions,
    simulations,
    pendingReview,
    validationFailures,
    archivedSubmissions,
    archivedSimulations,
    liveManaged,
    cleanupScheduled,
    cleanupDue,
    cleanupCompleted,
    recentPublishes,
    contributorCount: contributors.size,
    adminCount: admins.size,
    notificationConfig: getEmailNotificationConfig(),
  };
}
