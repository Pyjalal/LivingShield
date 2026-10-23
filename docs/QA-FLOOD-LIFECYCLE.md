# Flood worker and playback regression

Verified on 20 October 2026 in a separate Chromium session named `flood-lifecycle`, using the development app at `http://127.0.0.1:5180/?review=flood-lifecycle`. The browser was closed after verification. No production code was changed during these checks.

| Scenario | Method | Result |
| --- | --- | --- |
| Cancelled run, then restore original inputs | Replaced `window.Worker` in this browser page with a controlled fake; started a run at 5 mm/h drainage, changed to 10, then returned to 5. | The first worker terminated. Run became enabled when the original inputs returned; the UI did not remain busy. |
| Stale worker errors | Started a second controlled worker, then invoked both the first worker's `onerror` and an error-shaped `onmessage` with its original request ID. | The second worker remained active. No stale error appeared, and its pending state remained intact. |
| Native worker restored | Reloaded the page after the controlled-worker checks. | `window.Worker` was the browser's native implementation. Subsequent simulations used the real solver. |
| Playback reaches the end | Ran the native simulation, moved the timeline to frame 59 of 60 and pressed Play. | Frame 60 showed Play, indicating playback stopped. Pressing Play again restarted at frame 0 and displayed Pause. |
| Changed inputs hide stale results | Changed drainage after a completed native run. | Export flood results disappeared. The 3D renderer reported `visible: false`, zero rendered water vertices, and cleared its previous frame. |
| Zero rainfall | Selected Custom rain, used the slider's Home key to set 0 mm, ran the real solver, selected the final frame and After mitigation. | Both displayed comparison depths and wet areas were zero. The renderer reported zero wet cells, maximum depth 0 and zero water vertices. |
| Zero-rain export | Downloaded the actual flood JSON from the zero-rain UI. | Rain, runoff, losses, drainage, boundary outflow, captured storage, final surface volume and mass error were all exactly 0. The exported rainfall source correctly identified a manual 0 mm, 60-minute scenario. |
| MSMA provenance export | Reloaded defaults, ran the native solver and downloaded flood results. | Export retained MSMA station `3314001`, all IDF coefficients, the 20-year return period, 60-minute duration, the MSMA source URL and page 59, plus the unverified regional-proxy qualification. |

The final default Bandar Bukit Raja check used 89.92282271800016 mm rainfall. At the selected 3,600-second frame, the renderer reported 369 wet cells, a maximum modelled depth of 0.6362897159838594 m and 6,012 water vertices. Both scenario mass residuals were approximately `-2.17e-9 m³` with no mitigation placed. Each result contained 61 frames.

The isolated browser console contained zero errors and zero warnings at the end of the run. The controlled-worker overrides existed only in this browser page and were removed by reload before native checks.

Full zero-rain and MSMA result downloads were saved as ignored local diagnostics under `app/output/playwright/flood-zero-rain.log` and `app/output/playwright/flood-idf-provenance.log`. These checks validate lifecycle behaviour and numerical bookkeeping; they do not establish observed-event flood accuracy.
