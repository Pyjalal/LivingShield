# Judge-narrative visual and interaction QA

Checked **21 October 2026** against the rebuilt production server at `http://127.0.0.1:3102/`. This supplements the canonical computation/export checks; it does not repeat their numerical validation or certify the public Fly release.

## Scope and method

Isolated Python Playwright Chromium sessions used the actual application controls. Landing checks cover **1440×1000, 390×844 and 320×844**. Each fresh session started in Light, then used the real **Cycle theme** button to enter Dark and High contrast. The application tokens were respectively `accessible`, `dark` and `terminal`; no DOM or storage theme values were injected.

The initial narrative-build landing run captured the hero and the SDP-relevance section in all nine width/theme states, plus one scrolled preview at each width: **21 viewport PNGs**. It checked the actual preview image source, declared hypothetical model status, Who/When/Take away copy, proposed pilot, official report link and new-copy horizontal dimensions. All states have zero page errors and document widths no greater than their viewports. The source link targets the official 2025 report at PDF page 93, corresponding to printed page 87. The final caption/form correction received the scoped follow-up below; the complete nine-state matrix was not needlessly repeated after that correction.

The source PNGs were visually inspected. Desktop captures were opened individually. Phone captures were inspected at their original pixel width in four contact sheets; representative phone hero, preview, Evidence and settled Malay bank-guide PNGs were also opened individually. These are ordinary viewport captures of real application pixels, not stitched full-page or nested-scroll element screenshots.

## Judge's first-screen reading

This is a critical reading of the rendered interface, not a user study or an official judge score.

- **Who uses it:** the hero identifies township asset/engineering teams, and Who specifies a township asset team with a reviewing drainage engineer.
- **What decision:** the opening paragraph asks which flood-storage idea deserves a site investigation. It does not present a decision to purchase or build the design.
- **What changes:** the headline and actual flood-twin preview lead with remaining wet area, then the guide directs the user to compute and challenge an assumed option.
- **What leaves the screen:** the take-away is a scoped investigation with assumptions, evidence gaps, proposed reviewer and next action. Evidence repeats that decision explicitly.
- **What SDP is asked for:** the relevance section requests one Bukit Raja study window, an asset-team sponsor and a reviewing engineer. Review time and evidence completeness are proposed pilot measures; benefits are explicitly unvalidated.
- **Why the physical module is separate:** the workflow calls it optional and states it does not cause the storage result. The bank description requests its own suitability tests.

The primary story therefore has a concrete intended user and next decision. It still has no observed customer adoption, measured operator benefit or validated physical flood reduction. Improved copy cannot supply that evidence.

At phone widths, the large hero headline and both actions fit without clipped text. Most of the preview lies below the initial fold; the initial paragraph and pilot note already state the decision and intended team. The pilot ask and company-source link require scrolling to the relevance section. This is a discoverability limit, not a claim that the whole pitch fits above the fold.

## Flood comparison to investigation shortcut

A separate session at each phone width entered the guide, opened Compare the storm and confirmed **Review this flood option** was absent before a completed comparison. One baseline comparison was then computed solely to enable the new route; no twelve-basin or full numerical/export rehearsal was duplicated here.

After the result appeared, focusing the shortcut and pressing **Enter** opened Evidence directly. Both widths displayed the **Site investigation decision** region, **1 of 2 available attachments included**, and a missing bank study. The decision text requested a site investigation before works, distinguished the independent after-case peak from the playback frame or affected homes, requested site evidence, and denied construction approval. The shortcut works without visiting River Lab or creating a bank concept.

The tested baseline naturally has the same before/after result. Its displayed wet-area figure is not presented here as a mitigation outcome. The canonical test separately covers a mitigated comparison, JSON/HTML decision context and the optional bank attachment.

## Malay guide, keyboard and narrow reflow

At **390 and 320px**, the real language control switched the guide to Bahasa Melayu. All four step buttons displayed their revised titles and instructions: investigation question, remaining water, optional bank study and a specific investigation request. The guide's own step strip scrolls horizontally; the outer document and coach text do not overflow.

Keyboard checks focused the actual controls and used **Enter** to activate the flood-option shortcut, collapse guide instructions and expand them again. Switching the language back restored the English final-step instruction. These are targeted keyboard checks, not an exhaustive Tab-order, screen-reader or WCAG audit.

The first Malay step-three screenshots caught the lazy River Lab loading placeholder. Those backgrounds are excluded as evidence of a settled scene. The replacements `judge-bm-guide-390-3-settled.png` and `judge-bm-guide-320-3-settled.png` waited for the actual River Lab canvas, then verified the Malay coach and reflow. Both replacements were opened individually; no page errors or document overflow occurred.

## Visual defect and follow-up

The original mobile preview captures exposed a real contrast problem: the longer white caption began over the pale map near the middle of the image, before the original gradient became sufficiently dark. The desktop lower caption remained readable. The implementation owner shortened the caption to **Water remains. / What should we check?** and gave it a 23px mobile heading on a padded dark backplate.

