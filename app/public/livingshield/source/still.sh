#!/bin/bash
# usage: still.sh Scene pct frame...
B="/c/Program Files/Blender Foundation/Blender 5.1/blender.exe"
sc=$1; pct=$2; shift 2
args=(); for f in "$@"; do args+=(-f "$f"); done
"$B" -b livingshield_scene.blend -S "$sc" --python-expr "import bpy;bpy.context.scene.render.resolution_percentage=$pct" -o "//stills/${sc}_####" -F PNG "${args[@]}" 2>&1 | grep -E "Saved|Error"
