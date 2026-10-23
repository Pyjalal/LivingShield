import { useState } from 'react';
import { usePropertySearch, fmtArea, chooseSite } from '../malaysia/property';
import { SidebarInputPanel, SiteMapPanel } from './SiteInputPanel';
import { parseSites, download } from '../malaysia/sites';
import type { Position } from 'geojson';
export default function MalaysiaPropertyView() {
  const ps = usePropertySearch();
  const [error, setError] = useState('');
  async function importSite(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5000000) throw new Error('Maximum 5 MB');
      const collection = parseSites(await file.text()),
        feature = collection.features[0],
        p = feature.properties ?? {},
        positions: Position[] = [];
      function collect(v: unknown) {
        if (!Array.isArray(v)) return;
        if (typeof v[0] === 'number') positions.push(v as Position);
        else v.forEach(collect);
      }
      if ('coordinates' in feature.geometry) collect(feature.geometry.coordinates);
      if (!positions.length) throw new Error('No site coordinates');
      const lng = positions.reduce((s, p) => s + p[0], 0) / positions.length,
        lat = positions.reduce((s, p) => s + p[1], 0) / positions.length;
      const suppliedArea = Number(p.lot_area_m2 ?? p.area_m2 ?? p.KELUASAN);
      chooseSite({
        accountNumber: 'imported-site',
        address: String(p.name ?? file.name),
        lat,
        lng,
        lotSize: suppliedArea > 0 ? String(suppliedArea) : '',
        totalGrossArea: Number(p.building_area_m2) > 0 ? String(p.building_area_m2) : '',
        zoning: String(p.landuse ?? ''),
        neighbourhood: String(p.neighbourhood ?? ''),
        yearBuilt: '',
        garage: false,
        legalDescription: String(p.UPI ?? 'User-supplied boundary'),
        ward: '',
        sourceLabel: 'User imported GeoJSON; area only used when supplied as lot_area_m2',
        geometry: feature.geometry,
      });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid site data');
    }
  }
  const p = ps.selected;
  return (
    <div className="precip-view">
      <aside className="precip-sidebar eng-sidebar">
        <div className="precip-sidebar-header">
          <h2>Property Lookup</h2>
          <p className="precip-subtitle">Malaysian addresses · official Klang parcels</p>
        </div>
        <SidebarInputPanel {...ps} />
        <div className="precip-section">
          <button className="precip-btn" onClick={() => void ps.runSearch('Lot 28681')}>
            Load real Klang parcel: Lot 28681
          </button>
          <p className="precip-hint">
            Official MBDK/JUPEM record, not a fictional demonstration property. Address searches
            elsewhere return mapped locations; enter surveyed dimensions before design.
          </p>
        </div>
        <div className="precip-section">
          <label className="my-file">
            Import your site boundary (.geojson)
            <input
              aria-label="Import site boundary"
              type="file"
              accept=".json,.geojson"
              onChange={(e) => void importSite(e.target.files?.[0])}
            />
          </label>
          <p className="precip-hint">
            First feature becomes the shared site. Supply lot_area_m2 and building_area_m2
            properties when known; missing dimensions are never invented.
          </p>
          {error && <p role="alert">{error}</p>}
        </div>
      </aside>
      <div className="precip-main">
        <div className="sim-split-main">
          <SiteMapPanel {...ps} compact />
          <div className="sim-charts-area">
            {!p && !ps.analysisData ? (
              <div className="sim-chart-card">
                <h3>Find a Malaysian site</h3>
                <p>
                  Search a Malaysian address, search a Klang lot number, click within official Klang
                  parcel coverage, enter manual dimensions or import a surveyed boundary. The same
                  site will be available in all engineering tabs.
                </p>
              </div>
            ) : (
              <div className="sim-chart-card">
                <h3>{ps.analysisData?.address ?? p?.address}</h3>
                <div className="dc-stat-grid">
                  <div className="dc-stat highlight">
                    <span className="dc-stat-value">
                      {fmtArea(ps.analysisData?.lotSize ?? p?.lotSize ?? '')}
                    </span>
                    <span className="dc-stat-label">Published / supplied lot area</span>
                  </div>
                  <div className="dc-stat">
                    <span className="dc-stat-value">
                      {fmtArea(ps.analysisData?.buildingArea ?? p?.totalGrossArea ?? '')}
                    </span>
                    <span className="dc-stat-label">Supplied building footprint</span>
                  </div>
                  <div className="dc-stat">
                    <span className="dc-stat-value">{p?.legalDescription || 'User supplied'}</span>
                    <span className="dc-stat-label">UPI / source reference</span>
                  </div>
                </div>
                <table className="dc-table">
                  <tbody>
                    <tr>
                      <th>Source</th>
                      <td>{p?.sourceLabel ?? 'Manual site inputs'}</td>
                    </tr>
                    <tr>
                      <th>Area basis</th>
                      <td>
                        {p?.areaBasis ??
                          'User input; no building or lot dimensions inferred from an address centroid'}
                      </td>
                    </tr>
                    <tr>
                      <th>Mukim / neighbourhood</th>
                      <td>
                        {ps.analysisData?.neighbourhood || p?.neighbourhood || 'Not provided'}
                      </td>
                    </tr>
                    <tr>
                      <th>Location</th>
                      <td>
                        {(ps.analysisData?.lat ?? p?.lat)?.toFixed(6)},{' '}
                        {(ps.analysisData?.lng ?? p?.lng)?.toFixed(6)}
                      </td>
                    </tr>
                    <tr>
                      <th>Year built</th>
                      <td>{ps.analysisData?.yearBuilt || 'Not provided by source'}</td>
                    </tr>
                    <tr>
                      <th>Assessed value / tax</th>
                      <td>
                        Not supplied by these public datasets. No estimated valuation presented.
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="dc-note">
                  Published land-use polygons can be viewed in Map Layers. Runoff land-use
                  selections are scenario assumptions, not legal zoning certificates.
                </p>
                <button
                  className="export-btn"
                  onClick={() =>
                    download('malaysia-property-site.json', {
                      site: ps.analysisData,
                      property: p,
                      source: p?.source,
                      generatedAt: new Date().toISOString(),
                    })
                  }
                >
                  Export site JSON
                </button>
              </div>
            )}
            {ps.nearbyFacilities.length > 0 && (
              <div className="sim-chart-card">
                <h4>Nearby official retention ponds</h4>
                <table className="dc-table">
                  <thead>
                    <tr>
                      <th>Pond</th>
                      <th>Owner</th>
                      <th>Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ps.nearbyFacilities.map((f, i) => (
                      <tr key={i}>
                        <td>{f.name}</td>
                        <td>{f.owner}</td>
                        <td>{f.distKm} km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
