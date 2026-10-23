# Pagoh and Elmina visual QA

Checked 20 October 2026, approximately 09:55–10:09 UTC (17:55–18:09 Malaysia time), against the running app at `http://127.0.0.1:5180/`. Desktop Chromium viewport: 1440 × 1000. Isolated Playwright session: `regional3d`. This review changed browser state and captured evidence; it did not change application or map geometry code. Final plan and inspector screenshots were recaptured after the engine owner confirmed the north-up fix was stable, and both pilots' screenshots were opened and visually inspected.

The actual local TamanKu iframe renders both merged datasets, and source inspection works. **Visual fidelity remains partial. Elmina has a significant unresolved mismatch between some OSM housing rows and the displayed Esri imagery.** Successful loading and feature counts do not establish current real-world accuracy or completeness.

## Rendering and interaction evidence

| Check | Bandar Universiti Pagoh | City of Elmina |
|---|---:|---:|
| Cached OSM building footprints | 9 | 714 |
| Added Microsoft footprints | 116 | 38 |
| `TK.world.getStats().buildings` | 125 | 752 |
| Engine selectable feature meshes, `features` | 130 | 777 |
| Aerial ground ready / visible | true / true | true / true |
| Buildings with approximate sampled roof colour | 107 | 719 |
| Leaflet reference tiles loaded when checked | 12 / 12 | 9 / 9 |
| Building picker entries, excluding placeholder | 125 | 752 |
| Concepts / engine proposal count at end | 0 / 0 | 0 / 0 |

Both engine bounds were `[-750, 750, -750, 750]` metres. `Aerial check` opened the same-location reference with yellow OSM and cyan Microsoft outlines; `Plan view` toggled its pressed state and engine `topDown` state. In Elmina, `Height ×1` → `Height ×2` changed engine `heightScale` to 2 and was restored to 1. Switching pilot cleared the previous feature selection. There were no TamanKu/WebGL console errors, warnings or app alerts. One separate `502 Bad Gateway` response from `/api/stations` appeared during live reload and was reported to the parent responsible for feed/recovery QA; this review does not establish live station-feed availability.

Microsoft selection examples:

| Pilot | Feature ID | Inspector position | Mapped area | Displayed height |
|---|---|---|---:|---|
| Pagoh | `microsoft:132232210:41684bb259d51d79a495` | 2.17846° N, 102.73324° E | 217 m² | 6 m · assumed |
| Elmina | `microsoft:132232022:e50f39a90573ae0435d8` | 3.17851° N, 101.51780° E | 28 m² | 6 m · assumed |

The inspector identifies the geometry as machine extracted, links the Microsoft source, states catalogue date 2026-08-13, states that underlying imagery date is unknown, and does not call height surveyed. Selecting each record also set `selectedFeatureId` to the corresponding Microsoft ID in the native engine. These positions are inspection coordinates derived from the footprint, not surveyed entrances.

## Pagoh: observed match and gaps

The pilot is centred on the sales-gallery GPS printed in the developer's [Harmoni Permai brochure, PDF page 10](https://www.simedarbyproperty.com/sites/default/files/2019-03/HarmoniPermai_simplified_Brochure_A4.pdf): 2.173274° N, 102.733172° E. It is a 1.5 km square around that published gallery anchor, not a verified township centroid or official development boundary.

The imagery shows plantation land, village roof clusters, roads meeting around a construction/cleared site, and a broad river corridor near the northern part of the reference. The Microsoft outlines broadly follow small roof groups along the northern village roads and the compact group east of the central road junction. The southern construction/cleared site contains only a small number of yellow OSM outlines. The added source therefore fills a real footprint gap, but it does not establish that every visible building is captured.

The scene should not be presented as a complete model of Bandar Universiti Pagoh. Much of this specific window is plantation or open land; roads and drainage mapping are sparse, and construction areas remain largely unextruded. No buildings were invented to make those areas look complete. At the default fit scale, small 6 m extrusions are difficult to distinguish from the aerial ground.

- [Pagoh aerial ground](../app/output/playwright/tamantahan-pagoh-aerial-ground.png)
- [Pagoh plan and aerial outlines](../app/output/playwright/tamantahan-pagoh-plan-aerial-check.png)
- [Pagoh Microsoft source inspector](../app/output/playwright/tamantahan-pagoh-ml-inspector.png)

