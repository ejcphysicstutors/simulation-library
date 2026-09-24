"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAccess } from "@/lib/auth/session";
import { simulations as staticSimulations } from "@/lib/data/catalog";
import { adminDb } from "@/lib/firebase/admin";
import { makeAuditEvent } from "@/lib/admin/audit";
import {
  archiveManagedSimulation,
  deleteManagedSimulationPermanently,
  restoreManagedSimulation,
} from "@/lib/library/lifecycle";
import { getManagedSimulation } from "@/lib/library/managed";

function simulationId(formData: FormData): string {
  const value = String(formData.get("simulationId") ?? "").trim();
  if (!value) throw new Error("Simulation ID is missing.");
  return value;
}

function refresh(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/simulations");
  revalidatePath(`/admin/simulations/${id}/versions`);
  revalidatePath("/library");
  revalidatePath("/library/topic/[topicId]", "page");
  revalidatePath("/library/[slug]", "page");
}

async function createLegacyShadowRecord(id: string, adminEmail: string) {
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const legacy = staticSimulations.find((item) => item.id === id);
  if (!legacy) throw new Error("Legacy simulation was not found.");

  const now = new Date().toISOString();
  const ref = adminDb.collection("simulations").doc(id);
  const audit = makeAuditEvent("simulation.archive", adminEmail, id, {
    title: legacy.title,
    source: "legacy-baseline",
  });
  const batch = adminDb.batch();
  batch.set(ref, {
    slug: legacy.slug,
    title: legacy.title,
    description: legacy.description,
    ...(legacy.author ? { author: legacy.author } : {}),
    levels: legacy.levels,
    primaryTopicId: legacy.primaryTopicId,
    relatedTopicIds: legacy.relatedTopicIds,
    status: "archived",
    currentVersionId: "legacy-v1",
    currentVersionNumber: legacy.publishedVersion ?? 1,
    createdAt: now,
    updatedAt: now,
    createdBy: adminEmail,
    archivedAt: now,
    archivedBy: adminEmail,
  }, { merge: true });
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

export async function updateSimulationOwner(formData: FormData) {
  const session = await requireAdminAccess();
  const id = simulationId(formData);
  const ownerName = String(formData.get("ownerName") ?? "").trim().slice(0, 160);
  if (!ownerName) throw new Error("Owner / original creator name is required.");
  if (!adminDb) throw new Error("Firebase Admin is not configured.");

  const ref = adminDb.collection("simulations").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Managed simulation was not found.");

  await ref.update({
    author: ownerName,
    ownerUpdatedAt: new Date().toISOString(),
    ownerUpdatedBy: session.email,
  });

  refresh(id);
}

export async function archiveSimulation(formData: FormData) {
  const session = await requireAdminAccess();
  const id = simulationId(formData);
  const managed = await getManagedSimulation(id);

  if (managed) {
    await archiveManagedSimulation(id, session.email);
  } else {
    await createLegacyShadowRecord(id, session.email);
  }

  refresh(id);
}

export async function restoreSimulation(formData: FormData) {
  const session = await requireAdminAccess();
  const id = simulationId(formData);
  await restoreManagedSimulation(id, session.email);
  refresh(id);
}

export async function deleteSimulation(formData: FormData) {
  const session = await requireAdminAccess();
  const id = simulationId(formData);
  await deleteManagedSimulationPermanently(id, session.email);
  refresh(id);
  redirect("/admin/simulations");
}
