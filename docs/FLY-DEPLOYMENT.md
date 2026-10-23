# Fly.io deployment

The root `Dockerfile` builds the frontend with Node 24, removes development dependencies and runs the existing native TypeScript server as the unprivileged `node` user. Its runtime contains `dist`, all server modules, production dependencies and `src/malaysia/catalogue.ts`, which the dataset API imports at runtime. The server's external runtime dependency is `geotiff` and its installed dependency tree; browser libraries are bundled by Vite.

The root `fly.toml` targets `livingshield-malaysia` in Singapore (`sin`) with one shared CPU, 512 MB RAM and port 8080. `HOST=0.0.0.0` exposes the server to Fly Proxy. HTTPS is enforced. Idle Machines may stop and restart on demand; `min_machines_running=0` allows a cold start. Deploy with `--ha=false` to avoid creating a spare Machine for this demo. A Fly account, an available app name and account billing eligibility are required; this configuration does not promise free hosting.

## Deploy from the repository root

After Fly sign-in and app creation, validate and deploy:

```sh
fly config validate --strict
fly deploy --remote-only --ha=false
fly status
fly checks list
```

If the app name changes, update `app` in `fly.toml` before deployment. Use the same name for status, logs and image references. The remote builder can build the image without a local Docker engine. The build context excludes local dependencies, built output, test screenshots, Git metadata and environment files; the public township data, 3D assets, film and attribution remain in the image.

## Verify the deployed release

`GET /healthz` returns `{"status":"ok","service":"LivingShield"}`. `HEAD` returns the same status without a body. This checks the serving process without querying weather, GIS or hazard providers; it does not certify that every external data source is available. Fly checks it every 30 seconds with a five-second timeout after a ten-second grace period.

```sh
curl --fail https://livingshield-malaysia.fly.dev/healthz
curl --fail --head https://livingshield-malaysia.fly.dev/livingshield/module_triangle.glb
curl --fail --head https://livingshield-malaysia.fly.dev/livingshield/LivingShield_demo.mp4
curl --fail --head https://livingshield-malaysia.fly.dev/livingshield/concept-captions.vtt
fly logs
```

The asset types should be `model/gltf-binary`, `video/mp4` and `text/vtt; charset=utf-8`. Binary responses no longer receive a text charset. Open the public URL and rehearse the guided township → baseline → proposed storage → rerun → River Lab → review/export route on desktop and mobile. Check the actual 3D model, film, captions and native map rather than accepting the health check alone.

Review plans remain in the visitor's browser storage. Completed comparisons and bank concepts are session state. No database or Fly volume is required. External provider errors retain the existing explicit unavailable/stale behaviour; the deployment adds no invented observations or hydraulic claims.

## Inspect or roll back

Before replacing a working release, retain its image reference:

```sh
fly releases --image
```

If the new release fails its health checks or the guided route, redeploy the previous successful image reference from that list:

```sh
fly deploy --image <previous-successful-image-reference> --ha=false
fly status
fly checks list
```

Then repeat `/healthz` and the guided route. Image rollback requires a previously successful deployed image; it cannot recover a first deployment that never succeeded.

## Preparation evidence

On 21 October 2026, the health regression test passed for GET/HEAD with an upstream fetcher that always fails. A separate temporary runtime installed only production dependencies using `npm ci --omit=dev`, then started the exact packaged `server/index.ts` under Node v24.14.0 with `HOST=0.0.0.0`. It served the landing page, native TamanKu iframe, catalogue registry and health endpoint. The film, GLB and caption responses matched the packaged files byte for byte and had the expected MIME types. Local TOML parsing confirmed the intended settings.

The local Docker CLI was present, but its Linux engine was unavailable, so no local container-build pass is claimed. Fly's strict platform validation initially required authentication; deployment status and public-host validation must be established after sign-in. The application build and broader demo checks are recorded separately in [competitive upgrade verification](COMPETITIVE-UPGRADE-VERIFICATION.md).

The deployment was initially deferred, then resumed at the user's explicit request after account sign-in. The final local application build, full ESLint, all 61 regression tests and the complete local production demo pass. A separate read-only deployment review found no blocking runtime/configuration issue.

## Deployed release and public checks

