import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { getAccessSession, type AccessSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { inferPackageType, parseSubmissionMetadata, sanitiseFilename } from "@/lib/submissions/schema";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type ClientPayload = {
  metadata: unknown;
  originalFilename?: unknown;
  fileSize?: unknown;
};

type GoogleAccessSession = Extract<AccessSession, { kind: "google" }>;

function isContributorSession(session: AccessSession | null): session is GoogleAccessSession {
  return session?.kind === "google" && (session.role === "contributor" || session.role === "admin");
}

export async function POST(request: Request): Promise<Response> {
  const session = await getAccessSession();
  if (!isContributorSession(session)) return Response.json({ error: "Contributor access required." }, { status: 403 });
  if (!adminDb) return Response.json({ error: "Submission database is not configured." }, { status: 503 });

  const body = (await request.json()) as HandleUploadBody;

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const currentSession = await getAccessSession();
        if (!isContributorSession(currentSession)) throw new Error("Contributor access required.");

        const payload = JSON.parse(clientPayload ?? "{}") as ClientPayload;
        const metadata = parseSubmissionMetadata(payload.metadata);
        const originalFilename = sanitiseFilename(String(payload.originalFilename ?? ""));
        const packageType = inferPackageType(originalFilename);
        const fileSize = Number(payload.fileSize ?? 0);

        if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
          throw new Error("Simulation files must be 10 MB or smaller.");
        }

        const expectedPathname = `submissions/${metadata.submissionId}/${originalFilename}`;
        if (pathname !== expectedPathname) throw new Error("Invalid upload path.");

        const now = new Date().toISOString();
        await adminDb!.collection("submissions").doc(metadata.submissionId).set({
          ...metadata,
          contributorEmail: currentSession.email.toLowerCase(),
          contributorName: currentSession.name ?? "",
          status: "uploading",
          originalFilename,
          packageType,
          blobSize: fileSize,
          createdAt: now,
          updatedAt: now,
        });

        return {
          allowedContentTypes: [
            "text/html",
            "application/zip",
            "application/x-zip-compressed",
            "application/octet-stream",
          ],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({
            submissionId: metadata.submissionId,
            contributorEmail: currentSession.email.toLowerCase(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const token = JSON.parse(tokenPayload ?? "{}") as { submissionId?: string; contributorEmail?: string };
        if (!token.submissionId || !token.contributorEmail) return;

        const ref = adminDb!.collection("submissions").doc(token.submissionId);
        const current = await ref.get();
        if (!current.exists || current.data()?.contributorEmail !== token.contributorEmail) return;

        await ref.update({
          status: "awaiting-review",
          blobUrl: blob.url,
          blobDownloadUrl: blob.downloadUrl,
          blobPathname: blob.pathname,
          blobContentType: blob.contentType,
          updatedAt: new Date().toISOString(),
        });
      },
    });

    return Response.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload could not be prepared.";
    return Response.json({ error: message }, { status: 400 });
  }
}
