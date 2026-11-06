import "server-only";

import { inflateRawSync } from "node:zlib";

const LIMITS = {
  entries: 1_000,
  entryBytes: 16 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024,
  ratio: 100,
} as const;

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[n] = value >>> 0;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function reject(message: string): never {
  throw new Error(`Unsafe Office archive: ${message}`);
}

/** Inspect an Office Open XML ZIP without extracting files to disk. */
export function inspectOfficeArchive(
  input: Uint8Array,
  kind: "docx" | "xlsx",
): void {
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (bytes.length < 22) reject("archive is truncated.");

  const minEocd = Math.max(0, bytes.length - 65_557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= minEocd; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      const commentLength = bytes.readUInt16LE(offset + 20);
      if (offset + 22 + commentLength === bytes.length) {
        eocd = offset;
        break;
      }
    }
  }
  if (eocd < 0) reject("end-of-central-directory record is missing.");

  const disk = bytes.readUInt16LE(eocd + 4);
  const centralDisk = bytes.readUInt16LE(eocd + 6);
  const diskEntries = bytes.readUInt16LE(eocd + 8);
  const entryCount = bytes.readUInt16LE(eocd + 10);
  const centralSize = bytes.readUInt32LE(eocd + 12);
  const centralOffset = bytes.readUInt32LE(eocd + 16);

  if (disk || centralDisk || diskEntries !== entryCount) {
    reject("multi-disk archives are not supported.");
  }
  if (
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff
  ) {
    reject("ZIP64 archives are not supported.");
  }
  if (entryCount < 1 || entryCount > LIMITS.entries) {
    reject("entry count exceeds the configured limit.");
  }
  if (
    centralOffset + centralSize > eocd ||
    centralOffset + centralSize < centralOffset
  ) {
    reject("central directory is out of bounds.");
  }

  let cursor = centralOffset;
  let totalExpanded = 0;
  const names = new Set<string>();
  const localRanges: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (
      cursor + 46 > centralOffset + centralSize ||
      bytes.readUInt32LE(cursor) !== 0x02014b50
    ) {
      reject("central directory is malformed.");
    }

    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const expectedCrc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const expandedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const externalAttributes = bytes.readUInt32LE(cursor + 38);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const recordEnd = cursor + 46 + nameLength + extraLength + commentLength;

    if (recordEnd > centralOffset + centralSize) {
      reject("central directory entry is truncated.");
    }
    if (flags & 1) reject("encrypted entries are not accepted.");
    if (
      compressedSize === 0xffffffff ||
      expandedSize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      reject("ZIP64 entries are not supported.");
    }

    const name = bytes.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    if (
      !name ||
      name.includes("\\") ||
      name.startsWith("/") ||
      name.split("/").some((part) => part === "..")
    ) {
      reject("unsafe entry path.");
    }
    if (names.has(name)) reject("duplicate entry paths are not accepted.");
    names.add(name);

    const unixMode = externalAttributes >>> 16;
    if (((unixMode >>> 12) & 0xf) === 0xa) {
      reject("symbolic links are not accepted.");
    }

    if (expandedSize > LIMITS.entryBytes) {
      reject("an entry exceeds the expanded-size limit.");
    }
    totalExpanded += expandedSize;
    if (totalExpanded > LIMITS.totalBytes) {
      reject("total expanded size exceeds the configured limit.");
    }
    if (
      expandedSize > 0 &&
      (compressedSize === 0 || expandedSize / compressedSize > LIMITS.ratio)
    ) {
      reject("compression ratio exceeds the configured limit.");
    }

    if (!name.endsWith("/")) {
      if (
        localOffset + 30 > centralOffset ||
        bytes.readUInt32LE(localOffset) !== 0x04034b50
      ) {
        reject("local file header is malformed.");
      }

      const localFlags = bytes.readUInt16LE(localOffset + 6);
      const localMethod = bytes.readUInt16LE(localOffset + 8);
      const localCrc = bytes.readUInt32LE(localOffset + 14);
      const localCompressedSize = bytes.readUInt32LE(localOffset + 18);
      const localExpandedSize = bytes.readUInt32LE(localOffset + 22);
      const localNameLength = bytes.readUInt16LE(localOffset + 26);
      const localExtraLength = bytes.readUInt16LE(localOffset + 28);
      const localNameEnd = localOffset + 30 + localNameLength;
      const dataStart = localNameEnd + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (
        localNameEnd > centralOffset ||
        dataStart < localOffset ||
        dataEnd > centralOffset ||
        dataEnd < dataStart
      ) {
        reject("compressed entry data is out of bounds.");
      }
      const localName = bytes.toString("utf8", localOffset + 30, localNameEnd);
      if (localName !== name) {
        reject("local header filename does not match the central directory.");
      }
      if (localFlags !== flags) {
        reject("local header flags do not match the central directory.");
      }
      if (localMethod !== method) {
        reject("local header compression method does not match the central directory.");
      }
      if (flags & 0x0008) {
        if (
          (localCrc !== 0 && localCrc !== expectedCrc) ||
          (localCompressedSize !== 0 && localCompressedSize !== compressedSize) ||
          (localExpandedSize !== 0 && localExpandedSize !== expandedSize)
        ) {
          reject("local header values conflict with the data descriptor.");
        }
      } else if (
        localCrc !== expectedCrc ||
        localCompressedSize !== compressedSize ||
        localExpandedSize !== expandedSize
      ) {
        reject("local header sizes or checksum do not match the central directory.");
      }

      let rangeEnd = dataEnd;
      if (flags & 0x0008) {
        // Data descriptors may optionally begin with the signature 0x08074b50.
        let descriptorOffset = dataEnd;
        if (
          descriptorOffset + 4 <= centralOffset &&
          bytes.readUInt32LE(descriptorOffset) === 0x08074b50
        ) {
          descriptorOffset += 4;
        }
        if (descriptorOffset + 12 > centralOffset) {
          reject("data descriptor is truncated.");
        }
        const descriptorCrc = bytes.readUInt32LE(descriptorOffset);
        const descriptorCompressedSize = bytes.readUInt32LE(descriptorOffset + 4);
        const descriptorExpandedSize = bytes.readUInt32LE(descriptorOffset + 8);
        if (
          descriptorCrc !== expectedCrc ||
          descriptorCompressedSize !== compressedSize ||
          descriptorExpandedSize !== expandedSize
        ) {
          reject("data descriptor does not match the central directory.");
        }
        rangeEnd = descriptorOffset + 12;
      }
      localRanges.push({ start: localOffset, end: rangeEnd });

      const compressed = bytes.subarray(dataStart, dataEnd);
      let expanded: Buffer;
      try {
        if (method === 0) {
          expanded = Buffer.from(compressed);
        } else if (method === 8) {
          expanded = inflateRawSync(compressed, {
            maxOutputLength: LIMITS.entryBytes,
          });
        } else {
          reject("unsupported compression method.");
        }
      } catch {
        reject("entry decompression failed or exceeded its limit.");
      }

      if (expanded.length !== expandedSize || crc32(expanded) !== expectedCrc) {
        reject("entry size or checksum is invalid.");
      }
    }

    cursor = recordEnd;
  }

  if (cursor !== centralOffset + centralSize) {
    reject("central directory size does not match its entries.");
  }
  localRanges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < localRanges.length; index += 1) {
    if (localRanges[index].start < localRanges[index - 1].end) {
      reject("local file data ranges overlap.");
    }
  }

  const required =
    kind === "docx"
      ? ["[Content_Types].xml", "word/document.xml"]
      : ["[Content_Types].xml", "xl/workbook.xml"];
  for (const name of required) {
    if (!names.has(name)) {
      reject(`required Office entry ${name} is missing.`);
    }
  }
}
