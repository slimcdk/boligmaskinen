import { crc32, deflateSync, inflateSync } from 'node:zlib';

/** The bytes in a byte container (frontend/src/app/data/byte-container.ts). */
export function unpack(png: Buffer): Uint8Array {
  let pos = 8;
  let width = 0;
  let length = 0;
  const idat: Buffer[] = [];
  while (pos < png.length) {
    const size = png.readUInt32BE(pos);
    const kind = png.toString('latin1', pos + 4, pos + 8);
    const body = png.subarray(pos + 8, pos + 8 + size);
    if (kind === 'IHDR') width = body.readUInt32BE(0);
    if (kind === 'tEXt') length = Number(body.toString('latin1').split('\0')[1]);
    if (kind === 'IDAT') idat.push(body);
    pos += 12 + size;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(length);
  for (let row = 0, at = 0; at < length; row++) {
    const take = Math.min(width, length - at);
    out.set(raw.subarray(row * (width + 1) + 1, row * (width + 1) + 1 + take), at);
    at += take;
  }
  return out;
}

/** Bytes in a byte container, as pack.py writes them. */
export function pack(payload: Uint8Array): Buffer {
  const width = 4096;
  const height = Math.max(1, Math.ceil(payload.length / width));
  const raw = Buffer.alloc((width + 1) * height);
  for (let row = 0; row < height; row++) raw.set(payload.subarray(row * width, (row + 1) * width), row * (width + 1) + 1);
  const chunk = (kind: string, body: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(body.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(kind, 'latin1'), body])));
    return Buffer.concat([head, Buffer.from(kind, 'latin1'), body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 0, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from(`length\0${payload.length}`, 'latin1')), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
