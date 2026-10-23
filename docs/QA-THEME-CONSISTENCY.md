# TamanTahan visual consistency verification

Verified 20 October 2026 on the development app at port 5180 and final production build at port 3102.

## Cause and correction

The township view had its own cream/forest palette and navigation overrides. The inherited screens mixed terminal body styling, blue/cyan panels and hardcoded neon text. Malaysian controls referenced undefined text tokens. Navigation also used different automatic scale factors depending on the selected page. Some maps inherited a forced dark wrapper even after selecting a light street basemap.

`app/src/theme.css` now owns the shared semantic colours, typography, controls, navigation and chart chrome. Light uses cream/forest, Dark uses the same identity with dark surfaces, and High contrast uses stronger text and borders. A fresh session starts in Light; valid saved choices persist. All views inherit the same tokens. The 3D iframe receives the selected theme for its surround and interface; aerial imagery and flood depth colours retain their data meaning. Basemap filtering follows the actual selected map style, with fixed OSM explorers showing native tiles.

## Rendered checks

- **20 desktop states at 1440 × 1000:** 3D Townships, National Maps, Drainage & Water, Property Lookup, Flood Hazard, River Flow, Precipitation Explorer, Drainage Design, Storm Simulation and Cost Analysis, each in Light and Dark. Every state reported the same sans UI font, 48 px navigation, scale 1 and no horizontal document overflow. Screenshots were captured and representative states across all page types were opened for visual inspection.
- Engineering and storm charts were exercised with a declared manual test site: 5,000 m² lot, 1,000 m² building footprint, 3.0852/101.4377, and regional MSMA profile 3314001. Charts rendered actual calculated series. Inputs were confined to the isolated browser session; no source observations were substituted.
- Cost tables, chart ticks, tooltips, form fields, selected states, empty states and warning/error chrome use the shared palette. Data-series/category colours remain distinct.
- **390 × 844 mobile and 900 × 900 tablet:** main navigation and dropdowns remain reachable, page width stays within the viewport, and map-style choices work. See [independent map and responsive QA](QA-THEME-MAPS.md).
- The township flood screen was visually checked in Light, Dark and High contrast, plus mobile Dark. Source credits and the depth legend no longer overlap. The native duplicate readout is hidden on narrow screens where the parent already provides the same information.
- Main light text contrast is 10.24:1 against the page background. Muted and subtle text on the darkest light surface measure 4.90:1 and 5.04:1. Input borders measure 3.58:1 against raised light surfaces. Dark muted/subtle text measure 6.55:1 and 5.69:1 on muted dark surfaces. These are token checks, not a complete accessibility certification.

## Production regression

The final build ran the Bukit Raja flood comparison with twelve demo basins. At 60 minutes, the displayed result remained 38.5 → 33.2 ha at least 0.10 m deep, maximum depth 0.64 → 0.50 m, captured volume 15,936 m³. Switching Light → Dark changed the scene surround from `#dce5dc` to `#102426`; camera arrays and flood-renderer statistics stayed exactly identical. The selected theme persisted after reload. National navigation remained 48 px with the same font.

`npm run lint`, all **47 tests**, typechecks and the production build passed. An independent diff review found no actionable regressions. Remote station/history/tile loading remains asynchronous; captures include initial and populated states. Map-style verification used settled, loaded tiles. These checks establish visual and interaction consistency, not hydrological or external-source accuracy.

Evidence in `app/output/playwright/`:

- `theme-before-*.png`: original visual mismatch.
- `theme-{light,dark}-{township,national,drainage,property,flood,river,precipitation,engineering,simulation,cost}.png`: desktop matrix.
- `theme-township-flood-*.png`, `theme-map-*.png`: independent 3D/responsive/map checks.
- `theme-production-flood-{light,dark}.png`: final production comparison.
- `theme-audit.json`: compact computed-style matrix and production preservation results.
