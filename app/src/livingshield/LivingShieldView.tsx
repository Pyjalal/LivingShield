import { useEffect, useMemo, useState } from 'react';
import { usePresentationMode } from '../platform/usePresentationMode';
import '../platform/presentation.css';
import { TOWNSHIPS } from '../township/model';
import { download } from '../malaysia/sites';
import RiverScene from './RiverScene';
import {
  calculateBankLayout,
  DEFAULT_BANK,
  MODULE,
  type BankInputs,
  type InstallationStage,
  type UiTheme,
} from './model';
import './livingshield.css';

const format = (value: number, digits = 0) =>
  value.toLocaleString('en-MY', { maximumFractionDigits: digits });
const STAGES: { id: InstallationStage; title: string; text: string }[] = [
  {
    id: 'existing',
    title: 'Existing bank',
    text: 'An illustrative unprotected bank. This cross-section is a design scenario, not a survey of the selected township.',
  },
  {
    id: 'installed',
    title: 'Module installation',
    text: 'Interlocking courses rise from the toe. The layout shows nominal packing; real anchoring, edge details and scour protection need engineering design.',
  },
  {
    id: 'established',
    title: 'Planting concept',
    text: 'Planting openings create a place to investigate vegetation establishment. Growth, species suitability and ecological benefits have not been validated.',
  },
];

export type BankConcept = Record<string, unknown> & {
  townshipId: string;
  capturedAt: string;
  status: 'concept';
  inputs: BankInputs;
  quantities: ReturnType<typeof calculateBankLayout> & { moduleCount: number };
};

