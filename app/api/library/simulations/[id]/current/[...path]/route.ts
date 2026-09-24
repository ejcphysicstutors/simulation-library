import { get } from "@vercel/blob";
import { getManagedSimulation, getManagedVersion } from "@/lib/library/managed";

function safePath(parts: string[]): string {
  const clean = parts.map((part) => decodeURIComponent(part)).filter(Boolean);
  if (clean.some((part) => part === "." || part === ".." || part.includes("\\"))) throw new Error("Invalid path.");
  return clean.join("/");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  try {
    const { id, path } = await params;
    const simulation = await getManagedSimulation(id);
    if (!simulation || simulation.status !== "published") return new Response("Not found", { status: 404 });
    const version = await getManagedVersion(id, simulation.currentVersionId);
    if (!version) return new Response("Not found", { status: 404 });
    const requested = safePath(path?.length ? path : [version.entrypoint]);
    const file = version.files.find((item) => item.path === requested) ?? (requested === "index.html" ? version.files.find((item) => item.path === version.entrypoint) : undefined);
    if (!file) return new Response("Not found", { status: 404 });
    const result = await get(file.blobPathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return new Response("Not found", { status: 404 });
    const headers = new Headers({ "Content-Type": file.contentType, "Cache-Control": "private, max-age=60" });
    if (file.contentType.startsWith("text/html")) {
      headers.set("Content-Security-Policy", "default-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src data: https:; connect-src https:; media-src 'self' blob: data: https:; worker-src blob:; frame-src https:; base-uri 'none'; form-action 'none'");
      headers.set("X-Content-Type-Options", "nosniff");
    }
    return new Response(result.stream, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