**Live:** [https://livingshield-malaysia.fly.dev/](https://livingshield-malaysia.fly.dev/). First release completed on **21 October 2026 at 14:55 MYT**. Fly strict configuration validation, the remote Linux build, image publishing, machine launch and DNS verification all succeeded. The remote production dependency audit also reports zero vulnerabilities. The existing lazy River Lab chunk warning remains a bundle-size observation, not a failed build.

- Application source: `67fe9c9`, including the implementation in `7b71c30`.
- Release: `v1`, status Complete.
- Image: `registry.fly.io/livingshield-malaysia:deployment-01M5EKP3NFP487FFED0C1PZBDS`.
- Image digest: `sha256:5c75bc6e82022ca814bdaa39468036e6af059461f7612319bf35511f32feffe8`.
- One machine, `2860566f5370e8`, in `sin`; one shared CPU, 512 MB, idle autostop and on-demand restart.
- Shared public IPv4 and dedicated IPv6 were allocated. No dedicated IPv4, database or persistent volume was added.

The public HTTPS health endpoint returns 200 and the configured Fly check passes. The process briefly failed its first startup probe while Node was initializing, then passed; the launch completed successfully. Logs confirm the native TypeScript server runs as `node` on port 8080.

Public HTTP checks returned 200 for the landing page, native TamanKu iframe, catalogue API, GLB and captions. The downloaded GLB is byte-for-byte equal to the packaged source (`sha256:5a99713a5468d5f39ad2c6cc20e5d4441910922ef15e184037f19bd45580f2bf`). The film HEAD response has `video/mp4`, the model `model/gltf-binary`, and captions `text/vtt; charset=utf-8`. Live upstream checks returned **2,717 station records** and **112 state forecast records**, each marked `stale: false`; these are dated response counts, not permanent availability guarantees.

A separate public mobile check activated the native film Play control: playback advanced, duration was 21 seconds, media ready state was 4 and no media error was present. The default English caption track loaded all five cues and displayed an active caption. This verifies delivery/playback, not the physical design's performance.

The unchanged canonical `verify-livingshield.py` completed successfully against the **public HTTPS URL**, with zero JavaScript page errors. It computes the 90 mm Bukit Raja baseline and twelve storage concepts, inspects result explanations, compares matched frames, tests Present view/Escape, configures the bank, prepares the local review, downloads both brief formats and verifies context isolation and browser-local review persistence. Actual end capture is **17,697.755031 m³**, with complete flood and bank attachments. The readable brief works offline and reflows at 390px. It is still an uncalibrated model result.

Public endpoint records and full-flow logs/screenshots are in the ignored `app/output/competitive-refresh/` directory (`fly-public-http.json`, `fly-public-upstream.json`, `fly-public-e2e/`). These local QA artifacts are excluded from the deployment image. Separate [public mobile/rendered QA](QA-FLY-PUBLIC.md) records its own exact scope. The public build does not establish survey accuracy, physical bank performance, calibration or every external provider's uptime.

References: [Fly configuration](https://docs.fly.io/reference/configuration), [Node TypeScript execution](https://nodejs.org/docs/latest-v24.x/api/typescript.html).

## Decision-led narrative release · 21 October 2026

Release **v2** completed at **15:29 MYT**, from implementation commit `a1056e5`. It leads with the intended SDP asset-team investigation decision, replaces the bank hero with a declared native flood-twin preview and lets a completed flood comparison go directly to an investigation brief. The bank study and its validation requests are optional. The underlying numerical algorithms and hosting footprint are unchanged.

- Image: `registry.fly.io/livingshield-malaysia:deployment-01M5ENMFZWFY6MNW3ZW2MRHDMQ`.
- Digest: `sha256:d206724198852f291064570c2b12b7a51ba9299d0b1e15cd3f3b054e03c53663`.
- Fly's rolling update and smoke/health checks succeeded. The CLI's final DNS probe to `8.8.8.8` timed out; the same public hostname resolved and served HTTPS successfully in the independent HTTP and browser checks. No global DNS-propagation claim is inferred from those checks.
- The public title and preview are the revised version. The downloaded preview matches its checked-in SHA-256; `/healthz` returns 200 and the Fly service check passes.
- The updated canonical public demo completed with zero page errors: same-storm comparison, direct flood-only brief, no bank-only validation requirements when the bank attachment is absent, optional bank branch, complete HTML/JSON handover, pilot isolation and authored-review reload persistence. Actual end capture remains 17,697.755031 m³ in the declared 90 mm case.

The [narrative QA](QA-JUDGE-NARRATIVE.md) records the rendered scope and remaining validation gap. The [all-project review](JUDGE-COMPARISON-ALL-PROJECTS.md) compares the story across all 68 discovered repositories, explicitly distinguishing 23 public projects from 45 source-only candidates. These are narrative and prototype checks; an SDP operator trial is still needed to establish adoption or workflow improvement.

Deployment and canonical public-flow evidence: ignored `app/output/competitive-refresh/judge-release/`. The previous complete v1 image above remains available as the known rollback reference.

## Interface reference cleanup · 23 October 2026

Release **v4** is complete. Removed the TamanKu display name from township loading/accessibility text, the viewport footer/title, the evidence panel and generated briefs. Original engine source comments and the detailed third-party provenance file remain available through Source notices. Existing internal asset URLs remain compatible.

The isolated release was built from `c2df9c4` plus the eight interface/verification edits; unrelated workspace changes to `app/server/datasets.ts` and `app/src/malaysia/catalogue.ts` were excluded.

- Image: `registry.fly.io/livingshield-malaysia:deployment-01M5KETT9BGZF5Y2Q01GQYKHQW`.
- Digest: `sha256:5ec7b7d25524bd532f30ac64c8ab2058fec6a35ab5ebac49a7df1fd15e0881de`.
- Rollback image: `registry.fly.io/livingshield-malaysia:deployment-01M5ER3ESF2TVK3QSJBFJ1JPDA` (v3).
- Build/typecheck, ESLint and all 61 regression tests passed. Remote production dependency audit reports zero vulnerabilities; the build-time dependency audit reports one high severity issue. The existing large-chunk warning remains.
- The deploy command timed out during its final DNS check after applying the image. Independent Fly release listing confirms v4 complete, the service check is passing, and public HTTPS `/healthz` returns 200.
- The canonical public guided flow passed with zero JavaScript page errors, including flood comparison, Present view/Escape, optional bank branch, both brief downloads and review persistence.
- Targeted public browser checks confirm no TamanKu display text in the township shell, rendered iframe, evidence panel or readable/exported brief labels. The iframe canvas is visible and its accessible title is LivingShield 3D township model.

Local ignored evidence: `app/output/branding-public-flow.log`, `app/output/playwright/ls-flow-results.json`, and `app/output/playwright/branding-live-township.png`.
