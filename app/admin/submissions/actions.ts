"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { validateSubmissionRecord } from "@/lib/submissions/validate-record";

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

  await ref.update({
    status,
    adminNote: cleanNote(formData.get("adminNote")),
    reviewedBy: session.email,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath("/contribute");
}

export async function markNeedsChanges(formData: FormData) {
  return updateReview(formData, "needs-changes");
}

export async function approveSubmission(formData: FormData) {
  return updateReview(formData, "approved");
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
