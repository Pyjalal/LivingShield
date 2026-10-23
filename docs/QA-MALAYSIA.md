# Executed Malaysia QA

Historical QA for the earlier reduced interface. Superseded by [full original-workflow QA](QA-FULL-MALAYSIA.md); the feature and build descriptions below are retained as an execution record, not current scope.

18 October 2026, MYT. Tested the adapted application through both its production server (`127.0.0.1:3102`) and Vite development surface (`127.0.0.1:5180`).

## Automated checks

- `npm run build`: pass, including strict TypeScript checks for browser/server/tests. Main bundle approximately 380 kB before gzip; charts loaded separately.
- `npm run lint`: pass for active Malaysia source, entry point, server, tests and Vite configuration. Historical Canadian code is outside the active app.
- `npm test`: 12 tests pass. Covers MYT/date validation; stale/future timestamps; missing/sentinel values and true zero rainfall; online/offline primary/secondary gauges; imagery metadata; MSMA duration conversion and expected rainfall; Rational Method flow; Manning capacity; shared local rainfall profile across storage durations; invalid inputs and pipe-catalogue overflow; GeoJSON geometry/CRS/bounds; API coalescing/cache/stale fallback/backoff; changed warning schema and legitimate empty warnings.
- `npm audit`: zero vulnerabilities after removing unused legacy dependencies and applying compatible updates.
- `git diff --check`: pass.

## Browser workflows

Playwright CLI drove the real local interface at 1440×1000 and 390×844.

| Scenario | Observed result |
| --- | --- |
| Load map | OSM tiles render; real JPS markers and data load. Adapter returns 2,718 usable station locations. |
| Search `Sg. Buloh` | Filtered matching stations; selecting `Sg. Buloh di Parit Mahang` opened its detail panel and moved map to station. |
| Rainfall imagery | Checkbox loads selected JPS raster. Browser image reports `complete: true`, nonzero natural width; source URL is JPS MapServer `export`, selected layer 23. |
| Sabah in BM | 106 matching stations returned; state forecast and map moved to Sabah. Site selection remains distinct from map camera position. |
| BM toggle | Core navigation, filters and descriptions switch to Bahasa Melayu. Official forecast text retained. |
| Malaysian design selection | No output before station chosen. JPS Ampang enables IDF chart and calculations. |
| Ampang reference scenario | Area 10,000 m²; C before 0.3, after 0.8; tc 15 min; ARI 10 yr; release 50 L/s; slope .005; n .013. Result: intensity 196.7655 mm/h, post-flow .4372567 m³/s, storage screen 475.6613 m³, nominal full-flow pipe 750 mm. |
| Change design station | Johor Bahru changes intensity to 191.6 mm/h, post-flow to 425.8 L/s, storage screen to 457.8 m³, nominal pipe to 600 mm. |
| Invalid slope | Slope 0 displays a validation alert and removes calculation/report output. Restoring .005 restores results. |
| Budget/report | User rates accepted. JSON download succeeds and includes station `3117070`, input assumptions, calculation results and exact MSMA PDF source/page. Saved QA example below. |
| GeoJSON | Fictional example-site file imported through native browser file chooser; status shows 1 feature, polygon rendered and map fit to bounds. Parser rejection cases covered by automated tests. |
| Simulated source outage | Intercepted `/api/stations` with HTTP 502. Visible source-unavailable notice, no invented station counts or readings. Removing interception and reloading restores live JPS data. |
| Mobile | Map, controls, design inputs/results and BM layout inspected. Document width 375 px inside 390 px viewport (remaining 15 px scrollbar), no page-level horizontal overflow. |
| Application console | Fresh final browser session initially had 0 errors and 0 warnings after map/design navigation and station changes. Earlier Recharts dimension warning fixed with initial chart dimensions. A later real JPS imagery outage produced the expected failed-resource console entry; see service availability below. |

## Evidence

- [Desktop map](../app/output/playwright/malaysia-map-desktop.png)
- [Station selection](../app/output/playwright/malaysia-station.png)
- [Desktop design](../app/output/playwright/malaysia-design-desktop.png)
- [Mobile design](../app/output/playwright/malaysia-design-mobile.png)
- [Mobile BM](../app/output/playwright/malaysia-bm-mobile.png)
- [Mobile outage](../app/output/playwright/malaysia-outage-mobile.png)
- [Downloaded Ampang report](../app/output/playwright/ampang-site-report.json)

## Review and practical limits

During the final check the same JPS hourly imagery endpoint that had returned 24 layers and rendered successfully began returning an ArcGIS JSON error `Service isohyetmap/isohyet/MapServer not found` (HTTP 200 containing error code 404). The adapter correctly rejected this as missing layer metadata and returned 502; the UI showed imagery unavailable while station observations continued to work. Added explicit retry controls for imagery/forecasts/warnings, and the main refresh action refreshes all four data sources through their shared caches. Source restoration is controlled by JPS and was not claimed. This is an observed external availability limit, not a substituted data source.

Self-review used the code-review skill: checked fixed upstream allowlist, no arbitrary proxy URL input, path confinement, React text escaping, import validation, source errors and schema changes, timestamp semantics, single-source rainfall propagation and independent site/camera state. No unresolved blocking findings.

No external deployment, source redistribution permission, engineering approval or hydrological calibration claimed. Source availability/terms can change. Multi-instance production cache/rate limiting is not implemented. Design data is a dated Peninsular subset; nationwide hazard polygons, cadastral assessments, underground drainage networks, discharge histories and approved local cost schedules remain external data needs. Original Canadian code is retained only for comparison, outside active compilation and runtime.
