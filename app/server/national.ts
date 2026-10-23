import type { Feature, FeatureCollection } from 'geojson';
import { record, numeric } from './normalize.ts';
export function normalizeSabahSnapshots(
  raw: unknown,
  kind: 'rain' | 'river',
  now = Date.now(),
): FeatureCollection {
  if (!Array.isArray(raw)) throw new Error('Sabah snapshot schema unavailable.');
  const features: Feature[] = raw.flatMap((value) => {
    const r = record(value),
      lat = numeric(r.latitude),
      lng = numeric(r.longitude);
    if (
      lat === null ||
      lng === null ||
      lat < 4 ||
      lat > 8 ||
      lng < 115 ||
      lng > 120 ||
      typeof r.stationId !== 'string' ||
      typeof r.stationName !== 'string'
    )
      return [];
    const original = typeof r.lastUpdate === 'string' ? r.lastUpdate : '';
    const stamp = /^20\d{2}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(original)
      ? `${original}+08:00`
      : null;
    const millis = stamp ? Date.parse(stamp) : NaN;
    const valid =
      stamp &&
      Number.isFinite(millis) &&
      new Date(millis + 8 * 3600000).toISOString().slice(0, 16) === original.slice(0, 16) &&
      millis <= now + 300000
        ? stamp
        : null;
    const rainValue = numeric(r.rf1hour),
      dailyValue = numeric(r.dailyrf),
      waterValue = numeric(r.waterlevel);
    const hourly = rainValue !== null && rainValue >= 0 ? rainValue : null,
      daily = dailyValue !== null && dailyValue >= 0 ? dailyValue : null;
    const reading = kind === 'rain' ? hourly : waterValue;
    const online = r.stationStatus === 'Online',
      current = !!valid && online && reading !== null && now - Date.parse(valid) <= 7200000;
    return [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          station_id: r.stationId,
          name: r.stationName,
          district: typeof r.district === 'string' ? r.district : null,
          basin: typeof r.mainBasin === 'string' ? r.mainBasin : null,
          observed_at: valid,
          source_timestamp: original || null,
          current,
          online,
          status: current
            ? 'Current'
            : valid
              ? 'Historical/offline/missing-reading snapshot'
              : 'Invalid/future source timestamp',
          ...(kind === 'rain'
            ? { rainfall1h_mm: hourly, rainfall_daily_mm: daily }
            : {
                water_level_source_value: waterValue,
                water_unit: 'Source value; datum/unit needs local confirmation',
              }),
          source: 'Sabah Digital GeoExplorer / JPS source snapshot',
        },
      },
    ];
  });
  if (!features.length && raw.length)
    throw new Error('Sabah snapshot contains no usable station locations.');
  return { type: 'FeatureCollection', features };
}
export function normalizeSoil(raw: unknown) {
  const layers = record(record(raw).properties).layers;
  if (!Array.isArray(layers)) throw new Error('SoilGrids provider schema unavailable.');
  const texture = layers.flatMap((value) => {
    const layer = record(value);
    if (!['clay', 'sand', 'silt'].includes(String(layer.name))) return [];
    const depths = Array.isArray(layer.depths) ? layer.depths : [],
      depth = record(depths.find((v) => record(v).label === '0-5cm'));
    if (depth.label !== '0-5cm') throw new Error('SoilGrids topsoil depth unavailable.');
    const mean = numeric(record(depth.values).mean),
      factor = numeric(record(layer.unit_measure).d_factor);
    if (factor !== 10) throw new Error('Unexpected SoilGrids conversion factor.');
    if (mean !== null && (mean < 0 || mean > 1000))
      throw new Error('Invalid SoilGrids texture value.');
    return [
      {
        property: String(layer.name),
        percent: mean === null ? null : mean / factor,
        depth: '0–5 cm',
        sourceUnit: String(record(layer.unit_measure).mapped_units ?? 'g/kg'),
      },
    ];
  });
  if (texture.length !== 3 || new Set(texture.map((v) => v.property)).size !== 3)
    throw new Error('SoilGrids texture fields unavailable.');
  return { resolution_m: 250, texture };
}
