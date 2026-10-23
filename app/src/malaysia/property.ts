import { useSyncExternalStore, useRef, useMemo, useEffect, useState } from 'react';
import type { Geometry, FeatureCollection, Position } from 'geojson';
import { haversineKm } from '../utils/hydrology';
export interface PropertyResult {
  accountNumber: string;
  address: string;
  lat: number;
  lng: number;
  lotSize: string;
  totalGrossArea: string;
  zoning: string;
  yearBuilt: string;
  neighbourhood: string;
  garage: boolean;
  legalDescription: string;
  ward: string;
  source?: string;
  sourceLabel?: string;
  areaBasis?: string;
  geometry?: Geometry;
  assessedValue?: number | null;
}
export interface NearbyFacility {
  name: string;
  type: string;
  owner: string;
  neighbourhood: string;
  distKm: number;
}
export interface AnalysisData {
  lotSize: number;
  buildingArea: number;
  buildingKnown: boolean;
  address: string;
  zoning: string;
  zoningLabel: string;
  zoningImpervious: number;
  zoningPaveFrac: number;
  neighbourhood: string;
  yearBuilt: string;
  garage: boolean;
  legalDescription: string;
  ward: string;
  lat: number;
  lng: number;
}
export type InputMode = 'search' | 'manual';
export const ZONING_IMPERVIOUS: Record<
  string,
  { label: string; impervious: number; paveFrac: number }