export default function LivingShieldView({
  uiTheme,
  townshipId,
  onOpenTownship,
  onPlanChange,
  onTownshipChange,
  initialInputs = DEFAULT_BANK,
}: {
  uiTheme: UiTheme;
  townshipId: string;
  onOpenTownship: (id: string) => void;
  onPlanChange?: (plan: BankConcept) => void;
  onTownshipChange?: (id: string) => void;
  initialInputs?: BankInputs;
}) {
  const [pilotId, setPilotId] = useState(
    TOWNSHIPS.some((pilot) => pilot.id === townshipId) ? townshipId : TOWNSHIPS[0].id,
  );
  const [mode, setMode] = useState<'module' | 'bank'>('module');
  const [presenting, setPresenting] = usePresentationMode('.ls-presentation-toggle');
  const [stage, setStage] = useState<InstallationStage>('installed');
  const [lengthM, setLength] = useState(initialInputs.lengthM);
  const [heightM, setHeight] = useState(initialInputs.heightM);
  const [slopeDegrees, setSlope] = useState(initialInputs.slopeDegrees);
  const [sparePercent, setSpare] = useState(initialInputs.sparePercent);
  const [rate, setRate] = useState(
    initialInputs.unitRateMyr === null ? '' : String(initialInputs.unitRateMyr),
  );
  const [exported, setExported] = useState(false);
  const township = TOWNSHIPS.find((pilot) => pilot.id === pilotId)!;
  const unitRateMyr = rate === '' ? null : Number(rate);
  const validRate =
    unitRateMyr === null ||
    (Number.isFinite(unitRateMyr) && unitRateMyr >= 0 && unitRateMyr <= 100000);
  const input = useMemo<BankInputs>(
    () => ({
      lengthM,
      heightM,
      slopeDegrees,
      sparePercent,
      unitRateMyr: validRate ? unitRateMyr : null,
    }),
    [lengthM, heightM, slopeDegrees, sparePercent, unitRateMyr, validRate],
  );
  const layout = useMemo(() => calculateBankLayout(input), [input]);
  const currentStage = STAGES.find((item) => item.id === stage)!;
  const concept = useMemo(
    () => ({
      townshipId: township.id,
      kind: 'LivingShield riverbank design concept',
      status: 'concept' as const,
      validationStatus:
        'Unvalidated, not a construction specification or hydraulic benefit estimate.',
      townshipContext: {
        name: township.name,
        state: township.state,
        centre: township.centre,
        source: township.source.anchorUrl,
        notice: 'Context only; no surveyed bank alignment or local slope.',
      },
      inputs: input,
      quantities: { ...layout, moduleCount: layout.installedModules },
      method: {
        slopeLengthM: 'heightM / sin(slopeDegrees × pi / 180)',
        bankAreaM2: 'lengthM × slopeLengthM',
        rows: 'ceil(slopeLengthM / (0.30 × sqrt(3) / 2))',
        columns: 'ceil(lengthM / 0.30)',
        installedModules: 'rows × columns × 2 − floor(rows / 2)',
        spareModules: 'ceil(installedModules × sparePercent / 100)',
        moduleSubtotalMyr: 'orderModules × user-supplied unitRateMyr; null if unquoted',
      },
      designAsset: MODULE,
      sourceManifest: '/livingshield/source.json',
      assumptions: [
        'Straight bank and uniform user-assumed slope.',
        'Nominal 0.30 m triangular packing, whole-course rounding and user-selected spare allowance.',
        'Quoted module rates only; unknown rates remain null, not an estimate of free construction.',
        'No surveyed bank suitability, flood reduction, flow-velocity change, ecological gain or structural validation.',
        'Physical module concept is not assigned invented storage capture in the township flood solver.',
      ],
    }),
    [township, input, layout],
  );
  useEffect(() => {
    if (validRate) onPlanChange?.({ ...concept, capturedAt: new Date().toISOString() });
  }, [concept, onPlanChange, validRate]);
  function exportPlan() {
    if (!validRate) return;
    download(`LivingShield-${township.id}-riverbank-concept.json`, {
      project: 'LivingShield',
      module: 'River Lab',
      exportedAt: new Date().toISOString(),
      townshipContext: {
        id: township.id,
        name: township.name,
        state: township.state,
        centre: township.centre,
        source: township.source.anchorUrl,
        notice:
          'Township context only. No bank location, boundary, slope or suitability is inferred from this anchor.',
      },
      status: 'Unvalidated design concept; not a construction specification.',
      inputs: input,
      quantities: layout,
      designAsset: MODULE,
      sourceManifest: '/livingshield/source.json',
      assumptions: [
        'Straight bank, uniform slope, nominal 0.30 m equilateral module base. Slots use alternating triangular orientations and half-module row offsets.',
        'Rows = ceil((height / sin(slope)) / (0.30 × sqrt(3) / 2)); columns = ceil(length / 0.30); installed modules = rows × columns × 2 − floor(rows / 2). Whole-course estimate, not a manufacturer installation schedule.',
        'Spare modules = ceil(installed modules × spare allowance / 100). Nominal tiling area is not impermeable coverage or hydraulic performance.',
        'Blank unit rate stays unknown. Any entered rate is supplied by the user; subtotal includes order quantity only, excluding anchoring, planting, fabrication, labour, transport, tax, maintenance and site preparation.',
        'No flood reduction, bank stability, water-velocity change or habitat gain is calculated. The township flood solver does not receive invented storage or benefit credits from these modules.',
        'Source video is an artistic installation animation. Its stabilisation, slower-flow and habitat captions describe intentions that require testing.',
      ],
      nextValidation: [
        'Survey bank and water levels',
        'Geotechnical and scour assessment',
        'Structural/material and connector testing',
        'Hydraulic and debris-blockage study',
        'Local ecological species review',
        'Authority approval and constructability review',
      ],
    });
    setExported(true);
  }
  return (
    <section
      className={`ls-lab${presenting ? ' ls-presenting' : ''}`}
      aria-label="LivingShield River Lab"
    >
      <header className="ls-header">
        <div>
          <p className="ls-eyebrow">LIVINGSHIELD / RIVER LAB</p>
          <h1>
            A place for roots.
            <br />A design for resilience.
          </h1>
          <p>
            Explore the physical module. Plan an installation concept. Build the evidence for a
            field pilot.
          </p>
        </div>
        <div className="ls-pilot">
          <label htmlFor="ls-pilot">Township context</label>
          <select
            id="ls-pilot"
            value={pilotId}
            onChange={(event) => {
              setPilotId(event.target.value);
              onTownshipChange?.(event.target.value);
              setExported(false);
            }}
          >
            {TOWNSHIPS.map((pilot) => (
              <option value={pilot.id} key={pilot.id}>
                {pilot.name}
              </option>
            ))}
          </select>
          <button onClick={() => onOpenTownship(pilotId)}>Open this township ↗</button>
        </div>
      </header>
      <div className="ls-workspace">
        <div className="ls-viewer-panel">
          <div className="ls-viewer-heading">
            <div className="ls-mode-switch" aria-label="River Lab view">
              <button aria-pressed={mode === 'module'} onClick={() => setMode('module')}>
                01 / Inspect the module
              </button>
              <button aria-pressed={mode === 'bank'} onClick={() => setMode('bank')}>
                02 / Plan the bank
              </button>
            </div>
            <span className="ls-concept-badge">Design prototype</span>
            <button
              className="ls-presentation-toggle"
              aria-pressed={presenting}
              onClick={() => {
                setPresenting(!presenting);
                if (!presenting)
                  requestAnimationFrame(() => {
                    document.querySelector<HTMLElement>('.ls-lab')?.scrollTo({ top: 0 });
                  });
              }}
            >
              {presenting ? 'Exit present view' : 'Present view'}
            </button>
          </div>
          <RiverScene key={mode} mode={mode} input={input} stage={stage} theme={uiTheme} />
          {mode === 'module' ? (
            <div className="ls-module-notes">
              <div>
                <span>01 / Open faces</span>
                <p>Triangular openings for a planting concept and water passage.</p>
              </div>
              <div>
                <span>02 / Connectors</span>
                <p>Corner pin holes and top socket in the source geometry.</p>
              </div>
              <div>
                <span>03 / Nominal scale</span>
                <p>300 mm base edge and height. Export bounds differ slightly.</p>
              </div>
            </div>
          ) : (
            <div className="ls-stage-panel">
              <div className="ls-stage-switch" aria-label="Installation stage">
                {STAGES.map((item, index) => (
                  <button
                    key={item.id}
                    aria-pressed={stage === item.id}
                    onClick={() => setStage(item.id)}
                  >
                    <span>0{index + 1}</span>
                    {item.title}
                  </button>
                ))}
              </div>
              <p>{currentStage.text}</p>
            </div>
          )}
        </div>
        <aside className="ls-config" aria-label="Riverbank concept parameters">
          <p className="ls-eyebrow">CONCEPT QUANTITIES</p>
          <h2>Make the design tangible.</h2>
          <p className="ls-config-intro">
            Choose a straight-bank scenario. Quantities use nominal triangular packing, with whole
            rows and an editable spare allowance.
          </p>
          <label>
            Bank length <strong>{format(lengthM, 1)} m</strong>
            <input
              aria-label="Concept bank length"
              type="range"
              min="1.2"
              max="24"
              step="0.3"
              value={lengthM}
              onChange={(event) => {
                setLength(Number(event.target.value));
                setExported(false);
              }}
            />
          </label>
          <label>
            Vertical bank height <strong>{format(heightM, 1)} m</strong>
            <input
              aria-label="Concept vertical bank height"
              type="range"
              min="0.3"
              max="3"
              step="0.1"
              value={heightM}
              onChange={(event) => {
                setHeight(Number(event.target.value));
                setExported(false);
              }}
            />
          </label>
          <label>
            Slope from horizontal <strong>{slopeDegrees}°</strong>
            <input
              aria-label="Concept bank slope"
              type="range"
              min="20"
              max="55"
              step="1"
              value={slopeDegrees}
              onChange={(event) => {
                setSlope(Number(event.target.value));
                setExported(false);
              }}
            />
          </label>
          <label>
            Spare allowance <strong>{sparePercent}%</strong>
            <input
              aria-label="Concept spare allowance"
              type="range"
              min="0"
              max="25"
              step="1"
              value={sparePercent}
              onChange={(event) => {
                setSpare(Number(event.target.value));
                setExported(false);
              }}
            />
          </label>
          <div className="ls-quantity-grid">
            <div>
              <span>Nominal bank area</span>
              <strong>
                {format(layout.bankAreaM2, 1)}
                <small> m²</small>
              </strong>
            </div>
            <div>
              <span>Module layout</span>
              <strong>
                {format(layout.installedModules)}
                <small> units</small>
              </strong>
            </div>
            <div>
              <span>Whole courses</span>
              <strong>
                {layout.rows}
                <small> rows</small>
              </strong>
            </div>
            <div>
              <span>Including {format(layout.spareModules)} spares</span>
              <strong>
                {format(layout.orderModules)}
                <small> units</small>
              </strong>
            </div>
          </div>
          <label className="ls-rate">
            Quoted module rate · optional
            <input
              aria-label="Quoted module unit rate in MYR"
              type="number"
              min="0"
              max="100000"
              step="0.01"
              placeholder="RM per module — leave blank if unknown"
              value={rate}
              onChange={(event) => {
                setRate(event.target.value);
                setExported(false);
              }}
            />
          </label>
          {!validRate && (
            <p role="alert">Enter a finite rate from RM 0 to RM 100,000, or leave it blank.</p>
          )}
          <div className="ls-cost">
            <span>Module-only subtotal</span>
            <strong>
              {validRate && layout.moduleSubtotalMyr !== null
                ? `RM ${format(layout.moduleSubtotalMyr, 2)}`
                : 'Quote required'}
            </strong>
            <small>Excludes installation, planting, anchors, site works, delivery and tax.</small>
          </div>
          <button className="ls-primary" disabled={!validRate} onClick={exportPlan}>
            Export concept & assumptions ↗
          </button>
          <p className="ls-export-status" role="status">
            {exported
              ? 'Concept exported with quantities, source hashes and validation steps.'
              : 'The selected township is context, not a surveyed installation site.'}
          </p>
        </aside>
      </div>
      <div className="ls-evidence-row">
        <section className="ls-film">
          <div>
            <p className="ls-eyebrow">FROM MODULE TO RIVERBANK</p>
            <h2>See the installation story.</h2>
            <p>
              The original LivingShield concept film shows assembly, placement and illustrative
              vegetation. Its benefit captions are design intentions, not measured outcomes.
            </p>
          </div>
          <video
            controls
            playsInline
            preload="none"
            poster="/livingshield/bank-established.png"
            aria-label="LivingShield original design concept film"
          >
            <source src="/livingshield/LivingShield_demo.mp4" type="video/mp4" />
            <track
              kind="captions"
              src="/livingshield/concept-captions.vtt"
              srcLang="en"
              label="English"
              default
            />
            Your browser cannot play the film.{' '}
            <a href="/livingshield/LivingShield_demo.mp4">Download the concept film</a>.
          </video>
        </section>
        <section className="ls-source-card">
          <p className="ls-eyebrow">SOURCE FILES / PROTOTYPE</p>
          <h2>A physical design you can inspect.</h2>
          <p>
            The supplied 33,886-triangle model is used in the detailed viewer. The bank view uses
            lighter geometry so the complete installation remains responsive.
          </p>
          <dl>
            <div>
              <dt>Nominal module</dt>
              <dd>300 mm edge × 300 mm height</dd>
            </div>
            <div>
              <dt>Actual GLB bounds</dt>
              <dd>310 × 309 × 278 mm, approximately</dd>
            </div>
            <div>
              <dt>Export units</dt>
              <dd>GLB: metres · STL: millimetres</dd>
            </div>
          </dl>
          <div className="ls-file-links">
            <a download href="/livingshield/module_triangle.glb">
              Download GLB ↗
            </a>
            <a download href="/livingshield/module_triangle.stl">
              Download STL ↗
            </a>
            <a download href="/livingshield/source/livingshield_scene.blend">
              Editable Blender scene ↗
            </a>
            <a href="/livingshield/source/README.md" target="_blank" rel="noreferrer">
              Design source & generation ↗
            </a>
            <a href="/livingshield/source.json" target="_blank" rel="noreferrer">
              Asset provenance ↗
            </a>
          </div>
          <p className="ls-prototype-note">
            A closed mesh is not a construction approval or proof of printability. Material,
            connector, anchoring, scour and ecological testing are still required.
          </p>
        </section>
      </div>
      <details className="ls-method">
        <summary>How the quantities work, and what still needs evidence</summary>
        <div>
          <p>
            The scenario assumes a straight bank with uniform slope. Sloped length = vertical height
            ÷ sin(slope). Nominal triangular row height = 0.30 × √3 ÷ 2 m. Rows and columns round
            up; alternate rows contain one fewer triangle. This is a concept packing estimate, not a
            shop drawing.
          </p>
          <p>
            Planting and bank shape are illustrative. No actual bank alignment, species selection,
            soil strength, flow velocity, flood reduction or habitat gain is inferred. No artificial
            benefit is added to the township flood solver. Before construction: survey the site,
            assess geotechnical and scour conditions, test the material and connectors, model
            hydraulics and debris blockage, review ecological suitability and obtain the required
            approvals.
          </p>
        </div>
      </details>
    </section>
  );
}
