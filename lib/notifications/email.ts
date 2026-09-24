import { adminDb } from "@/lib/firebase/admin";
import { getInitialAdminEmails } from "@/lib/auth/config";
import type { SubmissionRecord } from "@/lib/submissions/types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type EmailMessage = {
  to: string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

export type EmailDeliveryResult =
  | { sent: true; id?: string }
  | { sent: false; skipped?: boolean; error?: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const deployment = process.env.VERCEL_URL?.trim();
  if (deployment) return `https://${deployment.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "";
}

export function getEmailNotificationConfig() {
  return {
    configured: Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL),
    from: process.env.NOTIFICATION_FROM_EMAIL ?? "",
  };
}

async function sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!apiKey || !from || message.to.length === 0) return { sent: false, skipped: true };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: Array.from(new Set(message.to.map((email) => email.trim().toLowerCase()).filter(Boolean))),
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: { message?: string } };
    if (!response.ok) {
      const error = payload.error?.message || payload.message || `Email provider returned HTTP ${response.status}.`;
      console.error("Notification email failed", error);
      return { sent: false, error };
    }
    return { sent: true, id: payload.id };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Email request failed.";
    console.error("Notification email failed", error);
    return { sent: false, error: messageText };
  }
}

export async function listAdminNotificationEmails(): Promise<string[]> {
  const emails = new Set(getInitialAdminEmails());
  if (adminDb) {
    const snapshot = await adminDb.collection("access_users").get();
    for (const doc of snapshot.docs) {
      const data = doc.data() as { email?: string; role?: string; active?: boolean };
      if (data.active && data.role === "admin" && data.email) emails.add(data.email.trim().toLowerCase());
    }
  }
  return Array.from(emails).filter(Boolean).sort();
}

function submissionLabel(record: SubmissionRecord): string {
  return record.kind === "update" ? `Update: ${record.title}` : record.title;
}

export async function notifySubmissionReceived(record: SubmissionRecord) {
  const base = appBaseUrl();
  const reviewUrl = base ? `${base}/admin/submissions/${encodeURIComponent(record.submissionId)}` : "";
  const contributorName = record.contributorName?.trim() || "there";
  const title = escapeHtml(record.title);
  const filename = escapeHtml(record.originalFilename);

  const contributor = await sendEmail({
    to: [record.contributorEmail],
    subject: `Submission received: ${submissionLabel(record)}`,
    text: `Hi ${contributorName},\n\nWe received your simulation submission “${record.title}”. It has been uploaded and is now going through checks before admin review.\n\nFile: ${record.originalFilename}\n\nEJC Physics Simulation Library`,
    html: `<p>Hi ${escapeHtml(contributorName)},</p><p>We received your simulation submission <strong>${title}</strong>. It has been uploaded and is now going through checks before admin review.</p><p><strong>File:</strong> ${filename}</p><p>EJC Physics Simulation Library</p>`,
    idempotencyKey: `submission-received/${record.submissionId}`,
  });

  const admins = await listAdminNotificationEmails();
  const admin = await sendEmail({
    to: admins,
    subject: `Simulation awaiting review: ${submissionLabel(record)}`,
    text: `A simulation submission is ready for review.\n\nTitle: ${record.title}\nContributor: ${record.contributorName || record.contributorEmail}\n${reviewUrl ? `Review: ${reviewUrl}\n` : ""}`,
    html: `<p>A simulation submission is ready for review.</p><p><strong>${title}</strong><br>${escapeHtml(record.contributorName || record.contributorEmail)}</p>${reviewUrl ? `<p><a href="${escapeHtml(reviewUrl)}">Open review page</a></p>` : ""}`,
    idempotencyKey: `admin-new-submission/${record.submissionId}`,
  });

  return { contributor, admin };
}

export async function notifyChangesRequested(record: SubmissionRecord, note: string) {
  const base = appBaseUrl();
  const contributorUrl = base ? `${base}/contribute` : "";
  const contributorName = record.contributorName?.trim() || "there";
  const safeNote = escapeHtml(note || "Please review the submission and upload a corrected version.");
  return sendEmail({
    to: [record.contributorEmail],
    subject: `Changes requested: ${record.title}`,
    text: `Hi ${contributorName},\n\nChanges have been requested for “${record.title}”.\n\n${note || "Please review the submission and upload a corrected version."}\n${contributorUrl ? `\nOpen contributor portal: ${contributorUrl}` : ""}`,
    html: `<p>Hi ${escapeHtml(contributorName)},</p><p>Changes have been requested for <strong>${escapeHtml(record.title)}</strong>.</p><blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #147d7a;background:#f6faf9">${safeNote}</blockquote>${contributorUrl ? `<p><a href="${escapeHtml(contributorUrl)}">Open contributor portal</a></p>` : ""}`,
    idempotencyKey: `changes-requested/${record.submissionId}/${record.updatedAt}`,
  });
}

export async function notifyPublished(record: SubmissionRecord, slug: string) {
  const base = appBaseUrl();
  const simulationUrl = base ? `${base}/library/${encodeURIComponent(slug)}` : "";
  const contributorName = record.contributorName?.trim() || "there";
  return sendEmail({
    to: [record.contributorEmail],
    subject: `Published: ${record.title}`,
    text: `Hi ${contributorName},\n\nYour simulation “${record.title}” has been published in the EJC Physics Simulation Library.${simulationUrl ? `\n\nView it here: ${simulationUrl}` : ""}`,
    html: `<p>Hi ${escapeHtml(contributorName)},</p><p>Your simulation <strong>${escapeHtml(record.title)}</strong> has been published in the EJC Physics Simulation Library.</p>${simulationUrl ? `<p><a href="${escapeHtml(simulationUrl)}">View simulation</a></p>` : ""}`,
    idempotencyKey: `published/${record.submissionId}`,
  });
}
