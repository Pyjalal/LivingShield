import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { DESIGN_STATIONS, DURATIONS, ARIS, intensity, calculateDesign, MSMA_URL } from './design';
import { download } from './sites';
import type { Language } from './domain';

export default function DesignPanel({
  language,
  site,
}: {
  language: Language;
  site: { lat: number; lng: number };
}) {
  const t = (en: string, ms: string) => (language === 'ms' ? ms : en);
  const [id, setId] = useState('');
  const [values, setValues] = useState({
    area: 10000,
    before: 0.3,
    after: 0.8,
    tc: 15,
    ari: 10,
    slope: 0.005,
    roughness: 0.013,
    release: 50,
    pipeLength: 0,
    pipeRate: 0,
    storageRate: 0,
  });
  const station = DESIGN_STATIONS.find((s) => s.id === id);
  let error: string | null = null;
  let result: ReturnType<typeof calculateDesign> | null = null;
  try {
    if (station) result = calculateDesign({ ...values, station });
  } catch (e) {
    error = e instanceof Error ? e.message : 'Invalid inputs';
  }
  const chart =
    station && !error
      ? DURATIONS.filter(d=>d>=(station.minDurationMinutes??5)).map((duration) => ({
          duration,
          ...Object.fromEntries(
            ARIS.map((ari) => [String(ari), intensity(station, duration, ari)]),
          ),
        }))
      : [];
  const fields: {
    key: keyof typeof values;
    label: string;
    min: number;
    max: number;
    step: number;
  }[] = [
    {
      key: 'area',
      label: t('Catchment area (m²)', 'Luas tadahan (m²)'),
      min: 1,
      max: 800000,
      step: 1,
    },
    {
      key: 'tc',
      label: t('Time of concentration (min)', 'Masa tumpuan (min)'),
      min: 5,
      max: 4320,
      step: 1,
    },
    {
      key: 'before',
      label: t('Pre-development runoff C', 'Pekali C sebelum pembangunan'),
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'after',
      label: t('Post-development runoff C', 'Pekali C selepas pembangunan'),
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      key: 'release',
      label: t('Permitted release (L/s)', 'Pelepasan dibenarkan (L/s)'),
      min: 0,
      max: 1000000,
      step: 1,
    },
    {
      key: 'slope',
      label: t('Pipe slope (m/m)', 'Kecerunan paip (m/m)'),
      min: 0.0001,
      max: 0.2,
      step: 0.0001,
    },
    {
      key: 'roughness',
      label: t('Manning roughness n', 'Pekali kekasaran Manning n'),
      min: 0.009,
      max: 0.05,
      step: 0.001,
    },
    {
      key: 'pipeLength',
      label: t('Pipe length (m)', 'Panjang paip (m)'),
      min: 0,
      max: 100000,
      step: 1,
    },
    {
      key: 'pipeRate',
      label: t('Pipe rate (RM/m)', 'Kadar paip (RM/m)'),
      min: 0,
      max: 1000000,
      step: 1,
    },
    {
      key: 'storageRate',
      label: t('Storage rate (RM/m³)', 'Kadar takungan (RM/m³)'),
      min: 0,
      max: 1000000,
      step: 1,
    },
  ];
  const money = new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' });
  return (
    <section className="design-panel">
      <div className="section-heading">
        <div>
          <h2>{t('Drainage planning', 'Perancangan saliran')}</h2>
          <p>
            {t(
              'Malaysian rainfall. Explicit site assumptions.',
              'Hujan Malaysia. Andaian tapak yang jelas.',
            )}
          </p>
        </div>
        <span className="tag">MSMA 2012</span>
      </div>
      <div className="notice">
        {t(
          'Preliminary screening only. Confirm current JPS/local-authority requirements and station suitability before engineering use.',
          'Saringan awal sahaja. Sahkan keperluan JPS/PBT semasa dan kesesuaian stesen sebelum kegunaan kejuruteraan.',
        )}
      </div>
      <label>
        {t('Select a design rainfall station', 'Pilih stesen hujan reka bentuk')}
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">
            {t('Choose explicitly; no automatic fallback', 'Pilih stesen; tiada gantian automatik')}
          </option>
          {[...new Set(DESIGN_STATIONS.map((s) => s.state))].map((state) => (
            <optgroup key={state} label={state}>
              {DESIGN_STATIONS.filter((s) => s.state === state).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <p className="muted">
        {t(
          '17 published Peninsular stations. Sabah and Sarawak design inputs are not included. Map selection does not choose a design station.',
          '17 stesen Semenanjung yang diterbitkan. Input reka bentuk Sabah dan Sarawak belum disertakan. Pilihan peta tidak memilih stesen reka bentuk.',
        )}
      </p>
      <div className="form-grid">
        <label>
          ARI ({t('years', 'tahun')})
          <select
            value={values.ari}
            onChange={(e) => setValues((v) => ({ ...v, ari: Number(e.target.value) }))}
          >
            {ARIS.map((ari) => (
              <option key={ari}>{ari}</option>
            ))}
          </select>
        </label>
        {fields.map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={Number.isNaN(values[field.key]) ? '' : values[field.key]}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  [field.key]: e.target.value === '' ? NaN : Number(e.target.value),
                }))
              }
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!station && (
        <div className="empty">
          {t(
            'Choose a published Malaysian station to enable calculations. No Canadian rainfall is used.',
            'Pilih stesen Malaysia untuk mengaktifkan pengiraan. Tiada data hujan Kanada digunakan.',
          )}
        </div>
      )}
      {station && result && (
        <>
          <div className="results-grid">
            <div>
              <span>{t('Rainfall intensity', 'Keamatan hujan')}</span>
              <strong>
                {result.rain.toFixed(1)} <small>mm/h</small>
              </strong>
            </div>
            <div>
              <span>{t('Peak flow: before → after', 'Aliran puncak: sebelum → selepas')}</span>
              <strong>
                {(result.pre * 1000).toFixed(1)} → {(result.post * 1000).toFixed(1)}{' '}
                <small>L/s</small>
              </strong>
            </div>
            <div>
              <span>{t('Storage screening volume', 'Isipadu saringan takungan')}</span>
              <strong>
                {result.critical.volume.toFixed(1)} <small>m³</small>
              </strong>
            </div>
            <div>
              <span>{t('Full-flow pipe diameter', 'Diameter paip aliran penuh')}</span>
              <strong>
                {result.nominal === null
                  ? t('Beyond catalogue', 'Melebihi katalog')
                  : `${result.nominal} mm`}
              </strong>
            </div>
          </div>
          <h3>{t('Intensity–duration–frequency', 'Keamatan–tempoh–frekuensi')}</h3>
          <div className="chart" aria-label="IDF curves for six return periods">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              initialDimension={{ width: 800, height: 280 }}
            >
              <LineChart data={chart} margin={{ top: 10, right: 20, bottom: 25, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="duration"
                  type="number"
                  scale="log"
                  domain={[5, 4320]}
                  ticks={[5, 15, 60, 360, 1440, 4320]}
                  label={{
                    value: t('Duration (min)', 'Tempoh (min)'),
                    position: 'bottom',
                    offset: 8,
                  }}
                />
                <YAxis label={{ value: 'mm/h', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                {ARIS.map((ari, index) => (
                  <Line
                    key={ari}
                    name={`${ari} ${t('years', 'tahun')}`}
                    dataKey={String(ari)}
                    stroke={
                      ['#157d8d', '#659c60', '#b48226', '#8262a8', '#d0763c', '#c63e50'][index]
                    }
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="curve-key">
            {ARIS.map((ari, index) => (
              <span
                key={ari}
                style={{
                  color: ['#157d8d', '#659c60', '#b48226', '#8262a8', '#d0763c', '#c63e50'][index],
                }}
              >
                {ari} {t('years', 'tahun')}
              </span>
            ))}
          </div>
          <details>
            <summary>{t('Method, assumptions and source', 'Kaedah, andaian dan sumber')}</summary>
            <p>
              i = λT^κ / (d + θ)^η; d = {t('duration in hours', 'tempoh dalam jam')}. λ{' '}
              {station.lambda}, κ {station.kappa}, θ {station.theta}, η {station.eta}.
            </p>
            <p>
              {t(
                'Rational Method Q = CiA/360 (A in hectares). Full-pipe Manning calculation excludes inlet, tailwater, blockage and network effects. Storage is a constant-inflow screen across 5 min–72 h, not a routed detention design or flood-depth simulation. User supplies C, concentration time and permitted release.',
                'Kaedah Rasional Q = CiA/360 (A dalam hektar). Pengiraan Manning paip penuh tidak merangkumi kesan salur masuk, air hilir, sumbatan dan rangkaian. Takungan ialah saringan aliran masuk tetap untuk 5 min–72 jam, bukan reka bentuk takungan terhala atau simulasi kedalaman banjir. Pengguna menetapkan C, masa tumpuan dan pelepasan dibenarkan.',
              )}
            </p>
            <a href={`${MSMA_URL}#page=${station.page}`} target="_blank" rel="noreferrer">
              MSMA 2nd edition, Table 2.B1, PDF p. {station.page}
            </a>
          </details>
          <div className="cost-row">
            <div>
              <h3>{t('Budget scenario', 'Senario bajet')}</h3>
              <p>
                {t(
                  'Your unit rates; excludes fees, earthworks, tax and contingency. Zero rates mean no estimate.',
                  'Kadar unit anda; tidak termasuk fi, kerja tanah, cukai dan kontingensi. Kadar sifar bermakna tiada anggaran.',
                )}
              </p>
            </div>
            <strong>
              {values.pipeRate > 0 && values.storageRate > 0
                ? money.format(result.cost)
                : t('Enter unit rates', 'Masukkan kadar unit')}
            </strong>
          </div>
          <button
            className="primary"
            onClick={() =>
              download('LivingShield-malaysia-site-report.json', {
                title: 'LivingShield Malaysia preliminary site screen',
                generatedAt: new Date().toISOString(),
                site,
                inputs: { ...values, station },
                result,
                source: `${MSMA_URL}#page=${station.page}`,
                limitations:
                  'Preliminary screening, not engineering approval or flood prediction. User-entered rates, no official cost schedule.',
              })
            }
          >
            {t('Download site report', 'Muat turun laporan tapak')}
          </button>
        </>
      )}
    </section>
  );
}
