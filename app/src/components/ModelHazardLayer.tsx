import { useState, useEffect, useRef } from 'react';
import { DomEvent } from 'leaflet';
import { CircleMarker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import NationalSiteContext from './NationalSiteContext';
export default function ModelHazardLayer() {
  const inspector = useRef<HTMLDivElement>(null);
  const map = useMap(),
    [zoom, setZoom] = useState(map.getZoom()),
    [point, setPoint] = useState<{ lat: number; lng: number } | null>(null),
    [errors, setErrors] = useState(0);
  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });
  useEffect(() => {
    if (inspector.current) {
      DomEvent.disableClickPropagation(inspector.current);
      DomEvent.disableScrollPropagation(inspector.current);
    }
  }, [point]);
  useEffect(() => {
    const container = map.getContainer();
    const pickSiteThroughReferenceLayers = (event: MouseEvent) => {
      if ((event.target as Element).closest('.leaflet-control, .leaflet-popup')) return;
      const drag = map.dragging;
      if ('moved' in drag && typeof drag.moved === 'function' && drag.moved()) return;
      const location = map.mouseEventToLatLng(event);
      queueMicrotask(() => setPoint({ lat: location.lat, lng: location.lng }));
    };
    container.addEventListener('click', pickSiteThroughReferenceLayers, true);
    return () => container.removeEventListener('click', pickSiteThroughReferenceLayers, true);
  }, [map]);
  return (
    <>
      <TileLayer
        url="/api/hazard-tiles/100/{z}/{x}/{y}.png"
        minZoom={10}
        maxNativeZoom={16}
        maxZoom={22}
        opacity={0.7}
        eventHandlers={{ tileerror: () => setErrors((v) => v + 1) }}
        attribution="© European Union, CEMS/JRC flood hazard v2.1.2, CC BY 4.0"
      />
      <div className="my-hazard-legend leaflet-control" onClick={(e) => e.stopPropagation()}>
        <strong>JRC modelled river flood · 100-year</strong>
        <span>
          90 m cells ·{' '}
          {zoom < 10 ? 'Zoom 10+ to display depths' : 'Click the map to inspect a site'}
        </span>
        <span>
          <i style={{ background: '#38bdf8' }} /> &lt;1 m <i style={{ background: '#3b82f6' }} />{' '}
          1–&lt;3 m <i style={{ background: '#a855f7' }} /> 3–&lt;10 m{' '}
          <i style={{ background: '#f43f5e' }} /> ≥10 m
        </span>
        <small>
          Transparent = zero or NoData, never proof of no risk. Static global model; potential
          artefacts and permanent water may appear. Inspect source quality flags at a site.
        </small>
        {errors > 0 && (
          <small role="alert">Some raster tiles are unavailable. Toggle the layer to retry.</small>
        )}
      </div>
      {point && (
        <>
          <CircleMarker
            center={[point.lat, point.lng]}
            radius={7}
            pathOptions={{ color: '#fbbf24' }}
          />
          <div
            ref={inspector}
            className="my-hazard-site-inspector leaflet-control"
            role="region"
            aria-label="Flood site inspector"
          >
            <button
              className="precip-btn"
              aria-label="Close flood site inspector"
              onClick={() => setPoint(null)}
            >
              Close
            </button>
            <NationalSiteContext lat={point.lat} lng={point.lng} />
          </div>
        </>
      )}
    </>
  );
}
