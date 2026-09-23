import { get, list } from "@vercel/blob";

function submissionPrefixFromPath(pathname: string): string {
  const clean = pathname.trim().replace(/^\/+/, "");
  const lastSlash = clean.lastIndexOf("/");
  return lastSlash >= 0 ? clean.slice(0, lastSlash + 1) : clean;
}

export async function resolvePrivateBlobPathname(pathname: string): Promise<string> {
  const cleanPathname = pathname.trim().replace(/^\/+/, "");
  if (!cleanPathname) throw new Error("Submission file path is missing.");

  const exact = await get(cleanPathname, { access: "private", useCache: false });
  if (exact?.statusCode === 200) return exact.blob.pathname;

  const prefix = submissionPrefixFromPath(cleanPathname);
  const listing = await list({ prefix, limit: 20 });
  const files = listing.blobs.filter((blob) => !blob.pathname.endsWith("/"));

  if (files.length === 1) return files[0].pathname;

  const exactName = cleanPathname.split("/").pop()?.toLowerCase();
  if (exactName) {
    const named = files.find((blob) => blob.pathname.split("/").pop()?.toLowerCase() === exactName);
    if (named) return named.pathname;
  }

  throw new Error(
    files.length === 0
      ? "The uploaded file is missing from private storage. Please submit the file again."
      : "More than one uploaded file was found for this submission, so the correct file could not be identified automatically.",
  );
}

export async function getPrivateBlobBytes(pathname: string): Promise<Uint8Array> {
  const resolvedPathname = await resolvePrivateBlobPathname(pathname);
  const result = await get(resolvedPathname, { access: "private", useCache: false });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Could not read the uploaded file from private storage.");
  }

  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}
