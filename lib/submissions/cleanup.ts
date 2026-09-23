import { del } from "@vercel/blob";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase/admin";

export async function cleanupExpiredSubmissionFiles(now = new Date()) {
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const snapshot = await adminDb.collection("submissions").where("stagingDeleteAfter", "<=", now.toISOString()).limit(100).get();
  let deleted = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const pathname = typeof data.blobPathname === "string" ? data.blobPathname : "";
    if (!pathname) continue;
    try {
      await del(pathname);
      await doc.ref.update({
        blobPathname: FieldValue.delete(), blobUrl: FieldValue.delete(), blobDownloadUrl: FieldValue.delete(),
        stagingDeleteAfter: FieldValue.delete(), stagingDeletedAt: now.toISOString(), updatedAt: now.toISOString(),
      });
      deleted++;
    } catch (error) {
      console.error(`Could not clean submission blob ${doc.id}`, error);
    }
  }
  return { scanned: snapshot.size, deleted };
}
