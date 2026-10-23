# TamanTahan verification

Reviewed 20 October 2026 on the local application at http://127.0.0.1:5180, desktop 1440 × 1000 and mobile 390 × 844. This records observed implementation behaviour, not certified engineering or survey accuracy.

## Implemented and observed

- Actual pinned TamanKu engine runs in a same-origin iframe with retained author credits. Local Three.js runtime and controls load without a CDN dependency. The parent and iframe validate message origin and source. All three pilot windows load independently; old renderer resources are disposed on reinitialisation.
- Combined footprints: Bandar Bukit Raja 1,003 (737 OSM + 266 Microsoft); Pagoh 125 (9 + 116); Elmina 752 (714 + 38). Counts are geometry objects, not dwellings, residents or affected properties. Microsoft supplements retain geometry hashes, source tile/line, catalogue release and the full CDLA-Permissive licence.
- Aerial ground loaded in all three pilots. Approximate roof colours were sampled for 938 BBR, 107 Pagoh and 719 Elmina footprints. Height scale defaults to 1. Untagged heights remain assumed 6 m; no measured facade, roof pitch or terrain is claimed.
- Feature selection, concept placement/removal, drag protection, reset, north-up plan view and height toggling were exercised. Camera state remains stable on unrelated updates. Keyboard building selection and centre placement provide alternatives to pointer picking.
- The pitch scenario was entered through the real controls: 100 mm, 10 ha, C = 0.60 gives 6,000 m³ runoff. One detention-court concept supplies 1,500 m³ active storage; retained volume 1,500, residual 4,500, fraction 25%. Baseline mode restores retained 0 and residual 6,000. No flood-depth or damage reduction is inferred.
- The downloaded JSON was inspected for numerical results, location, profile/scenario inputs, original source metadata and third-party disclosure. PNG export was repaired after detecting an omitted iframe canvas and incorrect cloned select values. The resulting image was opened and checked: 3D scene, native credits and chosen profile/return-period/duration are preserved.
- A real selected building queried JRC RP100 and Copernicus terrain. JRC returned NoData, displayed as “No modelled value at this cell”, with its risk limitations; terrain returned 5.0 m on a 90 m grid. NoData was not treated as no risk.

## Mobile and failures

- At 390 × 844, page and workspace width were both 390 px with no horizontal overflow. The workspace scrolls to the scenario controls. Building selection and its source/height inspector worked. Small-screen legend/help overlays were removed where they overlapped mandatory source credits.
- A stored concept with type `constructor` was rejected, leaving a usable zero-concept workspace. Unit coverage also rejects inherited keys, duplicate IDs and invalid coordinates and caps concepts at 30.
- A simulated 503 for the OSM pilot cache showed an explicit map-unavailable state. Removing the interception and clicking Retry restored all 1,003 BBR footprints.
- A simulated empty 502 hazard response showed a readable incomplete-response message. After removing the interception, Retry restored actual JRC context. A development watch restart caused one earlier reset and one station-feed 502; these are recorded rather than hidden. Test interceptions were removed.

## Visual comparison and limits

The BBR official township photograph was opened in a real browser. It establishes the published park/roof appearance, not that the park lies inside this pilot window. Runtime BBR imagery was compared with model roads, roof blocks and ponds. Neutral materials, imagery-derived roof colours, true-scale heights and full-window framing replaced the earlier bright generic rendering. A close-up confirms extruded walls follow the supplied footprints.

[Regional visual QA](QA-TOWNSHIPS-REGIONAL.md) records actual Pagoh and Elmina comparison frames. Elmina contains a material southwest map/imagery discrepancy; the application displays a prominent warning. OSM changeset dates do not establish image acquisition dates, so those mapped houses were not silently removed or relabelled as planned. Pagoh remains sparse and does not represent the full planned township. Flat ground, approximate heights/materials, imperfect footprints and unknown imagery vintages remain material limitations.

Evidence screenshots and downloaded exports are in `app/output/playwright/` with `tamantahan-` or `tamanku-native-` names. [Visual source references](VISUAL-ACCURACY.md), [hackathon proposal](HACKATHON-PROPOSAL.md) and [source notices](../app/public/tamanku/THIRD_PARTY.md) contain the corresponding provenance and submission boundaries.

Code review identified and resolved the stored-plan inherited-key bug and an impossible pitch capacity. Subsequent review found no additional actionable P1/P2 issue in the examined changes. Final automated verification: 37 tests passed, ESLint passed, both TypeScript projects passed and the production build passed. The saved build at port 3102 loaded all 1,003 BBR footprints; National Maps and return navigation worked, with no page errors during that smoke check.
