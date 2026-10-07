/**
 * Binary payloads ship as "byte container" PNGs: 8-bit grayscale rows of raw bytes,
 * unfiltered, with the payload length in a tEXt chunk. The artifact host only serves
 * standard web types, and decoding by hand keeps the bytes exact (no colour management).
 */
export async function loadByteContainer(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const view = new DataView(buffer);
  const idat: Uint8Array[] = [];
  let offset = 8;
  let width = 0;
  let height = 0;
  let length = -1;
  while (offset < buffer.byteLength) {
    const size = view.getUint32(offset);
    const kind = String.fromCharCode(...new Uint8Array(buffer, offset + 4, 4));
    const body = new Uint8Array(buffer, offset + 8, size);
    if (kind === 'IHDR') {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
    } else if (kind === 'tEXt') {
      const [key, value] = new TextDecoder().decode(body).split('\0');
      if (key === 'length') length = Number(value);
    } else if (kind === 'IDAT') {
      idat.push(body);
    } else if (kind === 'IEND') {
      break;
    }
    offset += 12 + size;
  }
  if (!width || length < 0) throw new Error(`${url}: not a byte container`);
  const inflated = new Response(new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate')));
  const raw = new Uint8Array(await inflated.arrayBuffer());
  const out = new Uint8Array(length);
  const stride = width + 1;
  for (let row = 0, written = 0; row < height && written < length; row++) {
    const n = Math.min(width, length - written);
    out.set(raw.subarray(row * stride + 1, row * stride + 1 + n), written);
    written += n;
  }
  return out;
}

/** A PMTiles source over an archive split into several byte containers. */
export class ChunkedPmtilesSource {
  private readonly cache = new Map<number, Promise<ArrayBuffer>>();

  constructor(private readonly key: string, private readonly urls: string[], private readonly chunkSize: number) {}

  getKey(): string {
    return this.key;
  }

  private chunk(index: number): Promise<ArrayBuffer> {
    let pending = this.cache.get(index);
    if (!pending) {
      pending = loadByteContainer(this.urls[index]).then((bytes) => bytes.buffer as ArrayBuffer);
      this.cache.set(index, pending);
    }
    return pending;
  }

  async getBytes(offset: number, length: number): Promise<{ data: ArrayBuffer }> {
    const out = new Uint8Array(length);
    let position = offset;
    let written = 0;
    while (written < length) {
      const index = Math.floor(position / this.chunkSize);
      if (index >= this.urls.length) break;
      const buffer = await this.chunk(index);
      const start = position - index * this.chunkSize;
      const n = Math.min(length - written, buffer.byteLength - start);
      if (n <= 0) break;
      out.set(new Uint8Array(buffer, start, n), written);
      written += n;
      position += n;
    }
    return { data: out.buffer };
  }
}
