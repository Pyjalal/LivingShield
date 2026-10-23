import { useEffect, useMemo, useRef, useState } from 'react';
import type { Township } from '../model';
import { SOLUTIONS, type Proposal } from '../planning';
import { download } from '../../malaysia/sites';
import type {
  FloodComparisonResult,
  FloodFrame,
  FloodSimulationInput,
  FloodWorkerResponse,
} from './model';
import type { FloodDisplayFrame, FloodTerrainAsset } from './display';
import './flood.css';
import type { FloodEvidence } from '../../platform/evidence';
import FloodInsights from './FloodInsights';

const fmt = (value: number, digits = 0) =>
  value.toLocaleString('en-MY', { maximumFractionDigits: digits });
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
const INLETS = { garden: 0.03, basin: 0.5, tanks: 0.08 };
interface Run {
  key: string;
  input: FloodSimulationInput;
  rainfallSource: Record<string, unknown>;
  comparison: FloodComparisonResult;
}
function depthStats(frame: FloodFrame, area: number) {
  return {
    max: Math.max(...frame.depthsM),
    wetHa: (frame.depthsM.filter((depth) => depth >= 0.1).length * area) / 10000,
  };
}
function demoConcepts(terrain: FloodTerrainAsset, depths: number[]): Proposal[] {
  const selected: number[] = [];
  const ordered = depths
    .map((depth, index) => ({ depth, index }))
    .filter((cell) => cell.depth > 0.05)
    .sort((a, b) => b.depth - a.depth);
  for (const cell of ordered) {
    const row = Math.floor(cell.index / terrain.cols),
      col = cell.index % terrain.cols;
    if (
      selected.some(
        (other) =>
          Math.hypot(Math.floor(other / terrain.cols) - row, (other % terrain.cols) - col) < 2,
      )
    )
      continue;
    selected.push(cell.index);
    if (selected.length === 12) break;
  }
  return selected.map((index, order) => ({
    id: Date.now() + order,
    type: 'basin',
    x: terrain.originX + ((index % terrain.cols) + 0.5) * terrain.dxM,
    z: terrain.originZ + (Math.floor(index / terrain.cols) + 0.5) * terrain.dzM,
  }));
}
export default function FloodLab({
  township,
  rainfallMm,
  durationMinutes,
  runoffCoefficient,
  rainfallSource,
  proposals,
  onDuration,
  onProposals,
  onTerrain,
  onFrame,
  onResult,
  initialRun,
}: {
  township: Township;
  rainfallMm: number;
  durationMinutes: number;
  runoffCoefficient: number;
  rainfallSource: Record<string, unknown>;
  proposals: Proposal[];
  onDuration: (minutes: number) => void;
  onProposals: (proposals: Proposal[]) => void;
  onTerrain: (terrain: FloodTerrainAsset) => void;
  onFrame: (frame: FloodDisplayFrame | null) => void;
  onResult?: (evidence: FloodEvidence) => void;
  initialRun?: FloodEvidence | null;
}) {
  const [terrain, setTerrain] = useState<FloodTerrainAsset | null>(null);
  const [terrainError, setTerrainError] = useState('');
  const [revision, setRevision] = useState(0);
  const [drainage, setDrainage] = useState(initialRun?.input.drainageMmPerHour ?? 5);
  const [roughness, setRoughness] = useState(initialRun?.input.roughnessManning ?? 0.04);
  const [boundary, setBoundary] = useState<'closed' | 'free-outfall'>(
    initialRun?.input.boundary ?? 'free-outfall',
  );
  const [run, setRun] = useState<Run | null>(() =>
    initialRun
      ? {
          key: JSON.stringify(initialRun.input),
          input: initialRun.input,
          rainfallSource: initialRun.rainfallSource,
          comparison: initialRun.comparison,
        }
      : null,
  );
  const [pending, setPending] = useState<{ key: string; progress: number } | null>(null);
  const [error, setError] = useState('');
  const [caseName, setCaseName] = useState<'before' | 'after'>('before');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const worker = useRef<Worker | null>(null);
  const serial = useRef(0);
  const input = useMemo<FloodSimulationInput | null>(
    () =>
      terrain
        ? {
            terrain,
            rainfallMm,
            durationMinutes,
            runoffCoefficient,
            roughnessManning: roughness,
            drainageMmPerHour: drainage,
            boundary,
            tailMinutes: 30,
            maxFrames: 61,
            wetAreaThresholdM: 0.1,
            proposals: proposals.map((proposal) => ({
              ...proposal,
              capacityM3: SOLUTIONS[proposal.type].capacity,
              captureRateM3s: INLETS[proposal.type],
            })),
          }
        : null,
    [
      terrain,
      rainfallMm,
      durationMinutes,
      runoffCoefficient,
      roughness,
      drainage,
      boundary,
      proposals,
    ],
  );
  const key = useMemo(() => JSON.stringify(input), [input]);
  const active = run?.key === key ? run : null;
  const busy = pending?.key === key;
  const frameIndex = active ? Math.min(index, active.comparison.before.frames.length - 1) : 0;
  const before = active?.comparison.before.frames[frameIndex];
  const after = active?.comparison.after.frames[frameIndex];
  const current = caseName === 'before' ? before : after;
  const lastFrame = active ? active.comparison.before.frames.length - 1 : 0;
  const isPlaying = playing && !!active && frameIndex < lastFrame;
  const area = terrain ? terrain.dxM * terrain.dzM : 0;
  const beforeStats = before ? depthStats(before, area) : null;
  const afterStats = after ? depthStats(after, area) : null;
  const supported = durationMinutes >= 15 && durationMinutes <= 180;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/data/townships/${township.id}-terrain.json`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'Terrain data is unavailable. The flood model cannot run without elevations.',
          );
        const value = (await response.json()) as FloodTerrainAsset;
        if (
          value.townshipId !== township.id ||
          value.cols !== 32 ||
          value.rows !== 32 ||
          value.elevationsM.length !== 1024 ||
          !value.elevationsM.every(Number.isFinite) ||
          !value.source?.url
        )
          throw new Error('Terrain data failed validation.');
        if (!controller.signal.aborted) {
          setTerrain(value);
          setTerrainError('');
          onTerrain(value);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setTerrainError(error instanceof Error ? error.message : 'Unable to load terrain.');
      });
    return () => controller.abort();
  }, [township, onTerrain, revision]);
  useEffect(() => {
    return () => {
      worker.current?.terminate();
      worker.current = null;
      setPending(null);
      onFrame(null);
    };
  }, [key, onFrame]);
  useEffect(() => {
    if (!current || !terrain) {
      onFrame(null);
      return;
    }
    onFrame({
      cols: terrain.cols,
      rows: terrain.rows,
      depthsM: current.depthsM,
      timeSeconds: current.timeSeconds,
      mode: caseName,
      showWater: true,
    });
  }, [current, terrain, caseName, onFrame]);
  useEffect(() => {
    if (!isPlaying || !active) return;
    const timer = setInterval(() => {
      setIndex((previous) => {
        if (previous >= active.comparison.before.frames.length - 1) return previous;
        return previous + 1;
      });
    }, 350);
    return () => clearInterval(timer);
  }, [isPlaying, active]);
  function start(placed = proposals) {
    if (!input || !supported) return;
    worker.current?.terminate();
    const requestId = ++serial.current;
    const values: FloodSimulationInput = {
      ...input,
      proposals: placed.map((proposal) => ({
        ...proposal,
        capacityM3: SOLUTIONS[proposal.type].capacity,
        captureRateM3s: INLETS[proposal.type],
      })),
    };
    const runKey = JSON.stringify(values);
    setPending({ key: runKey, progress: 0 });
    setError('');
    setPlaying(false);
    setRun(null);
    onFrame(null);
    const next = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.current = next;
    next.onmessage = ({ data }: MessageEvent<FloodWorkerResponse>) => {
      if (data.requestId !== serial.current || worker.current !== next) return;
      if (data.type === 'progress') setPending({ key: runKey, progress: data.progress });
      if (data.type === 'error') {
        setError(data.error);
        setPending(null);
        next.terminate();
        worker.current = null;
      }
      if (data.type === 'result') {
        setRun({ key: runKey, input: values, rainfallSource, comparison: data.result });
        onResult?.({
          townshipId: township.id,
          capturedAt: new Date().toISOString(),
          input: values,
          rainfallSource,
          comparison: data.result,
        });
        setPending(null);
        const peak = data.result.before.frames.reduce(
          (best, frame, i, frames) => (frame.surfaceM3 > frames[best].surfaceM3 ? i : best),
          0,
        );
        setIndex(peak);
        setCaseName('before');
        next.terminate();
        worker.current = null;
      }
    };
    next.onerror = () => {
      if (requestId !== serial.current || worker.current !== next) return;
      setError('The simulation worker could not complete. Reduce the storm duration and retry.');
      setPending(null);
      next.terminate();
      worker.current = null;
    };
    next.postMessage({ type: 'run', requestId, input: values });
  }
  function addDemo() {
    if (!active || !terrain) return;
    onProposals(demoConcepts(terrain, active.comparison.before.peakDepthsM));
    setPlaying(false);
  }
  function exportResult() {
    if (!active) return;
    download(`LivingShield-${township.id}-flood-comparison.json`, {
      project: 'LivingShield',
      exportedAt: new Date().toISOString(),
      township,
      input: active.input,
      rainfallSource: active.rainfallSource,
      ...active.comparison,
      notice:
        'Uncalibrated surface-flow screening. No surveyed drains, culverts, floor levels, building-scale flood prediction, observed-event calibration or safety certification.',
    });
  }
  const chartMax = active
    ? Math.max(
        1,
        ...active.comparison.before.frames.map((frame) => frame.surfaceM3),
        ...active.comparison.after.frames.map((frame) => frame.surfaceM3),
      )
    : 1;
  const points = (frames: FloodFrame[]) =>
    frames
      .map(
        (frame, i) =>
          `${(i / Math.max(1, frames.length - 1)) * 500},${50 - (frame.surfaceM3 / chartMax) * 44}`,
      )
      .join(' ');
  return (
    <section className="tt-flood-lab" aria-label="Terrain-aware flood simulation">
      <div className="tt-flood-title">
        <div>
          <p className="tt-eyebrow">2D RAINFALL & SURFACE FLOW</p>
          <h2>One storm. Two futures.</h2>
        </div>
        <span className="tt-flood-status">
          {busy
            ? `Computing ${fmt((pending?.progress ?? 0) * 100)}%`
            : active
              ? 'Comparison ready'
              : 'Uncalibrated screening'}
        </span>
      </div>
      <div className="tt-flood-inputs">
        <label>
          Rainfall duration
          <select
            aria-label="Flood rainfall duration"
            value={durationMinutes}
            onChange={(event) => onDuration(Number(event.target.value))}
          >
            {[
              15,
              30,
              60,
              120,
              180,
              ...(![15, 30, 60, 120, 180].includes(durationMinutes) ? [durationMinutes] : []),
            ].map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} min
              </option>
            ))}
          </select>
        </label>
        <label>
          Assumed drainage
          <select
            aria-label="Flood drainage capacity"
            value={drainage}
            onChange={(event) => setDrainage(Number(event.target.value))}
          >
            {[0, 2, 5, 10, 20].map((value) => (
              <option key={value} value={value}>
                {value} mm/h
              </option>
            ))}
          </select>
        </label>
        <button
          className="tt-flood-run"
          disabled={!terrain || busy || !supported}
          onClick={() => start()}
        >
          {busy ? 'Running…' : 'Run flood comparison'}
        </button>
        <button disabled={!active || busy} onClick={addDemo}>
          Place pooling-point demo basins
        </button>
      </div>
      <p className="tt-flood-caption">
        Uncalibrated · {rainfallMm.toFixed(1)} mm over {durationMinutes} min · C{' '}
        {runoffCoefficient.toFixed(2)} · full 225 ha grid · 30 min recovery · {proposals.length}{' '}
        concepts / {fmt(proposals.reduce((sum, p) => sum + SOLUTIONS[p.type].capacity, 0))} m³
        proposed storage.
      </p>
      {!supported && <p role="alert">Choose a 15–180 minute storm for the interactive 3D model.</p>}
      {terrainError && (
        <p role="alert">
          {terrainError}{' '}
          <button onClick={() => setRevision((value) => value + 1)}>Retry terrain</button>
        </p>
      )}
      {!terrain && !terrainError && (
        <p role="status">Loading actual Copernicus GLO-30 elevations…</p>
      )}
      {error && <p role="alert">{error}</p>}
      {!active && !busy && !terrainError && (
        <p className="tt-flood-empty">
          {run
            ? 'Inputs changed. Run again to update both cases.'
            : 'Run the storm, then place concepts and rerun. Water follows the elevation grid; storage captures only nearby surface water.'}
        </p>
      )}
      {busy && (
        <div
          className="tt-flood-progress"
          role="progressbar"
          aria-valuenow={Math.round((pending?.progress ?? 0) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${(pending?.progress ?? 0) * 100}%` }} />
        </div>
      )}
      {active && current && beforeStats && afterStats && (
        <>
          <div className="tt-flood-playback">
            <div className="tt-segment">
              <button aria-pressed={caseName === 'before'} onClick={() => setCaseName('before')}>
                Before mitigation
              </button>
              <button aria-pressed={caseName === 'after'} onClick={() => setCaseName('after')}>
                After mitigation
              </button>
            </div>
            <button
              aria-label={isPlaying ? 'Pause flood playback' : 'Play flood playback'}
              onClick={() => {
                if (frameIndex === lastFrame) setIndex(0);
                setPlaying(!isPlaying);
              }}
            >
              {isPlaying ? 'Ⅱ Pause' : '▶ Play'}
            </button>
            <strong>
              {clock(current.timeSeconds)} /{' '}
              {clock(active.comparison.before.frames.at(-1)!.timeSeconds)}
            </strong>
            <button onClick={exportResult}>Export flood results ↗</button>
          </div>
          <input
            className="tt-flood-timeline"
            type="range"
            aria-label="Flood simulation time"
            min={0}
            max={active.comparison.before.frames.length - 1}
            step={1}
            value={frameIndex}
            onChange={(event) => {
              setIndex(Number(event.target.value));
              setPlaying(false);
            }}
          />
          <div className="tt-flood-metrics">
            <div>
              <span>Area at least 0.10 m deep</span>
              <strong>
                {fmt(beforeStats.wetHa, 1)} → {fmt(afterStats.wetHa, 1)} <small>ha</small>
              </strong>
            </div>
            <div>
              <span>Maximum modelled depth</span>
              <strong>
                {fmt(beforeStats.max, 2)} → {fmt(afterStats.max, 2)} <small>m</small>
              </strong>
            </div>
            <div>
              <span>Captured by concepts by this time</span>
              <strong>
                {fmt(after?.storedM3 ?? 0)} <small>m³</small>
              </strong>
            </div>
          </div>
          <div className="tt-flood-chart">
            <svg
              viewBox="0 0 500 54"
              role="img"
              aria-label="Surface water volume over time before and after mitigation"
            >
              <polyline
                points={points(active.comparison.before.frames)}
                fill="none"
                stroke="#d18b54"
                strokeWidth="2"
              />
              <polyline
                points={points(active.comparison.after.frames)}
                fill="none"
                stroke="#247d89"
                strokeWidth="2"
              />
              <line
                x1={(frameIndex / Math.max(1, lastFrame)) * 500}
                x2={(frameIndex / Math.max(1, lastFrame)) * 500}
                y1="0"
                y2="54"
                stroke="#3d5748"
                strokeDasharray="3 3"
              />
            </svg>
            <span>Surface water on grid · orange before / teal after · same time and camera</span>
          </div>
          {before && after && (
            <FloodInsights
              input={active.input}
              comparison={active.comparison}
              before={before}
              after={after}
            />
          )}
        </>
      )}
      <details className="tt-flood-method">
        <summary>Terrain, assumptions & water balance</summary>
        <div className="tt-flood-method-grid">
          <label>
            Manning roughness n
            <select
              aria-label="Flood Manning roughness"
              value={roughness}
              onChange={(event) => setRoughness(Number(event.target.value))}
            >
              {[0.03, 0.04, 0.06, 0.08].map((value) => (
                <option key={value} value={value}>
                  {value.toFixed(2)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Boundary
            <select
              aria-label="Flood boundary condition"
              value={boundary}
              onChange={(event) => setBoundary(event.target.value as typeof boundary)}
            >
              <option value="free-outfall">Free outfall; no external inflow</option>
              <option value="closed">Closed edges (ponding test)</option>
            </select>
          </label>
        </div>
        <p>
          Uniform rainfall on a 32 × 32 grid, {terrain?.dxM.toFixed(1) ?? '46.9'} m cells.
          Local-inertial shallow-water routing with wet/dry handling. Runoff coefficient applies
          lumped runoff losses; drainage is a uniform assumed sink, not an installed pipe inventory.
          Initial surface depths are zero. Roofs, kerbs, culverts, tidal levels and individual
          building barriers are not resolved.
        </p>
        <p>
          Concept inlets are assumed: garden 0.03, basin 0.50, tank cluster 0.08 m³/s. Capture is
          limited by local water, inlet rate and remaining capacity. Demo basins replace the current
          concepts at modelled pooling cells using a spacing heuristic; they are not approved or
          optimised sites.
        </p>
        <p>
          Tank clusters assume a connection or pump from surface water at the placed cell. Roof
          collection and individual roof catchments are not simulated. The time series ends 30
          minutes after rainfall; later peaks may occur beyond this window.
        </p>
        {terrain && (
          <>
            <p>
              <a href={terrain.source.url} target="_blank" rel="noreferrer">
                {terrain.source.title} ↗
              </a>{' '}
              · {terrain.minM.toFixed(1)}–{terrain.maxM.toFixed(1)} m elevation.{' '}
              {terrain.source.notice}
            </p>
            {terrain.dataQuality.zeroCells > 0 && (
              <p className="tt-flood-quality">
                This terrain contains {terrain.dataQuality.zeroCells} source zero-elevation cells;
                editing or surface-model artefacts may create false pooling.
              </p>
            )}
            <p className="tt-flood-attribution">{terrain.source.attribution}</p>
          </>
        )}
        {active && (
          <p>
            Final balance, before / after: rain {fmt(active.comparison.before.metrics.totalRainM3)}{' '}
            / {fmt(active.comparison.after.metrics.totalRainM3)} m³; surface{' '}
            {fmt(active.comparison.before.metrics.finalSurfaceM3)} /{' '}
            {fmt(active.comparison.after.metrics.finalSurfaceM3)}; boundary outflow{' '}
            {fmt(active.comparison.before.metrics.totalOutflowM3)} /{' '}
            {fmt(active.comparison.after.metrics.totalOutflowM3)}; drainage{' '}
            {fmt(active.comparison.before.metrics.totalDrainageM3)} /{' '}
            {fmt(active.comparison.after.metrics.totalDrainageM3)}; runoff losses{' '}
            {fmt(active.comparison.before.metrics.totalRunoffLossM3)} /{' '}
            {fmt(active.comparison.after.metrics.totalRunoffLossM3)}; stored{' '}
            {fmt(active.comparison.before.metrics.totalStoredM3)} /{' '}
            {fmt(active.comparison.after.metrics.totalStoredM3)}. Mass residual{' '}
            {active.comparison.before.metrics.massErrorM3.toExponential(2)} /{' '}
            {active.comparison.after.metrics.massErrorM3.toExponential(2)} m³.
          </p>
        )}
        <p>
          <a href="https://doi.org/10.1016/j.jhydrol.2010.03.027" target="_blank" rel="noreferrer">
            Method reference: Bates, Horritt & Fewtrell (2010) ↗
          </a>
          . This implementation has numerical tests, not observed-event calibration. Modelled depth
          is not a measured flood level or a safety assessment.
        </p>
      </details>
    </section>
  );
}
