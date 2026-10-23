# TamanKu rendering adaptation

The local HydroGrid viewport uses an adapted copy of **TamanKu's actual Three.js rendering engine** by Ng Kai Sheng, Ang Ji Jin, Tan Kok Thye, Ng Jun Ze and Chin Nian Yitt.

Source: https://github.com/hongchenzhijin/TamanKu/tree/a78aa4d0f2caf558c473935c24e5b48ca11bdb4b

Original file: `js/world.js`; SHA-256 `0e285977809ee900ec46b01b43f535e533e0dddd56e2046875cf5411b68ec42c`.

The inspected repository did not supply a software licence. This local adaptation follows the user's explicit request to use the existing implementation; it does not represent a new licence grant or claim permission for general redistribution. TamanKu code is not represented as HydroGrid's independent original implementation.

HydroGrid modifications connect real township GeoJSON, preserve feature identifiers and supplied heights, add lifecycle and message APIs, clip rendering to the study window, and provide selection and proposed stormwater interventions. The original neighbourhood sample dataset, residents, agency references, gamification, inferred terrace subdivisions, procedural housing, synthetic traffic and assumed installed solar panels are not included. Building facade details remain illustrative.

OpenStreetMap geometry is attributed separately to © OpenStreetMap contributors under ODbL 1.0: https://www.openstreetmap.org/copyright . Building heights derived from levels or defaults retain their assumption metadata in the parent application. Road and linear-waterway widths use tagged dimensions when available and visual defaults otherwise.

Where the parent dataset supplies them, additional footprints come from **Microsoft Global ML Building Footprints**, https://github.com/microsoft/GlobalMLBuildingFootprints , under **CDLA Permissive 2.0**, https://cdla.dev/permissive-2-0/ . These are machine-inferred polygons with provider metadata, not OSM objects or surveyed buildings. Their rendering heights remain explicitly assumed. The supplied dataset retains its provider attribution and licence text; the iframe displays additional source credit when Microsoft features are present.

Optional aerial ground imagery is requested at runtime from Esri World Imagery. Roof colours use the median of several imagery pixels inside each mapped footprint and outside its holes where possible; they are approximate imagery colours, not surveyed materials. Missing samples retain neutral display colours. Untagged roof forms remain unknown. Credits: © Esri and its data contributors; source metadata and attribution are available at https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer . No imagery is bundled in this directory.

The flood demonstration uses separately attributed Copernicus DEM GLO-30 surface elevations supplied by the parent application. Each terrain grid retains its dataset source, processing, quality notices and vertical datum. Copernicus DEM is a digital **surface** model: buildings, vegetation and editing artefacts may affect elevation. Rendering subtracts the minimum elevation solely to position the local scene; it preserves metre differences at 1× vertical scale. Building display-height scaling affects building geometry only. Buildings and mapped road, water and green-space geometry are placed on the interpolated terrain; their display placement does not supply surveyed floor or drain-invert levels.

Terrain credit: produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. Source: https://registry.opendata.aws/copernicus-dem/ . The parent dataset includes the applicable licence attribution and source links.

The new flood layer is HydroGrid's adaptation, driven by depth arrays calculated outside the TamanKu engine. It displays each numerical cell's water level above its supplied terrain elevation. The surface is clipped against the rendered terrain, excludes depths below 0.02 m, and uses discrete depth colours. This is a coarse screening visualisation of the parent numerical model, not a measured flood extent, calibrated hydraulic prediction, surveyed building inundation or an operational emergency map. Timeline playback changes supplied model frames; the viewport does not invent a rising decorative water plane or independent flood motion.

`vendor/three.min.js` and `vendor/OrbitControls.js` are Three.js 0.147.0, used to match the original engine API. Three.js is MIT licensed; its full notice is retained in `vendor/LICENSE.three.txt`. Sources:

- https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js
- https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js
- https://github.com/mrdoob/three.js/blob/r147/LICENSE

HydroGrid's parent React application continues to use its existing Three.js version. The iframe isolates the legacy engine and its globals.
