import { usePropertySearch } from '../hooks/usePropertySearch';
import { useStationIDF } from '../hooks/useStationIDF';
import { SidebarInputPanel, SiteMapPanel } from './SiteInputPanel';
import DrainageCalculator from './DrainageCalculator';
import SiteReport from './SiteReport';

export default function EngineeringView() {
  const ps = usePropertySearch();
  const idfData = useStationIDF(ps.analysisData?.lat ?? 0, ps.analysisData?.lng ?? 0);

  const hasData = !!ps.analysisData && ps.analysisData.lotSize > 0 && ps.analysisData.buildingKnown;
  const hasLocation = hasData && ps.analysisData!.lat !== 0;

  return (
    <div className="precip-view">
      <div className="precip-sidebar eng-sidebar">
        <div className="precip-sidebar-header">
          <h2>Site Analysis</h2>
          <p className="precip-subtitle">Engineering Hydrology &middot; Drainage Design</p>
        </div>

        <SidebarInputPanel {...ps} />

        {!hasData && !ps.searched && ps.mode === 'search' && (
          <div className="precip-section">
            <div className="prop-info-card">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 16c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                <path d="M2 12c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                <path d="M12 2v6" />
                <path d="M9 5l3-3 3 3" />
              </svg>
              <div>
                <strong>Engineering Site Analysis</strong>
                <p>
                  Search a Malaysian address or Klang parcel or enter custom site dimensions to run
                  a full drainage analysis with IDF curves, Rational Method calculations, and LID
                  simulation.
                </p>
                <p>
                  Based on CIV E 321 principles: P &minus; R &minus; G &minus; E &minus; T =
                  &Delta;S
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="precip-section precip-footer-section">
          <p className="precip-hint" style={{ fontSize: 11 }}>
            <strong>Real data:</strong>{' '}
            <a
              href="https://gis.mpklang.gov.my/server/rest/services"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--hg-green)', textDecoration: 'none' }}
            >
              MBDK / JUPEM / user survey
            </a>{' '}
            &middot; Rawls et al. (1983) &middot; Bedient et al. (2019)
            <br />
            <strong>Approximate:</strong> IDF intensities — verify against{' '}
            <a
              href="https://wplb.water.gov.my/assets/msma-2nd-edition.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--hg-green)', textDecoration: 'none' }}
            >
              JPS MSMA reference
            </a>
          </p>
          <p className="footer-credit">LivingShield</p>
        </div>
      </div>

      <div className="precip-main">
        <div className="sim-split-main">
          <SiteMapPanel
            handleMapClick={ps.handleMapClick}
            markerPos={ps.markerPos}
            visibleMarkers={ps.visibleMarkers}
            selected={ps.selected}
            setSelected={ps.setSelected}
            setClickMarker={ps.setClickMarker}
            clickMarker={ps.clickMarker}
            clickLoading={ps.clickLoading}
            mode={ps.mode}
            compact
          />

          {!hasData ? (
            <div className="precip-overlay-loading" style={{ flex: 1 }}>
              Select a property, then use Manual Input to enter the surveyed building footprint (0
              for no buildings), lot area and coordinates.
            </div>
          ) : (
            <div className="sim-charts-area">
              {hasLocation && (
                <SiteReport
                  lat={ps.analysisData!.lat}
                  lng={ps.analysisData!.lng}
                  neighbourhood={ps.analysisData!.neighbourhood}
                  address={ps.analysisData!.address}
                />
              )}

              <DrainageCalculator
                lotSize={ps.analysisData!.lotSize}
                buildingArea={ps.analysisData!.buildingArea}
                address={ps.analysisData!.address}
                zoning={ps.analysisData!.zoning}
                zoningImpervious={ps.analysisData!.zoningImpervious}
                zoningPaveFrac={ps.analysisData!.zoningPaveFrac}
                idfData={idfData}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
