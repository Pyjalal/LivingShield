# TamanTahan flood demonstration verification

Verified 20 October 2026. Production build served at `http://127.0.0.1:3102/?review=flood-demo`; development checks used port 5180. Independent renderer, numerical and worker-lifecycle reviews were completed before the local commit.

## Delivered behaviour

The three 1.5 km pilot windows use actual Copernicus GLO-30 surface elevations, resampled to 32 × 32 cells across 225 ha. The worker routes rainfall runoff using a conservative local-inertial model. Before and after use identical terrain, rainfall, drainage, roughness and boundary assumptions. Only the after case contains the proposed finite, local, rate-limited storage. Playback and the timeline address matching frames; switching cases preserves the camera. Water renders as terrain-clipped wet cells at 1× vertical scale, with a depth legend.

The pooling-point preset places up to twelve hypothetical 1,500 m³ basins, separated by a spacing heuristic. It replaces the plan and requires a new run. It is not a suitability, land-access or engineering optimisation. Manually placed gardens, basins and surface-connected tank clusters remain available. Roof collection is not simulated.

## Production browser results

At 60 minutes, C = 0.70, drainage = 5 mm/h, Manning n = 0.04, free-outfall edges, 30-minute post-rainfall window. Each row uses the pilot's default regional MSMA proxy, a 60-minute storm, and the twelve-basin preset. These are separate scenario results, not observed flood measurements or comparisons between township safety.

| Pilot | Rain, mm | Area ≥0.10 m, before → after, ha | Maximum grid depth, before → after, m | Captured by 60 min, m³ |
| --- | ---: | ---: | ---: | ---: |
| Bandar Bukit Raja | 89.9 | 38.5 → 33.2 | 0.64 → 0.50 | 15,936 |
| Bandar Universiti Pagoh | 93.2 | 24.4 → 22.6 | 1.03 → 0.75 | 18,000 |
| City of Elmina | 89.9 | 18.7 → 17.8 | 1.79 → 1.17 | 18,000 |

For all three pilots, actual renderer camera position/target arrays were exactly identical before and after. Final screenshots were captured after the aerial imagery loaded. Township changes cleared old water and loaded the correct elevation range. No browser console errors or warnings were recorded during these production comparisons.

## Verification evidence

- `npm test`: 47/47 passed, including ten numerical flood tests covering conservation, equilibrium, positivity, local capture, finite capacity, temporal rainfall and identical no-plan comparisons.
- `npm run lint`, `npm run typecheck`, `npm run build`, JavaScript syntax checks and Git whitespace checks passed.
- [Worker and playback regression](QA-FLOOD-LIFECYCLE.md): cancellation/reversion, stale errors, playback end/restart, input invalidation, zero rainfall and actual JSON source provenance.
- [Numerical experiments and sensitivity](FLOOD-MODEL-VALIDATION.md): real grids, timestep sensitivity, boundary sensitivity, reproducible basin locations and mass residuals.
- [Terrain extraction and provenance](FLOOD-TERRAIN-SOURCES.md): native source windows, datum, source-zero warning and attribution.
- JSON download contains the actual terrain, rainfall source, full input, both frame sequences, storage and water balances. PNG export was visually checked with flood water and mitigation markers.
- Mobile Chromium at 390 × 844: no horizontal page overflow; rainfall/drainage and run/preset controls use two columns; timeline and comparison remain accessible.
- An intentional terrain-asset HTTP 404 disabled Run and displayed an explicit error, without flat or fabricated fallback elevations. Restoring the asset and choosing Retry terrain recovered the model. The deliberate 404 produced the expected browser network error.

Screenshots: `app/output/playwright/flood-production-{bukit-raja,pagoh,elmina}-{before,after}.png`, `flood-mobile-controls.png`, and `flood-render-export.png`. A compact summary of the downloaded Bukit Raja example is `app/output/playwright/flood-demo-results.json`; the full download is retained locally as the ignored `flood-demo-full-results.log`. The app exports complete JSON time series.

## Accuracy boundaries

This is uncalibrated scenario screening. Historical DSM includes vegetation/building returns and may predate earthworks; the 46.875 m cells do not resolve kerbs, individual barriers, drains, sewer or culvert networks, floor levels, river/tidal or neighbouring-catchment inflows. Pagoh retains six upstream zero-elevation cells with a visible warning. Storage inlets and drainage are assumptions. Some peaks occur after the simulated window. Numerical tests establish implementation behaviour, not local flood accuracy. Existing national hazard/context tools and the separate ideal-capture water budget remain available.
