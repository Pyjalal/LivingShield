import type { MultiPolygon, Polygon, Position } from 'geojson';
import type { BuildingHeightSource, LngLat } from './model.ts';

const EARTH_RADIUS_M = 6371008.8;
const RADIANS = Math.PI / 180;

function validPosition(position: readonly number[]): void {
  if (
    position.length < 2 ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1]) ||
    Math.abs(position[0]) > 180 ||
    Math.abs(position[1]) > 90
  ) {
    throw new RangeError('A finite WGS84 longitude/latitude position is required');
  }
}

/** Local tangent approximation for the 1.5 km pilot: east is +x and north is -z. */
export function projectPosition(position: readonly number[], centre: LngLat): [number, number] {
  validPosition(position);
  validPosition(centre);
  const deltaLongitude = ((position[0] - centre[0] + 540) % 360) - 180;
  return [
    deltaLongitude * RADIANS * EARTH_RADIUS_M * Math.cos(centre[1] * RADIANS),
    -(position[1] - centre[1]) * RADIANS * EARTH_RADIUS_M,
  ];
}

export function unprojectPosition(point: readonly number[], centre: LngLat): LngLat {
  validPosition(centre);
  const latitudeScale = Math.cos(centre[1] * RADIANS);
  if (point.length < 2 || !point.every(Number.isFinite) || Math.abs(latitudeScale) < 1e-12) {
    throw new RangeError('Finite local coordinates and a non-polar centre are required');
  }
  const longitude = centre[0] + point[0] / (EARTH_RADIUS_M * latitudeScale * RADIANS);
  const latitude = centre[1] - point[1] / (EARTH_RADIUS_M * RADIANS);
  return [((longitude + 540) % 360) - 180, latitude];
}

function ringAreaM2(ring: readonly Position[], centre: LngLat): number {
  if (ring.length < 3) return 0;
  const points = ring.map((position) => projectPosition(position, centre));
  let twiceArea = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    twiceArea += points[i][0] * next[1] - next[0] * points[i][1];
  }
  return Math.abs(twiceArea) / 2;
}

export function polygonAreaM2(rings: readonly Position[][], centre: LngLat): number {
  if (rings.length === 0) return 0;
  const outer = ringAreaM2(rings[0], centre);
  const holes = rings.slice(1).reduce((sum, ring) => sum + ringAreaM2(ring, centre), 0);
  return Math.max(0, outer - holes);
}

export function geometryAreaM2(geometry: Polygon | MultiPolygon, centre: LngLat): number {
  return geometry.type === 'Polygon'
    ? polygonAreaM2(geometry.coordinates, centre)
    : geometry.coordinates.reduce((sum, rings) => sum + polygonAreaM2(rings, centre), 0);
}

export interface BuildingHeight {
  heightMetres: number;
  heightSource: BuildingHeightSource;
  heightAssumption: string | null;
}

export function parseHeightMetres(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = raw.trim();
  const feetInches = /^(\d+(?:\.\d+)?)'\s*(\d+(?:\.\d+)?)?"?$/.exec(value);
  if (feetInches) {
    const inches = Number(feetInches[2] ?? 0);
    if (inches >= 12) return null;
    const result = Number(feetInches[1]) * 0.3048 + inches * 0.0254;
    return result > 0 ? result : null;
  }
  const match = /^(\d+(?:\.\d+)?)\s*(m|metres?|meters?|ft|feet)?$/i.exec(value);
  if (!match) return null;
  const result = Number(match[1]) * (/^(ft|feet)$/i.test(match[2] ?? '') ? 0.3048 : 1);
  return Number.isFinite(result) && result > 0 ? result : null;
}

// OSM height is metres unless tagged otherwise: https://wiki.openstreetmap.org/wiki/Key:height
export function parseBuildingHeight(
  tags: Readonly<Record<string, string>>,
  fallbackMetres = 6,
  metresPerLevel = 3,
): BuildingHeight {
  if (
    !Number.isFinite(fallbackMetres) ||
    fallbackMetres <= 0 ||
    !Number.isFinite(metresPerLevel) ||
    metresPerLevel <= 0
  ) {
    throw new RangeError('Visual height assumptions must be positive and finite');
  }
  const heightMetres = parseHeightMetres(tags.height) ?? parseHeightMetres(tags['building:height']);
  if (heightMetres !== null)
    return { heightMetres, heightSource: 'osm-height', heightAssumption: null };
  const rawLevels = tags['building:levels'];
  const levels = rawLevels && /^\d+(?:\.\d+)?$/.test(rawLevels.trim()) ? Number(rawLevels) : null;
  if (levels !== null && Number.isFinite(levels) && levels > 0) {
    return {
      heightMetres: levels * metresPerLevel,
      heightSource: 'osm-levels',
      heightAssumption: `${metresPerLevel} m per mapped building level; illustrative height, not a survey.`,
    };
  }
  return {
    heightMetres: fallbackMetres,
    heightSource: 'assumed',
    heightAssumption: `${fallbackMetres} m illustrative height because OSM supplies no usable height or level count.`,
  };
}
