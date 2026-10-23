# LivingShield physical design integration

Integrated 21 October 2026 from the user-provided `C:/Users/Shahjalal/Documents/LivingShield` folder. Original source files were preserved. The supplied folder is a Blender/Python design package, not a separate application; it contains no README, package manifest or explicit licence file. Local use was requested by the project owner. No additional third-party ownership or redistribution rights are asserted here.

## Copied source assets

| Served path under `app/public/livingshield/` | Original file | SHA-256 |
| --- | --- | --- |
| `module_triangle.glb` | `module_triangle.glb` | `5a99713a5468d5f39ad2c6cc20e5d4441910922ef15e184037f19bd45580f2bf` |
| `module_triangle.stl` | `module_triangle.stl` | `3be3c348ef201910031f6ad3201f7bf2caa729211fcc36ddac78a5aeb8066b49` |
| `LivingShield_demo.mp4` | `LivingShield_demo.mp4` | `b1295725f06085d4dac5e00349097ecb7b036c52d7feee703d51a209f1513834` |
| `bank-established.png` | `stills/River_0330.png` | `6e53f80d594e09c77f67b641de98cbbe60439b0fb4fe5e3a8154c46e9e58244f` |
| `bank-before.png` | `stills/River_0001.png` | `69b31debc67c1bcf34ef77c96ddb40dfd6a0f2715188089df336135523e5a36f` |
| `module-studio.png` | `stills/Studio_0045.png` | `84db3f07ce692678329c3268f5e55d1064f193bccc9d27226f770d961168cfc8` |

The source generator `livingshield.py` hashes to `e4a0677482fc8fd45591e2bdfc1e1eb47e7f10fffd0110169289ecd84e650702`. It generates procedural geometry/materials and the Studio and River animation scenes. The seven original editable files are now packaged unchanged under `app/public/livingshield/source/`: `livingshield.py`, `make_video.py`, `render_all.sh`, `still.sh`, `captions.ffgraph`, `livingshield_scene.blend` and `module_triangle.blend`. The accompanying README explains source dependencies and separate working-copy regeneration. River Lab links to the editable scene and source notes; every file has size and SHA-256 provenance in `source.json`. Original, packaged, HTTP-served and manifest hashes all agree. The original folder remains untouched, and generated frame caches are excluded. The browser uses compact exports and selected stills; it does not execute Blender. The film loads only on user playback (`preload="none"`), with an added English WebVTT caption track.

## Geometry and quantity interpretation

The GLB is glTF 2.0, 610,364 bytes, with one mesh, 16,923 vertices and 33,886 triangles. It contains no embedded material or textures; the detailed viewer assigns a neutral concrete-like material. glTF uses metres and Y-up; the source STL export multiplies coordinates by 1,000 for millimetre slicer units. Nominal design base edge and height are 300 mm. Actual GLB axis-aligned bounds are approximately 309.865 × 308.991 × 278.267 mm because the rounded geometry extends around the nominal construction points.

Independent topology bookkeeping at a 1 µm coordinate tolerance found zero boundary edges, non-manifold edges or degenerate triangles. The signed closed-mesh volume was about 0.003204 m³. These checks do not establish printability, material strength, structural performance, watertight flood defence or construction suitability. The app intentionally does not infer mass, strength, hydraulic storage or avoided damage from this volume.

The bank planner assumes a straight, uniform slope and nominal equilateral triangular tiling:

1. Sloped bank length = vertical height ÷ sin(slope).
2. Row height = 0.30 × √3 ÷ 2 m.
3. Rows = ceil(sloped length ÷ row height); columns = ceil(bank length ÷ 0.30).
4. Installed modules = rows × columns × 2 − floor(rows ÷ 2).
5. Spare allowance rounds upward; optional user-supplied unit rates apply to total ordered modules only.

This is whole-course concept packing, not a shop drawing, surveyed footprint or impermeable coverage calculation. Unquoted cost stays unknown. Labour, fabrication, anchors, planting, transport, tax, site preparation and maintenance are excluded from the module subtotal. The bank overview uses simplified instanced truss geometry to avoid drawing millions of high-detail triangles; the detailed inspection view uses the actual supplied GLB.

## Evidence limits

The original video captions describe stabilisation, slower flow and habitat benefits. The source water animation uses Blender's Ocean modifier and animated shader noise; it does not compute hydraulics or establish those benefits. The app identifies them as intentions requiring testing and does not credit LivingShield with invented flood-depth reduction or basin-like water capture. Vegetation and growth are illustrative and do not identify a validated Malaysian native-species planting scheme.

Township selection provides context only. A township anchor does not establish a bank alignment, local slope, ownership, material suitability or approval. A real pilot needs a bank/water-level survey, geotechnical and scour assessment, material/connector testing, hydraulic and debris-blockage modelling, ecological review, constructability assessment and the required authority approvals.

## Native app verification — 21 October 2026

Targeted ESLint and TypeScript checks passed. Four pure quantity tests cover packing/slot conservation, unknown versus quoted costs, larger and shallower banks, and invalid/non-finite inputs.

Playwright browser checks on the integrated app at port 5180 covered 1440 × 1000 desktop and 390 × 844 mobile, light and dark themes, actual GLB inspection, all three bank stages, pilot selection, editable geometry/rates, JSON download, film playback and return navigation through the evidence brief. The module renderer reported 33,966 triangles including its 80-triangle display plinth. The default installed stage rendered 261 simplified modules and 37,608 triangles; the planted stage rendered 40,218 triangles. Existing-bank mode rendered zero modules. Stage and theme changes retained identical camera coordinates. Camera fitting now accommodates the actual perspective bounds and viewport changes.

An Elmina scenario at 9.9 m length, 0.8 m height, 32° slope and 10% spares produced 393 installed + 40 spare = 433 ordered modules. A user-entered RM 12.50 rate produced RM 5,412.50; clearing it restored “Quote required”. The JSON and the evidence brief agreed, and all inputs survived return navigation. The original 21-second film played with captions and no media error. Final fresh browser session recorded no JavaScript errors or warnings. Mobile content had no horizontal overflow.

Local QA artifacts are under `app/output/playwright/riverlab-*`: module and bank screenshots in both themes, mobile stage/film screenshots, and the exported `riverlab-concept.json`. Screenshots were visually inspected; the images are supporting QA output, not source asset replacements or hydraulic validation.

The global header PNG export was also downloaded and visually inspected as `riverlab-global-export.png`; it contains the rendered source module. The River Lab keeps its WebGL drawing buffer available for that capture.
