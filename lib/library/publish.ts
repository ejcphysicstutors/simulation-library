import { put } from "@vercel/blob";
import { strFromU8, unzipSync } from "fflate";

import { simulations as staticSimulations } from "@/lib/data/catalog";
import { adminDb } from "@/lib/firebase/admin";
import { getPrivateBlobBytes } from "@/lib/submissions/blob";
import { getSubmissionRecord } from "@/lib/submissions/data";
import type { SubmissionRecord } from "@/lib/submissions/types";
import { getManagedSimulation, listManagedSimulations, listManagedVersions, type ManagedSimulation, type ManagedVersion, type PublishedFile } from "./managed";

const DAY_MS = 24 * 60 * 60 * 1000;

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "simulation";
}

function normalisePath(path: string): string {
  const stack: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!stack.length) throw new Error("Unsafe ZIP path detected."); stack.pop(); }
    else stack.push(part);
  }
  return stack.join("/");
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

function contentType(path: string): string {
  const ext = path.toLowerCase().split(".").pop();
  return ({ html:"text/html; charset=utf-8", htm:"text/html; charset=utf-8", css:"text/css; charset=utf-8", js:"text/javascript; charset=utf-8", mjs:"text/javascript; charset=utf-8", json:"application/json; charset=utf-8", svg:"image/svg+xml", png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", webp:"image/webp", ico:"image/x-icon", mp3:"audio/mpeg", wav:"audio/wav", mp4:"video/mp4" } as Record<string,string>)[ext || ""] || "application/octet-stream";
}

function packageFiles(record: SubmissionRecord, bytes: Uint8Array): { entrypoint: string; files: Array<{path:string; bytes:Uint8Array}> } {
  if (record.packageType === "html") return { entrypoint: "index.html", files: [{ path: "index.html", bytes }] };
  const archive = unzipSync(bytes) as Record<string, Uint8Array>;
  const entries = Object.entries(archive).filter(([path]) => !path.endsWith("/")).map(([path, file]) => ({ path: normalisePath(path), bytes: file }));
  const requested = record.validation?.entrypoint;
  if (!requested) throw new Error("Validated ZIP entry page is missing.");
  const entrypoint = normalisePath(requested);
  const root = dirname(entrypoint);
  const prefix = root ? `${root}/` : "";
  const withinRoot = entries.filter((item) => !prefix || item.path === entrypoint || item.path.startsWith(prefix));
  const files = withinRoot.map((item) => ({ path: prefix ? item.path.slice(prefix.length) : item.path, bytes: item.bytes })).filter((item) => item.path);
  if (!files.some((item) => item.path.toLowerCase() === "index.html")) throw new Error("Could not normalise the ZIP entry page to index.html.");
  return { entrypoint: "index.html", files };
}

async function uniqueSlug(title: string, simulationId?: string): Promise<string> {
  const base = slugify(title);
  const managed = await listManagedSimulations();
  const used = new Set([...staticSimulations.filter((x) => x.id !== simulationId).map((x) => x.slug), ...managed.filter((x) => x.id !== simulationId).map((x) => x.slug)]);
  if (!used.has(base)) return base;
  for (let n=2;n<1000;n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
  return `${base}-${Date.now()}`;
}

async function publishFiles(simulationId: string, versionNumber: number, files: Array<{path:string;bytes:Uint8Array}>): Promise<PublishedFile[]> {
  const out: PublishedFile[] = [];
  for (const file of files) {
    const target = `published/${simulationId}/v${versionNumber}/${file.path}`;
    const body = Uint8Array.from(file.bytes).buffer;
    const blob = await put(target, body, { access: "private", contentType: contentType(file.path), addRandomSuffix: false, allowOverwrite: true });
    out.push({ path: file.path, blobPathname: blob.pathname, contentType: blob.contentType || contentType(file.path), size: file.bytes.byteLength });
  }
  return out;
}

export async function publishSubmission(submissionId: string, adminEmail: string, note = "") {
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const submission = await getSubmissionRecord(submissionId);
  if (!submission) throw new Error("Submission was not found.");
  if (submission.status === "published") throw new Error("This submission is already published.");
  if (!submission.validation || submission.validation.errors > 0) throw new Error("Resolve validation errors before publishing.");
  if (!submission.blobPathname) throw new Error("Submission file is missing.");

  const now = new Date().toISOString();
  const simulationId = submission.kind === "update" ? submission.existingSimulationId! : `sim-${submission.submissionId}`;
  const existingManaged = await getManagedSimulation(simulationId);
  const existingStatic = staticSimulations.find((item) => item.id === simulationId);
  if (submission.kind === "update" && !existingManaged && !existingStatic) throw new Error("The simulation being updated no longer exists.");

  const existingVersions = await listManagedVersions(simulationId);
  const maxManagedVersion = existingVersions.reduce((max, item) => Math.max(max, item.versionNumber), 0);
  const baselineVersion = existingStatic?.publishedVersion ?? 0;
  const versionNumber = Math.max(maxManagedVersion, baselineVersion) + 1;
  const versionId = `v${versionNumber}`;
  const slug = existingManaged?.slug ?? existingStatic?.slug ?? await uniqueSlug(submission.title, simulationId);
  const bytes = await getPrivateBlobBytes(submission.blobPathname);
  const packaged = packageFiles(submission, bytes);
  const files = await publishFiles(simulationId, versionNumber, packaged.files);

  const version: ManagedVersion = {
    id: versionId,
    simulationId,
    versionNumber,
    submissionId,
    packageType: submission.packageType,
    entrypoint: packaged.entrypoint,
    files,
    publishedAt: now,
    publishedBy: adminEmail,
    title: submission.title,
    description: submission.description,
    author: submission.ownerName ?? existingManaged?.author ?? existingStatic?.author ?? submission.contributorName ?? submission.contributorEmail,
    levels: submission.levels,
    primaryTopicId: submission.primaryTopicId,
    relatedTopicIds: submission.relatedTopicIds,
    ...(note ? { note } : {}),
  };

  const simulation: ManagedSimulation = {
    id: simulationId,
    slug,
    title: submission.title,
    description: submission.description,
    author: submission.ownerName ?? existingManaged?.author ?? existingStatic?.author ?? submission.contributorName ?? submission.contributorEmail,
    levels: submission.levels,
    primaryTopicId: submission.primaryTopicId,
    relatedTopicIds: submission.relatedTopicIds,
    status: "published",
    currentVersionId: versionId,
    currentVersionNumber: versionNumber,
    createdAt: existingManaged?.createdAt ?? now,
    updatedAt: now,
    createdBy: existingManaged?.createdBy ?? submission.contributorEmail,
  };

  const batch = adminDb.batch();
  const simRef = adminDb.collection("simulations").doc(simulationId);
  batch.set(simRef, simulation);
  batch.set(simRef.collection("versions").doc(versionId), version);
  batch.update(adminDb.collection("submissions").doc(submissionId), {
    status: "published",
    reviewedBy: adminEmail,
    reviewedAt: now,
    publishedAt: now,
    publishedSimulationId: simulationId,
    publishedVersionId: versionId,
    stagingDeleteAfter: new Date(Date.now() + 7 * DAY_MS).toISOString(),
    adminNote: note,
    updatedAt: now,
  });
  await batch.commit();
  return { simulation, version };
}

export async function rollbackSimulation(simulationId: string, versionId: string, adminEmail: string) {
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const simulation = await getManagedSimulation(simulationId);
  if (!simulation) throw new Error("Managed simulation was not found.");
  const versionSnap = await adminDb.collection("simulations").doc(simulationId).collection("versions").doc(versionId).get();
  if (!versionSnap.exists) throw new Error("Version was not found.");
  const version = versionSnap.data() as ManagedVersion;
  const now = new Date().toISOString();
  await adminDb.collection("simulations").doc(simulationId).update({
    currentVersionId: version.id, currentVersionNumber: version.versionNumber,
    title: version.title, description: version.description,
    levels: version.levels, primaryTopicId: version.primaryTopicId, relatedTopicIds: version.relatedTopicIds,
    updatedAt: now, lastRollbackBy: adminEmail, lastRollbackAt: now,
  });
}

export async function rollbackToLegacyBaseline(simulationId: string, adminEmail: string) {
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const baseline = staticSimulations.find((item) => item.id === simulationId);
  const simulation = await getManagedSimulation(simulationId);
  if (!baseline || !simulation) throw new Error("Legacy baseline is not available.");
  const now = new Date().toISOString();
  await adminDb.collection("simulations").doc(simulationId).update({
    currentVersionId: "legacy-v1", currentVersionNumber: baseline.publishedVersion ?? 1,
    title: baseline.title, description: baseline.description,
    levels: baseline.levels, primaryTopicId: baseline.primaryTopicId, relatedTopicIds: baseline.relatedTopicIds,
    updatedAt: now, lastRollbackBy: adminEmail, lastRollbackAt: now,
  });
}
