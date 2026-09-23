import { getAccessSession } from "@/lib/auth/session";
import { getPrivateBlobBytes } from "@/lib/submissions/blob";
import { getSubmissionRecord } from "@/lib/submissions/data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAccessSession();
  if (session?.kind !== "google" || session.role !== "admin") {
    return new Response("Admin access required.", { status: 403 });
  }

  const { id } = await params;
  const submission = await getSubmissionRecord(id);
  if (!submission?.blobPathname) return new Response("Submission not found.", { status: 404 });
  if (submission.packageType !== "html") return new Response("Preview is currently available for standalone HTML submissions only.", { status: 415 });

  const bytes = await getPrivateBlobBytes(submission.blobPathname);
  return new Response(bytes, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:; img-src data: blob: https:; font-src data: https:; connect-src https:; media-src blob: data: https:; worker-src blob:; frame-src https:; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
