import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DESIGN_STATIONS,
  intensity,
  parseApprovedProfile,
  profileForLocation,
} from '../src/malaysia/design.ts';
import { temporalPattern, cumulativePattern } from '../src/malaysia/settings.ts';
import { runSimulation, defaultPatternRegion } from '../src/malaysia/simulation.ts';
import { roundUpPipe, GA_SOILS } from '../src/utils/hydrology.ts';
import { createDatasetApi, parcelResult, GIS_DATASETS } from '../server/datasets.ts';
import msma from '../src/data/msma.json' with { type: 'json' };

test('all 135 published profiles have unique IDs, names and valid domain intensities', () => {
  const peninsular = DESIGN_STATIONS.filter((s) => s.family === 'msma');
  assert.equal(peninsular.length, 135);
  assert.equal(new Set(peninsular.map((s) => s.id)).size, 135);
  assert.equal(new Set(peninsular.map((s) => s.state)).size, 12);
  assert.equal(DESIGN_STATIONS.find((s) => s.id === '5303001')?.name, 'Rmh Kebajikan P Pinang');
  for (const s of peninsular) {
    assert.ok(s.name.trim());
    assert.ok(s.page >= 56 && s.page <= 59);
    for (const d of [5, 60, 4320])
      for (const ari of [2, 100])
        assert.ok(Number.isFinite(intensity(s, d, ari)) && intensity(s, d, ari) > 0);
    assert.ok(intensity(s, 60, 100) > intensity(s, 60, 2));
    assert.ok(intensity(s, 5, 10) > intensity(s, 4320, 10));
  }
});
test('all five MSMA regions preserve published block counts and conserve normalized rainfall', () => {
  const counts: Record<number, number> = {
    15: 3,
    30: 6,
    60: 12,
    180: 12,
    360: 12,
    720: 12,
    1440: 24,
    2880: 24,
    4320: 24,
  };
  for (let region = 1; region <= 5; region++)
    for (const [minutes, count] of Object.entries(counts)) {
      const weights = temporalPattern(region, Number(minutes));
      assert.equal(weights.length, count);
      assert.ok(weights.every((w) => Number.isFinite(w) && w >= 0));
      assert.ok(Math.abs(weights.reduce((s, w) => s + w, 0) - 1) < 1e-12);
      assert.equal(cumulativePattern(0, region, Number(minutes)), 0);
      assert.equal(cumulativePattern(1, region, Number(minutes)), 1);
    }
  assert.equal(msma.patterns['2']['60'].reduce((s, w) => s + w, 0).toFixed(3), '0.948');
  assert.equal(defaultPatternRegion('Sarawak'), null);
  assert.equal(defaultPatternRegion('Sabah'), null);
  assert.equal(defaultPatternRegion('Selangor'), 2);
  assert.throws(() => temporalPattern(1, 120));
});
test('storm simulations conserve rainfall, infiltration and runoff for every region, duration and soil', () => {
  for (let region = 1; region <= 5; region++)
    for (const hours of [0.25, 0.5, 1, 3, 6, 12, 24, 48, 72])
      for (const soil of Object.keys(GA_SOILS) as (keyof typeof GA_SOILS)[]) {
        const steps = runSimulation(123.4, hours, soil, 0.4, region),
          last = steps.at(-1)!;
        assert.ok(Math.abs(last.cumRain - 123.4) < 1e-8);
        assert.ok(Math.abs(last.cumRain - last.cumInf - last.cumRunoff) < 1e-8);
        assert.ok(steps.every((s) => s.runoff >= -1e-8 && s.infiltration >= 0));
        assert.equal(last.time, hours * 60);
      }
  const allPaved = runSimulation(100, 6, 'clay', 1, 2).at(-1)!;
  assert.equal(allPaved.cumInf, 0);
  assert.ok(Math.abs(allPaved.cumRunoff - 100) < 1e-8);
  assert.throws(() => runSimulation(100, 6, 'clay', NaN, 2));
  assert.throws(() => runSimulation(-1, 6, 'clay', 0.5, 2));
  assert.equal(roundUpPipe(1201), Infinity);
});
test('approved IDF import rejects invalid, infinite and overflow coefficients and retains provenance', () => {
  const p = {
    name: 'Authorised profile',
    state: 'Sabah',
    source: 'https://example.org/profile',
    lambda: 60,
    kappa: 0.15,
    theta: 0.1,
    eta: 0.8,
  };
  assert.equal(parseApprovedProfile(p).source, p.source);
  for (const bad of [
    { lambda: Infinity },
    { eta: NaN },
    { theta: -1 },
    { lambda: 0 },
    { kappa: 1e308 },
    { source: 'http://example.org' },
    { source: 'https://' },
  ])
    assert.throws(() => parseApprovedProfile({ ...p, ...bad }));
  assert.throws(() => parseApprovedProfile(null));
});
test('East Malaysian sites cannot inherit a selected Peninsular rainfall profile', () => {
  const ampang = DESIGN_STATIONS.find((s) => s.id === '3117070')!;
  assert.equal(profileForLocation(ampang, 101.4), ampang);
  assert.equal(profileForLocation(ampang, 116), null);
  assert.equal(profileForLocation(ampang, 110.3), null);
  const custom = parseApprovedProfile({
    ...ampang,
    state: 'Sabah',
    source: 'https://example.org/approved-profile',
  });
  assert.equal(profileForLocation(custom, 116), custom);
});
test('official parcels preserve provider area and unknown building, valuation and year fields', () => {
  const parcel = parcelResult({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [101.39, 3.13] },
    properties: { UPI: '10017100428681', LOT: '28681', MUKIM: '71', KELUASAN: 148.621 },
  });
  assert.equal(parcel.lotSize, '148.62');
  assert.equal(parcel.accountNumber, '10017100428681');
  assert.equal(parcel.totalGrossArea, '');
  assert.equal(parcel.yearBuilt, '');
  assert.equal(parcel.assessedValue, null);
  assert.equal(parcel.source, GIS_DATASETS.parcels.url);
});
test('dataset routes reject invalid locations, dates, wide queries and unknown datasets before fetching', async () => {
  let calls = 0;
  const api = createDatasetApi(async () => {
    calls++;
    throw new Error('unexpected fetch');
  });
  for (const [path, status] of [
    ['/api/site?lat=0&lng=0', 400],
    ['/api/site?lat=NaN&lng=101', 400],
    ['/api/gis?id=drainage&bbox=-113,53,-112,54', 400],
    ['/api/gis?id=parcels&bbox=100,2,102,4', 400],
    ['/api/osm?id=buildings&bbox=100,2,102,4', 400],
    ['/api/gis?id=__proto__', 404],
    ['/api/osm?id=https://example.org', 404],
    ['/api/climate?lat=3&lng=101&from=2026-02-31&to=2026-03-05', 400],
    ['/api/discharge?lat=3&lng=101&from=2020-01-01&to=2026-01-01', 400],
  ] as const)
    assert.equal((await api(new URL(path, 'http://localhost')))?.status, status, path);
  assert.equal(calls, 0);
});
test('GIS requests coalesce, cache and use a bounded official query with GeoJSON geometry', async () => {
  let calls = 0,
    requested = '';
  const api = createDatasetApi(async (target) => {
    calls++;
    requested = String(target);
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }));
  });
  const url = new URL('http://localhost/api/gis?id=drainage&bbox=101.38,3.01,101.49,3.12');
  const [first, second] = await Promise.all([api(url), api(url)]);
  assert.equal(calls, 1);
  assert.equal(first?.status, 200);
  assert.deepEqual(first, second);
  await api(url);
  assert.equal(calls, 1);
  const upstream = new URL(requested);
  assert.equal(upstream.origin, 'https://gis.mpklang.gov.my');
  assert.equal(upstream.searchParams.get('f'), 'geojson');
  assert.equal(upstream.searchParams.get('resultRecordCount'), '600');
  assert.equal(upstream.searchParams.get('outSR'), '4326');
});
test('provider and incomplete Overpass failures stay explicit, never become empty successful inventories', async () => {
  for (const [path, body] of [
    ['/api/gis?id=drainage', { error: { message: 'Unavailable' } }],
    ['/api/osm?id=buildings', { elements: [], remark: 'runtime error: Query timed out' }],
  ] as const) {
    const api = createDatasetApi(async () => new Response(JSON.stringify(body)));
    assert.equal((await api(new URL(path, 'http://localhost')))?.status, 502);
  }
});
test('historical provider schema changes fail explicitly rather than crashing the chart', async () => {
  const api = createDatasetApi(
    async () =>
      new Response(
        JSON.stringify({
          latitude: 3,
          longitude: 101,
          daily: { time: ['2021-12-15'], precipitation_sum: ['missing'] },
        }),
      ),
  );
  assert.equal(
    (await api(new URL('http://localhost/api/climate?lat=3&lng=101&from=2021-12-15&to=2021-12-16')))
      ?.status,
    502,
  );
});
