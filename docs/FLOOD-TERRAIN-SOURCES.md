# Township flood-demo elevation data

Retrieved 20 October 2026. Generated data are actual Copernicus surface-elevation samples, not procedural hills. The three 1.5 km pilot windows remain locality windows, not official township boundaries.

## Source and limitations

[AWS's Copernicus DEM registry](https://registry.opendata.aws/copernicus-dem/) publishes GLO-30 Public as Cloud Optimized GeoTIFFs from the 2021 release. Its public S3 bucket requires no AWS account. These are **digital surface models**, including buildings and vegetation; nominal native spacing is approximately 30 m. The [provider's COG documentation](https://copernicus-dem-30m.s3.amazonaws.com/readme.html) explains the one arc-second low-latitude grid, one-degree tiles, and removal of the duplicated southern/eastern posts.

The [Copernicus collection description](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) specifies WGS84 horizontal coordinates, EGM2008 vertical datum, metre elevations and predominantly 2011–2015 TanDEM-X acquisition, with older infill possible. It distinguishes a DSM from a bare-earth DTM and reports absolute vertical accuracy below 4 m at 90% linear error; this is a product specification, **not local validation**.

The data cannot resolve township drains, culvert inverts, road kerbs or finished-floor levels, and may predate construction and earthworks. Waterbody editing and vegetation/roof returns can produce misleading depressions and ridges. We apply **no invented drainage channels, terrain flattening, zero filling or survey correction**. Both mitigation cases use the same grid. Changes in flood depths are uncalibrated scenario results, not observed depths, approved drainage designs or safety advice.

## Reproducible extraction

From `app`, using the project's Node 24 runtime and installed `geotiff` dependency:

```sh
node scripts/build-flood-terrain.mjs
# Optional subset:
node scripts/build-flood-terrain.mjs bukit-raja
```

The script reads pilot centres and bounds from `src/township/model.ts`, requires WGS84 RasterPixelIsPoint with one arc-second native spacing, and rejects missing, non-finite or declared NoData samples. It requests small native pixel windows through bounded HTTP Range requests; full-file retrieval is disabled. Native TIFF compression can require fetching larger compressed blocks than the requested window. The run received HTTP 206 for every request, transferring 6,356,992 bytes for the shared Selangor tile and 5,373,952 bytes for the Johor tile, rather than downloading their 44,187,222 / 46,447,909 byte files.

Each cached JSON contains 32 × 32 bilinearly interpolated **cell-centre** elevations. Domain 1500 × 1500 m; cell width/depth 46.875 m. `originX = originZ = -750` is the **outer** northwest corner. X increases east; Z increases south; rows run north to south. Sample position is `origin + (index + 0.5) × cellSize`. Elevations remain absolute metres above EGM2008. Rendering may subtract `minM` from all ground and water elevations for numerical convenience; it must preserve relative elevation. Three decimal places store numerical interpolation precision and do not imply millimetre accuracy.

| Pilot | Source native pixel window `[left, top, right, bottom)` | Resampled min–max, m EGM2008 | Exact zero cells |
| --- | --- | --- | --- |
| Bandar Bukit Raja | `[1552,3269,1601,3318]` | 2.855–11.512 | 0 |
| Bandar Universiti Pagoh | `[2615,2952,2664,3001]` | 0–30.772 | 6 |
| City of Elmina | `[1838,2927,1887,2976]` | 24.623–74.113 | 0 |

Pagoh's six exact zero elevations occur along the northern edge. The upstream raster declares no NoData value; these zero samples were present upstream, **not fabricated replacements**. They may reflect waterbody editing or artefacts and have not been checked against a local survey. The file explicitly records this quality limitation. Do not interpret zero metres as verified river-bed level or absence of flood risk.

Actual files successfully read:

- [GLO-30 N03 E101: Bukit Raja and Elmina](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N03_00_E101_00_DEM/Copernicus_DSM_COG_10_N03_00_E101_00_DEM.tif)
- [GLO-30 N02 E102: Pagoh](https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N02_00_E102_00_DEM/Copernicus_DSM_COG_10_N02_00_E102_00_DEM.tif)

These data do not assert that any particular mapped wetland, river or drain has a surveyed conveyance capacity. OSM water features are independently attributed context; the elevation extraction makes no channel-depth or operating-level assumption.

## Licence and attribution

Copernicus GLO-30 is available under the free licence described on the [Copernicus collection page](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM). The page requires a source notice for derived/modified GLO-30 data. Each cached JSON includes the following notice in `source.attribution`:

> produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved

Do not describe this data as OSM, surveyed Malaysian DTM, public-domain terrain or CC BY data. Keep the Copernicus notice with redistributed terrain and exports.
