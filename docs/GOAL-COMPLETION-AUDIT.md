# LivingShield completion audit

Baseline audited 21 October 2026 against commit **`8e4e322`**. Targeted native closure checks on the later working tree at `http://127.0.0.1:5180/` now close the bounded G1–G4 corrections, as detailed below. The baseline matrix and findings remain historical evidence. This is an evidence review, not a declaration that every competitor feature or real-world performance claim has been verified. No application code was edited during this closure review.

## Scope and evidence standard

The requested outcome is a Malaysian township flood-planning project, adapted from HydroGrid and the requested TamanKu engine, with a realistic before/after demonstration; a visual and feature benchmark of publicly discoverable hackathon projects; meaningful integration of the supplied LivingShield design folder; one product identity; and a functional landing page exposing the project’s features. Earlier requests also require nationwide Malaysian context, including Sabah and Sarawak, honest missing-data treatment and visual checking against real places.

“Incorporate the LivingShield folder” means incorporating its useful design assets and reproducible design source into the project. It does **not** require serving every generated render frame, log or temporary contact sheet as a new product feature. “All competitors” can be evaluated against a reproducible public discovery boundary; it cannot establish coverage of private, unindexed or future entrants. No evidence can establish that a hackathon win is guaranteed.

- **Proved:** implementation and a specific inspected artifact or executable assertion support the bounded claim.
- **Weak:** partial or indirect evidence exists, or the claim is broader than the recorded check.
- **Missing:** the particular required implementation or evidence was absent at the audited commit.

Recorded runtime evidence is distinguished from fresh execution. This audit inspected source, hashes, JSON reports and saved screenshots; it did not rerun all production workflows or every competitor journey. Prior production and visual checks are reported with their actual scope.

## Requirement matrix

| Requirement | Classification at `8e4e322` | Evidence and practical limit |
| --- | --- | --- |
| Malaysian adaptation retains the original analytical tools | Proved, bounded | The active entry imports `src/App.tsx`; its 13 views retain maps, assets, hazard, river, precipitation, property, engineering, storm simulation and cost workflows alongside home, townships, River Lab and evidence. [Rendered matrix](QA-LIVINGSHIELD-UNIFIED.md) covers navigation and appearance; it does not independently revalidate every remote data request. |
| Nationwide context, including Sabah and Sarawak | Proved, bounded | [Rainfall/source records](MALAYSIAN-DATA.md), [East Malaysian extraction](SOURCES-EAST-IDF.md) and [national QA](QA-NATIONAL-MALAYSIA.md) support 309 published profiles and different national/regional inventory footprints. This is not a claim of complete nationwide underground networks, official parcel coverage or surveyed flood extents. |
| Actual TamanKu engine reuse and real-place inspection | Proved, bounded | `src/township/scene.tsx` loads the adapted `/tamanku/index.html`; upstream attribution is retained. [Visual accuracy record](VISUAL-ACCURACY.md) and [pilot QA](QA-TAMANTAHAN.md) distinguish sourced geometry/terrain from illustrative heights/facades and record the Elmina discrepancy. Only three 225 ha windows are modelled, not all Malaysian townships. |
| Terrain-dependent flooding and before/after mitigation | Proved as numerical screening | [Production results](../app/output/playwright/ls-flow-results.json), [combined brief](../app/output/playwright/ls-resilience-brief.json) and `scripts/verify-livingshield.py` support a 90 mm/60 min Bukit Raja comparison, 12 finite storage concepts, 61 frames per case and conserved water bookkeeping. Uncalibrated historical DSM and omitted networks/inflows preclude validated event, floor-depth or flood-forecast claims. |
| Competitor discovery and feature inventory | Proved as source discovery; weak as verified feature comparison | The committed [roster](competitor-roster.json) records 67 candidates, 58 self-identified and nine unconfirmed. Repository claims are labelled. They are not verified features or an organiser roster. |
| Visual comparison of discovered public pages | Proved for short desktop inspections | The committed [run ledger](competitor-browser-runs.json) records all 27 discovered non-video pages across 23 projects: 14 completed, eight budget-exhausted, three blocked, one failed and one cancelled. All 27 have screenshot-inspection records. [Visual benchmark](COMPETITOR-VISUAL-BENCHMARK.md) grades observed hierarchy/coherence/task clarity and retains failure limits. No competitor mobile pass is recorded. |
| Functional comparison of every advertised competitor feature | Missing as a broad completion claim | Most runs execute zero to six actions and commonly assert URL/navigation, not calculation or full task success. The ledger’s visual rubric explicitly leaves `functionalScore` null. Givlah’s linked video is unplayed at the baseline. This does not invalidate the completed visual benchmark; it prevents presenting that benchmark as exhaustive feature verification. |
| Supplied LivingShield geometry, film and renders integrated natively | Proved | Six web assets match the supplied files byte-for-byte. River Lab loads the actual GLB through `GLTFLoader`, exposes GLB/STL downloads, shows installation concepts and computes declared bank quantities. Landing and River Lab play the original local film with concept captions. No separate external app is embedded for this design module. |
| Editable LivingShield source incorporated reproducibly | Missing at baseline | The generator hash is recorded, but `livingshield.py`, `make_video.py`, both `.blend` projects and support scripts are absent from the repository. [Asset notes](LIVINGSHIELD-ASSETS.md) explicitly say full projects remain in the local source folder. This is a source-packaging gap, not absence of the working module viewer. |
| One product brand and coherent appearance | Proved for the main shell/themes; weak for all copy | App title, metadata, favicon, header and main exports use LivingShield. Inspected light/dark/mobile contact sheets show a coherent forest/cream system. Three active analytical empty-state footers still present HydroGrid Malaysia as the product name. Retained source credit to HydroGrid and TamanKu is appropriate and should remain. |
| Landing page explains and opens the project’s features | Proved for 11 workspace destinations; one discoverability gap | Hero/workflow/toolkit buttons call actual native view callbacks. `LandingView` contains townships, River Lab, evidence, national maps, drainage, river, precipitation, property, engineering, simulation and costs. The separate `flood` destination is absent from that union and has no direct landing entry; it remains reachable from the header. |
| Guided native demo, shared context and evidence handover | Proved for navigation/state/export; weak for task guidance | The four-step bar opens the twin, River Lab and evidence. Production checks verify matching township context, saved results/quotes and return navigation. At baseline, Explore and Compare open the same view with no contextual task instruction or progress condition; the detailed action sequence lives in [the pitch script](PITCH-DEMO.md). |

