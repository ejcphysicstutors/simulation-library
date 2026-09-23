"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { validateSubmissionRecord } from "@/lib/submissions/validate-record";
import { publishSubmission } from "@/lib/library/publish";

function cleanNote(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().slice(0, 1000);
}

async function updateReview(formData: FormData, status: "needs-changes" | "approved" | "rejected") {
  const session = await requireAdminAccess();
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) throw new Error("Submission ID is missing.");

  const ref = adminDb.collection("submissions").doc(submissionId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Submission was not found.");

  const now = new Date();
  await ref.update({
    status,
    adminNote: cleanNote(formData.get("adminNote")),
    reviewedBy: session.email,
    reviewedAt: now.toISOString(),
    ...(status === "rejected" ? { stagingDeleteAfter: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() } : {}),
    updatedAt: now.toISOString(),
  });
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath("/contribute");
}

export async function markNeedsChanges(formData: FormData) {
  return updateReview(formData, "needs-changes");
}

export async function approveSubmission(formData: FormData) {
  const session = await requireAdminAccess();
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) throw new Error("Submission ID is missing.");
  const note = cleanNote(formData.get("adminNote"));
  const result = await publishSubmission(submissionId, session.email, note);
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath(`/admin/simulations/${result.simulation.id}/versions`);
  revalidatePath("/contribute");
  revalidatePath("/library");
  revalidatePath(`/library/${result.simulation.slug}`);
}

export async function rejectSubmission(formData: FormData) {
  return updateReview(formData, "rejected");
}

export async function rerunValidation(formData: FormData) {
  await requireAdminAccess();
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) throw new Error("Submission ID is missing.");
  await validateSubmissionRecord(submissionId);
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
}