Fresh targeted captures at **390px Light and 320px High contrast** verify the correction. The measured backplate is `rgba(16, 39, 43, 0.95)`. The heading and scenario note remain inside the figure, readable over both light map areas and darker water, with zero document overflow or page errors. `judge-preview-fixed-390.png` and `judge-preview-fixed-320.png` were opened individually. The pre-fix preview PNGs remain excluded from final appearance acceptance; their dimension assertions remain valid as baseline checks.

## Optional review requests remain optional

The final corrected build also received a focused native form check at the same two widths. A fresh plan selects four core site-evidence requests. Bank material/anchorage/scour/planting tests and supplier/installation quotations start unchecked, and their visible labels specify **if bank works selected** and **if works are in scope**. The route explicitly says **0 of 2 available attachments · bank study optional** in the fresh no-comparison session.

Both form screenshots were opened individually. Labels and tick states are readable, with zero document overflow. Deliberately checking the two optional requests, reloading and returning to the review preserves those authored choices. This is browser-local request persistence, not evidence collected or a review approved. Conditional HTML/JSON validation requirements are covered by the canonical owner, not inferred from this form check.

## Reproducible local evidence

Ignored directory: `app/output/competitive-refresh/`.

- `judge-narrative-qa.py landing` and `judge-landing-results.json`: nine real theme/width states, 21 captures and geometry checks.
- `judge-narrative-qa.py guide` and `judge-guide-results.json`: baseline-gated shortcut, two Evidence captures, eight Malay guide captures and two keyboard/language records.
- `judge-settled-bm-results.json`: the two settled optional-bank guide replacements.
- `judge-targeted-fix-results.json`: corrected caption pixels, fresh four-request defaults, conditional optional labels and authored-choice reload persistence. Its four source PNGs are `judge-preview-fixed-{390,320}.png` and `judge-review-core-defaults-{390,320}.png`.
- `judge-phone-contact-{1,2,3,4}.png`: native-width contact sheets used for visual review; the loading/background and pre-fix preview exclusions above still apply.

Both main harness runs and both targeted follow-ups exited successfully. There were zero recorded JavaScript page errors. The discovered caption contrast issue is closed in the checked production build; no remaining blocking narrative/reflow defect was found within this scope. No application source, server configuration, solver or shared browser state was changed by this QA track; only this report and ignored QA artifacts were written. No submission, external assignment, operational record or approval was created.

## Canonical workflow and review closure

The implementation owner also ran the updated `app/scripts/verify-livingshield.py` against the rebuilt local production server. The 90 mm / 60 minute Bukit Raja comparison passed with zero page errors. The new direct investigation route exported a flood-only brief with `bankConcept: null`, `bankConceptRequired: false` and no mandatory bank-validation tasks in its JSON or HTML. The same run then opened the optional bank study, checked the quantities, prepared the review and verified both complete brief formats, pilot isolation and review persistence after reload.

All 61 regression tests, full ESLint, application/server type checking and the production build pass. The existing lazy River Lab bundle-size warning remains. A targeted code/narrative review found and closed an important inconsistency: bank-only tests had still appeared as unconditional investigation requirements. These now depend on an attached bank concept, fresh review plans request four core site checks, and previously authored optional requests remain valid. The review returned GO after those changes. Numerical algorithms were not modified by the narrative revision.

## Targeted verification of the new public release

The revised deployment was checked at **https://livingshield-malaysia.fly.dev/** on **21 October 2026, 15:29–15:30 MYT**. A fresh isolated browser received HTTP 200 over HTTPS and the new document title, **LivingShield · Before SDP commits, test the flood idea.** Its heading, intended-user/pilot copy and official source link match the narrative revision. The actual saved flood-twin preview loaded from `/livingshield/township-preview.png`.

The desktop check used **1440×1000**. The same fresh session then switched to **390×844** and verified the corrected mobile caption, including its `rgba(16, 39, 43, 0.95)` backplate. Both measured document widths matched their viewport widths. These targeted checks do not claim that the entire local nine-state theme matrix was replayed on the public host.

Using the actual guide language control, all four revised Malay titles rendered and switching back restored English. At the storm step, the direct review shortcut was absent before a completed comparison. After one baseline run, focusing the Malay **Semak pilihan banjir ini** control and pressing Enter opened the investigation brief directly, with **1 of 2 available attachments** and the bank still unattached. The visible Evidence box requested a site investigation before works and explicitly denied construction approval. This was navigation/gating validation; the public canonical test separately covers mitigation numerics and full exports.

The targeted run exited successfully with **nine recorded checks and zero JavaScript page errors**. Its three ordinary viewport PNGs were opened and visually inspected individually: desktop hero, corrected phone caption and Malay direct-review/Evidence state. No new visual or narrative blocker was found in this bounded public check.

Ignored evidence directory: `app/output/competitive-refresh/judge-release/`. Reproduction script: `public-narrative-qa.py`. Results: `public-narrative-qa-results.json`. Inspected captures: `public-narrative-desktop-hero.png`, `public-narrative-mobile-caption.png`, and `public-narrative-mobile-Malay-review.png`. The run spans 07:29:15–07:30:04 UTC. It performed no external submission, assignment or approval.
