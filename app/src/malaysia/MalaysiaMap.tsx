import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
  GeoJSON,
  ImageOverlay,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import { BASEMAPS, type BasemapKey } from '../config/basemaps';
import { isFresh, localTime, type Station, type Language, type RainLayer } from './domain';
import 'leaflet/dist/leaflet.css';

export const RAIN_SERVICE =
  'https://maps.water.gov.my/arcgis/rest/services/isohyetmap/isohyet/MapServer';
const colors = {
  Normal: '#187b6b',
  Alert: '#b17705',
  Warning: '#d26919',
  Danger: '#c73745',
  Unknown: '#7d8e97',
};
export interface Focus {
  lat: number;
  lng: number;
  zoom?: number;
}
interface Props {
  stations: Station[];
  selected: Station | null;
  onSelect: (station: Station) => void;
  onSite: (point: Focus) => void;
  focus: Focus;
  basemap: BasemapKey;
  sites: GeoJSON.FeatureCollection | null;
  rain: RainLayer | null;
  language: Language;
  site: Focus;
}
function Controls({
  focus,
  sites,
  onSite,
}: {
  focus: Focus;
  sites: GeoJSON.FeatureCollection | null;
  onSite: Props['onSite'];
}) {
  const map = useMap();
  useMapEvents({
    click: (e) => onSite({ lat: e.latlng.lat, lng: e.latlng.lng, zoom: map.getZoom() }),
  });
  useEffect(() => {
    map.setView([focus.lat, focus.lng], focus.zoom ?? 10);
  }, [map, focus]);
  useEffect(() => {
    if (sites) {
      const bounds = L.geoJSON(sites).getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  }, [map, sites]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
function RainOverlay({ layer }: { layer: RainLayer }) {
  const map = useMap();
  const [viewport, setViewport] = useState(() => ({
    bounds: map.getBounds(),
    size: map.getSize(),
  }));
  const [error, setError] = useState(false);
  useMapEvents({
    moveend: () => setViewport({ bounds: map.getBounds(), size: map.getSize() }),
    resize: () => setViewport({ bounds: map.getBounds(), size: map.getSize() }),
  });
  const { bounds, size } = viewport;
  const params = new URLSearchParams({
    bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(','),
    bboxSR: '4326',
    imageSR: '4326',
    size: `${Math.min(2048, size.x)},${Math.min(2048, size.y)}`,
    format: 'png32',
    transparent: 'true',
    layers: `show:${layer.id}`,
    f: 'image',
  });
  return (
    <>
      <ImageOverlay
        url={`${RAIN_SERVICE}/export?${params}`}
        bounds={bounds}
        opacity={0.65}
        attribution="JPS Malaysia rainfall"
        eventHandlers={{ error: () => setError(true), load: () => setError(false) }}
      />
      {error && (
        <div className="map-notice" role="status">
          JPS rainfall image unavailable. Station readings remain available.
        </div>
      )}
    </>
  );
}
export default function MalaysiaMap({
  stations,
  selected,
  onSelect,
  onSite,
  focus,
  basemap,
  sites,
  rain,
  language,
  site,
}: Props) {
  const bm = BASEMAPS[basemap];
  return (
    <MapContainer
      center={[3.139, 101.687]}
      zoom={9}
      minZoom={4}
      className="malaysia-map"
      zoomControl={false}
    >
      <ZoomControl position="bottomright" />
      <Controls focus={focus} sites={sites} onSite={onSite} />
      <TileLayer
        key={basemap}
        url={bm.url}
        attribution={`${bm.attr} &copy; OpenStreetMap contributors`}
      />
      {rain && <RainOverlay layer={rain} />}
      {sites && (
        <GeoJSON
          key={JSON.stringify(sites).slice(0, 100) + sites.features.length}
          data={sites}
          style={{ color: '#7846a6', weight: 3, fillOpacity: 0.1 }}
        />
      )}
      {stations.map((station) => {
        const fresh =
          station.waterOnline && station.waterLevel !== null && isFresh(station.waterAt);
        const color = fresh ? colors[station.waterStatus] : '#8798a1';
        return (
          <CircleMarker
            key={station.id}
            center={[station.lat, station.lng]}
            radius={selected?.id === station.id ? 9 : 5}
            pathOptions={{
              color: selected?.id === station.id ? '#143f49' : '#ffffff',
              weight: 1.2,
              fillColor: color,
              fillOpacity: 0.9,
            }}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
                onSelect(station);
              },
            }}
          >
            <Popup>
              <strong>{station.name}</strong>
              <br />
              {station.district}, {station.state}
              <br />
              {fresh
                ? station.waterStatus
                : language === 'ms'
                  ? 'Aras air tidak terkini'
                  : 'No current water level'}
              <br />
              {station.waterLevel === null ? '—' : `${station.waterLevel.toFixed(2)} m`}
              <br />
              {localTime(station.waterAt, language)} MYT
              <br />
              <button type="button" onClick={() => onSelect(station)}>
                {language === 'ms' ? 'Lihat bacaan' : 'View readings'}
              </button>
            </Popup>
          </CircleMarker>
        );
      })}
      <CircleMarker
        center={[site.lat, site.lng]}
        radius={4}
        pathOptions={{ color: '#143f49', fillColor: '#ffffff', fillOpacity: 1, weight: 2 }}
      />
    </MapContainer>
  );
}
