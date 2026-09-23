import { del } from "@vercel/blob";

import { adminDb } from "@/lib/firebase/admin";
import { getManagedSimulation, listManagedVersions } from "./managed";

async function deletePublishedBlobs(simulationId: string) {
  const versions = await listManagedVersions(simulationId);
  const pathnames = Array.from(
    new Set(versions.flatMap((version) => version.files.map((file) => file.blobPathname)).filter(Boolean)),
  );
  if (pathnames.length) {
    await del(pathnames);
  }
}

export async function archiveManagedSimulation(simulationId: string, adminEmail: string) {
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const simulation = await getManagedSimulation(simulationId);
  if (!simulation) throw new Error("Managed simulation was not found.");
  if (simulation.status === "archived") return;

  const now = new Date().toISOString();
  await adminDb.collection("simulations").doc(simulationId).update({
    status: "archived",
    updatedAt: now,
    archivedAt: now,
    archivedBy: adminEmail,
  });
}

export async function restoreManagedSimulation(simulationId: string, adminEmail: string) {
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const simulation = await getManagedSimulation(simulationId);
  if (!simulation) throw new Error("Managed simulation was not found.");
  if (simulation.status === "published") return;

  const now = new Date().toISOString();
  await adminDb.collection("simulations").doc(simulationId).update({
    status: "published",
    updatedAt: now,
    restoredAt: now,
    restoredBy: adminEmail,
  });
}

export async function deleteManagedSimulationPermanently(simulationId: string, adminEmail: string) {
  if (!adminDb) throw new Error("Firebase Admin is not configured.");
  const simulation = await getManagedSimulation(simulationId);
  if (!simulation) throw new Error("Managed simulation was not found.");

  // Delete immutable published files first. If Blob deletion fails, keep Firestore intact.
  await deletePublishedBlobs(simulationId);

  const simRef = adminDb.collection("simulations").doc(simulationId);
  const versions = await simRef.collection("versions").get();
  const batch = adminDb.batch();
  versions.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(simRef);

  // Preserve the submission audit trail but make it clear that the published simulation was removed.
  const linkedSubmissions = await adminDb.collection("submissions").where("publishedSimulationId", "==", simulationId).get();
  const now = new Date().toISOString();
  linkedSubmissions.docs.forEach((doc) => {
    batch.update(doc.ref, {
      publishedSimulationDeletedAt: now,
      publishedSimulationDeletedBy: adminEmail,
      updatedAt: now,
    });
  });

  await batch.commit();
}
