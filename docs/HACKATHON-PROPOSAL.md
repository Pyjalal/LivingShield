# LivingShield: scope the next township flood investigation

Proposal draft • Planet track • Updated 21 October 2026, Asia/Kuala_Lumpur.

Team: [name]. University: [name]. Leader/contact: [complete]. Members/roles: [complete]. Registration closes 21 October; proposal due 23 October 2026. Confirm exact closing times and submission format in participant instructions. No registration or submission has been performed.

## The decision and intended user

**Before SDP commits, show what stays wet.**

LivingShield is a proposed decision workspace for an SDP township asset manager and the engineer reviewing a case. Their immediate task is to compare one hypothetical storage proposal with the same-storm baseline, expose what remains unresolved and scope the next site investigation. The deliverable is an investigation brief with declared inputs, actual computed results and evidence requests. Operator adoption and better decisions are hypotheses to test.

SDP's [2025 Sustainability Report, pp87–88](https://www.simedarbyproperty.com/sites/default/files/2026-04/SDP%20SR%202025%20Mobile.pdf#page=93) identifies BBR/BUP in its flood-risk assessment and records adaptation works. Our proposed bridge from a risk finding to a specific investigation brief is an inference from that context. We do not claim SDP lacks tools, has endorsed this workflow or supplied its private risk assessment. [The evidence note](SDP-JUDGE-NARRATIVE-EVIDENCE.md) records the source and its engineering limits.

Bandar Bukit Raja is the first proposed case. The implemented 1.5 km-square window covers 225 ha of the locality, not the entire township, an ownership boundary or a surveyed catchment. Bandar Universiti Pagoh is a second case requiring its own data and review. Pagoh-area relief evidence cannot establish inundation on specific BUP parcels. City of Elmina is a nature-based design comparator. See [pilot evidence](HACKATHON-EVIDENCE.md).

## Mechanism: one reviewable case

1. **Locate the case.** The asset team identifies the actual question and relevant authorised records. Inspect the pilot's geometry, terrain provenance and missing data.
2. **Declare the comparison.** Record rainfall, duration, runoff, drainage and boundary assumptions. Compare the baseline with one local-storage proposal under the same forcing and terrain.
3. **Examine what remains.** Read matched-time wet area/depth, actual capture, unused capacity and end-of-run water accounting. A smaller modelled wet area does not establish an implementable layout or protected properties.
4. **Scope the next investigation.** Propose a reviewer role, action and evidence requests. A useful first action is to verify surveyed levels, drainage connectivity and boundary conditions before reviewing the storage layout.
5. **Hand over the case.** Export the readable offline brief and full JSON, including gaps and requested evidence. The engineer and asset team agree commissioning and responsibilities outside the prototype. The review plan is browser-local, not an assignment, agency submission or engineering approval.

