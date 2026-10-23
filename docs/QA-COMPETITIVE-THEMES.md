# Competitive refresh: theme and input checks

Checked **21 October 2026** against the rebuilt production app at `http://127.0.0.1:3102/`, in an isolated Chromium context. The browser used its real **Cycle theme** button to move through Light, Dark and High contrast. No theme attributes or application state were injected. This is a targeted check of the changed township comparison, River Lab and local-review surfaces, not a repeat of the unchanged 13-view historical matrix.

## Rendered theme matrix

All **18 states** below were captured and every saved PNG was opened and visually inspected. The normal desktop viewport was **1440 × 1000**; mobile was **390 × 844**, at 100% UI scale.

| Surface | Light | Dark | High contrast | Observed result |
| --- | --- | --- | --- | --- |
| Township comparison and result insights | Desktop + mobile | Desktop + mobile | Desktop + mobile | Shared background, body/headline hierarchy, input and result colours remain coherent. The result explanation distinguishes selected-time wet area from end-of-run storage. |
| River Lab and supplied GLB | Desktop + mobile | Desktop + mobile | Desktop + mobile | Actual module and surrounding controls render in each theme. Its physical material remains light against the themed scene; text and actions remain legible. |
| Evidence workspace and local review planner | Desktop + mobile | Desktop + mobile | Desktop + mobile | Review route, labelled fields, optional date, requested-evidence checkboxes and Draft state reflow coherently. No external approval or assignment is represented. |

The observed button labels, app theme IDs and computed tokens agree in every state:

| Actual button label | App theme ID | Background token | Surface token |
| --- | --- | --- | --- |
| Light | `accessible` | `#f4f3ea` | `#fbfaf2` |
| Dark | `dark` | `#102326` | `#142e31` |
| High contrast | `terminal` | `#050b0a` | `#0b1714` |

All 18 states reported **no outer-document horizontal overflow** and the browser recorded **zero JavaScript page errors**. Navigation and the guide's step strip intentionally scroll horizontally within their own containers; this is distinct from document overflow. Screenshots show selected content and natural vertical scrolling, not every control at once.

The test computed a fresh Bandar Bukit Raja comparison with **90 mm / 60 min / C=0.70**, then placed twelve demo basins and reran. At the selected 60-minute frame, wet area is **38.5 → 33.2 ha**, and the result insight reports **−5.3 ha**. Actual end capture is **17,698 / 18,000 m³**, with ten concepts at capacity, two partly used and 302 m³ empty. These are uncalibrated numerical scenario results. After navigating away and returning, the completed comparison remains available but playback starts at minute zero; later screenshots therefore correctly show 0 ha at that selected time while the separately labelled end-of-run capture remains 17,698 m³. The check does not claim playback-time restoration.

## Narrow width, enlarged UI and keyboard

Six further screenshots cover all three surfaces in High contrast at **320 × 844**, then at a **1440 × 1000 viewport with the real UI Scale control set to 140%**. The reported scale variable is respectively `1` and `1.4`. All six states have no outer-document overflow or JavaScript page errors. This is application UI scaling, not a browser-zoom equivalence claim.

The inspected narrow scenes preserve guide actions and explanatory copy. The review form stacks its fields and evidence requests vertically. At 140%, the review form, module controls and result section remain readable. Header and step-strip content are reachable through their own horizontal scroll containers. The captured vertical positions do not establish that an entire long form or 3D scene fits above the fold.

Keyboard checks used focus plus actual key presses:

- **Enter** opens and closes the native capture/water-balance disclosure; its focused summary matches `:focus-visible`.
- **Enter** collapses and expands the guide instructions, with `aria-expanded` changing accordingly.
- **Space** toggles a requested-evidence checkbox.
- After entering a proposed reviewer role and next action, **Enter** activates Mark prepared for review. The local status becomes Prepared for review and the repeated action disables itself. Subsequent field edits correctly return the plan to Draft.

The isolated browser requested reduced motion and `prefers-reduced-motion: reduce` matched throughout the matrix. The checked controls remain usable under that preference. This does not certify every animation, camera interaction, autoplay condition, real-phone input method or full WCAG conformance. No screen-reader audit or performance measurement was performed.

## Artifacts and execution limits

The reproducible supplemental Playwright script and JSON reports are in the ignored local QA directory `app/output/competitive-refresh/`:

- `theme-audit.py normal` produces `theme-normal-results.json` and 18 `theme-normal-*.png` captures.
- `theme-audit.py stress` produces `theme-stress-results.json` and six `theme-stress-*.png` captures, including the keyboard assertions.

Run from `app/` using the local Browser Agent Python environment. These are supplemental checks; no shared Jev queue was used. The original combined script reached all normal states but hit the shell's 60-second limit during its final stress states. The Python handle was confirmed absent before splitting the test into the two completed runs above. A shell time limit is not counted as an application defect. Each split run exits successfully; the JSON records and all 24 screenshot paths exist.

No application source was changed by this QA pass. Only browser-local scenario/review state was edited. No external messages, operational records, assignments, submissions, bookings or transactions were created. No blocking theme or responsive defect was identified in this bounded matrix.
