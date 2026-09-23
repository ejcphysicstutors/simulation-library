import { adminDb } from "@/lib/firebase/admin";
import type { SubmissionRecord } from "./types";

export async function listContributorSubmissions(email: string): Promise<SubmissionRecord[]> {
  if (!adminDb) return [];
  const snapshot = await adminDb.collection("submissions").where("contributorEmail", "==", email.toLowerCase()).get();
  return snapshot.docs
    .map((doc) => doc.data() as SubmissionRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSubmissionRecord(id: string): Promise<SubmissionRecord | null> {
  if (!adminDb) return null;
  const snapshot = await adminDb.collection("submissions").doc(id).get();
  return snapshot.exists ? (snapshot.data() as SubmissionRecord) : null;
}
