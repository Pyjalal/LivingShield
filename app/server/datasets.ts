import type { FeatureCollection, Feature, Geometry, Position } from 'geojson';
import { record } from './normalize.ts';
import { NATIONAL_DATASETS, type DatasetDefinition } from '../src/malaysia/catalogue.ts';
import { normalizeSabahSnapshots, normalizeSoil } from './national.ts';
import { queryHazard, HAZARD_ARIS } from './hazard.ts';

const KLANG = 'https://gis.mpklang.gov.my/server/rest/services';
const PLANNING = `${KLANG}/JABATAN_PERANCANG_BANDAR_2024/FeatureServer`;
const ENGINEERING = `${KLANG}/Jabatan_Kejuruteraan/JABATAN_KEJURUTERAAN/FeatureServer`;
const ENGINEERING2 = `${KLANG}/Jabatan_Kejuruteraan/JABATAN_KEJURUTERAAN_ver_2/FeatureServer`;
const SELANGOR = 'https://jpsselgis.selangor.gov.my/gis/rest/services';
export const GIS_DATASETS: Record<
  string,
  { url: string; label: string; coverage: string } & Partial<DatasetDefinition>
> = {
  ...NATIONAL_DATASETS,
  parcels: { url: `${PLANNING}/64`, label: 'MBDK JUPEM 2022 parcels', coverage: 'Klang' },
  landuse: { url: `${PLANNING}/32`, label: 'MBDK current land use', coverage: 'Klang' },
  ponds: { url: `${PLANNING}/4`, label: 'MBDK retention ponds', coverage: 'Klang' },
  drainage: { url: `${ENGINEERING}/7`, label: 'MBDK engineering drains', coverage: 'Klang' },
  'drain-details': {
    url: `${ENGINEERING2}/10`,
    label: 'MBDK drain survey attributes',
    coverage: 'Klang',
  },
  'flood-areas': {
    url: `${ENGINEERING}/14`,
    label: 'MBDK recorded flood areas',
    coverage: 'Klang; return period unspecified',
  },
  'flood-hotspots': {
    url: `${ENGINEERING2}/11`,
    label: 'MBDK flood hotspots',
    coverage: 'Klang; recorded locations, not probabilistic hazard',
  },
  pumps: { url: `${ENGINEERING2}/8`, label: 'MBDK drainage pumps', coverage: 'Klang' },
  flapgates: { url: `${ENGINEERING2}/2`, label: 'MBDK flapgates', coverage: 'Klang' },
  'trash-traps': {
    url: `${ENGINEERING2}/6`,
    label: 'MBDK gross pollutant traps',
    coverage: 'Klang',
  },
  'flood-2021': {
    url: `${SELANGOR}/Banjir_2021/MapServer/2`,
    label: 'JPS Selangor 2021 flood incidents',
    coverage: 'Selangor; observed incident points',
  },
  'jps-ponds': {
    url: `${SELANGOR}/KOLAM_TAKUNGAN_MSMA/MapServer/2`,
    label: 'JPS MSMA ponds',
    coverage: 'Gombak',
  },
};
const OSM_QUERIES: Record<string, string> = {
  buildings: '["building"]',
  schools: '["amenity"="school"]',
  hospitals: '["amenity"="hospital"]',
  rivers: '["waterway"="river"]',
  streams: '["waterway"="stream"]',
  ditches: '["waterway"~"drain|ditch"]',
  reservoirs: '["water"~"reservoir|pond|retention"]',
  parks: '["leisure"="park"]',
  rail: '["railway"~"station|halt"]',
  power: '["power"="substation"]',
  solar: '["generator:source"="solar"]',
  'water-towers': '["man_made"~"water_tower|water_works"]',
  manholes: '["man_made"="manhole"]',
};
class InputError extends Error {}

