import { writeFile } from 'node:fs/promises';
const base = process.env.HYDROGRID_URL ?? 'http://127.0.0.1:3102';
const cases = [
  ['Peninsular state boundaries', '/api/gis?id=states-peninsular&bbox=98,0,121,9'],
  ['Sabah Sarawak Labuan boundaries', '/api/gis?id=states-borneo&bbox=98,0,121,9'],
  ['Sabah river geometry', '/api/gis?id=national-river-polygons&bbox=115.7,5.5,116.8,6.5'],
  ['Sarawak river geometry', '/api/gis?id=sarawak-rivers&bbox=110.2,1.4,110.4,1.6'],
  ['Sarawak land use', '/api/gis?id=sarawak-landuse&bbox=110.3,1.4,110.4,1.5'],
  ['Sabah road sections', '/api/gis?id=sabah-roads&bbox=116,5.9,116.1,6'],
  ['Sabah geology', '/api/gis?id=sabah-geology&bbox=116,5.9,116.1,6'],
  ['East Malaysian districts', '/api/gis?id=districts-borneo&bbox=110,1,111,2'],
  ['Sarawak irrigation canals', '/api/gis?id=sarawak-canals&bbox=110.65,1.3,110.75,1.4'],
  ['Labuan reservoirs', '/api/gis?id=labuan-reservoirs&bbox=115.1,5.1,115.4,5.5'],
  ['Pahang flood-prone polygons', '/api/gis?id=peninsular-flood-prone&bbox=102,3,104,5'],
  ['Penang land use availability', '/api/gis?id=peninsular-landuse&bbox=100.32,5.4,100.33,5.41'],
  ['Sabah rainfall snapshots', '/api/sabah-observations?kind=rain'],
  ['Sabah river snapshots', '/api/sabah-observations?kind=river'],
  ['Sabah terrain', '/api/elevation?lat=5.9&lng=116.3'],
  ['Sabah soil texture', '/api/soil?lat=5.9&lng=116.3'],
  ['Sarawak soil texture', '/api/soil?lat=1.4&lng=110.4'],
  ['Klang RP100 reference cell', '/api/hazard?lat=3.037483333339665&lng=101.5991682155283&ari=100'],
  [
    'Sabah RP100 reference cell',
    '/api/hazard?lat=5.4999833333374255&lng=116.29916825628595&ari=100',
  ],
  [
    'Sarawak RP100 reference cell',
    '/api/hazard?lat=1.4241500000077991&lng=110.27416823964683&ari=100',
  ],
  ['KK model NoData', '/api/hazard?lat=5.9804&lng=116.0753&ari=100'],
  ['Sabah flood map PNG', '/api/hazard-tiles/100/12/3370/1985.png'],
  [
    'Borneo WorldCover WMS',
    'https://titiler.terrascope.be/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=esa-worldcover-map-10m-2021-v2_map&STYLES=&CRS=EPSG%3A4326&BBOX=5.7,115.8,6.2,116.4&WIDTH=256&HEIGHT=256&FORMAT=image%2Fpng&TIME=2021-01-01',
  ],
];
const results = [];
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < cases.length) {
      const [name, path] = cases[next++],
        start = Date.now(),
        url = path.startsWith('http') ? path : base + path;
      let result;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(55000) }),
          type = response.headers.get('content-type') ?? '';
        if (type.includes('image/png')) {
          const data = new Uint8Array(await response.arrayBuffer());
          result = {
            name,
            status: response.status,
            bytes: data.length,
            pngSignature: [...data.slice(0, 8)],
            url,
          };
        } else {
          const body = await response.json(),
            d = body.data;
          result = {
            name,
            status: response.status,
            url,
            source: body.source,
            error: body.error,
            notice: body.notice,
            data: d?.features
              ? {
                  features: d.features.length,
                  geometryTypes: [...new Set(d.features.map((f) => f.geometry?.type))],
                  currentReadings: d.features.filter((f) => f.properties?.current).length,
                  states: d.features.filter((f) => f.properties?.NAM).map((f) => f.properties.NAM),
                }
              : d,
          };
        }
      } catch (e) {
        result = { name, url, error: e.message };
      }
      result.elapsedMs = Date.now() - start;
      results.push(result);
      console.log(
        name,
        JSON.stringify({
          status: result.status,
          error: result.error,
          features: result.data?.features,
          depthM: result.data?.depthM,
          bytes: result.bytes,
          elapsedMs: result.elapsedMs,
        }),
      );
    }
  }),
);
await writeFile(
  new URL('../../docs/QA-NATIONAL-LIVE.json', import.meta.url),
  JSON.stringify({ verifiedAt: new Date().toISOString(), base, results }, null, 2) + '\n',
);
