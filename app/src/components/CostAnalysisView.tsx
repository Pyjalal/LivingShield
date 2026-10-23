import { useState, useMemo, useEffect } from 'react';
import { downloadCSV } from '../utils/export';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { usePropertySearch } from '../hooks/usePropertySearch';
import { SidebarInputPanel, SiteMapPanel } from './SiteInputPanel';
import {
  IDF_RETURN_PERIODS,
  calcPipeDiameter,
  roundUpPipe,
  C_PRE_DEV,
  haversineKm,
} from '../utils/hydrology';
import { useStationIDF } from '../hooks/useStationIDF';
import { DURATIONS } from '../malaysia/design';

type PipeMaterial = 'pvc' | 'hdpe' | 'concrete';
interface PipeOption {
  dia_mm: number;
  pvc: number;
  hdpe: number;
  concrete: number;
}

const PIPE_CATALOGUE: PipeOption[] = [
  100, 150, 200, 250, 300, 375, 450, 525, 600, 750, 900, 1050, 1200, 1500, 1800, 2100, 2400,
].map((dia_mm) => ({ dia_mm, pvc: 0, hdpe: dia_mm === 300 ? 70 : 0, concrete: 0 }));

const MATERIAL_LABELS: Record<PipeMaterial, string> = {
  pvc: 'PVC (Polyvinyl Chloride)',
  hdpe: 'HDPE (High-Density Polyethylene)',
  concrete: 'Reinforced Concrete',
};