function point(url: URL) {
  const lat = Number(url.searchParams.get('lat')),
    lng = Number(url.searchParams.get('lng'));
  if (
    !url.searchParams.has('lat') ||
    !url.searchParams.has('lng') ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 0.5 ||
    lat > 8 ||
    lng < 99 ||
    lng > 120
  )
    throw new InputError('Choose a Malaysian location.');
  return { lat, lng };
}
function bounds(url: URL): number[] {
  const v = (url.searchParams.get('bbox') ?? '101.38,3.01,101.49,3.12').split(',').map(Number);
  if (
    v.length !== 4 ||
    v.some((n) => !Number.isFinite(n)) ||
    v[0] >= v[2] ||
    v[1] >= v[3] ||
    v[0] < 98 ||
    v[2] > 121 ||
    v[1] < 0 ||
    v[3] > 9
  )
    throw new InputError('Invalid Malaysian map bounds.');
  return v;
}
function geometryArea(geometry: Geometry | null): number {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return 0;
  function ringArea(ring: Position[]) {
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      area +=
        (((b[0] - a[0]) * Math.PI) / 180) *
        (2 + Math.sin((a[1] * Math.PI) / 180) + Math.sin((b[1] * Math.PI) / 180));
    }
    return Math.abs((area * 6371008.8 ** 2) / 2);
  }
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates]
      : geometry.type === 'MultiPolygon'
        ? geometry.coordinates
        : [];
  return polygons.reduce(
    (sum, poly) =>
      sum + Math.max(0, ringArea(poly[0]) - poly.slice(1).reduce((s, r) => s + ringArea(r), 0)),
    0,
  );
}
function centroid(geometry: Geometry): [number, number] {
  if (geometry.type === 'Point') return [geometry.coordinates[0], geometry.coordinates[1]];
  const coords: Position[] = [];
  function walk(v: unknown) {
    if (!Array.isArray(v)) return;
    if (typeof v[0] === 'number' && typeof v[1] === 'number') coords.push(v as Position);
    else v.forEach(walk);
  }
  if ('coordinates' in geometry) walk(geometry.coordinates);
  return coords.length
    ? [
        coords.reduce((s, p) => s + p[0], 0) / coords.length,
        coords.reduce((s, p) => s + p[1], 0) / coords.length,
      ]
    : [101.4456, 3.0449];
}
export function parcelResult(feature: Feature) {
  const p = feature.properties ?? {},
    [lng, lat] = centroid(feature.geometry);
  const surveyed = Number(p.KELUASAN);
  const area =
    Number.isFinite(surveyed) && surveyed > 0 ? surveyed : geometryArea(feature.geometry);
  return {
    accountNumber: String(p.UPI ?? p.OBJECTID ?? feature.id),
    address: `Lot ${p.LOT ?? ''}, ${p.MUKIM ?? 'Klang'}`,
    lat,
    lng,
    lotSize: area > 0 ? String(+area.toFixed(2)) : '',
    totalGrossArea: '',
    zoning: '',
    yearBuilt: '',
    neighbourhood: String(p.MUKIM ?? 'Klang'),
    garage: false,
    legalDescription: String(p.UPI ?? ''),
    ward: String(p.SEKSYEN ?? ''),
    source: GIS_DATASETS.parcels.url,
    sourceLabel: 'MBDK / JUPEM 2022 parcel',
    geometry: feature.geometry,
    areaBasis:
      surveyed > 0 ? 'Provider KELUASAN field (m²)' : 'Area derived from published polygon',
    assessedValue: null,
  };
}

