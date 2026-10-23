import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TOWNSHIPS } from '../src/township/model.ts';
import { parseBuildingHeight } from '../src/township/geometry.ts';

const destination = fileURLToPath(new URL('../public/data/townships/', import.meta.url));
const endpoints = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const allowedTags = new Set([
  'name', 'name:en', 'building', 'height', 'building:height', 'building:levels', 'source:height',
  'highway', 'waterway', 'water', 'natural', 'landuse', 'leisure', 'surface', 'width', 'bridge', 'tunnel',
]);

function category(tags = {}) {
  if (tags.building && tags.building !== 'no') return 'building';
  if (tags.natural === 'water' || tags.water || tags.waterway) return 'water';
  if (tags.highway) return 'road';
  if (['wood', 'grassland', 'wetland', 'scrub'].includes(tags.natural) ||
    ['forest', 'grass', 'recreation_ground', 'meadow', 'orchard', 'allotments'].includes(tags.landuse) ||
    ['park', 'garden', 'nature_reserve', 'pitch'].includes(tags.leisure)) return 'green';
  return null;
}

const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const valid = (point) => point && Number.isFinite(point.lon) && Number.isFinite(point.lat);
const positions = (geometry = []) => geometry.every(valid) ? geometry.map((point) => [point.lon, point.lat]) : [];
const isRing = (ring) => ring.length >= 4 && same(ring[0], ring.at(-1));

function geometryBounds(geometry) {
  const points = [];
  const collect = (coordinates) => {
    if (typeof coordinates[0] === 'number') points.push(coordinates);
    else for (const part of coordinates) collect(part);
  };
  collect(geometry.coordinates);
  return [
    Math.min(...points.map((point) => point[0])), Math.min(...points.map((point) => point[1])),
    Math.max(...points.map((point) => point[0])), Math.max(...points.map((point) => point[1])),
  ];
}

function auditFeatures(township, features) {
  const buildings = features.filter((feature) => feature.properties.kind === 'building');
  const heightCount = (source) => buildings.filter((feature) => feature.properties.heightSource === source).length;
  const extents = features.map((feature) => geometryBounds(feature.geometry));
  const featuresExtendingBeyondWindow = { building: 0, road: 0, water: 0, green: 0 };
  for (let index = 0; index < features.length; index++) {
    const extent = extents[index];
    if (extent[0] < township.bbox[0] || extent[1] < township.bbox[1] ||
      extent[2] > township.bbox[2] || extent[3] > township.bbox[3]) featuresExtendingBeyondWindow[features[index].properties.kind]++;
  }
  const named = (kind) => features.filter((feature) => feature.properties.kind === kind && feature.properties.name);
  const examples = (kind, limit) => named(kind).filter((feature, index, items) => items.findIndex((item) => item.properties.name === feature.properties.name) === index).slice(0, limit).map((feature) => {
    const bounds = geometryBounds(feature.geometry);
    return {
      id: feature.properties.id, name: feature.properties.name, sourceUrl: feature.properties.sourceUrl,
      bboxCentre: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
    };
  });
  return {
    footprintCount: buildings.length,
    explicitHeightCount: heightCount('osm-height'), mappedLevelsHeightCount: heightCount('osm-levels'),
    assumedHeightCount: heightCount('assumed'), assumedHeightFraction: buildings.length ? heightCount('assumed') / buildings.length : 0,
    surveyedHeightCount: null,
    sourceGeometryBounds: [Math.min(...extents.map((bounds) => bounds[0])), Math.min(...extents.map((bounds) => bounds[1])), Math.max(...extents.map((bounds) => bounds[2])), Math.max(...extents.map((bounds) => bounds[3]))],
    featuresExtendingBeyondWindow,
    namedRoadCount: new Set(named('road').map((feature) => feature.properties.name)).size,
    namedWaterCount: new Set(named('water').map((feature) => feature.properties.name)).size,
    namedBuildings: examples('building', 10), roadExamples: examples('road', 12), waterExamples: examples('water', 10),
    coverageNotes: [
      'Mapped OSM footprints and roads are real source geometry, not a complete asset inventory or an official township boundary.',
      'Building heights lack survey evidence. An OSM level count still requires an assumed 3 m per level; all other untagged heights use an illustrative 6 m.',
      'Whole OSM ways are retained and may extend outside the query window; clip rendering to the stated window without changing source geometry.',
      'Named-feature coordinates below are geometry-bounds centres for map inspection, not surveyed entrances or precise centroids.',
      ...(township.id === 'pagoh' ? [`${buildings.length} building footprints are mapped in this cached gallery-area window. This is not the township building total. Missing buildings are not infilled; compare aerial imagery to inspect the mapping gap.`] : []),
      ...(township.id === 'elmina' ? ['The OSM representative point is in the Elmina Pavilion / Ilham vicinity; it is not the current Elmina West sales-gallery location or a verified City of Elmina centre.'] : []),
    ],
  };
}

