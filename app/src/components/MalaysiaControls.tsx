import { useState, useEffect } from 'react';
import {
  REGIONS,
  MSMA_STATIONS,
  useSettings,
  updateSettings,
  selectedDesignStation,
} from '../malaysia/settings';
import { parseApprovedProfile, profileLabel, HP26_URL } from '../malaysia/design';
import { useData } from '../malaysia/useData';
import type { Forecast, Warning } from '../malaysia/domain';
import { localTime } from '../malaysia/domain';
import { download } from '../malaysia/sites';
export default function MalaysiaControls() {
  const settings = useSettings(),
    ms = settings.language === 'ms';
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  const forecasts = useData<Forecast[]>('/api/forecast', 3600000),
    warnings = useData<Warning[]>('/api/warnings');
  useEffect(() => {
    document.documentElement.lang = ms ? 'ms' : 'en';
  }, [ms]);
  const name = settings.region === 'Klang / Selangor' ? 'Selangor' : settings.region;
  const forecast = (forecasts.result?.data ?? [])
    .filter((f) => f.location.location_name.replace('WP ', '') === name)
    .sort((a, b) => a.date.localeCompare(b.date));
  async function importProfile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error('Profile must be smaller than 100 KB.');
      const custom = parseApprovedProfile(JSON.parse(await file.text()));
      updateSettings({ custom, stationId: custom.id });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid profile');
    }
  }
  const active = selectedDesignStation();
  return (
    <>
      <div className="my-toolbar">
        <label>
          {ms ? 'Lokasi peta' : 'Map region'}
          <select
            value={settings.region}
            onChange={(e) => updateSettings({ region: e.target.value })}
          >
            {REGIONS.map((r) => (
              <option key={r.name}>{r.name}</option>
            ))}
          </select>
        </label>
        <label className="my-idf-label">
          {ms ? 'Stesen hujan reka bentuk' : 'Design rainfall station'}
          <select
            aria-label="Design rainfall station"
            value={settings.stationId}
            onChange={(e) => updateSettings({ stationId: e.target.value })}
          >
            <option value="">
              {ms ? 'Pilih stesen reka bentuk' : 'Select design station'} ({MSMA_STATIONS.length})
            </option>
            {[...new Set(MSMA_STATIONS.map((s) => s.state))].map((state) => (
              <optgroup label={state} key={state}>
                {MSMA_STATIONS.filter((s) => s.state === state).map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name} · {s.id}
                  </option>
                ))}
              </optgroup>
            ))}
            {settings.custom && (
              <option value={settings.custom.id}>{settings.custom.name} (imported)</option>
            )}
          </select>
        </label>
        <span className="my-coverage">
          {active
            ? `${active.state} · ${profileLabel(active)}`
            : ms
              ? 'Pilih stesen untuk pengiraan'
              : 'Select a station to enable calculations'}
          <small>MYT · MYR · metric</small>
        </span>
        <button
          className="precip-btn"
          onClick={() => updateSettings({ language: ms ? 'en' : 'ms' })}
        >
          {ms ? 'English' : 'Bahasa Melayu'}
        </button>
        <button className="precip-btn" onClick={() => setOpen(true)}>
          {ms ? 'Data & cuaca' : 'Data & weather'}
        </button>
      </div>
      {open && (
        <div className="my-dialog-backdrop">
          <section
            className="my-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Malaysian data and weather"
          >
            <div className="my-dialog-heading">
              <h2>LivingShield · Malaysian data & weather</h2>
              <button
                className="precip-btn"
                onClick={() => setOpen(false)}
                aria-label="Close data panel"
              >
                Close
              </button>
            </div>
            <h3>{name} · MET Malaysia forecast</h3>
            {forecasts.error ? (
              <p role="alert">
                {forecasts.error}
                <button className="precip-btn" onClick={forecasts.refresh}>
                  Retry
                </button>
              </p>
            ) : (
              <div className="my-weather-grid">
                {forecast.map((f) => (
                  <article key={f.date}>
                    <strong>{f.date}</strong>
                    <p lang="ms">{f.summary_forecast}</p>
                    <span>
                      {f.min_temp}–{f.max_temp} °C
                    </span>
                  </article>
                ))}
              </div>
            )}
            <h3>National warnings · check each notice’s affected areas</h3>
            {warnings.error ? (
              <p role="alert">
                {warnings.error}
                <button className="precip-btn" onClick={warnings.refresh}>
                  Retry
                </button>
              </p>
            ) : (
              (warnings.result?.data ?? [])
                .filter((w) => {
                  const time = (v: string) =>
                    Date.parse(v + (/Z|[+-]\d\d:\d\d$/.test(v) ? '' : '+08:00'));
                  return time(w.valid_from) <= Date.now() && time(w.valid_to) >= Date.now();
                })
                .map((w, i) => (
                  <details key={i}>
                    <summary>{ms ? w.heading_bm : w.heading_en}</summary>
                    <p>{ms ? w.text_bm : w.text_en}</p>
                    <small>{w.valid_to} MYT</small>
                  </details>
                ))
            )}
            <h3>Verified coverage</h3>
            <ul>
              <li>
                All 13 states and 3 federal territories: MyGeo reference state boundaries; Sabah and
                Sarawak district/division boundaries. PLANMalaysia river areas include both sides of
                Malaysia.
              </li>
              <li>
                Sarawak catalogue: state river network, land use and water features; published
                irrigation scheme canals, storage pond, soil boundaries and scheme lots. Sabah: JKR
                road sections and JMG geology. These inventories have different geographic
                footprints. Sarawak gislink services require access permission (rechecked 19 October
                2026) and are marked unavailable. Accessible national river areas and model context
                remain available.
              </li>
              <li>
                Nationwide context: ESA WorldCover 2021 (10 m), Copernicus terrain (90 m), ISRIC
                predicted topsoil texture (250 m), and JRC modelled river-flood depths by return
                period. Models are labelled separately from Malaysian agency observations.
              </li>
              <li>
                HP26 2018: 53 Sabah, 120 Sarawak and 1 Labuan design profiles; nine East Malaysian
                storm-pattern regions. Minimum design duration 15 minutes; ARI 2–100 years. Select
                the temporal region from the published map.
              </li>
              <li>
                JPS Public InfoBanjir: national rainfall and river gauges, separate observation
                timestamps.
              </li>
              <li>
                MBDK / JUPEM: 202,107 Klang parcels; 10,758 drains; 77 ponds; council flood areas,
                hotspots, pumps and gates. Viewport queries show up to 600 records.
              </li>
              <li>
                JPS Selangor: actual 2021 flood incident points and Gombak MSMA ponds. These are not
                return-period flood maps.
              </li>
              <li>
                OpenStreetMap: mapped buildings, facilities, waterways, utilities and manholes where
                contributors have mapped them. Completeness varies.
              </li>
              <li>
                Open-Meteo: quantitative historical reanalysis and GloFAS modelled discharge,
                labelled separately from JPS observations. Free hosted endpoints are for
                non-commercial use.
              </li>
              <li>
                MSMA 2012: all 135 published Table 2.B1 station profiles and all five Appendix 2.C
                temporal pattern regions.
              </li>
            </ul>
            <h3>East Malaysian design rainfall</h3>
            <p>
              Choose a Sabah, Sarawak or Labuan HP26 profile in the station selector above.{' '}
              <a href={HP26_URL} target="_blank" rel="noreferrer">
                DID HP26 2018 source manual
              </a>
              . For storm simulations, confirm your numbered region against Figure 6.1 (PDF page
              62). Station coordinates are source references with two documented anomalies; nearby
              stations do not establish suitability. Updated approved profiles can also be imported
              below.
            </p>
            <label className="my-file">
              Import approved IDF profile (.json)
              <input
                aria-label="Import approved IDF profile"
                type="file"
                accept=".json"
                onChange={(e) => void importProfile(e.target.files?.[0])}
              />
            </label>
            <button
              className="precip-btn"
              onClick={() =>
                download('approved-idf-template.json', {
                  id: 'custom-approved',
                  name: '',
                  state: '',
                  source: 'https://',
                  lambda: null,
                  kappa: null,
                  theta: null,
                  eta: null,
                  minDurationMinutes: 15,
                  maxDurationMinutes: 4320,
                  page: 0,
                })
              }
            >
              Download blank profile template
            </button>
            <p>
              Imported profiles must support ARI 2–100 years and durations from their stated minimum
              (5–15 minutes) up to 72 hours for all workflows.
            </p>
            {error && (
              <p role="alert" className="my-error">
                {error}
              </p>
            )}
            <p>
              Design calculations are screening tools. Confirm current JPS/PBT requirements, survey,
              infiltration testing and local permissions. Property tax/assessed values, underground
              utility completeness and unsupported hazard probabilities are never invented.
            </p>
            <p>
              <a href="https://publicinfobanjir.water.gov.my/" target="_blank" rel="noreferrer">
                JPS
              </a>{' '}
              ·{' '}
              <a
                href="https://developer.data.gov.my/realtime-api/weather"
                target="_blank"
                rel="noreferrer"
              >
                MET/data.gov.my
              </a>{' '}
              ·{' '}
              <a
                href="https://wplb.water.gov.my/assets/msma-2nd-edition.pdf"
                target="_blank"
                rel="noreferrer"
              >
                MSMA source
              </a>{' '}
              ·{' '}
              <a href="https://data.water.gov.my/home" target="_blank" rel="noreferrer">
                Request JPS datasets
              </a>
            </p>
            {forecasts.result && (
              <small>Forecast fetched {localTime(forecasts.result.fetchedAt)} MYT</small>
            )}
          </section>
        </div>
      )}
    </>
  );
}
