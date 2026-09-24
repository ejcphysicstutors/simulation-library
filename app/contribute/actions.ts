"use server";

import { revalidatePath } from "next/cache";

import { requireContributorAccess } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import type { SubmissionRecord } from "@/lib/submissions/types";

async function updateArchiveState(formData: FormData, archived: boolean) {
  const session = await requireContributorAccess();
  if (!adminDb) throw new Error("Firestore is not available.");

  const submissionId = String(formData.get("submissionId") ?? "").trim();
  if (!submissionId) throw new Error("Submission ID is required.");

  const ref = adminDb.collection("submissions").doc(submissionId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("Submission not found.");

  const submission = snapshot.data() as SubmissionRecord;
  if (submission.contributorEmail.toLowerCase() !== session.email.toLowerCase()) {
    throw new Error("You can only archive your own submission records.");
  }

  if (archived) {
    await ref.update({
      archivedAt: new Date().toISOString(),
      archivedBy: session.email.toLowerCase(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    await ref.update({
      archivedAt: null,
      archivedBy: null,
      updatedAt: new Date().toISOString(),
    });
  }

  revalidatePath("/contribute");
}

export async function archiveSubmission(formData: FormData) {
  await updateArchiveState(formData, true);
}

export async function restoreSubmission(formData: FormData) {
  await updateArchiveState(formData, false);
}
