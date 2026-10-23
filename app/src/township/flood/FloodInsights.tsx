import { useMemo } from 'react';
import { SOLUTIONS } from '../planning';
import type { FloodComparisonResult, FloodFrame, FloodSimulationInput } from './model';
import { summarizeFloodComparison } from './insights';
import './insights.css';

const fmt = (value: number, digits = 0) =>
  value.toLocaleString('en-MY', { maximumFractionDigits: digits });
const signed = (value: number, digits = 1) =>
  value.toLocaleString('en-MY', { maximumFractionDigits: digits, signDisplay: 'exceptZero' })
    .replace('-', '−');
const names = new Map(
  Object.entries(SOLUTIONS).map(([key, value]) => [key, value.name]),
);

export default function FloodInsights({
  input,
  comparison,
  before,
  after,
}: {
  input: FloodSimulationInput;
  comparison: FloodComparisonResult;
  before: FloodFrame;
  after: FloodFrame;
}) {
  const insight = useMemo(() => summarizeFloodComparison(input, comparison), [input, comparison]);
  const cellArea = input.terrain.dxM * input.terrain.dzM;
  const domainArea = input.terrain.cols * input.terrain.rows * cellArea;
  const threshold = comparison.after.metrics.wetAreaThresholdM;
  const beforeWet = before.depthsM.filter((depth) => depth >= threshold).length * cellArea;
  const afterWet = after.depthsM.filter((depth) => depth >= threshold).length * cellArea;
  const wetChange = (afterWet - beforeWet) / 10000;
  const budget = insight.budget;
  const budgetRows = [
    ['Still on the surface', budget.surfaceM3],
    ['Captured by concepts', budget.storedM3],
    ['Assumed drainage removal', budget.drainageM3],
    ['Left through the boundary', budget.outflowM3],
    ['Runoff coefficient losses', budget.runoffLossM3],
  ] as const;

  return (
    <section className="tt-flood-insights" aria-label="Flood comparison explanation">
      <div className="tt-insight-heading">
        <div>
          <p className="tt-eyebrow">READ THE COMPARISON</p>
          <h3>What changes in this scenario?</h3>
        </div>
        <span className="tt-insight-change">
          {signed(wetChange)} ha at this time
          <small>after − before · area ≥{fmt(threshold, 2)} m deep</small>
        </span>
      </div>
      <div className="tt-insight-comparison" aria-label="Wet area at the selected simulation time">
        {[
          { label: 'Before storage', areaM2: beforeWet, mode: 'before' },
          { label: 'After storage', areaM2: afterWet, mode: 'after' },
        ].map(({ label, areaM2, mode }) => (
          <div className="tt-insight-area-row" key={label}>
            <span>{label}</span>
            <div className="tt-insight-area-track" aria-hidden="true">
              <span
                className={`tt-insight-area-fill tt-insight-${mode}`}
                style={{ width: `${(areaM2 / domainArea) * 100}%` }}
              />
            </div>
            <strong>{fmt(areaM2 / 10000, 1)} ha</strong>
          </div>
        ))}
        <p>
          Both bars use the full {fmt(domainArea / 10000)} ha grid and the same{' '}
          {fmt(before.timeSeconds / 60, 1)}-minute timestamp. A lower value here is a modelled
          difference, not a validated flood reduction.
        </p>
      </div>
      <div className="tt-insight-storage-summary">
        <div>
          <span>Captured by the end of the run</span>
          <strong>
            {fmt(insight.storedM3)} <small>/ {fmt(insight.capacityM3)} m³</small>
          </strong>
        </div>
        <p>
          {insight.proposalCount === 0
            ? 'No storage concepts were included. Both runs use the same storm and background assumptions.'
            : `${insight.counts.full} at capacity · ${insight.counts.partial} partly used · ${insight.counts.unused} unused. ${fmt(insight.unusedCapacityM3)} m³ of declared capacity remains empty.`}
        </p>
      </div>
      <details className="tt-insight-details">
        <summary>Why this result? Inspect capture and water balance</summary>
        <p>
          Only water reaching a concept’s grid cell can be captured. Local water, inlet rate and
          remaining capacity limit capture. An empty or partly filled concept does not, by itself,
          identify which limit controlled the result. The physical bank modules receive no storage
          credit.
        </p>
        {insight.storage.length > 0 && (
          <div className="tt-insight-storage-list" aria-label="Storage capture by concept at end of run">
            {insight.storage.map((storage, index) => (
              <article className="tt-insight-storage-row" key={`${typeof storage.id}-${storage.id}`}>
                <div>
                  <strong>
                    {String(index + 1).padStart(2, '0')} / {names.get(storage.type) ?? 'Storage concept'}
                  </strong>
                  <span>
                    Cell {storage.cellIndex + 1} · inlet{' '}
                    {storage.captureRateM3s === null
                      ? 'uncapped in this model'
                      : `${fmt(storage.captureRateM3s, 3)} m³/s assumed`}
                  </span>
                </div>
                <div className="tt-insight-capacity">
                  <span>{fmt(storage.storedM3)} / {fmt(storage.capacityM3)} m³</span>
                  <meter
                    min={0}
                    max={storage.capacityM3 || 1}
                    value={storage.storedM3}
                    aria-label={`Concept ${index + 1} captured volume`}
                  />
                </div>
                <span className="tt-insight-state">
                  {storage.status === 'full'
                    ? 'At capacity'
                    : storage.status === 'partial'
                      ? 'Partly used'
                      : 'Unused'}
                </span>
              </article>
            ))}
          </div>
        )}
        <div className="tt-insight-budget">
          <div>
            <h4>Where the water ends up</h4>
            <p>
              After-case totals at the end of the run, not the selected playback frame. Rain{' '}
              {fmt(budget.rainM3)} m³ + initial water {fmt(budget.initialSurfaceM3)} m³.
            </p>
          </div>
          <dl>
            {budgetRows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt><dd>{fmt(value)} m³</dd>
              </div>
            ))}
            <div>
              <dt>Numerical residual</dt><dd>{budget.residualM3.toExponential(2)} m³</dd>
            </div>
          </dl>
        </div>
        <p className="tt-insight-limit">
          End-of-run surface water changes by {signed(insight.final.surfaceChangeM3, 0)} m³.
          Outflow and drainage can also differ between runs, so this is not simply equal to captured
          storage. Coarse historical surface elevations, assumed drainage and missing river/tidal
          inflows require survey and event calibration before a site decision.
        </p>
      </details>
    </section>
  );
}
