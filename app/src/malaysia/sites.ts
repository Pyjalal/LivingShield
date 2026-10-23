import type { FeatureCollection } from 'geojson';
export function parseSites(text: string): FeatureCollection {
  if (text.length > 5_000_000) throw new Error('GeoJSON must be smaller than 5 MB.');
  const value: unknown = JSON.parse(text);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    value.type !== 'FeatureCollection' ||
    !('features' in value) ||
    !Array.isArray(value.features) ||
    !value.features.length ||
    value.features.length > 5000
  ) {
    throw new Error('Use a GeoJSON FeatureCollection with 1–5,000 features in WGS84.');
  }
  if ('crs' in value)
    throw new Error('Reproject to RFC 7946 WGS84 GeoJSON without a crs member before importing.');
  let points = 0;
  function coordinates(v: unknown, depth: number): void {
    if (!Array.isArray(v) || !v.length)
      throw new Error('Geometry has empty or invalid coordinates.');
    if (depth === 0) {
      const [lng, lat] = v;
      if (
        v.length < 2 ||
        v.length > 3 ||
        v.some((n) => typeof n !== 'number' || !Number.isFinite(n)) ||
        typeof lng !== 'number' ||
        typeof lat !== 'number' ||
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        lng < 99 ||
        lng > 120 ||
        lat < 0.5 ||
        lat > 8
      )
        throw new Error(
          'Coordinates must be WGS84 longitude, latitude within Malaysia’s map bounds.',
        );
      if (++points > 100000) throw new Error('Limit imports to 100,000 coordinate positions.');
    } else for (const child of v) coordinates(child, depth - 1);
  }
  const depths: Record<string, number> = {
    Point: 0,
    MultiPoint: 1,
    LineString: 1,
    MultiLineString: 2,
    Polygon: 2,
    MultiPolygon: 3,
  };
  for (const feature of value.features) {
    if (
      typeof feature !== 'object' ||
      feature === null ||
      feature.type !== 'Feature' ||
      !feature.geometry
    )
      throw new Error('Each feature needs a geometry.');
    const geometry = feature.geometry;
    if (!Object.hasOwn(depths, geometry.type))
      throw new Error('Use points, lines or polygons; geometry collections are unsupported.');
    coordinates(geometry.coordinates, depths[geometry.type]);
    function checkShape(v: unknown, depth: number): void {
      if (!Array.isArray(v)) throw new Error('Invalid geometry.');
      if (
        depth === 1 &&
        (geometry.type.includes('LineString') || geometry.type.includes('Polygon'))
      ) {
        const ring = geometry.type.includes('Polygon');
        if (v.length < (ring ? 4 : 2))
          throw new Error('Lines need 2 positions; polygon rings need 4.');
        if (ring && JSON.stringify(v[0]) !== JSON.stringify(v[v.length - 1]))
          throw new Error('Polygon rings must be closed.');
      }
      if (depth > 1) for (const child of v) checkShape(child, depth - 1);
    }
    checkShape(geometry.coordinates, depths[geometry.type]);
  }
  return value as FeatureCollection;
}
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
