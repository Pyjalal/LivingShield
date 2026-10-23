import { useState, useMemo, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMapEvents, useMap } from 'react-leaflet';
import type { FeatureCollection, Feature } from 'geojson';
import type { Layer as LeafletLayer } from 'leaflet';
import { useData } from '../malaysia/useData';
import { useSettings, getRegion } from '../malaysia/settings';
import { download } from '../malaysia/sites';
import { parseSites } from '../malaysia/sites';
import { downloadCSV } from '../utils/export';
import RegionFocus from './RegionFocus';
import BasemapSwitcher from './BasemapSwitcher';
import { BASEMAPS } from '../config/basemaps';
import { useBasemap } from '../config/appearance';
import {
  NATIONAL_DATASETS,
  datasetSupportsRegion,
  defaultWaterDataset,
} from '../malaysia/catalogue';
const OPTIONS = [
  ...Object.entries(NATIONAL_DATASETS).map(([id, d]) => ({
    id,
    name: d.label,
    source: `${d.coverage}. ${d.description}`,
    kind: 'gis',
    regions: d.regions,
    minZoom: d.minZoom,
    unavailable: d.availability === 'restricted',
  })),
  { id: 'drainage', name: 'Engineering drains', source: 'MBDK · Klang', kind: 'gis' },
  { id: 'drain-details', name: 'Drain survey details', source: 'MBDK · Klang', kind: 'gis' },
  { id: 'ponds', name: 'Retention ponds', source: 'MBDK · Klang', kind: 'gis' },
  { id: 'jps-ponds', name: 'MSMA ponds', source: 'JPS · Gombak', kind: 'gis' },
  { id: 'pumps', name: 'Drainage pumps', source: 'MBDK · Klang', kind: 'gis' },
  { id: 'flapgates', name: 'Flapgates', source: 'MBDK · Klang', kind: 'gis' },
  {
    id: 'ditches',
    name: 'Mapped drains & ditches',
    source: 'OpenStreetMap · local view',
    kind: 'osm',
  },
  {
    id: 'manholes',
    name: 'Mapped manholes',
    source: 'OpenStreetMap · sparse coverage',
    kind: 'osm',
  },
];
function Viewport({ update }: { update: (bbox: string, zoom: number) => void }) {
  const map = useMap();
  const changed = useCallback(() => {
    const b = map.getBounds();
    update(
      [
        Math.max(98, b.getWest()),
        Math.max(0, b.getSouth()),
        Math.min(121, b.getEast()),
        Math.min(9, b.getNorth()),
      ]
        .map((n) => n.toFixed(5))
        .join(','),
      map.getZoom(),
    );
  }, [map, update]);
  useMapEvents({ moveend: changed });
  useEffect(changed, [changed]);
  return null;
}
function RegionalDrainageView() {
  const { basemap, automatic, choose } = useBasemap();
  const bm = BASEMAPS[basemap];
  const settings = useSettings(),
    region = getRegion();
  const [id, setId] = useState(defaultWaterDataset(settings.region)),
    [query, setQuery] = useState(''),
    [bbox, setBbox] = useState(
      `${region.lng - 0.05},${region.lat - 0.05},${region.lng + 0.05},${region.lat + 0.05}`,
    ),
    [selected, setSelected] = useState<Feature | null>(null),
    [imports, setImports] = useState<FeatureCollection | null>(null),
    [error, setError] = useState('');
  const [zoom, setZoom] = useState(region.zoom);
  const updateViewport = useCallback((b: string, z: number) => {
    setBbox(b);
    setZoom(z);
    setSelected(null);
  }, []);
  const options = OPTIONS.filter((o) =>
    datasetSupportsRegion(
      {
        regions:
          'regions' in o ? o.regions : o.kind === 'osm' ? ['Malaysia'] : ['Klang / Selangor'],
      },
      settings.region,
    ),
  );
  const option = options.find((o) => o.id === id)!;
  const minZoom = 'minZoom' in option ? option.minZoom : option.kind === 'osm' ? 13 : 12;
  const remote = useData<FeatureCollection>(
    zoom >= minZoom ? `/api/${option.kind}?id=${id}&bbox=${bbox}` : '',
  );
  const features = useMemo(
    () =>
      (remote.result?.data.features ?? []).filter((f) =>
        JSON.stringify(f.properties).toLowerCase().includes(query.toLowerCase()),
      ),
    [remote.result, query],
  );
  const data: FeatureCollection = { type: 'FeatureCollection', features };
  const keys = [...new Set(features.flatMap((f) => Object.keys(f.properties ?? {})))]
    .filter((k) => !k.toLowerCase().includes('shape'))
    .slice(0, 7);
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5000000) throw new Error('Maximum 5 MB');
      setImports(parseSites(await file.text()));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid import');
    }
  }
  return (
    <div className="precip-view">
      <aside className="precip-sidebar">
        <div className="precip-sidebar-header">
          <h2>Drainage &amp; Water</h2>
          <p className="precip-subtitle">Official assets · mapped context · user inventory</p>
        </div>
        <div className="precip-section">
          <label className="precip-label">
            Asset dataset
            <select
              className="dc-select"
              aria-label="Asset dataset"
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setSelected(null);
              }}
            >
              {options.map((o) => (
                <option value={o.id} key={o.id} disabled={'unavailable' in o && o.unavailable}>
                  {o.name}
                  {'unavailable' in o && o.unavailable ? ' · access required' : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="precip-hint">
            {option.source}. Loaded by viewport; zoom for detailed records. Map region:{' '}
            {settings.region}.
          </p>
        </div>
        <div className="precip-section">
          <label className="precip-label">
            Filter attributes
            <input
              aria-label="Filter drainage attributes"
              className="prop-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Road, type, owner or name"
            />
          </label>
          <button className="precip-btn" onClick={remote.refresh}>
            Refresh assets
          </button>
        </div>
        <div className="precip-section">
          <div className="dc-stat">
            <span className="dc-stat-value">{remote.result ? features.length : '—'}</span>
            <span className="dc-stat-label">Features loaded in viewport / filter</span>
          </div>
          <p className="precip-hint">
            A zero count outside source coverage does not mean no drainage exists. Underground pipe
            connectivity, invert levels and completeness are not inferred.
          </p>
        </div>
        <div className="precip-section">
          <label className="my-file">
            Import authorised assets (.geojson)
            <input
              aria-label="Import drainage assets"
              type="file"
              accept=".geojson,.json"
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
          </label>
          {imports && (
            <p>
              {imports.features.length} imported assets{' '}
              <button className="precip-btn" onClick={() => setImports(null)}>
                Remove
              </button>
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <p className="precip-hint">
            Use local-authority/developer surveys to fill unpublished inventory. Imports remain in
            this browser session.
          </p>
        </div>
      </aside>
      <div className="precip-main">
        <div className={`my-explorer-map map-panel ${bm.isDark ? 'theme-dark' : 'theme-light'}`}>
          <MapContainer
            center={[region.lat, region.lng]}
            zoom={region.zoom}
            className="precip-map-full"
          >
            <RegionFocus />
            <Viewport update={updateViewport} />
            <TileLayer
              key={basemap}
              url={bm.url}
              attribution={bm.attr}
              {...('maxZoom' in bm ? { maxZoom: bm.maxZoom } : {})}
            />
            <GeoJSON
              key={`${id}-${bbox}-${features.length}`}
              data={data}
              style={{ color: '#38bdf8', weight: 3, fillOpacity: 0.12 }}
              onEachFeature={(f, layer: LeafletLayer) => {
                layer.on('click', () => setSelected(f));
              }}
            />
            {imports && (
              <GeoJSON
                key={`import-${imports.features.length}`}
                data={imports}
                style={{ color: '#fbbf24', weight: 3, fillOpacity: 0.15 }}
              />
            )}
          </MapContainer>
          <BasemapSwitcher
            active={basemap}
            onChange={choose}
            automatic={automatic}
            onAutomatic={() => choose('auto')}
          />
        </div>
        <div className="my-explorer-charts">
          <div className="my-section-heading">
            <h3>{option.name}</h3>
            <div className="my-actions">
              <button
                className="export-btn"
                disabled={!features.length || !!remote.error || remote.loading}
                onClick={() =>
                  downloadCSV(
                    features.map((f) => ({
                      ...f.properties,
                      source: remote.result?.source,
                      fetched_at: remote.result?.fetchedAt,
                    })),
                    'malaysia_drainage_assets.csv',
                  )
                }
              >
                CSV
              </button>
              <button
                className="export-btn"
                disabled={!features.length || !!remote.error || remote.loading}
                onClick={() =>
                  download('malaysia_drainage_assets.geojson', {
                    ...data,
                    source: remote.result?.source,
                    fetchedAt: remote.result?.fetchedAt,
                    coverage: option.source,
                    notice:
                      remote.result?.notice ??
                      (remote.result?.data as FeatureCollection & { notice?: string })?.notice,
                  })
                }
              >
                GeoJSON
              </button>
            </div>
          </div>
          {remote.loading && <p role="status">Loading official asset geometry…</p>}
          {zoom < minZoom && <p role="status">Zoom {minZoom}+ to load this dataset.</p>}
          {remote.error && (
            <p role="alert" className="my-error">
              {remote.error}
            </p>
          )}
          <p className="dc-note">
            {remote.result?.notice}{' '}
            {'notice' in (remote.result?.data ?? {})
              ? String(
                  (remote.result?.data as FeatureCollection & { notice?: string }).notice ?? '',
                )
              : ''}{' '}
            Source units are retained; missing dimensions/year are not filled with estimates.
          </p>
          {selected && (
            <div className="sim-chart-card">
              <h4>Selected asset · published attributes</h4>
              <table className="dc-table">
                <tbody>
                  {Object.entries(selected.properties ?? {}).map(([key, value]) => (
                    <tr key={key}>
                      <th>{key}</th>
                      <td>{value == null ? 'Not provided' : String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="dc-table-wrap">
            <table className="dc-table">
              <thead>
                <tr>
                  {keys.map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.slice(0, 75).map((f, i) => (
                  <tr key={i} onClick={() => setSelected(f)}>
                    {keys.map((k) => (
                      <td key={k}>{f.properties?.[k] == null ? '—' : String(f.properties[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!remote.loading && !remote.error && !features.length && (
            <p>
              No records returned in this viewport. Check this source’s stated coverage, choose
              another regional dataset, zoom to local streets for OSM, or import your authorised
              inventory.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
export default function MalaysiaDrainageView() {
  const { region } = useSettings();
  return <RegionalDrainageView key={region} />;
}
