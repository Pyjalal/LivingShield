# Malaysia adaptation

## Full original-workflow adaptation

- [x] Restore original landing page, themes, navigation and every original module; inventory all dependencies.
- [x] Extend Malaysian data: Klang official parcels/land use/ponds/drainage, national JPS gauges, map infrastructure, historical weather and modelled discharge; validate source semantics.
- [x] Connect shared property/site state, complete published MSMA IDF catalogue and Malaysian temporal storm profiles; restore LID, simulation, detailed MYR cost and exports.
- [x] Exercise each original workflow on desktop/mobile, check empty/error paths and update QA/provenance; save the completed changes in a local commit.

User correction: preserve original HydroGrid UI and full scope. Earlier reduced interface below is superseded and retained only as change history. Never fabricate private asset or cadastral attributes when a source does not provide them.

- [x] Inspect upstream and verify Malaysian primary data sources.
- [x] Build cached data adapters and validated Malaysian design calculations.
- [x] Build Malaysian map, forecasts, station explorer, site imports and planning tools.
- [x] Exercise browser workflows, test error paths, review and document provenance.

Design: retain HydroGrid's Leaflet mapping and Recharts foundation. Use a map-led water operations workspace: deep sea #143f49, river teal #167d8d, pale blue #edf5f7, white #ffffff, slate #526774 and warning amber #a45e05. Segoe UI body with Georgia page title. Left-aligned controls alongside a large map; station readings and their timestamps take priority over decorative metrics. Responsive stacked mobile layout. English and Bahasa Melayu controls; official source text preserved.

Independent checkout in this directory; leave parent DefectDNA changes untouched.
