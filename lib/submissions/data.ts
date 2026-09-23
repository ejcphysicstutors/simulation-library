import { adminDb } from "@/lib/firebase/admin";
import type { SubmissionRecord } from "./types";

function sortNewestFirst(records: SubmissionRecord[]): SubmissionRecord[] {
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listContributorSubmissions(email: string): Promise<SubmissionRecord[]> {
  if (!adminDb) return [];
  const snapshot = await adminDb.collection("submissions").where("contributorEmail", "==", email.toLowerCase()).get();
  return sortNewestFirst(snapshot.docs.map((doc) => doc.data() as SubmissionRecord));
}

export async function listAllSubmissions(): Promise<SubmissionRecord[]> {
  if (!adminDb) return [];
  const snapshot = await adminDb.collection("submissions").get();
  return sortNewestFirst(snapshot.docs.map((doc) => doc.data() as SubmissionRecord));
}

export async function getSubmissionRecord(id: string): Promise<SubmissionRecord | null> {
  if (!adminDb) return null;
  const snapshot = await adminDb.collection("submissions").doc(id).get();
  return snapshot.exists ? (snapshot.data() as SubmissionRecord) : null;
}
