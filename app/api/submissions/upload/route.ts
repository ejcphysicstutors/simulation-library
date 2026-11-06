import { del, issueSignedToken, list, presignUrl } from "@vercel/blob";
import { FieldValue } from "firebase-admin/firestore";

import { getAccessSession } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { getLibrarySimulations } from "@/lib/library/managed";
import { notifySubmissionReceivedInApp } from "@/lib/notifications/in-app";
import { getSubmissionRecord } from "@/lib/submissions/data";
import { inferPackageType, parseSubmissionMetadata, sanitiseFilename } from "@/lib/submissions/schema";
import type { SubmissionMetadata, SubmissionRecord } from "@/lib/submissions/types";
import { validateSubmissionRecord } from "@/lib/submissions/validate-record";

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
  revisionSubmissionId?: unknown;
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

type PendingRevision = {
  metadata: SubmissionMetadata;
  originalFilename: string;
  packageType: "html" | "zip";
  blobSize: number;
  blobPathname: string;
  blobContentType: string;
  preparedAt: string;
  revisionNumber: number;
};

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

      const revisionSubmissionId = String(body.revisionSubmissionId ?? "").trim();
      const now = new Date().toISOString();
      let pathname: string;

      if (revisionSubmissionId) {
        if (revisionSubmissionId !== metadata.submissionId) throw new Error("Revision submission ID does not match.");
        const ref = adminDb.collection("submissions").doc(revisionSubmissionId);
        const snapshot = await ref.get();
        if (!snapshot.exists) throw new Error("The submission being revised was not found.");
        const current = snapshot.data() as SubmissionRecord;
        if (current.contributorEmail.toLowerCase() !== session.email.toLowerCase()) {
          return Response.json({ error: "You can only revise your own submission." }, { status: 403 });
        }
        if (current.status !== "needs-changes" && current.status !== "rejected") {
          throw new Error("Only submissions marked Changes needed or Not accepted can be revised here.");
        }
        if (current.kind !== metadata.kind || current.existingSimulationId !== metadata.existingSimulationId) {
          throw new Error("The submission type cannot be changed during a revision.");
        }

        const revisionNumber = (current.revisionNumber ?? 0) + 1;
        const revisionToken = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
        pathname = `submissions/${metadata.submissionId}/revisions/${revisionToken}-${originalFilename}`;
        const pendingRevision: PendingRevision = {
          metadata,
          originalFilename,
          packageType,
          blobSize: fileSize,
          blobPathname: pathname,
          blobContentType: contentType,
          preparedAt: now,
          revisionNumber,
        };
        await ref.update({ pendingRevision, updatedAt: now });
      } else {
        pathname = `submissions/${metadata.submissionId}/${originalFilename}`;
        try {
          await adminDb.collection("submissions").doc(metadata.submissionId).create({
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
        } catch (error) {
          const code = (error as { code?: number | string } | null)?.code;
          if (code === 6 || code === "already-exists") {
            return Response.json({ error: "That submission ID already exists." }, { status: 409 });
          }
          throw error;
        }
      }

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

      return Response.json({ submissionId: metadata.submissionId, pathname, presignedUrl, contentType });
    }

    if (body.action === "complete") {
      const submissionId = String(body.submissionId ?? "");
      const pathname = String(body.pathname ?? "");
      if (!submissionId || !pathname) throw new Error("Upload completion details are missing.");

      const ref = adminDb.collection("submissions").doc(submissionId);
      const current = await ref.get();
      if (!current.exists) throw new Error("Submission record was not found.");

      const data = current.data() as SubmissionRecord & { pendingRevision?: PendingRevision };
      if (data.contributorEmail !== session.email.toLowerCase()) {
        return Response.json({ error: "You cannot complete this submission." }, { status: 403 });
      }

      const pending = data.pendingRevision;
      const isRevision = Boolean(pending && pending.blobPathname === pathname);
      if (!isRevision && data.blobPathname !== pathname) throw new Error("Upload path does not match the submission record.");

      const prefix = pathname.includes("/") ? pathname.slice(0, pathname.lastIndexOf("/") + 1) : pathname;
      const uploaded = await list({ prefix, limit: 20 });
      const blob = uploaded.blobs.find((item) => item.pathname === pathname);
      if (!blob) {
        throw new Error("The browser reported a successful upload, but the file was not found in private storage. Please try submitting it again.");
      }

      const now = new Date().toISOString();
      let oldBlobPathname = "";
      if (isRevision && pending) {
        oldBlobPathname = data.blobPathname ?? "";
        const previousHistory = Array.isArray(data.reviewHistory) ? data.reviewHistory : [];
        const reviewHistory = (data.status === "needs-changes" || data.status === "rejected")
          ? [...previousHistory, {
              status: data.status,
              ...(data.adminNote ? { note: data.adminNote } : {}),
              ...(data.reviewedBy ? { reviewedBy: data.reviewedBy } : {}),
              ...(data.reviewedAt ? { reviewedAt: data.reviewedAt } : {}),
            }]
          : previousHistory;

        await ref.update({
          ...pending.metadata,
          originalFilename: pending.originalFilename,
          packageType: pending.packageType,
          blobPathname: blob.pathname,
          blobUrl: blob.url,
          blobDownloadUrl: blob.downloadUrl,
          blobSize: blob.size,
          blobContentType: pending.blobContentType,
          revisionNumber: pending.revisionNumber,
          resubmittedAt: now,
          reviewHistory,
          status: "uploaded",
          validation: FieldValue.delete(),
          adminNote: FieldValue.delete(),
          reviewedBy: FieldValue.delete(),
          reviewedAt: FieldValue.delete(),
          stagingDeleteAfter: FieldValue.delete(),
          stagingDeletedAt: FieldValue.delete(),
          pendingRevision: FieldValue.delete(),
          updatedAt: now,
        });
      } else {
        await ref.update({
          status: "uploaded",
          blobPathname: blob.pathname,
          blobUrl: blob.url,
          blobDownloadUrl: blob.downloadUrl,
          blobSize: blob.size,
          updatedAt: now,
        });
      }

      const validation = await validateSubmissionRecord(submissionId);
      if (oldBlobPathname && oldBlobPathname !== blob.pathname) {
        await del(oldBlobPathname).catch((error) => console.error("Could not delete superseded submission upload", error));
      }
      const completedRecord = await getSubmissionRecord(submissionId);
      if (completedRecord) {
        await notifySubmissionReceivedInApp(completedRecord).catch((error) => {
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
