import { issueSignedToken, presignUrl } from "@vercel/blob";

import { getAccessSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { inferPackageType, parseSubmissionMetadata, sanitiseFilename } from "@/lib/submissions/schema";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;

const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
];

type PrepareBody = {
  action: "prepare";
  metadata: unknown;
  originalFilename?: unknown;
  fileSize?: unknown;
  contentType?: unknown;
};

type CompleteBody = {
  action: "complete";
  submissionId?: unknown;
  pathname?: unknown;
};

type RequestBody = PrepareBody | CompleteBody;

type ContributorSession = Extract<
  NonNullable<Awaited<ReturnType<typeof getAccessSession>>>,
  { kind: "google" }
> & { role: "contributor" | "admin" };

function isContributorSession(
  session: Awaited<ReturnType<typeof getAccessSession>>,
): session is ContributorSession {
  return session?.kind === "google" && (session.role === "contributor" || session.role === "admin");
}

export async function POST(request: Request): Promise<Response> {
  const session = await getAccessSession();
  if (!isContributorSession(session)) {
    return Response.json({ error: "Contributor access required." }, { status: 403 });
  }
  if (!adminDb) {
    return Response.json({ error: "Submission database is not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as RequestBody;

    if (body.action === "prepare") {
      const metadata = parseSubmissionMetadata(body.metadata);
      const originalFilename = sanitiseFilename(String(body.originalFilename ?? ""));
      const packageType = inferPackageType(originalFilename);
      const fileSize = Number(body.fileSize ?? 0);
      const requestedContentType = String(body.contentType ?? "application/octet-stream");
      const contentType = ALLOWED_CONTENT_TYPES.includes(requestedContentType)
        ? requestedContentType
        : "application/octet-stream";

      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_UPLOAD_BYTES) {
        throw new Error("Simulation files must be 10 MB or smaller.");
      }

      const pathname = `submissions/${metadata.submissionId}/${originalFilename}`;
      const now = new Date().toISOString();

      await adminDb.collection("submissions").doc(metadata.submissionId).set({
        ...metadata,
        contributorEmail: session.email.toLowerCase(),
        contributorName: session.name ?? "",
        status: "uploading",
        originalFilename,
        packageType,
        blobSize: fileSize,
        blobPathname: pathname,
        blobContentType: contentType,
        createdAt: now,
        updatedAt: now,
      });

      const validUntil = Date.now() + UPLOAD_URL_TTL_MS;
      const token = await issueSignedToken({
        pathname,
        operations: ["put"],
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        validUntil,
      });
      const { presignedUrl } = await presignUrl(token, {
        pathname,
        operation: "put",
        validUntil,
      });

      return Response.json({
        submissionId: metadata.submissionId,
        pathname,
        presignedUrl,
        contentType,
      });
    }

    if (body.action === "complete") {
      const submissionId = String(body.submissionId ?? "");
      const pathname = String(body.pathname ?? "");
      if (!submissionId || !pathname) throw new Error("Upload completion details are missing.");

      const ref = adminDb.collection("submissions").doc(submissionId);
      const current = await ref.get();
      if (!current.exists) throw new Error("Submission record was not found.");

      const data = current.data();
      if (data?.contributorEmail !== session.email.toLowerCase()) {
        return Response.json({ error: "You cannot complete this submission." }, { status: 403 });
      }
      if (data?.blobPathname !== pathname) throw new Error("Upload path does not match the submission record.");

      await ref.update({
        status: "awaiting-review",
        updatedAt: new Date().toISOString(),
      });

      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown upload action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload could not be prepared.";
    return Response.json({ error: message }, { status: 400 });
  }
}
