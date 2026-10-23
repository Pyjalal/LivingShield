import { useState } from 'react';
import { useData } from '../malaysia/useData';
import { download } from '../malaysia/sites';
interface Hazard {
  depthM: number | null;
  returnPeriodYears: number;
  resolution_m: number;
  potentialArtefact: boolean | null;
  permanentWater: boolean | null;
  qualityMasksAvailable: boolean;
  source: string;
  notice: string;
  attribution: string;
}
interface Soil {
  resolution_m: number;
  texture: { property: string; percent: number | null; depth: string }[];
}
export default function NationalSiteContext({ lat, lng }: { lat: number; lng: number }) {
  const [ari, setAri] = useState(100),
    [request, setRequest] = useState(''),
    [soilRequest, setSoilRequest] = useState('');
  const key = `lat=${lat}&lng=${lng}`,
    active = request === key;
  const terrain = useData<{ elevation_m: number; resolution_m: number }>(
    active ? `/api/elevation?${key}` : '',
    86400000,
  );
  const hazard = useData<Hazard>(active ? `/api/hazard?${key}&ari=${ari}` : '', 86400000);
  const soil = useData<Soil>(soilRequest === key ? `/api/soil?${key}` : '', 86400000);
  const h = hazard.result?.data;
  return (
    <div className="my-national-context">
      <h4>
        National site data · {lat.toFixed(5)}, {lng.toFixed(5)}
      </h4>
      <p>Available across Peninsular Malaysia, Sabah, Sarawak and Labuan.</p>
      <label className="my-label">
        Modelled river-flood scenario
        <select
          aria-label="Flood return period"
          className="dc-select"
          value={ari}
          onChange={(e) => setAri(Number(e.target.value))}
        >
          {[10, 20, 50, 75, 100, 200, 500].map((v) => (
            <option key={v} value={v}>
              {v}-year return period
            </option>
          ))}
        </select>
      </label>
      <button
        className="precip-btn"
        onClick={() => {
          setRequest(key);
          if (active) {
            terrain.refresh();
            hazard.refresh();
          }
        }}
      >
        Load national site data
      </button>
      <div className="my-site-report-grid">
        <div>
          <strong>JRC/Copernicus modelled river flood</strong>
          {hazard.loading ? (
            <p role="status">Reading flood-depth cell and quality masks…</p>
          ) : hazard.error ? (
            <p role="alert">Source unavailable: {hazard.error}</p>
          ) : h ? (
            <>
              <p>
                {h.depthM === null
                  ? 'No modelled value at this cell'
                  : `${h.depthM.toFixed(3)} m modelled depth`}{' '}
                · {h.returnPeriodYears}-year scenario · approximately {h.resolution_m} m cell.
              </p>
              {h.potentialArtefact && (
                <p role="alert">
                  Source quality mask flags a potential modelling artefact at this cell.
                </p>
              )}
              {h.permanentWater && <p>Source classifies this cell as permanent water.</p>}
              {!h.qualityMasksAvailable && <p>Quality masks could not be retrieved.</p>}
              <p>{h.notice}</p>
              <a href={h.source} target="_blank" rel="noreferrer">
                Source raster
              </a>
              <small> · {h.attribution}</small>
            </>
          ) : (
            <p>Load the selected scenario for this site.</p>
          )}
        </div>
        <div>
          <strong>Copernicus terrain · 2021</strong>
          <p>
            {terrain.loading
              ? 'Loading terrain…'
              : terrain.error
                ? `Source unavailable: ${terrain.error}`
                : terrain.result
                  ? `${terrain.result.data.elevation_m.toFixed(1)} m terrain elevation · ${terrain.result.data.resolution_m} m grid`
                  : 'Terrain height available on request.'}
          </p>
          <small>
            Terrain context, not a survey, drain invert or flood depth. Copernicus DEM GLO-90 via
            Open-Meteo; free hosted service for non-commercial use.
          </small>
        </div>
        <div>
          <strong>ISRIC SoilGrids topsoil texture</strong>
          <button
            className="precip-btn"
            disabled={soil.loading}
            onClick={() => {
              setSoilRequest(key);
              if (soilRequest === key) soil.refresh();
            }}
          >
            Load soil texture
          </button>
          {soil.loading ? (
            <p role="status">Loading predicted texture…</p>
          ) : soil.error ? (
            <p role="alert">Source unavailable: {soil.error}</p>
          ) : soil.result ? (
            <p>
              {soil.result.data.texture
                .map(
                  (v) =>
                    `${v.property}: ${v.percent === null ? 'No model value' : v.percent.toFixed(1) + '%'}`,
                )
                .join(' · ')}
            </p>
          ) : null}
          <small>
            250 m predictions, 0–5 cm depth. Texture does not supply tested hydraulic conductivity
            or an infiltration rate. Urban/coastal cells may be missing.
          </small>
        </div>
      </div>
      {h && !hazard.error && !hazard.loading && (
        <button
          className="export-btn"
          onClick={() =>
            download('malaysia-site-context.json', {
              location: { lat, lng },
              hazard: hazard.result,
              terrain: terrain.error ? null : terrain.result,
              soil: soil.error ? null : soil.result,
            })
          }
        >
          Export sourced site context
        </button>
      )}
      <p className="dc-note">
        <a
          href="https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/README.txt"
          target="_blank"
          rel="noreferrer"
        >
          JRC model and quality notes
        </a>{' '}
        ·{' '}
        <a href="https://esa-worldcover.org/en/data-access" target="_blank" rel="noreferrer">
          WorldCover 2021
        </a>{' '}
        ·{' '}
        <a href="https://open-meteo.com/en/docs/elevation-api" target="_blank" rel="noreferrer">
          Terrain
        </a>{' '}
        ·{' '}
        <a href="https://soilgrids.org/" target="_blank" rel="noreferrer">
          SoilGrids
        </a>
      </p>
    </div>
  );
}
