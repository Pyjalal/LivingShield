# Malaysian data provenance

Verified 18–19 October 2026 (MYT). Counts describe verification time, not fixed coverage promises. The original HydroGrid workflows are restored; this document describes their Malaysian replacement sources.

| Provider | Resource | Use / cache |
| --- | --- | --- |
| JPS Public InfoBanjir | https://publicinfobanjir.water.gov.my/wp-content/themes/enlighten/data/latestreadingstrend.json | Names, IDs, coordinates, basins, rain, water level/status. Shared 5-minute cache. Public website feed, not a documented stable API. |
| MET Malaysia / data.gov.my | https://api.data.gov.my/weather/forecast?limit=1000&contains=St@location__location_id&sort=date | State forecasts, 1-hour cache. 112 entries received: 16 states/territories × 7 days. |
| MET Malaysia / data.gov.my | https://api.data.gov.my/weather/warning?limit=1000 | National warnings, 5-minute cache. UI filters validity and shows affected areas in source text. |
| JPS hourly isohyet | https://maps.water.gov.my/arcgis/rest/services/isohyetmap/isohyet/MapServer?f=pjson | Initially returned 24 rasters, later returned service-not-found. Adapter retained, no availability claimed and no raster substituted for flood extent. |
| JPS MSMA | https://wplb.water.gov.my/assets/msma-2nd-edition.pdf | 2012 reference. Equation 2.2, printed p.2-3 / PDF p.35; all 135 Table 2.B1 profiles, PDF pp.56–59; all five temporal regions, PDF pp.64–68. |
| OSM / Esri / OpenTopoMap | Upstream `app/src/config/basemaps.ts` provider URLs | Street, satellite and terrain. Attribution shown; no prefetch/offline bundling. CARTO omitted because observed tiles returned API-key-required images. |

