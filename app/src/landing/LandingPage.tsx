import { useState } from 'react';
import './landing.css';

export type LandingView =
  | 'township'
  | 'living-shield'
  | 'layers'
  | 'flood'
  | 'drainage'
  | 'engineering'
  | 'simulation'
  | 'cost'
  | 'property'
  | 'hydrometric'
  | 'precipitation'
  | 'evidence';

interface Props {
  onOpen: (view: LandingView) => void;
  onStartDemo: () => void;
}

const WORKFLOW: {
  number: string;
  name: string;
  title: string;
  description: string;
  action: string;
  view: LandingView;
}[] = [
  {
    number: '01',
    name: 'Locate the decision',
    title: 'Start with Bandar Bukit Raja.',
    description:
      'Begin with a bounded 225 ha study window. Put the township team and reviewing engineer around the same sourced place, assumptions and investigation question.',
    action: 'Open the 3D townships',
    view: 'township',
  },
  {
    number: '02',
    name: 'Challenge the option',
    title: 'The after-case still matters.',
    description:
      'Run the same assumed storm before and after local storage. Inspect what is captured and where water remains before treating a concept as a candidate for further study.',
    action: 'Explore the flood twin',
    view: 'township',
  },
  {
    number: '03',
    name: 'Inspect an optional concept',
    title: 'Turn a bank idea into a test request.',
    description:
      'If bank works are being considered, inspect the supplied module and declared quantities. Its suitability needs separate tests; it does not cause the flood-storage result.',
    action: 'Enter the River Lab',
    view: 'living-shield',
  },
  {
    number: '04',
    name: 'Scope the next study',
    title: 'Give the engineer a specific question.',
    description:
      'Keep the comparison, missing site evidence, proposed reviewer and next action together. Export an investigation brief that the township team can challenge and refine.',
    action: 'Open the evidence workspace',
    view: 'evidence',
  },
];

const TOOLS: { name: string; description: string; view: LandingView; symbol: string }[] = [
  {
    name: 'National maps',
    description: 'Malaysian infrastructure, land, water and modelled flood context.',
    view: 'layers',
    symbol: 'map',
  },
  {
    name: 'Rainfall & rivers',
    description: 'JPS observations and separately labelled historical model context.',
    view: 'hydrometric',
    symbol: 'water',
  },
  {
    name: 'Drainage & assets',
    description: 'Inspect available agency inventories and import authorised surveys.',
    view: 'drainage',
    symbol: 'assets',
  },
  {
    name: 'Site & engineering',
    description: 'Connect site inputs to drainage design and storm calculations.',
    view: 'engineering',
    symbol: 'site',
  },
  {
    name: 'Storm simulation',
    description: 'Inspect rainfall patterns, runoff timing and water balances.',
    view: 'simulation',
    symbol: 'storm',
  },
  {
    name: 'Cost scenarios',
    description: 'Review quantities and declared rates, with missing quotes explicit.',
    view: 'cost',
    symbol: 'cost',
  },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h15m-6-6 6 6-6 6" />}
    </svg>
  );
}

function ToolIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
    water: 'M3 8c3-4 6 4 9 0s6 4 9 0M3 13c3-4 6 4 9 0s6 4 9 0M3 18c3-4 6 4 9 0s6 4 9 0',
    assets:
      'M4 4h6v6H4V4Zm10 10h6v6h-6v-6ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6Zm6-7h4m-7 3v4m10-4v4m-7 3h4',
    site: 'm12 3 8 4v10l-8 4-8-4V7l8-4Zm0 0v18M4 7l8 4 8-4',
    storm: 'M6 14a5 5 0 1 1 3-9 6 6 0 0 1 11 4 3 3 0 0 1-1 6M9 13l-3 7m9-7-3 7m9-7-3 7',
    cost: 'M4 20h16M6 16V9h3v7H6Zm5 0V4h3v12h-3Zm5 0v-5h3v5h-3Z',
  };
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={paths[kind]} />
    </svg>
  );
}

