# ESA WorldCover 2021 legend

Verified 19 October 2026. Exact class labels and colours come from the [official QGIS colour legend](https://esa-worldcover.s3.amazonaws.com/v100/2020/docs/ESAWorldCover_ColorLegend.qml), linked by the [ESA data access page](https://esa-worldcover.org/en/data-access). Although the shared asset lives under `v100/2020`, all 11 codes and RGB values match Table 3, printed page 15, of the [2021 Product User Manual v2.0](https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/docs/WorldCover_PUM_V2.0.pdf).

| Code | Official label | Hex colour | RGB |
| ---: | --- | --- | --- |
| 10 | Tree cover | `#006400` | 0, 100, 0 |
| 20 | Shrubland | `#ffbb22` | 255, 187, 34 |
| 30 | Grassland | `#ffff4c` | 255, 255, 76 |
| 40 | Cropland | `#f096ff` | 240, 150, 255 |
| 50 | Built-up | `#fa0000` | 250, 0, 0 |
| 60 | Bare / sparse vegetation | `#b4b4b4` | 180, 180, 180 |
| 70 | Snow and ice | `#f0f0f0` | 240, 240, 240 |
| 80 | Permanent water bodies | `#0064c8` | 0, 100, 200 |
| 90 | Herbaceous wetland | `#0096a0` | 0, 150, 160 |
| 95 | Mangroves | `#00cf75` | 0, 207, 117 |
| 100 | Moss and lichen | `#fae6a0` | 250, 230, 160 |

These are the global product's classes; inclusion in the legend does not imply every class occurs in Malaysia. Tree cover includes plantations such as oil palm. Built-up is a land-cover class, not a cadastral building footprint or measured site impervious fraction.

## Coverage and service behaviour

The manual's section 3.4.2, printed page 16, describes global observed land coverage excluding Antarctica, with a northern limit of 82.75°N. This includes Peninsular Malaysia, Sabah, Sarawak and Labuan. Actual requests to the official WMS returned nonempty PNG images over Kota Kinabalu, Kuching and Labuan; see [national source verification](SOURCES-NATIONAL-MALAYSIA.md) for the first two requests. Labuan `BBOX=5.2,115.1,5.4,115.35` in EPSG:4326 returned HTTP 200, 6,033 bytes, 256×256 pixels and 9 colours. A cold Labuan request first timed out, then the same request succeeded.

Use `https://titiler.terrascope.be/wms`, `VERSION=1.3.0`, `LAYERS=esa-worldcover-map-10m-2021-v2_map`, and `TIME=2021-01-01`. The current endpoint requires uppercase WMS parameter names in practice. Parent integration verification found an uppercase EPSG:3857 request returned HTTP 200 and a 12,874-byte PNG in approximately one second, while the equivalent lowercase request timed out after 30 seconds; the browser had rendered 0 of 20 tiles. Leaflet's WMS configuration therefore needs `uppercase: true`. Do not infer the lowercase path works from a successful uppercase test. EPSG:4326 in WMS 1.3.0 uses latitude/longitude BBOX ordering; EPSG:3857 uses projected x/y bounds.

WorldCover is 2021 land-cover classification at approximately 10 m. WMS pixels are rendered RGB imagery for map context, not quantitative category values. Retain the [CC BY 4.0 licence and prescribed attribution](https://esa-worldcover.org/en/data-access): `© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium`.
