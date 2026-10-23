export type Language = 'en' | 'ms';
export type WaterStatus = 'Normal' | 'Alert' | 'Warning' | 'Danger' | 'Unknown';
export interface Station {
  id: string;
  name: string;
  state: string;
  district: string;
  basin: string;
  lat: number;
  lng: number;
  waterLevel: number | null;
  rainfall1h: number | null;
  rainfall3h: number | null;
  rainfallToday: number | null;
  waterAt: string | null;
  rainAt: string | null;
  waterStatus: WaterStatus;
  waterOnline: boolean;
  rainOnline: boolean;
}
export interface Forecast {
  location: { location_id: string; location_name: string };
  date: string;
  morning_forecast: string;
  afternoon_forecast: string;
  night_forecast: string;
  summary_forecast: string;
  min_temp: number;
  max_temp: number;
}
export interface Warning {
  warning_issue: { issued: string; title_en: string; title_bm: string };
  valid_from: string;
  valid_to: string;
  heading_en: string;
  heading_bm: string;
  text_en: string;
  text_bm: string;
  instruction_en: string;
  instruction_bm: string;
}
export interface Envelope<T> {
  data: T;
  fetchedAt: string;
  source: string;
  stale: boolean;
  notice?: string;
}
export interface RainLayer {
  id: number;
  name: string;
  timestamp: string | null;
}
export interface RainMap {
  layers: RainLayer[];
}

export function isFresh(timestamp: string | null, now = Date.now(), maxMinutes = 120): boolean {
  if (!timestamp) return false;
  const age = now - Date.parse(timestamp);
  return Number.isFinite(age) && age >= -5 * 60_000 && age <= maxMinutes * 60_000;
}

export function localTime(value: string | null, language: Language = 'en'): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    hour12: false,
  }).format(new Date(value));
}
