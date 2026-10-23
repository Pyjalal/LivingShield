import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeStations, normalizeRainLayers, record } from './normalize.ts';
import { createDatasetApi } from './datasets.ts';
import { createHazardTiles } from './hazard-tiles.ts';

export const SOURCES = {
  stations:
    'https://publicinfobanjir.water.gov.my/wp-content/themes/enlighten/data/latestreadingstrend.json',
  forecast:
    'https://api.data.gov.my/weather/forecast?limit=1000&contains=St@location__location_id&sort=date',
  warnings: 'https://api.data.gov.my/weather/warning?limit=1000',
  rainmap: 'https://maps.water.gov.my/arcgis/rest/services/isohyetmap/isohyet/MapServer?f=pjson',
};
type SourceKey = keyof typeof SOURCES;
interface CacheEntry {
  data: unknown;
  fetchedAt: string;
  source: string;
}
const ttl: Record<SourceKey, number> = {
  stations: 300_000,
  forecast: 3_600_000,
  warnings: 300_000,
  rainmap: 900_000,
};

export function createApp(fetcher: typeof fetch = fetch, clock = Date.now) {
  const cache = new Map<SourceKey, CacheEntry>();
  const pending = new Map<SourceKey, Promise<CacheEntry>>();
  const retryAfter = new Map<SourceKey, number>();
  let weatherTail: Promise<void> = Promise.resolve();
  let lastWeatherAt = 0;
  const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
  const datasetApi = createDatasetApi(fetcher, clock);
  const hazardTiles = createHazardTiles();

  async function refresh(key: SourceKey): Promise<CacheEntry> {
    const running = pending.get(key);
    if (running) return running;
    const promise = (async () => {
      if ((retryAfter.get(key) ?? 0) > clock())
        throw new Error('Source temporarily unavailable; retry shortly');
      if (key === 'forecast' || key === 'warnings') {
        const turn = weatherTail.then(async () => {
          const delay = Math.max(0, 16_000 - (clock() - lastWeatherAt));
          if (delay) await new Promise((resolveWait) => setTimeout(resolveWait, delay));
          lastWeatherAt = clock();
        });
        weatherTail = turn.catch(() => {});
        await turn;
      }
      const response = await fetcher(SOURCES[key], {
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
      const raw: unknown = await response.json();
      let data: unknown = raw;
      if (key === 'stations') data = normalizeStations(raw);
      if (key === 'rainmap') data = { layers: normalizeRainLayers(raw) };
      if (key === 'forecast' || key === 'warnings') {
        if (!Array.isArray(raw)) throw new Error('Unexpected weather response');
        if (key === 'forecast') {
          const valid = raw.filter((v) => {
            const r = record(v),
              location = record(r.location);
            return (
              typeof location.location_id === 'string' &&
              /^St\d+$/.test(location.location_id) &&
              typeof r.date === 'string' &&
              /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
              typeof r.summary_forecast === 'string' &&
              typeof r.morning_forecast === 'string' &&
              typeof r.afternoon_forecast === 'string' &&
              typeof r.night_forecast === 'string' &&
              typeof r.min_temp === 'number' &&
              typeof r.max_temp === 'number'
            );
          });
          if (!valid.length) throw new Error('No usable state forecasts returned');
          data = valid;
        } else {
          const valid = raw.filter((v) => {
            const r = record(v);
            return (
              typeof r.valid_from === 'string' &&
              typeof r.valid_to === 'string' &&
              typeof r.heading_en === 'string' &&
              typeof r.heading_bm === 'string' &&
              typeof r.text_en === 'string' &&
              typeof r.text_bm === 'string'
            );
          });
          if (raw.length && !valid.length) throw new Error('No usable warning notices returned');
          data = valid;
        }
      }
      const entry = { data, fetchedAt: new Date(clock()).toISOString(), source: SOURCES[key] };
      cache.set(key, entry);
      return entry;
    })();
    pending.set(key, promise);
    try {
      return await promise;
    } catch (error) {
      retryAfter.set(key, clock() + 60_000);
      throw error;
    } finally {
      pending.delete(key);
    }
  }
  function json(res: ServerResponse, status: number, value: unknown) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(value));
  }
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        json(res, 405, { error: 'Method not allowed' });
        return;
      }
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/healthz') {
        json(res, 200, { status: 'ok', service: 'LivingShield' });
        return;
      }
      const tile = await hazardTiles(url);
      if (tile) {
        res.writeHead(tile.status, {
          'Content-Type': tile.type,
          'Cache-Control': tile.status === 200 ? 'public, max-age=86400' : 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(req.method === 'HEAD' ? undefined : tile.bytes);
        return;
      }
      const datasetResponse = await datasetApi(url);
      if (datasetResponse) {
        json(res, datasetResponse.status, datasetResponse.body);
        return;
      }
      const key = url.pathname.replace('/api/', '') as SourceKey;
      if (url.pathname.startsWith('/api/')) {
        if (!(key in SOURCES) || !Object.hasOwn(SOURCES, key)) {
          json(res, 404, { error: 'Unknown data source' });
          return;
        }
        const previous = cache.get(key);
        if (previous && clock() - Date.parse(previous.fetchedAt) < ttl[key]) {
          json(res, 200, { ...previous, stale: false });
          return;
        }
        try {
          json(res, 200, { ...(await refresh(key)), stale: false });
        } catch {
          if (previous)
            json(res, 200, {
              ...previous,
              stale: true,
              notice: 'Refresh failed. Showing the last successful fetch; check observation times.',
            });
          else
            json(res, 502, {
              error:
                'The Malaysian data source is unavailable. Retry in a minute or open the official source.',
              source: SOURCES[key],
            });
        }
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      let file = resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + sep)) {
        json(res, 403, { error: 'Forbidden' });
        return;
      }
      if (pathname === '/' || !extname(pathname)) file = resolve(root, 'index.html');
      try {
        const info = await stat(file);
        if (!info.isFile()) {
          json(res, 404, { error: 'Not found' });
          return;
        }
        const types: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.geojson': 'application/geo+json',
          '.txt': 'text/plain; charset=utf-8',
          '.vtt': 'text/vtt; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.glb': 'model/gltf-binary',
          '.gltf': 'model/gltf+json',
          '.stl': 'model/stl',
          '.woff2': 'font/woff2',
        };
        const body = req.method === 'HEAD' ? undefined : await readFile(file);
        res.writeHead(200, {
          'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(body);
      } catch {
        json(res, 404, { error: 'File not found. Run npm run build first.' });
      }
    } catch {
      json(res, 400, { error: 'Invalid request' });
    }
  };
}
export function startServer(port = Number(process.env.PORT ?? 3102)) {
  const server = createServer(createApp());
  server.listen(port, process.env.HOST ?? '127.0.0.1', () =>
    console.log(`LivingShield: http://127.0.0.1:${port}`),
  );
  return server;
}
