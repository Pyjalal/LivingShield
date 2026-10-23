import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { TOWNSHIPS } from '../src/township/model.ts';

const catalogueUrl = 'https://bfppub.blob.core.windows.net/%24web/2026-08-13/dataset-links.csv';
const providerUrl = 'https://github.com/microsoft/GlobalMLBuildingFootprints';
const licenceUrl = 'https://cdla.dev/permissive-2-0/';
const licenceText = `Community Data License Agreement - Permissive - Version 2.0

This is the Community Data License Agreement - Permissive, Version 2.0 (the "agreement"). Data Provider(s) and Data Recipient(s) agree as follows:

1. Provision of the Data

1.1. A Data Recipient may use, modify, and share the Data made available by Data Provider(s) under this agreement if that Data Recipient follows the terms of this agreement.

1.2. This agreement does not impose any restriction on a Data Recipient's use, modification, or sharing of any portions of the Data that are in the public domain or that may be used, modified, or shared under any other legal exception or limitation.

2. Conditions for Sharing Data

2.1. A Data Recipient may share Data, with or without modifications, so long as the Data Recipient makes available the text of this agreement with the shared Data.

3. No Restrictions on Results

3.1. This agreement does not impose any restriction or obligations with respect to the use, modification, or sharing of Results.

4. No Warranty; Limitation of Liability

4.1. All Data Recipients receive the Data subject to the following terms:

THE DATA IS PROVIDED ON AN "AS IS" BASIS, WITHOUT REPRESENTATIONS, WARRANTIES OR CONDITIONS OF ANY KIND, EITHER EXPRESS OR IMPLIED INCLUDING, WITHOUT LIMITATION, ANY WARRANTIES OR CONDITIONS OF TITLE, NON-INFRINGEMENT, MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.

NO DATA PROVIDER SHALL HAVE ANY LIABILITY FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING WITHOUT LIMITATION LOST PROFITS), HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE DATA OR RESULTS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

5. Definitions

5.1. "Data" means the material received by a Data Recipient under this agreement.

5.2. "Data Provider" means any person who is the source of Data provided under this agreement and in reliance on a Data Recipient's agreement to its terms.

5.3. "Data Recipient" means any person who receives Data directly or indirectly from a Data Provider and agrees to the terms of this agreement.

5.4. "Results" means any outcome obtained by computational analysis of Data, including for example machine learning models and models' insights.
`;
const destination = fileURLToPath(new URL('../public/data/townships/', import.meta.url));
const provider = 'Microsoft Global ML Building Footprints';

function boundsOf(geometry) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (coordinates) => {
    if (typeof coordinates[0] === 'number') {
      if (coordinates.length < 2 || !coordinates.every(Number.isFinite)) throw new Error('Invalid source coordinates');
      bounds[0] = Math.min(bounds[0], coordinates[0]); bounds[1] = Math.min(bounds[1], coordinates[1]);
      bounds[2] = Math.max(bounds[2], coordinates[0]); bounds[3] = Math.max(bounds[3], coordinates[1]);
    } else for (const child of coordinates) visit(child);
  };
  visit(geometry.coordinates);
  return bounds;
}

const intersectsBounds = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
const polygonsOf = (geometry) => geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const onSegment = (a, b, point) => Math.abs(cross(a, b, point)) < 1e-12 && point[0] >= Math.min(a[0], b[0]) - 1e-12 && point[0] <= Math.max(a[0], b[0]) + 1e-12 && point[1] >= Math.min(a[1], b[1]) - 1e-12 && point[1] <= Math.max(a[1], b[1]) + 1e-12;

function segmentsIntersect(a, b, c, d) {
  const c1 = cross(a, b, c); const c2 = cross(a, b, d);
  const c3 = cross(c, d, a); const c4 = cross(c, d, b);
  return (c1 * c2 < 0 && c3 * c4 < 0) || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]; const b = ring[j];
    if (onSegment(a, b, point)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, polygon) {
  return pointInRing(point, polygon[0]) && !polygon.slice(1).some((ring) => pointInRing(point, ring));
}

