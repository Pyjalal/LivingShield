# Map theme and responsive QA

Checked 20 October 2026 against the Vite app at `http://127.0.0.1:5180/?review=theme-maps` in an independent Chromium session. The session was closed after testing. Screenshots were opened and visually inspected, including settled real map tiles and the loaded 3D engine.

## Basemap checks

- A fresh session opened Property Lookup with Light selected, no first-visit overlay, and the compact selector closed.
- Property Lookup and Site Analysis both switched through Dark → Light → Street → Satellite. Their actual map container changed its theme locally. Dark street tiles computed `invert(1) hue-rotate(180deg) brightness(0.78) contrast(0.95)`; Light, Street and Satellite tiles computed `filter: none`. Real tiles loaded in each case.
- Selecting a style closed the selector. Escape closed an expanded selector. Style buttons expose their selected state; the toggle announces the current style and expansion state.
- Drainage & Water and River Flow used native, unfiltered OpenStreetMap tiles (`filter: none`). River Flow finished its station fly-to with six loaded 256-pixel tiles around the selected gauge.
- Tile transitions were allowed to finish (`complete`, nonzero natural image width and computed opacity 1) before final basemap screenshots. Early transient captures were replaced.

## Responsive checks

- At **390 × 844**, horizontal navigation scrolled to Property Lookup and Site Analysis, with main pages and submenus reachable. The engineering and flood submenu items were inside the viewport and passed `elementFromPoint` hit tests. Fixed-position menus were not clipped by the horizontally scrolling navigation.
- Mobile document width remained **390 px** on 3D Townships, National Maps, Drainage & Water, Property Lookup, Storm Simulation, Cost Analysis and River Flow. Forms, map zoom buttons and basemap controls remained visible in the stacked layout. Sidebar content scrolls separately where longer than the mobile sidebar window.
- At **900 × 900**, all six main pages were navigated successfully; document width remained **900 px** for each. The engineering submenu passed the same hit test and remained visible below the navigation.
- The 3D mobile capture was taken after the TamanKu loading message disappeared. The township, real terrain and source credits rendered within the viewport.
- Browser console: **0 errors, 0 warnings** in this QA session.

## Evidence

All files are in `app/output/playwright/`:

- `theme-map-property-{dark,light,street,satellite}.png`
- `theme-map-engineering-{dark,light,street,satellite}.png`
- `theme-map-mobile-{townships,national,drainage,property,storm,river}.png`
- `theme-map-mobile-{flood-menu,engineering-menu}.png`
- `theme-map-tablet-{engineering,dropdown}.png`

No source observations were replaced with fabricated values. This pass verifies theme behavior, rendered map imagery and responsive navigation, not the accuracy of remote hydrology measurements.
