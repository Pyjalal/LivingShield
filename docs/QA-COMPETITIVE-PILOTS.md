# Township simulation and presentation QA

Checked on 21 October 2026 against the running development application at `http://127.0.0.1:5180/`. This supplements the broader production and handover verification in `COMPETITIVE-UPGRADE-VERIFICATION.md`.

The three current township pilots passed the numerical and exported-data checks. Presentation mode retained the existing scene, inputs and results. The Malay guide completed all four steps and returned to English. A River Lab header overlap found during visual inspection was corrected and then retested at both widths.

## Method and evidence

Isolated Chromium sessions used actual application controls, native downloads and screenshots. No shared Browser Agent queue was used. The QA agent changed no application source files.

Three reports in the ignored `app/output/competitive-refresh/` directory contain 123 passing recorded assertions, plus six independent accounting recomputations:

| Report | Recorded checks | Coverage |
| --- | ---: | --- |
| `qa-pilots-results.json` | 88 | All three pilots, native exports, rendered capture rows, summary and overflow |
| `qa-presentation-results.json` | 18 | Township iframe, River Lab model, bank controls, Escape/focus, four Malay guide steps, English return, compact guide and landing action |
| `qa-visual-results.json` | 17 | Replacement viewport captures and targeted presentation-header regression checks |

All three successful runs recorded zero JavaScript page errors. The six additional `independentBudgetChecks` are retained in `qa-pilots-results.json`.

The artifact-only harnesses are `pilot_qa.py` and `visual_qa.py`. Native flood downloads are `{bukit-raja,pagoh,elmina}-{baseline,comparison}.json`. Each baseline and comparison was downloaded through **Export flood results**; the JSON was then inspected independently of the rendered summary.

## All three pilot runs

Every pilot used custom rain of **90 mm over 60 minutes**, runoff coefficient **0.7**, assumed drainage **5 mm/h**, Manning roughness **0.04**, and **free outfall with no external inflow**. The terrain grid was 32 × 32 cells over 225 ha. Each sequence ran an empty-plan baseline, used **Place pooling-point demo basins**, and reran the comparison.

The preset was checked as a bounded result of **at most 12** proposals. In these particular runs, each of the three grids supplied 12 placements. This is an observed count, not an assertion that every future grid must produce 12.

| Pilot | Concepts / capacity | Actual captured volume | Full / partial / unused | Peak wet area before → after | Peak grid depth before → after |
| --- | --- | ---: | --- | --- | --- |
| Bandar Bukit Raja | 12 / 18,000 m³ | 17,697.755031 m³ | 10 / 2 / 0 | 38.452148 → 33.618164 ha | 0.651956 → 0.603659 m |
| Pagoh | 12 / 18,000 m³ | 18,000 m³ | 12 / 0 / 0 | 24.609375 → 22.851563 ha | 1.174315 → 0.801090 m |
| City of Elmina | 12 / 18,000 m³ | 18,000 m³ | 12 / 0 / 0 | 19.335938 → 17.797852 ha | 2.012547 → 1.359958 m |

Peak wet area uses the exported ≥0.1 m threshold. Peak area and peak depth are maxima within the simulation window; they need not occur at the same frame. The replacement Bukit Raja result screenshots use playback index 40, which the application labels as 60 minutes. Their **selected-time** areas are therefore different from the table's peak areas.

For every pilot:

- Both before and after exports contained exactly 61 frames. An empty-plan baseline produced identical before/after frames, and its before case matched the later mitigated comparison's before case.
- Exported township ID and terrain township ID matched the selected pilot. The declared forcing matched every input above; no cross-pilot result or source substitution was observed.
- Gross rainfall volume was 202,500 m³. Every local storage had a valid grid index and a 0.5 m³/s assumed inlet, stayed between zero and capacity, and retained the proposal ID.
- Summing actual per-storage capture matched the exported `totalStoredM3` within 0.000001 m³. Every rendered meter value and maximum matched the corresponding raw storage record. Rendered full/partial/unused counts and rounded summary volumes also matched.
- Absolute reported numerical mass residuals were below 0.00001 m³ in both cases. Independent recomputation of rainfall + initial water − runoff losses − final surface water − storage − drainage − boundary outflow agreed with the reported residuals within 0.000001 m³. The largest absolute residual was approximately 0.00000000456 m³.
- No document-level horizontal overflow was detected at 1440 × 1000 or 390 × 844.

