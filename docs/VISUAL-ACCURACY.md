# Visual accuracy: primary reference pack

Checked 20 October 2026. This reference pack is supplemented by the completed [implementation and visual QA](QA-TAMANTAHAN.md) and [regional comparison record](QA-TOWNSHIPS-REGIONAL.md). The BBR official image and runtime imagery were inspected in real browsers; no developer photo or panorama tiles are bundled as application assets. Developer illustrations and historical photography are not current survey truth.

## Quick references

| Pilot | Primary visual references | What to compare |
|---|---|---|
| Bandar Bukit Raja | [Official township](https://simedarbyproperty.com/bandar-bukit-raja/index.html), [linked aerial 360](https://www.pixelgraph.my/virtual-tour/Master%20Plan/), [overview image](https://simedarbyproperty.com/bandar-bukit-raja/images/bbr-view.jpg), [layout image](https://simedarbyproperty.com/bandar-bukit-raja/images/lay1-m.png), [wetland image](https://simedarbyproperty.com/bandar-bukit-raja/images/sus-0.jpg) | Road orientation, block pattern, park/water position; distinguish masterplan from actual photo |
| Bandar Universiti Pagoh | [Developer township page](https://www.simedarbyproperty.com/bandar-universiti-pagoh), [official Harmoni Permai brochure/map](https://www.simedarbyproperty.com/sites/default/files/2019-03/HarmoniPermai_simplified_Brochure_A4.pdf) | Gallery location, roads, education-hub context and completed versus planned phases |
| City of Elmina | [Official township](https://www.simedarbyproperty.com/city-of-elmina/), [linked aerial 360](https://360vr.my/elmina/), [masterplan](https://www.simedarbyproperty.com/city-of-elmina/images/coe-masterplan.jpg), [alternate layout](https://www.simedarbyproperty.com/city-of-elmina/images/masterplan.jpg) | Correct precinct name, road geometry, water/park location and development age |

References are for comparison. No licence for copying developer photos, masterplans or tour assets into the prototype was established. Some direct image requests timed out in the text-fetch tool; their URLs were found in the official page source, not falsely described as visually inspected.

## Ground and animated flood accuracy

The scene now uses actual Copernicus GLO-30 DSM samples instead of flat ground: 32 × 32 cell-centre elevations over each 1.5 km square (225 ha), bilinearly resampled to 46.875 m cells. Building/road placement follows this surface for visual coherence. [Terrain provenance](FLOOD-TERRAIN-SOURCES.md) records source windows, datum, attribution and quality flags, including Pagoh's six upstream zero elevations.

This improves broad relief representation; it does not establish current bare-earth levels. The historical DSM includes canopy/roof returns and may predate earthworks. Displaying a building on that surface does not verify its ground or finished-floor level. Roofs and façades remain partly assumed, and Elmina's mapped-building/imagery discrepancy remains visible.

The flood overlay is computed by an uncalibrated local-inertial surface-flow model, with water level drawn above the same sampled terrain. It represents cell depths and their corresponding water surfaces. Before/after uses the same camera, timestamp, terrain and storm; only the proposed local retention changes. The simulation includes a 30-minute post-rain tail and exports both cases. Numerical checks are documented in [model validation](FLOOD-MODEL-VALIDATION.md).

No current survey or observed-event comparison validates inundation at individual parcels. Drains/sewers, culverts, kerbs, building barriers and river/tidal/external catchment inflow are unresolved or excluded. Water crossing a displayed building is not evidence its interior floods. Visual comparison of footprints and aerial photographs must remain distinct from hydraulic validation.

## Anchor checks

**BBR scene: latitude 3.0852, longitude 101.437697.** The developer page's [gallery map](https://goo.gl/maps/XAGwezz1VzQkN9PMA) resolves to latitude 3.0867496, longitude 101.4323721, at 1E Jalan Gamelan, Bandar Bukit Raja. The scene anchor is about 620 m east/southeast of that gallery. This verifies local township vicinity, not park placement or a legal township boundary. The official township page lists Town Park approximately 2 km away among amenities, so a small scene around the gallery must not be labelled a faithful wetland-park model without checking park position. [Official Karya brochure](https://www.simedarbyproperty.com/bandar-bukit-raja/karya/brochure.pdf) includes a masterplan and an image explicitly labelled an actual Townpark photo. Its future-development areas must not be treated as already built.

**Pagoh scene: latitude 2.173274, longitude 102.733172.** These exactly match GPS printed in the official Harmoni Permai brochure for the Bandar Universiti Pagoh gallery, KM25 Jalan Pagoh, Muar. This is a gallery anchor, not the centre or full boundary of the township or education hub. The brochure is from 2019; it cannot establish which buildings exist in 2026. Compare current imagery and mapped footprint completeness before claiming visual accuracy.

**Elmina scene: latitude 3.180368, longitude 101.517298.** The [official-linked tour configuration](https://360vr.my/elmina/pano.xml) contains geolocated panorama metadata:

| Scene | Latitude | Longitude | Photo metadata date |
|---|---:|---:|---|
| node15, Elmina East | 3.180613 | 101.519121 | 17 July 2020 |
| node16, Elmina Valley / Elmina West | 3.181085 | 101.514651 | 17 July 2020 |
| node6, Denai Alam | 3.156856 | 101.510986 | 11 July 2020 |
| node7, Denai Alam | 3.161982 | 101.515643 | 11 July 2020 |

The proposed anchor is between nearby East/Valley panorama positions; the metadata does not support relabelling it Denai Alam. It does not establish an exact precinct boundary or Central Park point. City of Elmina broadly includes Denai Alam and other precincts, but a precise scene label should name the actual represented area. The current official page's [gallery map](https://maps.app.goo.gl/mJwdWaNKfAhMQhCy5) resolves to latitude 3.1801135, longitude 101.5081394, roughly 1 km west. Tour photographs date from 2020–2022 and are historical comparison material.

## Esri imagery provenance and use

[World Imagery service metadata](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson) returned successfully. Its current copyright field credits Esri, Vantor, Earthstar Geographics, and the GIS User Community. General advertised resolution varies by location and source; do not claim a particular Malaysian pixel resolution or capture date without location-specific metadata.

The [official imagery item](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) names the Esri Master License Agreement and says this layer is not intended for offline tile export. Its [item metadata](https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json) exposes these terms. Anonymous endpoint access alone is not blanket permission for public commercial embedding. Review the applicable service/account terms before publication; keep live attribution visible. [Esri attribution guidance](https://doc.arcgis.com/en/arcgis-online/reference/display-copyrights.htm) requires credit on or near maps/images using hosted content.

For local visual inspection, use an online map browser with the same coordinates and compare within its permitted display surface. Do not bulk-download imagery, remove attribution or package remote tiles as local assets. Developer masterplans remain separate source references, not a texture to copy.

## Comparison record to complete against the running build

- Record app build, screenshot camera position/heading and imagery capture date if available.
- Compare at least three identifiable road intersections, three building footprints and one water/park landmark per pilot.
- Check north/east orientation, coordinate projection, scene origin and distances before styling judgments.
- Mark missing OSM buildings and inferred heights; extrusion does not establish actual roof shape, height or facade appearance.
- Check ground and water against the same Copernicus grid; keep before/after camera, timestamp and depth colour scale identical. Record rainfall, duration, roughness, drainage and boundary assumptions with screenshots.
- Separate observed footprint accuracy from cosmetic similarity. Do not score invented textures as evidence of real-world accuracy.
- Leave unverified pilots/landmarks explicitly unverified until inspected; this source pack alone is not completed visual QA.
