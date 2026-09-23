"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAccess } from "@/lib/auth/session";
import { rollbackSimulation, rollbackToLegacyBaseline } from "@/lib/library/publish";

function refresh(simulationId: string) {
  revalidatePath(`/admin/simulations/${simulationId}/versions`);
  revalidatePath("/library");
}

export async function rollbackVersion(formData: FormData) {
  const session = await requireAdminAccess();
  const simulationId = String(formData.get("simulationId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  if (!simulationId || !versionId) throw new Error("Version details are missing.");
  await rollbackSimulation(simulationId, versionId, session.email);
  refresh(simulationId);
}

export async function rollbackLegacy(formData: FormData) {
  const session = await requireAdminAccess();
  const simulationId = String(formData.get("simulationId") ?? "");
  if (!simulationId) throw new Error("Simulation ID is missing.");
  await rollbackToLegacyBaseline(simulationId, session.email);
  refresh(simulationId);
}
