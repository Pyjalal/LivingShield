import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Geometry, Position } from 'geojson';
import {
  TOWNSHIPS,
  calculateTownshipScenario,
  type Township,
  type TownshipDataset,
  type TownshipFeature,
} from './model';
import { geometryAreaM2, unprojectPosition } from './geometry';
import TownshipScene, { type MapFeature } from './scene';
import { PILOT_EVIDENCE } from './evidence';
import { ARIS, DESIGN_STATIONS, intensity, MSMA_URL } from '../malaysia/design';
import { download } from '../malaysia/sites';
import { chooseSite } from '../malaysia/property';
import { updateSettings } from '../malaysia/settings';
import NationalSiteContext from '../components/NationalSiteContext';
import AerialReference from './AerialReference';
import { sanitizeProposals, SOLUTIONS, type Proposal } from './planning';
import FloodLab from './flood/FloodLab';
import type { FloodDisplayFrame, FloodTerrainAsset } from './flood/display';
import './township.css';
import type { FloodEvidence } from '../platform/evidence';
import { usePresentationMode } from '../platform/usePresentationMode';
import '../platform/presentation.css';

const fmt = (n: number) => n.toLocaleString('en-MY', { maximumFractionDigits: 0 });
const featureName = (feature: TownshipFeature | MapFeature) =>
  String(
    feature.properties.name ||
      `${feature.properties.dataSource ? 'ML' : 'OSM'} footprint ${feature.properties.osmId ?? String(feature.properties.id).split(':').at(-1)?.slice(0, 8)}`,
  );
function pointFor(geometry: Geometry): [number, number] {
  const positions: Position[] = [];
  const collect = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (typeof coordinates[0] === 'number') positions.push(coordinates as Position);
    else coordinates.forEach(collect);
  };
  if ('coordinates' in geometry) collect(geometry.coordinates);
  return [
    (Math.min(...positions.map((p) => p[0])) + Math.max(...positions.map((p) => p[0]))) / 2,
    (Math.min(...positions.map((p) => p[1])) + Math.max(...positions.map((p) => p[1]))) / 2,
  ];
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="tt-scene-message" role="status">
        <h3>3D rendering is unavailable on this device.</h3>
        <p>
          You can still inspect mapped buildings, compare scenarios and export a plan using the
          controls.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
function savedProposals(id: string): Proposal[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(`tamantahan-plan-${id}`) ?? '[]');
    return sanitizeProposals(saved);
  } catch {
    return [];
  }
}
type TownshipUiTheme = 'terminal' | 'dark' | 'accessible';

