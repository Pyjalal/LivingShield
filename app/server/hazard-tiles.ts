import { deflateSync } from 'node:zlib';
import { HAZARD_ARIS, hazardTile, hazardSource, openHazardImage } from './hazard.ts';
function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
export function rgbaPNG(rgba: Uint8Array, width = 256, height = 256) {
  if (rgba.length !== width * height * 4) throw new Error('Invalid raster size.');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    rows.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export function tileCoordinates(z: number, x: number, y: number) {
  const n = 2 ** z,
    lat = (v: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * v) / n))) * 180) / Math.PI;
  return {
    west: (x / n) * 360 - 180,
    east: ((x + 1) / n) * 360 - 180,
    south: lat(y + 1),
    north: lat(y),
    latAt: (pixel: number) => lat(y + (pixel + 0.5) / 256),
  };
}
export function depthColor(value: number): number[] {
  return value < 1
    ? [56, 189, 248, 180]
    : value < 3
      ? [59, 130, 246, 200]
      : value < 10
        ? [168, 85, 247, 210]
        : [244, 63, 94, 220];
}
async function render(ari: number, z: number, x: number, y: number) {
  const b = tileCoordinates(z, x, y),
    rgba = new Uint8Array(256 * 256 * 4);
  if (b.east < 99 || b.west > 120 || b.north < 0.5 || b.south > 8) return rgbaPNG(rgba);
  const names = [...new Set([hazardTile(Math.max(99, b.west)), hazardTile(Math.min(120, b.east))])];
  for (const name of names) {
    const image = await openHazardImage(hazardSource(name, ari)),
      [ox, oy] = image.getOrigin(),
      [dx, dy] = image.getResolution();
    const west = Math.max(b.west, ox),
      east = Math.min(b.east, ox + image.getWidth() * dx),
      north = Math.min(b.north, oy),
      south = Math.max(b.south, oy + image.getHeight() * dy);
    if (west >= east || south >= north) continue;
    const left = Math.max(0, Math.floor((west - ox) / dx)),
      right = Math.min(image.getWidth(), Math.ceil((east - ox) / dx)),
      top = Math.max(0, Math.floor((north - oy) / dy)),
      bottom = Math.min(image.getHeight(), Math.ceil((south - oy) / dy));
    if (right - left > 1024 || bottom - top > 1024)
      throw new Error('Zoom in for flood raster tiles.');
    const values = await image.readRasters({
        window: [left, top, right, bottom],
        samples: [0],
        interleave: true,
        signal: AbortSignal.timeout(25000),
      }),
      noData = image.getGDALNoData();
    for (let py = 0; py < 256; py++) {
      const lat = b.latAt(py),
        row = Math.floor((lat - oy) / dy);
      if (row < top || row >= bottom || lat < 0.5 || lat > 8) continue;
      for (let px = 0; px < 256; px++) {
        const lng = b.west + ((px + 0.5) / 256) * (b.east - b.west),
          col = Math.floor((lng - ox) / dx);
        if (col < left || col >= right || lng < 99 || lng > 120) continue;
        const value = Number(values[(row - top) * (right - left) + col - left]);
        if (!Number.isFinite(value) || value === noData || value <= 0) continue;
        rgba.set(depthColor(value), (py * 256 + px) * 4);
      }
    }
  }
  return rgbaPNG(rgba);
}
export function createHazardTiles() {
  const cache = new Map<string, Buffer>(),
    pending = new Map<string, Promise<Buffer>>();
  let active = 0;
  const queue: (() => void)[] = [];
  return async (url: URL) => {
    const match = /^\/api\/hazard-tiles\/(\d+)\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(url.pathname);
    if (!url.pathname.startsWith('/api/hazard-tiles/')) return null;
    const [ari, z, x, y] = match ? match.slice(1).map(Number) : [];
    if (
      !match ||
      !HAZARD_ARIS.includes(ari) ||
      z < 10 ||
      z > 16 ||
      x < 0 ||
      y < 0 ||
      x >= 2 ** z ||
      y >= 2 ** z
    )
      return {
        status: 400,
        bytes: Buffer.from('Invalid raster tile or zoom (10–16).'),
        type: 'text/plain',
      };
    const key = match[0],
      saved = cache.get(key);
    if (saved) return { status: 200, bytes: saved, type: 'image/png' };
    let request = pending.get(key);
    if (!request) {
      if (queue.length >= 16)
        return { status: 503, bytes: Buffer.from('Raster busy; retry.'), type: 'text/plain' };
      request = (async () => {
        if (active >= 2) await new Promise<void>((resolve) => queue.push(resolve));
        else active++;
        try {
          const bytes = await render(ari, z, x, y);
          if (cache.size >= 128) cache.delete(cache.keys().next().value!);
          cache.set(key, bytes);
          return bytes;
        } finally {
          const next = queue.shift();
          if (next) next();
          else active--;
        }
      })();
      pending.set(key, request);
    }
    try {
      return { status: 200, bytes: await request, type: 'image/png' };
    } catch {
      return {
        status: 502,
        bytes: Buffer.from('Flood raster source unavailable.'),
        type: 'text/plain',
      };
    } finally {
      pending.delete(key);
    }
  };
}
