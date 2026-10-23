import { useState } from 'react';
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet';
import type { Township, TownshipDataset } from './model';
import 'leaflet/dist/leaflet.css';

export default function AerialReference({
  township,
  data,
}: {
  township: Township;
  data: TownshipDataset;
}) {
  const [footprints, setFootprints] = useState(true);
  const [failed, setFailed] = useState(false);
  const buildings = {
    ...data,
    features: data.features.filter((f) => f.properties.kind === 'building'),
  };
  return (
    <section className="tt-aerial" aria-label="Aerial imagery reference for visual comparison">
      <MapContainer
        bounds={[
          [township.bbox[1], township.bbox[0]],
          [township.bbox[3], township.bbox[2]],
        ]}
        boundsOptions={{ padding: [8, 8] }}
        maxZoom={20}
        preferCanvas
      >
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Imagery © Esri, Vantor, Earthstar Geographics, and the GIS User Community"
          eventHandlers={{ tileerror: () => setFailed(true) }}
        />
        {footprints && (
          <GeoJSON
            data={buildings}
            style={(feature) => ({
              color: feature?.properties.dataSource ? '#56e6df' : '#ffdf64',
              weight: 1,
              fillOpacity: 0.04,
            })}
            interactive={false}
          />
        )}
      </MapContainer>
      <div className="tt-aerial-caption">
        <strong>Aerial reference · same location</strong>
        <p>
          Yellow: OSM. Cyan: Microsoft machine-extracted footprints. Imagery dates vary; this is a
          visual check, not a survey.
        </p>
        <label>
          <input
            type="checkbox"
            checked={footprints}
            onChange={(e) => setFootprints(e.target.checked)}
          />{' '}
          Show footprint outlines
        </label>
        {failed && <p role="status">Some imagery tiles could not load. Pan or zoom to retry.</p>}
      </div>
    </section>
  );
}