> = {
  residential: { label: 'Residential / Kediaman (scenario)', impervious: 0.55, paveFrac: 0.15 },
  commercial: { label: 'Commercial / Perdagangan (scenario)', impervious: 0.85, paveFrac: 0.3 },
  industrial: { label: 'Industrial / Perindustrian (scenario)', impervious: 0.8, paveFrac: 0.35 },
  agricultural: { label: 'Agricultural / Pertanian (scenario)', impervious: 0.1, paveFrac: 0.03 },
  open: { label: 'Open space / Kawasan lapang (scenario)', impervious: 0.08, paveFrac: 0.03 },
};
export function getZoningInfo(value: string) {
  return ZONING_IMPERVIOUS[value] ?? null;
}
export function fmtArea(value: string | number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0
    ? `${n.toLocaleString('en-MY', { maximumFractionDigits: 1 })} m²`
    : 'Not provided';
}
interface State {
  mode: InputMode;
  query: string;
  results: PropertyResult[];
  selected: PropertyResult | null;
  loading: boolean;
  searched: boolean;
  error: string;
  manualLot: string;
  manualBuilding: string;
  manualAddress: string;
  manualZoning: string;
  manualNeighbourhood: string;
  manualYearBuilt: string;
  manualGarage: boolean;
  manualLat: string;
  manualLng: string;
  clickMarker: { lat: number; lng: number } | null;
  clickLoading: boolean;
}
const defaultState: State = {
  mode: 'search',
  query: '',
  results: [],
  selected: null,
  loading: false,
  searched: false,
  error: '',
  manualLot: '',
  manualBuilding: '',
  manualAddress: '',
  manualZoning: '',
  manualNeighbourhood: '',
  manualYearBuilt: '',
  manualGarage: false,
  manualLat: '',
  manualLng: '',
  clickMarker: null,
  clickLoading: false,
};
let state: State = defaultState;
try {
  const saved = JSON.parse(localStorage.getItem('hydrogrid-my-site') ?? 'null');
  if (
    saved?.selected &&
    typeof saved.selected.lat === 'number' &&
    typeof saved.selected.lng === 'number'
  )
    state = { ...defaultState, selected: saved.selected };
} catch {
  state = defaultState;
}
const listeners = new Set<() => void>();
let abort: AbortController | null = null;
function patch(next: Partial<State>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem('hydrogrid-my-site', JSON.stringify({ selected: state.selected }));
  } catch {
    console.info('Site state is available for this session only.');
  }
  for (const l of listeners) l();
}
export function chooseSite(site: PropertyResult) {
  patch({ selected: site, mode: 'search', clickMarker: null });
}
function center(geometry: Geometry): [number, number] {
  if (geometry.type === 'Point') return [geometry.coordinates[0], geometry.coordinates[1]];
  const coords: Position[] = [];
  function collect(v: unknown) {
    if (!Array.isArray(v)) return;
    if (typeof v[0] === 'number') coords.push(v as Position);
    else v.forEach(collect);
  }
  if ('coordinates' in geometry) collect(geometry.coordinates);
  return coords.length
    ? [
        coords.reduce((s, p) => s + p[0], 0) / coords.length,
        coords.reduce((s, p) => s + p[1], 0) / coords.length,
      ]
    : [0, 0];
}
export function usePropertySearch() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  async function runSearch(q: string) {
    if (q.trim().length < 2) return;
    abort?.abort();
    const controller = new AbortController();
    abort = controller;
    patch({ loading: true, searched: true, error: '', query: q });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        }),
        body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Search unavailable');
      if (!controller.signal.aborted) patch({ results: body.data, selected: null });
    } catch (e) {
      if (!controller.signal.aborted)
        patch({ results: [], error: e instanceof Error ? e.message : 'Search unavailable' });
    } finally {
      if (!controller.signal.aborted) patch({ loading: false });
    }
  }
  async function handleMapClick(lat: number, lng: number) {
    if (lat < 0.5 || lat > 8 || lng < 99 || lng > 120) {
      patch({ error: 'Select a location in Malaysia.' });
      return;
    }
    patch({ clickMarker: { lat, lng }, manualLat: String(lat), manualLng: String(lng), error: '' });
    if (s.mode === 'manual') return;
    patch({ clickLoading: true, selected: null });
    try {
      const response = await fetch(`/api/site?lat=${lat}&lng=${lng}`),
        body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Parcel lookup unavailable');
      if (body.data) chooseSite(body.data);
      else
        patch({
          error:
            'No official Klang parcel at this location. Use Manual Input with surveyed dimensions.',
        });
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : 'Parcel source unavailable' });
    } finally {
      patch({ clickLoading: false });
    }
  }
  function setMode(mode: InputMode) {
    if (mode === 'manual' && s.selected) {
      const p = s.selected;
      patch({
        mode,
        manualLot: p.lotSize,
        manualBuilding: p.totalGrossArea,
        manualAddress: p.address,
        manualNeighbourhood: p.neighbourhood,
        manualLat: String(p.lat),
        manualLng: String(p.lng),
      });
    } else patch({ mode });
  }
  const analysisData = useMemo<AnalysisData | null>(() => {
    const p = s.selected,
      manual = s.mode === 'manual';
    if (!manual && !p) return null;
    const buildingInput = manual ? s.manualBuilding : (p?.totalGrossArea ?? '');
    const lot = Number(manual ? s.manualLot : p?.lotSize),
      building = Number(buildingInput);
    if (
      !Number.isFinite(lot) ||
      lot < 0 ||
      lot > 800000 ||
      !Number.isFinite(building) ||
      building < 0 ||
      building > lot ||
      (manual && lot === 0)
    )
      return null;
    const lat = manual ? Number(s.manualLat) : p!.lat,
      lng = manual ? Number(s.manualLng) : p!.lng;
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 0.5 ||
      lat > 8 ||
      lng < 99 ||
      lng > 120
    )
      return null;
    const zoning = manual ? s.manualZoning : (p?.zoning ?? ''),
      zi = getZoningInfo(zoning);
    return {
      lotSize: lot,
      buildingArea: building,
      buildingKnown: buildingInput.trim() !== '',
      address: (manual ? s.manualAddress : p?.address) || 'User-entered site',
      zoning,
      zoningLabel: zi?.label ?? 'Not provided',
      zoningImpervious: zi?.impervious ?? 0.55,
      zoningPaveFrac: zi?.paveFrac ?? 0.15,
      neighbourhood: (manual ? s.manualNeighbourhood : p?.neighbourhood) ?? '',
      yearBuilt: (manual ? s.manualYearBuilt : p?.yearBuilt) ?? '',
      garage: manual ? s.manualGarage : (p?.garage ?? false),
      legalDescription: manual ? 'User supplied' : (p?.legalDescription ?? ''),
      ward: manual ? '' : (p?.ward ?? ''),
      lat,
      lng,
    };
  }, [s]);
  const [nearbyFacilities, setFacilities] = useState<NearbyFacility[]>([]),
    [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const lat = analysisData?.lat,
    lng = analysisData?.lng;
  useEffect(() => {
    if (!lat || !lng) return;
    const controller = new AbortController();
    setFacilitiesLoading(true);
    fetch(`/api/gis?id=ponds&bbox=${lng - 0.03},${lat - 0.03},${lng + 0.03},${lat + 0.03}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Pond source unavailable');
        return r.json();
      })
      .then((body: { data: FeatureCollection }) => {
        setFacilities(
          body.data.features
            .map((f) => {
              const p = f.properties ?? {},
                [x, y] = center(f.geometry);
              return {
                name: String(p.LOKASI ?? 'Retention pond'),
                type: 'MBDK retention pond',
                owner: String(p.PEMILIK ?? 'Not provided'),
                neighbourhood: String(p.LOKASI ?? ''),
                distKm: +haversineKm(lat, lng, y, x).toFixed(2),
              };
            })
            .sort((a, b) => a.distKm - b.distKm),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setFacilities([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setFacilitiesLoading(false);
      });
    return () => controller.abort();
  }, [lat, lng]);
  return {
    ...s,
    setMode,
    handleInput: (query: string) => patch({ query }),
    handleKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') void runSearch(s.query);
    },
    runSearch,
    setSelected: (selected: PropertyResult | null) => patch({ selected }),
    setClickMarker: (clickMarker: State['clickMarker']) => patch({ clickMarker }),
    setManualLot: (manualLot: string) => patch({ manualLot }),
    setManualBuilding: (manualBuilding: string) => patch({ manualBuilding }),
    setManualAddress: (manualAddress: string) => patch({ manualAddress }),
    setManualZoning: (manualZoning: string) => patch({ manualZoning }),
    setManualNeighbourhood: (manualNeighbourhood: string) => patch({ manualNeighbourhood }),
    setManualYearBuilt: (manualYearBuilt: string) => patch({ manualYearBuilt }),
    setManualGarage: (manualGarage: boolean) => patch({ manualGarage }),
    setManualLat: (manualLat: string) => patch({ manualLat }),
    setManualLng: (manualLng: string) => patch({ manualLng }),
    handleMapClick,
    analysisData,
    markerPos: s.selected ? { lat: s.selected.lat, lng: s.selected.lng } : s.clickMarker,
    visibleMarkers: s.selected ? [s.selected] : s.results,
    debounceRef,
    nearbyFacilities,
    facilitiesLoading,
  };
}