export default function CostAnalysisView() {
  const ps = usePropertySearch();
  const idfData = useStationIDF(ps.analysisData?.lat ?? 0, ps.analysisData?.lng ?? 0);
  const getI = idfData.getIntensity;

  const [returnPeriod, setReturnPeriod] = useState(100);
  const [pipeMaterial, setPipeMaterial] = useState<PipeMaterial>('pvc');
  const [pipeLength, setPipeLength] = useState('');
  const [pipeRate, setPipeRate] = useState('');
  const [connectionLength, setConnectionLength] = useState('');
  const [connectionFee, setConnectionFee] = useState('');
  const [permitFeeInput, setPermitFeeInput] = useState('');
  const [engineeringPct, setEngineeringPct] = useState(15);
  const [contingencyPct, setContingencyPct] = useState(10);
  const ENGINEERING_PCT = engineeringPct / 100,
    CONTINGENCY_PCT = contingencyPct / 100;
  const [numCatchBasins, setNumCatchBasins] = useState('');
  const [numManholes, setNumManholes] = useState('');
  const [lidGreenRoof, setLidGreenRoof] = useState(false);
  const [lidRainGarden, setLidRainGarden] = useState(false);
  const [lidPermPave, setLidPermPave] = useState(false);
  const [lidBioswale, setLidBioswale] = useState(false);

  const [costCB, setCostCB] = useState('');
  const [costMH, setCostMH] = useState('');
  const [costExc, setCostExc] = useState('');
  const [costBF, setCostBF] = useState('');
  const [costGreenRoof, setCostGreenRoof] = useState('');
  const [costRainGarden, setCostRainGarden] = useState('');
  const [costPermPave, setCostPermPave] = useState('');
  const [costBioswale, setCostBioswale] = useState('');
  const [costDetention, setCostDetention] = useState('');
  const [costGrading, setCostGrading] = useState('');
  const [costErosion, setCostErosion] = useState('');
  const [costConnection, setCostConnection] = useState('');

  const cbUnit = Math.max(0, parseFloat(costCB) || 0);
  const mhUnit = Math.max(0, parseFloat(costMH) || 0);
  const excUnit = Math.max(0, parseFloat(costExc) || 0);
  const bfUnit = Math.max(0, parseFloat(costBF) || 0);
  const grUnit = Math.max(0, parseFloat(costGreenRoof) || 0);
  const rgUnit = Math.max(0, parseFloat(costRainGarden) || 0);
  const ppUnit = Math.max(0, parseFloat(costPermPave) || 0);
  const bsUnit = Math.max(0, parseFloat(costBioswale) || 0);
  const detUnit = Math.max(0, parseFloat(costDetention) || 0);
  const gradUnit = Math.max(0, parseFloat(costGrading) || 0);
  const erosionUnit = Math.max(0, parseFloat(costErosion) || 0);
  const connUnit = Math.max(0, parseFloat(costConnection) || 0);

  const lot = ps.analysisData?.buildingKnown ? ps.analysisData.lotSize : 0;
  const bldg = ps.analysisData?.buildingArea ?? 0;
  const paveFrac = ps.analysisData?.zoningPaveFrac ?? 0.15;
  const lat = ps.analysisData?.lat ?? 0;
  const lng = ps.analysisData?.lng ?? 0;

  // Fetch nearest pipe distance from API
  const [nearestPipeDist, setNearestPipeDist] = useState<number | null>(null);
  useEffect(() => {
    if (lat === 0 || lng === 0) return;
    setNearestPipeDist(null);
    const controller = new AbortController();
    (async () => {
      try {
        const url = `/api/gis?id=drainage&bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Drain source unavailable');
        const body: { data: import('geojson').FeatureCollection } = await res.json();
        const data = body.data.features.flatMap((f) =>
          f.geometry.type === 'LineString'
            ? [{ geometry_line: { coordinates: f.geometry.coordinates } }]
            : [],
        );
        if (data.length > 0) {
          let minDist = Infinity;
          for (const pipe of data) {
            const coords = pipe.geometry_line?.coordinates;
            if (!coords) continue;
            for (const c of coords) {
              const d = haversineKm(lat, lng, c[1], c[0]) * 1000;
              if (d < minDist) minDist = d;
            }
          }
          if (minDist < Infinity) setNearestPipeDist(Math.round(minDist));
        }
      } catch {
        /* ignore */
      }
    })();
    return () => controller.abort();
  }, [lat, lng]);

  useEffect(() => {
    if (lot <= 0) return;
    const sideLen = Math.sqrt(lot);
    const estPipeRun = Math.round(sideLen * 0.6 + 3);
    setPipeLength(String(estPipeRun));
    const imperviousArea = bldg + lot * paveFrac;
    setNumCatchBasins(String(Math.max(1, Math.ceil(imperviousArea / 400))));
    setNumManholes(String(Math.max(1, Math.ceil(estPipeRun / 90))));
  }, [lot, bldg, paveFrac]);

  const pipeLenM = Math.max(0, parseFloat(pipeLength) || 0);
  const catchBasins = Math.max(0, parseInt(numCatchBasins) || 0);
  const manholes = Math.max(0, parseInt(numManholes) || 0);

  // Local detention calc using live IDF source
  function localDet(C_post: number, areaHa: number, tcMin: number, rp: number) {
    const durations = [...new Set([...DURATIONS, 20, 45, 90, tcMin])].sort((a, b) => a - b);
    const Q_release = (C_PRE_DEV * getI(tcMin, rp) * areaHa) / 360;
    let maxVol = 0,
      critDur = tcMin;
    for (const d of durations) {
      if (d < tcMin) continue;
      const i2 = getI(d, rp);
      const Q_in = (C_post * i2 * areaHa) / 360;
      const storage = (Q_in - Q_release) * d * 60;
      if (storage > maxVol) {
        maxVol = storage;
        critDur = d;
      }
    }
    return { vol: Math.max(0, maxVol), critDur };
  }

  const calc = useMemo(() => {
    if (lot <= 0 || !idfData.available) return null;
    const paveArea = Math.min(lot * paveFrac, lot - bldg),
      lawnArea = Math.max(0, lot - bldg - paveArea);
    const C = (bldg * 0.95 + paveArea * 0.9 + lawnArea * 0.25) / lot;
    const tc_raw = (0.0195 * Math.pow(Math.sqrt(lot), 0.77)) / Math.pow(0.005, 0.385);
    const tc = Math.min(30, Math.max(idfData.station?.minDurationMinutes ?? 5, tc_raw));
    const i = getI(tc, returnPeriod);
    const Q = (C * i * (lot / 10000)) / 360;
    const pipe_mm = roundUpPipe(calcPipeDiameter(Q));
    const area_ha = lot / 10000;
    const det = localDet(C, area_ha, tc, returnPeriod);

    let lidC = C;
    const roofC_lid = 0.5 * 0.4 + 0.5 * 0.95;
    const paveC_lid = 0.3;
    if (lidGreenRoof || lidRainGarden || lidPermPave || lidBioswale) {
      const effRoof = lidGreenRoof ? roofC_lid : 0.95;
      const effPave = lidPermPave ? paveC_lid : 0.9;
      lidC = (effRoof * bldg + effPave * paveArea + 0.25 * lawnArea) / lot;
      if (lidRainGarden) lidC *= 0.92;
    }
    const Q_lid = (lidC * i * area_ha) / 360;
    const pipe_lid = roundUpPipe(calcPipeDiameter(lidBioswale ? Q_lid * 0.8 : Q_lid));
    const detLid = localDet(lidBioswale ? lidC * 0.8 : lidC, area_ha, tc, returnPeriod);

    return {
      C,
      lidC,
      tc,
      i,
      Q,
      pipe_mm,
      detVol: det.vol,
      detCritDur: det.critDur,
      Q_lid,
      pipe_lid,
      detVolLid: detLid.vol,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    lot,
    bldg,
    returnPeriod,
    paveFrac,
    lidGreenRoof,
    lidRainGarden,
    lidPermPave,
    lidBioswale,
    getI,
  ]);

  // Connection pipe length (from site to nearest sewer)
  const connectionLen = Math.max(0, Number(connectionLength) || 0);

  // Site perimeter for erosion control
  const sitePerimeter = Math.sqrt(lot) * 4;

  const costs = useMemo(() => {
    if (!calc) return null;
    const pipeRow = PIPE_CATALOGUE.find((p) => p.dia_mm >= calc.pipe_mm);
    if (!pipeRow) return null;
    const unitCost =
      pipeRate.trim() === '' ? pipeRow[pipeMaterial] : Math.max(0, Number(pipeRate) || 0);

    // Infrastructure
    const pipeCost = unitCost * pipeLenM;
    const cbCost = catchBasins * cbUnit,
      mhCost = manholes * mhUnit;
    const pipeOD = pipeRow.dia_mm / 1000;
    const trenchDepth = 0.9 + pipeOD + 0.15;
    const trenchWidth = Math.max(0.6, pipeOD + 0.45);
    const excavVol = trenchDepth * trenchWidth * pipeLenM;
    const excCost = excavVol * excUnit,
      bfCost = excavVol * bfUnit;
    const detCost = calc.detVol * detUnit;

    // Connection to municipal sewer
    const connCost = connectionLen * connUnit;

    // Site preparation
    const gradingCost = lot * gradUnit;
    const erosionCost = sitePerimeter * erosionUnit;

    // User-entered local fees.
    const stormConnFee = Math.max(0, Number(connectionFee) || 0);
    const permitFee = Math.max(0, Number(permitFeeInput) || 0);

    // LID
    const greenRoofArea = lidGreenRoof ? bldg * 0.5 : 0;
    const rainGardenArea = lidRainGarden ? lot * 0.05 : 0;
    const permPaveArea = lidPermPave ? lot * 0.15 : 0;
    const bioswaleLen = lidBioswale ? Math.sqrt(lot) * 0.5 : 0;
    const greenRoofCost = greenRoofArea * grUnit;
    const rainGardenCost = rainGardenArea * rgUnit;
    const permPaveCost = permPaveArea * ppUnit;
    const bioswaleCost = bioswaleLen * bsUnit;
    const lidTotal = greenRoofCost + rainGardenCost + permPaveCost + bioswaleCost;

    // LID-adjusted detention
    const detCostLid = calc.detVolLid * detUnit;

    // Totals
    const infraTotal = pipeCost + cbCost + mhCost + excCost + bfCost + detCost + connCost;
    const sitePrepTotal = gradingCost + erosionCost;
    const feesTotal = stormConnFee + permitFee;
    const subtotal = infraTotal + lidTotal + sitePrepTotal + feesTotal;
    const engineering = subtotal * ENGINEERING_PCT,
      contingency = subtotal * CONTINGENCY_PCT;
    const grandTotal = subtotal + engineering + contingency;

    // Without-LID comparison (use full detention, no LID cost)
    const noLidInfra = pipeCost + cbCost + mhCost + excCost + bfCost + detCost + connCost;
    const noLidTotal =
      (noLidInfra + sitePrepTotal + feesTotal) * (1 + ENGINEERING_PCT + CONTINGENCY_PCT);

    // With-LID uses reduced detention
    const lidInfra = pipeCost + cbCost + mhCost + excCost + bfCost + detCostLid + connCost;
    const lidTotalAll =
      (lidInfra + lidTotal + sitePrepTotal + feesTotal) * (1 + ENGINEERING_PCT + CONTINGENCY_PCT);

    return {
      pipe: {
        dia: pipeRow.dia_mm,
        material: pipeMaterial,
        unitCost,
        length: pipeLenM,
        cost: pipeCost,
      },
      catchBasins: { count: catchBasins, unitCost: cbUnit, cost: cbCost },
      manholes: { count: manholes, unitCost: mhUnit, cost: mhCost },
      detention: {
        vol: calc.detVol,
        volLid: calc.detVolLid,
        unitCost: detUnit,
        cost: detCost,
        costLid: detCostLid,
        critDur: calc.detCritDur,
      },
      excavation: { vol: excavVol, cost: excCost, depth: trenchDepth, width: trenchWidth },
      backfill: { vol: excavVol, cost: bfCost },
      connection: { len: connectionLen, unitCost: connUnit, cost: connCost, fromApi: false },
      sitePrep: {
        grading: { area: lot, cost: gradingCost },
        erosion: { perimeter: sitePerimeter, cost: erosionCost },
        total: sitePrepTotal,
      },
      fees: { stormConn: stormConnFee, permit: permitFee, total: feesTotal },
      lid: {
        greenRoof: { area: greenRoofArea, cost: greenRoofCost },
        rainGarden: { area: rainGardenArea, cost: rainGardenCost },
        permPave: { area: permPaveArea, cost: permPaveCost },
        bioswale: { len: bioswaleLen, cost: bioswaleCost },
        total: lidTotal,
      },
      infraTotal,
      sitePrepTotal,
      feesTotal,
      lidTotal,
      subtotal,
      engineering,
      contingency,
      grandTotal,
      comparison: { noLid: noLidTotal, withLid: lidTotalAll, savings: noLidTotal - lidTotalAll },
      perUnit: {
        perM2Lot: grandTotal / lot,
        perM2Imperv: grandTotal / (bldg + lot * paveFrac),
        perM3Det: calc.detVol > 0 ? detCost / calc.detVol : 0,
      },
    };
  }, [
    calc,
    pipeMaterial,
    pipeLenM,
    catchBasins,
    manholes,
    lidGreenRoof,
    lidRainGarden,
    lidPermPave,
    lidBioswale,
    lot,
    bldg,
    cbUnit,
    mhUnit,
    excUnit,
    bfUnit,
    grUnit,
    rgUnit,
    ppUnit,
    bsUnit,
    detUnit,
    connectionLen,
    sitePerimeter,
    gradUnit,
    erosionUnit,
    connUnit,
    paveFrac,
    pipeRate,
    connectionFee,
    permitFeeInput,
    ENGINEERING_PCT,
    CONTINGENCY_PCT,
  ]);

  const anyLid = lidGreenRoof || lidRainGarden || lidPermPave || lidBioswale;

  const chartData = useMemo(() => {
    if (!costs) return [];
    return [
      { name: 'Storm Pipe', cost: costs.pipe.cost },
      { name: 'Catch Basins', cost: costs.catchBasins.cost },
      { name: 'Manholes', cost: costs.manholes.cost },
      { name: 'Detention', cost: costs.detention.cost },
      { name: 'Connection', cost: costs.connection.cost },
      { name: 'Excavation', cost: costs.excavation.cost },
      { name: 'Backfill', cost: costs.backfill.cost },
      { name: 'Grading', cost: costs.sitePrep.grading.cost },
      { name: 'Erosion Ctrl', cost: costs.sitePrep.erosion.cost },
      { name: 'PBT Fee', cost: costs.fees.stormConn },
      { name: 'Permit', cost: costs.fees.permit },
      ...(costs.lid.greenRoof.cost > 0
        ? [{ name: 'Green Roof', cost: costs.lid.greenRoof.cost }]
        : []),
      ...(costs.lid.rainGarden.cost > 0
        ? [{ name: 'Rain Garden', cost: costs.lid.rainGarden.cost }]
        : []),
      ...(costs.lid.permPave.cost > 0
        ? [{ name: 'Perm. Pave', cost: costs.lid.permPave.cost }]
        : []),
      ...(costs.lid.bioswale.cost > 0
        ? [{ name: 'Bio-swale', cost: costs.lid.bioswale.cost }]
        : []),
      { name: 'Engineering', cost: costs.engineering },
      { name: 'Contingency', cost: costs.contingency },
    ];
  }, [costs]);

  const pieData = useMemo(() => {
    if (!costs) return [];
    return [
      { name: 'Storm Infrastructure', value: costs.infraTotal },
      { name: 'Site Preparation', value: costs.sitePrepTotal },
      { name: 'Municipal Fees', value: costs.feesTotal },
      { name: 'LID Features', value: costs.lidTotal },
      { name: 'Eng. & Contingency', value: costs.engineering + costs.contingency },
    ].filter((d) => d.value > 0);
  }, [costs]);

  const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'];
  const tooltipStyle = {
    background: 'var(--tt-surface-raised)',
    border: '1px solid var(--tt-border-strong)',
    borderRadius: 2,
    color: 'var(--tt-text)',
    fontSize: 11,
    fontFamily: 'var(--tt-font)',
  };
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="precip-view">
      <div className="precip-sidebar eng-sidebar">
        <div className="precip-sidebar-header">
          <h2>Cost Analysis</h2>
          <p className="precip-subtitle">Full Project Estimate &middot; LID Comparison</p>
        </div>

        <SidebarInputPanel {...ps} />
        <div className="precip-section">
          <p className="my-method-warning">
            MYR screening estimate. Blank unit rates/fees are excluded: this is an incomplete quote
            until every required rate is supplied. Delivery, SST, labour and installation are not
            included in the published material price. Geometry-derived drain proximity does not
            confirm a connection route.
          </p>
          <label className="my-label">
            Pipe unit rate (RM/m)
            <input
              aria-label="Pipe unit rate MYR per metre"
              type="number"
              min="0"
              className="prop-input"
              value={pipeRate}
              onChange={(e) => setPipeRate(e.target.value)}
            />
          </label>
          <label className="my-label">
            Connection run (m)
            <input
              aria-label="Connection run metres"
              type="number"
              min="0"
              className="prop-input"
              value={connectionLength}
              onChange={(e) => setConnectionLength(e.target.value)}
            />
          </label>
          <label className="my-label">
            Local connection fee (RM)
            <input
              type="number"
              min="0"
              className="prop-input"
              value={connectionFee}
              onChange={(e) => setConnectionFee(e.target.value)}
            />
          </label>
          <label className="my-label">
            Permit fee (RM)
            <input
              type="number"
              min="0"
              className="prop-input"
              value={permitFeeInput}
              onChange={(e) => setPermitFeeInput(e.target.value)}
            />
          </label>
          <label className="my-label">
            Engineering allowance (%)
            <input
              type="number"
              min="0"
              max="100"
              className="prop-input"
              value={engineeringPct}
              onChange={(e) =>
                setEngineeringPct(Math.max(0, Math.min(100, Number(e.target.value))))
              }
            />
          </label>
          <label className="my-label">
            Contingency (%)
            <input
              type="number"
              min="0"
              max="100"
              className="prop-input"
              value={contingencyPct}
              onChange={(e) =>
                setContingencyPct(Math.max(0, Math.min(100, Number(e.target.value))))
              }
            />
          </label>
        </div>

        {ps.analysisData && (
          <>
            <div className="precip-section">
              <label className="precip-label">Pipe Infrastructure</label>
              <div className="eng-manual-form">
                <div className="eng-field">
                  <label className="eng-field-label">Design Return Period</label>
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
                  <label className="eng-field-label">Pipe Material</label>
                  <select
                    className="dc-select"
                    style={{ width: '100%' }}
                    value={pipeMaterial}
                    onChange={(e) => setPipeMaterial(e.target.value as PipeMaterial)}
                  >
                    <option value="pvc">PVC</option>
                    <option value="hdpe">HDPE</option>
                    <option value="concrete">Reinforced Concrete</option>
                  </select>
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Pipe Run Length (m)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={pipeLength}
                    onChange={(e) => setPipeLength(e.target.value)}
                    min="1"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Catch Basins</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={numCatchBasins}
                    onChange={(e) => setNumCatchBasins(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Manholes</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={numManholes}
                    onChange={(e) => setNumManholes(e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="precip-section">
              <label className="precip-label">
                Unit Rates (MYR) <span style={{ fontSize: 9, opacity: 0.5 }}>— editable</span>
              </label>
              <div className="eng-manual-form" style={{ gap: 4 }}>
                <div className="eng-field">
                  <label className="eng-field-label">Catch Basin (RM/ea)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costCB}
                    onChange={(e) => setCostCB(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Manhole (RM/ea)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costMH}
                    onChange={(e) => setCostMH(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Excavation (RM/m³)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costExc}
                    onChange={(e) => setCostExc(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Backfill (RM/m³)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costBF}
                    onChange={(e) => setCostBF(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Detention (RM/m³)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costDetention}
                    onChange={(e) => setCostDetention(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Connection (RM/m)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costConnection}
                    onChange={(e) => setCostConnection(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Grading (RM/m²)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costGrading}
                    onChange={(e) => setCostGrading(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Erosion Ctrl (RM/m)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costErosion}
                    onChange={(e) => setCostErosion(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Green Roof (RM/m²)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costGreenRoof}
                    onChange={(e) => setCostGreenRoof(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Rain Garden (RM/m²)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costRainGarden}
                    onChange={(e) => setCostRainGarden(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Perm. Pave (RM/m²)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costPermPave}
                    onChange={(e) => setCostPermPave(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="eng-field">
                  <label className="eng-field-label">Bio-swale (RM/lm)</label>
                  <input
                    type="number"
                    className="prop-input"
                    value={costBioswale}
                    onChange={(e) => setCostBioswale(e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="precip-section">
              <label className="precip-label">LID Features</label>
              <div className="dc-lid-grid" style={{ gap: 6 }}>
                {[
                  {
                    key: 'greenRoof',
                    label: 'Green Roof',
                    desc: `~${bldg > 0 ? (bldg * 0.5).toFixed(0) : 0} m²`,
                    val: lidGreenRoof,
                    set: setLidGreenRoof,
                  },
                  {
                    key: 'rainGarden',
                    label: 'Rain Garden',
                    desc: `~${lot > 0 ? (lot * 0.05).toFixed(0) : 0} m²`,
                    val: lidRainGarden,
                    set: setLidRainGarden,
                  },
                  {
                    key: 'permPave',
                    label: 'Perm. Pave',
                    desc: `~${lot > 0 ? (lot * 0.15).toFixed(0) : 0} m²`,
                    val: lidPermPave,
                    set: setLidPermPave,
                  },
                  {
                    key: 'bioswale',
                    label: 'Bio-swale',
                    desc: `~${lot > 0 ? (Math.sqrt(lot) * 0.5).toFixed(0) : 0} m`,
                    val: lidBioswale,
                    set: setLidBioswale,
                  },
                ].map((lid) => (
                  <button
                    key={lid.key}
                    className={`dc-lid-btn ${lid.val ? 'dc-lid-on' : ''}`}
                    onClick={() => lid.set(!lid.val)}
                  >
                    <strong>{lid.label}</strong>
                    <span style={{ fontSize: 10, opacity: 0.7 }}>{lid.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="precip-section precip-footer-section">
          <p className="precip-hint" style={{ fontSize: 11 }}>
            <strong>Real data:</strong> Property &amp; nearest pipe — MBDK / JUPEM.
            <br />
            <strong>User-provided:</strong> Only explicitly entered or sourced material rates are
            priced. Blank rates are excluded, not quoted as free. Rainfall duration respects the
            selected profile’s published minimum ({idfData.station?.minDurationMinutes ?? 5} min);
            this may exceed the Kirpich estimate.
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

          {!costs ? (
            <div className="precip-overlay-loading" style={{ flex: 1 }}>
              {idfData.notice ||
                (calc
                  ? 'Required pipe exceeds the catalogue. Obtain an engineered design and quotation.'
                  : 'Choose a Malaysian design station and enter verified site dimensions to calculate costs')}
            </div>
          ) : (
            <div className="sim-charts-area">
              {/* Summary */}
              <div className="sim-chart-card">
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <h4>Project Cost Summary — {returnPeriod}-yr Design Storm</h4>
                  <button
                    className="export-btn"
                    onClick={() =>
                      downloadCSV(
                        chartData.map((d) => ({
                          Item: d.name,
                          Cost_MYR: d.cost,
                          Status: 'Partial estimate; blank rates excluded',
                          Site: ps.analysisData?.address,
                          IDF_Station: idfData.station?.id,
                          Pipe_Rate_MYR_m: costs.pipe.unitCost,
                          Pipe_Length_m: pipeLenM,
                        })),
                        'cost_analysis.csv',
                      )
                    }
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    CSV
                  </button>
                </div>
                <div className="cost-summary-grid">
                  <div className="cost-summary-item cost-total">
                    <span className="cost-summary-label">Partial Cost Scenario</span>
                    <span className="cost-summary-value">{fmt(costs.grandTotal)}</span>
                  </div>
                  <div className="cost-summary-item">
                    <span className="cost-summary-label">Storm Infrastructure</span>
                    <span className="cost-summary-value">{fmt(costs.infraTotal)}</span>
                  </div>
                  <div className="cost-summary-item">
                    <span className="cost-summary-label">Site Preparation</span>
                    <span className="cost-summary-value">{fmt(costs.sitePrepTotal)}</span>
                  </div>
                  <div className="cost-summary-item">
                    <span className="cost-summary-label">Municipal Fees</span>
                    <span className="cost-summary-value">{fmt(costs.feesTotal)}</span>
                  </div>
                  <div className="cost-summary-item">
                    <span className="cost-summary-label">LID Features</span>
                    <span className="cost-summary-value">{fmt(costs.lidTotal)}</span>
                  </div>
                  <div className="cost-summary-item">
                    <span className="cost-summary-label">Engineering + Contingency</span>
                    <span className="cost-summary-value">
                      {fmt(costs.engineering + costs.contingency)}
                    </span>
                  </div>
                </div>
                <div
                  className="dc-stat-grid"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))',
                    marginTop: 10,
                    marginBottom: 0,
                  }}
                >
                  <div className="dc-stat">
                    <span className="dc-stat-value">{fmt(costs.perUnit.perM2Lot)}/m²</span>
                    <span className="dc-stat-label">Cost per m² (lot)</span>
                  </div>
                  <div className="dc-stat">
                    <span className="dc-stat-value">{fmt(costs.perUnit.perM2Imperv)}/m²</span>
                    <span className="dc-stat-label">Cost per m² (imperv.)</span>
                  </div>
                  <div className="dc-stat">
                    <span className="dc-stat-value">{costs.detention.vol.toFixed(1)} m³</span>
                    <span className="dc-stat-label">Detention Volume</span>
                  </div>
                  {nearestPipeDist !== null && (
                    <div className="dc-stat">
                      <span className="dc-stat-value">{nearestPipeDist} m</span>
                      <span className="dc-stat-label">Nearby mapped drain (straight line)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* With vs Without LID */}
              {anyLid && (
                <div className="sim-chart-card">
                  <h4>Cost Comparison — With vs Without LID</h4>
                  <div className="cost-summary-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div className="cost-summary-item">
                      <span className="cost-summary-label">Without LID</span>
                      <span className="cost-summary-value">{fmt(costs.comparison.noLid)}</span>
                    </div>
                    <div className="cost-summary-item">
                      <span className="cost-summary-label">With LID</span>
                      <span className="cost-summary-value">{fmt(costs.comparison.withLid)}</span>
                    </div>
                    <div
                      className="cost-summary-item"
                      style={{ borderColor: costs.comparison.savings > 0 ? '#22c55e' : '#ef4444' }}
                    >
                      <span className="cost-summary-label">
                        {costs.comparison.savings > 0 ? 'Net Savings' : 'Additional Cost'}
                      </span>
                      <span
                        className="cost-summary-value"
                        style={{ color: costs.comparison.savings > 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {costs.comparison.savings > 0 ? '-' : '+'}
                        {fmt(Math.abs(costs.comparison.savings))}
                      </span>
                    </div>
                  </div>
                  <p className="dc-note" style={{ marginTop: 8 }}>
                    LID reduces detention from {costs.detention.vol.toFixed(1)} m³ to{' '}
                    {costs.detention.volLid.toFixed(1)} m³ (saves{' '}
                    {fmt(costs.detention.cost - costs.detention.costLid)} on detention).
                    {costs.comparison.savings > 0
                      ? ' LID features cost less than the detention they replace — net savings.'
                      : ' LID adds upfront cost but provides long-term environmental benefits and may qualify for municipal incentives.'}
                  </p>
                </div>
              )}

              {/* Detailed Breakdown */}
              <div className="sim-chart-card">
                <h4>Detailed Cost Breakdown</h4>
                <table className="cost-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Rate</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="cost-row-header">
                      <td colSpan={6}>Storm Pipe Infrastructure</td>
                    </tr>
                    <tr>
                      <td>Storm Pipe</td>
                      <td>
                        {costs.pipe.dia} mm {MATERIAL_LABELS[costs.pipe.material]}
                      </td>
                      <td>{costs.pipe.length}</td>
                      <td>m</td>
                      <td>{fmt(costs.pipe.unitCost)}/m</td>
                      <td>{fmt(costs.pipe.cost)}</td>
                    </tr>
                    <tr>
                      <td>Catch Basins</td>
                      <td>Standard CB w/ grate</td>
                      <td>{costs.catchBasins.count}</td>
                      <td>ea</td>
                      <td>{fmt(costs.catchBasins.unitCost)}/ea</td>
                      <td>{fmt(costs.catchBasins.cost)}</td>
                    </tr>
                    <tr>
                      <td>Manholes</td>
                      <td>Standard MH</td>
                      <td>{costs.manholes.count}</td>
                      <td>ea</td>
                      <td>{fmt(costs.manholes.unitCost)}/ea</td>
                      <td>{fmt(costs.manholes.cost)}</td>
                    </tr>
                    <tr>
                      <td>Detention Facility</td>
                      <td>Underground tank</td>
                      <td>{costs.detention.vol.toFixed(1)}</td>
                      <td>m³</td>
                      <td>{fmt(costs.detention.unitCost)}/m³</td>
                      <td>{fmt(costs.detention.cost)}</td>
                    </tr>
                    <tr>
                      <td>Sewer Connection</td>
                      <td>
                        {costs.connection.fromApi ? `To nearest pipe (API)` : `Estimated distance`}
                      </td>
                      <td>{costs.connection.len}</td>
                      <td>m</td>
                      <td>{fmt(costs.connection.unitCost)}/m</td>
                      <td>{fmt(costs.connection.cost)}</td>
                    </tr>
                    <tr>
                      <td>Excavation</td>
                      <td>
                        Trench {costs.excavation.depth.toFixed(1)}m &times;{' '}
                        {costs.excavation.width.toFixed(2)}m
                      </td>
                      <td>{costs.excavation.vol.toFixed(1)}</td>
                      <td>m³</td>
                      <td>{fmt(excUnit)}/m³</td>
                      <td>{fmt(costs.excavation.cost)}</td>
                    </tr>
                    <tr>
                      <td>Backfill</td>
                      <td>Granular bedding &amp; backfill</td>
                      <td>{costs.backfill.vol.toFixed(1)}</td>
                      <td>m³</td>
                      <td>{fmt(bfUnit)}/m³</td>
                      <td>{fmt(costs.backfill.cost)}</td>
                    </tr>

                    <tr className="cost-row-header">
                      <td colSpan={6}>Site Preparation</td>
                    </tr>
                    <tr>
                      <td>Grading</td>
                      <td>Strip, grade &amp; compact</td>
                      <td>{lot.toFixed(0)}</td>
                      <td>m²</td>
                      <td>{fmt(gradUnit)}/m²</td>
                      <td>{fmt(costs.sitePrep.grading.cost)}</td>
                    </tr>
                    <tr>
                      <td>Erosion Control</td>
                      <td>Silt fence &amp; sediment trap</td>
                      <td>{sitePerimeter.toFixed(0)}</td>
                      <td>m</td>
                      <td>{fmt(erosionUnit)}/m</td>
                      <td>{fmt(costs.sitePrep.erosion.cost)}</td>
                    </tr>

                    <tr className="cost-row-header">
                      <td colSpan={6}>Municipal Fees (Local authority)</td>
                    </tr>
                    <tr>
                      <td>Storm Connection</td>
                      <td>PBT stormwater tie-in</td>
                      <td>1</td>
                      <td>ls</td>
                      <td>-</td>
                      <td>{fmt(costs.fees.stormConn)}</td>
                    </tr>
                    <tr>
                      <td>Building Permit</td>
                      <td>Local authority</td>
                      <td>1</td>
                      <td>ls</td>
                      <td>-</td>
                      <td>{fmt(costs.fees.permit)}</td>
                    </tr>

                    {costs.lidTotal > 0 && (
                      <>
                        <tr className="cost-row-header">
                          <td colSpan={6}>Low Impact Development (LID)</td>
                        </tr>
                        {costs.lid.greenRoof.cost > 0 && (
                          <tr>
                            <td>Green Roof</td>
                            <td>Extensive sedum</td>
                            <td>{costs.lid.greenRoof.area.toFixed(0)}</td>
                            <td>m²</td>
                            <td>{fmt(grUnit)}/m²</td>
                            <td>{fmt(costs.lid.greenRoof.cost)}</td>
                          </tr>
                        )}
                        {costs.lid.rainGarden.cost > 0 && (
                          <tr>
                            <td>Rain Garden</td>
                            <td>Bioretention</td>
                            <td>{costs.lid.rainGarden.area.toFixed(0)}</td>
                            <td>m²</td>
                            <td>{fmt(rgUnit)}/m²</td>
                            <td>{fmt(costs.lid.rainGarden.cost)}</td>
                          </tr>
                        )}
                        {costs.lid.permPave.cost > 0 && (
                          <tr>
                            <td>Permeable Pave</td>
                            <td>Interlocking pavers</td>
                            <td>{costs.lid.permPave.area.toFixed(0)}</td>
                            <td>m²</td>
                            <td>{fmt(ppUnit)}/m²</td>
                            <td>{fmt(costs.lid.permPave.cost)}</td>
                          </tr>
                        )}
                        {costs.lid.bioswale.cost > 0 && (
                          <tr>
                            <td>Bio-swale</td>
                            <td>Vegetated channel</td>
                            <td>{costs.lid.bioswale.len.toFixed(0)}</td>
                            <td>m</td>
                            <td>{fmt(bsUnit)}/m</td>
                            <td>{fmt(costs.lid.bioswale.cost)}</td>
                          </tr>
                        )}
                      </>
                    )}

                    <tr className="cost-row-header">
                      <td colSpan={6}>Professional Services &amp; Contingency</td>
                    </tr>
                    <tr>
                      <td>Engineering</td>
                      <td>Design, permitting, inspection</td>
                      <td>15</td>
                      <td>%</td>
                      <td>-</td>
                      <td>{fmt(costs.engineering)}</td>
                    </tr>
                    <tr>
                      <td>Contingency</td>
                      <td>Unforeseen conditions</td>
                      <td>10</td>
                      <td>%</td>
                      <td>-</td>
                      <td>{fmt(costs.contingency)}</td>
                    </tr>
                    <tr className="cost-row-total">
                      <td colSpan={5}>GRAND TOTAL</td>
                      <td>{fmt(costs.grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Charts */}
              <div className="sim-chart-card">
                <h4>Cost Breakdown by Item</h4>
                <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 22)}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--tt-border)" />
                    <XAxis
                      type="number"
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 9, fill: 'var(--tt-muted)' }}
                      tickFormatter={(v) => `RM ${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="var(--tt-muted)"
                      tick={{ fontSize: 10, fill: 'var(--tt-muted)' }}
                      width={95}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number | undefined) => [fmt(v ?? 0)]}
                    />
                    <Bar dataKey="cost" fill="var(--tt-accent)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="sim-chart-card">
                <h4>Cost Distribution by Category</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                      }
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v: number | undefined) => [fmt(v ?? 0)]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="sim-chart-card">
                <h4>Material references (MYR/m; installation excluded)</h4>
                <p className="dc-note">
                  <a
                    href="https://buildingmaterials.com.my/products/details/300mm-x-6m-hdpe-corrugated-sewer-pipe-double-wall-80619"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Kow Hock: 300 mm × 6 m HDPE double-wall pipe, RM420/piece
                  </a>
                  . Observed 18 Oct 2026. Verify stock, specification and delivered quote.
                </p>
                <p className="dc-note">
                  <a
                    href="https://buildingmaterials.com.my/products/details/1200mm-x-600mm-x-1m-u-drain-wo-dwf-65383"
                    target="_blank"
                    rel="noreferrer"
                  >
                    1200 × 600 × 1000 mm U-drain: RM210/piece (1 m)
                  </a>
                  . Open-drain product; not substituted for a circular pipe in the estimate.
                </p>
                <table className="cost-table cost-ref-table">
                  <thead>
                    <tr>
                      <th>Diameter</th>
                      <th>PVC</th>
                      <th>HDPE</th>
                      <th>Concrete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PIPE_CATALOGUE.map((p) => (
                      <tr
                        key={p.dia_mm}
                        className={calc && p.dia_mm === calc.pipe_mm ? 'cost-row-active' : ''}
                      >
                        <td>{p.dia_mm} mm</td>
                        <td>{p.pvc > 0 ? fmt(p.pvc) : '-'}</td>
                        <td>{p.hdpe > 0 ? fmt(p.hdpe) : '-'}</td>
                        <td>{p.concrete > 0 ? fmt(p.concrete) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="dc-note" style={{ marginTop: 8 }}>
                  Highlighted: {calc?.pipe_mm} mm required for {returnPeriod}-yr storm. Only HDPE
                  300 mm has a sourced material-only rate (RM420 / 6 m = RM70/m). Other rates
                  require supplier quotes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
