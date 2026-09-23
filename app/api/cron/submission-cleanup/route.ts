import { cleanupExpiredSubmissionFiles } from "@/lib/submissions/cleanup";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await cleanupExpiredSubmissionFiles();
  return Response.json({ ok: true, ...result });
}
