import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, SOURCES } from '../server/app.ts';
import {
  malaysiaDate,
  normalizeStations,
  normalizeRainLayers,
  numeric,
} from '../server/normalize.ts';
import { isFresh } from '../src/malaysia/domain.ts';
import { DESIGN_STATIONS, intensity, calculateDesign } from '../src/malaysia/design.ts';
import { parseSites } from '../src/malaysia/sites.ts';

const rawStation = {
  station_id: '1',
  station_name: 'Station <script>',
  latitude: '3.1',
  longitude: '101.6',
  state: 'SELANGOR',
  station_status: 'ON',
  wl1_status: 'ON',
  rf_status: 'ON',
  clean_water_level: '4.2',
  cum_hourly: '0',
  cum_3hours: '12.5',
  cum_daily: '20',
  wl_severity_level: 'Warning',
  wl_date_time: '18/10/2026 20:30',
  rf_date_time: '18/10/2026 20:15',
};
test('JPS date parser uses MYT and rejects invalid dates', () => {
  assert.equal(malaysiaDate('18/10/2026 20:30'), '2026-10-18T20:30:00+08:00');
  assert.equal(malaysiaDate('31/02/2026 20:30'), null);
  assert.equal(malaysiaDate(''), null);
  assert.equal(isFresh('2026-10-18T20:30:00+08:00', Date.parse('2026-10-18T21:00:00+08:00')), true);
  assert.equal(
    isFresh('2025-05-23T11:45:00+08:00', Date.parse('2026-10-18T21:00:00+08:00')),
    false,
  );
  assert.equal(
    isFresh('2026-10-19T20:30:00+08:00', Date.parse('2026-10-18T21:00:00+08:00')),
    false,
  );
});
test('missing sentinel never becomes a normal or danger water reading; zero rainfall stays zero', () => {
  const [station] = normalizeStations([
    { ...rawStation, clean_water_level: '-9999', wl_severity_level: 'Danger' },
  ]);
  assert.equal(station.waterLevel, null);
  assert.equal(station.waterStatus, 'Unknown');
  assert.equal(station.rainfall1h, 0);
  assert.throws(
    () => normalizeStations([{ ...rawStation, latitude: '0', longitude: '0' }]),
    /no usable/,
  );
  assert.throws(() => normalizeStations({ error: 'bad' }), /not an array/);
  assert.equal(normalizeStations([rawStation, rawStation]).length, 1);
  assert.equal(numeric('   '), null);
  assert.equal(numeric([]), null);
  assert.equal(normalizeStations([{ ...rawStation, rf_status: '' }])[0].rainOnline, false);
});
test('rain imagery timestamps preserve unspecified timezone and sort chronologically', () => {
  const layers = normalizeRainLayers({
    layers: [
      { id: 2, name: 'isohyet_202610180200.tif' },
      { id: 1, name: 'isohyet_202610180100.tif' },
    ],
  });
  assert.equal(layers[0].id, 1);
  assert.equal(layers[1].timestamp, '2026-10-18 02:00');
});
test('an offline secondary gauge does not hide a valid online primary gauge', () => {
  const [station] = normalizeStations([{ ...rawStation, wl1_status: 'ON', wl2_status: 'OFF' }]);
  assert.equal(station.waterOnline, true);
  const [offline] = normalizeStations([{ ...rawStation, wl1_status: 'OFF', wl2_status: 'OFF' }]);
  assert.equal(offline.waterOnline, false);
});
const ampang = DESIGN_STATIONS.find((s) => s.id === '3117070')!;
test('MSMA equation converts minutes to hours and produces expected intensity', () => {
  const expected = (65.809 * Math.pow(10, 0.148)) / Math.pow(1 + 0.156, 0.837);
  assert.ok(Math.abs(intensity(ampang, 60, 10) - expected) < 1e-9);
  assert.ok(intensity(ampang, 15, 10) > intensity(ampang, 60, 10));
  assert.ok(intensity(ampang, 60, 100) > intensity(ampang, 60, 2));
  assert.throws(() => intensity(ampang, 4, 10));
  assert.throws(() => intensity(ampang, 60, 101));
});
const input = {
  station: ampang,
  area: 10000,
  before: 0.3,
  after: 0.8,
  tc: 15,
  ari: 10,
  slope: 0.005,
  roughness: 0.013,
  release: 50,
  pipeLength: 100,
  pipeRate: 100,
  storageRate: 200,
};
test('runoff, pipe capacity and all storage durations use selected Malaysian station', () => {
  const result = calculateDesign(input);
  assert.ok(Math.abs(result.post - (0.8 * intensity(ampang, 15, 10)) / 360) < 1e-9);
  const d = result.diameter / 1000;
  const capacity =
    (((Math.PI * d * d) / 4) * (d / 4) ** (2 / 3) * Math.sqrt(input.slope)) / input.roughness;
  assert.ok(Math.abs(capacity - result.post) < 1e-9);
  assert.ok(result.nominal !== null && result.nominal >= result.diameter);
  assert.ok(
    result.storageRows.every(
      (row) =>
        Math.abs(
          row.volume -
            Math.max(
              0,
              ((0.8 * intensity(ampang, row.duration, 10)) / 360 - 0.05) * row.duration * 60,
            ),
        ) < 1e-8,
    ),
  );
  const other = calculateDesign({ ...input, station: DESIGN_STATIONS[0] });
  assert.notEqual(result.critical.volume, other.critical.volume);
  assert.ok(result.cost >= 10000);
});
test('invalid inputs blocked; zero runoff and pipe beyond catalogue handled', () => {
  assert.throws(() => calculateDesign({ ...input, area: NaN }));
  assert.throws(() => calculateDesign({ ...input, slope: 0 }));
  assert.throws(() => calculateDesign({ ...input, after: 1.1 }));
  assert.equal(calculateDesign({ ...input, after: 0 }).nominal, 0);
  assert.equal(calculateDesign({ ...input, area: 800000, ari: 100, slope: 0.0001 }).nominal, null);
});
test('GeoJSON imports validate bounds, shape and empty collections', () => {
  const data = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [101, 3],
              [101.1, 3],
              [101.1, 3.1],
              [101, 3],
            ],
          ],
        },
        properties: { name: 'Site' },
      },
    ],
  };
  assert.equal(parseSites(JSON.stringify(data)).features.length, 1);
  assert.throws(
    () =>
      parseSites(
        JSON.stringify({ ...data, crs: { type: 'name', properties: { name: 'EPSG:3857' } } }),
      ),
    /WGS84/,
  );
  assert.throws(() => parseSites(JSON.stringify({ type: 'FeatureCollection', features: [] })));
  data.features[0].geometry.coordinates[0][0] = [-113, 53];
  assert.throws(() => parseSites(JSON.stringify(data)), /Malaysia/);
  assert.throws(() => parseSites('invalid'));
});
test('API coalesces requests, serves cached results and marks stale fallback', async () => {
  let calls = 0,
    fail = false,
    now = Date.parse('2026-10-18T12:45:00Z');
  const fetcher: typeof fetch = async () => {
    calls++;
    if (fail) throw new Error('offline');
    return new Response(JSON.stringify([rawStation]));
  };
  const server = createServer(createApp(fetcher, () => now));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const responses = await Promise.all([
      fetch(`${base}/api/stations`),
      fetch(`${base}/api/stations`),
    ]);
    assert.equal(calls, 1);
    const body = await responses[0].json();
    assert.equal(body.stale, false);
    assert.equal(body.source, SOURCES.stations);
    assert.equal(body.data[0].waterLevel, 4.2);
    now += 301000;
    fail = true;
    const stale = await (await fetch(`${base}/api/stations`)).json();
    assert.equal(stale.stale, true);
    assert.equal(stale.fetchedAt, body.fetchedAt);
    assert.equal((await fetch(`${base}/api/not-allowed`)).status, 404);
    assert.equal((await fetch(`${base}/api/__proto__`)).status, 404);
    assert.equal((await fetch(`${base}/api/stations`, { method: 'POST' })).status, 405);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test('health check supports GET and HEAD without contacting upstream sources', async () => {
  let calls = 0;
  const server = createServer(
    createApp(async () => {
      calls++;
      throw new Error('upstream unavailable');
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/healthz`;
  try {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'LivingShield' });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal(calls, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test('cold upstream outage produces 502, never sample data; backs off failed source', async () => {
  let calls = 0;
  const server = createServer(
    createApp(async () => {
      calls++;
      throw new Error('offline');
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/stations`;
  try {
    const response = await fetch(url);
    assert.equal(response.status, 502);
    assert.equal((await response.json()).data, undefined);
    await fetch(url);
    assert.equal(calls, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test('changed warning schema fails explicitly rather than reporting no warnings', async () => {
  const server = createServer(
    createApp(async () => new Response(JSON.stringify([{ new_schema: 'unexpected' }]))),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/warnings`,
    );
    assert.equal(response.status, 502);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test('a genuinely empty warning feed stays a valid empty response', async () => {
  const server = createServer(createApp(async () => new Response('[]')));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/warnings`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, []);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
