import msma from '../data/msma.json' with { type: 'json' };
import hp26 from '../data/hp26.json' with { type: 'json' };
// Source: DID Malaysia, MSMA 2nd edition (2012), Eq 2.2 and Table 2.B1.
// Duration in HOURS in the published equation; UI and callers use minutes.
export const MSMA_URL = 'https://wplb.water.gov.my/assets/msma-2nd-edition.pdf';
export const HP26_URL = hp26.source;
export interface DesignStation {
  id: string;
  name: string;
  state: string;
  lambda: number;
  kappa: number;
  theta: number;
  eta: number;
  page: number;
  source?: string;
  family?: 'msma' | 'hp26' | 'custom';
  sourceTitle?: string;
  minDurationMinutes?: number;
  maxDurationMinutes?: number;
  lat?: number;
  lng?: number;
  qualityNotes?: string[];
}
export function parseApprovedProfile(value: unknown): DesignStation {
  if (!value || typeof value !== 'object') throw new Error('Provide a JSON profile object.');
  const p = value as Record<string, unknown>;
  if (!['name', 'state', 'source'].every((k) => typeof p[k] === 'string' && String(p[k]).trim()))
    throw new Error('Provide name, state and an HTTPS source URL.');
  const source = new URL(String(p.source));
  if (source.protocol !== 'https:') throw new Error('Source must be an HTTPS URL.');
  if (
    !['lambda', 'kappa', 'theta', 'eta'].every(
      (k) => typeof p[k] === 'number' && Number.isFinite(p[k]),
    )
  )
    throw new Error('Rainfall coefficients must be finite numbers.');
  const { lambda, kappa, theta, eta } = p as unknown as DesignStation;
  if (lambda <= 0 || kappa < 0 || theta < 0 || eta <= 0)
    throw new Error('Invalid rainfall coefficients.');
  const minDurationMinutes = typeof p.minDurationMinutes === 'number' ? p.minDurationMinutes : 5;
  const maxDurationMinutes = typeof p.maxDurationMinutes === 'number' ? p.maxDurationMinutes : 4320;
  within(minDurationMinutes, 5, 15, 'Imported minimum duration supported by all workflows (min)');
  if (maxDurationMinutes !== 4320)
    throw new Error(
      'Imported profiles must support durations up to 4320 minutes for all workflows.',
    );
  const profile = {
    id: 'custom-approved',
    name: String(p.name),
    state: String(p.state),
    source: source.href,
    lambda,
    kappa,
    theta,
    eta,
    page: 0,
    minDurationMinutes,
    maxDurationMinutes,
  };
  if (
    ![minDurationMinutes, maxDurationMinutes].every((d) =>
      [2, 100].every(
        (t) => Number.isFinite(intensity(profile, d, t)) && intensity(profile, d, t) > 0,
      ),
    )
  )
    throw new Error('Coefficients produce invalid rainfall intensities.');
  return profile;
}
export const DESIGN_STATIONS: DesignStation[] = [
  ...msma.stations.map((s) => ({
    ...s,
    family: 'msma' as const,
    source: MSMA_URL,
    sourceTitle: 'MSMA 2012 Table 2.B1',
    minDurationMinutes: 5,
  })),
  ...hp26.stations.map((s) => ({ ...s, family: 'hp26' as const })),
];
export function profileLabel(station: DesignStation | null | undefined) {
  return station?.id === 'custom-approved'
    ? 'User imported IDF'
    : station?.family === 'hp26'
      ? 'HP26 2018'
      : 'MSMA 2012';
}
export function profileForLocation(station: DesignStation | null, longitude: number) {
  if (!station || station.id === 'custom-approved') return station;
  const isEastMalaysia = longitude >= 108;
  return isEastMalaysia === (station.family === 'hp26') ? station : null;
}
export const DURATIONS = [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320];
export const ARIS = [2, 5, 10, 20, 25, 50, 100];

function within(value: number, min: number, max: number, label: string) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(`${label}: ${min}–${max}`);
}
export function intensity(station: DesignStation, durationMinutes: number, ari: number): number {
  within(
    durationMinutes,
    station.minDurationMinutes ?? 5,
    station.maxDurationMinutes ?? 4320,
    'Duration (min)',
  );
  within(ari, 2, 100, 'ARI (years)');
  return (
    (station.lambda * ari ** station.kappa) / (durationMinutes / 60 + station.theta) ** station.eta
  );
}
export interface DesignInput {
  station: DesignStation;
  area: number;
  before: number;
  after: number;
  tc: number;
  ari: number;
  slope: number;
  roughness: number;
  release: number;
  pipeLength: number;
  pipeRate: number;
  storageRate: number;
}
export function calculateDesign(input: DesignInput) {
  const {
    station,
    area,
    before,
    after,
    tc,
    ari,
    slope,
    roughness,
    release,
    pipeLength,
    pipeRate,
    storageRate,
  } = input;
  within(area, 1, 800000, 'Area (m²)');
  within(before, 0, 1, 'Pre-development coefficient');
  within(after, 0, 1, 'Post-development coefficient');
  within(tc, 5, 4320, 'Time of concentration (min)');
  within(slope, 0.0001, 0.2, 'Pipe slope (m/m)');
  within(roughness, 0.009, 0.05, 'Manning roughness');
  within(release, 0, 1000000, 'Permitted release (L/s)');
  within(pipeLength, 0, 100000, 'Pipe length (m)');
  within(pipeRate, 0, 1000000, 'Pipe unit rate (MYR/m)');
  within(storageRate, 0, 1000000, 'Storage unit rate (MYR/m³)');
  const rain = intensity(station, tc, ari);
  // Q = C i A / 360 with A in hectares, Q in m³/s.
  const pre = (before * rain * area) / 3_600_000;
  const post = (after * rain * area) / 3_600_000;
  // Preliminary constant-inflow storage screen; not routed pond design.
  const storageRows = [...new Set([...DURATIONS, tc])]
    .filter((d) => d >= tc)
    .sort((a, b) => a - b)
    .map((d) => ({
      duration: d,
      volume: Math.max(
        0,
        ((after * intensity(station, d, ari) * area) / 3_600_000 - release / 1000) * d * 60,
      ),
    }));
  const critical = storageRows.reduce((best, row) => (row.volume > best.volume ? row : best));
  const diameter =
    post === 0
      ? 0
      : ((post * roughness * 4 ** (5 / 3)) / (Math.PI * Math.sqrt(slope))) ** (3 / 8) * 1000;
  const sizes = [
    100, 150, 200, 225, 250, 300, 375, 450, 525, 600, 750, 900, 1050, 1200, 1500, 1800, 2100, 2400,
  ];
  const nominal = post === 0 ? 0 : (sizes.find((size) => size >= diameter) ?? null);
  return {
    rain,
    pre,
    post,
    critical,
    storageRows,
    diameter,
    nominal,
    cost: pipeLength * pipeRate + critical.volume * storageRate,
  };
}
