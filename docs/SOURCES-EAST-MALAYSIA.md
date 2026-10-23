# Official East Malaysia source verification

**Access recheck:** After the initial successful anonymous responses, the same correct host and original query URLs began returning ArcGIS error499 `Token Required`, including layer metadata, count, sample and bbox queries, both JSON and GeoJSON. This affects SHARES river, landuse, water features and mficord canal metadata. Treat all gislink services as currently restricted/unavailable; successful evidence records historical observations, not a stable public integration. No token bypass was attempted.

Verified anonymously on 19 October 2026 (Malaysia time). These are read-only research findings; no credentials, token discovery, write operations or TLS bypass were used. Public query access is not proof of an open redistribution licence. Unless noted, service copyright/description fields were blank and no explicit source licence was established.

## Integration priorities

1. Sarawak statewide river geometry and land-use context are queryable now. They describe mapped context, not flood probability, pipe capacity, survey boundaries or modelled inundation.
2. Sarawak irrigation canals and a storage pond are a small Lubok Punggor-area sample, not state coverage. Numeric flow and width fields lack unit definitions; do not feed them to engineering calculations.
3. Sabah GeoExplorer exposes official-source gauge snapshots with valid HTTPS. They are stale, inconsistent and include sentinel thresholds; expose per-record timestamps and never call them live.
4. Sabah JKR public road geometry is available statewide for access/infrastructure context. It is not a drainage inventory.

## Sarawak verified ArcGIS layers

All endpoints below return anonymous feature geometry. Standard sample query: `/query?f=geojson&where=OBJECTID%3D1&outFields=*&outSR=4326`. For land-use use `where=FID%3D1`; pagination is unsupported, and adding resultRecordCount triggers error 400. Use object-ID selection and viewport bounding boxes with `geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects`. Always check exceededTransferLimit and do not equate empty/incomplete queries with absence.

### SHARES/T735_RIVER/MapServer/0

