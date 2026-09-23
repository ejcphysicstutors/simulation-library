import { adminDb } from "@/lib/firebase/admin";
import { getPrivateBlobBytes } from "./blob";
import { getSubmissionRecord } from "./data";
import { validateSubmissionBytes } from "./validation";

export async function validateSubmissionRecord(submissionId: string) {
  if (!adminDb) throw new Error("Submission database is not configured.");
  const record = await getSubmissionRecord(submissionId);
  if (!record) throw new Error("Submission record was not found.");
  if (!record.blobPathname) throw new Error("Submission file path is missing.");

  const ref = adminDb.collection("submissions").doc(submissionId);
  await ref.update({ status: "validating", updatedAt: new Date().toISOString() });

  try {
    const bytes = await getPrivateBlobBytes(record.blobPathname);
    const validation = validateSubmissionBytes(record, bytes);
    const status = validation.errors > 0 ? "needs-changes" : "awaiting-review";
    await ref.update({ validation, status, updatedAt: new Date().toISOString() });
    return validation;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation failed unexpectedly.";
    const validation = {
      checkedAt: new Date().toISOString(),
      errors: 1,
      warnings: 0,
      infos: 0,
      passes: 0,
      checks: [{ code: "VALIDATION_FAILURE", label: "Validation", severity: "error" as const, message }],
    };
    await ref.update({ validation, status: "needs-changes", updatedAt: new Date().toISOString() });
    return validation;
  }
}
