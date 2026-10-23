# Public Fly mobile verification

Verified 21 October 2026 against [the deployed LivingShield site](https://livingshield-malaysia.fly.dev/) using isolated native Python Playwright Chromium at **390×844**, with touch and mobile emulation. The initial public document returned HTTP 200. This records a browser check of the public deployment; the canonical numerical comparison and API/media checks are recorded separately by the deployment owner.

## Connected mobile flow

The actual controls completed this route: landing → Start the guided demo → Explore → Compare the storm → Storm controls → native township view → Design the edge / River Lab → Review the brief → Prepare the local review → Finish walkthrough.

- The landing call to action and guide instructions were readable at mobile width. The guide step strip stays inside its own horizontal scrolling container.
- **Storm controls ↓** put keyboard focus on **Run flood comparison** and brought that button into the viewport. No solver run was needed for this navigation check.
- The native **TamanKu adapted 3D township model** iframe initialized and visibly rendered mapped geometry. Its frame measured 390×400 CSS pixels; the native canvas measured 390×346.
- River Lab fetched `/livingshield/module_triangle.glb` and visibly rendered the supplied module. Its source mesh has 33,886 triangles. The inspected renderer reported **33,966 rendered triangles**, including viewer geometry.
- The Evidence brief accurately stated that no flood comparison was attached in this isolated session. Opening River Lab attached its default bank concept; the guide displayed **1 of 2 sections attached**.
- The local review form initially disabled **Mark prepared for review**. Selecting Flood-model review and entering an example role, action and date enabled it. The action produced **Prepared for review** and **Saved on this browser.** The form explicitly states that nothing is submitted, assigned or approved. Test values belonged only to this disposable browser context.
- **Finish walkthrough** closed the guide successfully.

All seven connected-flow screenshots and the additional filled-review-fields screenshot were opened and visually inspected. Each recorded document width was **390px**; no document horizontal overflow was observed. The connected run recorded **zero JavaScript page errors, zero console errors and zero HTTP error responses**. One external ArcGIS aerial-image request was cancelled with `net::ERR_ABORTED` during navigation; the native township geometry had rendered successfully before leaving that view.

## Public film playback

A separate mobile browser probe opened River Lab, scrolled to **See the installation story**, and activated the video’s native Play control. The public MP4 returned HTTP 200. Playback advanced from **0.772302s to 2.003241s** over approximately 1.2 seconds. The native media element reported a **21-second duration**, `paused: false`, `readyState: 4` and no media error. Inline playback and native controls were enabled.

The default English caption track returned HTTP 200, reached loaded state 2, and reported five cues with mode **showing**. The inspected `09-film-playing.png` visibly shows the concept film playing at **0:02 / 0:21** with an English caption. This is a bounded playback and caption check, not a complete film review or validation of its design claims. No JavaScript page errors or document overflow occurred during this probe.

## Optional aerial imagery

An additional public township probe kept the native scene mounted for a further **15 seconds** after initialization. The renderer reported **1,003 buildings**, **1,016 mapped features** and ready terrain. The external ArcGIS request returned HTTP 200, but the texture had **not** finished loading: `aerialReady: false`, `aerialVisible: false`, `sampledRoofColors: 0`. The imagery credit remained hidden and no warning or JavaScript page error appeared during the bounded wait.

The inspected `10-native-aerial-settle.png` therefore establishes the working vector scene, not completed satellite imagery. External image completion remains unverified in this probe; an HTTP response alone is not evidence that a texture was decoded and applied. No fake aerial state was forced. The document remained 390px wide.

## Local evidence

Evidence is intentionally kept in the ignored app output directory:

`app/output/competitive-refresh/fly-public-mobile-20261021T065526Z/`

- `report.json`: connected-flow results, dimensions, renderer markers and browser/network observations; run 06:55:26–06:55:42 UTC.
- `01-landing.png`, `02-guide.png`, `03-storm-jump.png`, `04-native-township.png`, `05-river-lab-glb.png`, `06-evidence.png`, `07-local-review.png`: connected route.
- `08-review-fields.png`: additional public mobile probe showing the actual filled native stage/date/input/textarea controls.
- `09-film-playing.png` and `film-report.json`: native playback time, duration, loaded caption state and inspected film frame.
- `10-native-aerial-settle.png` and `aerial-report.json`: bounded optional-image wait and actual native renderer texture state.

This check establishes the observed public mobile behaviour. It does not validate surveyed accuracy, flood predictions, structural performance, external engineering review or an authority approval.