function polygonsIntersect(a, b) {
  for (const ringA of a) for (const ringB of b) {
    for (let i = 1; i < ringA.length; i++) for (let j = 1; j < ringB.length; j++) {
      if (segmentsIntersect(ringA[i - 1], ringA[i], ringB[j - 1], ringB[j])) return true;
    }
  }
  return pointInPolygon(a[0][0], b) || pointInPolygon(b[0][0], a);
}

function quadkey(lon, lat, zoom = 9) {
  const x = Math.floor((lon + 180) / 360 * 2 ** zoom);
  const y = Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** zoom);
  let key = '';
  for (let bit = zoom - 1; bit >= 0; bit--) key += String(((x >> bit) & 1) + 2 * ((y >> bit) & 1));
  return key;
}

function validate(data, township) {
  if (data.type !== 'FeatureCollection' || data.metadata.provider !== provider) throw new Error('Invalid supplement metadata');
  if (new Set(data.features.map((feature) => feature.id)).size !== data.features.length) throw new Error('Duplicate supplemental identities');
  for (const feature of data.features) {
    if (feature.properties.osmId !== undefined || feature.properties.kind !== 'building' || feature.properties.dataSource !== provider) throw new Error('Incorrect provider identity');
    if (!intersectsBounds(boundsOf(feature.geometry), township.bbox)) throw new Error('Feature outside requested pilot bounds');
    for (const polygon of polygonsOf(feature.geometry)) for (const ring of polygon) {
      if (ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))) throw new Error('Unclosed source footprint');
    }
  }
}

await mkdir(destination, { recursive: true });
const args = process.argv.slice(2);
const validateOnly = args.includes('--validate');
const ids = args.filter((arg) => arg !== '--validate');
const pilots = ids.length ? TOWNSHIPS.filter((township) => ids.includes(township.id)) : [...TOWNSHIPS];
if (!pilots.length || ids.some((id) => !TOWNSHIPS.some((township) => township.id === id))) throw new Error('Unknown pilot id');
if (validateOnly) {
  for (const township of pilots) {
    const data = JSON.parse(await readFile(`${destination}/${township.id}-supplement.geojson`, 'utf8'));
    validate(data, township);
    console.log(JSON.stringify({ id: township.id, validated: data.features.length, omittedOsmOverlaps: data.metadata.omittedOsmOverlaps }));
  }
  process.exit(0);
}

