import { strFromU8, unzipSync } from "fflate";

import { getAccessSession } from "@/lib/auth/session";
import { getPrivateBlobBytes } from "@/lib/submissions/blob";
import { getSubmissionRecord } from "@/lib/submissions/data";

export const dynamic = "force-dynamic";

function normalisePath(path: string): string {
  const stack: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!stack.length) return "__invalid__";
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join("/");
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

function contentType(path: string): string {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  return ({
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
  } as Record<string, string>)[ext] ?? "application/octet-stream";
}

function previewCsp(): string {
  return [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "connect-src https:",
    "media-src 'self' blob: data: https:",
    "worker-src blob:",
    "frame-src https:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) {
  const session = await getAccessSession();
  if (session?.kind !== "google" || session.role !== "admin") {
    return new Response("Admin access required.", { status: 403 });
  }

  const { id, path } = await params;
  const submission = await getSubmissionRecord(id);
  if (!submission || submission.packageType !== "zip" || !submission.blobPathname) {
    return new Response("Preview package not found.", { status: 404 });
  }

  const entrypoint = submission.validation?.entrypoint;
  if (!entrypoint) return new Response("Validated entry page is missing.", { status: 404 });

  const requested = normalisePath(path.join("/"));
  if (!requested || requested === "__invalid__") return new Response("Invalid preview path.", { status: 400 });

  try {
    const archiveBytes = await getPrivateBlobBytes(submission.blobPathname);
    const archive = unzipSync(archiveBytes) as Record<string, Uint8Array>;
    const normalisedArchive = new Map<string, Uint8Array>();
    for (const [rawPath, bytes] of Object.entries(archive)) {
      if (rawPath.endsWith("/")) continue;
      const clean = normalisePath(rawPath);
      if (clean && clean !== "__invalid__") normalisedArchive.set(clean, bytes);
    }

    const cleanEntry = normalisePath(entrypoint);
    if (!cleanEntry || cleanEntry === "__invalid__") return new Response("Invalid entry page.", { status: 400 });
    const root = dirname(cleanEntry);
    const sourcePath = normalisePath(root ? `${root}/${requested}` : requested);
    if (!sourcePath || sourcePath === "__invalid__") return new Response("Invalid preview path.", { status: 400 });

    const file = normalisedArchive.get(sourcePath);
    if (!file) return new Response("Preview asset not found.", { status: 404 });

    const type = contentType(sourcePath);
    const headers = new Headers({
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": previewCsp(),
    });

    if (type.startsWith("text/html")) {
      return new Response(strFromU8(file), { headers });
    }
    return new Response(Uint8Array.from(file).buffer as ArrayBuffer, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview could not be generated.";
    return new Response(message, { status: 400 });
  }
}