export function createDatasetApi(fetcher: typeof fetch = fetch, clock = Date.now) {
  const cache = new Map<string, { value: unknown; at: number }>();
  const pending = new Map<string, Promise<unknown>>();
  let geocodeTail: Promise<void> = Promise.resolve(),
    lastGeocode = 0;
  let soilTail: Promise<void> = Promise.resolve(),
    lastSoil = 0;
  const soilRequests = new Map<string, Promise<unknown>>();
  async function fetchJSON(
    target: string,
    ttl = 3_600_000,
    init: RequestInit = {},
  ): Promise<unknown> {
    const key = target + (init.body ?? '');
    const previous = cache.get(key);
    if (previous && clock() - previous.at < ttl) return previous.value;
    if (pending.has(key)) return pending.get(key)!;
    const promise = (async () => {
      const response = await fetcher(target, {
        ...init,
        signal: AbortSignal.timeout(35_000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'HydroGrid-Malaysia/1.0 (local hydrology planning research)',
          ...init.headers,
        },
      });
      if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
      const json: unknown = await response.json();
      if (record(json).error)
        throw new Error(String(record(record(json).error).message ?? 'Provider rejected request'));
      if (cache.size >= 160) cache.delete(cache.keys().next().value!);
      cache.set(key, { value: json, at: clock() });
      return json;
    })();
    pending.set(key, promise);
    try {
      return await promise;
    } finally {
      pending.delete(key);
    }
  }
  async function geocode(target: string) {
    const previous = cache.get(target);
    if (previous && clock() - previous.at < 86400000) return previous.value;
    const turn = geocodeTail.then(async () => {
      const delay = Math.max(0, 1100 - (clock() - lastGeocode));
      if (delay) await new Promise((r) => setTimeout(r, delay));
      lastGeocode = clock();
    });
    geocodeTail = turn.catch(() => {});
    await turn;
    return fetchJSON(target, 86400000);
  }
  async function queryGIS(id: string, bbox: number[], extra: Record<string, string> = {}) {
    const dataset = GIS_DATASETS[id];
    if (!dataset) throw new Error('Unknown dataset');
    const params = new URLSearchParams({
      f: dataset.format === 'esri' ? 'json' : 'geojson',
      where: '1=1',
      outFields: dataset.outFields ?? '*',
      outSR: '4326',
      returnZ: 'false',
      returnM: 'false',
      geometry: bbox.join(','),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      resultRecordCount: '600',
      ...extra,
    });
    if (dataset.noPagination) params.delete('resultRecordCount');
    if (id === 'national-river-polygons' || id === 'peninsular-flood-prone') {
      params.set('maxAllowableOffset', '0.0001');
    }
    const raw = record(await fetchJSON(`${dataset.url}/query?${params}`, 300000));
    if (
      (dataset.format !== 'esri' && raw.type !== 'FeatureCollection') ||
      !Array.isArray(raw.features)
    )
      throw new Error('Invalid GIS feature response');
    const normalized =
      dataset.format === 'esri'
        ? raw.features.map((v) => {
            const f = record(v),
              g = record(f.geometry);
            return {
              type: 'Feature',
              properties: record(f.attributes),
              geometry: Array.isArray(g.paths)
                ? {
                    type: g.paths.length === 1 ? 'LineString' : 'MultiLineString',
                    coordinates: g.paths.length === 1 ? g.paths[0] : g.paths,
                  }
                : null,
            };
          })
        : raw.features;
    const features = normalized
      .filter((value) => record(value).type === 'Feature' && record(value).geometry)
      .slice(0, 600) as Feature[];
    return {
      type: 'FeatureCollection',
      features,
      source: dataset.url,
      sourceLabel: dataset.label,
      coverage: dataset.coverage,
      notice:
        [
          raw.exceededTransferLimit || raw.features.length >= 600
            ? 'Showing up to 600 features. Zoom in for complete local coverage.'
            : '',
          params.has('maxAllowableOffset')
            ? 'Map context geometry generalised to 0.0001 degrees; not a surveyed boundary.'
            : '',
        ]
          .filter(Boolean)
          .join(' ') || null,
    } as FeatureCollection & { source: string; notice: string | null };
  }
  return async function route(url: URL): Promise<{ status: number; body: unknown } | null> {
    const path = url.pathname;
    if (
      ![
        '/api/gis',
        '/api/osm',
        '/api/search',
        '/api/site',
        '/api/climate',
        '/api/discharge',
        '/api/elevation',
        '/api/soil',
        '/api/sabah-observations',
        '/api/catalogue',
        '/api/hazard',
      ].includes(path)
    )
      return null;
    try {
      let data: unknown,
        source = '',
        notice: string | undefined;
      if (path === '/api/hazard') {
        const { lat, lng } = point(url),
          ari = Number(url.searchParams.get('ari') ?? 100);
        if (!HAZARD_ARIS.includes(ari))
          return {
            status: 400,
            body: {
              error: 'Choose a published return period: 10, 20, 50, 75, 100, 200 or 500 years.',
            },
          };
        const key = `hazard:${lat}:${lng}:${ari}`,
          previous = cache.get(key);
        if (previous && clock() - previous.at < 86400000) data = previous.value;
        else {
          let request = pending.get(key);
          if (!request) {
            request = queryHazard(lat, lng, ari);
            pending.set(key, request);
          }
          try {
            data = await request;
            if (cache.size >= 160) cache.delete(cache.keys().next().value!);
            cache.set(key, { value: data, at: clock() });
          } finally {
            pending.delete(key);
          }
        }
        source = String(record(data).source);
        notice = String(record(data).notice);
      } else if (path === '/api/catalogue') {
        data = GIS_DATASETS;
        source = 'LivingShield verified source registry';
      } else if (path === '/api/sabah-observations') {
        const kind = url.searchParams.get('kind');
        if (kind !== 'rain' && kind !== 'river')
          return { status: 400, body: { error: 'Choose rain or river observations.' } };
        source = `https://explorer.digitalsabah.gov.my/source/${kind === 'rain' ? 'rainfall' : 'waterlevel'}.json`;
        data = normalizeSabahSnapshots(await fetchJSON(source, 900000), kind, clock());
        notice =
          'Official GeoExplorer snapshot: source dates can be stale, invalid or future. Operational contact fields and unreliable thresholds are excluded. Use national JPS for current observations.';
      } else if (path === '/api/elevation') {
        const { lat, lng } = point(url);
        source = 'https://api.open-meteo.com/v1/elevation';
        const raw = record(await fetchJSON(`${source}?latitude=${lat}&longitude=${lng}`, 86400000));
        if (
          !Array.isArray(raw.elevation) ||
          raw.elevation.length !== 1 ||
          typeof raw.elevation[0] !== 'number' ||
          !Number.isFinite(raw.elevation[0])
        )
          throw new Error('Elevation provider returned an invalid height.');
        data = { lat, lng, elevation_m: raw.elevation[0], resolution_m: 90 };
        notice =
          'Copernicus DEM GLO-90 (2021), via Open-Meteo. Terrain context; not a site survey, drain invert or flood depth.';
      } else if (path === '/api/soil') {
        const { lat, lng } = point(url);
        source = 'https://rest.isric.org/soilgrids/v2.0/properties/query';
        const params = new URLSearchParams({
          lat: lat.toFixed(3),
          lon: lng.toFixed(3),
          depth: '0-5cm',
          value: 'mean',
        });
        for (const p of ['clay', 'sand', 'silt']) params.append('property', p);
        const target = `${source}?${params}`,
          cached = cache.get(target);
        if (cached && clock() - cached.at < 86400000) data = normalizeSoil(cached.value);
        else {
          let job = soilRequests.get(target);
          if (!job) {
            if (soilRequests.size >= 4)
              throw new Error('Soil source request queue is busy. Retry shortly.');
            job = (async () => {
              const turn = soilTail.then(async () => {
                const delay = Math.max(0, 12500 - (clock() - lastSoil));
                if (delay) await new Promise((r) => setTimeout(r, delay));
                lastSoil = clock();
              });
              soilTail = turn.catch(() => {});
              await turn;
              return fetchJSON(target, 86400000);
            })();
            soilRequests.set(target, job);
          }
          try {
            data = normalizeSoil(await job);
          } finally {
            soilRequests.delete(target);
          }
        }
        notice =
          'ISRIC SoilGrids 250 m predicted topsoil texture (0–5 cm), not field testing or hydraulic conductivity. Nulls remain missing. No infiltration rate is assigned automatically.';
      } else if (path === '/api/gis') {
        const id = url.searchParams.get('id') ?? '',
          bbox = bounds(url);
        if (!Object.hasOwn(GIS_DATASETS, id))
          return { status: 404, body: { error: 'Unknown GIS dataset' } };
        const maxSpan = GIS_DATASETS[id].maxSpan;
        if (maxSpan && (bbox[2] - bbox[0] > maxSpan || bbox[3] - bbox[1] > maxSpan))
          return {
            status: 400,
            body: { error: 'Zoom in to query this detailed source within a local viewport.' },
          };
        if (id === 'parcels' && (bbox[2] - bbox[0] > 0.15 || bbox[3] - bbox[1] > 0.15))
          return {
            status: 400,
            body: { error: 'Zoom to street level (zoom 14+) to load parcels.' },
          };
        data = await queryGIS(id, bbox);
        source = GIS_DATASETS[id].url;
      } else if (path === '/api/osm') {
        const id = url.searchParams.get('id') ?? '',
          bbox = bounds(url);
        if (!Object.hasOwn(OSM_QUERIES, id))
          return { status: 404, body: { error: 'Unknown OSM dataset' } };
        if (bbox[2] - bbox[0] > 0.25 || bbox[3] - bbox[1] > 0.25)
          return {
            status: 400,
            body: { error: 'Zoom in (zoom 13+) for local OpenStreetMap features.' },
          };
        const [west, south, east, north] = bbox;
        const query = `[out:json][timeout:22];nwr${OSM_QUERIES[id]}(${south},${west},${north},${east});out center geom 500;`;
        source = 'https://overpass-api.de/api/interpreter';
        const raw = record(
          await fetchJSON(source, 900000, {
            method: 'POST',
            body: new URLSearchParams({ data: query }).toString(),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }),
        );
        if (raw.remark || !Array.isArray(raw.elements))
          throw new Error('OSM data unavailable or query incomplete. Zoom in and retry.');
        const features: Feature[] = raw.elements.flatMap((v) => {
          const r = record(v),
            tags = record(r.tags),
            center = record(r.center);
          let geometry: Geometry | null = null;
          if (Array.isArray(r.geometry)) {
            const coords = r.geometry
              .map((v) => {
                const p = record(v);
                return [Number(p.lon), Number(p.lat)];
              })
              .filter((p) => p.every(Number.isFinite));
            if (coords.length >= 2)
              geometry =
                coords.length >= 4 &&
                coords[0][0] === coords.at(-1)![0] &&
                coords[0][1] === coords.at(-1)![1]
                  ? { type: 'Polygon', coordinates: [coords] }
                  : { type: 'LineString', coordinates: coords };
          }
          if (!geometry) {
            const lon = Number(r.lon ?? center.lon),
              lat = Number(r.lat ?? center.lat);
            if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
            geometry = { type: 'Point', coordinates: [lon, lat] };
          }
          return [
            {
              type: 'Feature',
              id: String(r.id),
              geometry,
              properties: {
                ...tags,
                name: tags.name ?? tags['name:ms'] ?? id,
                source: 'OpenStreetMap contributors',
                osm_id: r.id,
                osm_type: r.type,
              },
            },
          ];
        });
        data = { type: 'FeatureCollection', features };
        notice =
          'Community-mapped features; completeness varies. Not an official underground utility inventory.';
      } else if (path === '/api/search') {
        const q = (url.searchParams.get('q') ?? '').trim();
        if (q.length < 2 || q.length > 180)
          return { status: 400, body: { error: 'Enter 2–180 characters.' } };
        const lot = /^(?:lot\s*)?(\d{1,12})$/i.exec(q);
        if (lot) {
          const result = await queryGIS('parcels', [101.2, 2.7, 101.7, 3.4], {
            where: `LOT='${lot[1]}'`,
            resultRecordCount: '20',
          });
          data = result.features.map(parcelResult);
          source = GIS_DATASETS.parcels.url;
        } else {
          source = 'https://nominatim.openstreetmap.org';
          const params = new URLSearchParams({
            q,
            format: 'jsonv2',
            countrycodes: 'my',
            limit: '8',
            addressdetails: '1',
            polygon_geojson: '1',
          });
          const raw = await geocode(`${source}/search?${params}`);
          if (!Array.isArray(raw)) throw new Error('Address response unavailable');
          data = raw.map((v) => {
            const r = record(v),
              a = record(r.address);
            return {
              accountNumber: `osm-${r.osm_type}-${r.osm_id}`,
              address: String(r.display_name ?? ''),
              lat: Number(r.lat),
              lng: Number(r.lon),
              lotSize: '',
              totalGrossArea: '',
              zoning: '',
              yearBuilt: '',
              neighbourhood: String(a.suburb ?? a.city ?? a.state ?? ''),
              garage: false,
              legalDescription: '',
              ward: '',
              source,
              sourceLabel: 'OpenStreetMap address; parcel area not provided',
              assessedValue: null,
            };
          });
          notice =
            'Address search is not a cadastral or assessed-value lookup. Search a Klang lot number or enter surveyed site dimensions.';
        }
      } else if (path === '/api/site') {
        const { lat, lng } = point(url),
          delta = 0.00002;
        const result = await queryGIS(
          'parcels',
          [lng - delta, lat - delta, lng + delta, lat + delta],
          { resultRecordCount: '1' },
        );
        data = result.features[0] ? parcelResult(result.features[0]) : null;
        source = GIS_DATASETS.parcels.url;
      } else {
        const { lat, lng } = point(url);
        const from = url.searchParams.get('from') ?? '',
          to = url.searchParams.get('to') ?? '';
        const validDate = (v: string) =>
          /^\d{4}-\d{2}-\d{2}$/.test(v) &&
          Number.isFinite(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v;
        if (
          !validDate(from) ||
          !validDate(to) ||
          from > to ||
          Date.parse(to) - Date.parse(from) > 366 * 86400000
        )
          return { status: 400, body: { error: 'Select a valid date range of up to 366 days.' } };
        const params = new URLSearchParams({
          latitude: String(lat),
          longitude: String(lng),
          start_date: from,
          end_date: to,
        });
        if (path === '/api/climate') {
          source = 'https://archive-api.open-meteo.com/v1/archive';
          params.set('daily', 'precipitation_sum,temperature_2m_mean,et0_fao_evapotranspiration');
          params.set('timezone', 'Asia/Kuala_Lumpur');
          notice =
            'Gridded historical reanalysis; not measured JPS station rainfall or design IDF.';
        } else {
          source = 'https://flood-api.open-meteo.com/v1/flood';
          params.set('daily', 'river_discharge');
          notice =
            'GloFAS modelled discharge (UTC days), not station measurements or site flood depth. Check returned grid location.';
        }
        data = await fetchJSON(`${source}?${params}`, 86400000);
        const series = record(data),
          daily = record(series.daily),
          times = daily.time;
        const variables = (params.get('daily') ?? '').split(',');
        if (
          !Number.isFinite(series.latitude) ||
          !Number.isFinite(series.longitude) ||
          !Array.isArray(times) ||
          !times.every((v) => typeof v === 'string') ||
          !variables.every((key) => {
            const values = daily[key];
            return (
              Array.isArray(values) &&
              values.length === times.length &&
              values.every((v) => v === null || (typeof v === 'number' && Number.isFinite(v)))
            );
          })
        )
          throw new Error('Historical provider returned an unexpected series schema.');
      }
      return {
        status: 200,
        body: { data, source, fetchedAt: new Date(clock()).toISOString(), stale: false, notice },
      };
    } catch (error) {
      return {
        status: error instanceof InputError ? 400 : 502,
        body: {
          error: error instanceof Error ? error.message : 'Malaysian data unavailable',
          notice:
            'No substitute or fabricated data returned. Retry or choose another source/location.',
        },
      };
    }
  };
}
