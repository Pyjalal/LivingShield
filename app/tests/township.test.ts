import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Polygon } from 'geojson';
import {
  geometryAreaM2,
  parseBuildingHeight,
  parseHeightMetres,
  polygonAreaM2,
  projectPosition,
  unprojectPosition,
} from '../src/township/geometry.ts';
import { calculateTownshipScenario, TOWNSHIPS } from '../src/township/model.ts';
import type { TownshipDataset, TownshipSupplementDataset } from '../src/township/model.ts';
import { sanitizeProposals } from '../src/township/planning.ts';

test('corrupt saved concepts cannot introduce inherited keys, duplicate IDs or invalid capacities', () => {
  const valid = { id: 1, type: 'basin', x: 0, z: 0 };
  assert.deepEqual(
    sanitizeProposals([
      null,
      'bad',
      { ...valid, type: 'constructor' },
      { ...valid, type: 'toString' },
      { ...valid, id: 2, x: Infinity },
      { ...valid, id: 3, z: 751 },
      valid,
      valid,
    ]),
    [valid],
  );
  assert.deepEqual(sanitizeProposals({}), []);
  assert.equal(
    sanitizeProposals(Array.from({ length: 35 }, (_, id) => ({ ...valid, id }))).length,
    30,
  );
});

test('township projection uses centred metre coordinates and an invertible north-facing scene', () => {
  const centre: [number, number] = [101.437697, 3.0852015];
  assert.deepEqual(projectPosition(centre, centre), [0, -0]);
  const east = projectPosition([centre[0] + 0.001, centre[1]], centre);
  const north = projectPosition([centre[0], centre[1] + 0.001], centre);
  assert.ok(east[0] > 110 && east[0] < 112 && east[1] === 0);
  assert.ok(north[1] < -110 && north[1] > -112 && north[0] === 0);
  const local = [605.123, -412.987];
  const roundTrip = projectPosition(unprojectPosition(local, centre), centre);
  assert.ok(Math.abs(roundTrip[0] - local[0]) < 1e-7);
  assert.ok(Math.abs(roundTrip[1] - local[1]) < 1e-7);
  assert.ok(Math.abs(projectPosition([-179.999, 0], [179.999, 0])[0]) < 223);
  assert.throws(() => projectPosition([NaN, 3], centre));
  assert.throws(() => projectPosition([101, 91], centre));
  assert.throws(() => unprojectPosition([Infinity, 0], centre));
});

test('polygon area subtracts courtyards regardless of ring winding and sums disjoint footprints', () => {
  const centre: [number, number] = [102.733172, 2.173274];
  const ring = (points: number[][]) => points.map((point) => unprojectPosition(point, centre));
  const outer = ring([
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
    [0, 0],
  ]);
  const hole = ring([
    [25, 25],
    [50, 25],
    [50, 50],
    [25, 50],
    [25, 25],
  ]);
  assert.ok(Math.abs(polygonAreaM2([outer, hole], centre) - 9375) < 1e-5);
  assert.ok(
    Math.abs(polygonAreaM2([[...outer].reverse(), [...hole].reverse()], centre) - 9375) < 1e-5,
  );
  const polygon: Polygon = { type: 'Polygon', coordinates: [outer, hole] };
  assert.ok(Math.abs(geometryAreaM2(polygon, centre) - 9375) < 1e-5);
  assert.ok(
    Math.abs(
      geometryAreaM2({ type: 'MultiPolygon', coordinates: [[outer], [hole]] }, centre) - 10625,
    ) < 1e-5,
  );
  assert.equal(polygonAreaM2([], centre), 0);
});

test('OSM heights preserve units and distinguish tagged levels from explicit visual assumptions', () => {
  assert.equal(parseHeightMetres('12 m'), 12);
  assert.ok(Math.abs(parseHeightMetres('30 ft')! - 9.144) < 1e-10);
  assert.ok(Math.abs(parseHeightMetres('6\'3"')! - 1.905) < 1e-10);
  for (const value of ['unknown', '-5', '10;12', '6\'15"', 'Infinity', '0', '4 metres high']) {
    assert.equal(parseHeightMetres(value), null);
  }
  assert.deepEqual(parseBuildingHeight({ height: '12 m', 'building:levels': '2' }), {
    heightMetres: 12,
    heightSource: 'osm-height',
    heightAssumption: null,
  });
  const levels = parseBuildingHeight({ height: 'unknown', 'building:levels': '4' });
  assert.equal(levels.heightMetres, 12);
  assert.equal(levels.heightSource, 'osm-levels');
  assert.match(levels.heightAssumption!, /3 m per mapped/);
  const fallback = parseBuildingHeight({ 'building:levels': 'two' });
  assert.equal(fallback.heightMetres, 6);
  assert.equal(fallback.heightSource, 'assumed');
  assert.match(fallback.heightAssumption!, /OSM supplies no usable/);
  assert.throws(() => parseBuildingHeight({}, 0));
});