The [official challenge](https://www.simedarbyproperty.com/universityhackathon/) asks for mechanism and technology enabler. The handover above is the proposed mechanism. Spatial inspection, the numerical comparison and portable evidence are its enablers. An optional physical-bank candidate can travel with the case, but a flood-only investigation brief does not require it.

## What the live case demonstrates

Use Bandar Bukit Raja with **90 mm over 60 minutes**, coefficient **0.70**, assumed drainage **5 mm/h**, Manning n **0.04** and free outfall without external inflow. After the baseline, the preset places twelve hypothetical 1,500 m³ basins with assumed 0.50 m³/s inlets. Rerun and pause at 60 minutes: modelled area at ≥0.10 m changes from **38.5 to 33.2 ha**, with maximum grid depth **0.64 to 0.50 m**.

By the end, actual numerical capture is **17,697.755031 m³ of 18,000 m³**: ten concepts reach capacity and two are partly used. This remains an uncalibrated scenario. The useful question is what needs checking about the remaining water and proposed connections. The preset does not establish land control, access, connectivity or engineering feasibility; partial filling alone does not identify the binding constraint. The [pitch](PITCH-DEMO.md) moves directly from this result to **Review this flood option** and the investigation brief, with the bank branch optional.

## Implemented enabler and model scope

1. Select a township and inspect sourced OpenStreetMap and Microsoft machine-extracted building footprints in the adapted TamanKu 3D engine. Building details identify sources and distinguish mapped heights from assumptions. Aerial comparison supports visual checking; it does not establish survey accuracy.
2. Inspect available JRC 90 m point hazard context alongside source-labelled JPS observations, MET forecasts and existing engineering tools. Regional raster context is not building-level inundation evidence.
3. Declare rainfall, duration and runoff coefficient. The 2D flood domain is the full 225 ha pilot window: 32 × 32 cells sampled from actual Copernicus GLO-30 surface elevations. Regional MSMA profiles require site-specific review; manual rainfall is available. Existing nationwide JPS/MET, HP26 and MSMA tools remain accessible.
4. Run the uncalibrated local-inertial surface-flow model through rainfall and a 30-minute recession. Place concepts manually or use the pooling-point preset: up to twelve 1,500 m³ basins, spaced at baseline pooling cells. Rerun before/after under identical rainfall, terrain and boundary/drainage assumptions; compare at the same camera and timestamp. Each concept captures only locally available water, bounded by its assumed inlet rate and finite capacity.
5. Play or scrub the water animation; inspect modelled wet area, depth, stored volume and conservation. These are screening cell results, not validated inundation at individual homes. The preset is a demonstration heuristic, not an optimised or approved scheme.
6. Export flood JSON containing inputs, terrain provenance, assumptions, local storage results, time frames and both water balances. Review missing data and required surveys before capital approval. Multi-user collaboration remains a pilot candidate.

The separate water-budget mode remains available for an editable planning catchment. For rainfall P in mm, area A in hectares and coefficient C, runoff volume is P × A × C × 10 m³; ideal capture is the smaller of runoff and proposed capacity. That quick volume screen does not route water. The flood mode instead conserves rainfall, runoff loss, local drainage, boundary outflow, storage and remaining surface water while routing water between cells. Published whole-park storage cannot be allocated wholesale to the smaller pilot window.

Copernicus is a historical surface model with canopy/roof returns, not a current bare-earth survey. The 46.9 m grid omits installed drains/sewers, culverts and individual building barriers. External catchment inflow, river stage and tide are excluded; drainage and roughness are uniform assumptions. No measured-event calibration establishes parcel depths, safe routes or avoided losses. See [terrain sources](FLOOD-TERRAIN-SOURCES.md) and [numerical verification with actual pilot experiments](FLOOD-MODEL-VALIDATION.md).

## Optional physical candidate and connected evidence

The principal route is place → storage comparison → investigation brief. River Lab is an optional candidate-design branch within the same selected-township context. River Lab loads the supplied LivingShield GLB at metre scale, offers existing-bank, installed-module and planting-concept stages, and estimates nominal module packing from declared bank length, height and slope. The default 6.6 m by 0.8 m scenario at 32 degrees uses 261 modules plus 27 spares. A blank unit rate remains unknown; an entered rate is a user assumption, and the subtotal excludes installation, anchorage, planting and site works. The supplied film, GLB and STL remain inspectable with source hashes.

The physical bank is one unvalidated candidate for a separate engineering/test decision. A storage-only first pilot can scope that work separately. Stability, scour, ecological establishment and any hydraulic benefit require engineering and field tests. These modules receive no water-storage or flood-reduction credit in the surface-flow solver. The brief combines completed flood inputs/results and bank quantities for the same selected pilot, retains each completed comparison during navigation, and exports missing sections explicitly. A printable HTML brief works offline, while the full JSON retains numerical frames and provenance. The four-step guide explains the next action and actual attachment state. Editable Blender projects and original generation scripts accompany the design exports with source hashes.

## Differentiation and impact hypothesis

The demonstrated combination joins a same-storm storage comparison, local capture limits, visible remaining wet area and a portable review request in one pilot context. The [all-project judge review](JUDGE-COMPARISON-ALL-PROJECTS.md) records the discovered public demos and source-only candidates. Other projects offer 3D, scenarios, bilingual access and follow-up workflows. Those features alone do not establish originality or superiority.

LivingShield adapts HydroGrid hydrology tools and the TamanKu 3D base, retaining credits and identifying the new integration. A renamed interface must not be presented as an independently built engine. The proposed value is clearer preparation of a case entering engineering investigation. Faster preparation, fewer untraced assumptions, willingness to pay and successful portfolio use require operator evidence. Flood, damage, operating-cost and construction-cost reductions have not been demonstrated.

## A bounded 90-day operator pilot

The [public prototype](https://livingshield-malaysia.fly.dev/) supports the comparison, actual-result explanation, review plan and HTML/JSON handover. Numerical tests and independent checks cover accounting, wet/dry positivity, lake equilibrium, limited capture and actual-terrain experiments; they do not establish observed-event accuracy. Public deployment and reproducible workflow checks are recorded in [deployment verification](FLY-DEPLOYMENT.md).

Request one suitable SDP case, an asset-team sponsor, an engineering reviewer and a bounded authorised data pack. Agree the baseline task and acceptance criteria before starting. No pilot agreement is claimed.

| Phase | Work and decision gate |
| --- | --- |
| Days 1–30 | Observe the existing briefing task; confirm asset responsibility and permissions; reconcile the case question, terrain, drains and boundaries. The reviewer identifies critical missing data and whether the prototype is suitable for the task. |
| Days 31–60 | Prepare one reviewed comparison and investigation brief. Verify calculations independently and record where survey, installed-network modelling, calibration or bank testing requires separately commissioned work. |
| Days 61–90 | Test comparable briefing tasks with 5–8 operators/reviewers, record assistance and failures, and compare with the agreed baseline. Decide whether to revise, stop or prepare a second township case. |

| KPI | Measurement protocol | Proposed acceptance target |
| --- | --- | --- |
| Brief preparation time | Same tasks/source pack before and after; report median and sample size | 20% lower median time |
| Review traceability | Reviewer connects inputs, results, sources and evidence requests | 100% required fields |
| Calculation consistency | Independent calculations and conservation checks within agreed tolerances | No unresolved unit/accounting errors |
| Operator usability | Comparable tasks, assistance and failure log | 80% unaided completion |
| Data suitability | Reviewer records age, resolution, permissions and missingness | Every critical gap visible; stop the task if unsuitable |

These are unvalidated targets. Small samples do not establish portfolio-wide effectiveness. Scaling requires a suitable data pack and engineering review for each township. Avoided flood losses need appropriate long-term observations and calibrated modelling outside this workflow trial.

## Commercial workflow and budget assumptions

The proposed sponsor is SDP's township asset function with an engineering reviewer; development and sustainability teams are additional stakeholders. We need to validate the task owner, current tools, data access, procurement route and willingness to pay. No contract, subscription sale or operational integration is claimed.

The first value test is whether a combined case reduces briefing effort while meeting the engineer's evidence requirements. Portfolio expansion repeats an accepted case template, with new local data and review. A product price or return on investment cannot yet be defended from this prototype.

The following earlier allowance is retained for internal scoping, not as the opening funding ask. Replace it with an agreed scope and quotations before a funding request.

Illustrative 90-day allowance: engineering/data review RM45,000; product/integration RM25,000; targeted survey/data acquisition RM10,000; hosting/operations RM5,000; contingency RM15,000. Total RM100,000. These are scoping assumptions, not quotes or commitments. Existing staff time, detailed hydraulic modelling and infrastructure construction are excluded. The student prototype assumes existing laptops and RM500–RM2,000 hosting/data allowance; external paid assets need separate approval.

| Judging criterion | Weight | Proposed evidence |
|---|---:|---|
| Strategic Fit & Theme Relevance | 15% | Named SDP case, intended asset-manager/engineer task and Planet connection |
| Impact & Sustainability Value | 25% | Resident/environmental rationale and measured workflow pilot; no invented flood-loss benefit |
| Innovation & Differentiation | 20% | Honest comparison, actual integration and testable handover hypothesis |
| Feasibility & Deliverability | 20% | Running comparison, bounded data requirements and suitable-case gate |
| Commercial & Value Multiplication | 10% | Identified sponsor/user, baseline task and repeatable reviewed case template |
| Team, Evidence & Pitch Quality | 10% | Completed team record, primary sources and reproducible demo |

## Participant IP and AI review

Participants must review [official terms](https://www.simedarbyproperty.com/universityhackathon/terms-and-conditions/) personally before agreeing/submitting. Clauses 11–12 assign programme-developed IP/submissions to SDP and require broad necessary Background IP rights and full disclosure. Clause 13 requires material AI disclosure. Licence compatibility and organiser acceptance are not guaranteed by this draft.

| Material | Disclosure/action |
|---|---|
| Sadat41/HydroGrid | Pre-existing third-party MIT code; retain copyright/licence and identify imported commit |
| New LivingShield code/documents | Identify actual authors, chronology and additions; distinguish pre-programme Background IP from Developed IP |
| OpenStreetMap | ODbL data; retain attribution and assess applicable database/share-alike obligations |
| Microsoft Global ML Building Footprints | CDLA-Permissive 2.0; full licence included with each supplement. August 2026 catalogue is not an imagery date. Geometry is machine-extracted, may miss or falsely detect buildings, and all supplement display heights are assumed 6 m |
| Copernicus GLO-30 DSM | Actual public elevation windows, bilinearly resampled to 32 × 32 cells. Retain required Copernicus source notice with cached data and exports; historical surface elevations are not surveyed ground levels |
| JRC | Identify exact product/version/resolution/return period and applicable licence |
| Malaysian sources | Record source-specific terms, attribution, age and restrictions; public access alone is not redistribution permission |
| TamanKu 3D base | Actual local prototype adaptation, with upstream credits retained. No licence or permission for redistribution/submission has been documented; identify imported revision and review rights before submitting or redistributing |
| User-supplied LivingShield design | Blender script, module GLB/STL and concept animation supplied locally; retain authorship/source record. Geometric audit is not structural, hydraulic or ecological validation |
| AI tools | Disclose material Codex research/coding/drafting and other tools actually used; team verifies outputs |

Complete team fields, dependency versions, upstream revision and licence inventory before submission. Confidential SDP programme materials must not be published through this demo. Source and schedule details: [official programme](https://www.simedarbyproperty.com/universityhackathon/).