Official references: [weather schema](https://developer.data.gov.my/realtime-api/weather), [rate limits](https://developer.data.gov.my/rate-limit), [JPS public map](https://publicinfobanjir.water.gov.my/full/?lang=en), [MSMA guidance](https://www.water.gov.my/index.php/pages/view/2070?mid=689), [JPS geospatial applications](https://data.water.gov.my/home).

Retrieved MSMA PDF SHA-256: `1f9fa0c7cbace789cb55c1d26e1188e45f8102c1aa76e2b2e7465a04e7fc738f`. The full 807-page document is not bundled with the app.

## Quality and freshness

- 2,720 raw JPS rows yielded 2,718 usable unique locations. Invalid/out-of-bounds coordinates excluded. Geographic bounds are screening bounds, not authoritative national boundaries.
- Empty strings and `-9999` become null. True zero rainfall stays zero.
- JPS `dd/MM/yyyy HH:mm` observation dates interpreted as MYT (`+08:00`); invalid dates rejected. Rain and water retain separate timestamps.
- Current water requires station ON, at least one water sensor ON, a valid reading and age ≤120 minutes (5-minute future tolerance). Current rain requires station/rain sensor online plus a recent valid hourly reading. Sensor OFF stays excluded even if a numeric reading remains in the feed.
- JPS river status is preserved; no invented hazard thresholds. Unknown readings never count as normal. Gauge level is not site flood depth.
- Source hooks poll while visible. Current-reading labels use separate observation times; fetch time never replaces observation time.
- Shared per-source cache and concurrent-request coalescing. Refresh failure preserves original fetch time and marks cached data stale. Cold failures return 502 with no fabricated observations. Source retry backoff: 60 seconds.
- Both weather endpoints share a limiter spacing starts ≥16 seconds, within documented 4/minute limit. Cache/rate limiter is per Node process; multiple production instances require a shared equivalent.
- Naive warning timestamps interpreted as MYT; explicit timezone retained. National notices are not automatically assigned to the selected state.

## Design provenance

Equation `i = λT^κ / (d + θ)^η`: `d` in hours, `T` in years, result mm/h. UI minutes converted to hours. Valid range: ARI 2–100 years; duration 5 min–72 hours for MSMA, 15 min–72 hours for HP26. No extrapolation.

All 135 profiles cover Johor, Kedah, Kelantan, Kuala Lumpur, Melaka, Negeri Sembilan, Pahang, Pulau Pinang, Perak, Perlis, Selangor and Terengganu. Each records source PDF page. `app/scripts/extract-msma.py` reproduces extraction from the PDF; no PDF is redistributed. Live gauge IDs and design-station IDs are separate datasets. Selection is explicit, not an inferred suitability claim. HP26 (2018) adds 174 profiles: Sabah 53, Sarawak 120, Labuan 1. The factual extraction includes all station coefficients, source pages, Appendix A coordinates, coordinate anomalies and nine temporal regions. See [extraction and numerical checks](SOURCES-EAST-IDF.md). The published 15-minute HP26 minimum is applied explicitly in engineering/cost calculations when it exceeds the Kirpich screen. Approved newer coefficients can also be imported; import does not establish regulatory approval.

MSMA temporal patterns: region 1 Terengganu/Kelantan; 2 Johor/Negeri Sembilan/Melaka/Selangor/Pahang; 3 Perak/Kedah/Pulau Pinang/Perlis; 4 mountainous; 5 urban Kuala Lumpur. Published durations: 15, 30, 60, 180, 360, 720, 1440, 2880 and 4320 min. Raw published weights are retained and normalized at runtime because some sums differ from one (region 2, 60 min sums to 0.948). This is disclosed in the UI. HP26 has nine different East Malaysian regions and 81 published vectors, all summing to one. These must be selected explicitly from Figure 6.1 (PDF page 62); Labuan also needs local confirmation. Changing the design station resets that explicit selection. All-region/duration tests check rainfall = infiltration + runoff.

User supplies surveyed coordinates, catchment area (maximum 80 ha), building footprint and scenario assumptions. Engineering exposes pavement fraction, pre-development coefficient, soil, slope and LID controls. All rainfall paths use the selected profile. Full-pipe sizing excludes inlet, blockage, tailwater and network effects; catalogue overflow is explicit. Modified-rational storage is a screening calculation. Green-Ampt output is surface runoff generation; cumulative excess is not a routed detention tank volume. No Canadian IDF, Gumbel disaggregation or SCS Type II pattern is used by the active application.

## Official parcel, asset and flood sources

Source URLs and layer IDs are fixed in `app/server/datasets.ts` and the shared `app/src/malaysia/catalogue.ts` registry. Queries request WGS84 GeoJSON with at most 600 records and a visible bounding box, coalesced and cached five minutes. Parcel queries require local bounds. Counts below are service-wide, not the count currently visible on the map.

| Dataset | Official service and layer | Verified count / scope |
| --- | --- | --- |
| JUPEM 2022 parcels | [MBDK planning /64](https://gis.mpklang.gov.my/server/rest/services/JABATAN_PERANCANG_BANDAR_2024/FeatureServer/64) | 202,107 Klang polygons; LOT, UPI, KELUASAN, MUKIM, SEKSYEN |
| Current land use | [Planning /32](https://gis.mpklang.gov.my/server/rest/services/JABATAN_PERANCANG_BANDAR_2024/FeatureServer/32) | Klang polygons and published activity/land-use fields |
| Retention ponds | [Planning /4](https://gis.mpklang.gov.my/server/rest/services/JABATAN_PERANCANG_BANDAR_2024/FeatureServer/4) | 77 polygons; location/owner/area where supplied |
| Engineering drains | [Engineering /7](https://gis.mpklang.gov.my/server/rest/services/Jabatan_Kejuruteraan/JABATAN_KEJURUTERAAN/FeatureServer/7) | 10,758 drain lines; many dimension fields null |
| Recorded flood areas | [Engineering /14](https://gis.mpklang.gov.my/server/rest/services/Jabatan_Kejuruteraan/JABATAN_KEJURUTERAAN/FeatureServer/14) | 35 polygons; return period unspecified |
| Drain details / hotspots | [Engineering v2](https://gis.mpklang.gov.my/server/rest/services/Jabatan_Kejuruteraan/JABATAN_KEJURUTERAAN_ver_2/FeatureServer) /10 and /11 | 110 drain records / 10 hotspot polygons; raw units retained |
| Gates / pumps / traps | Same v2 service /2, /8, /6 | 16 gates / 9 pumps; trap count not independently certified |
| 2021 flood incidents | [JPS Selangor Banjir_2021 /2](https://jpsselgis.selangor.gov.my/gis/rest/services/Banjir_2021/MapServer/2) | 70 historical incident **points**, not inundation polygons |
| Gombak MSMA ponds | [JPS KOLAM_TAKUNGAN_MSMA /2](https://jpsselgis.selangor.gov.my/gis/rest/services/KOLAM_TAKUNGAN_MSMA/MapServer/2) | 102 pond points |

Real parcel verification: Lot 28681, UPI `10017100428681`, 148.62 m², reference location approximately 3.131021, 101.390695. Another mukim has the same lot number; the UPI distinguishes parcels. `KELUASAN` is used as the published area; calculated polygon area is labelled if required. Building area, assessed value/tax and year built are not supplied and are never invented. Engineering requires a supplied footprint, including explicit 0 for a vacant site.

## National historical context and community mapping

- [Open-Meteo historical API](https://open-meteo.com/en/docs/historical-weather-api): daily precipitation, mean temperature and FAO reference evapotranspiration. Reanalysis in Malaysia local days, **not measured JPS history**. Selected range limited to 366 days per query.
- [Open-Meteo flood API](https://open-meteo.com/en/docs/flood-api): GloFAS daily **modelled discharge**, m³/s, retained on UTC model days. Approximately 5 km resolution; nearby river selection can be wrong. Grid coordinates shown. It is neither gauge height nor site flood depth.
- Historical model responses cached one day; location/variable/date schemas checked. Changing query hides the previous query's result immediately. Failed sources show an error; missing values remain null.
- [OpenStreetMap Overpass](https://overpass-api.de/api/interpreter): buildings, schools, hospitals, rail stations, rivers/streams/drains, ponds, parks, manholes, power, solar and water infrastructure. Sparse community mapping is not an official complete network. Local query bounds and fixed tag allowlist enforced; incomplete queries fail explicitly.
- [Nominatim](https://nominatim.org/release-docs/latest/api/Search/): explicit address submission, Malaysia country filter, no keystroke autocomplete; starts spaced at least 1.1 seconds, cached one day. A returned address is not a cadastral certificate.

Open-Meteo's free hosted endpoints require non-commercial use; commercial operation needs suitable provider access. OSM attribution and applicable licence/policies must be retained. Public GIS query access does not itself establish unrestricted redistribution or commercial rights.

## MYR material references

Observed 18 October 2026, supplier marketplace listings (availability/prices can change):

- [KowHock 300 mm × 6 m double-wall HDPE](https://buildingmaterials.com.my/products/details/300mm-x-6m-hdpe-corrugated-sewer-pipe-double-wall-80619): RM420 per 6 m piece = RM70/m, **material only**. Applies to this size/product; no extrapolated prices for other diameters.
- [1200 × 600 × 1000 mm U-drain](https://buildingmaterials.com.my/products/details/1200mm-x-600mm-x-1m-u-drain-wo-dwf-65383): RM210 per 1 m piece, displayed as a reference, not substituted into circular pipe sizing.

Other unit rates/fees start blank. User may enter local quotes; engineering/contingency percentages are editable scenario allowances. Detailed tables and charts display a partial estimate, with blank rates excluded. Supplier material prices do not include a complete installed scope, delivery, labour, taxes or approval fees.

## Data still needed

Authorised parcels/assets outside published regional coverage, surveyed elevations/inverts/connectivity, updated locally approved rainfall inputs, measured discharge histories, official Malaysian regulatory hazard maps and complete installed cost quotes. Published HP26 East Malaysian rainfall and global JRC return-period model data are now integrated; they do not replace current local approval or field measurements. Site and asset GeoJSON imports allow authorised records to fill these gaps. Public-source absence is not evidence of no asset or no flood risk.

## Nationwide expansion, 19 October 2026

The shared catalogue adds MyGeo reference polygons for all 13 states and three federal territories; East Malaysian districts/divisions; PLAN river-area polygons with actual Sabah and Sarawak features; Peninsular land use, reservoirs and flood-prone context; Labuan reservoirs; JKR Sabah road sections; JMG Sabah/Sarawak geology; and regional access status. The map and asset explorer filter sources by selected region, defaulting Sabah and Sarawak to accessible river geometry. Sarawak gislink inventories currently require tokens and are marked access-required; archived query evidence is not represented as current public access.

[National primary-source research](SOURCES-NATIONAL-MALAYSIA.md) and [East Malaysia verification](SOURCES-EAST-MALAYSIA.md) document exact endpoints, fields, footprints, limitations and source availability. Live API evidence, including failures and successful retries, is in [QA-NATIONAL-LIVE.json](QA-NATIONAL-LIVE.json).

- ESA WorldCover 2021 v2: 10 m global classified land cover, CC BY 4.0, including Sabah/Sarawak/Labuan. WMS requires TIME and uppercase parameters; official [legend definitions](WORLDCOVER-LEGEND.md) retained. It is not current land-use zoning.
- Copernicus DEM GLO-90 (2021) via Open-Meteo: 90 m elevation context, not surveyed site/drain levels; one-day cache. Hosted non-commercial terms apply.
- ISRIC SoilGrids: 250 m predicted clay/sand/silt at 0–5 cm, mean g/kg divided by 10 to percent; nulls retained. Requests coalesced, cached one day, spaced at least 12.5 seconds per process with a bounded queue. Texture never automatically sets hydraulic conductivity/infiltration.
- CEMS/JRC global river-flood hazard v2.1.2: modelled depth at approximately 90 m for ARI 10/20/50/75/100/200/500 years, CC BY 4.0. Three fixed TIFF tiles cover Malaysia, including western islands. HTTP-range reads prevent complete-file downloads. Individual cell queries read source artefact/permanent-water masks; source NoData is null, never a zero-risk conclusion. Raster map uses the 100-year scenario at zoom 10–16, with at most two jobs, 1024² native-window cap and bounded caches. The dataset has no overviews; nationwide low-zoom decoding is intentionally avoided. [Integration and independent values](JRC-RASTER-INTEGRATION.md).

Provider terms and source dates remain relevant to commercial/public deployment. All of these model products are distinguished from Malaysian observations and surveyed design inputs.
