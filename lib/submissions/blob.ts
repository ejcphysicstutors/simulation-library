import { get } from "@vercel/blob";

export async function getPrivateBlobBytes(pathname: string): Promise<Uint8Array> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Could not read the uploaded file from private storage.");
  }
  return new Uint8Array(await new Response(result.stream).arrayBuffer());
}
