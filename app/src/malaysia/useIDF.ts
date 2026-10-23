import { useMemo } from 'react';
import { useSettings, MSMA_STATIONS } from './settings';
import { intensity, DURATIONS, ARIS, profileForLocation, type DesignStation } from './design';
export interface IDFData {
  loading: boolean;
  live: boolean;
  available: boolean;
  notice: string;
  station: DesignStation | null;
  getIntensity: (duration: number, ari: number) => number;
  intensities: Record<number, number[]>;
}
export function useStationIDF(...location: [number, number]): IDFData {
  const settings = useSettings();
  const selected =
    settings.custom?.id === settings.stationId
      ? settings.custom
      : (MSMA_STATIONS.find((s) => s.id === settings.stationId) ?? null);
  const station = profileForLocation(selected, location[1]);
  const notice = !station
    ? location[1] >= 108
      ? 'Choose a Sabah, Sarawak or Labuan HP26 2018 station through the design rainfall selector.'
      : 'Choose a Peninsular MSMA station through the design rainfall selector.'
    : '';
  return useMemo(() => {
    const getIntensity = (duration: number, ari: number) =>
      station ? intensity(station, duration, ari) : 0;
    return {
      loading: false,
      live: false,
      available: !!station,
      notice,
      station,
      getIntensity,
      intensities: Object.fromEntries(
        ARIS.map((ari) => [
          ari,
          DURATIONS.filter((d) => d >= (station?.minDurationMinutes ?? 5)).map((d) =>
            getIntensity(d, ari),
          ),
        ]),
      ),
    };
  }, [station, notice]);
}
