# Flood simulation verification and pilot experiments

Executed 20 October 2026 against `app/src/township/flood/solver.ts` and the three cached real-terrain grids. These checks establish numerical behaviour and reproducibility, **not calibrated flood accuracy**.

## Method audited

The implementation uses face discharges between two-dimensional storage cells, a local-inertial pressure-gradient update with Manning friction, an adaptive gravity-wave timestep capped at 5 seconds, and conservative donor-volume limiting. Its method reference is [Bates, Horritt and Fewtrell (2010), Journal of Hydrology, DOI 10.1016/j.jhydrol.2010.03.027](https://doi.org/10.1016/j.jhydrol.2010.03.027); the [authors' university record](https://research-information.bris.ac.uk/en/publications/a-simple-inertial-formulation-of-the-shallow-water-equations-for-/) confirms the publication. This application is an independent simplified implementation and has **not** reproduced all benchmarks from that paper.

For each internal face, the same transferred volume is removed from its donor and added to its recipient. Proposed retention captures only water present in the containing cell, bounded by remaining capacity and inlet rate. Uniform drainage is also bounded by locally available surface water. No multiplier makes the after-case shallower; the after-case is rerun with these local sinks.

The audited mass equation is:

```text
initial surface water + gross rain
  = bulk runoff loss + perimeter outflow + drainage removal
    + retained water + remaining surface water + numerical residual
```

Bulk runoff loss is `(1 − C) × rainfall`; it is not a separately calibrated infiltration model. Stored water is retained for the entire simulated event without release. Free-outfall means zero exterior water depth, permitting outflow but no inflow. Closed boundaries prohibit perimeter transfer. Neither setting models neighbouring catchments, river stage, tide, sewer networks, culverts or building-scale barriers.

## Independent checks executed

- All three actual 90-minute pilot runs, before and after mitigation: every saved depth was finite and non-negative; all frame-level mass balances closed within `1e-5 m³`; final residual magnitude was below `7e-9 m³`.
- Zero-rain, initially dry versions of all three pilots with the same basins: retained and remaining surface water were exactly zero.
- A non-flat five-by-five closed lake with a dry shoreline and initially level water surface: maximum depth change was exactly zero.
- A flat closed domain, 90 mm rainfall and `C = 0.7`, without drainage/storage: final depth was `0.06299999999999929 m`, matching the analytic `0.063 m` to floating-point precision.
- An isolated dry high cell containing a large basin beside a much lower wet cell: capture remained `0 m³`; the original `2500 m³` stayed in the lower cell. Mitigation cannot retrieve water remotely from a dry location.
- `node --test tests/flood.test.ts`: **10 passed, 0 failed**. Coverage includes dry cells, analytic rain volume, lake equilibrium, downslope routing, steep wet/dry fronts, limited basin capacity/rate, temporal rainfall normalization, identical no-mitigation cases and invalid input rejection.

Mass conservation and positivity do not alone demonstrate accurate flow speed, inundation extent or flood depth. They are necessary numerical checks.

## Actual township experiment

Inputs shared by every comparison:

| Parameter | Assumption |
| --- | --- |
| Domain and grid | 1500 × 1500 m; 32 × 32 cells, each 46.875 m square |
| Elevations | Actual Copernicus GLO-30 DSM samples; see [terrain provenance](FLOOD-TERRAIN-SOURCES.md) |
| Rainfall | Uniform 90 mm over 60 minutes; no return-period claim |
| Runoff coefficient | 0.7, uniform and assumed |
| Manning roughness | 0.04, uniform and assumed |
| Drainage removal | Up to 5 mm/hour wherever water is locally available; assumed, not mapped pipe capacity |
| Initial condition | Dry surface; empty proposed storage |
| Recession | 30 minutes after rainfall; 90-minute total window |
| Boundary | Free-outfall perimeter; no external inflow or river/tidal backwater |
| Mitigation | Twelve proposed basins, each 1500 m³ capacity and 0.5 m³/s inlet limit; no release |

For this experiment, candidate cells were ranked by baseline `peakDepthsM`, then selected greedily in descending order with at least one intervening cell: no two selected cells share an edge or corner. Proposals are placed at those cell centres. This intentionally demonstrates hydraulic accessibility in pooled water. **It is not a feasible land-allocation plan**: sites may overlap roads, buildings or private land, and inlet connectivity, utilities and excavation require survey and design. Rankings are per-cell maxima over the event and need not occur simultaneously.

| Pilot | Maximum depth within window, before → after | Peak area at depth ≥0.10 m, before → after | Water captured by proposed storage | Final surface volume, before → after |
| --- | --- | --- | --- | --- |
| Bandar Bukit Raja | 0.652 → 0.604 m | 38.45 → 33.62 ha | 17,698 m³ | 102,831 → 85,673 m³ |
| Bandar Universiti Pagoh | 1.175 → 0.799 m | 24.61 → 22.85 ha | 18,000 m³ | 101,795 → 83,801 m³ |
| City of Elmina | 2.003 → 1.360 m | 19.34 → 17.80 ha | 18,000 m³ | 101,998 → 84,268 m³ |

Gross rainfall volume was `202,500 m³`; runoff was `141,750 m³` in each case. The proposed total capacity is `18,000 m³`; captures never exceeded it except floating-point rounding below `1e-9 m³`. Differences in final surface volume are not necessarily identical to capture because drainage and perimeter outflow also respond to changed surface depths.

Node 24 runtimes on the development machine were approximately **0.23–0.37 seconds per case**, excluding browser startup, data fetch, rendering and worker transfer. This is an observed local measurement, not a device-performance guarantee.

Baseline/after basin-cell indices, row-major and zero-based:

```text
bukit-raja: 717,659,409,826,712,695,875,153,572,370,470,483
pagoh:     856,904,440,742,264,604,434,886,796,174,947,209
elmina:    678,762,943,949,301,103,246,698,722,534,520,283
```

## Numerical and assumption sensitivity

The timestep cap was changed **only in an in-memory copy** of the unchanged solver for this audit; no source modifications were made. All other baseline inputs remained the same.

| Pilot | Peak depth, cap 5 s / 2.5 s / 1 s | Peak wet area change, 5 s → 1 s |
| --- | --- | --- |
| Bandar Bukit Raja | 0.651955 / 0.651943 / 0.651940 m | No cell change |
| Bandar Universiti Pagoh | 1.175293 / 1.176587 / 1.176582 m | No cell change |
| City of Elmina | 2.002921 / 2.008694 / 2.008655 m | 19.34 → 19.12 ha, one cell |

Baseline peak-depth changes were below 0.3%; fine-timestep residuals stayed below `1.6e-8 m³`. This demonstrates reasonable timestep agreement for these experiments, **not spatial-grid independence**. A cell is about 0.22 ha; wet-area thresholds can change by a cell even for a small depth difference.

Increasing the recession duration to 180 minutes (240-minute total window) gave baseline maximum depths of 0.652 m at Bukit Raja, 1.195 m at Pagoh and 2.014 m at Elmina. Pagoh and Elmina were still accumulating in some depressions when the 90-minute run ended. Call the displayed statistic **“peak within the simulation window”**, not the final or all-time worst flood depth.

Changing only the perimeter to closed changed baseline peak wet areas to 46.80 ha, 31.86 ha and 23.73 ha respectively; Elmina's maximum depth became 2.387 m. Boundary assumptions are therefore material. The selected 1.5 km locality window is not a delineated hydrological catchment and omits external floodwater.

## Reproduce the pilot experiment

From `app`, run the following with Node 24 after installing dependencies:

```sh
node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';
import { simulateFlood } from './src/township/flood/solver.ts';
for (const id of ['bukit-raja', 'pagoh', 'elmina']) {
  const terrain = JSON.parse(await readFile(`public/data/townships/${id}-terrain.json`, 'utf8'));
  const input = { terrain, rainfallMm: 90, durationMinutes: 60, runoffCoefficient: 0.7,
    roughnessManning: 0.04, drainageMmPerHour: 5, tailMinutes: 30, boundary: 'free-outfall' };
  const before = simulateFlood(input);
  const selected = [];
  const ranked = before.peakDepthsM.map((depth, index) => ({ depth, index }))
    .sort((a, b) => b.depth - a.depth);
  for (const cell of ranked) {
    const row = Math.floor(cell.index / terrain.cols), col = cell.index % terrain.cols;
    if (cell.depth > 0 && selected.every((s) =>
      Math.max(Math.abs(s.row - row), Math.abs(s.col - col)) > 1)) {
      selected.push({ ...cell, row, col });
    }
    if (selected.length === 12) break;
  }
  const proposals = selected.map((s, i) => ({ id: `basin-${i + 1}`, type: 'basin',
    x: terrain.originX + (s.col + 0.5) * terrain.dxM,
    z: terrain.originZ + (s.row + 0.5) * terrain.dzM,
    capacityM3: 1500, captureRateM3s: 0.5 }));
  const after = simulateFlood({ ...input, proposals });
  console.log(JSON.stringify({ id, before: before.metrics, after: after.metrics }));
}
NODE
```

## Demo claims supported and still unverified

The demo supports showing rainfall generating conserved water, terrain-dependent routing and ponding, a time-varying wet footprint, and finite local retention changing that footprint when all other inputs match. It supports transparent comparisons of **assumed** interventions and input sensitivity.

It does not establish observed flood recurrence, calibrated inundation depths, homes protected, safe routes, avoided losses, approved engineering storage sizes or actual drainage performance. The coarse, historical DSM includes roofs and vegetation; Pagoh contains flagged upstream zero elevations. Depth uncertainty from those elevations can exceed the displayed water depths. A real pilot needs current bare-earth survey/finished levels, connected drain and culvert data, catchment inflow and downstream stage, rainfall records, and observed inundation for calibration and independent validation.
