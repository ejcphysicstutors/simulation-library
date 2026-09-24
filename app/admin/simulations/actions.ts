"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAccess } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import {
  archiveManagedSimulation,
  deleteManagedSimulationPermanently,
  restoreManagedSimulation,
} from "@/lib/library/lifecycle";

function simulationId(formData: FormData): string {
  const value = String(formData.get("simulationId") ?? "").trim();
  if (!value) throw new Error("Simulation ID is missing.");
  return value;
}

function refresh(id: string) {
  revalidatePath("/admin/simulations");
  revalidatePath(`/admin/simulations/${id}/versions`);
  revalidatePath("/library");
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
  await archiveManagedSimulation(id, session.email);
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
