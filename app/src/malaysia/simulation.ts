import { GA_SOILS, type GASoilKey } from '../utils/hydrology.ts';
import { cumulativePattern, type PatternFamily } from './settings.ts';
export interface SimStep {
  time: number;
  timeLabel: string;
  rainfall: number;
  intensity: number;
  infiltration: number;
  infRate: number;
  runoff: number;
  cumRain: number;
  cumInf: number;
  cumRunoff: number;
}
export function runSimulation(
  totalDepth: number,
  durationHours: number,
  soilKey: GASoilKey,
  impervious: number,
  region: number,
  family: PatternFamily = 'msma',
): SimStep[] {
  if (
    !Number.isFinite(totalDepth) ||
    totalDepth < 0 ||
    !Number.isFinite(durationHours) ||
    durationHours <= 0 ||
    !Number.isFinite(impervious) ||
    impervious < 0 ||
    impervious > 1 ||
    !Object.hasOwn(GA_SOILS, soilKey)
  )
    throw new Error('Invalid storm simulation inputs.');
  const soil = GA_SOILS[soilKey],
    duration = durationHours * 60,
    dt = durationHours <= 1 ? 2 : durationHours <= 6 ? 5 : 10;
  let wetting = 0.001,
    cumRain = 0,
    cumInf = 0,
    cumRunoff = 0;
  const steps: SimStep[] = [];
  for (let start = 0; start < duration; start += dt) {
    const end = Math.min(duration, start + dt),
      hours = (end - start) / 60;
    const rain =
      (cumulativePattern(end / duration, region, duration, family) -
        cumulativePattern(start / duration, region, duration, family)) *
      totalDepth;
    const capacity = soil.Ks * (1 + (soil.psi * (soil.theta_e - soil.theta_i)) / wetting);
    const perviousInfiltration = Math.min(rain, capacity * hours);
    wetting += perviousInfiltration;
    const infiltration = perviousInfiltration * (1 - impervious),
      runoff = rain - infiltration;
    cumRain += rain;
    cumInf += infiltration;
    cumRunoff += runoff;
    steps.push({
      time: end,
      timeLabel: `${Math.floor(end / 60)}:${String(end % 60).padStart(2, '0')}`,
      rainfall: rain,
      intensity: rain / hours,
      infiltration,
      infRate: capacity * (1 - impervious),
      runoff,
      cumRain,
      cumInf,
      cumRunoff,
    });
  }
  return steps;
}
export function defaultPatternRegion(state: string): number | null {
  if (['Kelantan', 'Terengganu'].includes(state)) return 1;
  if (['Johor', 'Negeri Sembilan', 'Melaka', 'Selangor', 'Pahang'].includes(state)) return 2;
  if (['Perak', 'Kedah', 'Pulau Pinang', 'Perlis'].includes(state)) return 3;
  if (state === 'Kuala Lumpur') return 5;
  return null;
}
