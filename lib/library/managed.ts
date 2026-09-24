import { adminDb } from "@/lib/firebase/admin";
import { simulations as staticSimulations } from "@/lib/data/catalog";
import type { SimulationSummary, SyllabusLevel } from "@/lib/data/types";

export type PublishedFile = {
  path: string;
  blobPathname: string;
  contentType: string;
  size: number;
};

export type ManagedVersion = {
  id: string;
  simulationId: string;
  versionNumber: number;
  submissionId: string;
  packageType: "html" | "zip";
  entrypoint: string;
  files: PublishedFile[];
  publishedAt: string;
  publishedBy: string;
  note?: string;
  title: string;
  description: string;
  author?: string;
  levels: SyllabusLevel[];
  primaryTopicId: string;
  relatedTopicIds: string[];
};

export type ManagedSimulation = {
  id: string;
  slug: string;
  title: string;
  description: string;
  author?: string;
  levels: SyllabusLevel[];
  primaryTopicId: string;
  relatedTopicIds: string[];
  status: "published" | "archived";
  currentVersionId: string;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  archivedAt?: string;
  archivedBy?: string;
  restoredAt?: string;
  restoredBy?: string;
  ownerUpdatedAt?: string;
  ownerUpdatedBy?: string;
};

function toSummary(record: ManagedSimulation): SimulationSummary {
  const legacyBaseline = staticSimulations.find((item) => item.id === record.id);
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    author: record.author,
    levels: record.levels,
    primaryTopicId: record.primaryTopicId,
    relatedTopicIds: record.relatedTopicIds,
    status: record.status,
    migrationStatus: "ready",
    publishedVersion: record.currentVersionNumber,
    managed: true,
    currentVersionId: record.currentVersionId,
    ...(legacyBaseline?.migrationCredit ? { migrationCredit: legacyBaseline.migrationCredit } : {}),
    contentPath: `/api/library/simulations/${record.id}/current/index.html`,
  };
}

export async function listAllManagedSimulations(): Promise<ManagedSimulation[]> {
  if (!adminDb) return [];
  const snapshot = await adminDb.collection("simulations").get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ManagedSimulation, "id">) }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listManagedSimulations(): Promise<ManagedSimulation[]> {
  const records = await listAllManagedSimulations();
  return records.filter((record) => record.status === "published");
}

export async function getManagedSimulation(id: string): Promise<ManagedSimulation | null> {
  if (!adminDb) return null;
  const snap = await adminDb.collection("simulations").doc(id).get();
  return snap.exists ? (snap.data() as ManagedSimulation) : null;
}

export async function getManagedVersion(simulationId: string, versionId: string): Promise<ManagedVersion | null> {
  if (!adminDb) return null;
  const snap = await adminDb.collection("simulations").doc(simulationId).collection("versions").doc(versionId).get();
  return snap.exists ? (snap.data() as ManagedVersion) : null;
}

export async function listManagedVersions(simulationId: string): Promise<ManagedVersion[]> {
  if (!adminDb) return [];
  const snap = await adminDb.collection("simulations").doc(simulationId).collection("versions").get();
  return snap.docs.map((doc) => doc.data() as ManagedVersion).sort((a, b) => b.versionNumber - a.versionNumber);
}

export async function getLibrarySimulations(): Promise<SimulationSummary[]> {
  const managed = await listManagedSimulations();
  const managedById = new Map(managed.map((record) => [record.id, record]));
  const merged = staticSimulations.map((item) => {
    const record = managedById.get(item.id);
    if (!record || record.currentVersionId === "legacy-v1") return item;
    return toSummary(record);
  });
  const staticIds = new Set(staticSimulations.map((item) => item.id));
  for (const record of managed) if (!staticIds.has(record.id)) merged.push(toSummary(record));
  return merged.filter((item) => item.status === "published");
}

export async function getLibrarySimulationBySlug(slug: string): Promise<SimulationSummary | null> {
  const all = await getLibrarySimulations();
  return all.find((item) => item.slug === slug) ?? null;
}
