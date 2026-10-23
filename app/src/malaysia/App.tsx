import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import MalaysiaMap, { type Focus, RAIN_SERVICE } from './MalaysiaMap';
import { useData } from './useData';
import {
  isFresh,
  localTime,
  type Station,
  type Forecast,
  type Warning,
  type RainMap,
  type Language,
} from './domain';
import { parseSites, download } from './sites';
import type { BasemapKey } from '../config/basemaps';
import logo from '../assets/logo.svg';
import './malaysia.css';

const DesignPanel = lazy(() => import('./DesignPanel'));
const RainChart = lazy(() => import('./RainChart'));

const REGIONS = [
  { name: 'Selangor', lat: 3.15, lng: 101.5, zoom: 9 },
  { name: 'Johor', lat: 1.9, lng: 103.4, zoom: 8 },
  { name: 'Kedah', lat: 6.1, lng: 100.6, zoom: 8 },
  { name: 'Kelantan', lat: 5.7, lng: 102.2, zoom: 8 },
  { name: 'Melaka', lat: 2.3, lng: 102.3, zoom: 10 },
  { name: 'Negeri Sembilan', lat: 2.75, lng: 102.1, zoom: 9 },
  { name: 'Pahang', lat: 3.8, lng: 102.5, zoom: 8 },
  { name: 'Perak', lat: 4.7, lng: 101, zoom: 8 },
  { name: 'Perlis', lat: 6.5, lng: 100.25, zoom: 10 },
  { name: 'Pulau Pinang', lat: 5.35, lng: 100.35, zoom: 10 },
  { name: 'Sabah', lat: 5.6, lng: 117, zoom: 7 },
  { name: 'Sarawak', lat: 2.6, lng: 113.3, zoom: 7 },
  { name: 'Terengganu', lat: 4.9, lng: 103, zoom: 8 },
  { name: 'WP Kuala Lumpur', lat: 3.139, lng: 101.687, zoom: 11 },
  { name: 'WP Labuan', lat: 5.3, lng: 115.23, zoom: 11 },
  { name: 'WP Putrajaya', lat: 2.93, lng: 101.69, zoom: 12 },
];
function stateKey(value: string) {
  return value.trim().toUpperCase().replace('WILAYAH PERSEKUTUAN', 'WP');
}
function number(value: number | null, decimals = 1) {
  return value === null ? '—' : value.toFixed(decimals);
}
function activeWater(s: Station, now = Date.now()) {
  return s.waterOnline && s.waterLevel !== null && isFresh(s.waterAt, now);
}
function activeRain(s: Station, now = Date.now()) {
  return s.rainOnline && s.rainfall1h !== null && isFresh(s.rainAt, now);
}
function safeDate(raw: string) {
  return /(?:Z|[+-]\d\d:\d\d)$/.test(raw) ? raw : `${raw}+08:00`;
}

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const t = (en: string, ms: string) => (language === 'ms' ? ms : en);
  const [view, setView] = useState<'map' | 'stations' | 'design' | 'sources'>('map');
  const [region, setRegion] = useState('Selangor');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>({ lat: 3.15, lng: 101.5, zoom: 9 });
  const [site, setSite] = useState({ lat: 3.15, lng: 101.5 });
  const [basemap, setBasemap] = useState<BasemapKey>('osm');
  const [rainEnabled, setRainEnabled] = useState(false);
  const [rainId, setRainId] = useState('');
  const [sites, setSites] = useState<GeoJSON.FeatureCollection | null>(null);
  const [siteFile, setSiteFile] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [importVersion, setImportVersion] = useState(0);
  const [freshnessTime, setFreshnessTime] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setFreshnessTime(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const stationData = useData<Station[]>('/api/stations');
  const forecasts = useData<Forecast[]>('/api/forecast', 3_600_000);
  const warnings = useData<Warning[]>('/api/warnings');
  const rainmap = useData<RainMap>('/api/rainmap', 900_000);
  const stations = useMemo(() => stationData.result?.data ?? [], [stationData.result]);
  const filtered = useMemo(
    () =>
      stations.filter(
        (s) =>
          (region === 'Malaysia' || stateKey(s.state) === stateKey(region)) &&
          `${s.name} ${s.district} ${s.basin} ${s.id}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (filter === 'all' ||
            (filter === 'rain' && activeRain(s, freshnessTime)) ||
            (filter === 'water' && activeWater(s, freshnessTime)) ||
            (filter === 'elevated' &&
              activeWater(s, freshnessTime) &&
              ['Alert', 'Warning', 'Danger'].includes(s.waterStatus))),
      ),
    [stations, region, query, filter, freshnessTime],
  );
  const selected = stations.find((s) => s.id === selectedId) ?? null;
  const freshRain = filtered.filter((s) => activeRain(s, freshnessTime));
  const freshWater = filtered.filter((s) => activeWater(s, freshnessTime));
  const elevated = freshWater.filter((s) => ['Alert', 'Warning', 'Danger'].includes(s.waterStatus));
  const maxRain = freshRain.length ? Math.max(...freshRain.map((s) => s.rainfall1h ?? 0)) : null;
  const rainLayers = rainmap.result?.data.layers ?? [];
  const rainLayer = rainEnabled
    ? (rainLayers.find((l) => String(l.id) === rainId) ?? rainLayers.at(-1) ?? null)
    : null;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const outlook = (forecasts.result?.data ?? [])
    .filter((f) => stateKey(f.location.location_name) === stateKey(region) && f.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const now = freshnessTime;
  const activeWarnings = (warnings.result?.data ?? []).filter(
    (w) => Date.parse(safeDate(w.valid_from)) <= now && Date.parse(safeDate(w.valid_to)) >= now,
  );
  const sourceUnavailable = !!stationData.error || !!stationData.result?.stale;
  function changeRegion(name: string) {
    setRegion(name);
    setSelectedId(null);
    setPage(0);
    const target = REGIONS.find((r) => r.name === name);
    setFocus(
      target
        ? { lat: target.lat, lng: target.lng, zoom: target.zoom }
        : { lat: 4.5, lng: 109.5, zoom: 5 },
    );
  }
  function selectStation(s: Station) {
    setSelectedId(s.id);
    setFocus({ lat: s.lat, lng: s.lng, zoom: 12 });
    setSite({ lat: s.lat, lng: s.lng });
  }
  async function importSites(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 5_000_000)
        throw new Error(t('Maximum file size is 5 MB.', 'Saiz maksimum fail ialah 5 MB.'));
      const collection = parseSites(await file.text());
      setSites(collection);
      setSiteFile(file.name);
      setImportError(null);
      setImportVersion((v) => v + 1);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid GeoJSON');
    }
  }
  const nav = [
    ['map', t('Map & outlook', 'Peta & ramalan')],
    ['stations', t('Station explorer', 'Penjelajah stesen')],
    ['design', t('Drainage planning', 'Perancangan saliran')],
    ['sources', t('Data sources', 'Sumber data')],
  ] as const;
  return (
    <div className="workspace" lang={language === 'ms' ? 'ms' : 'en'}>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView('map');
          }}
        >
          <img src={logo} width="32" height="32" alt="" />
          <span>
            LivingShield <b>Malaysia</b>
          </span>
        </a>
        <div className="header-right">
          <span className="timezone">UTC+08:00 / MYT</span>
          <button
            className="language"
            onClick={() => setLanguage((l) => (l === 'en' ? 'ms' : 'en'))}
          >
            {language === 'en' ? 'Bahasa Melayu' : 'English'}
          </button>
        </div>
      </header>
      <nav className="main-nav" aria-label={t('Main navigation', 'Navigasi utama')}>
        {nav.map(([key, label]) => (
          <button
            key={key}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <main>
        <div className="page-heading">
          <div>
            <h1>
              {view === 'design'
                ? t('Plan for the next downpour.', 'Rancang untuk hujan seterusnya.')
                : view === 'sources'
                  ? t('Know where the data comes from.', 'Kenali sumber data anda.')
                  : t('A clearer view of our water.', 'Gambaran air yang lebih jelas.')}
            </h1>
            <p>
              {t(
                'Rainfall, river conditions and drainage planning across Malaysia.',
                'Hujan, keadaan sungai dan perancangan saliran di seluruh Malaysia.',
              )}
            </p>
          </div>
          <a
            className="official-link"
            href="https://publicinfobanjir.water.gov.my/"
            target="_blank"
            rel="noreferrer"
          >
            Public InfoBanjir ↗
          </a>
        </div>
        {(view === 'map' || view === 'stations') && (
          <>
            <div className="toolbar">
              <label>
                {t('State / territory', 'Negeri / wilayah')}
                <select value={region} onChange={(e) => changeRegion(e.target.value)}>
                  <option>Malaysia</option>
                  {REGIONS.map((r) => (
                    <option key={r.name}>{r.name}</option>
                  ))}
                </select>
              </label>
              <label className="search">
                {t('Find a station', 'Cari stesen')}
                <input
                  type="search"
                  placeholder={t(
                    'Name, district, river or station ID',
                    'Nama, daerah, sungai atau ID stesen',
                  )}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label>
                {t('Show stations', 'Papar stesen')}
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">{t('All stations', 'Semua stesen')}</option>
                  <option value="rain">{t('Current rainfall', 'Hujan terkini')}</option>
                  <option value="water">{t('Current water level', 'Aras air terkini')}</option>
                  <option value="elevated">
                    {t('Alert / warning / danger', 'Waspada / amaran / bahaya')}
                  </option>
                </select>
              </label>
              <button
                disabled={stationData.loading}
                onClick={() => {
                  stationData.refresh();
                  forecasts.refresh();
                  warnings.refresh();
                  rainmap.refresh();
                }}
              >
                {stationData.loading ? t('Loading…', 'Memuatkan…') : t('Refresh', 'Muat semula')}
              </button>
            </div>
            {(stationData.error || stationData.result?.stale) && (
              <div className="notice error" role="alert">
                {stationData.error ?? stationData.result?.notice}{' '}
                <a href="https://publicinfobanjir.water.gov.my/" target="_blank" rel="noreferrer">
                  {t('Open JPS', 'Buka JPS')}
                </a>
              </div>
            )}
            <div className="summary-strip">
              <div>
                <span>{t('Stations in view filters', 'Stesen mengikut penapis')}</span>
                <strong>{stationData.result ? filtered.length : '—'}</strong>
              </div>
              <div>
                <span>{t('Current river readings', 'Bacaan sungai terkini')}</span>
                <strong>
                  {stationData.result ? freshWater.length : '—'} <small>/ {filtered.length}</small>
                </strong>
              </div>
              <div>
                <span>{t('Elevated river stations', 'Stesen sungai meningkat')}</span>
                <strong className={elevated.length ? 'amber' : ''}>
                  {freshWater.length ? elevated.length : '—'}
                </strong>
              </div>
              <div>
                <span>{t('Highest rain, last hour', 'Hujan tertinggi, sejam lalu')}</span>
                <strong>
                  {number(maxRain)} <small>mm</small>
                </strong>
              </div>
            </div>
            <div className="data-caption">
              {t(
                'JPS observations; current = valid, online and within 2 hours. Missing readings never count as normal.',
                'Pemerhatian JPS; terkini = sah, dalam talian dan dalam 2 jam. Bacaan tiada tidak dikira normal.',
              )}{' '}
              {stationData.result && (
                <span>
                  {t('Fetched', 'Diambil')} {localTime(stationData.result.fetchedAt, language)} MYT{' '}
                  {sourceUnavailable && t('(refresh unavailable)', '(kemas kini tidak tersedia)')}
                </span>
              )}
            </div>
          </>
        )}
        {view === 'map' && (
          <div className="map-layout">
            <section
              className="map-section"
              aria-label={t('Malaysian station map', 'Peta stesen Malaysia')}
            >
              <div className="map-toolbar">
                <label>
                  {t('Basemap', 'Peta asas')}
                  <select
                    value={basemap}
                    onChange={(e) => setBasemap(e.target.value as BasemapKey)}
                  >
                    <option value="osm">{t('Street', 'Jalan')}</option>
                    <option value="satellite">{t('Satellite', 'Satelit')}</option>
                    <option value="terrain">{t('Terrain', 'Bentuk muka bumi')}</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={rainEnabled}
                    disabled={!rainLayers.length}
                    onChange={(e) => setRainEnabled(e.target.checked)}
                  />
                  {t('JPS rainfall imagery', 'Imejan hujan JPS')}
                </label>
                {rainEnabled && (
                  <select
                    aria-label={t('Rainfall layer time', 'Masa lapisan hujan')}
                    value={String(rainLayer?.id ?? '')}
                    onChange={(e) => setRainId(e.target.value)}
                  >
                    {rainLayers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.timestamp}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="map-frame">
                <MalaysiaMap
                  key={importVersion}
                  stations={filtered}
                  selected={selected}
                  onSelect={selectStation}
                  focus={focus}
                  site={site}
                  basemap={basemap}
                  sites={sites}
                  rain={rainLayer}
                  language={language}
                  onSite={(point) => {
                    if (point.lat >= 0.5 && point.lat <= 8 && point.lng >= 99 && point.lng <= 120) {
                      setSite(point);
                      setFocus(point);
                      setSelectedId(null);
                    }
                  }}
                />
                {!stationData.loading && filtered.length === 0 && (
                  <div className="map-empty">
                    {stationData.error
                      ? t('Station source unavailable', 'Sumber stesen tidak tersedia')
                      : t(
                          'No stations match your filters.',
                          'Tiada stesen sepadan dengan penapis anda.',
                        )}
                  </div>
                )}
              </div>
              <div className="map-legend">
                {[
                  ['Normal', t('Normal', 'Normal')],
                  ['Alert', t('Alert', 'Waspada')],
                  ['Warning', t('Warning', 'Amaran')],
                  ['Danger', t('Danger', 'Bahaya')],
                  ['Unknown', t('No current level', 'Tiada aras terkini')],
                ].map(([key, label]) => (
                  <span key={key}>
                    <i className={`dot ${key.toLowerCase()}`} />
                    {label}
                  </span>
                ))}
              </div>
              {rainEnabled && (
                <p className="muted">
                  {t(
                    'JPS hourly isohyet imagery. Source filename time; timezone not declared. This is rainfall, not flood extent.',
                    'Imejan isohyet sejam JPS. Masa nama fail sumber; zon masa tidak dinyatakan. Ini hujan, bukan keluasan banjir.',
                  )}{' '}
                  <a href={`${RAIN_SERVICE}/legend?f=pjson`} target="_blank" rel="noreferrer">
                    {t('Source legend', 'Petunjuk sumber')}
                  </a>
                </p>
              )}
              {rainmap.error && (
                <p className="error">
                  {t(
                    'Rainfall imagery metadata unavailable.',
                    'Metadata imejan hujan tidak tersedia.',
                  )}{' '}
                  <button disabled={rainmap.loading} onClick={rainmap.refresh}>
                    {t('Retry imagery', 'Cuba imejan semula')}
                  </button>
                </p>
              )}
              <div className="site-import">
                <div>
                  <h3>{t('Your site & drainage assets', 'Tapak & aset saliran anda')}</h3>
                  <p>
                    {t(
                      'Import WGS84 GeoJSON boundaries, drains or asset points. Files stay in this browser session.',
                      'Import sempadan, saliran atau titik aset WGS84 GeoJSON. Fail kekal dalam sesi pelayar ini.',
                    )}
                  </p>
                </div>
                <label className="upload">
                  {t('Import GeoJSON', 'Import GeoJSON')}
                  <input
                    type="file"
                    accept=".json,.geojson,application/geo+json,application/json"
                    onChange={(e) => {
                      void importSites(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                {sites && (
                  <div className="import-status" role="status">
                    {siteFile} · {sites.features.length} {t('features', 'ciri')}{' '}
                    <button
                      onClick={() => {
                        setSites(null);
                        setSiteFile('');
                      }}
                    >
                      {t('Remove', 'Buang')}
                    </button>
                  </div>
                )}
                {importError && (
                  <p className="error" role="alert">
                    {importError}
                  </p>
                )}
              </div>
            </section>
            <aside className="context-panel">
              <section>
                <div className="section-heading">
                  <h2>{t('Station detail', 'Butiran stesen')}</h2>
                  <span className="tag">JPS</span>
                </div>
                {selected ? (
                  <>
                    <h3>{selected.name}</h3>
                    <p>
                      {selected.district}, {selected.state}
                    </p>
                    <p className="muted">
                      {selected.basin} · {selected.id}
                    </p>
                    <div className="reading">
                      <span>{t('River level', 'Aras sungai')}</span>
                      <strong>
                        {number(selected.waterLevel, 2)} <small>m</small>
                      </strong>
                      <span
                        className={`status ${activeWater(selected) ? selected.waterStatus.toLowerCase() : 'unknown'}`}
                      >
                        {activeWater(selected)
                          ? selected.waterStatus
                          : t('Not current', 'Tidak terkini')}
                      </span>
                      <small>{localTime(selected.waterAt, language)} MYT</small>
                    </div>
                    <div className="reading">
                      <span>{t('Rainfall, last hour', 'Hujan, sejam lalu')}</span>
                      <strong>
                        {number(selected.rainfall1h)} <small>mm</small>
                      </strong>
                      <span className="muted">
                        {activeRain(selected)
                          ? t('Current', 'Terkini')
                          : t('Not current', 'Tidak terkini')}
                      </span>
                      <small>{localTime(selected.rainAt, language)} MYT</small>
                    </div>
                    <p className="muted">
                      {t(
                        'Water level is the station gauge reading, not flood depth at your site.',
                        'Aras air ialah bacaan tolok stesen, bukan kedalaman banjir di tapak anda.',
                      )}
                    </p>
                  </>
                ) : (
                  <p className="empty">
                    {t(
                      'Select a station on the map or in the explorer to see readings and observation times.',
                      'Pilih stesen pada peta atau penjelajah untuk melihat bacaan dan masa pemerhatian.',
                    )}
                  </p>
                )}
                <div className="site-location">
                  <span>{t('Selected site', 'Tapak dipilih')}</span>
                  <strong>
                    {site.lat.toFixed(5)}, {site.lng.toFixed(5)}
                  </strong>
                  <small>
                    {t('Click the map to move the site.', 'Klik peta untuk mengubah tapak.')}
                  </small>
                  <button onClick={() => setView('design')}>
                    {t('Plan drainage here', 'Rancang saliran di sini')}
                  </button>
                </div>
              </section>
              <section>
                <div className="section-heading">
                  <h2>{t('Weather outlook', 'Ramalan cuaca')}</h2>
                  <span className="tag">MET Malaysia</span>
                </div>
                {forecasts.loading && !forecasts.result ? (
                  <p role="status">{t('Loading forecast…', 'Memuatkan ramalan…')}</p>
                ) : forecasts.error ? (
                  <p className="error">
                    {forecasts.error}{' '}
                    <button disabled={forecasts.loading} onClick={forecasts.refresh}>
                      {t('Retry forecast', 'Cuba ramalan semula')}
                    </button>
                  </p>
                ) : region === 'Malaysia' ? (
                  <p>
                    {t(
                      'Choose a state to see its forecast.',
                      'Pilih negeri untuk melihat ramalan.',
                    )}
                  </p>
                ) : outlook.length ? (
                  <>
                    <p>
                      {region} ·{' '}
                      {t(
                        'Official forecast text in Bahasa Melayu',
                        'Teks ramalan rasmi dalam Bahasa Melayu',
                      )}
                    </p>
                    <div className="forecast-list">
                      {outlook.slice(0, 7).map((day) => (
                        <details key={day.date}>
                          <summary>
                            <time>
                              {new Intl.DateTimeFormat(language === 'ms' ? 'ms-MY' : 'en-MY', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                timeZone: 'Asia/Kuala_Lumpur',
                              }).format(new Date(`${day.date}T12:00:00+08:00`))}
                            </time>
                            <span lang="ms">{day.summary_forecast}</span>
                            <b>
                              {day.min_temp}–{day.max_temp}°
                            </b>
                          </summary>
                          <p lang="ms">
                            Pagi: {day.morning_forecast}
                            <br />
                            Petang: {day.afternoon_forecast}
                            <br />
                            Malam: {day.night_forecast}
                          </p>
                        </details>
                      ))}
                    </div>
                  </>
                ) : (
                  <p>
                    {t(
                      'No upcoming forecast returned for this state.',
                      'Tiada ramalan akan datang untuk negeri ini.',
                    )}
                  </p>
                )}
                {forecasts.result && (
                  <small className="muted">
                    {t('Fetched', 'Diambil')} {localTime(forecasts.result.fetchedAt, language)} MYT
                    {forecasts.result.stale &&
                      t(' · Cached; refresh failed', ' · Cache; kemas kini gagal')}
                  </small>
                )}
              </section>
              <section>
                <div className="section-heading">
                  <h2>{t('National weather warnings', 'Amaran cuaca kebangsaan')}</h2>
                  <span className="tag">MET Malaysia</span>
                </div>
                <p className="muted">
                  {t(
                    'Check each notice for the affected locations.',
                    'Semak setiap notis untuk lokasi terjejas.',
                  )}
                </p>
                {warnings.loading && !warnings.result ? (
                  <p role="status">{t('Loading warnings…', 'Memuatkan amaran…')}</p>
                ) : warnings.error ? (
                  <p className="error">
                    {warnings.error}{' '}
                    <button disabled={warnings.loading} onClick={warnings.refresh}>
                      {t('Retry warnings', 'Cuba amaran semula')}
                    </button>
                  </p>
                ) : activeWarnings.length ? (
                  activeWarnings.map((w, index) => (
                    <details className="warning" key={`${w.valid_from}-${index}`}>
                      <summary>{language === 'ms' ? w.heading_bm : w.heading_en}</summary>
                      <p>{language === 'ms' ? w.text_bm : w.text_en}</p>
                      <p>{language === 'ms' ? w.instruction_bm : w.instruction_en}</p>
                      <small>
                        {localTime(safeDate(w.valid_from), language)} –{' '}
                        {localTime(safeDate(w.valid_to), language)} MYT
                      </small>
                    </details>
                  ))
                ) : (
                  <p>
                    {t(
                      'No currently valid notices returned by the API.',
                      'Tiada notis sah semasa dikembalikan oleh API.',
                    )}
                  </p>
                )}
                {warnings.result && (
                  <small className="muted">
                    {t('Fetched', 'Diambil')} {localTime(warnings.result.fetchedAt, language)} MYT
                    {warnings.result.stale &&
                      t(' · Cached; refresh failed', ' · Cache; kemas kini gagal')}
                  </small>
                )}
                <a
                  className="text-link"
                  href="https://www.met.gov.my/"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('Check official MET Malaysia warnings', 'Semak amaran rasmi MET Malaysia')} ↗
                </a>
              </section>
            </aside>
          </div>
        )}
        {view === 'stations' && (
          <section className="station-explorer">
            <div className="section-heading">
              <h2>{t('Rain & river observations', 'Pemerhatian hujan & sungai')}</h2>
              <button
                disabled={!filtered.length}
                onClick={() =>
                  download('malaysia-station-observations.json', {
                    fetchedAt: stationData.result?.fetchedAt,
                    source: stationData.result?.source,
                    observations: filtered,
                  })
                }
              >
                {t('Export observations', 'Eksport pemerhatian')}
              </button>
            </div>
            {freshRain.length > 0 && (
              <>
                <h3>
                  {t(
                    'Wettest current stations · last hour (mm)',
                    'Stesen terkini paling basah · sejam lalu (mm)',
                  )}
                </h3>
                <Suspense fallback={<p>…</p>}>
                  <RainChart stations={freshRain} language={language} />
                </Suspense>
              </>
            )}
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('Station', 'Stesen')}</th>
                    <th>{t('District / state', 'Daerah / negeri')}</th>
                    <th>{t('Rain 1 h', 'Hujan 1 j')}</th>
                    <th>{t('River level', 'Aras sungai')}</th>
                    <th>{t('River status', 'Status sungai')}</th>
                    <th>{t('Observed at (MYT)', 'Masa pemerhatian (MYT)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(page * 25, (page + 1) * 25).map((s) => (
                    <tr key={s.id}>
                      <td>
                        <button
                          className="station-link"
                          onClick={() => {
                            selectStation(s);
                            setView('map');
                          }}
                        >
                          {s.name}
                        </button>
                        <small>{s.id}</small>
                      </td>
                      <td>
                        {s.district}
                        <small>{s.state}</small>
                      </td>
                      <td>
                        {number(s.rainfall1h)} mm
                        <small>
                          {activeRain(s)
                            ? t('Current', 'Terkini')
                            : t('Not current', 'Tidak terkini')}
                        </small>
                      </td>
                      <td>{number(s.waterLevel, 2)} m</td>
                      <td>
                        <span
                          className={`status ${activeWater(s) ? s.waterStatus.toLowerCase() : 'unknown'}`}
                        >
                          {activeWater(s) ? s.waterStatus : t('Not current', 'Tidak terkini')}
                        </span>
                      </td>
                      <td>
                        <small>
                          {t('Rain', 'Hujan')}: {localTime(s.rainAt, language)}
                        </small>
                        <small>
                          {t('River', 'Sungai')}: {localTime(s.waterAt, language)}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <p className="empty">
                {stationData.loading
                  ? t('Loading stations…', 'Memuatkan stesen…')
                  : t('No matching station observations.', 'Tiada pemerhatian stesen sepadan.')}
              </p>
            )}
            <div className="pagination">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                {t('Previous', 'Sebelum')}
              </button>
              <span>
                {filtered.length
                  ? `${page * 25 + 1}–${Math.min((page + 1) * 25, filtered.length)} / ${filtered.length}`
                  : '0 / 0'}
              </span>
              <button
                disabled={(page + 1) * 25 >= filtered.length}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('Next', 'Seterusnya')}
              </button>
            </div>
          </section>
        )}
        {view === 'design' && (
          <Suspense
            fallback={
              <p role="status">{t('Loading planning tools…', 'Memuatkan alat perancangan…')}</p>
            }
          >
            <DesignPanel language={language} site={site} />
          </Suspense>
        )}
        {view === 'sources' && (
          <section className="sources">
            <h2>{t('Connected Malaysian sources', 'Sumber Malaysia disambungkan')}</h2>
            <p>
              {t(
                'Every reading keeps its observation time. The fetch time only tells you when LivingShield contacted the source.',
                'Setiap bacaan mengekalkan masa pemerhatian. Masa pengambilan hanya menunjukkan bila LivingShield menghubungi sumber.',
              )}
            </p>
            <table>
              <thead>
                <tr>
                  <th>{t('Source', 'Sumber')}</th>
                  <th>{t('Available here', 'Tersedia di sini')}</th>
                  <th>{t('Limits', 'Had')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <a
                      href="https://publicinfobanjir.water.gov.my/full/?lang=en"
                      target="_blank"
                      rel="noreferrer"
                    >
                      JPS Public InfoBanjir
                    </a>
                  </td>
                  <td>
                    {t(
                      'Station locations, river levels, status and rainfall. Cached 5 min.',
                      'Lokasi stesen, aras sungai, status dan hujan. Cache 5 min.',
                    )}
                  </td>
                  <td>
                    {t(
                      'Public website feed, not a documented stable API. -9999 becomes unavailable; old/offline readings excluded from current totals.',
                      'Suapan laman awam, bukan API stabil berdokumen. -9999 dianggap tiada; bacaan lama/luar talian dikecualikan daripada jumlah terkini.',
                    )}
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://developer.data.gov.my/realtime-api/weather"
                      target="_blank"
                      rel="noreferrer"
                    >
                      data.gov.my / MET Malaysia
                    </a>
                  </td>
                  <td>
                    {t(
                      'State forecasts and national warning notices.',
                      'Ramalan negeri dan notis amaran kebangsaan.',
                    )}
                  </td>
                  <td>
                    {t(
                      'Daily forecast text is not measured rainfall or design rainfall. Requests shared and throttled to respect 4/min limit.',
                      'Teks ramalan harian bukan hujan terukur atau hujan reka bentuk. Permintaan dikongsi dan dihadkan kepada 4/min.',
                    )}
                  </td>
                </tr>
                <tr>
                  <td>
                    <a href={RAIN_SERVICE} target="_blank" rel="noreferrer">
                      JPS isohyet map
                    </a>
                  </td>
                  <td>
                    {t(
                      'Selectable hourly rainfall raster layers.',
                      'Lapisan raster hujan sejam yang boleh dipilih.',
                    )}
                  </td>
                  <td>
                    {t(
                      'Not flood polygons. Filename timezone unspecified. Publication and coverage depend on JPS.',
                      'Bukan poligon banjir. Zon masa nama fail tidak dinyatakan. Penerbitan dan liputan bergantung pada JPS.',
                    )}
                  </td>
                </tr>
                <tr>
                  <td>
                    <a
                      href="https://wplb.water.gov.my/assets/msma-2nd-edition.pdf#page=56"
                      target="_blank"
                      rel="noreferrer"
                    >
                      MSMA 2nd edition (2012)
                    </a>
                  </td>
                  <td>
                    {t(
                      '17 transcribed IDF stations; Table 2.B1, Eq. 2.2.',
                      '17 stesen IDF ditranskripsi; Jadual 2.B1, Pers. 2.2.',
                    )}
                  </td>
                  <td>
                    {t(
                      'Published reference, not a claim of current approval. Peninsular subset only; station selected by user.',
                      'Rujukan diterbitkan, bukan pengesahan kelulusan semasa. Subset Semenanjung sahaja; pengguna memilih stesen.',
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            <h3>
              {t(
                'Data still needed for your project',
                'Data yang masih diperlukan untuk projek anda',
              )}
            </h3>
            <p>
              {t(
                'Authorised site boundaries, drain inventories, terrain surveys, local IDF updates and cost schedules. Imports are user supplied, not official parcel assessments. Flood depth, return-period hazard zones and national river discharge history are not inferred from station readings.',
                'Sempadan tapak dibenarkan, inventori saliran, ukur muka bumi, kemas kini IDF tempatan dan jadual kos. Import dibekalkan pengguna, bukan penilaian lot rasmi. Kedalaman banjir, zon bahaya mengikut ARI dan sejarah aliran sungai kebangsaan tidak dianggarkan daripada bacaan stesen.',
              )}
            </p>
            <a href="https://data.water.gov.my/home" target="_blank" rel="noreferrer">
              {t('Request JPS geospatial data', 'Mohon data geospatial JPS')} ↗
            </a>
            <p className="notice">
              {t(
                'Public availability does not establish unrestricted redistribution rights. Confirm JPS/data-provider terms before public or commercial deployment.',
                'Ketersediaan awam tidak menetapkan hak pengedaran semula tanpa had. Sahkan syarat JPS/pembekal data sebelum penggunaan awam atau komersial.',
              )}
            </p>
          </section>
        )}
      </main>
      <footer>
        <span>LivingShield Malaysia</span>
        <span>
          {t(
            'Adapted hydrology software by Team Redacted · MIT',
            'Perisian hidrologi diadaptasi daripada Team Redacted · MIT',
          )}{' '}
          ·{' '}
          <a href="https://github.com/Sadat41/HydroGrid" target="_blank" rel="noreferrer">
            {t('Original project', 'Projek asal')}
          </a>
        </span>
        <span>
          {t(
            'Screening & planning; check official warnings.',
            'Saringan & perancangan; semak amaran rasmi.',
          )}
        </span>
      </footer>
    </div>
  );
}