## Elmina: significant source disagreement

The pilot is centred on the representative location of [OSM residential way 866543395](https://www.openstreetmap.org/way/866543395), 3.180368° N, 101.517298° E. It covers the Elmina Pavilion / Ilham vicinity and adjacent mapped neighbourhoods. The current Elmina West sales gallery is outside this square. It is not the entire City of Elmina or a verified official city centre.

The major highway interchange, river corridor and nearby pond/lake shapes are recognisable in both aerial views. This establishes that the panels show the same locality. However, several dense yellow OSM housing rows southwest of the interchange are drawn over ground that appears open or vegetated in the displayed reference. Existing roof groups in other parts of the imagery have few or no outlines. The added Microsoft footprints improve coverage locally but do not resolve that disagreement.

A cache scan found 454 building records with representative positions inside longitude 101.512–101.517 and latitude 3.175–3.178. Three sample houses in that area were checked against the complete current official OSM API response, rather than relying only on curated cached tags:

| OSM record | Current tags in full API response | Version / last edit | Changeset evidence |
|---|---|---|---|
| [way 1287007890](https://api.openstreetmap.org/api/0.6/way/1287007890.json) | `building=house`, `house=terraced` | v3, 2025-01-14 08:22:19 UTC | [161335780](https://api.openstreetmap.org/api/0.6/changeset/161335780.json): “edit unsnapped nodes”; `imagery_used=Bing Maps Aerial` |
| [way 1287008059](https://api.openstreetmap.org/api/0.6/way/1287008059.json) | `building=house`, `house=terraced` | v2, 2024-12-24 10:52:51 UTC | [160570625](https://api.openstreetmap.org/api/0.6/changeset/160570625.json): “Updated tags for terraced houses”; `imagery_used=None` |
| [way 1287602967](https://api.openstreetmap.org/api/0.6/way/1287602967.json) | `building=house`, `house=terraced` | v3, 2025-01-14 08:03:22 UTC | [161335292](https://api.openstreetmap.org/api/0.6/changeset/161335292.json): “edit unsnapped nodes”; `imagery_used=Bing Maps Aerial` |

These records have no `construction`, `proposed`, `start_date`, `source` or `date` tags. Edit timestamps are not construction dates or imagery acquisition dates. Different imagery vintages or mapping errors are possible explanations, but neither is established. There is no evidence here to relabel these houses as proposed, delete them, or claim that the Esri image represents current ground conditions.

The final app now displays a prominent warning that southwest mapped housing differs from the available aerial imagery, that source dates are not aligned, and that present-day completion is unverified. This warning was visible in the final Elmina plan screenshot. A current dated orthophoto, developer survey/CAD/GIS, or site verification is needed to resolve the discrepancy.

- [Elmina aerial ground](../app/output/playwright/tamantahan-elmina-aerial-ground.png)
- [Elmina plan and aerial outlines showing the discrepancy](../app/output/playwright/tamantahan-elmina-plan-aerial-check.png)
- [Elmina Microsoft source inspector](../app/output/playwright/tamantahan-elmina-ml-inspector.png)

## Limits of this review

The 3D aerial ground and Leaflet reference both use Esri World Imagery, through an export image and tiled imagery respectively. Agreement between these panels verifies internal location/orientation and makes source discrepancies visible; it is not independent survey control. No positional error metric, roof-by-roof completeness score, current imagery date, measured roof form, measured road width, surveyed ground elevation or drainage connectivity was established.

The initial plan view preserved a diagonal orientation. The engine owner corrected it during this review. Both final plan screenshots were recaptured and visually verified with north-up orientation matching the reference, making source disagreement easier to inspect. The reference can show additional surrounding land because the panels have different aspect ratios and fit behaviour; the 3D pilot remains the explicitly bounded square.

Most heights are explicitly assumed, including every added Microsoft building. Colour sampling is approximate visual styling, not surveyed roof material. Existing roads, rivers and pond shapes are public map context; no hydraulic connectivity, flood depth, storage capacity or real mitigation performance was validated. The scenario remains a preliminary volume screen.
