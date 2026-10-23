import type { Station, WaterStatus, RainLayer } from '../src/malaysia/domain.ts';
export function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function numeric(value: unknown): number | null {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !value.trim())
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n > -999 ? n : null;
}
export function malaysiaDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00+08:00`;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const local = new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 16);
  return local === iso.slice(0, 16) ? iso : null;
}
export function normalizeStations(raw: unknown): Station[] {
  if (!Array.isArray(raw)) throw new Error('JPS station response is not an array');
  const unique = new Map<string, Station>();
  for (const value of raw) {
    const r = record(value),
      lat = numeric(r.latitude),
      lng = numeric(r.longitude);
    if (
      lat === null ||
      lng === null ||
      lat < 0.5 ||
      lat > 8 ||
      lng < 99 ||
      lng > 120 ||
      !r.station_id
    )
      continue;
    const water = numeric(r.clean_water_level),
      status = String(r.wl_severity_level);
    const rain = numeric(r.cum_hourly);
    const recognized = ['Normal', 'Alert', 'Warning', 'Danger'].includes(status);
    const station: Station = {
      id: String(r.station_id),
      name: String(r.station_name ?? r.station_id),
      lat,
      lng,
      state: String(r.state ?? ''),
      district: String(r.district ?? ''),
      basin: String(r.main_basin ?? ''),
      waterLevel: water,
      rainfall1h: rain !== null && rain >= 0 ? rain : null,
      rainfall3h: numeric(r.cum_3hours),
      rainfallToday: numeric(r.cum_daily),
      waterAt: malaysiaDate(r.wl_date_time),
      rainAt: malaysiaDate(r.rf_date_time),
      waterStatus: water !== null && recognized ? (status as WaterStatus) : 'Unknown',
      waterOnline:
        r.station_status === 'ON' &&
        (r.wl1_status === 'ON' || r.wl2_status === 'ON' || r.wl2status === 'ON'),
      rainOnline: r.station_status === 'ON' && r.rf_status === 'ON',
    };
    unique.set(station.id, station);
  }
  if (!unique.size) throw new Error('JPS returned no usable Malaysian station locations');
  return [...unique.values()];
}
export function normalizeRainLayers(raw: unknown): RainLayer[] {
  const layers = record(raw).layers;
  if (!Array.isArray(layers)) throw new Error('JPS rain map metadata unavailable');
  return layers
    .flatMap((value) => {
      const r = record(value),
        name = String(r.name ?? '');
      const m = /isohyet_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\.tif/.exec(name);
      if (typeof r.id !== 'number' || !m) return [];
      // Source names carry a timestamp but do not declare its timezone. Preserve label;
      // do not fabricate a UTC/MYT observation time from it.
      return [{ id: r.id, name, timestamp: `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` }];
    })
    .sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
}
