"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/lib/auth/session";
import { topics } from "@/lib/data/catalog";
import type { SyllabusLevel } from "@/lib/data/types";
import { adminDb } from "@/lib/firebase/admin";
import { publishSubmission } from "@/lib/library/publish";
import { notifyChangesRequested, notifyPublished } from "@/lib/notifications/email";
import { getSubmissionRecord } from "@/lib/submissions/data";
import { validateSubmissionRecord } from "@/lib/submissions/validate-record";

function cleanNote(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().slice(0, 1000);
}

function cleanText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function normaliseLevels(values: FormDataEntryValue[]): SyllabusLevel[] {
  const allowed = new Set<SyllabusLevel>(["H1", "H2", "H3"]);
  return Array.from(new Set(values.map(String).filter((value): value is SyllabusLevel => allowed.has(value as SyllabusLevel))));
}

function refreshSubmission(submissionId: string, simulationId?: string, slug?: string) {
  revalidatePath("/admin/submissions");
  revalidatePath(`/admin/submissions/${submissionId}`);
  revalidatePath("/admin/simulations");
  revalidatePath("/contribute");
  revalidatePath("/library");
  if (simulationId) revalidatePath(`/admin/simulations/${simulationId}/versions`);
  if (slug) revalidatePath(`/library/${slug}`);
}

export async function saveSubmissionMetadata(formData: FormData) {
  const session = await requireAdminAccess();
  if (!adminDb) throw new Error("Firebase Admin is not configured.");

  const submissionId = cleanText(formData.get("submissionId"), 100);
  if (!submissionId) throw new Error("Submission ID is missing.");

  const title = cleanText(formData.get("title"), 120);
  const description = cleanText(formData.get("description"), 900);
  const ownerName = cleanText(formData.get("ownerName"), 120);
  const levels = normaliseLevels(formData.getAll("levels"));
  const primaryTopicId = cleanText(formData.get("primaryTopicId"), 120);
  const relatedTopicIds = Array.from(new Set(formData.getAll("relatedTopicIds").map(String).filter(Boolean)))
    .filter((id) => id !== primaryTopicId)
    .slice(0, 5);

  if (title.length < 3) throw new Error("Title must contain at least 3 characters.");
  if (description.length < 20) throw new Error("Description must contain at least 20 characters.");
  if (!ownerName) throw new Error("Owner / original creator is required.");
  if (!levels.length) throw new Error("Select at least one syllabus level.");

  const primaryTopic = topics.find((topic) => topic.id === primaryTopicId);
  if (!primaryTopic) throw new Error("Choose a valid primary topic.");
  if (levels.some((level) => !primaryTopic.levels.includes(level))) {
    throw new Error(`The selected level does not match ${primaryTopic.name}.`);
  }
  if (relatedTopicIds.some((id) => !topics.some((topic) => topic.id === id))) {
    throw new Error("One or more related topics are invalid.");
  }

  const ref = adminDb.collection("submissions").doc(submissionId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Submission was not found.");
  const submission = snap.data() as {
    status?: string;
    publishedSimulationId?: string;
    publishedVersionId?: string;
  };

  const now = new Date().toISOString();
  const metadata = {
    title,
    description,
    ownerName,
    levels,
    primaryTopicId,
    relatedTopicIds,
    metadataEditedBy: session.email,
    metadataEditedAt: now,
    updatedAt: now,
  };

  await ref.update(metadata);

  let publishedSlug: string | undefined;
  if (submission.status === "published" && submission.publishedSimulationId) {
    const simulationRef = adminDb.collection("simulations").doc(submission.publishedSimulationId);
    const simSnap = await simulationRef.get();
    if (simSnap.exists) {
      const simData = simSnap.data() as { slug?: string; currentVersionId?: string };
      publishedSlug = simData.slug;
      await simulationRef.update({
        title,
        description,
        author: ownerName,
        levels,
        primaryTopicId,
        relatedTopicIds,
        ownerUpdatedBy: session.email,
        ownerUpdatedAt: now,
        metadataEditedBy: session.email,
        metadataEditedAt: now,
        updatedAt: now,
      });

      const versionId = submission.publishedVersionId || simData.currentVersionId;
      if (versionId && versionId !== "legacy-v1") {
        const versionRef = simulationRef.collection("versions").doc(versionId);
        const versionSnap = await versionRef.get();
        if (versionSnap.exists) {
          await versionRef.update({ title, description, author: ownerName, levels, primaryTopicId, relatedTopicIds });
        }
      }
    }
  }

  refreshSubmission(submissionId, submission.publishedSimulationId, publishedSlug);
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
  const adminNote = cleanNote(formData.get("adminNote"));
  await ref.update({
    status,
    adminNote,
    reviewedBy: session.email,
    reviewedAt: now.toISOString(),
    ...(status === "rejected" ? { stagingDeleteAfter: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() } : {}),
    updatedAt: now.toISOString(),
  });

  if (status === "needs-changes") {
    const record = await getSubmissionRecord(submissionId);
    if (record) {
      await notifyChangesRequested(record, adminNote).catch((error) => {
        console.error("Changes-requested notification failed", error);
      });
    }
  }
  refreshSubmission(submissionId);
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
  const record = await getSubmissionRecord(submissionId);
  if (record) {
    await notifyPublished(record, result.simulation.slug).catch((error) => {
      console.error("Published notification failed", error);
    });
  }
  refreshSubmission(submissionId, result.simulation.id, result.simulation.slug);
}

export async function rejectSubmission(formData: FormData) {
  return updateReview(formData, "rejected");
}

export async function rerunValidation(formData: FormData) {
  await requireAdminAccess();
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) throw new Error("Submission ID is missing.");
  await validateSubmissionRecord(submissionId);
  refreshSubmission(submissionId);
}
