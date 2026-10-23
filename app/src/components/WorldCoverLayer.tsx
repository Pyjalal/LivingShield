import { useState } from 'react';
import { WMSTileLayer } from 'react-leaflet';
import type { LayerConfig } from '../types';
const CLASSES = [
  ['10', 'Tree cover', '#006400'],
  ['20', 'Shrubland', '#ffbb22'],
  ['30', 'Grassland', '#ffff4c'],
  ['40', 'Cropland', '#f096ff'],
  ['50', 'Built-up', '#fa0000'],
  ['60', 'Bare / sparse vegetation', '#b4b4b4'],
  ['70', 'Snow and ice', '#f0f0f0'],
  ['80', 'Permanent water bodies', '#0064c8'],
  ['90', 'Herbaceous wetland', '#0096a0'],
  ['95', 'Mangroves', '#00cf75'],
  ['100', 'Moss and lichen', '#fae6a0'],
];
export default function WorldCoverLayer({ config }: { config: LayerConfig }) {
  const [errors, setErrors] = useState(0);
  return (
    <>
      <WMSTileLayer
        uppercase
        url={config.endpoint}
        params={{
          layers: config.wmsLayers!,
          format: 'image/png',
          transparent: true,
          version: '1.3.0',
          ...{ time: config.wmsTime },
        }}
        minZoom={4}
        opacity={0.65}
        attribution={config.attribution}
        eventHandlers={{ tileerror: () => setErrors((v) => v + 1) }}
      />
      <details
        className="my-worldcover-legend leaflet-control"
        onClick={(e) => e.stopPropagation()}
      >
        <summary>ESA land cover · 2021 legend</summary>
        <p>
          10 m classification. Colours are blended with the basemap. This is satellite land cover,
          not current legal land use.
        </p>
        {CLASSES.map(([code, label, color]) => (
          <div key={code}>
            <i style={{ background: color }} />
            {code} · {label}
          </div>
        ))}
        {errors > 0 && (
          <p role="alert">Some land-cover tiles are unavailable. Toggle the layer to retry.</p>
        )}
        <a href="https://esa-worldcover.org/en/data-access" target="_blank" rel="noreferrer">
          ESA class definitions and source
        </a>
      </details>
    </>
  );
}
