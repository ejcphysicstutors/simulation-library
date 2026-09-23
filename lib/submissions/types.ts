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

export type ValidationSeverity = "pass" | "info" | "warning" | "error";

export type ValidationCheck = {
  code: string;
  label: string;
  severity: ValidationSeverity;
  message: string;
  details?: string[];
};

export type ValidationSummary = {
  checkedAt: string;
  errors: number;
  warnings: number;
  infos: number;
  passes: number;
  entrypoint?: string;
  checks: ValidationCheck[];
};

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
  validation?: ValidationSummary;
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};
