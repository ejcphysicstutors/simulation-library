import { issueSignedToken, list, presignUrl } from "@vercel/blob";

import { getAccessSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { inferPackageType, parseSubmissionMetadata, sanitiseFilename } from "@/lib/submissions/schema";
import { validateSubmissionRecord } from "@/lib/submissions/validate-record";
import { getLibrarySimulations } from "@/lib/library/managed";
import { notifySubmissionReceived } from "@/lib/notifications/email";
import { getSubmissionRecord } from "@/lib/submissions/data";

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
      const parsedMetadata = parseSubmissionMetadata(body.metadata);
      const metadata = { ...parsedMetadata, ownerName: parsedMetadata.ownerName || session.name || session.email };
      if (metadata.kind === "update") {
        const available = await getLibrarySimulations();
        if (!available.some((item) => item.id === metadata.existingSimulationId)) {
          throw new Error("Choose a valid existing simulation to update.");
        }
      }
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
        access: "private",
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

      const prefix = `submissions/${submissionId}/`;
      const uploaded = await list({ prefix, limit: 20 });
      const files = uploaded.blobs.filter((blob) => !blob.pathname.endsWith("/"));
      if (files.length === 0) {
        throw new Error("The browser reported a successful upload, but the file was not found in private storage. Please try submitting it again.");
      }

      const expectedName = String(data?.originalFilename ?? "").toLowerCase();
      const blob =
        files.find((item) => item.pathname.split("/").pop()?.toLowerCase() === expectedName) ??
        (files.length === 1 ? files[0] : undefined);

      if (!blob) {
        throw new Error("More than one file was found for this submission and the uploaded file could not be identified safely.");
      }

      await ref.update({
        status: "uploaded",
        blobPathname: blob.pathname,
        blobUrl: blob.url,
        blobDownloadUrl: blob.downloadUrl,
        blobSize: blob.size,
        updatedAt: new Date().toISOString(),
      });

      const validation = await validateSubmissionRecord(submissionId);
      const completedRecord = await getSubmissionRecord(submissionId);
      if (completedRecord) {
        await notifySubmissionReceived(completedRecord).catch((error) => {
          console.error("Submission notification failed", error);
        });
      }
      return Response.json({ ok: true, validation });
    }

    return Response.json({ error: "Unknown upload action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload could not be prepared.";
    return Response.json({ error: message }, { status: 400 });
  }
}