## Direct integration checks

The supplied source is `C:/Users/Shahjalal/Documents/LivingShield`. The audit found **567 files, 1,349,484,691 bytes**, including 554 PNGs, two editable Blender projects, three Python scripts, two shell scripts, the GLB/STL, the film, caption graph and logs. Its main generator builds Studio and River scenes, procedural geometry/materials, vegetation, placement and camera animation. Its water uses visual animation rather than a hydraulic solver.

Independent SHA-256 comparisons returned exact source matches for:

| Web asset | Supplied original | Result |
| --- | --- | --- |
| `module_triangle.glb` | `module_triangle.glb` | Match |
| `module_triangle.stl` | `module_triangle.stl` | Match |
| `LivingShield_demo.mp4` | `LivingShield_demo.mp4` | Match |
| `bank-established.png` | `stills/River_0330.png` | Match |
| `bank-before.png` | `stills/River_0001.png` | Match |
| `module-studio.png` | `stills/Studio_0045.png` | Match |

The detailed browser viewer uses the actual 33,886-triangle source mesh. The configurable bank overview uses simplified instanced geometry, which [the integration record](LIVINGSHIELD-ASSETS.md) discloses. That is a reasonable rendering decision, not proof the source model was discarded. The original film preserves its animated Studio/River presentation. Requiring an interactive reproduction of every Blender camera keyframe or a gallery of all frame caches would add unasked scope.

Nominal 300 mm design dimensions, measured GLB bounds, unknown quotations and proposed ecological/engineering benefits are distinguished in the app. The bank modules do not receive invented flood-storage credit. The source video’s stronger benefit language is surrounded by explicit concept-stage notes and added captions.

## Baseline findings

### G1 — Finish active product-name replacement

**Weak / small copy correction.** At the baseline, `src/components/EngineeringView.tsx:81`, `StormSimulationView.tsx:302` and `CostAnalysisView.tsx:770` contain `HydroGrid Malaysia · Original Team Redacted`. Replace the leading product identity with LivingShield while retaining an explicit original-source credit. Check the three rendered empty states and exported captures.

`src/malaysia/App.tsx` and its `DesignPanel` also contain older branding, but the active `main.tsx` imports the root App and does not mount that legacy App. These dead-entry strings should not be presented as three more broken active pages. Source notices, engine names, historical QA filenames, attribution and stable storage/message keys are not product-brand defects by themselves.

### G2 — Add the missing landing entry for Flood Hazard

**Weak / discoverability correction.** `src/landing/LandingPage.tsx:4–16` excludes `flood`, while `src/platform/evidence.ts` and `src/App.tsx` support it. The toolkit explains modelled flood context indirectly under National maps. Add an explicit hazard entry with truthful screening language, then verify that clicking it activates the actual `flood` view. No new hazard model is required.

### G3 — Package the editable supplied source

**Missing / reproducibility correction.** Include the supplied generator, editable Blender projects and supporting build scripts in a traceable source package or source directory with hashes and reproduction notes. Exclude generated frame caches/logs unless useful to reproduction. Verify copied bytes against the local originals and expose a sensible source/provenance path. Do not claim the browser executes Blender or that mesh checks certify engineering performance.

