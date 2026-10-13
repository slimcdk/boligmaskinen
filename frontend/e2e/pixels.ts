import { inflateSync } from 'node:zlib';

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** The rows of RGB or RGBA bytes of an 8-bit PNG, as Playwright takes its screenshots. */
function decode(png: Buffer): { width: number; height: number; channels: number; lines: Uint8Array[] } {
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('latin1', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace !== 0) throw new Error(`Unsupported PNG (depth ${depth}, colour type ${colour})`);
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') {
      data.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  let previous = new Uint8Array(stride);
  const lines: Uint8Array[] = [];
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start];
    const line = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : filter === 4 ? paeth(a, b, c) : 0;
      line[x] = (raw[start + 1 + x] + predictor) & 255;
    }
    lines.push(line);
    previous = line;
  }
  return { width, height, channels, lines };
}

/**
 * How bright a screenshot is on average, from 0 (black) to 255 (white), so a test can tell a light
 * map from a dark one.
 */
export function meanLuminance(png: Buffer): number {
  const { width, height, channels, lines } = decode(png);
  let sum = 0;
  for (const line of lines) {
    for (let x = 0; x < width * channels; x += channels) sum += 0.2126 * line[x] + 0.7152 * line[x + 1] + 0.0722 * line[x + 2];
  }
  return sum / (width * height);
}

/** How far apart two screenshots of the same size are: the mean difference of their colours, 0 to 255. */
export function meanDifference(a: Buffer, b: Buffer): number {
  const one = decode(a);
  const two = decode(b);
  if (one.width !== two.width || one.height !== two.height) throw new Error('The screenshots are not of the same size');
  let sum = 0;
  for (let y = 0; y < one.height; y++) {
    for (let x = 0; x < one.width; x++) {
      for (let c = 0; c < 3; c++) sum += Math.abs(one.lines[y][x * one.channels + c] - two.lines[y][x * two.channels + c]);
    }
  }
  return sum / (one.width * one.height * 3);
}
