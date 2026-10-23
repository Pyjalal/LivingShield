# Nationwide Malaysia integration QA

Verified 19 October 2026 (MYT), using the production build at localhost:3103 and the development app at localhost:5180. This expands the restored original interface; earlier original-workflow evidence remains in [QA-FULL-MALAYSIA.md](QA-FULL-MALAYSIA.md).

## Automated checks

- TypeScript client/server checks, ESLint and production build passed.
- All 30 Node tests passed. The national tests cover 174 HP26 profiles, unique IDs across all 309 profiles, Sabah/Sarawak/Labuan counts, geographic station-family gates, the 15-minute minimum, independent published numerical examples, all 81 HP26 pattern vectors and simulation water balance.
- API checks cover source allowlists, Esri road geometry conversion, nonpagination, excluded ownership/contact fields, invalid/future/impossible dates, missing readings, SoilGrids unit conversion/nulls, shifted JRC tile seams, pixel direction, PNG encoding and invalid raster requests.
- Production dependency audit: zero vulnerabilities. Installation also audited the complete dependency tree with zero vulnerabilities.
- Final review checked fixed upstream URLs, bounded caches/queues/windows, source attribution, NoData semantics, regional defaults, export provenance and cleanup on map unmount.

## Live source verification

Full requests, returned counts, model values and failures are retained in [QA-NATIONAL-LIVE.json](QA-NATIONAL-LIVE.json). `app/scripts/verify-national.mjs` records live availability; an upstream outage is retained rather than converted into an empty successful dataset.

| Check | Observed result |
| --- | --- |
| MyGeo state/territory boundaries | 13 Peninsular + 3 East Malaysian polygons, covering all 16 states/territories |
| Sabah PLAN river areas | 106 features in the verification envelope; 15 in the browser viewport |
| Sarawak accessible PLAN river areas | 131 features in the verification envelope; 17 in the browser viewport |
| East Malaysian districts | 10 features in the Kuching-area verification envelope |
| Sabah JKR roads | 600-feature cap reached; explicit zoom/completeness notice |
| Sabah JMG geology | 7 features in the verification envelope |
| Penang PLAN land use | 600-feature cap reached; provider geometry loaded successfully |
| Pahang flood-prone areas | 8 features after bounded geometry generalisation; initial unsimplified query timed out |
| Labuan reservoirs | 2 source polygons; one in the default browser viewport, including Sg. Pagar Dam |
| Sabah GeoExplorer snapshots | 39 rainfall + 15 river points, with source timestamps and freshness status |
| SoilGrids Sabah | 40.7% clay, 30.3% sand, 29.0% silt; one timeout followed by a successful retry |
| SoilGrids Sarawak | 50.6% clay, 17.2% sand, 32.2% silt at the research point; browser site returned 49.2/18.9/31.9% |
| JRC RP100 Klang reference pixel | 8.1120004654 m, matching independent Rasterio verification |
| JRC RP100 Sabah reference pixel | 12.3249998093 m; source artefact and permanent-water flags both present |
| JRC RP100 Sarawak reference pixel | 10.5930004120 m; both source flags present |
| Kota Kinabalu centre / Langkawi model cells | NoData remains null; western islands select ID202 correctly |
| Sarawak gislink inventories | Provider now returns `499 Token Required`; catalogue/selector mark access-required and use accessible PLAN river areas by default |

Model pixel coordinates and independent acceptance values are documented in [JRC-RASTER-INTEGRATION.md](JRC-RASTER-INTEGRATION.md). These depths are global model results, not observed Malaysian flood depths or construction recommendations.

## Browser scenarios

- Original landing, welcome, navigation, theme controls and engineering workflows retained. Fresh settings open the national view.
- Sabah and Sarawak select relevant sources; Klang-only assets are filtered out. Restricted Sarawak sources remain labelled and disabled. Labuan defaults to its verified reservoir source.
- Sabah WorldCover: all 20 requested tiles loaded. Fixed the provider's uppercase WMS parameter requirement; all 11 official classes appear in the legend.
- Sarawak flood overlay: all 15 requested raster tiles loaded, with depth bins, approximate resolution, source attribution and NoData/model caveats.
- Flood point inspection works over interactive reference polygons through a separate inspector panel. A clicked Sabah site at 6.02037, 116.09178 returned HTTP 200 from the RP200 Borneo raster; inspector controls retain the selected location.
- Sarawak Bunan Gega and Labuan design profiles produce a 15.0-minute adopted design duration, with the lower Kirpich screening estimate disclosed.
- Sarawak HP26 simulation requires explicit pattern selection, then renders five charts. Example six-hour scenario: 194.0 mm rain, 1823.8 m³ post-development runoff and 38.69 m³ excess runoff. Pattern choice in QA exercises the interface and does not establish site suitability.
- Labuan simulation CSV downloaded successfully with station `96465`, the official HP26 source URL, temporal family `hp26` and selected region. Changing station resets pattern selection and removes results until a new suitable region is selected.
- National site report displayed model depth, source quality flags, Copernicus terrain and SoilGrids texture. A simulated hazard-source 502 displayed an unavailable message and removed the context export; removing the browser-only mock and retrying returned HTTP 200. No mock remains active.
- Regional GeoJSON downloaded with real geometry, source URL, fetch time, coverage and notices. Exports are disabled during refresh or source errors.
- Mobile viewport 390×844: document width remained 390 pixels; national context and controls fit without horizontal document overflow.
- Rapid map/asset navigation exposed an old delayed-resize callback after Leaflet unmount. Added timer cleanup; eight subsequent rapid tab switches produced zero page errors.

The untouched globe dependency emits a `THREE.Clock` deprecation warning. Its existing large bundle also produces a Vite chunk-size warning. Deliberately injected HTTP 502 errors are expected in the failure-path browser log; ordinary final navigation has zero application errors.

Screenshots and representative exports are under [app/output/playwright](../app/output/playwright/), including national map, Sabah rivers/land cover, Sarawak rivers/flood model/site context/simulation, Labuan reservoirs and mobile context.

## Remaining source limits

National context is now usable in both Peninsular and East Malaysia. Complete underground drainage connectivity, surveyed inverts/capacities, cadastral ownership/valuation outside available regional sources, measured discharge histories and official nationwide regulatory hazard maps remain unavailable. The global model does not supply complete pluvial/coastal hazard coverage. Provider terms, dated records and intermittent outages remain visible; unpublished records are not fabricated.
