import { strFromU8, unzipSync } from "fflate";

import type { SubmissionRecord, ValidationCheck, ValidationSummary } from "./types";

const TEXT_EXTENSIONS = new Set([".html", ".htm", ".css", ".js", ".mjs", ".json", ".txt", ".svg"]);
const MAX_ZIP_FILES = 400;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;

function extname(path: string): string {
  const slash = path.lastIndexOf("/");
  const dot = path.lastIndexOf(".");
  return dot > slash ? path.slice(dot).toLowerCase() : "";
}

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

function resolveRelative(baseFile: string, reference: string): string {
  const clean = reference.split(/[?#]/)[0];
  if (!clean) return "";
  const base = dirname(baseFile);
  return normalisePath(`${base}/${clean}`);
}

function isExternalReference(value: string): boolean {
  return /^(?:[a-z]+:|\/\/|#|data:|blob:|mailto:|tel:)/i.test(value.trim());
}

function extractLocalReferences(html: string): string[] {
  const refs: string[] = [];
  const pattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const value = match[1].trim();
    if (value && !isExternalReference(value)) refs.push(value);
  }
  return refs;
}

function extractExternalHosts(html: string): string[] {
  const hosts = new Set<string>();
  const pattern = /\b(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    try {
      hosts.add(new URL(match[1]).hostname);
    } catch {
      // Ignore malformed URLs here; browser validation can catch them later.
    }
  }
  return [...hosts].sort();
}

function duplicateIds(html: string): string[] {
  const counts = new Map<string, number>();
  const pattern = /\bid\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id).sort();
}

function hasMathRenderer(html: string): boolean {
  return /mathjax|katex/i.test(html);
}

function hasLikelyRawLatex(html: string): boolean {
  const withoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "");
  return /\$[^$\n]{1,120}\$|\\\([^)]{1,160}\\\)|\\\[[\s\S]{1,220}?\\\]/.test(withoutScripts);
}

function suspiciousEncodingExamples(html: string): string[] {
  const visible = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  const examples = new Set<string>();
  if (visible.includes("�")) examples.add("Unicode replacement character (�) detected");
  const suspiciousPatterns = [
    /m\/s\?/g,
    /10\?{2,}/g,
    /\b[EDvp]\s*\?\s*[BbE]?\b/g,
    /\?[xpt]\b/g,
    /\btheta\s*\?/gi,
  ];
  for (const pattern of suspiciousPatterns) {
    const matches = visible.match(pattern) ?? [];
    matches.slice(0, 3).forEach((item) => examples.add(item.trim()));
  }
  return [...examples].slice(0, 5);
}

function htmlChecks(html: string, entrypoint: string, availablePaths: Set<string> | null): ValidationCheck[] {
  const checks: ValidationCheck[] = [];

  checks.push({
    code: "HTML_DOCUMENT",
    label: "HTML document",
    severity: /<html\b/i.test(html) && /<body\b/i.test(html) ? "pass" : "warning",
    message: /<html\b/i.test(html) && /<body\b/i.test(html)
      ? "A complete HTML document was detected."
      : "The entry file does not look like a complete HTML document.",
  });

  const duplicates = duplicateIds(html);
  checks.push({
    code: "DUPLICATE_IDS",
    label: "Element IDs",
    severity: duplicates.length ? "warning" : "pass",
    message: duplicates.length ? `${duplicates.length} duplicated element ID${duplicates.length === 1 ? "" : "s"} detected.` : "No duplicate element IDs detected.",
    ...(duplicates.length ? { details: duplicates.slice(0, 12) } : {}),
  });

  const localRefs = extractLocalReferences(html);
  const missing = availablePaths
    ? localRefs.map((ref) => resolveRelative(entrypoint, ref)).filter((path) => path && path !== "__invalid__" && !availablePaths.has(path))
    : localRefs;
  checks.push({
    code: "LOCAL_ASSETS",
    label: "Local assets",
    severity: missing.length ? "error" : "pass",
    message: missing.length
      ? `${missing.length} referenced local asset${missing.length === 1 ? " is" : "s are"} missing.`
      : availablePaths ? "All referenced local assets were found in the package." : "No external local files are required.",
    ...(missing.length ? { details: [...new Set(missing)].slice(0, 15) } : {}),
  });

  const hosts = extractExternalHosts(html);
  checks.push({
    code: "EXTERNAL_DEPENDENCIES",
    label: "External dependencies",
    severity: hosts.length ? "info" : "pass",
    message: hosts.length ? `${hosts.length} external host${hosts.length === 1 ? "" : "s"} referenced.` : "No external CDN or web dependencies detected.",
    ...(hosts.length ? { details: hosts } : {}),
  });

  const rawLatex = hasLikelyRawLatex(html);
  const renderer = hasMathRenderer(html);
  checks.push({
    code: "MATH_RENDERING",
    label: "Math rendering",
    severity: rawLatex && !renderer ? "warning" : "pass",
    message: rawLatex && !renderer
      ? "LaTeX-style maths was detected but no MathJax/KaTeX renderer was found."
      : rawLatex ? "LaTeX-style maths and a maths renderer were detected." : "No unrendered LaTeX pattern was detected.",
  });

  const encoding = suspiciousEncodingExamples(html);
  checks.push({
    code: "ENCODING",
    label: "Physics symbols and encoding",
    severity: encoding.length ? "warning" : "pass",
    message: encoding.length ? "Possible character-encoding damage was detected." : "No common encoding-corruption pattern was detected.",
    ...(encoding.length ? { details: encoding } : {}),
  });

  return checks;
}

