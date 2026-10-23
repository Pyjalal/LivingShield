import { useState, useRef, useCallback, useEffect } from 'react';
import type { LatLngBounds } from 'leaflet';
import type { MapLayer, LayerConfig } from '../types';
import { LAYER_CONFIGS } from './layers';
import type { Station, Envelope } from './domain';
import { localTime, isFresh } from './domain';
import { getSettings } from './settings';
import { datasetSupportsRegion } from './catalogue';
export function useMapData() {
  const [layers, setLayers] = useState<Record<string, MapLayer>>(() =>
    Object.fromEntries(
      LAYER_CONFIGS.map((config) => [
        config.id,
        { config, data: null, loading: false, error: null, visible: config.enabled },
      ]),
    ),
  );
  const current = useRef(layers);
  current.current = layers;
  const boundsRef = useRef<LatLngBounds | null>(null),
    zoomRef = useRef(12),
    abort = useRef<Record<string, AbortController>>({});
  const fetchLayer = useCallback(async (config: LayerConfig) => {
    const bounds = boundsRef.current;
    abort.current[config.id]?.abort();
    if (
      config.source === 'wms' ||
      config.source === 'tiles' ||
      !datasetSupportsRegion({ regions: config.regions ?? ['Malaysia'] }, getSettings().region)
    )
      return;
    if (config.minZoom && zoomRef.current < config.minZoom) {
      setLayers((prev) => ({
        ...prev,
        [config.id]: {
          ...prev[config.id],
          data: null,
          error: `Zoom ${config.minZoom}+ to load this local dataset.`,
          loading: false,
        },
      }));
      return;
    }
    if (!bounds && !config.id.endsWith('gauges')) return;
    const controller = new AbortController();
    abort.current[config.id] = controller;
    setLayers((prev) => ({
      ...prev,
      [config.id]: { ...prev[config.id], loading: true, error: null },
    }));
    try {
      const bbox = bounds
        ? [
            Math.max(98, bounds.getWest()),
            Math.max(0, bounds.getSouth()),
            Math.min(121, bounds.getEast()),
            Math.min(9, bounds.getNorth()),
          ]
            .map((n) => n.toFixed(5))
            .join(',')
        : '';
      const url = config.endpoint + (config.id.endsWith('gauges') ? '' : `&bbox=${bbox}`);
      const response = await fetch(url, { signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Source unavailable');
      let data: GeoJSON.FeatureCollection;
      if (config.id.endsWith('gauges')) {
        const stations = (body as Envelope<Station[]>).data;
        data = {
          type: 'FeatureCollection',
          features: stations
            .filter((s) => (config.id === 'rain-gauges' ? s.rainAt : s.waterAt))
            .map((s) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
              properties: {
                ...s,
                waterAt: localTime(s.waterAt) + ' MYT',
                rainAt: localTime(s.rainAt) + ' MYT',
                currentWater: isFresh(s.waterAt) && s.waterOnline,
                currentRain: isFresh(s.rainAt) && s.rainOnline,
                source: 'JPS Public InfoBanjir',
              },
            })),
        };
      } else data = body.data;
      if (data?.type !== 'FeatureCollection') throw new Error('Source did not return map features');
      setLayers((prev) => ({
        ...prev,
        [config.id]: {
          ...prev[config.id],
          data,
          updatedAt: Date.now(),
          loading: false,
          error: body.stale
            ? 'Cached data; source refresh unavailable.'
            : (body.data?.notice ?? null),
        },
      }));
    } catch (e) {
      if (!controller.signal.aborted)
        setLayers((prev) => ({
          ...prev,
          [config.id]: {
            ...prev[config.id],
            loading: false,
            error: e instanceof Error ? e.message : 'Source unavailable',
          },
        }));
    }
  }, []);
  const toggleLayer = useCallback(
    (id: string) => {
      const layer = current.current[id];
      if (!layer) return;
      setLayers((prev) => ({ ...prev, [id]: { ...prev[id], visible: !layer.visible } }));
      if (!layer.visible) void fetchLayer(layer.config);
    },
    [fetchLayer],
  );
  const loadVisibleLayers = useCallback(() => {
    Object.values(current.current)
      .filter((l) => l.visible)
      .forEach((l) => void fetchLayer(l.config));
  }, [fetchLayer]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onMapMove = useCallback(
    (bounds: LatLngBounds, zoom: number) => {
      boundsRef.current = bounds;
      zoomRef.current = zoom;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Object.values(current.current)
          .filter((l) => l.visible && !l.config.id.endsWith('gauges'))
          .forEach((l) => void fetchLayer(l.config));
      }, 600);
    },
    [fetchLayer],
  );
  useEffect(() => {
    const requests = abort.current;
    return () => {
      clearTimeout(timer.current);
      Object.values(requests).forEach((c) => c.abort());
    };
  }, []);
  return { layers, toggleLayer, loadVisibleLayers, onMapMove, fetchLayer };
}
