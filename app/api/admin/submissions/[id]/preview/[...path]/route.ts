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


function isExternalOrSpecialUrl(value: string): boolean {
  const trimmed = value.trim();
  return (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("//") ||
    /^(?:https?:|data:|blob:|mailto:|tel:|javascript:)/i.test(trimmed)
  );
}

function resolveArchiveAssetPath(currentSourcePath: string, reference: string): string | null {
  const cleanReference = reference.split("#", 1)[0].split("?", 1)[0];
  const baseDir = dirname(currentSourcePath);
  const candidate = cleanReference.startsWith("/")
    ? cleanReference.slice(1)
    : baseDir
      ? `${baseDir}/${cleanReference}`
      : cleanReference;
  const normalised = normalisePath(candidate);
  return !normalised || normalised === "__invalid__" ? null : normalised;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function rewriteCssUrls(css: string, cssSourcePath: string, archive: Map<string, Uint8Array>): string {
  return css.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/giu, (match, _quote: string, rawValue: string) => {
    const value = rawValue.trim();
    if (isExternalOrSpecialUrl(value)) return match;
    const assetPath = resolveArchiveAssetPath(cssSourcePath, value);
    if (!assetPath) return match;
    const asset = archive.get(assetPath);
    if (!asset) return match;
    return `url("data:${contentType(assetPath).split(";")[0]};base64,${bytesToBase64(asset)}")`;
  });
}

function inlineLocalAssets(html: string, htmlSourcePath: string, archive: Map<string, Uint8Array>): string {
  let output = html;

  // Inline local stylesheets, including local assets referenced from CSS via url(...).
  output = output.replace(/<link\b([^>]*?)\bhref=(['"])(.*?)\2([^>]*)>/giu, (match, before: string, _quote: string, href: string, after: string) => {
    if (isExternalOrSpecialUrl(href) || !/\brel\s*=\s*(['"]?)stylesheet\1/i.test(`${before} ${after}`)) return match;
    const cssPath = resolveArchiveAssetPath(htmlSourcePath, href);
    if (!cssPath) return match;
    const bytes = archive.get(cssPath);
    if (!bytes) return match;
    const css = rewriteCssUrls(strFromU8(bytes), cssPath, archive);
    return `<style data-preview-source="${cssPath.replace(/"/g, "&quot;")}">\n${css}\n</style>`;
  });

  // Inline local JavaScript files. Preserve other script attributes (e.g. type="module").
  output = output.replace(/<script\b([^>]*?)\bsrc=(['"])(.*?)\2([^>]*)>\s*<\/script>/giu, (match, before: string, _quote: string, src: string, after: string) => {
    if (isExternalOrSpecialUrl(src)) return match;
    const jsPath = resolveArchiveAssetPath(htmlSourcePath, src);
    if (!jsPath) return match;
    const bytes = archive.get(jsPath);
    if (!bytes) return match;
    const js = strFromU8(bytes).replace(/<\/script/giu, "<\\/script");
    return `<script${before}${after}>\n${js}\n</script>`;
  });

  // Inline common local media so the sandbox does not need authenticated follow-up requests.
  output = output.replace(/\b(src|poster)=(['"])(.*?)\2/giu, (match, attr: string, quote: string, value: string) => {
    if (isExternalOrSpecialUrl(value)) return match;
    const assetPath = resolveArchiveAssetPath(htmlSourcePath, value);
    if (!assetPath) return match;
    const bytes = archive.get(assetPath);
    if (!bytes) return match;
    const mime = contentType(assetPath).split(";")[0];
    return `${attr}=${quote}data:${mime};base64,${bytesToBase64(bytes)}${quote}`;
  });

  return output;
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
      const html = strFromU8(file);
      const selfContainedHtml = inlineLocalAssets(html, sourcePath, normalisedArchive);
      return new Response(selfContainedHtml, { headers });
    }
    return new Response(Uint8Array.from(file).buffer as ArrayBuffer, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview could not be generated.";
    return new Response(message, { status: 400 });
  }
}