test('storm volume conserves runoff and caps retention without claiming routed inundation', () => {
  const base = {
    rainfallMm: 100,
    surfaceAreaM2: 250000,
    runoffCoefficient: 0.7,
    retentionCapacityM3: 2000,
  };
  const output = calculateTownshipScenario(base);
  assert.equal(output.rainfallVolumeM3, 25000);
  assert.equal(output.runoffM3, 17500);
  assert.equal(output.retainedM3, 2000);
  assert.equal(output.residualM3, 15500);
  assert.equal(output.retainedM3 + output.residualM3, output.runoffM3);
  const excessCapacity = calculateTownshipScenario({ ...base, retentionCapacityM3: 50000 });
  assert.equal(excessCapacity.retainedM3, 17500);
  assert.equal(excessCapacity.residualM3, 0);
  assert.equal(excessCapacity.retainedPercent, 100);
  for (const runoffCoefficient of [0, 0.2, 0.7, 1]) {
    for (const rainfallMm of [0, 20, 300]) {
      const result = calculateTownshipScenario({ ...base, runoffCoefficient, rainfallMm });
      assert.equal(result.runoffM3, result.retainedM3 + result.residualM3);
      assert.ok(result.retainedM3 >= 0 && result.retainedM3 <= result.runoffM3);
      assert.ok(result.retainedPercent >= 0 && result.retainedPercent <= 100);
    }
  }
  assert.throws(() => calculateTownshipScenario({ ...base, runoffCoefficient: 1.1 }));
  assert.throws(() => calculateTownshipScenario({ ...base, retentionCapacityM3: -1 }));
  assert.throws(() => calculateTownshipScenario({ ...base, rainfallMm: NaN }));
  assert.throws(() =>
    calculateTownshipScenario({ ...base, rainfallMm: 1e308, surfaceAreaM2: 1e308 }),
  );
});

test('checked-in township pilots retain real OSM identities, geometry and dated licence provenance', async () => {
  assert.deepEqual(
    TOWNSHIPS.map((township) => township.id),
    ['bukit-raja', 'pagoh', 'elmina'],
  );
  for (const township of TOWNSHIPS) {
    assert.match(township.extentDescription, /not an official township boundary/);
    const dataset: TownshipDataset = JSON.parse(
      await readFile(new URL(`../public${township.dataUrl}`, import.meta.url), 'utf8'),
    );
    assert.equal(dataset.type, 'FeatureCollection');
    assert.equal(dataset.metadata.townshipId, township.id);
    assert.ok(Number.isFinite(Date.parse(dataset.metadata.retrievedAt)));
    assert.ok(Number.isFinite(Date.parse(dataset.metadata.osmBaseTimestamp!)));
    assert.match(dataset.metadata.licence, /ODbL/);
    assert.equal(dataset.metadata.attribution, '© OpenStreetMap contributors');
    assert.equal(
      dataset.metadata.counts.building +
        dataset.metadata.counts.road +
        dataset.metadata.counts.water +
        dataset.metadata.counts.green,
      dataset.features.length,
    );
    assert.ok(dataset.metadata.counts.building > 0 && dataset.metadata.counts.road > 0);
    const audit = dataset.metadata.audit;
    assert.equal(audit.footprintCount, dataset.metadata.counts.building);
    assert.equal(
      audit.explicitHeightCount + audit.mappedLevelsHeightCount + audit.assumedHeightCount,
      audit.footprintCount,
    );
    assert.equal(audit.assumedHeightFraction, audit.assumedHeightCount / audit.footprintCount);
    assert.equal(audit.surveyedHeightCount, null);
    assert.ok(dataset.metadata.identityChecks.length > 0);
    for (const example of [
      ...audit.namedBuildings,
      ...audit.roadExamples,
      ...audit.waterExamples,
    ]) {
      assert.ok(
        dataset.features.some(
          (feature) =>
            feature.properties.id === example.id && feature.properties.name === example.name,
        ),
      );
      assert.ok(example.bboxCentre.every(Number.isFinite));
    }
    if (township.id === 'pagoh')
      assert.ok(
        audit.coverageNotes.some((note) => note.includes('not the township building total')),
      );
    assert.equal(
      new Set(dataset.features.map((feature) => feature.id)).size,
      dataset.features.length,
    );
    for (const feature of dataset.features) {
      assert.ok(typeof feature.properties.osmId === 'number' && feature.properties.osmId > 0);
      assert.equal(
        feature.properties.sourceUrl,
        `https://www.openstreetmap.org/${feature.properties.id}`,
      );
      const numbers = feature.geometry.coordinates.flat(Infinity) as number[];
      assert.ok(numbers.length >= 4 && numbers.every(Number.isFinite));
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const polygons =
          feature.geometry.type === 'Polygon'
            ? [feature.geometry.coordinates]
            : feature.geometry.coordinates;
        for (const polygon of polygons)
          for (const ring of polygon) {
            assert.ok(ring.length >= 4);
            assert.deepEqual(ring[0], ring.at(-1));
          }
      }
      if (feature.properties.kind === 'building') {
        assert.ok(feature.properties.heightMetres! > 0);
        assert.ok(
          ['osm-height', 'osm-levels', 'assumed'].includes(feature.properties.heightSource!),
        );
        if (feature.properties.heightSource !== 'osm-height')
          assert.ok(feature.properties.heightAssumption);
      }
    }
  }
});

