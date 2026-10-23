# Full original-workflow Malaysia QA

18–19 October 2026, MYT. This supersedes the earlier reduced-interface QA. The active entry point is the original `src/App.tsx`, with original navigation, globe landing, themes and module layouts. Original workflows use Malaysian adapters and calculation inputs.

## Automated verification

- Strict browser/server/test TypeScript checks and production build pass.
- ESLint covers all `src`, `server`, `tests` and Vite configuration, including the restored original components.
- 22 tests cover JPS parsing/freshness/sentinels, real zero rainfall, sensor status, all 135 IDF profiles, coefficient-domain calculations, all five temporal patterns and block counts, all supported storm durations/soils and rainfall mass balance, imported coefficient validation, East Malaysia profile gating, parcel provenance/unknown fields, GIS allowlists/bounds/cache/coalescing, invalid dates, provider schema changes, incomplete Overpass errors, GeoJSON validation, pipe catalogue overflow and source outages.
- `npm audit`: zero vulnerabilities with the restored Three.js/fiber and PNG export dependencies.
- `git diff --check` passes.
- The original lazy-loaded globe chunk is approximately 908 kB before gzip (242 kB gzip); Vite reports a chunk-size advisory. It is separate from analytical screens. Restored Three/fiber emits one `THREE.Clock` deprecation warning, with no functional failure observed.

## Executed browser workflows

Playwright CLI drove real local pages on Vite port 5180 and the production server on port 3102. Desktop 1440×1000 and mobile 390×844.

| Workflow | Observed result |
| --- | --- |
| Original landing/welcome | Textured rotating globe, Malaysian subtitle, original sections/authorship, Launch Platform, welcome basemap/theme choices and Get Started work. |
| Original map/navigation | All original modules reachable, five basemap modes selectable, real national JPS markers and regional layers rendered. |
| Official property | `Lot 28681` returned two distinct mukim records. Selected UPI `10017100428681`, 148.62 m² and location 3.131021, 101.390695; no invented building footprint, year or assessment. Nearby official ponds load. |
| Shared survey scenario | Explicit QA scenario: 10,000 m² lot, 2,500 m² footprint near Klang. Inputs remain shared when moving between property, engineering, simulation and costs. |
| Engineering recalculation | Ampang station 3117070, 2% scenario slope: pre-development C 0.25 gives 100-year storage screen 112.6 m³; changing C to 0.40 changes it to 44.0 m³ and updates charts/release output. |
| LID and geographic gating | All four LID controls changed engineering outputs. Moving the survey scenario to Sabah removed engineering results and showed the required local-profile notice. Restoring Klang coordinates restored calculations. |
| Zero-storage case | Setting pre-development C to 1 gives zero storage requirement while retaining the calculated pre-development release of 1196.07 L/s; no artificial zero release is displayed. |
| Simulation | Original rainfall/runoff/infiltration/cumulative charts and mass-balance table render. CSV and PNG downloads succeed. Cumulative excess volume is explicitly distinguished from routed detention storage. |
| Full-screen export | Original navigation PNG export downloaded `hydrogrid_engineering.png` successfully (622,441 bytes in the test); the application remained usable afterwards. |
| Detailed costs | Blank-rate estimate identified as partial. A user-entered RM70/m rate in the QA scenario updates pipe cost to RM4,410 and partial total to RM5,513 with scenario allowances. CSV downloads. This input is a QA quotation assumption for the sized pipe, not a supplier quote for that diameter. |
| Flood records | Toggling council flood areas returned HTTP 200 and 35 official polygons. UI identifies return period as unspecified. |
| Precipitation history | December 15–22, 2021 query returned eight daily reanalysis records with returned grid coordinates. Chart and CSV download succeed; source is archive-api.open-meteo.com, distinct from current JPS rainfall. |
| River history | December 2021 query returned 31 daily GloFAS discharge values. Chart and CSV succeed; UTC/modelled status retained. |
| Drainage inventory | HTTP 200, 590 official drain features in the tested desktop viewport; different viewport counts are expected. Attribute table/geometry render. CSV and GeoJSON downloads succeed. |
| Authorised inventory import | Fictional test GeoJSON imported through the file input; one overlay asset reported. Test geometry is not presented as an official asset. |
| MET/data panel | Seven Selangor and seven Sabah forecast cards loaded. National warning notices retain affected-area text and validity. |
| Language/region | Toolbar toggles to Bahasa Melayu, Sabah region and weather panel work, then English/Klang restored. Original analytical screens remain English. |
| Invalid profile | JSON with an infinite coefficient rejected visibly: “Rainfall coefficients must be finite numbers.” |
| Changed-query outage | Intercepted pump query with HTTP 502. Source error visible; previous drainage dataset removed from the new selection and CSV disabled. Interception removed afterwards. Expected failed-resource browser console entry recorded. |
| Mobile | Toolbar begins below 40 px fixed navigation, ends at 156.8 px; content ends at viewport bottom 844 px. Document width 390 px in a 390 px viewport. Main inventory pane has `overflow:auto`, exposing the full 4,635 px asset content within its 392 px visible area. Data panel remains clickable. |

## Evidence

- [Original Malaysian landing](../app/output/playwright/original-malaysia-landing.png)
- [Map](../app/output/playwright/original-malaysia-map.png)
- [Official property](../app/output/playwright/original-malaysia-property.png)
- [Engineering](../app/output/playwright/original-malaysia-engineering.png)
- [Mobile engineering](../app/output/playwright/original-malaysia-engineering-mobile.png)
- [Storm simulation](../app/output/playwright/original-malaysia-storm.png)
- [Detailed MYR costs](../app/output/playwright/original-malaysia-costs.png)
- [Flood records](../app/output/playwright/original-malaysia-flood.png)
- [Precipitation](../app/output/playwright/original-malaysia-precipitation.png)
- [River flow](../app/output/playwright/original-malaysia-river.png)
- [Drainage assets](../app/output/playwright/original-malaysia-drainage.png)
- [Mobile](../app/output/playwright/original-malaysia-mobile.png)
- [Mobile changed-source outage](../app/output/playwright/original-malaysia-outage-mobile.png)

Downloaded bulk council asset files are local QA artifacts and excluded from Git; public query access does not establish redistribution rights. Older screenshots/reports are retained as historical evidence and are not current feature documentation.

## Review and remaining data limits

Self-review applied the code-review skill to request allowlists, input bounds/dates/coefficients, source-schema failures, cache behavior, popup escaping, missing-data semantics, React hook order/dependencies, cross-query result isolation, rainfall conservation, cost provenance and mobile scrolling. Corrected issues include conditional hooks, stale runoff dependencies, non-conserving published-rounded storm weights, previous-query data reuse, false detention-routing descriptions and fixed-height mobile clipping.

Public regional assets do not establish nationwide completeness. East Malaysia needs sourced local design profiles; measured national discharge histories, assessed valuations, complete underground networks, surveyed elevations/inverts and probabilistic national flood polygons remain external data needs. Costs require installed-scope quotations and approved fees. Open-Meteo free hosted usage is non-commercial. No external deployment, engineering approval, network calibration or unrestricted source redistribution is claimed. See [data provenance](MALAYSIAN-DATA.md).
