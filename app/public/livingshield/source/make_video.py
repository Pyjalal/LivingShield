"""Assemble render/Studio + render/River into LivingShield_demo.mp4 with a crossfade
and lower-third captions. Run: python make_video.py"""
import subprocess, os

FPS = 24
STUDIO_LEN = 150 / FPS
XFADE = 0.75
RIVER_T0 = STUDIO_LEN - XFADE
BOLD = "C\\:/Windows/Fonts/segoeuib.ttf"
REG = "C\\:/Windows/Fonts/segoeui.ttf"

# (start, end, headline, subline, top?) in seconds of the final video
captions = [
    (0.4, 5.6, "LivingShield  |  Triangle Module", "3D-printed nature-based flood defence  -  300 x 300 mm", True),
    (RIVER_T0 + 0.5, RIVER_T0 + 3.1, "Existing condition", "Eroded, unprotected riverbank", False),
    (RIVER_T0 + 3.4, RIVER_T0 + 9.8, "Installation", "Modules set in interlocking courses, working up from the toe", False),
    (RIVER_T0 + 10.0, RIVER_T0 + 12.6, "Establishment", "Native plants root through the triangular pockets", False),
    (RIVER_T0 + 12.8, RIVER_T0 + 15.4, "Result", "Stabilised bank  -  slower flow  -  more habitat", False),
]


def alpha(a, b, f=0.35):
    return (f"if(lt(t,{a}),0,if(lt(t,{a + f}),(t-{a})/{f},"
            f"if(lt(t,{b - f}),1,if(lt(t,{b}),({b}-t)/{f},0))))")


def esc(t):
    return t.replace(":", "\\:").replace("'", "’")


chain = [f"[0:v][1:v]xfade=transition=fade:duration={XFADE}:offset={RIVER_T0:.3f},format=yuv420p[v0]"]
cur = "v0"
for i, (a, b, head, sub, top) in enumerate(captions):
    al = alpha(a, b)
    by = "90" if top else "ih-200"   # studio title sits up top, clear of the dimension callouts
    ty = "h-188" if not top else "102"
    sy = "h-122" if not top else "168"
    bw = "iw*0.45" if top else "iw*0.62"
    nxt = f"v{i + 1}"
    chain.append(
        f"[{cur}]"
        f"drawbox=x=0:y={by}:w={bw}:h=130:color=0x0b3d2e@0.78:t=fill:enable='between(t,{a},{b})',"
        f"drawbox=x=0:y={by}:w=10:h=130:color=0x5cc28a@1:t=fill:enable='between(t,{a},{b})',"
        f"drawtext=fontfile='{BOLD}':text='{esc(head)}':fontcolor=white:fontsize=48:x=48:y={ty}:alpha='{al}',"
        f"drawtext=fontfile='{REG}':text='{esc(sub)}':fontcolor=0xd8efe2:fontsize=32:x=48:y={sy}:alpha='{al}'"
        f"[{nxt}]")
    cur = nxt
# small corner bug throughout
chain.append(f"[{cur}]drawtext=fontfile='{BOLD}':text='LivingShield':fontcolor=white@0.85:fontsize=30:"
             f"x=w-tw-40:y=34:shadowcolor=black@0.4:shadowx=2:shadowy=2[out]")
with open("captions.ffgraph", "w", encoding="utf-8") as f:
    f.write(";\n".join(chain))

cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
       "-framerate", str(FPS), "-i", "render/Studio/%04d.png",
       "-framerate", str(FPS), "-i", "render/River/%04d.png",
       "-filter_complex_script", "captions.ffgraph", "-map", "[out]",
       "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
       "LivingShield_demo.mp4"]
subprocess.run(cmd, check=True)
print("wrote", os.path.abspath("LivingShield_demo.mp4"))
