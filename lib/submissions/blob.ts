import { issueSignedToken, presignUrl } from "@vercel/blob";

const READ_URL_TTL_MS = 5 * 60 * 1000;

export async function getPrivateBlobBytes(pathname: string): Promise<Uint8Array> {
  const cleanPathname = pathname.trim();
  if (!cleanPathname) throw new Error("Submission file path is missing.");

  const validUntil = Date.now() + READ_URL_TTL_MS;
  const token = await issueSignedToken({
    pathname: cleanPathname,
    operations: ["get"],
    validUntil,
  });

  const { presignedUrl } = await presignUrl(token, {
    pathname: cleanPathname,
    operation: "get",
    access: "private",
    validUntil,
    useCache: false,
  });

  const response = await fetch(presignedUrl, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Could not read the uploaded file from private storage (HTTP ${response.status}).`,
    );
  }

  return new Uint8Array(await response.arrayBuffer());
}
