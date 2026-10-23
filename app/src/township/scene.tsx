import { useEffect, useRef, useState } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Township } from './model';
import type { FloodDisplayFrame, FloodTerrainAsset } from './flood/display';

export type MapFeature = Feature<Geometry, Record<string, unknown>>;
import type { Proposal } from './planning';
export default function TownshipScene({
  data,
  township,
  uiTheme,
  selected,
  onSelect,
  proposals,
  onPlace,
  onRemove,
  reset,
  heightScale,
  topDown,
  terrain,
  flood,
}: {
  data: FeatureCollection<Geometry, Record<string, unknown>>;
  township: Township;
  uiTheme: 'terminal' | 'dark' | 'accessible';
  selected: MapFeature | null;
  onSelect: (f: MapFeature) => void;
  proposals: Proposal[];
  onPlace: ((x: number, z: number) => void) | null;
  onRemove: (id: number) => void;
  reset: number;
  heightScale: number;
  topDown: boolean;
  terrain: FloodTerrainAsset | null;
  flood: FloodDisplayFrame | null;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [ready, setReady] = useState(false);
  const [engineAvailable, setEngineAvailable] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/tamanku/index.html', { signal: controller.signal })
      .then(async (response) => {
        const html = await response.text();
        if (!response.ok || !html.includes('name="tamantahan-engine"'))
          throw new Error('The local 3D engine is unavailable. Reload the page to retry.');
        if (!controller.signal.aborted) setEngineAvailable(true);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : 'Unable to load the 3D engine.');
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow ||
        !event.data ||
        typeof event.data !== 'object'
      )
        return;
      const message = event.data as Record<string, unknown>;
      if (message.type === 'hydrogrid:ready') {
        if (message.initialized === false) {
          setReady(false);
          frame.current?.contentWindow?.postMessage(
            { type: 'hydrogrid:init', township, dataset: data, heightScale, proposals, uiTheme },
            window.location.origin,
          );
        } else if (message.initialized === true) {
          setReady(true);
        }
      } else if (
        message.type === 'hydrogrid:chrome' &&
        typeof message.footerHeight === 'number' &&
        Number.isFinite(message.footerHeight) &&
        message.footerHeight >= 0 &&
        message.footerHeight <= 240
      ) {
        frame.current
          ?.closest<HTMLElement>('.tt-model')
          ?.style.setProperty('--tt-scene-footer-height', `${message.footerHeight}px`);
      } else if (message.type === 'hydrogrid:select') {
        const feature = data.features.find((f) => f.properties.id === message.featureId);
        if (feature) onSelect(feature);
      } else if (
        message.type === 'hydrogrid:place' &&
        typeof message.x === 'number' &&
        typeof message.z === 'number' &&
        Number.isFinite(message.x) &&
        Number.isFinite(message.z)
      ) {
        onPlace?.(message.x, message.z);
      } else if (message.type === 'hydrogrid:remove' && typeof message.id === 'number') {
        onRemove(message.id);
      } else if (message.type === 'hydrogrid:error') {
        if (message.recoverable === true)
          setWarning('Aerial ground imagery unavailable; mapped geometry is still shown.');
        else
          setError(
            typeof message.message === 'string' ? message.message : 'The 3D scene could not start.',
          );
      }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [data, township, heightScale, proposals, uiTheme, onSelect, onPlace, onRemove]);
  useEffect(() => {
    if (ready)
      frame.current?.contentWindow?.postMessage(
        {
          type: 'hydrogrid:state',
          proposals,
          placementEnabled: !!onPlace,
          reset,
          heightScale,
          selectedId: selected?.properties.id ?? null,
          topDown,
          terrain,
          flood,
          uiTheme,
        },
        window.location.origin,
      );
  }, [ready, proposals, onPlace, reset, heightScale, selected, topDown, terrain, flood, uiTheme]);
  return (
    <div className="tt-canvas">
      {engineAvailable && (
        <iframe
          ref={frame}
          title="LivingShield 3D township model"
          src="/tamanku/index.html"
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      )}
      {warning && (
        <p className="tt-bridge-note" role="status">
          {warning}
        </p>
      )}
      {error && (
        <div className="tt-scene-message" role="alert">
          <h3>3D rendering unavailable</h3>
          <p>
            {error} You can still inspect the mapped building list, compare water budgets and export
            your plan.
          </p>
        </div>
      )}
      {!ready && !error && (
        <div className="tt-scene-message" role="status">
          <span className="tt-loader" />
          <p>Starting the 3D township engine…</p>
        </div>
      )}
    </div>
  );
}
