import type { Township } from '../township/model';
import type { BankEvidence, FloodEvidence } from './evidence';
import { parseReviewPlan, REVIEW_EVIDENCE, REVIEW_STAGES, type ReviewPlan } from './reviewPlan.ts';
import { summarizeFloodComparison } from '../township/flood/insights.ts';
import { INVESTIGATION_DECISION } from './decisionContext.ts';

const escape = (value: unknown) =>
  String(value ?? 'Unknown').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const fmt = (value: number, digits = 1) =>
  value.toLocaleString('en-MY', { maximumFractionDigits: digits });
const rows = (items: [string, string][]) =>
  items
    .map(
      ([label, value]) => `<tr><th scope="row">${escape(label)}</th><td>${escape(value)}</td></tr>`,
    )
    .join('');

export function buildReadableBrief(
  township: Township,
  flood: FloodEvidence | null,
  bank: BankEvidence | null,
  exportedAt = new Date().toISOString(),
  reviewPlan: ReviewPlan | null = null,
) {
  const activeFlood = flood?.townshipId === township.id ? flood : null;
  const activeBank = bank?.townshipId === township.id ? bank : null;
  const before = activeFlood?.comparison.before.metrics;
  const after = activeFlood?.comparison.after.metrics;
  const insight = activeFlood ? summarizeFloodComparison(activeFlood.input, activeFlood.comparison) : null;
  const parsedReview = parseReviewPlan(reviewPlan, township.id);
  const activeReview = parsedReview?.updatedAt ? parsedReview : null;
  const terrainSource = activeFlood?.input.terrain.source;
  const terrainNotice =
    terrainSource && typeof terrainSource === 'object' && 'attribution' in terrainSource
      ? terrainSource.attribution
      : 'Terrain source and attribution are retained with the full result export.';
  const floodContent =
    activeFlood && before && after
      ? `
    <p>Completed ${escape(activeFlood.capturedAt)}. Both cases use identical rainfall and background assumptions.</p>
    <table>${rows([
      [
        'Rainfall / duration / runoff coefficient',
        `${fmt(activeFlood.input.rainfallMm)} mm / ${activeFlood.input.durationMinutes} min / C ${activeFlood.input.runoffCoefficient}`,
      ],
      [
        'Model domain',
        `${activeFlood.input.terrain.cols} × ${activeFlood.input.terrain.rows} cells · ${fmt((activeFlood.input.terrain.cols * activeFlood.input.terrain.rows * activeFlood.input.terrain.dxM * activeFlood.input.terrain.dzM) / 10000)} ha pilot window`,
      ],
      [
        'Assumed drainage / roughness / boundary',
        `${activeFlood.input.drainageMmPerHour ?? 'Unknown'} mm/h / Manning n ${activeFlood.input.roughnessManning ?? 'Unknown'} / ${activeFlood.input.boundary ?? 'Unknown'}`,
      ],
      [
        'Storage concepts',
        `${activeFlood.input.proposals?.length ?? 0} concepts; ${fmt(
          (activeFlood.input.proposals ?? []).reduce((sum, p) => sum + p.capacityM3, 0),
          0,
        )} m³ assumed capacity`,
      ],
      [
        'Rainfall selection basis',
        String(activeFlood.rainfallSource.selectionBasis ?? 'See full source-linked result export'),
      ],
    ])}</table>
    <h3>Computed comparison</h3>
    <table class="comparison"><thead><tr><th>Metric</th><th>Before storage</th><th>After storage</th></tr></thead><tbody>
      <tr><th scope="row">Independent peak wet area ≥0.10 m</th><td>${fmt(before.peakWetAreaM2 / 10000, 2)} ha</td><td>${fmt(after.peakWetAreaM2 / 10000, 2)} ha</td></tr>
      <tr><th scope="row">Independent maximum grid depth</th><td>${fmt(before.peakDepthM, 3)} m</td><td>${fmt(after.peakDepthM, 3)} m</td></tr>
      <tr><th scope="row">Water stored by end of run</th><td>${fmt(before.totalStoredM3, 0)} m³</td><td>${fmt(after.totalStoredM3, 0)} m³</td></tr>
      <tr><th scope="row">Surface water at end of run</th><td>${fmt(before.finalSurfaceM3, 0)} m³</td><td>${fmt(after.finalSurfaceM3, 0)} m³</td></tr>
      <tr><th scope="row">Water-balance residual</th><td>${before.massErrorM3.toExponential(2)} m³</td><td>${after.massErrorM3.toExponential(2)} m³</td></tr>
    </tbody></table>
    <p class="note">Each peak is calculated independently and can occur at a different time. These are uncalibrated cell results, not observed floods or building/floor depths. Compare matched timestamps in the interactive twin; the full JSON includes every frame.</p>
    ${insight && insight.proposalCount > 0 ? `<h3>What the storage actually used</h3><p>By the end of the run, ${fmt(insight.storedM3, 0)} m³ was captured from ${fmt(insight.capacityM3, 0)} m³ of declared capacity; ${fmt(insight.unusedCapacityM3, 0)} m³ remained unused. ${insight.counts.full} concepts were full, ${insight.counts.partial} partly used and ${insight.counts.unused} unused.</p><p class="note">These are end-of-run model outputs. Partly used or unused storage does not establish which constraint controlled capture: water reaching each cell, inlet rates and the other modelled flows all matter. No location or design suitability is inferred. The JSON includes every concept’s actual capture and declared inlet rate.</p>` : '<p class="note">No storage concepts were included in this completed run; it is a baseline comparison.</p>'}
    <details open><summary>Why the cases can differ</summary><p>Rainfall × runoff coefficient supplies surface water. The model routes it across the elevation grid, with assumed drainage and boundary outflow. Only water reaching a storage cell can be captured, up to that concept’s inlet rate and finite capacity. The after-case receives no bank-module benefit.</p><p>${escape(terrainNotice)}</p></details>
  `
      : `<p class="missing">No completed flood comparison is attached for ${escape(township.name)}. Missing results do not establish low risk.</p>`;
  const bankContent = activeBank
    ? `
    <p>Concept captured ${escape(activeBank.capturedAt)}. Nominal triangular packing; not a construction specification.</p>
    <table>${rows([
      [
        'Declared bank length / vertical height / slope',
        `${fmt(activeBank.inputs.lengthM)} m / ${fmt(activeBank.inputs.heightM)} m / ${activeBank.inputs.slopeDegrees}° from horizontal`,
      ],
      ['Nominal sloped bank area', `${fmt(activeBank.quantities.bankAreaM2, 2)} m²`],
      [
        'Whole-course layout',
        `${activeBank.quantities.rows} rows × ${activeBank.quantities.columns} nominal columns`,
      ],
      [
        'Installed modules / spares / order quantity',
        `${activeBank.quantities.installedModules} / ${activeBank.quantities.spareModules} / ${activeBank.quantities.orderModules} units`,
      ],
      [
        'Entered unit rate · user supplied, unverified',
        activeBank.inputs.unitRateMyr === null
          ? 'Unknown; awaiting a supplier quotation'
          : `RM ${fmt(activeBank.inputs.unitRateMyr, 2)} per module`,
      ],
      [
        'Module-only supply subtotal',
        activeBank.quantities.moduleSubtotalMyr === null
          ? 'Unknown; no price assumed'
          : `RM ${fmt(activeBank.quantities.moduleSubtotalMyr, 2)}`,
      ],
    ])}</table>
    <p class="note">Excludes installation, anchorage, planting, site works, delivery, tax and maintenance. No surveyed bank location or suitability is inferred from the selected township. Stability, scour, material strength, hydraulic and ecological benefits remain unvalidated.</p>
  `
    : `<p class="missing">No bank concept is attached for ${escape(township.name)}. Module quantities and costs remain unknown.</p>`;
  const reviewContent = activeReview
    ? `<p class="note">Authored ${escape(activeReview.updatedAt)}. Local planning only; no external submission, assignment or engineering approval.</p><table>${rows([
      ['Author-selected status', activeReview.status === 'prepared-for-review' ? 'Prepared for review' : 'Draft'],
      ['Next review stage', REVIEW_STAGES.find((stage) => stage.id === activeReview.stage)!.label],
      ['Proposed reviewer role', activeReview.reviewerRole.trim() || 'Not specified'],
      ['Next action', activeReview.nextAction.trim() || 'Not specified'],
      ['Target review date', activeReview.targetDate ?? 'Not specified'],
    ])}</table><h3>Evidence requested for the next conversation</h3>${activeReview.requestedEvidence.length ? `<ul>${REVIEW_EVIDENCE.filter((item) => activeReview.requestedEvidence.includes(item.id)).map((item) => `<li>${escape(item.label)}</li>`).join('')}</ul>` : '<p>No evidence requests selected.</p>'}<p class="note">Selected items are requests, not verified or collected evidence. A proposed role does not assign a person or agency. Prepared status is the author’s local designation and does not change model or design validity.</p>`
    : '<p class="missing">No authored local review plan is attached for this township. Reviewer role, next action and target date remain unspecified.</p>';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LivingShield · ${escape(township.name)} · Review brief</title>
  <style>body{margin:0;background:#f4f3ea;color:#203f3e;font:15px/1.6 'Segoe UI',Arial,sans-serif}main{max-width:1000px;margin:auto;padding:44px 28px}header{border-bottom:2px solid #285f58;padding-bottom:24px}h1,h2{font-family:Georgia,serif;font-weight:400;line-height:1.15}h1{font-size:40px;margin:12px 0}h2{font-size:28px;margin-top:0}h3{font-size:16px}.brand{font-size:12px;letter-spacing:2px;font-weight:700}.meta,.note{font-size:12px;color:#52685f}section{background:#fffef7;border:1px solid #c7d3bd;border-radius:6px;padding:24px;margin:24px 0}table{width:100%;border-collapse:collapse;font-size:13px;overflow-wrap:anywhere}th,td{padding:11px 10px;border-bottom:1px solid #c7d3bd;text-align:left;vertical-align:top}th{font-weight:600;width:48%}.comparison th{width:auto}.comparison thead{background:#e2ece0}.missing{background:#f5e9d0;padding:15px;border-left:3px solid #895120}a{color:#285f58}details{margin-top:20px}summary{font-weight:600}li{margin:5px 0}@media(max-width:600px){main{padding:24px 14px}section{padding:16px}h1{font-size:32px}th,td{padding:8px 5px;font-size:12px}}@media print{body{background:white}main{padding:0}section{break-inside:avoid}a{color:inherit}}</style></head><body><main>
  <header><div class="brand">LIVINGSHIELD / SITE-INVESTIGATION BRIEF</div><h1>${escape(township.name)}</h1><p>Compare the option. Scope the next investigation.</p><p class="meta">${escape(township.state)} · exported ${escape(exportedAt)}<br>${Number(!!activeFlood) + Number(!!activeBank)} of 2 available attachments included · bank study optional</p></header>
  <section><h2>The decision this brief supports</h2><table>${rows([
    ['Intended user', INVESTIGATION_DECISION.intendedUser],
    ['Investigation question', INVESTIGATION_DECISION.question],
    ['Next decision', INVESTIGATION_DECISION.requestedDecision],
    ['Take-away', INVESTIGATION_DECISION.output],
  ])}</table><p>${escape(INVESTIGATION_DECISION.boundary)}</p><p class="note">${escape(INVESTIGATION_DECISION.bankConcept)}</p>${after ? `<p>The after-case ${after.peakWetAreaM2 > 0 ? 'still reaches' : 'reaches'} ${fmt(after.peakWetAreaM2 / 10000)} ha at ≥0.10 m within this model window. This is an independent event peak, not the selected playback frame or observed affected homes.</p>` : '<p class="missing">No completed flood result is attached; do not draw a result-based conclusion from this brief.</p>'}</section>
  <section><h2>01 / The storm and storage comparison</h2>${floodContent}</section>
  <section><h2>02 / Optional bank-design concept</h2>${bankContent}</section>
  <section><h2>03 / The local review handover</h2>${reviewContent}</section>
  <section><h2>04 / Before a site decision</h2><ul><li>Obtain surveyed bare-earth levels, drainage connectivity and asset capacities.</li><li>Establish river, tidal and neighbouring-catchment boundary conditions.</li><li>Calibrate against observed flood events before relying on site depths.</li>${activeBank ? '<li>For the attached bank concept: test materials, connectors, anchorage, scour and vegetation suitability; obtain installation quotations and review maintenance/approvals.</li>' : ''}<li>Obtain quotations for the scoped survey or model study; works costs need detailed design.</li></ul><p>The flood model omits installed pipes, culverts and individual building barriers. The physical design film illustrates intentions rather than tested outcomes. No avoided losses, safe routes or validated flood reduction are established by this brief.</p></section>
  <footer><h2>Sources and background</h2><p><a href="https://registry.opendata.aws/copernicus-dem/">Copernicus GLO-30</a> · <a href="https://wplb.water.gov.my/assets/msma-2nd-edition.pdf">JPS MSMA</a> · <a href="https://doi.org/10.1016/j.jhydrol.2010.03.027">Surface-routing method</a></p><p class="note">Software background: <a href="https://github.com/Sadat41/HydroGrid">Hydrology software / Team Redacted</a> and the adapted township rendering engine; original credits retained in the <a href="https://livingshield-malaysia.fly.dev/tamanku/THIRD_PARTY.md">project source notices</a>. Physical concept: user-supplied LivingShield Blender projects, generator, GLB, STL and animation, preserved with source hashes. Consult the full JSON and project source notices for detailed provenance and permissions.</p></footer>
  </main></body></html>`;
}

export function downloadReadableBrief(
  township: Township,
  flood: FloodEvidence | null,
  bank: BankEvidence | null,
  reviewPlan: ReviewPlan | null = null,
) {
  const url = URL.createObjectURL(
    new Blob([buildReadableBrief(township, flood, bank, undefined, reviewPlan)], { type: 'text/html;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `LivingShield-${township.id}-review-brief.html`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