function summarise(checks: ValidationCheck[], entrypoint?: string): ValidationSummary {
  const count = (severity: ValidationCheck["severity"]) => checks.filter((check) => check.severity === severity).length;
  return {
    checkedAt: new Date().toISOString(),
    errors: count("error"),
    warnings: count("warning"),
    infos: count("info"),
    passes: count("pass"),
    ...(entrypoint ? { entrypoint } : {}),
    checks,
  };
}

export function validateSubmissionBytes(record: SubmissionRecord, bytes: Uint8Array): ValidationSummary {
  if (record.packageType === "html") {
    const html = strFromU8(bytes);
    return summarise([
      {
        code: "PACKAGE",
        label: "Package",
        severity: "pass",
        message: "Standalone HTML submission detected.",
      },
      ...htmlChecks(html, record.originalFilename, null),
    ], record.originalFilename);
  }

  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch {
    return summarise([{
      code: "ZIP_READ",
      label: "ZIP package",
      severity: "error",
      message: "The uploaded ZIP could not be opened.",
    }]);
  }

  const rawPaths = Object.keys(archive).filter((path) => !path.endsWith("/"));
  const unsafePaths = rawPaths.filter((path) => normalisePath(path) === "__invalid__" || path.startsWith("/") || /^[A-Za-z]:/.test(path));
  const normalisedPaths = rawPaths.map(normalisePath).filter((path) => path !== "__invalid__");
  const availablePaths = new Set(normalisedPaths);
  const totalBytes = rawPaths.reduce((sum, path) => sum + archive[path].byteLength, 0);

  const checks: ValidationCheck[] = [{
    code: "ZIP_READ",
    label: "ZIP package",
    severity: "pass",
    message: `${rawPaths.length} file${rawPaths.length === 1 ? "" : "s"} unpacked successfully.`,
  }];

  if (unsafePaths.length) {
    checks.push({
      code: "ZIP_PATHS",
      label: "ZIP paths",
      severity: "error",
      message: "Unsafe path traversal was detected in the ZIP.",
      details: unsafePaths.slice(0, 12),
    });
  } else {
    checks.push({ code: "ZIP_PATHS", label: "ZIP paths", severity: "pass", message: "ZIP paths are safely contained." });
  }

  if (rawPaths.length > MAX_ZIP_FILES || totalBytes > MAX_UNCOMPRESSED_BYTES) {
    checks.push({
      code: "ZIP_SIZE",
      label: "Expanded ZIP size",
      severity: "error",
      message: `Expanded package is too large (${rawPaths.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB).`,
    });
  } else {
    checks.push({
      code: "ZIP_SIZE",
      label: "Expanded ZIP size",
      severity: "pass",
      message: `${rawPaths.length} files, ${(totalBytes / 1024 / 1024).toFixed(1)} MB after extraction.`,
    });
  }

  const indexCandidates = normalisedPaths.filter((path) => path.toLowerCase().endsWith("index.html"));
  let entrypoint: string | undefined;
  if (availablePaths.has("index.html")) {
    entrypoint = "index.html";
    checks.push({ code: "ENTRYPOINT", label: "Entry page", severity: "pass", message: "index.html found at the ZIP root." });
  } else if (indexCandidates.length === 1) {
    entrypoint = indexCandidates[0];
    checks.push({
      code: "ENTRYPOINT",
      label: "Entry page",
      severity: "pass",
      message: `index.html found at ${entrypoint}. The package root will be normalised automatically.`,
    });
  } else if (indexCandidates.length === 0) {
    checks.push({ code: "ENTRYPOINT", label: "Entry page", severity: "error", message: "No index.html file was found." });
  } else {
    checks.push({
      code: "ENTRYPOINT",
      label: "Entry page",
      severity: "error",
      message: "Multiple index.html files were found; the intended entry page is ambiguous.",
      details: indexCandidates.slice(0, 12),
    });
  }

  if (entrypoint) {
    const rawEntryPath = rawPaths.find((path) => normalisePath(path) === entrypoint);
    if (rawEntryPath) checks.push(...htmlChecks(strFromU8(archive[rawEntryPath]), entrypoint, availablePaths));
  }

  const textFiles = normalisedPaths.filter((path) => TEXT_EXTENSIONS.has(extname(path)));
  checks.push({
    code: "PACKAGE_CONTENTS",
    label: "Package contents",
    severity: "info",
    message: `${textFiles.length} text/code file${textFiles.length === 1 ? "" : "s"} detected for later runtime checks.`,
  });

  return summarise(checks, entrypoint);
}
