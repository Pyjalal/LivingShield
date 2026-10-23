import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useData } from '../malaysia/useData';
import { useSettings, getRegion } from '../malaysia/settings';
import { isFresh, localTime, type Station } from '../malaysia/domain';
import { downloadCSV } from '../utils/export';
import RegionFocus from './RegionFocus';
import BasemapSwitcher from './BasemapSwitcher';
import { BASEMAPS } from '../config/basemaps';
import { useBasemap } from '../config/appearance';
interface Series {
  latitude: number;
  longitude: number;
  daily: {
    time: string[];
    precipitation_sum?: (number | null)[];
    temperature_2m_mean?: (number | null)[];
    et0_fao_evapotranspiration?: (number | null)[];
    river_discharge?: (number | null)[];
  };
}
function Fly({ station }: { station: Station }) {
  const map = useMap();
  useEffect(() => {
    map.setView([station.lat, station.lng], 12);
  }, [map, station.id, station.lat, station.lng]);
  return null;
}
export default function MalaysiaStationExplorer({ kind }: { kind: 'rain' | 'river' }) {
  const { basemap, automatic, choose } = useBasemap();
  const bm = BASEMAPS[basemap];
  const settings = useSettings(),
    region = getRegion();
  const live = useData<Station[]>('/api/stations');
  const [id, setId] = useState(''),
    [search, setSearch] = useState('');
  const [from, setFrom] = useState('2021-12-01'),
    [to, setTo] = useState('2021-12-31');
  const [range, setRange] = useState({ from, to }),
    [aggregation, setAggregation] = useState('daily');
  const [style, setStyle] = useState('bar'),
    [metric, setMetric] = useState('rain');
  const [dateError, setDateError] = useState('');
  const gauges = useMemo(
    () =>
      (live.result?.data ?? []).filter((s) => {
        const match =
          settings.region === 'Malaysia' ||
          (settings.region === 'Klang / Selangor'
            ? s.state === 'SELANGOR'
            : s.state.includes(settings.region.toUpperCase()));
        return (
          match &&
          `${s.name} ${s.district} ${s.id}`.toLowerCase().includes(search.toLowerCase()) &&
          (kind === 'rain' ? s.rainAt : s.waterAt)
        );
      }),
    [live.result, settings.region, search, kind],
  );
  const selected = gauges.find((s) => s.id === id) ?? gauges[0];
  const endpoint = selected
    ? `/api/${kind === 'rain' ? 'climate' : 'discharge'}?lat=${selected.lat}&lng=${selected.lng}&from=${range.from}&to=${range.to}`
    : '';
  const history = useData<Series>(endpoint, 86400000);
  const rows = useMemo(() => {
    const daily = history.result?.data.daily;
    if (!daily) return [];
    const values =
      kind === 'river'
        ? daily.river_discharge
        : metric === 'temperature'
          ? daily.temperature_2m_mean
          : metric === 'et'
            ? daily.et0_fao_evapotranspiration
            : daily.precipitation_sum;
    const points = daily.time.map((date, i) => ({ date, value: values?.[i] ?? null }));
    if (aggregation === 'daily') return points;
    const groups = new Map<string, number[]>();
    for (const p of points) {
      if (p.value === null) continue;
      const key = p.date.slice(0, aggregation === 'annual' ? 4 : 7);
      groups.set(key, [...(groups.get(key) ?? []), p.value]);
    }
    return [...groups].map(([date, values]) => ({
      date,
      value:
        aggregation === 'annual'
          ? Math.max(...values)
          : kind === 'river' || metric === 'temperature'
            ? values.reduce((a, b) => a + b, 0) / values.length
            : values.reduce((a, b) => a + b, 0),
    }));
  }, [history.result, aggregation, metric, kind]);
  const unit = kind === 'river' ? 'm³/s' : metric === 'temperature' ? '°C' : 'mm';
  const valid = rows.flatMap((r) => (r.value === null ? [] : [r.value]));
  function loadRange() {
    const span = (Date.parse(to) - Date.parse(from)) / 86400000;
    if (!Number.isFinite(span) || span < 0 || span > 366) {
      setDateError('Select a date range of 0–366 days.');
      return;
    }
    setDateError('');
    setRange({ from, to });
    history.refresh();
  }
  const current =
    selected &&
    (kind === 'rain'
      ? selected.rainOnline && isFresh(selected.rainAt)
      : selected.waterOnline && isFresh(selected.waterAt));
  const chartProps = { data: rows, margin: { left: 12, right: 25, top: 15, bottom: 10 } };
  return (
    <div className="precip-view">
      <aside className="precip-sidebar">
        <div className="precip-sidebar-header">
          <h2>{kind === 'rain' ? 'Precipitation Explorer' : 'River Flow'}</h2>
          <p className="precip-subtitle">Malaysia · JPS observations &amp; historical context</p>
        </div>
        <div className="precip-section">
          <label className="precip-label">
            Find a JPS station
            <input
              className="prop-input"
              aria-label="Find a JPS station"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Station, district or ID"
            />
          </label>
          <p className="precip-hint">
            {gauges.length} stations in {settings.region}. Map region selector is shared across
            tabs.
          </p>
        </div>
        <div className="precip-section">
          <label className="precip-label">Historical date range</label>
          <label className="my-label">
            From
            <input
              aria-label="History from"
              className="prop-input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="my-label">
            To
            <input
              aria-label="History to"
              className="prop-input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button className="precip-btn" onClick={loadRange}>
            Load history
          </button>
          {dateError && <p role="alert">{dateError}</p>}
          <p className="precip-hint">
            Default: December 2021 flood period. Choose up to 366 days per query.
          </p>
          <label className="my-label">
            Aggregation
            <select
              className="dc-select"
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly {kind === 'river' ? 'mean' : 'summary'}</option>
              <option value="annual">Annual maximum (selected range)</option>
            </select>
          </label>
          {kind === 'rain' && (
            <label className="my-label">
              Variable
              <select
                className="dc-select"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                <option value="rain">Precipitation</option>
                <option value="temperature">Mean temperature</option>
                <option value="et">Reference evapotranspiration</option>
              </select>
            </label>
          )}
          <label className="my-label">
            Chart
            <select className="dc-select" value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
            </select>
          </label>
        </div>
        <div className="precip-section">
          <label className="precip-label">Stations</label>
          {live.error && (
            <p role="alert">
              {live.error}
              <button className="precip-btn" onClick={live.refresh}>
                Retry
              </button>
            </p>
          )}
          <div className="my-station-list">
            {gauges.map((s) => (
              <button
                className={`prop-result-card ${selected?.id === s.id ? 'selected' : ''}`}
                key={s.id}
                onClick={() => setId(s.id)}
              >
                <strong>{s.name}</strong>
                <small>
                  {s.district} · {s.id}
                </small>
              </button>
            ))}
          </div>
        </div>
        <div className="precip-section">
          <p className="precip-hint">
            JPS = observed gauge values. Historical{' '}
            {kind === 'river'
              ? 'GloFAS river discharge is modelled, using UTC days and a nearby grid cell.'
              : 'weather is gridded reanalysis, using Malaysia local days.'}{' '}
            No Canada or snowfall defaults.
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
            <TileLayer
              key={basemap}
              url={bm.url}
              attribution={bm.attr}
              {...('maxZoom' in bm ? { maxZoom: bm.maxZoom } : {})}
            />
            {selected && <Fly station={selected} />}
            {gauges.map((s) => (
              <CircleMarker
                key={s.id}
                center={[s.lat, s.lng]}
                radius={selected?.id === s.id ? 8 : 4}
                pathOptions={{
                  color: kind === 'rain' ? '#38bdf8' : '#2dd4bf',
                  weight: 1,
                  fillOpacity: 0.8,
                }}
                eventHandlers={{ click: () => setId(s.id) }}
              >
                <Popup>
                  {s.name}
                  <br />
                  {s.id}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <BasemapSwitcher
            active={basemap}
            onChange={choose}
            automatic={automatic}
            onAutomatic={() => choose('auto')}
          />
        </div>
        <div className="my-explorer-charts">
          {selected && (
            <>
              <div className="my-section-heading">
                <div>
                  <h3>{selected.name}</h3>
                  <p>
                    {selected.state} · {selected.basin} · JPS {selected.id}
                  </p>
                </div>
                <button
                  className="export-btn"
                  disabled={!rows.length}
                  onClick={() =>
                    downloadCSV(
                      rows.map((r) => ({
                        ...r,
                        unit,
                        station_id: selected.id,
                        source: history.result?.source,
                      })),
                      'malaysia_historical_context.csv',
                    )
                  }
                >
                  Export CSV
                </button>
              </div>
              <div className="dc-stat-grid">
                <div className="dc-stat highlight">
                  <span className="dc-stat-value">
                    {(kind === 'rain' ? selected.rainfall1h : selected.waterLevel)?.toFixed(
                      kind === 'rain' ? 1 : 2,
                    ) ?? '—'}{' '}
                    {kind === 'rain' ? 'mm' : 'm'}
                  </span>
                  <span className="dc-stat-label">
                    Observed {kind === 'rain' ? 'last-hour rainfall' : 'river gauge height'}
                  </span>
                </div>
                <div className="dc-stat">
                  <span className="dc-stat-value">{current ? 'Current' : 'Not current'}</span>
                  <span className="dc-stat-label">
                    {localTime(kind === 'rain' ? selected.rainAt : selected.waterAt)} MYT
                  </span>
                </div>
                <div className="dc-stat">
                  <span className="dc-stat-value">
                    {valid.length ? Math.max(...valid).toFixed(1) : '—'} {unit}
                  </span>
                  <span className="dc-stat-label">Historical model/reanalysis maximum</span>
                </div>
              </div>
            </>
          )}
          <div className="sim-chart-card">
            <h4>
              {kind === 'rain'
                ? 'Historical weather reanalysis'
                : 'GloFAS modelled river discharge'}
            </h4>
            <p className="dc-note">
              {history.result?.notice ?? 'Select a station to load historical context.'}
            </p>
            {history.loading && <p role="status">Loading historical series…</p>}
            {history.error && (
              <p role="alert" className="my-error">
                {history.error}{' '}
                <button className="precip-btn" onClick={history.refresh}>
                  Retry
                </button>
              </p>
            )}
            {history.result && (
              <p className="dc-note">
                Returned grid: {history.result.data.latitude.toFixed(4)},{' '}
                {history.result.data.longitude.toFixed(4)} · {rows.length} plotted records ·{' '}
                <a
                  href={
                    kind === 'rain'
                      ? 'https://open-meteo.com/en/docs/historical-weather-api'
                      : 'https://open-meteo.com/en/docs/flood-api'
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Source &amp; model documentation
                </a>
              </p>
            )}
            {!history.error && rows.length > 0 && (
              <div className="my-chart">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  initialDimension={{ width: 800, height: 280 }}
                >
                  {style === 'bar' ? (
                    <BarChart {...chartProps}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit={` ${unit}`} />
                      <Tooltip />
                      <Bar dataKey="value" name={unit} fill="#38bdf8" />
                    </BarChart>
                  ) : style === 'line' ? (
                    <LineChart {...chartProps}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit={` ${unit}`} />
                      <Tooltip />
                      <Line
                        dataKey="value"
                        name={unit}
                        stroke="#2dd4bf"
                        dot={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  ) : (
                    <AreaChart {...chartProps}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis unit={` ${unit}`} />
                      <Tooltip />
                      <Area
                        dataKey="value"
                        name={unit}
                        stroke="#38bdf8"
                        fill="#38bdf8"
                        fillOpacity={0.15}
                        connectNulls={false}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
            {!history.loading && !history.error && !rows.length && (
              <p>No historical records returned for this selection.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
