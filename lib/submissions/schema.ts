import { simulations, topics } from "@/lib/data/catalog";
import type { SyllabusLevel } from "@/lib/data/types";
import type { SubmissionMetadata } from "./types";

const VALID_LEVELS = new Set<SyllabusLevel>(["H1", "H2", "H3"]);
const MAX_RELATED_TOPICS = 5;
const SUBMISSION_ID_PATTERN = /^[a-zA-Z0-9_-]{12,80}$/;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

export function parseSubmissionMetadata(input: unknown): SubmissionMetadata {
  if (!input || typeof input !== "object") throw new Error("Submission details are missing.");

  const raw = input as Record<string, unknown>;
  const submissionId = asString(raw.submissionId);
  const kind = asString(raw.kind);
  const existingSimulationId = asString(raw.existingSimulationId) || undefined;
  const title = asString(raw.title);
  const description = asString(raw.description);
  const levels = asStringArray(raw.levels).filter((level): level is SyllabusLevel => VALID_LEVELS.has(level as SyllabusLevel));
  const primaryTopicId = asString(raw.primaryTopicId);
  const relatedTopicIds = Array.from(new Set(asStringArray(raw.relatedTopicIds))).filter((id) => id !== primaryTopicId);

  if (!SUBMISSION_ID_PATTERN.test(submissionId)) throw new Error("Invalid submission ID.");
  if (kind !== "new" && kind !== "update") throw new Error("Choose whether this is a new simulation or an update.");
  if (kind === "update") {
    if (!existingSimulationId || !simulations.some((simulation) => simulation.id === existingSimulationId)) {
      throw new Error("Choose the existing simulation being updated.");
    }
  }
  if (title.length < 3 || title.length > 120) throw new Error("Title must be between 3 and 120 characters.");
  if (description.length < 20 || description.length > 900) throw new Error("Description must be between 20 and 900 characters.");
  if (levels.length === 0) throw new Error("Select at least one syllabus level.");

  const primaryTopic = topics.find((topic) => topic.id === primaryTopicId);
  if (!primaryTopic) throw new Error("Choose a valid primary topic.");
  if (levels.some((level) => !primaryTopic.levels.includes(level))) {
    throw new Error(`The selected level does not match ${primaryTopic.name}.`);
  }

  if (relatedTopicIds.length > MAX_RELATED_TOPICS) throw new Error(`Choose no more than ${MAX_RELATED_TOPICS} related topics.`);
  if (relatedTopicIds.some((id) => !topics.some((topic) => topic.id === id))) throw new Error("One or more related topics are invalid.");

  return {
    submissionId,
    kind,
    existingSimulationId,
    title,
    description,
    levels,
    primaryTopicId,
    relatedTopicIds,
  };
}

export function inferPackageType(filename: string): "html" | "zip" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".zip")) return "zip";
  throw new Error("Upload a standalone HTML file or a ZIP project.");
}

export function sanitiseFilename(filename: string): string {
  const cleaned = filename
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(-140);
  if (!cleaned) throw new Error("The uploaded filename is invalid.");
  return cleaned;
}
