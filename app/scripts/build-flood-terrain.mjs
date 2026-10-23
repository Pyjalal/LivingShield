import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fromUrl } from 'geotiff';
import { TOWNSHIPS } from '../src/township/model.ts';

const COLS = 32;
const ROWS = 32;
const EARTH_RADIUS_M = 6371008.8;
const LICENCE_URL =
  'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM';
const NOTICE =
  'produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved';
const upstreamFetch = globalThis.fetch;
const transfers = new Map();

globalThis.fetch = async (input, options) => {
  const url = typeof input === 'string' ? input : input.url ?? String(input);
  const headers = new Headers(options?.headers);
  const response = await upstreamFetch(input, options);
  if (url.startsWith('https://copernicus-dem-30m.s3.amazonaws.com/')) {
    const range = headers.get('range');
    if (!range || response.status !== 206)
      throw new Error(`Expected bounded HTTP range response; received ${response.status} for ${url}`);
    const bytes = Number(response.headers.get('content-length'));
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 16 * 1024 * 1024)
      throw new Error('Unexpected elevation range response size.');
    const previous = transfers.get(url) ?? { requests: 0, bytes: 0, ranges: [] };
    previous.requests += 1;
    previous.bytes += bytes;
    previous.ranges.push({ requested: range, returned: response.headers.get('content-range'), bytes });
    transfers.set(url, previous);
  }
  return response;
};

function tileUrl(longitude, latitude) {
  const lat = Math.floor(latitude);
  const lng = Math.floor(longitude);
  const name = `Copernicus_DSM_COG_10_${lat < 0 ? 'S' : 'N'}${String(Math.abs(lat)).padStart(2, '0')}_00_${lng < 0 ? 'W' : 'E'}${String(Math.abs(lng)).padStart(3, '0')}_00_DEM`;
  return `https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`;
}

const images = new Map();
async function getImage(url) {
  if (!images.has(url)) {
    images.set(
      url,
      fromUrl(
        url,
        { allowFullFile: false, maxRanges: 0, blockSize: 65536, cacheSize: 16 },
        AbortSignal.timeout(45000),
      ).then(async (tiff) => {
        const image = await tiff.getImage();
        const keys = image.getGeoKeys();
        if (keys.GeographicTypeGeoKey !== 4326 || keys.GTRasterTypeGeoKey !== 2)
          throw new Error('Expected WGS84 geographic RasterPixelIsPoint Copernicus GLO-30 data.');
        const [dx, dy] = image.getResolution();
        if (Math.abs(dx - 1 / 3600) > 1e-10 || Math.abs(dy + 1 / 3600) > 1e-10)
          throw new Error('Expected one arc-second native pixel spacing.');
        return image;
      }),
    );
  }
  return images.get(url);
}

function degrees(metres) {
  return (metres / EARTH_RADIUS_M) * (180 / Math.PI);
}

