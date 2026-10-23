# JRC national river-flood raster integration

Verified 19 October 2026. **A lightweight server-side point query is feasible now without downloading entire GeoTIFFs.** Interactive raster tiles are also feasible at local zoom levels, but the source has no overviews, so a nationwide low-zoom raster must not be produced by decoding full-resolution windows on demand.

## Primary sources

- [Dataset directory](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/).
- [Version 2.1.2 README, updated 12 January 2026](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/README.txt).
- [CC BY 4.0 copyright notice](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/copyright.txt).
- [Authoritative tile index](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/tile_extents.geojson).
- [Official GeoTIFF.js documentation](https://geotiffjs.github.io/geotiff.js/).
- [GeoTIFF.js v3.0.5 remote-source implementation](https://github.com/geotiffjs/geotiff.js/blob/v3.0.5/src/source/remote.js), [GeoTIFF image implementation](https://github.com/geotiffjs/geotiff.js/blob/v3.0.5/src/geotiffimage.js), and [factory implementation](https://github.com/geotiffjs/geotiff.js/blob/v3.0.5/src/geotiff.js).

The dataset represents **modelled riverine inundation depth**, in metres, at approximately 90 m / 3 arc-second resolution. It provides return periods 10, 20, 50, 75, 100, 200 and 500 years. It is a static hazard scenario, separate from current JPS water levels, observed flood incidents, urban drainage inventories, and rainfall forecasts. It does not establish complete pluvial or coastal flood coverage.

## Verified byte-range transport

GET against the Peninsular RP100 file with these request headers:

```http
Range: bytes=0-16383
Origin: http://127.0.0.1:5180
```

returned:

```http
HTTP/1.1 206 Partial Content
Accept-Ranges: bytes
Content-Length: 16384
Content-Range: bytes 0-16383/13436340
Content-Type: image/tiff
```

Exactly 16,384 bytes were read. The response **did not include Access-Control-Allow-Origin**, so the browser should call the HydroGrid server. The server can use `geotiff.fromUrl` directly; no unrestricted URL proxy or CORS workaround is required. Keep source URLs generated from a fixed allowlist.

GeoTIFF.js `3.0.5` is the current npm version checked during this investigation. Its remote source supports `allowFullFile: false`, `maxRanges`, `blockSize` and `cacheSize`. Set `allowFullFile: false` explicitly so a change in the upstream server cannot silently turn a pixel lookup into a complete-file response.

## Verified raster structure

Metadata was read over HTTP using installed Python Rasterio/GDAL; there was no complete raster download.

| Property | Verified Peninsular RP100 value |
| --- | --- |
| File | `RP100/ID211_N10_E100_RP100_depth.tif` |
| Compressed file size | 13,436,340 bytes |
| Raster dimensions | 11,999 × 11,999 |
| CRS | EPSG:4326 / WGS 84 |
| Samples | One Float32 band |
| Units | Metres, per dataset README; TIFF band unit itself is unset |
| NoData | `-9999` |
| Storage | 256 × 256 tiled, DEFLATE compression |
| Internal overviews | **None** |
| Area/point convention | `AREA_OR_POINT=Area` |
| Origin x | `99.97625154437965` |
| Origin y | `10.00706666666666` |
| Pixel width | `0.0008333333356347339` degrees |
| Pixel height | `-0.0008333333333325754` degrees |
| Actual bounds | `[99.97625154437965, 0.007900000009087194, 109.97541823866082, 10.00706666666666]` |

The Borneo RP100 file `ID220_N10_E110_RP100_depth.tif` is 10,266,949 bytes and its actual x bounds are `109.97541823882177` to `119.97458493310295`. Western Malaysian islands require `ID202_N10_E90_RP100_depth.tif`. The tile names describe a nominal grid; **do not select using `floor(longitude / 10)`** because the actual seams are shifted from exact 100° and 110° meridians. Use the official tile index for coarse selection and TIFF metadata for final containment.

## Executable point-query core

The following is a standalone Node ESM core for GeoTIFF.js 3.0.5. It is a reviewed integration example, not a claim that it has been installed in the app. Node 18+ supplies `AbortSignal.timeout`. The actual remote raster metadata, byte-range transport and numeric reference values below were tested with Rasterio independently.

```javascript
import { fromUrl } from 'geotiff';

const BASE = 'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard';
const RETURN_PERIODS = new Set([10, 20, 50, 75, 100, 200, 500]);
const TILE_NAMES = ['ID202_N10_E90', 'ID211_N10_E100', 'ID220_N10_E110'];
const imagePromises = new Map();

async function openImage(name, returnPeriod) {
  const key = `${name}:${returnPeriod}`;
  if (imagePromises.has(key)) {
    const saved = imagePromises.get(key);
    imagePromises.delete(key);
    imagePromises.set(key, saved);
    return saved;
  }
  const url = `${BASE}/RP${returnPeriod}/${name}_RP${returnPeriod}_depth.tif`;
  const pending = (async () => {
    const tiff = await fromUrl(url, {
      allowFullFile: false,
      maxRanges: 0,
      blockSize: 65536,
      cacheSize: 16,
    }, AbortSignal.timeout(20000));
    const image = await tiff.getImage();
    if (image.getGeoKeys().GeographicTypeGeoKey !== 4326) {
      throw new Error('Unexpected JRC raster coordinate system');
    }
    return { image, url };
  })();
  imagePromises.set(key, pending);
  while (imagePromises.size > 6) {
    imagePromises.delete(imagePromises.keys().next().value);
  }
  try {
    return await pending;
  } catch (error) {
    if (imagePromises.get(key) === pending) imagePromises.delete(key);
    throw error;
  }
}

export async function queryFloodDepth(lat, lng, returnPeriod = 100) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < 0 || lat > 8 || lng < 96 || lng > 120
      || !RETURN_PERIODS.has(returnPeriod)) {
    throw new Error('Invalid Malaysian coordinates or unsupported return period');
  }
  const preferred = lng < 99.97625154437965 ? TILE_NAMES[0]
    : lng < 109.97541823882177 ? TILE_NAMES[1] : TILE_NAMES[2];
  const candidates = [preferred, ...TILE_NAMES.filter(name => name !== preferred)];
  for (const name of candidates) {
    const { image, url } = await openImage(name, returnPeriod);
    const [west, south, east, north] = image.getBoundingBox();
    if (lng < west || lng >= east || lat <= south || lat > north) continue;
    const [originX, originY] = image.getOrigin();
    const [resolutionX, resolutionY] = image.getResolution();
    const col = Math.floor((lng - originX) / resolutionX);
    const row = Math.floor((lat - originY) / resolutionY);
    if (col < 0 || row < 0 || col >= image.getWidth() || row >= image.getHeight()) continue;
    const values = await image.readRasters({
      window: [col, row, col + 1, row + 1],
      samples: [0],
      interleave: true,
      signal: AbortSignal.timeout(20000),
    });
    const raw = Number(values[0]);
    const noData = image.getGDALNoData();
    const depthM = Number.isFinite(raw) && raw !== noData && raw >= 0 ? raw : null;
    return {
      depthM,
      status: depthM === null ? 'no-modelled-value' : 'modelled-depth',
      returnPeriodYears: returnPeriod,
      dataset: 'CEMS/JRC global river flood hazard v2.1.2',
      resolution: '3 arc-seconds (approximately 90 m)',
      tile: name,
      col,
      row,
      source: url,
      cellBounds: [
        originX + col * resolutionX,
        originY + (row + 1) * resolutionY,
        originX + (col + 1) * resolutionX,
        originY + row * resolutionY,
      ],
      notice: 'Modelled riverine hazard; missing values do not establish absence of flood risk.',
    };
  }
  return { depthM: null, status: 'outside-raster-coverage', returnPeriodYears: returnPeriod };
}
```

`image.readRasters({window: [...]})` uses **pixel coordinates**, with the right and bottom edges exclusive. The one-cell window decodes the containing compressed 256 × 256 block, rather than a 11,999 × 11,999 array. `interleave: true` returns the single band's typed values directly. At TIFF level, `tiff.readRasters({bbox, width, height})` accepts a geographical bounding box and can choose an overview, but this source has none.

Use request cancellation/timeouts, coalesce identical point requests, and cache final result envelopes with a bounded key count. A failed or timed-out request must return an unavailable status rather than a depth of zero. A country polygon can narrow the illustrative bounding-box validation further. Avoid dropping asynchronous GeoTIFF source handles from a cache while also maintaining a separate unbounded decoded-block cache.

## Independent numeric acceptance checks

These coordinates are **pixel centres**, selected from native-resolution raster windows and independently checked using Rasterio's `sample`. They are model values, not surveyed depths or observed flood records.

| RP100 query, longitude / latitude | Tile | Native column / row | Expected depth |
| --- | --- | --- | ---: |
| `101.5991682155283, 3.037483333339665` | ID211 | 1947 / 8363 | `8.112000465393066` m |
| `116.29916825628595, 5.4999833333374255` | ID220 | 7588 / 5408 | `12.324999809265137` m |
| `110.27416823964683, 1.4241500000077991` | ID220 | 358 / 10299 | `10.593000411987305` m |
| Kota Kinabalu centre `116.0753, 5.9804` | ID220 | Query-dependent | `-9999` → `null` |
| Kuching centre `110.35, 1.55` | ID220 | Query-dependent | `-9999` → `null` |

Allow approximately `0.00001` m numeric tolerance against Float32 values. Test the tile selection near the shifted seam at 109.975418°E and for Langkawi/western islands. Unit tests can use a tiny locally constructed TIFF to verify pixel indexing, negative y resolution, NoData conversion and fixed source allowlisting without depending on external HTTP.

## PNG map tiles: feasible, with explicit limits

A practical endpoint is `/api/hazard/tiles/:returnPeriod/:z/:x/:y.png`. Generate the URL from the seven allowed return periods and three allowed source files. For an initial implementation, use **minimum zoom 10**, 256 × 256 output pixels, at most two simultaneous decode/render jobs, a bounded PNG cache, and a cap of approximately 1024 × 1024 native pixels per source window. These are operational starting limits, not source resolution claims.

For each XYZ output tile:

1. Convert XYZ bounds to WGS84 using `lon = x / 2^z * 360 - 180` and `lat = atan(sinh(pi * (1 - 2*y/2^z))) * 180/pi`.
2. Intersect the resulting geographic rectangle with each of the three source TIFF bounds, normally only one; tiles near a source seam can cross two files.
3. Convert that intersection to a clamped native pixel window using `getOrigin()` and `getResolution()`. Reject overly large windows before calling `readRasters`.
4. Read the bounded source window once. For each output pixel centre, compute its longitude and inverse-Web-Mercator latitude, then look up the corresponding source column/row. This avoids incorrectly treating Mercator output rows as uniformly spaced in latitude.
5. Use nearest-neighbour resampling for this first display. Render NoData transparent. Apply the chosen flood-depth legend consistently and return attribution with the layer.
6. Encode RGBA to PNG using an existing encoder, or Node's built-in `zlib` plus standard PNG chunks/CRC if avoiding a native image dependency. Cache by version/return period/z/x/y; clip output to Malaysian territory only if clearly identified as an application mask.

Do not assume that requesting `width: 256, height: 256` makes a country-sized source window cheap. GeoTIFF.js must still obtain and decompress the intersecting native blocks when there is no lower-resolution overview. For smooth nationwide views, precompute overviews or low-zoom PNG tiles once, or use a separately verified map service. A point-query layer and report can provide national hazard data immediately while the local-zoom raster rendering is added and measured.

## Meaning and attribution in the product

Display `JRC/Copernicus modelled river-flood depth — 100-year scenario` (or the selected period), with its approximate 90 m resolution. NoData should read `No modelled value at this cell`; it must not become a `0 m`, `safe`, or `no flood risk` conclusion. Keep this separate from official Malaysian council flood polygons and historical JPS observations.

The README warns about extreme depths from hydraulic-model limitations, artificial DEM sinks, residual DEM problems and tile-boundary effects. It supplies a separate `Spurious_Depths/` mask for potential artefacts. Depths greater than 10 m should therefore not be presented as verified engineering facts; retain the model caveat, and ideally integrate that separate quality mask before decision-grade use.

The matching mask URLs are fixed and do not depend on return period:

```text
Spurious_Depths/ID211_N10_E100_spurious_depth_areas.tif
Spurious_Depths/ID220_N10_E110_spurious_depth_areas.tif
Spurious_Depths/ID202_N10_E90_spurious_depth_areas.tif
Permanent_WaterBodies/ID211_N10_E100_permanent_water.tif
Permanent_WaterBodies/ID220_N10_E110_permanent_water.tif
Permanent_WaterBodies/ID202_N10_E90_permanent_water.tif
```

Both mask types were independently opened over byte ranges and are single-band UInt8, 256 × 256 tiled, with NoData **255** and no overviews. A value **1** identifies a mask location. At the Sabah 12.325 m and Sarawak 10.593 m reference cells above, **both masks returned 1**. At the Klang 8.112 m reference cell, both returned 255. This is a useful quality-flag acceptance test: the Borneo reference depths must be labelled as potentially affected by artefacts and permanent-water classification. A 255 mask value is NoData; do not turn it into a promise that a cell passed a quality assessment. The spurious mask is defined from the 10-year scenario and is a static auxiliary warning, rather than an independent probabilistic scenario for each return period.

Suggested attribution: `© European Union, CEMS/JRC global river flood hazard maps v2.1.2, CC BY 4.0. HydroGrid reads and colours selected raster cells.` Link the dataset and licence and identify the application's transformations. The source licence permits reuse with attribution; it does not make this a Malaysian government flood delineation.
