import { useState } from 'react';
import { TOWNSHIPS } from '../township/model';
import { download } from '../malaysia/sites';
import type { BankEvidence, FloodEvidence, PlatformView } from './evidence';
import './platform.css';
import { downloadReadableBrief } from './readableBrief';
import ReviewPlanner from './ReviewPlanner';
import { getReviewPlanStore, type ReviewPlan } from './reviewPlan';
import { summarizeFloodComparison } from '../township/flood/insights';
import { INVESTIGATION_DECISION } from './decisionContext';

const fmt = (n: number, digits = 1) => n.toLocaleString('en-MY', { maximumFractionDigits: digits });

export default function EvidenceView({
  townshipId,
  onTownshipChange,
  flood,
  bank,
  onOpen,
}: {
  townshipId: string;
  onTownshipChange: (id: string) => void;
  flood: FloodEvidence | null;
  bank: BankEvidence | null;
  onOpen: (view: PlatformView) => void;
}) {
  const township = TOWNSHIPS.find((t) => t.id === townshipId) ?? TOWNSHIPS[0];
  const [reviewStore] = useState(getReviewPlanStore);
  const [reviewPlans, setReviewPlans] = useState<Record<string, ReviewPlan>>({});
  const reviewPlan = reviewPlans[township.id] ?? reviewStore.read(township.id);
  const authoredReview = reviewPlan.updatedAt ? reviewPlan : null;
  function updateReviewPlan(value: ReviewPlan) {
    const saved = reviewStore.save(value);
    setReviewPlans((previous) => ({ ...previous, [saved.townshipId]: saved }));
  }
  const activeFlood = flood?.townshipId === townshipId ? flood : null;
  const activeBank = bank?.townshipId === townshipId ? bank : null;
  const before = activeFlood?.comparison.before.metrics;
  const after = activeFlood?.comparison.after.metrics;
  function exportBrief() {
    download(`LivingShield-${township.id}-resilience-brief.json`, {
      schemaVersion: 1,
      project: 'LivingShield',
      exportedAt: new Date().toISOString(),
      township,
      decisionContext: INVESTIGATION_DECISION,
      completeness: { floodComparison: !!activeFlood, bankConcept: !!activeBank },
      floodComparison: activeFlood,
      bankConcept: activeBank,
      floodSummary: activeFlood ? summarizeFloodComparison(activeFlood.input, activeFlood.comparison) : null,
      reviewPlan: authoredReview,
      reviewPlanNotice: 'Browser-local authored handover. Proposed roles and requests are not assignments, verified evidence, engineering approval or an external submission.',
      integration:
        'The bank-module concept is separate from finite storage in the surface-flow solver. No hydraulic or flood-depth reduction is credited to LivingShield modules.',
      decision:
        'A preliminary brief for operator and engineering review, not a construction design or safety assessment.',
      validationNeeded: [
        'Surveyed bare-earth terrain and drainage network',
        'Boundary, river and tidal conditions',
        'Observed-event flood calibration',
        ...(activeBank ? [
          'Geotechnical and hydraulic testing of the attached bank concept',
          'Bank materials, anchorage, maintenance and ecological review',
          'Bank supplier installation quotations',
        ] : []),
        'Quotations for the scoped survey or model study; works costs need detailed design',
      ],
      backgroundSources: [
        {
          name: 'Hydrology software',
          url: 'https://github.com/Sadat41/HydroGrid',
          licence: 'MIT; original notices retained',
        },
        {
          name: 'Township rendering engine',
          url: '/tamanku/THIRD_PARTY.md',
          notice: 'Adapted local engine; no upstream software licence published',
        },
        {
          name: 'LivingShield',
          notice:
            'User-supplied Blender design, GLB, STL and concept animation; engineering performance unverified',
        },
      ],
    });
  }
  return (
    <section className="ls-evidence" aria-label="LivingShield evidence brief">
      <header className="ls-evidence-heading">
        <div>
          <p className="tt-eyebrow">THE NEXT SDP TOWNSHIP DECISION</p>
          <h1>What should we investigate next?</h1>
          <p>A scoped question for the township team and reviewing engineer, before committing to works.</p>
        </div>
        <div className="ls-review-context">
          <label>
            Township context
            <select
              aria-label="Evidence township"
              value={township.id}
              onChange={(e) => onTownshipChange(e.target.value)}
            >
              {TOWNSHIPS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <a href="#ls-review-plan-title">Prepare the local review ↓</a>
        </div>
      </header>
      <section className="ls-decision-intent" aria-label="Site investigation decision">
        <div>
          <p className="tt-eyebrow">INTENDED USER · TOWNSHIP ASSET MANAGER + REVIEWING ENGINEER</p>
          <h2>{INVESTIGATION_DECISION.requestedDecision}.</h2>
          <p>{after
            ? `The after-case ${after.peakWetAreaM2 > 0 ? 'still reaches' : 'reaches'} ${fmt(after.peakWetAreaM2 / 10000)} ha at ≥0.10 m within this model window. That is an independent event peak, not the selected playback frame or a map of affected homes.`
            : 'Attach a completed comparison before drawing a result-based conclusion. The selected township alone does not establish where an intervention is needed.'}</p>
          <p>Request surveyed levels, drainage connections and boundary conditions to challenge the concept.
            The optional bank study needs its own suitability tests. The brief does not approve construction.</p>
        </div>
        <a href="#ls-review-plan-title">Scope the investigation ↓</a>
      </section>
      <div className="ls-evidence-grid">
        <article>
          <p className="tt-eyebrow">01 / FLOOD TWIN</p>
          <h2>{activeFlood ? 'Comparison attached.' : 'Run the storm.'}</h2>
          <p>Actual computed results from this session, with identical forcing in both cases.</p>
          {activeFlood && before && after ? (
            <>
              <dl>
                <div>
                  <dt>Rainfall and duration</dt>
                  <dd>
                    {fmt(activeFlood.input.rainfallMm)} mm / {activeFlood.input.durationMinutes} min
                  </dd>
                </div>
                <div>
                  <dt>Peak wet area within model window, ≥0.10 m</dt>
                  <dd>
                    {fmt(before.peakWetAreaM2 / 10000)} → {fmt(after.peakWetAreaM2 / 10000)} ha
                  </dd>
                </div>
                <div>
                  <dt>Captured by storage concepts by the end</dt>
                  <dd>{fmt(after.totalStoredM3, 0)} m³</dd>
                </div>
                <div>
                  <dt>Water balance residual, before / after</dt>
                  <dd>
                    {before.massErrorM3.toExponential(2)} / {after.massErrorM3.toExponential(2)} m³
                  </dd>
                </div>
              </dl>
              <small>
                Saved {new Date(activeFlood.capturedAt).toLocaleString('en-MY')} · uncalibrated
                surface-flow screening. Each case’s peak can occur at a different time.
              </small>
            </>
          ) : (
            <p className="ls-evidence-empty">
              No completed flood comparison is attached for {township.name}. A blank is not evidence
              of low risk.
            </p>
          )}
          <button onClick={() => onOpen('township')}>
            {activeFlood ? 'Return to the flood twin' : 'Open the flood twin'} ↗
          </button>
        </article>
        <article>
          <p className="tt-eyebrow">OPTIONAL / BANK-DESIGN STUDY</p>
          <h2>{activeBank ? 'Bank concept attached.' : 'Design the living edge.'}</h2>
          <img
            src="/livingshield/bank-established.png"
            alt="LivingShield concept rendering showing planting pockets and triangular modules on a riverbank"
            loading="lazy"
          />
          <p>
            {activeBank
              ? 'Your declared layout, module quantities and cost assumptions are included in the brief.'
              : 'Inspect the supplied 300 mm nominal module and configure a bank-length, height and slope scenario.'}
          </p>
          {activeBank && (
            <dl>
              <div>
                <dt>Declared length / height / slope</dt>
                <dd>
                  {fmt(activeBank.inputs.lengthM)} m / {fmt(activeBank.inputs.heightM)} m /{' '}
                  {activeBank.inputs.slopeDegrees}°
                </dd>
              </div>
              <div>
                <dt>Modules installed + spares</dt>
                <dd>
                  {fmt(activeBank.quantities.installedModules, 0)} +{' '}
                  {fmt(activeBank.quantities.spareModules, 0)} ={' '}
                  {fmt(activeBank.quantities.orderModules, 0)} to order
                </dd>
              </div>
              <div>
                <dt>Module supply subtotal · excludes installation</dt>
                <dd>
                  {activeBank.quantities.moduleSubtotalMyr === null
                    ? 'Awaiting a quoted unit rate'
                    : `RM ${fmt(activeBank.quantities.moduleSubtotalMyr, 2)}`}
                </dd>
              </div>
            </dl>
          )}
          <p className="ls-evidence-note">
            The animation illustrates a proposed installation. Bank stability, reduced erosion,
            habitat benefits and flood performance require testing. This concept does not remove
            water from the flood simulation.
          </p>
          <button onClick={() => onOpen('living-shield')}>
            {activeBank ? 'Review the bank concept' : 'Open River Lab'} ↗
          </button>
        </article>
      </div>
      <ReviewPlanner
        plan={reviewPlan}
        attachments={Number(!!activeFlood) + Number(!!activeBank)}
        storageStatus={reviewStore.storageStatus(township.id)}
        onChange={updateReviewPlan}
      />
      <section className="ls-evidence-handover">
        <div>
          <p className="tt-eyebrow">04 / EXPORT THE HANDOVER</p>
          <h2>Keep the assumptions with the result.</h2>
          <p>
            The JSON brief includes the selected township, completed flood inputs and frames, the
            bank concept, local review plan, missing sections and next validation steps. Your latest completed runs
            stay attached while you move between tools in this session.
          </p>
        </div>
        <div className="ls-evidence-actions">
          <button
            className="ls-evidence-primary"
            onClick={() => downloadReadableBrief(township, activeFlood, activeBank, authoredReview)}
          >
            Download readable brief ↗
          </button>
          <button onClick={exportBrief}>Export resilience brief · JSON ↗</button>
        </div>
      </section>
      <div className="ls-evidence-sources">
        <h2>Evidence, with boundaries.</h2>
        <div>
          <article>
            <h3>Places and terrain</h3>
            <p>
              OpenStreetMap and Microsoft footprints; Esri aerial context; Copernicus GLO-30 surface
              elevations. Pilot windows are 225 ha locality windows, not surveyed township
              boundaries.
            </p>
            <a
              href="https://registry.opendata.aws/copernicus-dem/"
              target="_blank"
              rel="noreferrer"
            >
              Copernicus source ↗
            </a>
          </article>
          <article>
            <h3>Rainfall and flow</h3>
            <p>
              309 published MSMA / HP26 rainfall profiles and national JPS / MET context. The
              local-inertial model has conservation tests; observed-event calibration remains
              outstanding.
            </p>
            <a
              href="https://doi.org/10.1016/j.jhydrol.2010.03.027"
              target="_blank"
              rel="noreferrer"
            >
              Routing method ↗
            </a>
          </article>
          <article>
            <h3>Design and attribution</h3>
            <p>
              LivingShield’s supplied GLB, STL and animation form the physical concept. Adapted
              hydrology software and township rendering form part of the software background, with original credits retained in the source notices.
            </p>
            <a href="/tamanku/THIRD_PARTY.md" target="_blank" rel="noreferrer">
              Source notices ↗
            </a>
          </article>
        </div>
      </div>
    </section>
  );
}
