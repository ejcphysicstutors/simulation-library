const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;

export const MAX_ZIP_FILES = 400;
export const MAX_ZIP_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
export const MAX_ZIP_SINGLE_FILE_BYTES = 15 * 1024 * 1024;

export type ZipInspection = {
  fileCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  paths: string[];
};

function normaliseZipPath(path: string): string | null {
  if (!path || path.startsWith("/") || /^[A-Za-z]:/.test(path)) return null;
  const stack: string[] = [];
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!stack.length) return null;
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.length ? stack.join("/") : null;
}

function findEndOfCentralDirectory(view: DataView): number {
  const min = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("The ZIP central directory could not be found.");
}

export function inspectZipBeforeExtraction(bytes: Uint8Array): ZipInspection {
  if (bytes.byteLength < 22) throw new Error("The uploaded ZIP is incomplete.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);

  const diskNumber = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const totalEntries = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);

  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error("Multi-part ZIP archives are not supported.");
  }
  if (
    totalEntries === ZIP64_SENTINEL_16 ||
    centralSize === ZIP64_SENTINEL_32 ||
    centralOffset === ZIP64_SENTINEL_32
  ) {
    throw new Error("ZIP64 archives are not supported. Please submit a standard ZIP package.");
  }
  if (totalEntries > MAX_ZIP_FILES) {
    throw new Error(`ZIP packages may contain at most ${MAX_ZIP_FILES} files.`);
  }
  if (centralOffset + centralSize > bytes.byteLength || centralOffset + centralSize > eocd) {
    throw new Error("The ZIP central directory is invalid.");
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const paths: string[] = [];
  let offset = centralOffset;
  let compressedBytes = 0;
  let uncompressedBytes = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new Error("The ZIP file table is invalid.");
    }

    const flags = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const diskStart = view.getUint16(offset + 34, true);
    const next = offset + 46 + fileNameLength + extraLength + commentLength;

    if (next > bytes.byteLength || diskStart !== 0) throw new Error("The ZIP file table is invalid.");
    if (flags & 0x0001) throw new Error("Password-protected ZIP files are not supported.");
    if (compressedSize === ZIP64_SENTINEL_32 || uncompressedSize === ZIP64_SENTINEL_32) {
      throw new Error("ZIP64 archives are not supported. Please submit a standard ZIP package.");
    }

    const rawName = bytes.subarray(offset + 46, offset + 46 + fileNameLength);
    const name = decoder.decode(rawName);
    if (!name.endsWith("/")) {
      const normalised = normaliseZipPath(name);
      if (!normalised) throw new Error(`Unsafe ZIP path detected: ${name.slice(0, 120)}`);
      if (uncompressedSize > MAX_ZIP_SINGLE_FILE_BYTES) {
        throw new Error(`A ZIP file expands beyond the ${MAX_ZIP_SINGLE_FILE_BYTES / 1024 / 1024} MB per-file limit.`);
      }
      paths.push(normalised);
      compressedBytes += compressedSize;
      uncompressedBytes += uncompressedSize;
      if (uncompressedBytes > MAX_ZIP_UNCOMPRESSED_BYTES) {
        throw new Error(`The ZIP expands beyond the ${MAX_ZIP_UNCOMPRESSED_BYTES / 1024 / 1024} MB package limit.`);
      }
    }

    offset = next;
  }

  if (paths.length > MAX_ZIP_FILES) throw new Error(`ZIP packages may contain at most ${MAX_ZIP_FILES} files.`);
  return { fileCount: paths.length, compressedBytes, uncompressedBytes, paths };
}