function stitchRings(segments) {
  const remaining = segments.map((segment) => segment.map((point) => [...point]));
  const rings = [];
  while (remaining.length) {
    const ring = remaining.shift();
    while (!same(ring[0], ring.at(-1))) {
      const index = remaining.findIndex((segment) => same(ring.at(-1), segment[0]) || same(ring.at(-1), segment.at(-1)));
      if (index < 0) return null;
      const segment = remaining.splice(index, 1)[0];
      if (!same(ring.at(-1), segment[0])) segment.reverse();
      ring.push(...segment.slice(1));
    }
    if (!isRing(ring)) return null;
    rings.push(ring);
  }
  return rings;
}

function contains(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function elementGeometry(element, kind) {
  if (element.type === 'way') {
    const points = positions(element.geometry);
    if (points.length < 2) return null;
    const area = kind === 'building' || kind === 'green' ||
      (kind === 'water' && (element.tags?.natural === 'water' || element.tags?.water));
    if (area) return isRing(points) ? { type: 'Polygon', coordinates: [points] } : null;
    return { type: 'LineString', coordinates: points };
  }
  if (element.type !== 'relation') return null;
  const members = element.members?.filter((member) => member.type === 'way') ?? [];
  if (members.length === 0) return null;
  if (members.some((member) => positions(member.geometry).length < 2)) return null;
  const outer = stitchRings(members.filter((member) => !member.role || member.role === 'outer').map((member) => positions(member.geometry)));
  const inner = stitchRings(members.filter((member) => member.role === 'inner').map((member) => positions(member.geometry)));
  if (!outer?.length || !inner) return null;
  const polygons = outer.map((ring) => [ring]);
  for (const hole of inner) {
    const polygon = polygons.find((rings) => contains(hole[0], rings[0]));
    if (!polygon) return null;
    polygon.push(hole);
  }
  return polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons };
}

function queryFor(township) {
  const [west, south, east, north] = township.bbox;
  const box = `${south},${west},${north},${east}`;
  return `[out:json][timeout:45][maxsize:33554432];(way[building][building!=no](${box});relation[building][building!=no](${box});way[highway](${box});way[natural=water](${box});relation[natural=water](${box});way[waterway](${box});way[natural~"^(wood|grassland|wetland|scrub)$"](${box});relation[natural~"^(wood|grassland|wetland|scrub)$"](${box});way[landuse~"^(forest|grass|recreation_ground|meadow|orchard|allotments)$"](${box});way[leisure~"^(park|garden|nature_reserve|pitch)$"](${box}););out geom;`;
}

async function download(query) {
  const failures = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'HydroGridMalaysia-township-build/1.0' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.elements) || data.remark) throw new Error(data.remark ?? 'Invalid Overpass response');
      return { data, endpoint };
    } catch (error) {
      failures.push(`${endpoint}: ${error.message}`);
    }
  }
  throw new Error(failures.join('; '));
}

