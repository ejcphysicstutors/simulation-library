"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminAccess } from "@/lib/auth/session";
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
