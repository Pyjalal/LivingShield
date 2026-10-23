import { fromUrl, type GeoTIFFImage } from 'geotiff';
export const HAZARD_BASE =
  'https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard';
export const HAZARD_ARIS = [10, 20, 50, 75, 100, 200, 500];
const TILES = ['ID202_N10_E90', 'ID211_N10_E100', 'ID220_N10_E110'];
const images = new Map<string, Promise<GeoTIFFImage>>();
export function hazardTile(longitude: number) {
  return longitude < 99.97625154437965
    ? TILES[0]
    : longitude < 109.97541823882177
      ? TILES[1]
      : TILES[2];
}
export function hazardSource(tile: string, ari: number, kind = 'depth') {
  if (
    !TILES.includes(tile) ||
    !HAZARD_ARIS.includes(ari) ||
    !['depth', 'spurious', 'permanent'].includes(kind)
  )
    throw new Error('Unknown flood raster.');
  return kind === 'depth'
    ? `${HAZARD_BASE}/RP${ari}/${tile}_RP${ari}_depth.tif`
    : kind === 'spurious'
      ? `${HAZARD_BASE}/Spurious_Depths/${tile}_spurious_depth_areas.tif`
      : `${HAZARD_BASE}/Permanent_WaterBodies/${tile}_permanent_water.tif`;
}
export async function openHazardImage(source: string) {
  const saved = images.get(source);
  if (saved) {
    images.delete(source);
    images.set(source, saved);
    return saved;
  }
  const pending = (async () => {
    // GeoTIFF's remote-options declaration omits the supported block-cache options.
    const options = { allowFullFile: false, maxRanges: 0, blockSize: 65536, cacheSize: 8 };
    const tiff = await fromUrl(source, options, AbortSignal.timeout(25000));
    const image = await tiff.getImage();
    if (image.getGeoKeys()?.GeographicTypeGeoKey !== 4326)
      throw new Error('Unexpected flood raster coordinate system.');
    return image;
  })();
  images.set(source, pending);
  while (images.size > 9) images.delete(images.keys().next().value!);
  try {
    return await pending;
  } catch (e) {
    if (images.get(source) === pending) images.delete(source);
    throw e;
  }
}
export function rasterCell(
  image: Pick<GeoTIFFImage, 'getOrigin' | 'getResolution' | 'getWidth' | 'getHeight'>,
  lat: number,
  lng: number,
) {
  const [x, y] = image.getOrigin(),
    [dx, dy] = image.getResolution();
  const col = Math.floor((lng - x) / dx),
    row = Math.floor((lat - y) / dy);
  return col >= 0 && row >= 0 && col < image.getWidth() && row < image.getHeight()
    ? { col, row, cellBounds: [x + col * dx, y + (row + 1) * dy, x + (col + 1) * dx, y + row * dy] }
    : null;
}
export async function sampleHazard(source: string, lat: number, lng: number) {
  const image = await openHazardImage(source),
    cell = rasterCell(image, lat, lng);
  if (!cell) return { value: null, cell: null };
  const raw = await image.readRasters({
    window: [cell.col, cell.row, cell.col + 1, cell.row + 1],
    samples: [0],
    interleave: true,
    signal: AbortSignal.timeout(25000),
  });
  const value = Number(raw[0]);
  return {
    value: Number.isFinite(value) && value !== image.getGDALNoData() && value >= 0 ? value : null,
    cell,
  };
}
export async function queryHazard(lat: number, lng: number, ari = 100) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < 0.5 ||
    lat > 8 ||
    lng < 99 ||
    lng > 120 ||
    !HAZARD_ARIS.includes(ari)
  )
    throw new Error('Unsupported coordinates or return period.');
  const tile = hazardTile(lng),
    source = hazardSource(tile, ari);
  const depth = await sampleHazard(source, lat, lng);
  const masks = await Promise.allSettled(
    ['spurious', 'permanent'].map((kind) => sampleHazard(hazardSource(tile, ari, kind), lat, lng)),
  );
  const flag = (i: number) => {
    const result = masks[i];
    return result.status === 'fulfilled' && result.value.value === 1 ? true : null;
  };
  return {
    lat,
    lng,
    depthM: depth.value,
    returnPeriodYears: ari,
    resolution_m: 90,
    tile,
    cell: depth.cell,
    potentialArtefact: flag(0),
    permanentWater: flag(1),
    qualityMasksAvailable: masks.every((v) => v.status === 'fulfilled'),
    source,
    dataset: 'CEMS/JRC global river flood hazard v2.1.2',
    notice:
      'Static modelled riverine scenario, not an official Malaysian regulatory zone, observed flood or current warning. NoData does not establish absence of risk; pluvial/coastal hazards and local drainage are not fully represented. Mask NoData is not a quality pass.',
    attribution:
      '© European Union, CEMS/JRC global river flood hazard maps v2.1.2, CC BY 4.0. Selected source cells read by LivingShield.',
  };
}
