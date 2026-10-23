# LivingShield editable design sources

These files are unchanged copies from the project owner's supplied LivingShield folder. The source manifest lists byte sizes and SHA-256 hashes. The web app does not execute these scripts.

- `livingshield_scene.blend`: supplied animated Studio and River scenes.
- `module_triangle.blend`: supplied editable module project.
- `livingshield.py`: procedural Blender generator, including materials, geometry and animation.
- `make_video.py`, `captions.ffgraph`: original film assembly and caption definitions.
- `render_all.sh`, `still.sh`: original Git Bash helpers, configured for a local Blender 5.1 Windows installation.

Open the `.blend` projects in Blender to inspect the original cameras, objects, materials and animation. The detailed GLB viewer uses the supplied module; the interactive bank planner uses a lighter geometric representation of its nominal packing. The source scene is an illustrative riverbank, not a surveyed location in any selected township.

To regenerate in a separate working copy with a compatible Blender installation, run `blender -b -P livingshield.py` from that copy. The script writes module exports and `livingshield_scene.blend` beside itself, replacing existing outputs there. The supplied render helpers render the saved scene. Film assembly additionally requires FFmpeg and the configured Windows fonts. Regeneration and final manufacturing suitability have not been certified by the web integration.

The original script and film contain intended-benefit wording, including printability, stabilisation, slower flow and habitat. Those source statements are not demonstrated engineering results. The bank design needs material, connector, geotechnical, scour, hydraulic and ecological validation. Its Ocean animation is a visual effect. The module receives no assumed flood-reduction or storage credit in the township solver.

The original local folder retains generated animation frames, alternative stills and render logs. Those caches are not needed to inspect or use the integrated module, interactive layout or film. Original files were not modified. No separate licence file was supplied; authorship and programme Background IP disclosures remain with the project team.