## Presentation, guide and entry action

The township check used Bukit Raja's computed 90 mm comparison, 12 proposals, the after case, and playback index 40. Entering presentation mode preserved the same iframe DOM element, rain/runoff inputs, captured-volume summary and playback index. Clicking the actual canvas inside the TamanKu iframe and pressing Escape exited presentation mode and restored focus to the presentation toggle. Results and the selected frame remained intact.

River Lab's detailed module viewer loaded `/livingshield/module_triangle.glb`. Entering presentation mode retained the same canvas and loaded source asset; Escape restored toggle focus. The bank installation uses explicitly labelled simplified geometry. A changed bank length, rendered module count, quantity text and planting stage survived presentation entry and exit. The source module and conceptual bank scene were checked separately.

The guide's four Malay steps navigated to Explore, the storm comparison, River Lab and Evidence, with their expected Malay titles and instructions. Collapsing and expanding instructions retained the guide title/status. Switching back to English restored the English labels. Closing the guide and selecting the landing page's first **Start the guided demo** action reopened the native guide.

The initial bank presentation screenshots exposed an actual layout defect: a transparent sticky heading allowed the scene's source/reset overlay to show through, and a prior scroll offset carried into presentation. The corrected heading is opaque and entry resets only the containing lab scroll position. Targeted reruns retained the existing bank canvas, length, module count and quantities:

| Viewport | Heading bottom | Scene top | Source/reset overlay top | Lab scroll position |
| --- | ---: | ---: | ---: | ---: |
| 1440 × 1000 | 110 px | 110 px | 126 px | 0 |
| 390 × 844 | 162 px | 162 px | 173 px | 0 |

The measured heading background was `rgb(251, 250, 242)`. Both replacements were opened and visually inspected: source label and reset control sit below the heading, the full bank scene is visible, and the exit action remains accessible. Escape restored focus at both widths.

## Accepted visual evidence

These eight screenshots were individually opened and inspected after the successful focused rerun. They are normal viewport captures, not stitched full-page screenshots.

| Files under `app/output/competitive-refresh/` | What they establish |
| --- | --- |
| `bukit-raja-insight-start-viewport-1440.png`, `bukit-raja-insight-start-viewport-390.png` | Selected-time comparison, actual captured total, limit explanation and visible capture rows |
| `bukit-raja-insight-budget-viewport-1440.png`, `bukit-raja-insight-budget-viewport-390.png` | End-of-run water budget and numerical residual at both widths |
| `bank-present-fixed-1440.png`, `bank-present-fixed-390.png` | Scene-led presentation with corrected header and no source/reset overlap |
| `bm-guide-1-settled-390.png` | Malay Explore guide with native township canvas ready |
| `bm-guide-4-settled-390.png` | Malay Evidence guide with the computed comparison attached |

The first guide replacement waited for the iframe's engine-status overlay to disappear. The Evidence replacement waited for **Comparison attached.** The two images therefore show settled workspaces rather than loading placeholders.

Earlier `*-insights-1440.png` and `*-insights-390.png` element screenshots are **excluded from visual acceptance**: nested scrolling clipped their contents and produced blank areas. Their associated numerical assertions still passed. The replacement viewport captures intentionally show the start and budget rather than claiming all twelve rows fit on one screen. Native meter/JSON checks covered every row for all three pilots.

Earlier `bank-present-*.png` files show the defect before correction and are superseded. Earlier `bm-guide-1.png` and `bm-guide-4.png` caught loading states and are superseded by the settled replacements. Do not use these older captures as final appearance evidence.

Three harness corrections preceded successful runs: a number parser originally included the superscript in `m³`; a role selector excluded deliberately hidden planner controls during presentation; and a bank-mode assertion incorrectly expected the detailed module's source-asset attribute on the simplified bank canvas. These were harness errors, not application failures. The retained reports describe the subsequent successful runs.

## Scope and limits

This is fresh development-server QA of the three current pilot windows. It does not establish coverage of every Malaysian township, production-server parity, event calibration, measured flood performance or survey accuracy. The simulation uses historical surface elevations and assumed drainage/inlets; numerical conservation demonstrates internal accounting, not physical validation. River Lab's physical bank modules receive no flood-storage credit. Broader production checks and review/export checks belong to the accompanying canonical verification report.