test('supplemental footprints retain source hashes, bounded real geometry and separate provider licensing', async () => {
  const bounds = (coordinates: unknown): number[] => {
    const positions: number[][] = [];
    const visit = (value: unknown) => {
      assert.ok(Array.isArray(value));
      if (typeof value[0] === 'number') {
        assert.ok(value.length >= 2 && value.every(Number.isFinite));
        positions.push(value as number[]);
      } else value.forEach(visit);
    };
    visit(coordinates);
    return [
      Math.min(...positions.map((p) => p[0])),
      Math.min(...positions.map((p) => p[1])),
      Math.max(...positions.map((p) => p[0])),
      Math.max(...positions.map((p) => p[1])),
    ];
  };
  const disjoint = (a: number[], b: number[]) =>
    a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];
  const representatives: Record<string, string> = {
    'bukit-raja': 'microsoft:132232022:99a29669af028aa42dcd',
    pagoh: 'microsoft:132232210:41684bb259d51d79a495',
    elmina: 'microsoft:132232022:e50f39a90573ae0435d8',
  };
  for (const township of TOWNSHIPS) {
    const dataset: TownshipSupplementDataset = JSON.parse(
      await readFile(
        new URL(`../public/data/townships/${township.id}-supplement.geojson`, import.meta.url),
        'utf8',
      ),
    );
    const osm: TownshipDataset = JSON.parse(
      await readFile(new URL(`../public${township.dataUrl}`, import.meta.url), 'utf8'),
    );
    const metadata = dataset.metadata;
    assert.equal(metadata.provider, 'Microsoft Global ML Building Footprints');
    assert.equal(metadata.licence, 'CDLA Permissive 2.0');
    assert.equal(metadata.licenceUrl, 'https://cdla.dev/permissive-2-0/');
    assert.match(metadata.licenceText, /2\.1\. A Data Recipient may share Data/);
    assert.match(metadata.licenceText, /5\.4\. "Results" means/);
    assert.equal(metadata.imageryDate, null);
    assert.ok(Number.isFinite(Date.parse(metadata.retrievedAt)));
    assert.deepEqual(metadata.bbox, township.bbox);
    assert.equal(metadata.featureCount, dataset.features.length);
    assert.ok(dataset.features.length > 0);
    assert.equal(
      metadata.sourceCandidatesInBbox,
      dataset.features.length + metadata.omittedOsmOverlaps + metadata.omittedDuplicateGeometries,
    );
    assert.equal(
      new Set(dataset.features.map((feature) => feature.id)).size,
      dataset.features.length,
    );
    for (const feature of dataset.features) {
      const properties = feature.properties;
      assert.equal(properties.osmId, undefined);
      assert.equal(properties.osmType, undefined);
      assert.equal(properties.kind, 'building');
      assert.equal(properties.name, null);
      assert.equal(properties.dataSource, metadata.provider);
      assert.equal(properties.geometrySource, 'machine-inferred');
      assert.equal(properties.heightMetres, 6);
      assert.equal(properties.heightSource, 'assumed');
      assert.equal(properties.providerHeightMetres, null);
      assert.match(properties.heightAssumption!, /not a building survey/);
      const source = metadata.sourceFiles.find((file) => file.url === properties.sourceUrl);
      assert.ok(source);
      assert.equal(source.quadkey, properties.providerQuadkey);
      assert.equal(source.uploadDate, properties.providerUploadDate);
      assert.ok(Number.isInteger(properties.providerLine) && properties.providerLine! > 0);
      const hash = createHash('sha256').update(JSON.stringify(feature.geometry)).digest('hex');
      assert.equal(properties.providerGeometrySha256, hash);
      assert.equal(feature.id, `microsoft:${source.quadkey}:${hash.slice(0, 20)}`);
      assert.equal(properties.id, feature.id);
      assert.ok(!disjoint(bounds(feature.geometry.coordinates), township.bbox));
      assert.ok(feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon');
      const polygons =
        feature.geometry.type === 'Polygon'
          ? [feature.geometry.coordinates]
          : feature.geometry.coordinates;
      for (const polygon of polygons)
        for (const ring of polygon) {
          assert.ok(ring.length >= 4);
          assert.deepEqual(ring[0], ring.at(-1));
        }
    }
    const sample = dataset.features.find((feature) => feature.id === representatives[township.id]);
    assert.ok(sample);
    const sampleBounds = bounds(sample.geometry.coordinates);
    assert.ok(
      osm.features
        .filter((feature) => feature.properties.kind === 'building')
        .every((feature) => disjoint(sampleBounds, bounds(feature.geometry.coordinates))),
    );
  }
});
