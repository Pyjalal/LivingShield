# Nationwide Malaysian data source verification

Verified on 19 October 2026 (Malaysia time). This is research evidence, not a claim that every source below has been integrated into the application. Counts are observed service-wide record counts. A successful directory or metadata response is distinguished from a successful feature query.

## Recommended national layers

| Purpose | Verified primary endpoint | Coverage and observed result |
| --- | --- | --- |
| State boundaries | [MyGeoName /5](https://mygos.mygeoportal.gov.my/gisserver/rest/services/MyGeoname/MyGeoName_BaseMap/MapServer/5) and [MyGeoName /6](https://mygos.mygeoportal.gov.my/gisserver/rest/services/MyGeoname/MyGeoName_BaseMap/MapServer/6) | 13 Peninsular polygons and 3 Sabah/Sarawak/Labuan polygons; WGS84 GeoJSON queries succeeded. |
| East Malaysia divisions and districts | [MyGeoName /9](https://mygos.mygeoportal.gov.my/gisserver/rest/services/MyGeoname/MyGeoName_BaseMap/MapServer/9) and [MyGeoName /10](https://mygos.mygeoportal.gov.my/gisserver/rest/services/MyGeoname/MyGeoName_BaseMap/MapServer/10) | 17 division and 70 district polygons. District sample: BEAUFORT, Sabah, source JTU, source update 2023. |
| Official Borneo place names | [MyGeoName /1](https://mygos.mygeoportal.gov.my/gisserver/rest/services/MyGeoname/MyGeoName_BaseMap/MapServer/1) | 21,645 point features, with official names and feature types. These are named locations, not a complete building or property inventory. |
| River waterbody polygons, including Sabah and Sarawak | [PLANMalaysia RFN4 environmental /14](https://gisdev.planmalaysia.gov.my/server/rest/services/RFN4/04_PERANCANGAN_ALAM_SEKITAR/MapServer/14) | 3,409 polygons. Actual Sabah and Sarawak bounding-box GeoJSON queries returned records. These are river polygons, not hydraulic centreline topology. |
| Detailed Peninsular river lines | [MyGeoName /4](https://mygos.mygeoportal.gov.my/gisserver/rest/services/MyGeoname/MyGeoName_BaseMap/MapServer/4) | 780,189 line features. Despite the national portal, this layer's published extent is Peninsular only. Source credit: Bahagian Pengurusan Lembangan Sungai, JPS Malaysia. |
| Peninsular basin context | [PLANMalaysia RFN4 environmental /7](https://gisdev.planmalaysia.gov.my/server/rest/services/RFN4/04_PERANCANGAN_ALAM_SEKITAR/MapServer/7) | 77 basin polygons. Test boxes in Sabah and Kuching returned zero. An eastern extent near 115°E does not establish statewide Borneo coverage. |
| Peninsular catchment context | [PLANMalaysia RFN4 environmental /15](https://gisdev.planmalaysia.gov.my/server/rest/services/RFN4/04_PERANCANGAN_ALAM_SEKITAR/MapServer/15) | 209 polygons. Sample Timah Tasoh Dam catchment. Fields include old water-quality attributes; do not label these current conditions. |
| Peninsular land use | [PLANMalaysia RFN4 land use /0](https://gisdev.planmalaysia.gov.my/server/rest/services/RFN4/02_GUNATANAH/MapServer/0) | Metadata and count succeeded: 6,113,288 polygons, extent 99.66–104.51°E. Feature queries around Penang and Johor timed out at 18 seconds. Operational feature availability remains unverified; do not claim a downloaded or visible layer from the count alone. |
| Peninsular flood-prone polygons | [PLANMalaysia RFN4 supporting /78](https://gisdev.planmalaysia.gov.my/server/rest/services/RFN4/06_LAIN_LAIN_DATA_SOKONGAN/MapServer/78) | 51 polygons; actual Pahang envelope returned GeoJSON. `RISIKO=Kawasan Mudah Banjir`, `SUMBER=JPS-Website`. No return period, survey date, depth or forecast issue time supplied. |
| Dams and reservoirs | [PLANMalaysia RFN4 utilities /3](https://gisdev.planmalaysia.gov.my/server/rest/services/RFN4/03_INFRAUTILITI_01_UTILITI/MapServer/3) | 111 polygons. Sample Empangan Seluyut, Johor, existing, water supply, 697.98498535 ha. Exact `NEGERI='SABAH'` and `NEGERI='SARAWAK'` queries returned zero. |
| Labuan reservoirs | [PLANMalaysia RFN4 utilities /4](https://gisdev.planmalaysia.gov.my/server/rest/services/RFN4/03_INFRAUTILITI_01_UTILITI/MapServer/4) | 2 polygons: Sg. Pagar Dam catchment, 8.17963028 ha; Bukit Kuda catchment, 88.17379761 ha. Preserve names/area as published; they are not storage capacities. |
| Geology by state | [JMG lithology service](https://mygems.jmg.gov.my/server/rest/services/Demarcation/Litology_by_Negeri/FeatureServer) | State layers cover Peninsular Malaysia and Borneo. [Sabah /26](https://mygems.jmg.gov.my/server/rest/services/Demarcation/Litology_by_Negeri/FeatureServer/26): 1,229 polygons. [Sarawak /28](https://mygems.jmg.gov.my/server/rest/services/Demarcation/Litology_by_Negeri/FeatureServer/28): 1,599 polygons. Actual WGS84 GeoJSON samples succeeded. Lithology is not a soil permeability measurement. |
| National land-cover imagery | [ESA WorldCover current WMS](https://titiler.terrascope.be/wms?request=GetCapabilities&service=WMS) | Actual nonempty 256×256 PNG requests succeeded over Kota Kinabalu and Kuching. Global 2021 land-cover classification, approximately 10 m; rendered imagery is cartographic context. |
| Soil texture prediction | [ISRIC SoilGrids REST](https://rest.isric.org/soilgrids/v2.0/docs) | Actual numerical clay/sand/silt values returned in Sabah and Sarawak. Some coastal/urban pixels return null. Global model, approximately 250 m, not field samples or hydraulic conductivity. |
| Return-period river flood model | [Copernicus/JRC global flood hazard v2.1.2](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/) | Actual tiled GeoTIFF data and positive pixels verified in Klang, Sabah and Sarawak. Global model, approximately 90 m, with explicit return periods and depth units. This is a model, separate from Malaysian agency flood maps. |

## Fields, queries and pagination

For ArcGIS layers, append `/query` and use a curated `outFields` list, `f=geojson`, `outSR=4326`, `returnZ=false`, `returnM=false`. Filter to the viewport with `geometry=xmin,ymin,xmax,ymax`, `geometryType=esriGeometryEnvelope`, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`. Do not issue unbounded feature downloads of national multi-million-record sources.

Useful source field mappings:

- MyGeoName states: `OBJECTID,NAM,KOD_NEGERI,Sumber,Tahun_Kemaskini,Tahun_Terima`.
- MyGeoName East Malaysia districts: `OBJECTID,NAM,BAHAGIAN,NEGERI,District_Code,Sumber,Tahun_Kemaskini`.
- MyGeoName Borneo named points: `OBJECTID,OFFICIAL_NAME,ORIGIN_NAME,FNM,FCD,NEGERI,BAHAGIAN,DAERAH,SUMBER,NAMA_AGENSI`.
- MyGeoName river lines: `OBJECTID,NAM,FNM,STATE,DISTRICT,TRIBUTARY,Sumber,Tahun_Kemaskini`.
- PLAN river polygons: `OBJECTID,NEGERI,NAMA,KATEGORI,KOD_NEGERI`.
- PLAN basin polygons: `OBJECTID,NEGERI,NAMA,LUAS_HA`.
- PLAN catchment polygons: `OBJECTID,NAMA,STATUS,LUAS_HA,WQI99,KELAS,KUALITI`.
- PLAN land use: `OBJECTID_1,gunatanah1,gunatanah2,gunatanah3,luas_h,tahun_data,STATUS`.
- PLAN flood-prone polygons: `OBJECTID,RISIKO,SUMBER`.
- PLAN dams: `OBJECTID_1,NEGERI,NAMA,STATUS,LUAS_HA,KEGUNAAN`.
- JMG lithology: `OBJECTID,NAM,GLN,GFD,GLL,HOR` for state, formation, description, legend and facies. Numeric geology codes are not measured soil parameters.

Actual Sabah river query:

```text
https://gisdev.planmalaysia.gov.my/server/rest/services/RFN4/04_PERANCANGAN_ALAM_SEKITAR/MapServer/14/query?f=geojson&where=1%3D1&outFields=OBJECTID,NEGERI,NAMA&outSR=4326&inSR=4326&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&geometry=115.7,5.5,116.8,6.5&resultRecordCount=2&returnZ=false&returnM=false&maxAllowableOffset=0.003
```

Returned Sabah polygon `OBJECTID=2681`, `NAMA=S. Kapuakan`, near 116.73°E, 6.22°N. Sarawak box `geometry=110,1,111,2` returned `OBJECTID=1936`, `NAMA=S. Batang Lupar`, and other polygons. ArcGIS intersection returns whole features, so coordinates can extend beyond the requested viewport. `maxAllowableOffset` generalizes map geometry and must not be used for surveyed areas or site engineering.

Respect each layer's `advancedQueryCapabilities.supportsPagination`. Where supported, use deterministic object-ID ordering and `resultOffset`. Where unsupported, query object IDs then fetch bounded ID batches. Treat an exceeded transfer limit as incomplete coverage. A count alone is not evidence of loaded geometry.

The source's state codes can differ from application codes. Match state names or an explicit source-specific mapping; do not assume `KOD_NEGERI` has one universal scheme.

## ESA WorldCover cartographic layer

The [official data access page](https://esa-worldcover.org/en/data-access) links the current WMS at `https://titiler.terrascope.be/wms`. The legacy service URL and `WORLDCOVER_2021_MAP` identifier in older manuals should not be assumed current.

Verified current parameters:

```text
SERVICE=WMS
VERSION=1.3.0
REQUEST=GetMap
LAYERS=esa-worldcover-map-10m-2021-v2_map
STYLES=
CRS=EPSG:4326
TIME=2021-01-01
FORMAT=image/png
TRANSPARENT=TRUE
WIDTH=256
HEIGHT=256
```

WMS 1.3.0 with EPSG:4326 uses latitude/longitude axis order. Sabah test `BBOX=5.7,115.8,6.2,116.4` produced an 8,277-byte, nonempty RGBA PNG with 9 colours. Kuching test `BBOX=1,110,2,111` produced 6,999 bytes and 10 colours. The service also advertises EPSG:3857. Omitting `TIME` returns an error; WMS 1.1.1 is rejected.

Follow-up integration verification: uppercase EPSG:3857 parameters returned a 12,874-byte PNG, while the equivalent lowercase request timed out and failed to render browser tiles. Set Leaflet WMS `uppercase: true`. A Labuan EPSG:4326 image also returned HTTP 200, 6,033 bytes and 9 colours. Exact class codes and colours are recorded in [WORLDCOVER-LEGEND.md](WORLDCOVER-LEGEND.md).

Native Windows curl validated the certificate and read the images. Python's bundled trust store failed issuer verification for this host. Do not disable certificate verification globally to work around a client trust-store difference.

WorldCover is CC BY 4.0. Use the prescribed map credit: `© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium`. It classifies land cover, not legal land use, drainage assets, pervious fractions measured on site, or planning approval. The WMS is RGB imagery; use original categorical COG data for quantitative analysis.

## SoilGrids: actual Borneo values and missing data

Verified numerical API request:

```text
https://rest.isric.org/soilgrids/v2.0/properties/query?lon=116.3&lat=5.9&property=clay&property=sand&property=silt&depth=0-5cm&value=mean
```

Response path: `properties.layers[].depths[].values.mean`, with unit/depth metadata alongside each value. Sabah test returned clay 407, sand 303, silt 290 g/kg. Source `unit_measure.d_factor=10` converts these to 40.7%, 30.3%, 29.0%. Sarawak `lon=110.4&lat=1.4` returned 506, 172, 322 g/kg. The Kota Kinabalu coastal test at 116.0753°E, 5.9804°N returned null for all three properties and must remain missing.

The [service's own fair-use policy](https://rest.isric.org/) allows 5 API calls per minute and describes the REST API as beta without an uptime guarantee. Use a shared process-level limiter with starts at least 12 seconds apart, response caching, and explicit source errors. Do not convert predicted texture into hydraulic conductivity or infiltration parameters without a separately documented model and user confirmation of suitability.

Verified soil map capabilities:

```text
https://maps.isric.org/mapserv?map=/map/clay.map&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities
```

Advertised layer `clay_0-5cm_mean` exists. [ISRIC WCS documentation](https://docs.isric.org/globaldata/soilgrids/wcs.html) describes raster subset access. Follow [ISRIC data policy](https://isric.org/about/data-policy) and the dataset citation; the metadata response is not a site investigation.

## National modelled return-period flood hazard

The [JRC README](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/README.txt) identifies version 2.1.2, updated 12 January 2026. LISFLOOD and LISFLOOD-FP generate the riverine inundation model on a 3 arc-second grid, approximately 90 m, in WGS84. Raw values are flood depth in metres. Available return periods are 10, 20, 50, 75, 100, 200 and 500 years. These are scenario maps, not current forecasts or observations.

The [copyright notice](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/copyright.txt) specifies CC BY 4.0: credit the European Union/Copernicus/JRC and indicate modifications. Retain the recommended dataset citation and link to the README.

The [tile index](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/tile_extents.geojson) is public GeoJSON. For RP100, all Malaysian territory fits within these three tiles:

| Tile | Exact public GeoTIFF | Coverage / bytes |
| --- | --- | --- |
| Western islands | [ID202_N10_E90_RP100_depth.tif](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/RP100/ID202_N10_E90_RP100_depth.tif) | Tile index extent about 89.977–99.976°E, 0.0079–10.0071°N. Needed for the westernmost Malaysian islands; do not omit it based on a mainland-only rectangle. |
| Peninsula / western Sarawak edge | [ID211_N10_E100_RP100_depth.tif](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/RP100/ID211_N10_E100_RP100_depth.tif) | 13,436,340 bytes; actual extent 99.9762515444–109.9754182387°E, 0.0079000000–10.0070666667°N. |
| Borneo | [ID220_N10_E110_RP100_depth.tif](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-GLOFAS/flood_hazard/RP100/ID220_N10_E110_RP100_depth.tif) | 10,266,949 bytes; actual extent 109.9754182388–119.9745849331°E, 0.0079000000–10.0070666667°N. |

HTTP range request `Range: bytes=0-1023` returned status 206 with correct `Content-Range` for tiles 211 and 220. Rasterio read actual remote windows. Tiled Float32 data have `nodata=-9999`. Resolution is approximately 0.000833333333 degrees. Use the actual file bounds and transform, not rounded 10-degree tile names.

Verification windows at RP100:

| Window | Valid depth cells | Maximum returned depth |
| --- | ---: | ---: |
| Klang, 101.3,2.9,101.6,3.2 | 39,673 | 8.1120004654 m |
| Sabah, 115.7,5.4,116.3,6.1 | 22,888 | 12.3249998093 m |
| Sarawak, 110.1,1.2,110.6,1.8 | 34,327 | 10.5930004120 m |

Exact positive cell centres, independently checked with `rasterio.sample`:

- Klang: longitude 101.5991682155283, latitude 3.037483333339665, depth 8.112000465393066 m; tile 211 pixel column 1947, row 8363.
- Sabah: longitude 116.29916825628595, latitude 5.4999833333374255, depth 12.324999809265137 m; tile 220 column 7588, row 5408.
- Sarawak: longitude 110.27416823964683, latitude 1.4241500000077991, depth 10.593000411987305 m; tile 220 column 358, row 10299.

Kota Kinabalu centre 116.0753,5.9804 and Kuching centre 110.35,1.55 returned -9999, which must be represented as null. Missing raster coverage or a masked pixel must not become a zero-depth assurance.

Each raw-depth filename also has a `_depth_reclass.tif` companion. Source classes are 1: below 1 m; 2: 1 to below 3 m; 3: 3 to below 10 m; 4: above 10 m. Permanent water and spurious-depth masks are separately provided. The README specifically identifies possible high-depth artefacts, small-channel issues, tile boundaries and DEM limitations. Preserve these distinctions and avoid using the model as a surveyed site flood level.

## JPS forecast layers whose currency is unverified

These actual public layers were queried successfully for metadata and counts:

- [Kelantan /0](https://maps.water.gov.my/arcgis/rest/services/floodforecast/floodforecasting_kln/MapServer/0): 534 polygons, `GM-KLN-IFSAR-100m_Maxima`.
- [Pahang /0](https://maps.water.gov.my/arcgis/rest/services/floodforecast/floodforecasting_phn/MapServer/0): 1,434 polygons, `GM-PHN-IFSAR-100m-Crop2D_Maxima`.
- [Terengganu /0](https://maps.water.gov.my/arcgis/rest/services/floodforecast/floodforecasting_trn/MapServer/0): 340 polygons, `GM-TRN-IFSAR-050m_Maxima`.

All expose only `FID`, geometry and `height`, without `timeInfo`, forecast issue time, ARI, or units in the layer schema. The service description says flood forecasting for the respective state; this does not establish that the current dataset is timely. `resultRecordCount` returned `400 Pagination is not supported.` Use bounded IDs if integrating after independently resolving timing and units. Until then, do not present these as current warnings or forecasts.

## Sarawak selected scheme data, not statewide assets

These [Sarawak government MFICORD endpoints](https://gislink.sarawak.gov.my/server/rest/services/mficord) returned WGS84 GeoJSON. They supplement other statewide Sarawak sources rather than replacing them:

- [irrigation_canal /1](https://gislink.sarawak.gov.my/server/rest/services/mficord/irrigation_canal/MapServer/1): 11 canal lines, fields `objectid,water_level,flow_rate,last_update,canal_width`; units and sensor provenance not established.
- [Storage_Pond /1](https://gislink.sarawak.gov.my/server/rest/services/mficord/Storage_Pond/MapServer/1): 1 pond polygon; projected source geometry area about 39,761.62 m².
- [Soil_Boundary /1](https://gislink.sarawak.gov.my/server/rest/services/mficord/Soil_Boundary/MapServer/1): 468 soil polygons with `symbol1,soil_type,area_ha,location,division`. Sample Batang Maro, BETONG.
- [Paddy_Lots /1](https://gislink.sarawak.gov.my/server/rest/services/mficord/Paddy_Lots/MapServer/1): 80 scheme polygons. Use `objectid,lot_no,project_name,soil_type,lot_area_ha,lot_status`; exclude personal `farmer` and `lot_owner` fields. Sample Lubok Punggor, published area 0.953 ha. These are agricultural scheme records, not a complete cadastral registry.
- [RainFall /1](https://gislink.sarawak.gov.my/server/rest/services/mficord/RainFall/MapServer/1): 287 points. Sample Samunsam, `rf_hourly__mm_`, `rf_daily__mm_`, timestamp `06-08-2026 11:15`.
- [WaterLevel /1](https://gislink.sarawak.gov.my/server/rest/services/mficord/WaterLevel/MapServer/1): 121 points. Sample Ulu Batang Kayan with named thresholds and timestamp `06-08-2026 11:00`.

The sampled August 2026 records are stale on 19 October 2026. Keep observation times, validate freshness, and do not display these numeric samples as current conditions. Some irrigation attributes also have old update times and unspecified units.

## Restricted, incomplete and unverified sources

- MyGeoportal folders `MyGeo_Data_Service`, `NADMA`, `NAHRIM` and `Fundamental_GDC` returned ArcGIS `499 Token Required`. A public directory listing does not grant anonymous data access. No tokens were obtained or access controls bypassed.
- JMG fallback administrative layers [District Coverage Sarawak /9](https://mygems.jmg.gov.my/server/rest/services/Demarcation_MIL1/FeatureServer/9) and [District Coverage Sabah /10](https://mygems.jmg.gov.my/server/rest/services/Demarcation_MIL1/FeatureServer/10) returned 32 and 25 polygons respectively. Their counts differ from MyGeoName's more recent combined district source. Do not merge administrative vintages as if contemporaneous.
- No anonymous complete national cadastral parcel register, assessed values, underground storm-drain connectivity, manhole inventory, surveyed inverts, or current installed cost database was established in this research.
- No independently verified official Sabah/Sarawak design-rainfall coefficient table was found. Global historical rainfall and flood models do not substitute for approved local IDF curves or design temporal patterns.
- Blank copyright and sharing-policy fields on Malaysian GIS metadata do not establish unrestricted commercial redistribution. Keep provider attribution, source update fields and provenance; seek the applicable data terms before broader redistribution. Live query access was verified, not a universal reuse licence.

## Integration order and honest coverage

1. Use the actual state/territory geometry for a nationwide coverage selector.
2. Add official river polygons and state-specific geology as regional context; detailed Peninsular lines and Sarawak agency river data can supplement them.
3. Add global WorldCover and SoilGrids with model/year/resolution labels for every Malaysian location, retaining null values.
4. Add Copernicus/JRC return-period model separately from agency flood-prone areas and dated historical incident records.
5. Route parcels, drains, ponds, gates and pumps to their actual published regional footprints, then allow authorised GeoJSON to supplement missing records. An empty provider response must not imply no property, no asset or no flood risk.