export default function TownshipView({
  onEngineering,
  uiTheme,
  townshipId,
  onTownshipChange,
  onRiverLab,
  onFloodResult,
  initialFlood,
}: {
  onEngineering: () => void;
  uiTheme: TownshipUiTheme;
  townshipId?: string;
  onTownshipChange?: (id: string) => void;
  onRiverLab?: (id: string) => void;
  onFloodResult?: (evidence: FloodEvidence) => void;
  initialFlood?: FloodEvidence | null;
}) {
  const [localId, setLocalId] = useState(TOWNSHIPS[0].id);
  const [presenting, setPresenting] = usePresentationMode('.tt-presentation-toggle');
  const id = townshipId ?? localId;
  const township = TOWNSHIPS.find((t) => t.id === id)!;
  function changePresentation(value: boolean) {
    setPresenting(value);
    if (value)
      requestAnimationFrame(() => {
        const workspace = document.querySelector<HTMLElement>('.tt-workspace');
        workspace?.scrollTo({ top: 0 });
        workspace?.querySelector<HTMLElement>('.tt-model-panel')?.scrollTo({ top: 0 });
      });
  }
  return (
    <section
      className={`tt-workspace${presenting ? ' tt-presenting' : ''}`}
      aria-label="LivingShield township resilience planner"
    >
      <header className="tt-heading">
        <div>
          <p className="tt-eyebrow">TOWNSHIP OF TOMORROW / PLANET</p>
          <h1>Make room for water.</h1>
          <p>Explore a real township. Test a storm. Plan the next intervention.</p>
        </div>
        <div className="tt-pilot-picker">
          <label htmlFor="tt-township">Sime Darby township pilot</label>
          <select
            id="tt-township"
            value={id}
            onChange={(e) => {
              setLocalId(e.target.value as typeof localId);
              onTownshipChange?.(e.target.value);
            }}
          >
            {TOWNSHIPS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span>3 mapped pilot windows · Malaysia-wide tools available above</span>
          {onRiverLab && (
            <button className="tt-primary" onClick={() => onRiverLab(id)}>
              Design a LivingShield bank ↗
            </button>
          )}
        </div>
      </header>
      <PilotWorkspace
        key={id}
        township={township}
        onEngineering={onEngineering}
        uiTheme={uiTheme}
        onFloodResult={onFloodResult}
        initialFlood={initialFlood}
        presenting={presenting}
        onPresentationChange={changePresentation}
      />
    </section>
  );
}
function PilotWorkspace({
  township,
  onEngineering,
  uiTheme,
  onFloodResult,
  initialFlood,
  presenting,
  onPresentationChange,
}: {
  township: Township;
  onEngineering: () => void;
  uiTheme: TownshipUiTheme;
  onFloodResult?: (evidence: FloodEvidence) => void;
  initialFlood?: FloodEvidence | null;
  presenting: boolean;
  onPresentationChange: (presenting: boolean) => void;
}) {
  const [data, setData] = useState<TownshipDataset | null>(null);
  const [supplementMetadata, setSupplementMetadata] = useState<Record<string, unknown> | null>(
    null,
  );
  const [coverageNotice, setCoverageNotice] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<MapFeature | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>(() => savedProposals(township.id));
  const [tool, setTool] = useState<Proposal['type'] | null>(null);
  const [compare, setCompare] = useState<'before' | 'after'>('after');
  const [reset, setReset] = useState(0);
  const [heightScale, setHeightScale] = useState(1);
  const [topDown, setTopDown] = useState(false);
  const [aerialCheck, setAerialCheck] = useState(false);
  const [floodOpen, setFloodOpen] = useState(true);
  const [floodTerrain, setFloodTerrain] = useState<FloodTerrainAsset | null>(null);
  const [floodFrame, setFloodFrame] = useState<FloodDisplayFrame | null>(null);
  const frameStats = useMemo(
    () =>
      floodFrame && floodTerrain
        ? {
            wetHa:
              (floodFrame.depthsM.filter((depth) => depth >= 0.1).length *
                floodTerrain.dxM * floodTerrain.dzM) / 10000,
            maxM: Math.max(0, ...floodFrame.depthsM),
          }
        : null,
    [floodFrame, floodTerrain],
  );
  function jumpToStorm() {
    setFloodOpen(true);
    requestAnimationFrame(() => {
      const button = document.querySelector<HTMLButtonElement>('.tt-flood-run');
      button?.scrollIntoView({ block: 'center' });
      button?.focus({ preventScroll: true });
    });
  }
  const [rainMode, setRainMode] = useState<'idf' | 'manual'>(
    initialFlood?.rainfallSource.mode === 'manual' ? 'manual' : 'idf',
  );
  const [manualRain, setManualRain] = useState(initialFlood?.input.rainfallMm ?? 120);
  const [ari, setAri] = useState(
    typeof initialFlood?.rainfallSource.returnPeriodYears === 'number'
      ? initialFlood.rainfallSource.returnPeriodYears
      : 20,
  );
  const [duration, setDuration] = useState(initialFlood?.input.durationMinutes ?? 60);
  const [areaHa, setAreaHa] = useState(25);
  const [coefficient, setCoefficient] = useState(initialFlood?.input.runoffCoefficient ?? 0.7);
  const [stationId, setStationId] = useState(() => {
    const sourceStation = initialFlood?.rainfallSource.station;
    const id =
      sourceStation && typeof sourceStation === 'object' && 'id' in sourceStation
        ? sourceStation.id
        : null;
    return (
      DESIGN_STATIONS.find((station) => station.id === id)?.id ??
      (township.id === 'pagoh' ? '2231001' : '3314001')
    );
  });
  const [showEvidence, setShowEvidence] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [notice, setNotice] = useState('');
  const evidence = PILOT_EVIDENCE[township.id];
  const station = DESIGN_STATIONS.find((s) => s.id === stationId)!;
  const rainfallMm =
    rainMode === 'idf' ? (intensity(station, duration, ari) * duration) / 60 : manualRain;
  const capacity = proposals.reduce((sum, p) => sum + SOLUTIONS[p.type].capacity, 0);
  const scenario = calculateTownshipScenario({
    rainfallMm,
    surfaceAreaM2: areaHa * 10000,
    runoffCoefficient: coefficient,
    retentionCapacityM3: compare === 'after' ? capacity : 0,
  });
  const baseline = scenario.runoffM3;
  const buildings = useMemo(
    () => data?.features.filter((f) => f.properties.kind === 'building') ?? [],
    [data],
  );
  const selectedPoint = selected ? pointFor(selected.geometry) : null;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(township.dataUrl, { signal: controller.signal }),
      fetch(`/data/townships/${township.id}-supplement.geojson`, {
        signal: controller.signal,
      }).catch(() => null),
    ])
      .then(async ([response, supplementResponse]) => {
        if (!response.ok) throw new Error('The cached township map could not be loaded.');
        const value = (await response.json()) as TownshipDataset;
        if (value.type !== 'FeatureCollection' || !Array.isArray(value.features) || !value.metadata)
          throw new Error('Township dataset is incomplete.');
        let supplement: { features: TownshipFeature[]; metadata: Record<string, unknown> } | null =
          null;
        if (supplementResponse?.ok) {
          try {
            const parsed = await supplementResponse.json();
            if (
              parsed.type === 'FeatureCollection' &&
              Array.isArray(parsed.features) &&
              parsed.metadata
            )
              supplement = parsed;
          } catch {
            supplement = null;
          }
        }
        if (!controller.signal.aborted) {
          setData({ ...value, features: [...value.features, ...(supplement?.features ?? [])] });
          setSupplementMetadata(supplement?.metadata ?? null);
          setCoverageNotice(
            supplement
              ? ''
              : 'Microsoft footprint supplement unavailable. Showing the less complete OSM inventory.',
          );
          setError('');
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load township.');
      });
    return () => controller.abort();
  }, [township, revision]);
  useEffect(() => {
    try {
      localStorage.setItem(`tamantahan-plan-${township.id}`, JSON.stringify(proposals));
    } catch {
      console.info('Browser storage unavailable. Export a plan to keep it.');
    }
  }, [proposals, township.id]);
  function addProposal(x: number, z: number) {
    if (!tool || proposals.length >= 30 || Math.abs(x) > 750 || Math.abs(z) > 750) return;
    const next: Proposal = { id: Date.now(), type: tool, x, z };
    setProposals((previous) => [...previous, next]);
    setCompare('after');
    setNotice(`${SOLUTIONS[tool].name} added. Concept location; suitability requires survey.`);
    setTool(null);
  }
  function exportPlan() {
    download(`LivingShield-${township.id}-plan.json`, {
      project: 'LivingShield',
      exportedAt: new Date().toISOString(),
      township,
      mapSource: data?.metadata,
      supplementalSource: supplementMetadata,
      evidence,
      storm: {
        mode: rainMode,
        rainfallMm,
        ...(rainMode === 'idf'
          ? {
              durationMinutes: duration,
              returnPeriodYears: ari,
              station,
              selectionBasis:
                'Regional demonstration proxy selected by analyst; site applicability unverified.',
            }
          : {}),
      },
      catchment: {
        areaHa,
        runoffCoefficient: coefficient,
        basis:
          'User-assumed planning catchment; not delineated from terrain or equal to the displayed map extent.',
      },
      proposals: proposals.map((p) => ({
        ...p,
        location: unprojectPosition([p.x, p.z], township.centre),
        ...SOLUTIONS[p.type],
        status: 'Hypothetical location and active storage; not an existing or approved asset.',
      })),
      comparison: {
        baselineRunoffM3: baseline,
        withProposals: calculateTownshipScenario({
          rainfallMm,
          surfaceAreaM2: areaHa * 10000,
          runoffCoefficient: coefficient,
          retentionCapacityM3: capacity,
        }),
      },
      assumptions: [
        'V = rainfall(mm) × area(m²) × C / 1000. Storage capture = min(V, proposed active capacity).',
        'Empty storage initially; ideal capture of catchment runoff. No routing, infiltration, outlet hydrograph or existing storage deducted.',
        'Screening water budget only. Does not predict flood depths, inundated buildings, safety, avoided damage or prevented floods.',
        'OSM coverage incomplete. Ground uses the coarse Copernicus surface model when available; building heights are tagged or labelled visual assumptions.',
      ],
      attribution: {
        base: 'Adapted hydrology software, MIT; original notices retained in the project source.',
        threeDBase:
          'Adapted township rendering engine; original credits, revision and permissions are recorded in the project source notices.',
      },
    });
    setNotice('Plan exported with coordinates, calculations, assumptions and source provenance.');
  }
  function openEngineering() {
    chooseSite({
      accountNumber: '',
      address: `${township.name} · assumed planning catchment`,
      lat: township.centre[1],
      lng: township.centre[0],
      lotSize: String(areaHa * 10000),
      totalGrossArea: '',
      zoning: '',
      yearBuilt: '',
      neighbourhood: township.name,
      garage: false,
      legalDescription: 'Hypothetical catchment for preliminary drainage analysis',
      ward: township.state,
      source: township.source.anchorUrl,
      sourceLabel: 'LivingShield user-defined scenario',
      areaBasis: 'User-assumed catchment area, not an official property parcel',
    });
    updateSettings({
      region: township.state === 'Johor' ? 'Johor' : 'Klang / Selangor',
      stationId,
    });
    onEngineering();
  }
  return (
    <div className="tt-layout">
      <aside className="tt-planner">
        <div className="tt-step">
          <span>01</span>
          <h2>Set the storm</h2>
          <span className="tt-tag">SCENARIO</span>
        </div>
        <div className="tt-segment" aria-label="Rainfall input">
          <button aria-pressed={rainMode === 'idf'} onClick={() => setRainMode('idf')}>
            MSMA design
          </button>
          <button aria-pressed={rainMode === 'manual'} onClick={() => setRainMode('manual')}>
            Custom rain
          </button>
        </div>
        {rainMode === 'idf' ? (
          <>
            <label className="tt-field">
              Regional profile · unverified site proxy
              <select
                aria-label="Regional rainfall profile"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
              >
                {DESIGN_STATIONS.filter(
                  (s) => s.family === 'msma' && s.state === township.state,
                ).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="tt-pair">
              <label className="tt-field">
                Return period
                <select
                  aria-label="Storm return period"
                  value={ari}
                  onChange={(e) => setAri(Number(e.target.value))}
                >
                  {ARIS.map((a) => (
                    <option key={a} value={a}>
                      {a} years
                    </option>
                  ))}
                </select>
              </label>
              <label className="tt-field">
                Duration
                <select
                  aria-label="Storm duration"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {[15, 30, 60, 120, 180, 360, 720, 1440].map((d) => (
                    <option key={d} value={d}>
                      {d < 60 ? `${d} min` : `${d / 60} h`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : (
          <label className="tt-field">
            Rainfall total · {manualRain} mm
            <input
              aria-label="Rainfall total"
              type="range"
              min="0"
              max="400"
              step="5"
              value={manualRain}
              onChange={(e) => setManualRain(Number(e.target.value))}
            />
          </label>
        )}
        <div className="tt-rain-total">
          <strong>
            {rainfallMm.toFixed(1)}
            <small> mm</small>
          </strong>
          <span>rainfall over the scenario</span>
        </div>
        <details className="tt-assumptions">
          <summary>Catchment assumptions</summary>
          {!floodOpen && (
            <label className="tt-field">
              Planning area · {areaHa} ha
              <input
                aria-label="Planning area in hectares"
                type="range"
                min="1"
                max="100"
                step="1"
                value={areaHa}
                onChange={(e) => setAreaHa(Number(e.target.value))}
              />
            </label>
          )}
          <label className="tt-field">
            Runoff coefficient · {coefficient.toFixed(2)}
            <input
              aria-label="Runoff coefficient"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={coefficient}
              onChange={(e) => setCoefficient(Number(e.target.value))}
            />
          </label>
          <p>
            {floodOpen
              ? 'The flood simulation uses the full 225 ha elevation grid. '
              : `Assumed ${areaHa} ha catchment for the water budget. `}
            No surveyed drainage connectivity.{' '}
            <a href={`${MSMA_URL}#page=${station.page}`} target="_blank" rel="noreferrer">
              MSMA rainfall coefficients ↗
            </a>
          </p>
        </details>
        <div className="tt-step">
          <span>02</span>
          <h2>Make room for water</h2>
        </div>
        <p className="tt-muted">Choose a concept, then click the model to place it.</p>
        <div className="tt-solutions">
          {(
            Object.entries(SOLUTIONS) as [Proposal['type'], (typeof SOLUTIONS)[Proposal['type']]][]
          ).map(([key, solution]) => (
            <button
              key={key}
              aria-pressed={tool === key}
              disabled={proposals.length >= 30}
              onClick={() => setTool(tool === key ? null : key)}
            >
              <span className={`tt-solution-icon tt-${key}`}>
                {key === 'garden' ? '↟' : key === 'basin' ? '≋' : '▤'}
              </span>
              <span>
                <strong>
                  {floodOpen && key === 'tanks' ? 'Surface-connected tank cluster' : solution.name}
                </strong>
                <small>
                  {floodOpen && key === 'tanks'
                    ? '100 tanks × 3 m³ · inlet or pump assumed'
                    : solution.description}
                </small>
              </span>
              <b>
                +{fmt(solution.capacity)}
                <small> m³</small>
              </b>
            </button>
          ))}
        </div>
        {tool && (
          <div className="tt-placement" role="status">
            <p>Place {SOLUTIONS[tool].name.toLowerCase()} on the model.</p>
            <button onClick={() => addProposal(0, 0)}>Add at map centre</button>
            <button onClick={() => setTool(null)}>Cancel</button>
          </div>
        )}
        <div className="tt-plan-list">
          <span>
            {proposals.length} concept{proposals.length === 1 ? '' : 's'} · {fmt(capacity)} m³
            active capacity
          </span>
          {proposals.length > 0 && (
            <button
              onClick={() => {
                setProposals([]);
                setNotice('All proposed concepts cleared.');
              }}
            >
              Clear plan
            </button>
          )}
          {proposals.map((p, i) => (
            <div key={p.id}>
              <span>
                {i + 1}. {SOLUTIONS[p.type].name}
              </span>
              <button
                aria-label={`Remove concept ${i + 1}`}
                onClick={() => setProposals((previous) => previous.filter((q) => q.id !== p.id))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <p className="tt-small">
          Concept locations and capacities are hypothetical.{' '}
          {floodOpen
            ? 'Storage starts empty; capture is limited by nearby water and assumed inlet rates. '
            : 'Empty storage and ideal capture assumed. '}
          Survey, land access and drainage design remain necessary.
        </p>
        <button className="tt-primary" onClick={exportPlan} disabled={!data}>
          Export water budget & sources <span>↗</span>
        </button>
        <button className="tt-text-button" onClick={openEngineering}>
          Continue in drainage design →
        </button>
        <p className="tt-notice" role="status">
          {notice}
        </p>
      </aside>
      <main className="tt-model-panel">
        <div className="tt-model-toolbar">
          <div>
            <span className="tt-live-dot" />
            {township.name}
            <small>{township.state} · 1.5 km pilot window</small>
          </div>
          <button
            className="tt-simulation-toggle"
            aria-pressed={floodOpen}
            onClick={() => setFloodOpen((value) => !value)}
          >
            Flood simulation
          </button>
          <button className="tt-jump-storm" onClick={jumpToStorm}>
            Storm controls ↓
          </button>
          <button
            className="tt-presentation-toggle"
            aria-pressed={presenting}
            onClick={() => onPresentationChange(!presenting)}
          >
            {presenting ? 'Exit present view' : 'Present view'}
          </button>
          <button aria-pressed={aerialCheck} onClick={() => setAerialCheck((value) => !value)}>
            Aerial check
          </button>
          <button onClick={() => setReset((n) => n + 1)}>Reset view</button>
          <button aria-pressed={topDown} onClick={() => setTopDown((value) => !value)}>
            Plan view
          </button>
          <button
            aria-pressed={heightScale === 2}
            onClick={() => setHeightScale(heightScale === 2 ? 1 : 2)}
          >
            Height ×{heightScale}
          </button>
        </div>
        <div
          className={`tt-model ${aerialCheck ? 'tt-aerial-check' : ''} ${tool ? 'tt-placing' : ''}`}
        >
          {error ? (
            <div className="tt-scene-message" role="alert">
              <h3>Township map unavailable</h3>
              <p>{error}</p>
              <button onClick={() => setRevision((n) => n + 1)}>Retry map</button>
            </div>
          ) : data ? (
            <SceneBoundary>
              <TownshipScene
                data={data as unknown as Parameters<typeof TownshipScene>[0]['data']}
                township={township}
                uiTheme={uiTheme}
                selected={selected}
                onSelect={(feature) => {
                  setSelected(feature);
                  setShowContext(false);
                }}
                proposals={
                  floodOpen
                    ? floodFrame?.mode === 'before'
                      ? []
                      : proposals
                    : compare === 'after'
                      ? proposals
                      : []
                }
                onPlace={tool ? addProposal : null}
                onRemove={(id) => setProposals((p) => p.filter((q) => q.id !== id))}
                reset={reset}
                heightScale={heightScale}
                topDown={topDown}
                terrain={floodTerrain}
                flood={floodOpen ? floodFrame : null}
              />
            </SceneBoundary>
          ) : (
            <div className="tt-scene-message" role="status">
              <span className="tt-loader" />
              <p>Building the township from sourced map footprints…</p>
            </div>
          )}
          <div className="tt-map-label">
            <span>
              {floodFrame && floodOpen
                ? 'SIMULATED SURFACE WATER / METRES'
                : 'SOURCED FOOTPRINTS / CONCEPT PLAN'}
            </span>
            <h2>
              {floodFrame && floodOpen
                ? `${floodFrame.mode === 'before' ? 'Before mitigation.' : 'After mitigation.'}\n${(floodFrame.timeSeconds / 60).toFixed(0)} minutes into the event.`
                : compare === 'after' && proposals.length > 0
                  ? 'A little more room\nfor the next storm.'
                  : 'Mapped streets.\nReal places.'}
            </h2>
            {floodOpen && frameStats && (
              <div className="tt-frame-readout" aria-label="Selected flood frame metrics">
                <span>
                  Wet area ≥0.10 m
                  <strong>{frameStats.wetHa.toFixed(1)} ha</strong>
                </span>
                <span>
                  Max grid depth
                  <strong>{frameStats.maxM.toFixed(2)} m</strong>
                </span>
              </div>
            )}
          </div>
          {aerialCheck && data && <AerialReference township={township} data={data} />}
          {floodOpen && floodFrame ? (
            <div
              className="tt-scene-legend tt-depth-legend"
              aria-label="Simulated water depth in metres"
            >
              <span>Depth (m)</span>
              {[
                ['#b1eced', '≤0.05'],
                ['#77cedf', '≤0.15'],
                ['#38acce', '≤0.30'],
                ['#1780b6', '≤0.60'],
                ['#235d9b', '≤1'],
                ['#263f83', '≤2'],
                ['#382c68', '>2'],
              ].map(([color, label]) => (
                <span key={label}>
                  <i style={{ background: color }} />
                  {label}
                </span>
              ))}
              <span>Below 0.02 m hidden</span>
            </div>
          ) : (
            <div className="tt-scene-legend">
              <span>
                <i style={{ background: '#e7ddc7' }} />
                Mapped footprint
              </span>
              <span>
                <i style={{ background: '#4da9b2' }} />
                Mapped water
              </span>
              <span>
                <i style={{ background: '#819e78' }} />
                Green area
              </span>
              <span>
                <i style={{ background: '#ffc16e' }} />
                Concept marker
              </span>
            </div>
          )}
          {selected && selectedPoint && (
            <section className="tt-inspector" aria-label="Mapped feature inspector">
              <button
                className="tt-close"
                aria-label="Close feature inspector"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
              <p className="tt-eyebrow">MAPPED {String(selected.properties.kind)}</p>
              <h3>{featureName(selected)}</h3>
              <p>
                {selectedPoint[1].toFixed(5)}° N, {selectedPoint[0].toFixed(5)}° E
              </p>
              {selected.geometry.type === 'Polygon' || selected.geometry.type === 'MultiPolygon' ? (
                <p>{fmt(geometryAreaM2(selected.geometry, township.centre))} m² mapped footprint</p>
              ) : null}
              {selected.properties.kind === 'building' && (
                <p>
                  Display height: {String(selected.properties.heightMetres)} m ·{' '}
                  {String(selected.properties.heightSource)}
                  {selected.properties.heightAssumption ? (
                    <small>{String(selected.properties.heightAssumption)}</small>
                  ) : null}
                </p>
              )}
              <a
                href={
                  selected.properties.dataSource
                    ? 'https://github.com/microsoft/GlobalMLBuildingFootprints'
                    : String(selected.properties.sourceUrl)
                }
                target="_blank"
                rel="noreferrer"
              >
                {selected.properties.dataSource
                  ? 'Microsoft footprint source ↗'
                  : 'Inspect original OSM record ↗'}
              </a>
              {Boolean(selected.properties.dataSource) && (
                <p>
                  Machine-extracted footprint · catalogue{' '}
                  {String(selected.properties.providerUploadDate)}. Underlying imagery date is
                  unknown; geometry may be incomplete or inaccurate.
                </p>
              )}
              <p className="tt-small">
                No surveyed ground levels or parcel boundaries. A mapped building is not evidence of
                flood exposure.
              </p>
              <button className="tt-primary" onClick={() => setShowContext((v) => !v)}>
                {showContext ? 'Hide national site data' : 'Check modelled flood & terrain'}
              </button>
              {showContext && (
                <NationalSiteContext
                  key={String(selected.properties.id)}
                  lat={selectedPoint[1]}
                  lng={selectedPoint[0]}
                />
              )}
            </section>
          )}
          <div className="tt-camera-help">
            Drag to orbit · scroll to zoom · right-drag to pan · click to inspect
          </div>
        </div>
        {floodOpen ? (
          <FloodLab
            township={township}
            rainfallMm={rainfallMm}
            durationMinutes={duration}
            runoffCoefficient={coefficient}
            rainfallSource={{
              mode: rainMode,
              rainfallMm,
              durationMinutes: duration,
              ...(rainMode === 'idf'
                ? {
                    station,
                    returnPeriodYears: ari,
                    sourceUrl: `${MSMA_URL}#page=${station.page}`,
                    selectionBasis: 'Regional demonstration proxy; site applicability unverified.',
                  }
                : { selectionBasis: 'User-entered uniform rainfall scenario.' }),
            }}
            proposals={proposals}
            onDuration={setDuration}
            onProposals={setProposals}
            onTerrain={setFloodTerrain}
            onFrame={setFloodFrame}
            onResult={onFloodResult}
            initialRun={initialFlood}
          />
        ) : (
          <div className="tt-results">
            <div className="tt-results-head">
              <div>
                <p className="tt-eyebrow">03 / COMPARE THE WATER BUDGET</p>
                <h2>Same storm. More storage.</h2>
              </div>
              <div className="tt-segment">
                <button aria-pressed={compare === 'before'} onClick={() => setCompare('before')}>
                  Baseline
                </button>
                <button aria-pressed={compare === 'after'} onClick={() => setCompare('after')}>
                  With concepts
                </button>
              </div>
            </div>
            <div className="tt-metrics">
              <div>
                <span>Baseline runoff</span>
                <strong>
                  {fmt(baseline)}
                  <small> m³</small>
                </strong>
                <p>
                  Rain × {areaHa} ha × C {coefficient.toFixed(2)}
                </p>
              </div>
              <div>
                <span>Runoff held in concept storage</span>
                <strong className="tt-teal">
                  {fmt(scenario.retainedM3)}
                  <small> m³</small>
                </strong>
                <p>{scenario.retainedPercent.toFixed(1)}% of scenario runoff volume</p>
              </div>
              <div>
                <span>Runoff remaining to manage</span>
                <strong>
                  {fmt(scenario.residualM3)}
                  <small> m³</small>
                </strong>
                <p>Requires drainage and discharge checks</p>
              </div>
            </div>
            <div
              className="tt-budget-bar"
              role="img"
              aria-label={`${scenario.retainedPercent.toFixed(1)} percent of runoff held in concept storage`}
            >
              <span style={{ width: `${scenario.retainedPercent}%` }} />
            </div>
            <p className="tt-small">
              Preliminary volume screen with ideal capture. This does not predict inundation,
              flood-depth reduction or avoided losses. Existing drainage and storage are not
              modelled.
            </p>
          </div>
        )}
        <div className="tt-data-footer">
          <p>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © OpenStreetMap contributors · ODbL
            </a>{' '}
            {supplementMetadata && (
              <>
                {' '}
                ·{' '}
                <a
                  href="https://github.com/microsoft/GlobalMLBuildingFootprints"
                  target="_blank"
                  rel="noreferrer"
                >
                  Microsoft building footprints · CDLA-Permissive 2.0
                </a>
              </>
            )}
            {data && (
              <>
                {' '}
                · {fmt(buildings.length)} building footprints · retrieved{' '}
                {new Date(data.metadata.retrievedAt).toLocaleDateString('en-MY')}
              </>
            )}
          </p>
          <button onClick={() => setShowEvidence((v) => !v)} aria-expanded={showEvidence}>
            Evidence & model notes {showEvidence ? '−' : '+'}
          </button>
        </div>
        {coverageNotice && (
          <p className="tt-coverage-note" role="status">
            {coverageNotice}
          </p>
        )}
        {township.id === 'elmina' && (
          <p className="tt-coverage-note">
            Visual check: southwest mapped housing differs from the available aerial imagery. Source
            dates are not aligned; present-day completion is unverified.
          </p>
        )}
        <div className="tt-accessible-pick">
          <label htmlFor="tt-building">Inspect a mapped building</label>
          <select
            id="tt-building"
            value={String(selected?.properties.id ?? '')}
            onChange={(e) => {
              const feature = buildings.find((f) => f.properties.id === e.target.value);
              if (feature) {
                setSelected(feature as unknown as MapFeature);
                setShowContext(false);
              }
            }}
          >
            <option value="">Choose a sourced footprint…</option>
            {buildings.map((f) => (
              <option key={f.properties.id} value={f.properties.id}>
                {featureName(f)}
              </option>
            ))}
          </select>
        </div>
        {showEvidence && (
          <section className="tt-evidence">
            <h3>{evidence.label}</h3>
            <p>{evidence.text}</p>
            <a href={evidence.url} target="_blank" rel="noreferrer">
              {evidence.source} ↗
            </a>
            <h3>What the model represents</h3>
            <p>
              {township.extentDescription} OSM and supplementary Microsoft machine-extracted
              footprints may miss buildings or contain outdated or false detections. Counts describe
              footprints, not individual homes. Conservative overlap removal retains OSM geometry
              where sources intersect. Missing building heights use a labelled 6 m assumption;
              mapped storeys use 3 m per level. Most heights are estimated, not measured. Height
              display defaults to true scale and can be exaggerated ×2. Roof colours are sampled
              from aerial imagery when available; facade details are illustrative. Roads are
              schematic ribbons, not surveyed widths. Copernicus surface elevations supply terrain
              when loaded; they include vegetation and structures and do not resolve local drainage
              or floor levels. This remains an uncalibrated screening model.
            </p>
            <p>
              Storage screen: V = rainfall × area × C / 1000. Capture is limited to the smaller of
              runoff and concept capacity. No infiltration, flow routing, outlet timing, existing
              storage or compound flooding is simulated by that volume screen. The separate 2D flood
              mode routes runoff across terrain and applies local rate- and capacity-limited concept
              storage. JRC river-flood values are a separate approximately 90 m global model with
              quality flags; they do not simulate these interventions.
            </p>
            <p>
              Independent hackathon concept. Based on{' '}
              <a href="https://github.com/Sadat41/HydroGrid" target="_blank" rel="noreferrer">
                hydrology software (MIT)
              </a>
              ; adapted 3D engine credits are recorded in the source notices. No
              Sime Darby affiliation or endorsement is implied.
            </p>
            <a href={township.source.anchorUrl} target="_blank" rel="noreferrer">
              Pilot location anchor ↗
            </a>
          </section>
        )}
      </main>
    </div>
  );
}
