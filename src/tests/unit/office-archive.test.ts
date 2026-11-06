import { deflateRawSync } from "node:zlib";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
import { describe, expect, it } from "vitest";
import { inspectOfficeArchive } from "@/server/storage/office-archive";

function makeZip(entries: Array<{ name: string; data: string }>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const data = Buffer.from(entry.data);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    locals.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + compressed.length;
  }
  const localBytes = Buffer.concat(locals);
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(localBytes.length, 16);
  return Buffer.concat([localBytes, centralBytes, end]);
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const validDocx = () => makeZip([
  { name: "[Content_Types].xml", data: "<Types/>" },
  { name: "word/document.xml", data: "<document/>" },
]);

describe("Office archive inspection", () => {
  it("accepts a structurally valid DOCX archive", () => {
    expect(() => inspectOfficeArchive(validDocx(), "docx")).not.toThrow();
  });

  it("rejects a missing required Office entry", () => {
    expect(() => inspectOfficeArchive(makeZip([{ name: "random.txt", data: "x" }]), "docx")).toThrow(/required Office entry/);
  });

  it("rejects a truncated archive", () => {
    expect(() => inspectOfficeArchive(new Uint8Array([1, 2, 3]), "docx")).toThrow(/truncated/);
  });

  it("rejects unsafe traversal paths", () => {
    expect(() => inspectOfficeArchive(makeZip([
      { name: "[Content_Types].xml", data: "x" },
      { name: "word/../evil.xml", data: "x" },
      { name: "word/document.xml", data: "x" },
    ]), "docx")).toThrow(/unsafe entry path/);
  });

  it("rejects excessive compression ratios", () => {
    const highlyCompressible = "a".repeat(10_000);
    expect(() => inspectOfficeArchive(makeZip([
      { name: "[Content_Types].xml", data: "x" },
      { name: "word/document.xml", data: highlyCompressible },
    ]), "docx")).toThrow(/compression ratio/);
  });
});
