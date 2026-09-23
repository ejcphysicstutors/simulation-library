import type { SyllabusLevel } from "@/lib/data/types";

export type SubmissionKind = "new" | "update";
export type SubmissionStatus =
  | "uploading"
  | "uploaded"
  | "validating"
  | "needs-changes"
  | "awaiting-review"
  | "approved"
  | "published"
  | "rejected";

export type SubmissionMetadata = {
  submissionId: string;
  kind: SubmissionKind;
  existingSimulationId?: string;
  title: string;
  description: string;
  levels: SyllabusLevel[];
  primaryTopicId: string;
  relatedTopicIds: string[];
};

export type SubmissionRecord = SubmissionMetadata & {
  contributorEmail: string;
  contributorName?: string;
  status: SubmissionStatus;
  originalFilename: string;
  packageType: "html" | "zip";
  blobUrl?: string;
  blobDownloadUrl?: string;
  blobPathname?: string;
  blobContentType?: string;
  blobSize?: number;
  createdAt: string;
  updatedAt: string;
};
