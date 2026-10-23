import { useState, useMemo } from 'react';
import { downloadCSV, downloadPNG } from '../utils/export';
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
  Legend,
  ReferenceLine,
} from 'recharts';
import { usePropertySearch } from '../hooks/usePropertySearch';
import { SidebarInputPanel, SiteMapPanel } from './SiteInputPanel';
import { IDF_RETURN_PERIODS, GA_SOILS, type GASoilKey } from '../utils/hydrology';
import { useStationIDF } from '../hooks/useStationIDF';

type SoilKey = GASoilKey;

import { runSimulation, defaultPatternRegion } from '../malaysia/simulation';
import { HP26_URL } from '../malaysia/design';
import hp26 from '../data/hp26.json';
export default function StormSimulationView() {
  const ps = usePropertySearch();
  const idfData = useStationIDF(ps.analysisData?.lat ?? 0, ps.analysisData?.lng ?? 0);
  const getI = idfData.getIntensity;

  const [soilKey, setSoilKey] = useState<SoilKey>('clay');
  const [returnPeriod, setReturnPeriod] = useState(100);
  const [stormDuration, setStormDuration] = useState(6);
  const [patternSelection, setPatternSelection] = useState({ stationId: '', value: 'auto' });
  const patternOverride =
    patternSelection.stationId === idfData.station?.id ? patternSelection.value : 'auto';
  const patternFamily =
    idfData.station?.family === 'hp26' || (ps.analysisData?.lng ?? 0) >= 108 ? 'hp26' : 'msma';
  const patternLabel = patternFamily === 'hp26' ? 'HP26 2018' : 'MSMA 2012';
  const patternRegion =
    patternOverride === 'auto'
      ? patternFamily === 'hp26'
        ? null
        : defaultPatternRegion(idfData.station?.state ?? '')
      : patternOverride.startsWith(patternFamily + '-')
        ? Number(patternOverride.split('-')[1])
        : null;

  const lot = ps.analysisData?.buildingKnown ? ps.analysisData.lotSize : 0;
  const bldg = ps.analysisData?.buildingArea ?? 0;
  const paveFrac = ps.analysisData?.zoningPaveFrac ?? 0.15;
  const imperviousFrac = lot > 0 ? Math.min((bldg + lot * paveFrac) / lot, 1) : 0;
  const avgIntensity = getI(stormDuration * 60, returnPeriod);
  const totalDepth = avgIntensity * stormDuration;
  const soil = GA_SOILS[soilKey];

  // Post-development simulation
  const postSteps = useMemo(() => {
    if (totalDepth <= 0 || lot <= 0 || !patternRegion) return [];
    return runSimulation(
      totalDepth,
      stormDuration,
      soilKey,
      imperviousFrac,
      patternRegion,
      patternFamily,
    );
  }, [totalDepth, stormDuration, soilKey, imperviousFrac, lot, patternRegion, patternFamily]);

  // Pre-development simulation (no impervious surfaces)
  const preSteps = useMemo(() => {
    if (totalDepth <= 0 || lot <= 0 || !patternRegion) return [];
    return runSimulation(totalDepth, stormDuration, soilKey, 0, patternRegion, patternFamily);
  }, [totalDepth, stormDuration, soilKey, lot, patternRegion, patternFamily]);

  // Combined chart data
  const combinedData = useMemo(() => {
    return postSteps.map((s, i) => {
      const pre = preSteps[i];
      const dt_hr = (s.time - (postSteps[i - 1]?.time ?? 0)) / 60;
      return {
        timeLabel: s.timeLabel,
        intensity: s.intensity,
        // per-interval runoff (mm)
        postRunoff: s.runoff,
        preRunoff: pre?.runoff ?? 0,
        // cumulative (mm)
        cumRain: s.cumRain,
        cumPostRunoff: s.cumRunoff,
        cumPreRunoff: pre?.cumRunoff ?? 0,
        cumPostInf: s.cumInf,
        cumPreInf: pre?.cumInf ?? 0,
        // infiltration capacity
        postInfRate: s.infRate,
        preInfRate: pre?.infRate ?? 0,
        // instantaneous flow rate (L/s) = runoff_mm / dt_hr * lot_m2 / 3600000
        postFlow: +(((s.runoff / dt_hr) * lot) / 3600).toFixed(3),
        preFlow: +((((pre?.runoff ?? 0) / dt_hr) * lot) / 3600).toFixed(3),
        // detention volume at this time step (m³)
        detentionVol: +((Math.max(0, s.cumRunoff - (pre?.cumRunoff ?? 0)) * lot) / 1000).toFixed(3),
      };
    });
  }, [postSteps, preSteps, lot]);

  // Summary stats
  const postTotalRunoff = postSteps.length > 0 ? postSteps[postSteps.length - 1].cumRunoff : 0;
  const preTotalRunoff = preSteps.length > 0 ? preSteps[preSteps.length - 1].cumRunoff : 0;
  const postTotalInf = postSteps.length > 0 ? postSteps[postSteps.length - 1].cumInf : 0;
  const preTotalInf = preSteps.length > 0 ? preSteps[preSteps.length - 1].cumInf : 0;
  const peakIntensity = postSteps.reduce((mx, s) => Math.max(mx, s.intensity), 0);
  const postRunoffVol = (postTotalRunoff * lot) / 1000;
  const preRunoffVol = (preTotalRunoff * lot) / 1000;
  const peakDetention = combinedData.reduce((mx, d) => Math.max(mx, d.detentionVol), 0);
  const peakPostFlow = combinedData.reduce((mx, d) => Math.max(mx, d.postFlow), 0);
  const peakPreFlow = combinedData.reduce((mx, d) => Math.max(mx, d.preFlow), 0);
  const timeToPonding = postSteps.find((s) => s.runoff > 0.01);
  const runoffIncreasePct =
    preTotalRunoff > 0 ? ((postTotalRunoff - preTotalRunoff) / preTotalRunoff) * 100 : 0;

  const tooltipStyle = {
    background: 'var(--tt-surface-raised)',
    border: '1px solid var(--tt-border-strong)',
    borderRadius: 2,
    color: 'var(--tt-text)',
    fontSize: 11,
    fontFamily: 'var(--tt-font)',
  };

  const ready = lot > 0 && totalDepth > 0 && patternRegion !== null;

  return (
    <div className="precip-view">
      <div className="precip-sidebar eng-sidebar">
        <div className="precip-sidebar-header">
          <h2>Storm Simulation</h2>
          <p className="precip-subtitle">
            Green-Ampt &middot; {patternLabel} temporal pattern &middot; Pre vs Post
          </p>
        </div>

        <SidebarInputPanel {...ps} />

        {ps.analysisData && (
          <>
            <div className="precip-section">
              <label className="precip-label">Design Storm</label>
              <label className="my-label">
                Temporal pattern region
                <select
                  aria-label="Temporal pattern region"
                  className="dc-select"
                  value={
                    patternOverride === 'auto' || patternOverride.startsWith(patternFamily + '-')
                      ? patternOverride
                      : 'auto'
                  }
                  onChange={(e) =>
                    setPatternSelection({
                      stationId: idfData.station?.id ?? '',
                      value: e.target.value,
                    })
                  }
                >
                  <option value="auto">
                    {patternFamily === 'hp26'
                      ? 'Select region from HP26 Figure 6.1'
                      : 'From selected design station'}
                  </option>
                  {patternFamily === 'hp26' ? (
                    hp26.patternRegions.map((r) => (
                      <option key={r.id} value={`hp26-${r.id}`}>
                        {r.label} · {r.state}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="msma-1">1 · Kelantan / Terengganu</option>
                      <option value="msma-2">2 · Selangor / central &amp; south</option>
                      <option value="msma-3">3 · Northern west coast</option>
                      <option value="msma-4">4 · Mountainous</option>
                      <option value="msma-5">5 · Kuala Lumpur urban</option>
                    </>
                  )}
                </select>
              </label>
              <p className="dc-note">
                {patternFamily === 'hp26' ? (
                  <>
                    HP26 regions differ from MSMA. Select explicitly using{' '}
                    <a href={`${HP26_URL}#page=62`} target="_blank" rel="noreferrer">
                      Figure 6.1, PDF page 62
                    </a>
                    ; Labuan also requires local confirmation.{' '}
                  </>
                ) : (
                  'MSMA Peninsular temporal patterns. Confirm suitability before applying an override. '
                )}
                Published rounded weights are renormalised to conserve rainfall.
              </p>
              <div className="eng-manual-form">
                <div className="eng-field">
                  <label className="eng-field-label">Return Period</label>
                  <select
                    className="dc-select"
                    style={{ width: '100%' }}
                    value={returnPeriod}
                    onChange={(e) => setReturnPeriod(+e.target.value)}
                  >
                    {IDF_RETURN_PERIODS.map((rp) => (
                      <option key={rp} value={rp}>
                        {rp}-year
                      </option>
                    ))}
                  </select>
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Storm Duration</label>
                  <select
                    className="dc-select"
                    style={{ width: '100%' }}
                    value={stormDuration}
                    onChange={(e) => setStormDuration(+e.target.value)}
                  >
                    <option value={1}>1 hour</option>
                    <option value={6}>6 hours</option>
                    <option value={12}>12 hours</option>
                    <option value={24}>24 hours</option>
                  </select>
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Soil Type (Green-Ampt)</label>
                  <select
                    className="dc-select"
                    style={{ width: '100%' }}
                    value={soilKey}
                    onChange={(e) => setSoilKey(e.target.value as SoilKey)}
                  >
                    {(Object.keys(GA_SOILS) as SoilKey[]).map((k) => (
                      <option key={k} value={k}>
                        {GA_SOILS[k].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="precip-section">
              <label className="precip-label">Soil &amp; Site Properties</label>
              <div className="sim-soil-table">
                <div className="sim-soil-row">
                  <span>
                    K<sub>s</sub> (sat. conductivity)
                  </span>
                  <strong>{soil.Ks} mm/hr</strong>
                </div>
                <div className="sim-soil-row">
                  <span>ψ (capillary suction)</span>
                  <strong>{soil.psi} mm</strong>
                </div>
                <div className="sim-soil-row">
                  <span>
                    M<sub>d</sub> (moisture deficit)
                  </span>
                  <strong>{(soil.theta_e - soil.theta_i).toFixed(3)}</strong>
                </div>
                <div className="sim-soil-row">
                  <span>Impervious (post-dev)</span>
                  <strong>{(imperviousFrac * 100).toFixed(0)}%</strong>
                </div>
                <div className="sim-soil-row">
                  <span>Impervious (pre-dev)</span>
                  <strong>0%</strong>
                </div>
                <div className="sim-soil-row">
                  <span>Lot Area</span>
                  <strong>{lot.toFixed(0)} m²</strong>
                </div>
              </div>
            </div>

            <div className="precip-section">
              <p className="dc-note">
                Model: Green-Ampt infiltration with {patternLabel} regional temporal pattern
                distribution. Pre-dev = natural ground (0% impervious). Post-dev = current site.
                Excess volume = cumulative runoff difference; no outlet routing or pond design.
              </p>
            </div>
          </>
        )}

        <div className="precip-section precip-footer-section">
          <p className="precip-hint" style={{ fontSize: 11 }}>
            <strong>Real data:</strong> Site — MBDK/JUPEM or user survey. Soil — Rawls et al.
            (1983), illustrative textural values. Storm —{' '}
            {patternFamily === 'hp26' ? 'HP26 2018 Chapter 6 and Appendix D' : 'MSMA Appendix 2.C'}.
            <br />
            Source: selected design manual. Published temporal weights are normalised to sum to one.
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

          {!ready ? (
            <div className="precip-overlay-loading" style={{ flex: 1 }}>
              {idfData.notice ||
                'Choose a design station, verified site dimensions and a suitable published temporal region to run simulation'}
            </div>
          ) : (
            <div className="sim-charts-area">
              {/* Summary Stats */}
              <div className="sim-chart-card">
                <h4>
                  Simulation Results — {returnPeriod}-yr {stormDuration}-hr Storm
                </h4>
                <div
                  className="dc-stat-grid"
                  style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))' }}
                >
                  <div className="dc-stat highlight">
                    <span className="dc-stat-value">{totalDepth.toFixed(1)} mm</span>
                    <span className="dc-stat-label">Total Rainfall</span>
                  </div>
                  <div className="dc-stat highlight">
                    <span className="dc-stat-value">{postRunoffVol.toFixed(1)} m³</span>
                    <span className="dc-stat-label">Post-Dev Runoff Vol</span>
                  </div>
                  <div className="dc-stat">
                    <span className="dc-stat-value">{preRunoffVol.toFixed(1)} m³</span>
                    <span className="dc-stat-label">Pre-Dev Runoff Vol</span>
                  </div>
                  <div
                    className="dc-stat"
                    style={{ borderColor: peakDetention > 0 ? 'var(--tt-error)' : undefined }}
                  >
                    <span
                      className="dc-stat-value"
                      style={{ color: peakDetention > 0 ? 'var(--tt-error)' : undefined }}
                    >
                      {peakDetention.toFixed(2)} m³
                    </span>
                    <span className="dc-stat-label">Excess Runoff Volume (screen)</span>
                  </div>
                  <div className="dc-stat">
                    <span className="dc-stat-value">{peakPostFlow.toFixed(1)} L/s</span>
                    <span className="dc-stat-label">Peak Post-Dev Flow</span>
                  </div>
                  <div className="dc-stat">
                    <span className="dc-stat-value">{peakPreFlow.toFixed(1)} L/s</span>
                    <span className="dc-stat-label">Peak Pre-Dev Flow</span>
                  </div>
                  <div className="dc-stat">
                    <span className="dc-stat-value">{peakIntensity.toFixed(0)} mm/hr</span>
                    <span className="dc-stat-label">Peak Intensity</span>
                  </div>
                  <div className="dc-stat">
                    <span className="dc-stat-value">
                      {timeToPonding ? timeToPonding.timeLabel : 'N/A'}
                    </span>
                    <span className="dc-stat-label">Ponding Begins</span>
                  </div>
                  <div className="dc-stat">
                    <span
                      className="dc-stat-value"
                      style={{
                        color: runoffIncreasePct > 0 ? 'var(--tt-error)' : 'var(--tt-accent)',
                      }}
                    >
                      {runoffIncreasePct > 0 ? '+' : ''}
                      {runoffIncreasePct.toFixed(0)}%
                    </span>
                    <span className="dc-stat-label">Runoff Increase</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    className="export-btn"
                    onClick={() =>
                      downloadCSV(
                        combinedData.map((d) => ({
                          Time: d.timeLabel,
                          Intensity_mm_hr: d.intensity,
                          PostRunoff_mm: d.postRunoff,
                          PreRunoff_mm: d.preRunoff,
                          PostFlow_Ls: d.postFlow,
                          PreFlow_Ls: d.preFlow,
                          CumPostRunoff_mm: d.cumPostRunoff,
                          CumPreRunoff_mm: d.cumPreRunoff,
                          ExcessRunoff_m3: d.detentionVol,
                          Site: ps.analysisData?.address,
                          Lot_Area_m2: lot,
                          IDF_Station: idfData.station?.id,
                          IDF_Source:
                            idfData.station?.source ??
                            'https://wplb.water.gov.my/assets/msma-2nd-edition.pdf',
                          Temporal_Region: patternRegion,
                          Temporal_Manual: patternFamily,
                          ARI_yr: returnPeriod,
                          Soil: soilKey,
                          Impervious_Fraction: imperviousFrac,
                        })),
                        'storm_simulation.csv',
                      )
                    }
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    CSV
                  </button>
                  <button
                    className="export-btn"
                    onClick={() => {
                      const el = document.querySelector('.sim-charts-area');
                      if (el) downloadPNG(el as HTMLElement, 'storm_simulation.png');
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    PNG
                  </button>
                </div>
              </div>

              {/* Rainfall Hyetograph */}
              <div className="sim-chart-card">
                <h4>Rainfall Hyetograph ({patternLabel} regional pattern)</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      minTickGap={30}
                    />
                    <YAxis
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      unit=" mm/hr"
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number | undefined) => [`${v ?? 0} mm/hr`]}
                    />
                    <Bar
                      dataKey="intensity"
                      fill="#3b82f6"
                      name="Rainfall Intensity"
                      radius={[1, 1, 0, 0]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Site Runoff Rate — Pre vs Post (L/s) */}
              <div className="sim-chart-card">
                <h4>Site Runoff Rate — Pre vs Post Development (L/s)</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      minTickGap={30}
                    />
                    <YAxis
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      unit=" L/s"
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="postFlow"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.2}
                      name="Post-Dev (L/s)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="preFlow"
                      stroke="#6b7280"
                      fill="#6b7280"
                      fillOpacity={0.15}
                      name="Pre-Dev (L/s)"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                    />
                    <ReferenceLine
                      y={peakPreFlow}
                      stroke="#6b7280"
                      strokeDasharray="8 4"
                      label={{
                        value: `Pre-dev max: ${peakPreFlow.toFixed(1)} L/s`,
                        fill: 'rgba(107,114,128,0.8)',
                        fontSize: 9,
                        position: 'insideTopRight',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="dc-note" style={{ marginTop: 6 }}>
                  Curves show generated surface runoff before hydraulic routing. The modelled
                  pre-development peak is {peakPreFlow.toFixed(1)} L/s; this is not an approved
                  outlet limit.
                </p>
              </div>

              {/* Detention Volume Over Time */}
              <div className="sim-chart-card">
                <h4>Cumulative Excess Runoff Over Time (m³)</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      minTickGap={30}
                    />
                    <YAxis
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      unit=" m³"
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(3)} m³`]}
                    />
                    <Area
                      type="monotone"
                      dataKey="detentionVol"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.25}
                      name="Excess Runoff Volume"
                      strokeWidth={2}
                    />
                    <ReferenceLine
                      y={peakDetention}
                      stroke="#ef4444"
                      strokeDasharray="6 3"
                      label={{
                        value: `Peak: ${peakDetention.toFixed(2)} m³`,
                        fill: 'rgba(239,68,68,0.9)',
                        fontSize: 10,
                        position: 'insideTopRight',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="dc-note" style={{ marginTop: 6 }}>
                  The maximum cumulative runoff difference is{' '}
                  <strong>{peakDetention.toFixed(2)} m³</strong>. Outlet discharge, travel time and
                  storage routing are not modelled here; use a routed hydraulic design to size a
                  detention facility.
                </p>
              </div>

              {/* Infiltration Capacity vs Rainfall */}
              <div className="sim-chart-card">
                <h4>Infiltration Capacity vs Rainfall (Green-Ampt)</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      minTickGap={30}
                    />
                    <YAxis
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      unit=" mm/hr"
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="intensity"
                      stroke="#3b82f6"
                      name="Rainfall (mm/hr)"
                      dot={false}
                      strokeWidth={1.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="preInfRate"
                      stroke="#22c55e"
                      name="Inf. Capacity: Pre-Dev (mm/hr)"
                      dot={false}
                      strokeWidth={1.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="postInfRate"
                      stroke="#22c55e"
                      name="Inf. Capacity: Post-Dev (mm/hr)"
                      dot={false}
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="dc-note" style={{ marginTop: 6 }}>
                  When rainfall exceeds infiltration capacity, surface runoff begins. Post-dev has{' '}
                  {(imperviousFrac * 100).toFixed(0)}% impervious area where all rainfall becomes
                  runoff.
                </p>
              </div>

              {/* Cumulative: Pre vs Post */}
              <div className="sim-chart-card">
                <h4>Cumulative Runoff — Pre vs Post Development (mm)</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={combinedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" />
                    <XAxis
                      dataKey="timeLabel"
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      minTickGap={30}
                    />
                    <YAxis
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      unit=" mm"
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                      type="monotone"
                      dataKey="cumRain"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.08}
                      name="Cumulative Rainfall"
                      strokeWidth={1.5}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumPostRunoff"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.15}
                      name="Post-Dev Runoff"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumPreRunoff"
                      stroke="#6b7280"
                      fill="#6b7280"
                      fillOpacity={0.1}
                      name="Pre-Dev Runoff"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                    />
                    <Area
                      type="monotone"
                      dataKey="cumPostInf"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.08}
                      name="Post-Dev Infiltration"
                      strokeWidth={1}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Water Balance */}
              <div className="sim-waterbalance">
                <h4>Water Balance Comparison (mm over {lot.toFixed(0)} m² site)</h4>
                <table className="cost-table" style={{ marginBottom: 10 }}>
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Pre-Dev</th>
                      <th>Post-Dev</th>
                      <th>Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Precipitation (P)</td>
                      <td>
                        {postSteps.length > 0
                          ? postSteps[postSteps.length - 1].cumRain.toFixed(1)
                          : 0}{' '}
                        mm
                      </td>
                      <td>
                        {postSteps.length > 0
                          ? postSteps[postSteps.length - 1].cumRain.toFixed(1)
                          : 0}{' '}
                        mm
                      </td>
                      <td>—</td>
                    </tr>
                    <tr>
                      <td>Surface Runoff (R)</td>
                      <td>{preTotalRunoff.toFixed(1)} mm</td>
                      <td style={{ color: 'var(--tt-error)' }}>{postTotalRunoff.toFixed(1)} mm</td>
                      <td style={{ color: 'var(--tt-error)' }}>
                        +{(postTotalRunoff - preTotalRunoff).toFixed(1)} mm
                      </td>
                    </tr>
                    <tr>
                      <td>Infiltration (G)</td>
                      <td>{preTotalInf.toFixed(1)} mm</td>
                      <td>{postTotalInf.toFixed(1)} mm</td>
                      <td style={{ color: 'var(--tt-accent)' }}>
                        {(postTotalInf - preTotalInf).toFixed(1)} mm
                      </td>
                    </tr>
                    <tr>
                      <td>Runoff Volume</td>
                      <td>{preRunoffVol.toFixed(2)} m³</td>
                      <td style={{ color: 'var(--tt-error)' }}>{postRunoffVol.toFixed(2)} m³</td>
                      <td style={{ color: 'var(--tt-error)' }}>
                        +{(postRunoffVol - preRunoffVol).toFixed(2)} m³
                      </td>
                    </tr>
                    <tr style={{ fontWeight: 600 }}>
                      <td>Excess Runoff Volume</td>
                      <td>—</td>
                      <td>—</td>
                      <td style={{ color: 'var(--tt-warning)' }}>{peakDetention.toFixed(2)} m³</td>
                    </tr>
                  </tbody>
                </table>
                <p className="dc-note">
                  Evaporation and transpiration neglected for storm-event timescale (Bedient et al.,
                  2019). Excess volume = peak difference in cumulative runoff between post and
                  pre-development conditions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
