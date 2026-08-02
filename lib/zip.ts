/**
 * Minimal ZIP writer — deflate-compressed, no external dependencies.
 *
 * Lives in lib/ rather than inline in the route so the archive format can be
 * exercised directly by a test: a starter kit that downloads but won't open is
 * indistinguishable from a broken pipeline to the person waiting for it.
 */
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const deflateRaw = promisify(zlib.deflateRaw);

export interface ZipEntry {
  name: string;
  content: Buffer;
}

function crc32(buf: Buffer): number {
  const table = makeCrc32Table();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let _crcTable: number[] | null = null;
function makeCrc32Table(): number[] {
  if (_crcTable) return _crcTable;
  _crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    _crcTable[n] = c;
  }
  return _crcTable;
}

function writeUInt16LE(n: number): Buffer {
  const b = Buffer.allocUnsafe(2);
  b.writeUInt16LE(n, 0);
  return b;
}
function writeUInt32LE(n: number): Buffer {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(n, 0);
  return b;
}

export async function buildZip(files: ZipEntry[]): Promise<Buffer> {
  const localHeaders: Buffer[] = [];
  const centralDir: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const compressed = await deflateRaw(file.content);
    const crc = crc32(file.content);

    // Local file header
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      writeUInt16LE(20),                       // version needed
      writeUInt16LE(0),                        // general purpose bits
      writeUInt16LE(8),                        // compression: deflate
      writeUInt16LE(0),                        // mod time
      writeUInt16LE(0),                        // mod date
      writeUInt32LE(crc),
      writeUInt32LE(compressed.length),
      writeUInt32LE(file.content.length),
      writeUInt16LE(name.length),
      writeUInt16LE(0),                        // extra length
      name,
      compressed,
    ]);

    // Central directory entry
    const central = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      writeUInt16LE(20),                       // version made by
      writeUInt16LE(20),                       // version needed
      writeUInt16LE(0),
      writeUInt16LE(8),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(crc),
      writeUInt32LE(compressed.length),
      writeUInt32LE(file.content.length),
      writeUInt16LE(name.length),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(0),
      writeUInt32LE(offset),
      name,
    ]);

    localHeaders.push(local);
    centralDir.push(central);
    offset += local.length;
  }

  const centralDirBuf = Buffer.concat(centralDir);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // end of central dir signature
    writeUInt16LE(0),
    writeUInt16LE(0),
    writeUInt16LE(files.length),
    writeUInt16LE(files.length),
    writeUInt32LE(centralDirBuf.length),
    writeUInt32LE(offset),
    writeUInt16LE(0),
  ]);

  return Buffer.concat([...localHeaders, centralDirBuf, eocd]);
}

