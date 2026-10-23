import { ARIS, DURATIONS, intensity } from '../malaysia/design.ts';
import { selectedDesignStation } from '../malaysia/settings.ts';
export const IDF_RETURN_PERIODS = ARIS;
export const IDF_DURATIONS = DURATIONS;
export function interpolateIntensity(duration: number, ari: number) {
  const station = selectedDesignStation();
  return station ? intensity(station, duration, ari) : 0;
}
export const C_ROOF = 0.95;
export const C_PAVEMENT = 0.9;
export const C_LAWN = 0.25;
export const C_GREEN_ROOF = 0.4;
export const C_PERMEABLE_PAVE = 0.3;
export const C_PRE_DEV = 0.25;

// ─── Pipe sizing (Manning's equation, full-pipe flow) ───────────────────────

export const STANDARD_PIPES = [
  75, 100, 125, 150, 200, 250, 300, 375, 450, 525, 600, 750, 900, 1050, 1200,
];

export function calcPipeDiameter(Q_m3s: number, n = 0.013, S = 0.005): number {
  if (Q_m3s <= 0) return 0;
  return Math.pow((Q_m3s * n * 10.079) / (Math.PI * Math.sqrt(S)), 0.375) * 1000;
}

export function roundUpPipe(d_mm: number): number {
  return d_mm <= 0 ? 0 : (STANDARD_PIPES.find((p) => p >= d_mm) ?? Infinity);
}

// ─── Detention sizing (Modified Rational Method) ────────────────────────────
// Iterates over IDF durations to find the critical duration that maximises
// the volume difference between post-dev inflow and pre-dev release rate.

export interface DetentionResult {
  critDur: number;
  volume_m3: number;
  release_Ls: number;
  inflow_Ls: number;
}

export function calcDetention(
  C_post: number,
  C_pre: number,
  area_ha: number,
  tc: number,
  returnPeriod: number,
): DetentionResult {
  const durations = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 360, 720, 1440];
  let maxVol = 0,
    critDur = tc,
    bestRelease = 0,
    bestInflow = 0;
  const Q_release = (C_pre * interpolateIntensity(tc, returnPeriod) * area_ha) / 360;
  for (const d of durations) {
    if (d < tc) continue;
    const i = interpolateIntensity(d, returnPeriod);
    const Q_in = (C_post * i * area_ha) / 360;
    const vol_in = Q_in * d * 60;
    const vol_out = Q_release * d * 60;
    const storage = vol_in - vol_out;
    if (storage > maxVol) {
      maxVol = storage;
      critDur = d;
      bestRelease = Q_release;
      bestInflow = Q_in;
    }
  }
  return {
    critDur,
    volume_m3: Math.max(0, maxVol),
    release_Ls: bestRelease * 1000,
    inflow_Ls: bestInflow * 1000,
  };
}

// ─── Kirpich formula (tc in minutes, clamped to [5, 30]) ────────────────────

export function calculateTc(lotArea: number, slope: number): number {
  const flowLength = Math.sqrt(lotArea) * 1.4;
  const tc = 0.0195 * Math.pow(flowLength, 0.77) * Math.pow(slope, -0.385);
  return Math.max(5, Math.min(tc, 30));
}

// ─── Haversine distance (km) ────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Soil types ─────────────────────────────────────────────────────────────

export const SOIL_INFILTRATION = {
  sand: { label: 'Sand', rate: 120, desc: 'High infiltration — sandy river valley deposits' },
  sandyLoam: { label: 'Sandy Loam', rate: 30, desc: 'Moderate-high — mixed alluvial soils' },
  siltLoam: { label: 'Silt Loam', rate: 12, desc: 'Moderate — typical lowland areas' },
  clayLoam: { label: 'Clay Loam', rate: 6, desc: 'Low — fine-grained soil screening assumption' },
  clay: { label: 'Clay', rate: 2, desc: 'Very low — low-permeability screening assumption' },
} as const;

export type SoilType = keyof typeof SOIL_INFILTRATION;

// Green-Ampt soil parameters — Rawls, Brakensiek & Miller (1983)
export const GA_SOILS = {
  sand: { label: 'Sand', Ks: 117.8, psi: 49.5, theta_e: 0.437, theta_i: 0.1 },
  loamySand: { label: 'Loamy Sand', Ks: 29.9, psi: 61.3, theta_e: 0.437, theta_i: 0.12 },
  sandyLoam: { label: 'Sandy Loam', Ks: 10.9, psi: 110.1, theta_e: 0.453, theta_i: 0.15 },
  loam: { label: 'Loam', Ks: 3.4, psi: 88.9, theta_e: 0.463, theta_i: 0.2 },
  siltLoam: { label: 'Silt Loam', Ks: 6.5, psi: 166.8, theta_e: 0.501, theta_i: 0.22 },
  sandyClayLoam: { label: 'Sandy Clay Loam', Ks: 1.5, psi: 218.5, theta_e: 0.398, theta_i: 0.2 },
  clayLoam: { label: 'Clay Loam', Ks: 1.0, psi: 208.8, theta_e: 0.464, theta_i: 0.25 },
  siltyClayLoam: { label: 'Silty Clay Loam', Ks: 1.0, psi: 273.0, theta_e: 0.471, theta_i: 0.25 },
  clay: { label: 'Clay', Ks: 0.3, psi: 316.3, theta_e: 0.475, theta_i: 0.3 },
} as const;

export type GASoilKey = keyof typeof GA_SOILS;

// ─── Slope options for UI ───────────────────────────────────────────────────

export const SLOPE_OPTIONS = [
  { value: 0.005, label: '0.5% — Very flat (river valley floodplain)' },
  { value: 0.01, label: '1% — Flat (lowland residential)' },
  { value: 0.02, label: '2% — Moderate (low-permeability screening assumption)' },
  { value: 0.04, label: '4% — Moderate-steep (hillside lots)' },
  { value: 0.08, label: '8% — Steep (river valley escarpment)' },
];