function ModuleDrawing() {
  return (
    <svg className="ls-home-module-drawing" viewBox="0 0 420 320" fill="none" aria-hidden="true">
      <defs>
        <pattern id="ls-home-module-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0v24" />
        </pattern>
      </defs>
      <rect
        width="420"
        height="320"
        fill="url(#ls-home-module-grid)"
        className="ls-home-drawing-grid"
      />
      <path d="m203 40 145 240H58L203 40Z" className="ls-home-drawing-outer" />
      <path d="m203 100 83 139H120l83-139Z" className="ls-home-drawing-inner" />
      <path d="m203 40 17-15 145 240-17 15m17-15H75l-17 15M203 100v99l83 40m-83-40-83 40" />
      <path
        d="M76 298h272m-272-6v12m272-12v12M381 54v211m-6-211h12m-12 211h12"
        className="ls-home-drawing-dimension"
      />
      <path
        d="M203 199c-9-19-11-33-4-45 11 6 16 15 13 26m-9 19c12-21 23-28 34-24-3 14-13 22-34 24Z"
        className="ls-home-drawing-leaf"
      />
      <circle cx="72" cy="260" r="5" />
      <circle cx="335" cy="260" r="5" />
    </svg>
  );
}

export default function LandingPage({ onOpen, onStartDemo }: Props) {
  const [step, setStep] = useState(0);
  const current = WORKFLOW[step];

  return (
    <main className="ls-home" aria-label="LivingShield overview">
      <section className="ls-home-hero" aria-labelledby="ls-home-title">
        <div className="ls-home-hero-copy">
          <p className="ls-home-eyebrow">
            <span /> FLOOD DECISIONS FOR SIME DARBY PROPERTY · PLANET
          </p>
          <h1 id="ls-home-title">
            Before SDP commits,
            <br /><em>show what stays wet.</em>
          </h1>
          <p className="ls-home-intro">
            Help township teams decide which flood-storage idea deserves a site investigation.
            Test the same storm, expose the remaining water, and give the reviewing engineer a
            specific next question.
          </p>
          <div className="ls-home-hero-actions">
            <button
              className="ls-home-button ls-home-button-primary"
              onClick={onStartDemo}
            >
              Start the guided demo <Arrow />
            </button>
            <button
              className="ls-home-button ls-home-button-secondary"
              onClick={() => onOpen('evidence')}
            >
              See the decision brief <Arrow diagonal />
            </button>
          </div>
          <button className="ls-home-demo-link" onClick={() => onOpen('township')}>
            <span className="ls-home-play" aria-hidden="true">
              ↗
            </span>
            Explore the flood twin
            <span className="ls-home-demo-caption">Choose your own route</span>
          </button>
          <p className="ls-home-hero-note">
            First study: Bandar Bukit Raja · 225 ha window · intended for township asset and engineering teams.
          </p>
        </div>
        <figure className="ls-home-hero-visual">
          <img
            src="/livingshield/township-preview.png"
            alt="Actual Bukit Raja flood-twin preview with water remaining after twelve hypothetical storage concepts"
            width="1440"
            height="400"
            fetchPriority="high"
          />
          <div className="ls-home-visual-label">
            <span /> BANDAR BUKIT RAJA / SAVED MODEL PREVIEW
          </div>
          <figcaption>
            <span>
              Water remains.
              <br />
              <strong>What should we check?</strong>
            </span>
            <small>
              90 mm / 60 min assumed storm · frame at 60 min
              <br />
              12 demo basins · uncalibrated model, not an observed flood
            </small>
          </figcaption>
          <svg className="ls-home-hero-mark" viewBox="0 0 120 110" fill="none" aria-hidden="true">
            <path d="m60 5 54 94H6L60 5Z" />
            <path d="m60 36 28 49H32l28-49Z" />
          </svg>
        </figure>
      </section>

      <section className="ls-home-facts ls-home-decision-facts" aria-label="Who uses LivingShield and for what decision">
        <div>
          <strong>WHO</strong>
          <span>
            Township asset team<small>With a reviewing drainage engineer</small>
          </span>
        </div>
        <div>
          <strong>WHEN</strong>
          <span>
            Before the next study<small>Screen a concept before detailed design or works</small>
          </span>
        </div>
        <div>
          <strong>TAKE AWAY</strong>
          <span>
            A scoped investigation
            <small>Assumptions · evidence gaps · proposed reviewer · next action</small>
          </span>
        </div>
      </section>

      <section className="ls-home-sdp" aria-labelledby="ls-home-sdp-title">
        <div>
          <p className="ls-home-eyebrow">WHY THIS BELONGS IN AN SDP TOWNSHIP</p>
          <h2 id="ls-home-sdp-title">Connect the resilience plan to the next site decision.</h2>
        </div>
        <div>
          <p>SDP already assesses climate risk and invests in drainage, retention and nature-based measures.
            LivingShield proposes a shared concept-review step: what might change locally, what remains
            unresolved, and which survey or engineering check comes next.</p>
          <p className="ls-home-model-note">Proposed first pilot: one Bukit Raja study window, an SDP asset-team sponsor
            and a reviewing engineer. Measure review time and evidence completeness; benefits are not yet validated.</p>
          <a className="ls-home-source-link" href="https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR%202025%20Mobile.pdf#page=93" target="_blank" rel="noreferrer">
            SDP Sustainability Report 2025 · pp. 87–88 ↗
          </a>
          <small className="ls-home-preview-credit">Preview: OSM contributors · Microsoft footprints (CDLA Permissive 2.0) ·
            Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018;
            provided under COPERNICUS by the European Union and ESA; all rights reserved.</small>
        </div>
      </section>

      <section className="ls-home-workflow" aria-labelledby="ls-home-workflow-title">
        <div className="ls-home-section-heading">
          <div>
            <p className="ls-home-eyebrow">THE DECISION, THEN THE TOOLS</p>
            <h2 id="ls-home-workflow-title">
              A place. An option.
              <br />
              A question worth investigating.
            </h2>
          </div>
          <p>
            Rehearse one investigation decision. The bank study is optional; the flood comparison
            can go directly to the brief.
          </p>
        </div>
        <div className="ls-home-workflow-layout">
          <div className="ls-home-steps" role="group" aria-label="Explore the planning workflow">
            {WORKFLOW.map((item, index) => (
              <button
                key={item.number}
                aria-pressed={step === index}
                onClick={() => setStep(index)}
              >
                <span>{item.number}</span>
                <strong>{item.name}</strong>
                <Arrow />
              </button>
            ))}
          </div>
          <article className="ls-home-step-detail" aria-live="polite" aria-atomic="true">
            <span className="ls-home-step-number" aria-hidden="true">
              {current.number}
            </span>
            <div>
              <p className="ls-home-eyebrow">{current.name}</p>
              <h3>{current.title}</h3>
              <p>{current.description}</p>
              <button className="ls-home-text-link" onClick={() => onOpen(current.view)}>
                {current.action}
                <Arrow />
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="ls-home-twin" aria-labelledby="ls-home-twin-title">
        <div className="ls-home-twin-heading">
          <p className="ls-home-eyebrow">01 / THE FLOOD TWIN</p>
          <h2 id="ls-home-twin-title">
            One storm.
            <br />
            Two futures.
          </h2>
          <p>
            See the difference a proposal makes. Keep the storm, terrain, viewpoint and timestamp
            the same.
          </p>
          <button
            className="ls-home-button ls-home-button-primary"
            onClick={() => onOpen('township')}
          >
            Run a township scenario <Arrow />
          </button>
        </div>
        <div className="ls-home-twin-features">
          <article>
            <span>01</span>
            <div>
              <h3>Explore the actual place</h3>
              <p>
                Sourced building footprints, aerial reference and Copernicus surface elevations
                across each 225 ha pilot window.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Let water follow the terrain</h3>
              <p>
                A 2D surface-flow model routes an assumed storm through wet and dry cells. Scrub the
                timeline and inspect the water balance.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Compare local mitigation</h3>
              <p>
                Place storage concepts, rerun, then compare water depth and wet area. Capture is
                bounded by nearby water, inlet rate and remaining capacity.
              </p>
            </div>
          </article>
          <p className="ls-home-model-note">
            Uncalibrated screening on coarse historical surface elevations. Drains, external inflows
            and individual building barriers are not resolved. This is not a flood forecast.
          </p>
        </div>
      </section>

      <section className="ls-home-river" aria-labelledby="ls-home-river-title">
        <div className="ls-home-river-drawing">
          <p className="ls-home-eyebrow">THE PHYSICAL DESIGN CONCEPT</p>
          <ModuleDrawing />
          <div className="ls-home-drawing-caption">
            <strong>LivingShield Triangle Module</strong>
            <span>Form study · nominal 300 mm design</span>
          </div>
        </div>
        <div className="ls-home-river-copy">
          <p className="ls-home-eyebrow">OPTIONAL / A BANK-DESIGN CANDIDATE</p>
          <h2 id="ls-home-river-title">
            One concept.
            <br />A separate set of tests.
          </h2>
          <p>
            When a bank intervention is worth investigating, inspect this supplied concept and
            scope its quantities, material, anchorage and scour tests. It is an optional attachment
            to the decision brief, with no credited flood-storage benefit.
          </p>
          <ul>
            <li>
              <span>01</span> Inspect the actual GLB model and nominal dimensions.
            </li>
            <li>
              <span>02</span> Explore installation and vegetation-establishment stages.
            </li>
            <li>
              <span>03</span> Configure a bank layout and export the declared assumptions.
            </li>
          </ul>
          <button
            className="ls-home-button ls-home-button-secondary"
            onClick={() => onOpen('living-shield')}
          >
            Inspect the module & plan a bank <Arrow diagonal />
          </button>
          <p className="ls-home-model-note">
            A physical design prototype, not a certified structure. Revetment concepts do not
            receive artificial water-storage credit in the flood model.
          </p>
        </div>
      </section>

      <section className="ls-home-film" aria-labelledby="ls-home-film-title">
        <div className="ls-home-section-heading">
          <div>
            <p className="ls-home-eyebrow">THE CONCEPT IN MOTION</p>
            <h2 id="ls-home-film-title">See how the pieces come together.</h2>
          </div>
          <p>
            From the individual module to installation and planting: the original LivingShield
            design animation.
          </p>
        </div>
        <video
          controls
          playsInline
          preload="none"
          poster="/livingshield/bank-established.png"
          aria-label="LivingShield module and riverbank installation concept animation"
        >
          <source src="/livingshield/LivingShield_demo.mp4" type="video/mp4" />
          <track
            kind="captions"
            src="/livingshield/concept-captions.vtt"
            srcLang="en"
            label="English concept notes"
            default
          />
          Your browser cannot play this video.{' '}
          <a href="/livingshield/LivingShield_demo.mp4">Open the LivingShield concept animation</a>.
        </video>
        <p className="ls-home-model-note">
          Concept visualisation, not a hydraulic experiment. Benefits described in the original
          animation are design intentions requiring engineering and ecological validation.
        </p>
      </section>

      <section className="ls-home-toolbox" aria-labelledby="ls-home-tools-title">
        <div className="ls-home-section-heading">
          <div>
            <p className="ls-home-eyebrow">THE WIDER TOOLKIT</p>
            <h2 id="ls-home-tools-title">
              Township detail.
              <br />
              Malaysia-wide context.
            </h2>
          </div>
          <p>
            Connected tools for source discovery, design assumptions and the next engineering
            review—including Sabah, Sarawak and Labuan.
          </p>
        </div>
        <div className="ls-home-tools-grid">
          {TOOLS.map((tool) => (
            <button key={tool.view} onClick={() => onOpen(tool.view)}>
              <ToolIcon kind={tool.symbol} />
              <span>
                <strong>{tool.name}</strong>
                <small>{tool.description}</small>
              </span>
              <Arrow diagonal />
            </button>
          ))}
        </div>
        <div className="ls-home-additional-tools">
          <button onClick={() => onOpen('flood')}>
            Inspect flood hazard context <Arrow />
          </button>
          <button onClick={() => onOpen('property')}>
            Find or define a site <Arrow />
          </button>
          <button onClick={() => onOpen('precipitation')}>
            Explore rainfall observations <Arrow />
          </button>
        </div>
      </section>

      <section className="ls-home-evidence" aria-labelledby="ls-home-evidence-title">
        <div>
          <p className="ls-home-eyebrow">BUILT TO BE QUESTIONED</p>
          <h2 id="ls-home-evidence-title">
            Leave with the next action.
            <br />
            <em>And the evidence behind it.</em>
          </h2>
          <p>
            The output is a specific investigation request: the option compared, what remains
            unknown, a proposed reviewer and the evidence to collect. Engineering review and site
            investigation still determine what can be built.
          </p>
        </div>
        <button
          className="ls-home-button ls-home-button-primary"
          onClick={() => onOpen('evidence')}
        >
          Explore the evidence <Arrow />
        </button>
      </section>

      <footer className="ls-home-footer">
        <div>
          <strong>LivingShield</strong>
          <span>Compare the option. Scope the next investigation.</span>
        </div>
        <p>
          Hackathon planning prototype · Flood twin and riverbank design concept
          <br />
          Source credits are retained in the project notices.
        </p>
        <button className="ls-home-text-link" onClick={() => onOpen('evidence')}>
          Sources & model notes <Arrow diagonal />
        </button>
      </footer>
    </main>
  );
}
