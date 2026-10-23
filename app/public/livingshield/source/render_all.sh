#!/bin/bash
B="/c/Program Files/Blender Foundation/Blender 5.1/blender.exe"
for sc in Studio River; do
  "$B" -b livingshield_scene.blend -S $sc -o "//render/$sc/####" -F PNG -x 1 -a 2>&1 | grep -E "Time:|Error" | sed "s/^/$sc /"
done
echo ALL_RENDERS_DONE
