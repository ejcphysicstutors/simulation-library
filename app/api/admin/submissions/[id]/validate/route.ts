import { getAccessSession } from "@/lib/auth/session";
import { validateSubmissionRecord } from "@/lib/submissions/validate-record";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAccessSession();
  if (session?.kind !== "google" || session.role !== "admin") {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const validation = await validateSubmissionRecord(id);
    return Response.json({ ok: true, validation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation could not be run.";
    return Response.json({ error: message }, { status: 400 });
  }
}