const response = await fetch(catalogueUrl, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
const catalogue = (await response.text()).trim().split(/\r?\n/);
const headers = catalogue.shift().replace(/^\uFEFF/, '').split(',');
const rows = catalogue.map((line) => Object.fromEntries(line.split(',').map((value, index) => [headers[index], value.replace(/^"|"$/g, '')])));
const states = [];
for (const township of pilots) {
  const osm = JSON.parse(await readFile(`${destination}/${township.id}.geojson`, 'utf8'));
  const keys = new Set([township.bbox.slice(0, 2), township.bbox.slice(2), [township.bbox[0], township.bbox[3]], [township.bbox[2], township.bbox[1]]].map(([lon, lat]) => quadkey(lon, lat)));
  const sources = rows.filter((row) => row.Location === 'Malaysia' && keys.has(row.QuadKey));
  if (!sources.length) throw new Error(`No Microsoft tile for ${township.id}`);
  states.push({ township, sources, features: [], candidates: 0, overlaps: 0, duplicateCount: 0, ids: new Set(), osmBuildings: osm.features.filter((feature) => feature.properties.kind === 'building').map((feature) => ({ bounds: boundsOf(feature.geometry), polygons: polygonsOf(feature.geometry) })) });
}

const uniqueSources = [...new Map(states.flatMap((state) => state.sources).map((row) => [row.Url, row])).values()];
for (const source of uniqueSources) {
  const targets = states.filter((state) => state.sources.some((row) => row.Url === source.Url));
  const download = await fetch(source.Url, { signal: AbortSignal.timeout(180000) });
  if (!download.ok || !download.body) throw new Error(`Footprint tile HTTP ${download.status}`);
  const input = createInterface({ input: Readable.fromWeb(download.body).pipe(createGunzip()), crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of input) {
    lineNumber++;
    if (!line.trim()) continue;
    const feature = JSON.parse(line);
    if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) continue;
    const bounds = boundsOf(feature.geometry);
    for (const state of targets) {
      if (!intersectsBounds(bounds, state.township.bbox)) continue;
      state.candidates++;
      const polygons = polygonsOf(feature.geometry);
      if (state.osmBuildings.some((osm) => intersectsBounds(bounds, osm.bounds) && polygons.some((polygon) => osm.polygons.some((other) => polygonsIntersect(polygon, other))))) { state.overlaps++; continue; }
      const geometryHash = createHash('sha256').update(JSON.stringify(feature.geometry)).digest('hex');
      if (state.ids.has(geometryHash)) { state.duplicateCount++; continue; }
      state.ids.add(geometryHash);
      const id = `microsoft:${source.QuadKey}:${geometryHash.slice(0, 20)}`;
      state.features.push({ type: 'Feature', id, geometry: feature.geometry, properties: {
        id, kind: 'building', name: null, dataSource: provider, geometrySource: 'machine-inferred',
        sourceUrl: source.Url, providerLine: lineNumber, providerQuadkey: source.QuadKey,
        providerUploadDate: source.UploadDate, providerGeometrySha256: geometryHash,
        confidence: Number.isFinite(feature.properties?.confidence) && feature.properties.confidence >= 0 ? feature.properties.confidence : null,
        providerHeightMetres: Number.isFinite(feature.properties?.height) && feature.properties.height > 0 ? feature.properties.height : null,
        heightMetres: 6, heightSource: 'assumed', heightAssumption: 'Illustrative 6 m rendering height; Microsoft footprint geometry is machine inferred, not a building survey.',
      } });
    }
  }
  console.log(JSON.stringify({ downloadedQuadkey: source.QuadKey, advertisedSize: source.Size, sourceLines: lineNumber, pilots: targets.map((state) => ({ id: state.township.id, candidates: state.candidates, retained: state.features.length, omittedOsmOverlaps: state.overlaps })) }));
}

for (const state of states) {
  const data = { type: 'FeatureCollection', metadata: {
    townshipId: state.township.id, provider, providerUrl, licence: 'CDLA Permissive 2.0', licenceUrl, licenceText,
    attribution: 'Microsoft Global ML Building Footprints; OSM comparison reference © OpenStreetMap contributors (ODbL).',
    sourceUrl: providerUrl, catalogueUrl, catalogueRelease: '2026-08-13', retrievedAt: new Date().toISOString(),
    bbox: state.township.bbox, centre: state.township.centre, featureCount: state.features.length,
    sourceFiles: state.sources.map((row) => ({ url: row.Url, quadkey: row.QuadKey, advertisedSize: row.Size, uploadDate: row.UploadDate })),
    imageryDate: null, geometrySource: 'machine-inferred', heightSource: 'assumed',
    sourceCandidatesInBbox: state.candidates, omittedOsmOverlaps: state.overlaps, omittedDuplicateGeometries: state.duplicateCount,
    overlapPolicy: 'Conservative polygon edge intersection and polygon containment against cached OSM building geometry; any touching or overlapping ML footprint is excluded. No centroid-only deduplication. This may omit adjacent or slightly displaced real buildings.',
    geometryNotes: 'Original Microsoft polygon coordinates retained for selected bbox-intersecting footprints. Render clipped to the pilot window. No manual infill, OSM identities, surveyed heights or cadastral boundaries are invented.',
    limitations: ['ML inference can miss, merge or falsely detect buildings.', 'Catalogue upload date is not the date of underlying satellite imagery; per-footprint imagery dates are unavailable.', 'All rendered heights are illustrative 6 m assumptions, even where a separate provider height estimate exists.', 'Supplementation reduces a public-data gap but does not establish a complete or current building inventory.'],
  }, features: state.features };
  validate(data, state.township);
  const path = `${destination}/${state.township.id}-supplement.geojson`;
  await writeFile(path, `${JSON.stringify(data)}\n`, 'utf8');
  console.log(JSON.stringify({ id: state.township.id, path, features: data.features.length, bytes: Buffer.byteLength(JSON.stringify(data)) }));
}