### G4 — Make the guided route sequence explain its next action

**Weak / demo-clarity correction.** `src/App.tsx:500–523` records only selected step and target view. Add brief per-step instructions for selecting a place, declaring/running/comparing a storm, configuring the separate bank concept and exporting the brief. Reuse existing controls and evidence; no account system, resident incident workflow, operational assignment engine or fabricated result is required. Check desktop and mobile entry, each step, close/return behaviour and incomplete-evidence messaging.

### G5 — Keep competitor completion language aligned with evidence

**Weak to missing, depending on the claim.** The source inventory and short desktop visual pass are real deliverables. Exhaustive functional testing is not established by URL assertions, a screenshot or maintainer descriptions. For any stronger feature-comparison statement, name the tested feature, actions, observed result and limits for that project; otherwise retain “claimed”, “observed” or “untested”. Do not rank a failed automated run as a failed product without product evidence.

The committed baseline had **23 source-page runs / 50 total runs**. The final public search and completed continuation now record **68 repository candidates, 45 source-page attempts, 31 app-page attempts and one opening-video observation: 77 Jev records**. Counts and limits are reconciled in [the coverage audit](COMPETITOR-COVERAGE-AUDIT.md). These records preserve failed and incomplete attempts. The separate [primary functional supplement](COMPETITOR-FUNCTIONAL-CHECKS.md) covers eight projects and [secondary supplement](COMPETITOR-FUNCTIONAL-SECONDARY.md) covers the other 15. All 23 discovered public projects have a named observed interaction or access boundary, with bounded mobile evidence. This does not turn every maintainer feature claim into a verified implementation.

## Evidence inspected and remaining closure checks

Inspected saved contact sheets: `ls-contact-light.png`, `ls-contact-dark-1440.png`, `ls-contact-terminal-390.png`; connected production capture `ls-flow-brief.png`; source/quantity/model files; asset/source hashes; four 13-view JSON appearance reports; production `ls-flow-results.json`; competitor roster, run ledger and benchmark records. The appearance reports record zero JavaScript page errors and no document overflow. Internal scroll detections exist for some small elements; they are not equivalent to document overflow or proof that every text fragment has ideal layout.

The recorded production export has both completeness flags true, the matching Bukit Raja context, 261 installed modules plus 27 spares, and 288 ordered modules. Its RM50 rate and RM14,400 module subtotal are **test inputs/results**, not a supplier quotation. Peak wet areas and conservation results establish the example’s numerical bookkeeping, not physical flood accuracy.

The baseline called for targeted G1–G4 closure and reconciled competitor claims under G5. The closure evidence below addresses the four implementation corrections. The audit does not require copying 1.3 GB of frame caches, adding competitor features to this product, deploying, submitting, contacting entrants or claiming validated flood/structural/ecological performance.

## Working-tree closure: native desktop and mobile checks

Fresh checks used an isolated Playwright CLI browser against port 5180 at **1440 × 1000** and **390 × 844**, with light desktop and dark mobile guide scenes. This was a supplemental native-app check, separate from the parent reviewer's Jev run. JSON reports distinguish assertions from screenshots. The reviewer opened the saved guide, export and offline-brief images; initial mobile loading frames were replaced after their native views settled.

| Finding | Current classification | Fresh proof and practical limit |
| --- | --- | --- |
| G1: active product-name copy | **Closed for the three identified active footers** | Drainage Design, Storm Simulation and Cost Analysis render `LivingShield · Adapted from HydroGrid / Team Redacted`. All three native PNG downloads completed with `LivingShield_…` filenames and the LivingShield header. [Brand report](../app/output/playwright/closure-brand-results.json) and [scrolled Cost view](../app/output/playwright/closure-brand-cost.png) preserve the assertions and visible credit. The Cost PNG export captures the sidebar's top position, leaving its below-fold footer outside that PNG; this is a scroll-capture limitation, not evidence of old branding. |
| G2: direct Flood Hazard landing entry | **Closed** | Clicking `Inspect flood hazard context` activates the actual Flood Hazard tab and visible Leaflet map at both widths. The desktop sidebar exposes modelled JRC depth context and separately labelled PLANMalaysia/Klang records, including the non-regulatory/return-period limitations. [Desktop](../app/output/playwright/closure-guide-desktop-results.json) and [mobile](../app/output/playwright/closure-guide-mobile-results.json) reports record the callback result. This adds discoverability, not a new validated flood model. |
| G3: editable supplied source | **Closed for preservation and access** | Seven source files are present in `public/livingshield/source/`, with README generation notes and manifest sizes/hashes. Each file's original, repository copy, HTTP-served bytes and manifest SHA-256 matched. The native `Editable Blender scene` link downloaded the 10,656,376-byte scene with the same SHA-256. [Hash report](../app/output/playwright/closure-source-hashes.json) and [download report](../app/output/playwright/closure-download-results.json) record all results. Blender regeneration and engineering suitability were not certified by this check. |
| G4: contextual task guidance and handover | **Closed for the requested four-step guide** | Each step now has a concrete next action. Desktop checks cover no comparison, completed baseline, rerun with 12 storage concepts, bank attachment, and 0/2 and 2/2 section states. Mobile checks cover all four next steps and the partial 1/2 state. Detour/return, Finish and Close work; Finish/Close retain the active native workspace. [Desktop guide](../app/output/playwright/closure-guide-desktop-results.json), [mobile guide](../app/output/playwright/closure-guide-mobile-results.json) and [settled mobile scenes](../app/output/playwright/closure-guide-mobile-settled-results.json) record zero JavaScript page errors and no document overflow. This does not validate the hydraulic or bank concept physically. |