async function build(township) {
  const dxM = township.widthM / COLS;
  const dzM = township.depthM / ROWS;
  const originX = -township.widthM / 2;
  const originZ = -township.depthM / 2;
  const [centreLng, centreLat] = township.centre;
  const longitudeScale = Math.cos((centreLat * Math.PI) / 180);
  const samples = Array.from({ length: ROWS * COLS }, (_, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = originX + (col + 0.5) * dxM;
    const z = originZ + (row + 0.5) * dzM;
    return [centreLng + degrees(x) / longitudeScale, centreLat - degrees(z)];
  });
  const url = tileUrl(centreLng, centreLat);
  if (samples.some(([lng, lat]) => tileUrl(lng, lat) !== url))
    throw new Error(`${township.id} requires multiple source tiles; cross-tile sampling is not implemented.`);
  const image = await getImage(url);
  const [x0, y0] = image.getOrigin();
  const [pixelDx, pixelDy] = image.getResolution();
  const indices = samples.map(([lng, lat]) => [(lng - x0) / pixelDx, (lat - y0) / pixelDy]);
  const minCol = Math.floor(Math.min(...indices.map(([col]) => col)));
  const minRow = Math.floor(Math.min(...indices.map(([, row]) => row)));
  const maxCol = Math.floor(Math.max(...indices.map(([col]) => col))) + 2;
  const maxRow = Math.floor(Math.max(...indices.map(([, row]) => row))) + 2;
  if (minCol < 0 || minRow < 0 || maxCol > image.getWidth() || maxRow > image.getHeight())
    throw new Error('Requested sample lies outside the elevation image.');
  if (maxCol - minCol > 128 || maxRow - minRow > 128)
    throw new Error('Unexpected elevation crop size.');
  const window = [minCol, minRow, maxCol, maxRow];
  const raster = await image.readRasters({
    window,
    samples: [0],
    interleave: true,
    signal: AbortSignal.timeout(45000),
  });
  const nodata = image.getGDALNoData();
  const width = maxCol - minCol;
  const read = (col, row) => {
    const value = Number(raster[(row - minRow) * width + col - minCol]);
    if (!Number.isFinite(value) || value === nodata || value < -100 || value > 5000)
      throw new Error(`${township.id} contains invalid or unsupported elevation data; no zero-fill permitted.`);
    return value;
  };
  const elevationsM = indices.map(([col, row]) => {
    const left = Math.floor(col);
    const top = Math.floor(row);
    const fx = col - left;
    const fy = row - top;
    const north = read(left, top) * (1 - fx) + read(left + 1, top) * fx;
    const south = read(left, top + 1) * (1 - fx) + read(left + 1, top + 1) * fx;
    return Number((north * (1 - fy) + south * fy).toFixed(3));
  });
  const result = {
    schemaVersion: 1,
    townshipId: township.id,
    cols: COLS,
    rows: ROWS,
    dxM,
    dzM,
    originX,
    originZ,
    cellLocation: 'centre',
    coordinates: 'x east; z south; rows north to south; elevations absolute metres above EGM2008 geoid',
    bbox: township.bbox,
    centre: township.centre,
    elevationsM,
    minM: Math.min(...elevationsM),
    maxM: Math.max(...elevationsM),
    dataQuality: {
      sourceNoDataValue: nodata,
      noDataCells: 0,
      zeroCells: elevationsM.filter((value) => value === 0).length,
      negativeCells: elevationsM.filter((value) => value < 0).length,
      notice:
        'Every interpolating native sample was finite and distinct from the declared NoData value. This is not independent terrain validation. Source zero elevations are retained without replacement; river editing or surface-model artefacts may create false depressions.',
    },
    source: {
      url,
      title: 'Copernicus DEM GLO-30 Public, AWS COG 2021 release',
      registryUrl: 'https://registry.opendata.aws/copernicus-dem/',
      documentationUrl: 'https://copernicus-dem-30m.s3.amazonaws.com/readme.html',
      nativeResolutionM: 30,
      nativeSpacingArcSeconds: 1,
      verticalDatum: 'EGM2008 geoid (EPSG:3855); metres',
      horizontalCRS: 'WGS84 geographic longitude/latitude (EPSG:4326)',
      retrievedAt: new Date().toISOString(),
      licence: 'Copernicus DEM GLO-30 free licence; attribution required',
      licenceUrl: LICENCE_URL,
      attribution: NOTICE,
      notice:
        'Satellite-derived surface elevations include roofs, infrastructure and vegetation. Bilinear resampling to 46.875 m cells, no hydrological conditioning or local survey correction. Three decimal places are numerical storage precision, not survey accuracy. Historical acquisition 2011–2015 with possible older infill; not current township terrain. Does not resolve drains, culverts, road kerbs or finished-floor levels. Suitable for an uncalibrated screening demo, not design depths or flood warnings.',
      sampleMethod: 'Bilinear interpolation from native 1 arc-second RasterPixelIsPoint sample centres',
      sourceBounds: image.getBoundingBox(),
      sourcePixelWindow: window,
    },
  };
  const output = new URL(`../public/data/townships/${township.id}-terrain.json`, import.meta.url);
  await mkdir(new URL('.', output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(
    JSON.stringify({ township: township.id, output: fileURLToPath(output), minM: result.minM, maxM: result.maxM, window }),
  );
}

const requested = process.argv.slice(2);
if (requested.some((id) => !TOWNSHIPS.some((township) => township.id === id)))
  throw new Error('Supported township IDs: bukit-raja, pagoh, elmina.');
try {
  for (const township of TOWNSHIPS.filter((entry) => !requested.length || requested.includes(entry.id)))
    await build(township);
  console.log(JSON.stringify({ boundedHttpTransfers: Object.fromEntries(transfers) }));
} finally {
  globalThis.fetch = upstreamFetch;
}
