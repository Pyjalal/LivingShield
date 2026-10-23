# LivingShield

**Before committing to flood-mitigation works, show what stays wet.**

LivingShield is a Malaysian township flood-resilience prototype. It helps asset teams and reviewing engineers compare a storage concept under the same assumed storm, inspect the remaining flood exposure, and prepare a focused site-investigation brief.

[Open the live demo](https://livingshield-malaysia.fly.dev/)

Prepared for the Township of Tomorrow hackathon, Planet track. This is an independent prototype; no Sime Darby affiliation or endorsement is implied.

## What it does

- **3D township workspace:** inspect sourced building footprints, terrain and aerial context for Bandar Bukit Raja, Pagoh and Elmina.
- **Before/after flood comparison:** run the same storm with and without hypothetical storage, then compare depth, wet area, captured volume and the water budget at matched simulation times.
- **Explainable results:** inspect each storage concept's capture, remaining capacity and inlet assumptions.
- **Optional River Lab:** explore the supplied modular riverbank concept, inspect its 3D model and calculate indicative module quantities. A quoted module rate can provide a material-only subtotal.
- **Investigation brief:** combine a completed comparison with a proposed reviewer, next action and evidence request. Download readable HTML or full JSON.
- **Malaysian data tools:** explore rainfall, river gauges, weather, drainage assets, terrain and flood-hazard context, with engineering and scenario tools.

The interface includes presentation mode, light/dark/high-contrast themes, responsive layouts and an English/Bahasa Melayu guided narrative. Review plans are saved locally in the visitor's browser.

## Try the guided demo

1. Open the live site and select **Start the guided demo**.
2. Use Bandar Bukit Raja with 90 mm rainfall over 60 minutes and runoff coefficient 0.70.
3. Run the flood comparison, select **Place pooling-point demo basins**, then rerun.
4. Switch between before and after at the same simulation time. Inspect the result explanation and storage water budget.
5. Select **Review this flood option**, prepare the investigation request and download a brief.
6. Explore the optional bank study separately; the physical module is not assigned a hydraulic benefit in the flood model.

## Run locally

Requires **Node.js 24** and npm.

```sh
cd app
npm ci
npm run dev
```

Open [http://127.0.0.1:5180](http://127.0.0.1:5180). The development server proxies `/api` to the Node data server on port 3102. No API keys are required for the connected public sources; their availability and provider access rules still apply.

For a production build:

```sh
cd app
npm run build
npm start
```

Open [http://127.0.0.1:3102](http://127.0.0.1:3102). Set `HOST` and `PORT` to change the server binding. The Node server serves both the frontend and data API, so a static-only deployment of `dist` does not provide the complete application.

## Verify

Run from `app`:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The current release passed all 61 regression tests, build/type checking and lint. The deployed guided workflow was also checked in a browser, including 3D presentation controls, brief downloads and review-plan persistence.

## Project layout

```text
app/src/          React interface, engineering tools and flood model
app/server/       Node API and public-data adapters
app/public/       Township data, rendering assets and physical concept files
app/tests/        Regression tests
app/scripts/      Development and browser verification scripts
docs/             Data provenance, model validation and deployment notes
Dockerfile        Production image
fly.toml          Fly.io deployment configuration
```

## Deploy

The live demo runs on Fly.io in Singapore, with idle shutdown and restart on demand. A cold start may take a moment.

From the repository root, after configuring your own Fly.io application and authentication:

```sh
fly config validate --strict
fly deploy --remote-only --ha=false
```

Change the application name in `fly.toml` before deploying to a different Fly.io account. The production health endpoint is `/healthz`. See [deployment notes](docs/FLY-DEPLOYMENT.md).

## Model boundaries

LivingShield is a concept-screening tool. Its outputs require field survey, calibration, engineering review and current JPS/PBT requirements before design or construction decisions.

- The three pilot windows are 1.5 km squares, not official township boundaries or surveyed catchments.
- The 2D model uses a 32 × 32 grid over Copernicus surface elevations. It omits installed drain/sewer networks, culverts, river/tidal and external catchment inflow, and individual building barriers.
- Depths are uncalibrated grid results, not validated parcel or floor depths. Most building heights and facades are illustrative. The documented Elmina geometry/imagery mismatch remains unresolved.
- Storage locations, capacities and inlet rates are hypothetical. The riverbank module is a separate, unvalidated physical concept.
- Quotes, installation costs and operational benefits are not inferred. Missing observations remain missing; model outputs are distinguished from measurements.

See [flood model validation](docs/FLOOD-MODEL-VALIDATION.md), [terrain sources](docs/FLOOD-TERRAIN-SOURCES.md) and [Malaysian data provenance](docs/MALAYSIAN-DATA.md).

## Credits and source notices

The hydrology software builds on [HydroGrid by Team Redacted](https://github.com/Sadat41/HydroGrid), with the original MIT notice retained in [LICENSE](LICENSE). Imported rendering code, datasets and supplied design assets retain their own provenance and terms; the repository's MIT notice does not grant rights to every included third-party asset.

Detailed rendering credits and permissions are in [source notices](docs/SOURCE-NOTICES.md). Physical concept hashes and provenance are in [the asset record](app/public/livingshield/source.json). Data credits include OpenStreetMap contributors, Microsoft building footprints, Copernicus terrain and the respective Malaysian public-data providers.