The seven preserved editable files are `captions.ffgraph`, `livingshield.py`, `livingshield_scene.blend`, `make_video.py`, `module_triangle.blend`, `render_all.sh` and `still.sh`. The source notes disclose the generator's output replacement behaviour, Blender/FFmpeg/font dependencies, illustrative animation and unvalidated benefits. The browser serves these sources; it does not execute them. Generated frame caches and logs remain in the original folder.

### Downloaded readable brief

The new `Download readable brief` control produced an HTML file alongside the existing full JSON export. Both a completed Bukit Raja brief and an empty Pagoh brief were downloaded through the native UI. Each HTML was opened at desktop and mobile widths with the browser offline and JavaScript disabled: **zero scripts, zero external assets and no document overflow**. Sources remain ordinary links, usable when a connection is available. [Offline report](../app/output/playwright/closure-readable-results.json) and [value checks](../app/output/playwright/closure-readable-value-checks.json) contain the evidence.

Fourteen checks passed against the same downloaded JSON. This fresh example used **89.9 mm / 60 min**, with 12 concepts and **18,000 m³** assumed capacity (12 × 1,500 m³). The HTML reproduces the JSON's independently calculated peak wet areas, **38.45 → 33.62 ha**, and end storage **17,694 m³**. Its bank quantities are **261 installed + 27 spares = 288 ordered**; the blank unit rate and subtotal remain **unknown**. These are computed screening/example results, not observed flood measurements or supplier quotations. They are separate from the earlier 90 mm / RM50 production-test example above.

The empty Pagoh file explicitly shows **0 of 2 sections attached**, no completed comparison and no bank concept. It contains neither Bukit Raja quantities nor wet-area results. [Full HTML](../app/output/playwright/closure-full-review-brief.html), [matching JSON](../app/output/playwright/closure-full-resilience-brief.json) and [empty HTML](../app/output/playwright/closure-empty-review-brief.html) are the actual native downloads. The independent-peak caveat, missing-data warnings, no bank-module flood credit and next validation steps remain visible in the standalone files.

### Remaining limits after closure

G5 is closed for reconciled discovery counts and honest labels, while **exhaustive functional comparison remains unproved**. The current roster has 59 self-identified and nine unconfirmed candidates, with 66 SHA pins; it is not an organiser-confirmed team list. All discovered non-video public pages and source-only candidates received browser attempts. Givlah's Jev video run observed only its opening **0:01 of 3:08**. The [primary](COMPETITOR-FUNCTIONAL-CHECKS.md) and [secondary](COMPETITOR-FUNCTIONAL-SECONDARY.md) supplements add named interactions or access boundaries across all 23 public projects. The primary includes eight mobile states; the secondary includes 30 inspected desktop/mobile captures, with most interactive actions performed at 390px rather than replayed at both widths. AccessTwin's settled scenario control and GreenLoop's explicit synthetic portfolio entry work in the later report. Private entrants, every advertised feature, full mobile accessibility, external-service reliability and real-world performance are not established by this evidence.

A further [Givlah recording supplement](GIVLAH-VIDEO-OBSERVATIONS.md) adds nine inspected views spanning approximately **0:21–3:01**, separately from the frozen 77 Jev records. The recorded offers, confirmations and handover states are explicitly fictional demonstration content. Steps 1, 4 and 6 were not sampled; the video was not watched continuously and audio was not assessed. Recorded success is distinct from a live operation tested by the reviewer.

The fresh closure reports and screenshots use the ignored local QA directory `app/output/playwright/`; the audit records the material assertions here as well as linking the artifacts. Their presence on this workstation is checked. Retaining them in a portable evidence bundle or Git snapshot requires explicitly including the selected artifacts. No application regression was identified in these targeted guide/source/copy checks. The Cost PNG sidebar-scroll capture limit remains recorded above.
