// Fast, lightweight, zero-dependency in-memory ZIP creator for PNG sequences
// Uses Stored (method 0) headers, optimal for already-compressed PNG files.

const makeCrcTable = (): Uint32Array => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
};

const crcTable = makeCrcTable();

export function crc32(buf: Uint8Array): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function createZipBlob(files: ZipEntry[]): Blob {
  const parts: (Uint8Array | ArrayBuffer)[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  const textEncoder = new TextEncoder();

  for (const file of files) {
    const nameBytes = textEncoder.encode(file.name);
    const dataBytes = file.data;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes)
    const localHeader = new Uint8Array(30);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true); // signature
    view.setUint16(4, 20, true);         // version needed
    view.setUint16(6, 0, true);          // flags
    view.setUint16(8, 0, true);          // compression (0 = stored)
    view.setUint16(10, 0, true);         // time
    view.setUint16(12, 0, true);         // date
    view.setUint32(14, crc, true);       // crc32
    view.setUint32(18, size, true);      // compressed size
    view.setUint32(22, size, true);      // uncompressed size
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);         // extra field length

    parts.push(localHeader, nameBytes, dataBytes);

    // Central directory header (46 bytes)
    const cdHeader = new Uint8Array(46);
    const cdView = new DataView(cdHeader.buffer);
    cdView.setUint32(0, 0x02014b50, true); // signature
    cdView.setUint16(4, 20, true);         // version made by
    cdView.setUint16(6, 20, true);         // version needed
    cdView.setUint16(8, 0, true);          // flags
    cdView.setUint16(10, 0, true);         // compression
    cdView.setUint16(12, 0, true);         // time
    cdView.setUint16(14, 0, true);         // date
    cdView.setUint32(16, crc, true);       // crc32
    cdView.setUint32(20, size, true);      // compressed size
    cdView.setUint32(24, size, true);      // uncompressed size
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint16(30, 0, true);         // extra length
    cdView.setUint16(32, 0, true);         // comment length
    cdView.setUint16(34, 0, true);         // disk start
    cdView.setUint16(36, 0, true);         // internal attrs
    cdView.setUint32(38, 0, true);         // external attrs
    cdView.setUint32(42, offset, true);    // local header offset

    centralDir.push(cdHeader, nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const b of centralDir) cdSize += b.length;

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);           // disk number
  eocdView.setUint16(6, 0, true);           // cd disk
  eocdView.setUint16(8, files.length, true); // records this disk
  eocdView.setUint16(10, files.length, true); // total records
  eocdView.setUint32(12, cdSize, true);     // cd size
  eocdView.setUint32(16, cdOffset, true);   // cd offset
  eocdView.setUint16(20, 0, true);          // comment length

  return new Blob([...parts, ...centralDir, eocd], { type: 'application/zip' });
}
