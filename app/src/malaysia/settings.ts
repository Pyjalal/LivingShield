import { useSyncExternalStore } from 'react';
import msma from '../data/msma.json' with { type: 'json' };
import hp26 from '../data/hp26.json' with { type: 'json' };
import type { DesignStation } from './design.ts';
import { parseApprovedProfile, DESIGN_STATIONS } from './design.ts';
export interface Region {
  name: string;
  lat: number;
  lng: number;
  zoom: number;
}
export const REGIONS: Region[] = [
  { name: 'Malaysia', lat: 4.3, lng: 109.2, zoom: 5 },
  { name: 'Klang / Selangor', lat: 3.0449, lng: 101.4456, zoom: 12 },
  { name: 'Kuala Lumpur', lat: 3.139, lng: 101.687, zoom: 12 },
  { name: 'Johor', lat: 1.49, lng: 103.74, zoom: 11 },
  { name: 'Kelantan', lat: 6.12, lng: 102.24, zoom: 11 },
  { name: 'Terengganu', lat: 5.32, lng: 103.14, zoom: 11 },
  { name: 'Pahang', lat: 3.82, lng: 103.33, zoom: 11 },
  { name: 'Pulau Pinang', lat: 5.41, lng: 100.33, zoom: 11 },
  { name: 'Perak', lat: 4.6, lng: 101.09, zoom: 11 },
  { name: 'Kedah', lat: 6.12, lng: 100.37, zoom: 11 },
  { name: 'Perlis', lat: 6.44, lng: 100.2, zoom: 11 },
  { name: 'Negeri Sembilan', lat: 2.73, lng: 101.94, zoom: 11 },
  { name: 'Melaka', lat: 2.2, lng: 102.25, zoom: 11 },
  { name: 'Sabah', lat: 5.98, lng: 116.08, zoom: 11 },
  { name: 'Sarawak', lat: 1.55, lng: 110.35, zoom: 12 },
  { name: 'Putrajaya', lat: 2.93, lng: 101.69, zoom: 12 },
  { name: 'Labuan', lat: 5.28, lng: 115.24, zoom: 12 },
];
export const MSMA_STATIONS: DesignStation[] = DESIGN_STATIONS;
type Settings = {
  region: string;
  stationId: string;
  custom: DesignStation | null;
  language: 'en' | 'ms';
};
function initial(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem('hydrogrid-my-settings') ?? '{}');
    return {
      region: REGIONS.some((r) => r.name === stored.region) ? stored.region : REGIONS[0].name,
      stationId: typeof stored.stationId === 'string' ? stored.stationId : '',
      custom: stored.custom ? parseApprovedProfile(stored.custom) : null,
      language: stored.language === 'ms' ? 'ms' : 'en',
    };
  } catch {
    return { region: REGIONS[0].name, stationId: '', custom: null, language: 'en' };
  }
}
let snapshot =
  typeof window === 'undefined'
    ? ({ region: REGIONS[0].name, stationId: '', custom: null, language: 'en' } as Settings)
    : initial();
const listeners = new Set<() => void>();
export function updateSettings(next: Partial<Settings>) {
  snapshot = { ...snapshot, ...next };
  try {
    localStorage.setItem('hydrogrid-my-settings', JSON.stringify(snapshot));
  } catch {
    console.info('Settings are available for this session only.');
  }
  for (const listener of listeners) listener();
}
export function getSettings() {
  return snapshot;
}
export function selectedDesignStation() {
  return snapshot.custom?.id === snapshot.stationId
    ? snapshot.custom
    : (MSMA_STATIONS.find((s) => s.id === snapshot.stationId) ?? null);
}
export function useSettings() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSettings,
    getSettings,
  );
}
export function getRegion() {
  return REGIONS.find((r) => r.name === snapshot.region) ?? REGIONS[0];
}
export type PatternFamily = 'msma' | 'hp26';
export function temporalPattern(
  region: number,
  duration: number,
  family: PatternFamily = 'msma',
): number[] {
  const patterns = (family === 'hp26' ? hp26.patterns : msma.patterns) as Record<
    string,
    Record<string, number[]>
  >;
  const values = patterns[String(region)]?.[String(duration)];
  if (!values) throw new Error('Choose a published temporal region and duration for this manual.');
  const sum = values.reduce((a, b) => a + b, 0);
  return values.map((v) => v / sum);
}
export function cumulativePattern(
  fraction: number,
  region: number,
  duration: number,
  family: PatternFamily = 'msma',
) {
  if (fraction <= 0) return 0;
  if (fraction >= 1) return 1;
  const values = temporalPattern(region, duration, family),
    position = fraction * values.length,
    index = Math.floor(position);
  return Math.min(
    1,
    Math.max(
      0,
      values.slice(0, index).reduce((a, b) => a + b, 0) + values[index] * (position - index),
    ),
  );
}