- [Official layer](https://gislink.sarawak.gov.my/server/rest/services/SHARES/T735_RIVER/MapServer/0)
- Count: 565026; geometry: esriGeometryPolyline. WGS84 extent: `[109.5423660735684, 0.8560570146336981, 115.67460105268536, 4.99314333571563]`.
- Fields: `OBJECTID, Shape, FNODE_, TNODE_, LPOLY_, RPOLY_, LENGTH, RV210915_, RV210915_I, RVTYPE, RVNAME, Shape_Length`.
- Sample properties: `{"OBJECTID": 1, "FNODE_": 1, "TNODE_": 2, "LPOLY_": 1, "RPOLY_": 1, "LENGTH": 605.96566, "RV210915_": 1, "RV210915_I": 16, "RVTYPE": "RV02", "RVNAME": " ", "Shape_Length": 607.6195144920615}`.

### SHARES/T735_WATER_FEATURE/MapServer/0

- [Official layer](https://gislink.sarawak.gov.my/server/rest/services/SHARES/T735_WATER_FEATURE/MapServer/0)
- Count: 304; geometry: esriGeometryPoint. WGS84 extent: `[109.85916272300233, 1.1316162239369485, 115.40380925975505, 4.5867079931149055]`.
- Fields: `OBJECTID, Shape, AREA, PERIMETER, WF41157_, WF41157_ID, WFTYPE, WFNAME`.
- Sample properties: `{"OBJECTID": 1, "AREA": 0, "PERIMETER": 0, "WF41157_": 0, "WF41157_ID": 0, "WFTYPE": "WF07", "WFNAME": " "}`.

### SHARES/T735_Landuse/MapServer/0

- [Official layer](https://gislink.sarawak.gov.my/server/rest/services/SHARES/T735_Landuse/MapServer/0)
- Count: 33841; geometry: esriGeometryPolygon. WGS84 extent: `[109.50054197171795, 0.7427122787144519, 115.76121842192791, 5.006150931118347]`.
- Fields: `FID, Shape, AREA, PERIMETER, LU111312_, LU111312_I, LUTYPE, LUNAME`.
- Sample properties: `{"FID": 1, "AREA": 1579649.41454, "PERIMETER": 14622.40495, "LU111312_": 0, "LU111312_I": 0, "LUTYPE": "LU55", "LUNAME": " "}`.

### mficord/irrigation_canal/FeatureServer/1

- [Official layer](https://gislink.sarawak.gov.my/server/rest/services/mficord/irrigation_canal/FeatureServer/1)
- Count: 11; geometry: esriGeometryPolyline. WGS84 extent: `[110.69260620985143, 1.3370909866221208, 110.6999301762487, 1.3432661323865112]`.
- Fields: `objectid, water_level, ph_level, flow_rate, temperature, turbidity, last_update, canal_width, Shape__Length`.
- Sample properties: `{"objectid": 1, "water_level": 0.5, "ph_level": null, "flow_rate": 5, "temperature": null, "turbidity": null, "last_update": 1785859303000, "canal_width": 900, "Shape__Length": 224.56729157596752}`.

### mficord/Storage_Pond/FeatureServer/1

- [Official layer](https://gislink.sarawak.gov.my/server/rest/services/mficord/Storage_Pond/FeatureServer/1)
- Count: 1; geometry: esriGeometryPolygon. WGS84 extent: `[110.6969267845766, 1.3432518317483386, 110.69887575470473, 1.3451213821442358]`.
- Fields: `objectid, location, water_level, ph_level, flow_rate, temperature, turbidity, remark, last_update, Shape__Area, Shape__Length`.
- Sample properties: `{"objectid": 1, "location": null, "water_level": 2, "ph_level": 6.5, "flow_rate": 50, "temperature": 28, "turbidity": "murky", "remark": null, "last_update": 1785929647000, "Shape__Area": 39761.623558432024, "Shape__Length": 785.4908244574358}`.

### mficord/WaterLevel/FeatureServer/1

- [Official layer](https://gislink.sarawak.gov.my/server/rest/services/mficord/WaterLevel/FeatureServer/1)
- Count: 121; geometry: esriGeometryPoint. WGS84 extent: `[109.92373300235154, 1.0433014706117893, 115.34038263452555, 4.595420845989673]`.
- Fields: `objectid, record_no, station_id, station_name, station_type, division, division_id, river_basin, latitude, longitude, normal_level__m_, alert_level__m_, warning_level__m_, danger_level__m_, current_reading__m_, status, timestamp`.
- Sample properties: `{"objectid": 1, "record_no": 1, "station_id": "101213", "station_name": "Ulu Batang Kayan", "station_type": "Combine", "division": "Kuching", "division_id": 1, "river_basin": "Batang Kayan", "latitude": 1.5026020000000002, "longitude": 109.92377499999999, "normal_level__m_": 3, "alert_level__m_": 13, "warning_level__m_": 14, "danger_level__m_": 15, "current_reading__m_": 4.53, "status": "Normal", "timestamp": "06-08-2026 11:00"}`.

### mficord/RainFall/FeatureServer/1

- [Official layer](https://gislink.sarawak.gov.my/server/rest/services/mficord/RainFall/FeatureServer/1)
- Count: 287; geometry: esriGeometryPoint. WGS84 extent: `[109.64542777067132, 0.9159388378776229, 115.61855772135644, 4.955980220657201]`.
- Fields: `objectid, record_no_, station_id, station_name, station_type, division, river_basin, latitude, longitude, rf_hourly__mm_, rf_status, rf_daily__mm_, timestamp`.
- Sample properties: `{"objectid": 1, "record_no_": 1, "station_id": "101211", "station_name": "Samunsam", "station_type": "Rainfall", "division": "Kuching", "river_basin": "Sungai Samunsam", "latitude": 1.952, "longitude": 109.6454722, "rf_hourly__mm_": 0, "rf_status": "No Rain", "rf_daily__mm_": 0, "timestamp": "06-08-2026 11:15"}`.

Native river/water-feature projection is EPSG:3857; published geometric lengths are projected geometry, not hydraulic measurements. Land-use native CRS is custom Timbalai 1948 RSO Borneo metres, but outSR=4326 worked. Mficord native CRS EPSG:29873; outSR=4326 worked. Rainfall aliases explicitly specify hourly/daily mm; WaterLevel current/threshold aliases explicitly specify metres. August 2026 station snapshots are not current observations. Canal/pond units are not specified, despite plausible-looking numbers. No verification establishes the inventory completeness or publication date of T735 river/land-use datasets.

Full returned metadata and simplified real sample geometries: [east-malaysia-query-evidence.json](east-malaysia-query-evidence.json).

## Sabah verified data

[Official GeoExplorer map](https://explorer.digitalsabah.gov.my/map) uses its public client bundle to fetch the following sources. Its UI describes hydrology as sourced from infobanjir.sabah.gov.my.

- [Rainfall JSON](https://explorer.digitalsabah.gov.my/source/rainfall.json): 39 stations, extent `[115.727,4.28236,118.317,6.88232]`. Example `1380031RF`, Inanam Met. Stn. di Sabah (RHN), district Kota Kinabalu, `[116.115,5.9958]`; rf1hour 0, dailyrf 0.5, lastUpdate `2026-10-14T07:45:00`. UI renders rainfall as mm. Source includes invalid year0001, old timestamps and station status; require timestamp validation.
- [Water-level JSON](https://explorer.digitalsabah.gov.my/source/waterlevel.json): 15 stations, extent `[115.727,4.4153,117.884,6.49652]`. Example `1340041WL`, Sg. Wariu di Bridge No. 2 Sabah (RHN), `[116.486,6.3238]`, reading26.58, timestamp `2026-10-14T07:45:00`, stationStatus Offline. Example thresholds9700/9800/9900 are unsuitable for normal classification. Another record has future timestamp `2026-12-13T15:15:00`. Display raw source units only after independently checking UI labels; never invent datum or flow.
- Whitelist only station ID/name, basin, district, latitude, longitude, reading, source timestamp, source status. Source includes operational GSM contact numbers; do not ingest or show them. Saved research evidence is redacted.

[JKR public road layer](https://roadmaintenance.jkr.sabah.gov.my/arcmanager/rest/services/Hosted/Road_Section_public_view/FeatureServer/1): count18015, WGS84 extent `[115.3429850767,4.1875011756,119.2774120949,7.2664271201]`; Query-only layer, maxRecordCount1000, nativeEPSG:29873. `/query?f=json&where=1%3D1&outFields=objectid,road_name,district_name,road_length&outSR=4326&resultRecordCount=1&returnM=false` returned real LineString paths for OBJECTID47, J. Kubu Baru, Beaufort: `[[115.73876,5.38848],[115.73861,5.38858]]`. road_length is null; geometryProperties length unit explicitly esriMeters. Supported formats metadata lists JSON, so adapter must convert Esri paths to GeoJSON if geojson fails. Public-view endpoint and copyright blank establish access, not redistribution licence. See [road evidence](sabah-road-query-evidence.json) and [redacted hydrology evidence](sabah-hydrology-query-evidence.json).

## Access restrictions and unresolved gaps

- Direct `https://infobanjir.sabah.gov.my/Map?focus=47` failed standard Python TLS verification: certificate expired. Do not disable TLS verification to integrate.
- [SMEPPS anonymous search](https://smepps-geo.sabah.gov.my/arcgis/sharing/rest/search?f=json&q=Sabah&num=100) returned total0; anonymous ArcManager directory exposed only Utilities. This is not evidence that datasets do not exist, only that they were not anonymously discoverable.
- [Sabah GeoFusion](https://geofusion.digitalsabah.gov.my/) explicitly says Strictly for Agency Use Only. Do not treat its agency catalog as public access.
- Sarawak SHARES and mficord layers above were anonymous, but other folders (including lsd, udims, eLASIS_M) listed no services anonymously. No complete public cadastral-parcel inventory verified. Mficord Paddy_Lots has80 agricultural polygons and owner/farmer fields; it is not a general cadastral service and personal fields should not be ingested.
- [Sarawak official river-basin SuperMap service](https://maps61.sarawak.gov.my/iserver/services/data-DID_River_Basin/rest/data.json) returned a service catalog, but datasource discovery timed out. Not yet an integration verified by returned basin geometry.
- No official anonymous Sabah drainage pipes, pond inventory, cadastral parcels, land-use polygons or probabilistic flood hazard geometry was established during this pass. Keep missing coverage explicit rather than substituting incidents or gauge readings as flood probabilities.


## Safe normalisation allowlists

Sabah road attributes: `objectid`, `road_name`, `district_name`, `jurisdiction`, `surfacetype`, `road_length` (nullable source value; unit not defined), plus geometry. Do not select contractor or operational contact attributes. Preserve `source`, `sourceUrl`, `retrievedAt` separately. Geometry is converted from Esri paths; request `returnM=false`, `returnZ=false`, `outSR=4326`.

Sabah observations: `stationId`, `stationName`, `stationCode`, `district`, `mainBasin`, `subBasin`, parsed numeric `latitude`/`longitude`, `lastUpdate`, `stationStatus`; rainfall `rf1hour`, `dailyrf`, source `rfStatus`; water `waterlevel`, source `wlStatus`, `trend`. Optional threshold source values remain raw and unclassified until independently validated. Rainfall UI units are mm; do not confuse total mm in an hour with measured instantaneous intensity. Water datum is unspecified. Validate longitude/latitude numeric ranges before building Point GeoJSON.

Timestamp values use `YYYY-MM-DDTHH:mm:ss` without offset. Preserve original string; if interpreting as Malaysia local time, explicitly attach `+08:00` and record that assumption. Reject year0001 and future observation times; expose stale flag derived from observation age rather than `stationStatus`. August Sarawak station strings use `DD-MM-YYYY HH:mm`, also without offset. Reject invalid dates and never replace absent observation time with retrieval time.
