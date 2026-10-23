import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import {
  DESIGN_STATIONS,
  intensity,
  profileForLocation,
  calculateDesign,
} from '../src/malaysia/design.ts';
import { temporalPattern } from '../src/malaysia/settings.ts';
import { runSimulation } from '../src/malaysia/simulation.ts';
import { normalizeSabahSnapshots, normalizeSoil } from '../server/national.ts';
import { createDatasetApi } from '../server/datasets.ts';
import {
  NATIONAL_DATASETS,
  datasetSupportsRegion,
  defaultWaterDataset,
  floodDatasetAt,
} from '../src/malaysia/catalogue.ts';
import { hazardTile, hazardSource, rasterCell } from '../server/hazard.ts';
import { rgbaPNG, tileCoordinates, depthColor, createHazardTiles } from '../server/hazard-tiles.ts';
test('all 174 HP26 profiles retain regional counts and published Semporna/Bunan Gega examples', () => {
  const stations = DESIGN_STATIONS.filter((s) => s.family === 'hp26');
  assert.equal(DESIGN_STATIONS.length, 309);
  assert.equal(new Set(DESIGN_STATIONS.map((s) => s.id)).size, 309);
  for (const [state, count] of [
    ['Sabah', 53],
    ['Sarawak', 120],
    ['Labuan', 1],
  ] as const)
    assert.equal(stations.filter((s) => s.state === state).length, count);
  for (const s of stations) {
    assert.ok(s.lat! > 0.5 && s.lat! < 8 && s.lng! > 108 && s.lng! < 120);
    assert.throws(() => intensity(s, 14.99, 10));
    assert.ok(intensity(s, 15, 2) > intensity(s, 4320, 2));
    assert.equal(profileForLocation(s, 116), s);
    assert.equal(profileForLocation(s, 101), null);
  }
  assert.ok(
    Math.abs(
      intensity(
        stations.find((s) => s.id === '0890011RF')!,
        60,
        10,
      ) - 81.7599955998,
    ) < 1e-8,
  );
  assert.ok(
    Math.abs(
      intensity(
        stations.find((s) => s.id === '1790061RF')!,
        1440,
        100,
      ) - 10.311582146,
    ) < 1e-8,
  );
  const design = calculateDesign({
    station: stations[0],
    area: 10000,
    before: 0.25,
    after: 0.8,
    tc: 15,
    ari: 25,
    slope: 0.005,
    roughness: 0.013,
    release: 20,
    pipeLength: 100,
    pipeRate: 50,
    storageRate: 10,
  });
  assert.ok(design.rain > 0 && design.post > design.pre);
});
test('all nine HP26 pattern regions conserve storm rainfall, infiltration and runoff', () => {
  for (let region = 1; region <= 9; region++)
    for (const d of [15, 30, 60, 180, 360, 720, 1440, 2880, 4320]) {
      const weights = temporalPattern(region, d, 'hp26');
      assert.ok(Math.abs(weights.reduce((s, v) => s + v, 0) - 1) < 1e-12);
      const last = runSimulation(123.4, d / 60, 'clay', 0.4, region, 'hp26').at(-1)!;
      assert.ok(Math.abs(last.cumRain - 123.4) < 1e-8);
      assert.ok(Math.abs(last.cumRain - last.cumInf - last.cumRunoff) < 1e-8);
    }
  assert.throws(() => temporalPattern(6, 60, 'msma'));
  assert.throws(() => temporalPattern(1, 5, 'hp26'));
});
test('regional discovery selects local water sources and preserves agency flood gaps', () => {
  assert.equal(defaultWaterDataset('Sabah'), 'national-river-polygons');
  assert.equal(defaultWaterDataset('Sarawak'), 'national-river-polygons');
  assert.equal(defaultWaterDataset('Labuan'), 'labuan-reservoirs');
  assert.equal(defaultWaterDataset('Klang / Selangor'), 'drainage');
  assert.equal(datasetSupportsRegion(NATIONAL_DATASETS['sarawak-rivers'], 'Sabah'), false);
  assert.equal(datasetSupportsRegion(NATIONAL_DATASETS['sarawak-rivers'], 'Sarawak'), true);
  assert.equal(datasetSupportsRegion(NATIONAL_DATASETS['sabah-roads'], 'Malaysia'), true);
  assert.equal(floodDatasetAt(116, 6), null);
  assert.equal(floodDatasetAt(110.3, 1.5), null);
  assert.equal(floodDatasetAt(103.3, 3.8), 'peninsular-flood-prone');
});
test('Sabah snapshots whitelist properties, reject future/impossible dates and retain missing values', () => {
  const base = {
    stationId: 'S1',
    stationName: 'A',
    latitude: '6',
    longitude: '116',
    lastUpdate: '2026-10-19T10:00:00',
    stationStatus: 'Online',
    rf1hour: 0,
    dailyrf: -9999,
    gsm: 'private contact',
    dangerLevel: 9900,
  };
  const now = Date.parse('2026-10-19T11:00:00+08:00');
  const features = normalizeSabahSnapshots(
    [
      base,
      { ...base, lastUpdate: '2026-12-13T10:00:00' },
      { ...base, lastUpdate: '2026-02-31T10:00:00' },
      { ...base, rf1hour: -9999 },
    ],
    'rain',
    now,
  ).features;
  assert.equal(features[0].properties?.current, true);
  assert.equal(features[0].properties?.rainfall1h_mm, 0);
  assert.equal(features[0].properties?.rainfall_daily_mm, null);
  assert.equal(features[1].properties?.observed_at, null);
  assert.equal(features[2].properties?.observed_at, null);
  assert.equal(features[3].properties?.current, false);
  assert.ok(!JSON.stringify(features).includes('private contact'));
  assert.ok(!JSON.stringify(features).includes('9900'));
});
test('SoilGrids conversion preserves nulls and never invents hydraulic conductivity', () => {
  const raw = {
    properties: {
      layers: ['clay', 'sand', 'silt'].map((name, i) => ({
        name,
        unit_measure: { d_factor: 10, mapped_units: 'g/kg' },
        depths: [{ label: '0-5cm', values: { mean: i === 2 ? null : [407, 303][i] } }],
      })),
    },
  };
  const soil = normalizeSoil(raw);
  assert.equal(soil.texture[0].percent, 40.7);
  assert.equal(soil.texture[1].percent, 30.3);
  assert.equal(soil.texture[2].percent, null);
  assert.ok(!('Ks' in soil));
  assert.throws(() => normalizeSoil({ properties: { layers: [] } }));
});
test('regional GIS adapters respect nonpagination, public field allowlists and Esri paths', async () => {
  let target = '';
  const api = createDatasetApi(async (url) => {
    target = String(url);
    return new Response(
      JSON.stringify(
        target.includes('roadmaintenance')
          ? {
              features: [
                {
                  attributes: { road_name: 'Jalan A' },
                  geometry: {
                    paths: [
                      [
                        [116, 6],
                        [116.01, 6.01],
                      ],
                    ],
                  },
                },
              ],
            }
          : { type: 'FeatureCollection', features: [] },
      ),
    );
  });
  await api(new URL('http://local/api/gis?id=sarawak-landuse&bbox=110.3,1.4,110.4,1.5'));
  assert.equal(new URL(target).searchParams.has('resultRecordCount'), false);
  await api(new URL('http://local/api/gis?id=sarawak-paddy-lots&bbox=110.3,1.4,110.4,1.5'));
  assert.equal(new URL(target).searchParams.get('outFields')?.includes('owner'), false);
  const road = await api(new URL('http://local/api/gis?id=sabah-roads&bbox=116,6,116.01,6.01'));
  assert.equal(new URL(target).searchParams.get('f'), 'json');
  assert.equal(
    (road?.body as { data: { features: { geometry: { type: string } }[] } }).data.features[0]
      .geometry.type,
    'LineString',
  );
  assert.equal((await api(new URL('http://local/api/hazard?lat=6&lng=116&ari=5')))?.status, 400);
});
test('flood raster selection respects shifted seams, pixel direction and fixed allowlist', () => {
  assert.equal(hazardTile(99.7), 'ID202_N10_E90');
  assert.equal(hazardTile(109.98), 'ID220_N10_E110');
  assert.throws(() => hazardSource('https://example.org', 100));
  const grid = {
    getOrigin: () => [110, 10],
    getResolution: () => [0.1, -0.1],
    getWidth: () => 100,
    getHeight: () => 100,
  };
  assert.deepEqual(rasterCell(grid, 9.85, 110.15), {
    col: 1,
    row: 1,
    cellBounds: [110.1, 9.8, 110.2, 9.9],
  });
  assert.equal(rasterCell(grid, 11, 110), null);
  const tile = tileCoordinates(10, 841, 495);
  assert.ok(tile.west < tile.east && tile.south < tile.north && tile.latAt(0) > tile.latAt(255));
  assert.deepEqual(depthColor(3), [168, 85, 247, 210]);
});
test('PNG encoding produces a valid RGBA raster; invalid and low-zoom tiles never fetch upstream', async () => {
  const png = rgbaPNG(new Uint8Array([56, 189, 248, 180]), 1, 1);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const size = png.readUInt32BE(33);
  assert.deepEqual([...inflateSync(png.subarray(41, 41 + size))], [0, 56, 189, 248, 180]);
  const api = createHazardTiles();
  assert.equal((await api(new URL('http://local/api/hazard-tiles/100/5/1/1.png')))?.status, 400);
  assert.equal((await api(new URL('http://local/api/hazard-tiles/999/12/1/1.png')))?.status, 400);
});
