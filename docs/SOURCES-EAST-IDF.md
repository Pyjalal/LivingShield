# Sabah, Sarawak and Labuan design rainfall

Verified 19 October 2026. The authoritative missing engineering data is publicly downloadable from the Department of Irrigation and Drainage (DID) Sarawak, even though another DID webpage asks readers to request a copy. The downloadable manual is the **revised and updated 2018 Hydrological Procedure No. 26 (HP26)**, ISBN 978-983-9304-49-7.

Primary sources:

- [Official HP26 (2018), complete PDF](https://did.sarawak.gov.my/web/attachment/show/?docid=SUZnUENXOURWMEpoYVlVQmd4VGVKQT09OjpUn2F8yfdegZV2nX_AKRNg).
- [Official DID Sarawak guidelines catalogue](https://did.sarawak.gov.my/web/subpage/webpage_view/105), which identifies the revised and updated 2018 edition.
- [Official HP26 information page](https://did.sarawak.gov.my/web/subpage/webpage_view/1400). This page says to contact DID for a copy; use the working official PDF above rather than interpreting that page as evidence that all coefficients are unavailable.

## Integration files

`research/hp26-2018.json` contains factual numerical transcriptions of every high-ARI coefficient row in Tables 4.1 and 4.2, every matching station coordinate in Appendix A, and all normalized temporal patterns in Tables 6.2–6.10. `research/extract-hp26.py` reproduces this extraction from the original PDF with PyMuPDF.

The complete manual has 167 PDF pages and SHA-256 `c8438371e254dfbf83fcb00fe82a52af0914409226c5fad8d7d162f38719e0a1`.

```text
python -X utf8 docs/research/extract-hp26.py /path/to/HP26-2018.pdf
```

The extraction asserts 174 unique coefficient stations, complete coordinate matches, 81 temporal-pattern vectors, positive weights, and two numerical checks against the manual. It does not download or bundle the full PDF.

## IDF equation and supported domain

Equation (2.24), printed page 13 / PDF page 24, is:

```text
i = lambda * T^kappa / (d + theta)^eta
```

`i` is intensity in mm/hour; `d` is duration in **hours**; `T` is ARI in **years**. Do not feed duration in minutes to the equation. Rainfall depth is intensity multiplied by duration in hours.

The manual tabulates and demonstrates durations 15, 30 and 60 minutes, then 3, 6, 12, 24, 48 and 72 hours; ARIs are 2, 5, 10, 20, 25, 50 and 100 years. Treat **15 minutes to 72 hours, ARI 2–100 years** as the supported implementation domain. The existing Peninsular 5-minute lower limit must not silently carry over to HP26 profiles. Section 8.1 (printed page 72 / PDF page 83) explicitly instructs this set of durations and ARIs.

Tables 4.1 and 4.2 give 174 stations: 54 in the source's Sabah table (including one Labuan MMD station) and 120 in Sarawak. The extracted `state` is `Labuan` for MMD 96465, `Sabah` for the other 53, and `Sarawak` for 120; `sourceState` preserves the original table grouping. Source station IDs and aliases remain separate from names so repeated names such as Sri Aman can be distinguished.

| Profile | lambda | kappa | theta | eta | Source |
| --- | ---: | ---: | ---: | ---: | --- |
| Labuan MMD 96465 | 93.0111 | 0.1524 | 0.4415 | 0.8175 | Table 4.1, printed 24 / PDF 35 |
| Kota Kinabalu MMD 96471 | 101.8615 | 0.1675 | 0.6103 | 0.8534 | Table 4.1, printed 24 / PDF 35 |
| Semporna Airport 0890011RF (4486001) | 70.6422 | 0.1773 | 0.3591 | 0.8542 | Table 4.1, printed 24 / PDF 35 |
| Kuching MMD 96413 | 84.6865 | 0.1820 | 0.4599 | 0.7092 | Table 4.2, printed 26 / PDF 37 |
| Bunan Gega 1790061RF (905039) | 74.5208 | 0.1600 | 0.3508 | 0.8503 | Table 4.2, printed 26 / PDF 37 |

Complete coefficients are in the JSON, with the exact source PDF page on every row.

Independent numerical verification:

- Semporna Airport, duration 1 hour / ARI 10 years: calculated **81.759995600 mm/hour**, versus **81.76** in Table 4.3, printed page 29 / PDF page 40.
- Bunan Gega, duration 24 hours / ARI 100 years: calculated **10.311582146 mm/hour**, versus **10.31** in the worked example, printed page 72 / PDF page 83.

## Temporal patterns

The source defines **nine HP26 regions**, distinct from the five MSMA Peninsular regions. Figure 6.1 is printed page 51 / PDF page 62. Section 6.1 and the map show Sabah regions **1, 4, 5, 8**, and Sarawak regions **2, 3, 6, 7, 9**. Only numbered region labels are published. The text identifies region 1 with Tawau Division and region 4 with mountainous terrain; it does not give authoritative plain-language names for all nine.

No station-to-region lookup or machine-readable boundary was found in the manual. An explicit HP26 region selection linked to Figure 6.1 is supportable; automatic station or point assignment based on guessed geographical rules is not. Labuan has an IDF profile but is not visibly resolved on the published region map, so its temporal-region choice needs an explicit decision.

| Duration keys in JSON (minutes) | Blocks | Interval |
| ---: | ---: | ---: |
| 15 | 3 | 5 minutes |
| 30 | 6 | 5 minutes |
| 60 | 12 | 5 minutes |
| 180 | 12 | 15 minutes |
| 360 | 12 | 30 minutes |
| 720 | 12 | 60 minutes |
| 1440 | 24 | 1 hour |
| 2880 | 24 | 2 hours |
| 4320 | 24 | 3 hours |

Block definitions: Table 6.1, printed page 52 / PDF page 63. Patterns for regions 1–9: Tables 6.2–6.10, printed pages 53–61 / PDF pages 64–72. All 81 extracted weight vectors sum to 1.0 at the published three-decimal precision. Store raw numbers unchanged and preserve rainfall mass in the simulator.

## Coordinates and source limitations

Appendix A, printed pages 92–96 / PDF pages 104–108, supplies longitude, latitude and record length. Decimal coordinates were copied exactly; the appendix does not state the coordinate datum. Preserve source coordinates as station references rather than treating them as cadastral or project survey coordinates.

Two apparent source anomalies are retained and flagged in the JSON:

- Kalampun 1460171RF (5061001) is listed at longitude 118.1697, latitude 4.5934. This conflicts with the geography suggested by its legacy code. No unverified correction was made.
- Long Sambop 1730421RF (2939045) has the same published coordinate pair as Punan Bah 1730361RF (2333001). No unverified correction was made.

Table coefficients describe gauged sites. They do not establish that the closest station is automatically valid for any site in a state. HP26 also provides 10/20 km maps for ungauged sites and areal reduction factors; those maps have not been converted into invented point values here. Climate-change factors and daily-station long-duration estimates are separate analyses and should not be silently blended into the baseline IDF coefficients.

## Attribution and redistribution

The manual's copyright page (PDF page 8) reserves reproduction rights for its text and figures. No open-data licence for the manual was located. The extraction therefore contains factual numerical values and independent metadata with attribution; it does not reproduce the full manual, tables' visual formatting, maps, or other figures, and does not claim a government open-data licence. Link the original PDF for the region map. This is a provenance statement, not a legal determination about a downstream redistribution licence.

## Peninsular update source

[DID Hydrological Procedure No. 1 (revised and updated 2015)](https://h2o.water.gov.my/man_hp1/HP1_2015.pdf) is another primary source for Peninsular rainfall engineering. It must not be confused with HP26 or used to fill Sabah/Sarawak gaps. The existing 135 MSMA 2012 profiles remain separately identified by edition; this extraction adds the missing 174 HP26 2018 profiles without relabelling the existing Peninsular coefficients as newer HP1 results.