async function build(township) {
  const query = queryFor(township);
  const { data, endpoint } = await download(query);
  const consumedWays = new Set();
  const candidates = [];
  let omittedIncompleteFeatures = 0;
  for (const element of [...data.elements].sort((a, b) => (a.type === 'relation' ? -1 : 1) - (b.type === 'relation' ? -1 : 1) || a.id - b.id)) {
    const kind = category(element.tags);
    if (!kind || (element.type === 'way' && consumedWays.has(element.id))) continue;
    const geometry = elementGeometry(element, kind);
    if (!geometry) { omittedIncompleteFeatures++; continue; }
    const tags = Object.fromEntries(Object.entries(element.tags ?? {}).filter(([key, value]) => allowedTags.has(key) && typeof value === 'string'));
    const id = `${element.type}/${element.id}`;
    const name = tags.name ?? tags['name:en'] ?? null;
    const properties = {
      id, osmId: element.id, osmType: element.type, sourceUrl: `https://www.openstreetmap.org/${id}`,
      kind, name, nameSource: name ? 'osm-name' : 'unnamed', tags,
      ...(kind === 'building' ? parseBuildingHeight(tags) : {}),
    };
    candidates.push({ type: 'Feature', id, geometry, properties });
    if (element.type === 'relation') for (const member of element.members ?? []) if (member.type === 'way') consumedWays.add(member.ref);
  }
  const features = candidates.sort((a, b) => a.properties.kind.localeCompare(b.properties.kind) || a.properties.id.localeCompare(b.properties.id));
  const counts = { building: 0, road: 0, water: 0, green: 0 };
  for (const feature of features) counts[feature.properties.kind]++;
  if (!counts.building || !counts.road) throw new Error(`${township.id}: OSM returned no usable buildings or roads; no replacement data written`);
  const metadata = {
    townshipId: township.id, title: township.name, retrievedAt: new Date().toISOString(),
    osmBaseTimestamp: data.osm3s?.timestamp_osm_base ?? null,
    sourceUrl: 'https://www.openstreetmap.org/copyright', queryUrl: endpoint, query,
    attribution: township.source.attribution, licence: township.source.licence, licenceUrl: township.source.licenceUrl,
    bbox: township.bbox, centre: township.centre, extentDescription: township.extentDescription,
    anchorUrl: township.source.anchorUrl, anchorDescription: township.source.anchorDescription,
    heightAssumptions: ['Missing OSM building height defaults to an illustrative 6 m.', 'Mapped building levels use an assumed 3 m per level.', 'Heights are visual only and do not establish surveyed elevations or flood exposure.'],
    geometryNotes: 'Original complete OSM geometry is retained; intersecting features may extend beyond the query window. Closed rings and relation holes are preserved. Incomplete geometry is omitted, never invented.',
    identityChecks: township.identityChecks, audit: auditFeatures(township, features),
    counts, omittedIncompleteFeatures,
  };
  await writeFile(`${destination}/${township.id}.geojson`, `${JSON.stringify({ type: 'FeatureCollection', metadata, features })}\n`, 'utf8');
  console.log(JSON.stringify({ id: township.id, counts, omittedIncompleteFeatures, bytes: Buffer.byteLength(JSON.stringify(features)) }));
}

await mkdir(destination, { recursive: true });
const requested = process.argv.slice(2);
const auditCache = requested.includes('--audit-cache');
const ids = requested.filter((id) => id !== '--audit-cache');
const pilots = ids.length ? TOWNSHIPS.filter((township) => ids.includes(township.id)) : TOWNSHIPS;
if (!pilots.length || ids.some((id) => !TOWNSHIPS.some((township) => township.id === id))) throw new Error('Unknown township id');
for (const township of pilots) {
  if (auditCache) {
    const path = `${destination}/${township.id}.geojson`;
    const data = JSON.parse(await readFile(path, 'utf8'));
    data.metadata.identityChecks = township.identityChecks;
    data.metadata.audit = auditFeatures(township, data.features);
    await writeFile(path, `${JSON.stringify(data)}\n`, 'utf8');
    console.log(JSON.stringify({ id: township.id, audit: data.metadata.audit }));
  } else await build(township);
}
