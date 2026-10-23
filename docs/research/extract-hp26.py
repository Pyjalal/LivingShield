import hashlib
import json
from pathlib import Path
import re
import sys

import fitz


SOURCE = "https://did.sarawak.gov.my/web/attachment/show/?docid=SUZnUENXOURWMEpoYVlVQmd4VGVKQT09OjpUn2F8yfdegZV2nX_AKRNg"


def clean(value):
    return " ".join((value or "").split())


def nonempty(row):
    return [clean(value) for value in row if clean(value)]


def codes(value):
    return re.findall(r"\d+(?:RF)?", value)


pdf_path = Path(sys.argv[1])
destination = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name("hp26-2018.json")
pdf = fitz.open(pdf_path)
assert len(pdf) == 167, "Expected the complete 167-page HP26 (2018) manual"
stations = []
for index in range(34, 39):
    for table in pdf[index].find_tables().tables:
        for row in table.extract():
            values = nonempty(row)
            if len(values) != 7 or not values[0].isdigit():
                continue
            number, station_id, name, lam, kappa, theta, eta = values
            aliases = codes(station_id)
            state = "Sabah" if index < 36 else "Sarawak"
            station = {
                "id": aliases[0],
                "aliases": aliases,
                "sourceStationId": station_id,
                "name": name,
                "state": "Labuan" if aliases[0] == "96465" else state,
                "sourceState": state,
                "source": SOURCE,
                "sourceTitle": "DID HP26 (2018), Table 4.1" if state == "Sabah" else "DID HP26 (2018), Table 4.2",
                "page": index + 1,
                "printedPage": index - 10,
                "lambda": float(lam),
                "kappa": float(kappa),
                "theta": float(theta),
                "eta": float(eta),
                "minDurationMinutes": 15,
                "maxDurationMinutes": 4320,
                "minReturnPeriodYears": 2,
                "maxReturnPeriodYears": 100,
            }
            stations.append(station)

assert len(stations) == 174, len(stations)
assert len({station["id"] for station in stations}) == 174
coordinates = {}
for index in range(103, 108):
    for table in pdf[index].find_tables().tables:
        for row in table.extract():
            values = nonempty(row)
            if len(values) != 6 or not values[0].isdigit():
                continue
            number, station_id, name, years, longitude, latitude = values
            coordinate = {
                "lat": float(latitude),
                "lng": float(longitude),
                "coordinatePage": index + 1,
                "coordinateStationName": name,
                "recordYears": int(years),
            }
            for alias in codes(station_id):
                coordinates[alias] = coordinate

for station in stations:
    match = next((coordinates[alias] for alias in station["aliases"] if alias in coordinates), None)
    assert match is not None, station["id"]
    station.update(match)
    assert 0 < station["lat"] < 8
    assert 109 < station["lng"] < 120

durations = [15, 30, 60, 180, 360, 720, 1440, 2880, 4320]
counts = [3, 6, 12, 12, 12, 12, 24, 24, 24]
patterns = {}
for region in range(1, 10):
    index = 62 + region
    tables = pdf[index].find_tables().tables
    assert len(tables) == 1
    data = tables[0].extract()[2:]
    values_by_duration = {}
    for column, (duration, count) in enumerate(zip(durations, counts)):
        values = []
        for row in data:
            if not clean(row[0]).isdigit():
                continue
            value = clean(row[3 + 3 * column])
            if value:
                values.append(float(value))
        assert len(values) == count, (region, duration, len(values))
        assert all(value > 0 for value in values)
        assert abs(sum(values) - 1) < 0.0051, (region, duration, sum(values))
        values_by_duration[str(duration)] = values
    patterns[str(region)] = values_by_duration

sem = next(station for station in stations if station["id"] == "0890011RF")
bunan = next(station for station in stations if station["id"] == "1790061RF")


def intensity(station, duration_hours, years):
    return station["lambda"] * years ** station["kappa"] / (duration_hours + station["theta"]) ** station["eta"]


assert abs(intensity(sem, 1, 10) - 81.76) < 0.005
assert abs(intensity(bunan, 24, 100) - 10.31) < 0.005
output = {
    "source": SOURCE,
    "title": "Hydrological Procedure No. 26: Estimation of Design Rainstorm in Sabah and Sarawak",
    "edition": "Revised and Updated 2018",
    "publisher": "Department of Irrigation and Drainage Malaysia",
    "pdfSha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
    "equation": "i = lambda * T^kappa / (d + theta)^eta",
    "intensityUnit": "mm/hour",
    "durationUnit": "hours",
    "returnPeriodUnit": "years",
    "documentedDurationMinutes": durations,
    "documentedReturnPeriodYears": [2, 5, 10, 20, 25, 50, 100],
    "coordinateNotice": "Decimal degrees transcribed verbatim from Appendix A; coordinate datum is not stated there. Coordinates are station references, not surveyed project locations.",
    "sourceAnomalies": [
        "Kalampun 1460171RF has longitude 118.1697 and latitude 4.5934 in Appendix A; these conflict with the location suggested by legacy code 5061001. Published coordinates were retained without unverified correction.",
        "Long Sambop 1730421RF has the same published coordinates as Punan Bah 1730361RF. Published coordinates were retained without unverified correction.",
    ],
    "patternNotice": "Raw published weights are retained. HP26 regions 1-9 are distinct from MSMA Peninsular regions 1-5. The geographical map is Figure 6.1, PDF page 62 (printed page 51); no station-to-region crosswalk is bundled because none was found in the manual. All 81 published vectors sum to 1.0 to three decimal precision.",
    "patternRegions": [
        {"id": region, "label": f"HP26 Region {region}", "state": "Sabah" if region in [1, 4, 5, 8] else "Sarawak", "mapPdfPage": 62}
        for region in range(1, 10)
    ],
    "patternPdfPages": {str(region): 63 + region for region in range(1, 10)},
    "patternBlockCounts": dict(zip(map(str, durations), counts)),
    "rightsNotice": "Factual numerical transcriptions with source attribution. No standalone open-data licence was found for the manual. The full copyrighted PDF is not bundled.",
    "stations": stations,
    "patterns": patterns,
    "verification": [
        {"stationId": sem["id"], "durationHours": 1, "returnPeriodYears": 10, "calculatedIntensity": intensity(sem, 1, 10), "publishedIntensity": 81.76, "pdfPage": 40, "table": "4.3"},
        {"stationId": bunan["id"], "durationHours": 24, "returnPeriodYears": 100, "calculatedIntensity": intensity(bunan, 24, 100), "publishedIntensity": 10.31, "pdfPage": 83, "section": "8.1"},
    ],
}
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Extracted {len(stations)} stations with coordinates and {len(patterns)} temporal regions ({sum(len(values) for values in patterns.values())} duration-pattern vectors).")
print(f"Semporna 1h/10y: {intensity(sem, 1, 10):.9f} mm/h; Bunan Gega 24h/100y: {intensity(bunan, 24, 100):.9f} mm/h.")
print(f"Output: {destination}")
