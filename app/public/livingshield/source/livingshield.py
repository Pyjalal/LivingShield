"""LivingShield - 3D-printed triangle flood-defence modules, engineering demo animation.

Run:  blender -b -P livingshield.py -- [--still SCENE FRAME ...] [--preview] [--render SCENE]
  SCENE is "Studio" (module intro) or "River" (installation).
Outputs (next to this script):
  module_triangle.blend / .stl / .glb   single 300 mm module (watertight, printable)
  livingshield_scene.blend              both animated scenes
  render/<scene>/####.png               animation frames
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Matrix, noise

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
random.seed(11)

FPS = 24
S = 0.30                      # module base edge (m)
H_MOD = 0.30                  # module height (m)
TRI_H = S * math.sqrt(3) / 2
SLOPE = math.radians(32)
WATER_Z = 0.0
BED_Z = -0.6
Y_TOE = -0.4
TOP_Z = 1.25
Y_TOP = Y_TOE + (TOP_Z - BED_Z) / math.tan(SLOPE)
FAR_TOE, FAR_TOP = -4.2, -6.4
INSTALL_HALF = 3.4            # installation spans |x| < this
STUDIO_END = 150
RIVER_END = 372


# ============================================================ generic helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def link(obj, coll):
    coll.objects.link(obj)
    return obj

def new_coll(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c

def nodes_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]

def sock(node, name, out=False):
    """Socket by name, skipping disabled duplicates (Random Value, Compare, Mix...)."""
    socks = node.outputs if out else node.inputs
    for s in socks:
        if s.name == name and getattr(s, "enabled", True):
            return s
    raise KeyError(name)

def set_interp(kind):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = kind

def obj_from_bm(bm, name, coll, mats=()):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    return link(bpy.data.objects.new(name, me), coll)

def apply_all(obj):
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        for md in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=md.name)

def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


# ============================================================ materials
def concrete_material():
    m, nt, b = nodes_mat("PrintedComposite")
    b.inputs["Roughness"].default_value = 0.78
    coord = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 60; n1.inputs["Detail"].default_value = 10
    n2 = nt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 6; n2.inputs["Detail"].default_value = 4
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.40, 0.40, 0.385, 1)
    ramp.color_ramp.elements[1].color = (0.63, 0.625, 0.60, 1)
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "FLOAT"; mix.inputs[0].default_value = 0.5
    nt.links.new(coord.outputs["Object"], n1.inputs["Vector"])
    nt.links.new(coord.outputs["Object"], n2.inputs["Vector"])
    nt.links.new(n1.outputs["Fac"], sock(mix, "A"))
    nt.links.new(n2.outputs["Fac"], sock(mix, "B"))
    nt.links.new(sock(mix, "Result", True), ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    # printed layer lines along the print axis (local Z)
    wave = nt.nodes.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "Z"
    wave.inputs["Scale"].default_value = 220; wave.inputs["Distortion"].default_value = 0.4
    nt.links.new(coord.outputs["Object"], wave.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = 0.35
    nt.links.new(n1.outputs["Fac"], add.inputs[0]); nt.links.new(wave.outputs["Fac"], add.inputs[2])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.7
    bump.inputs["Distance"].default_value = 0.002
    nt.links.new(add.outputs["Value"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m

def leaf_material(name, c1, c2):
    m, nt, b = nodes_mat(name)
    info = nt.nodes.new("ShaderNodeObjectInfo")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*c1, 1)
    ramp.color_ramp.elements[1].color = (*c2, 1)
    # colour variation: per-object random + world-space noise (scatters are realized into one mesh)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    wn = nt.nodes.new("ShaderNodeTexNoise"); wn.inputs["Scale"].default_value = 1.7; wn.inputs["Detail"].default_value = 3
    nt.links.new(geo.outputs["Position"], wn.inputs["Vector"])
    vmix = nt.nodes.new("ShaderNodeMath"); vmix.operation = "MULTIPLY_ADD"; vmix.inputs[1].default_value = 0.45
    nt.links.new(info.outputs["Random"], vmix.inputs[0])
    sub = nt.nodes.new("ShaderNodeMapRange"); sub.inputs["From Min"].default_value = 0.3; sub.inputs["From Max"].default_value = 0.7
    nt.links.new(wn.outputs["Fac"], sub.inputs["Value"])
    nt.links.new(sub.outputs["Result"], vmix.inputs[2])
    nt.links.new(vmix.outputs["Value"], ramp.inputs["Fac"])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    oc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(oc.outputs["Object"], sep.inputs["Vector"])
    grad = nt.nodes.new("ShaderNodeMapRange"); grad.inputs["From Max"].default_value = 0.25
    grad.inputs["To Min"].default_value = 0.45
    nt.links.new(sep.outputs["Z"], grad.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"
    mul.inputs[0].default_value = 1.0
    nt.links.new(ramp.outputs["Color"], sock(mul, "A"))
    nt.links.new(grad.outputs["Result"], sock(mul, "B"))
    nt.links.new(sock(mul, "Result", True), b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.45
    tr = nt.nodes.new("ShaderNodeBsdfTranslucent")
    nt.links.new(sock(mul, "Result", True), tr.inputs["Color"])
    mixs = nt.nodes.new("ShaderNodeMixShader"); mixs.inputs[0].default_value = 0.25
    out = nt.nodes["Material Output"]
    nt.links.new(b.outputs[0], mixs.inputs[1]); nt.links.new(tr.outputs[0], mixs.inputs[2])
    nt.links.new(mixs.outputs[0], out.inputs["Surface"])
    m.use_backface_culling = False
    return m

def flat_material(name, color, rough=0.5, emit=0.0):
    m, nt, b = nodes_mat(name)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m

def terrain_material():
    """Grass on flats, eroded soil on slopes, wet dark band at the waterline, gravel bed."""
    m, nt, b = nodes_mat("Terrain")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    nsep = nt.nodes.new("ShaderNodeSeparateXYZ"); psep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], nsep.inputs["Vector"])
    nt.links.new(geo.outputs["Position"], psep.inputs["Vector"])

    def noise_ramp(scale, ca, cb, detail=8):
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        nt.links.new(coord.outputs["Object"], n.inputs["Vector"])
        r = nt.nodes.new("ShaderNodeValToRGB")
        r.color_ramp.elements[0].color = (*ca, 1); r.color_ramp.elements[1].color = (*cb, 1)
        nt.links.new(n.outputs["Fac"], r.inputs["Fac"])
        return r.outputs["Color"], n.outputs["Fac"]

    grass_c, grass_n = noise_ramp(2.2, (0.07, 0.15, 0.035), (0.17, 0.27, 0.07))
    soil_c, soil_n = noise_ramp(7.0, (0.20, 0.14, 0.09), (0.42, 0.32, 0.22), 12)
    bed_c, bed_n = noise_ramp(40.0, (0.10, 0.09, 0.08), (0.32, 0.29, 0.25), 4)

    def mix_rgb(fac, a, c):
        mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
        nt.links.new(fac, mx.inputs[0]); nt.links.new(a, sock(mx, "A")); nt.links.new(c, sock(mx, "B"))
        return sock(mx, "Result", True)

    def ramp_from(src, p0, p1, c0=0.0, c1=1.0):
        r = nt.nodes.new("ShaderNodeMapRange")
        r.inputs["From Min"].default_value = p0; r.inputs["From Max"].default_value = p1
        r.inputs["To Min"].default_value = c0; r.inputs["To Max"].default_value = c1
        nt.links.new(src, r.inputs["Value"])
        return r.outputs["Result"]

    flat = ramp_from(nsep.outputs["Z"], 0.86, 0.95)               # 1 = flat -> grass
    col = mix_rgb(flat, soil_c, grass_c)
    bed = ramp_from(psep.outputs["Z"], -0.25, -0.4)               # 1 = deep -> gravel bed
    col = mix_rgb(bed, col, bed_c)
    wet = ramp_from(psep.outputs["Z"], 0.25, -0.05, 0.0, 0.55)    # darken near/below waterline
    dark = nt.nodes.new("ShaderNodeMix"); dark.data_type = "RGBA"; dark.blend_type = "MULTIPLY"
    nt.links.new(wet, dark.inputs[0]); nt.links.new(col, sock(dark, "A"))
    sock(dark, "B").default_value = (0.35, 0.33, 0.3, 1)
    nt.links.new(sock(dark, "Result", True), b.inputs["Base Color"])
    rough = ramp_from(psep.outputs["Z"], 0.2, -0.05, 0.95, 0.45)
    nt.links.new(rough, b.inputs["Roughness"])
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6
    bump.inputs["Distance"].default_value = 0.02
    hsum = nt.nodes.new("ShaderNodeMath"); hsum.operation = "ADD"
    nt.links.new(soil_n, hsum.inputs[0]); nt.links.new(bed_n, hsum.inputs[1])
    nt.links.new(hsum.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


# ============================================================ the module
def add_box(bm, center, size, rot=None):
    ret = bmesh.ops.create_cube(bm, size=1.0)
    mtx = Matrix.Translation(center) @ (rot.to_4x4() if rot else Matrix()) @ Matrix.Diagonal((*size, 1.0))
    bmesh.ops.transform(bm, matrix=mtx, verts=ret["verts"])

def add_cyl(bm, center, radius, depth, rot=None, segs=24):
    ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=radius, radius2=radius, depth=depth)
    mtx = Matrix.Translation(center) @ (rot.to_4x4() if rot else Matrix())
    bmesh.ops.transform(bm, matrix=mtx, verts=ret["verts"])

def face_panel(bm, A, B, C, rim, thick):
    """Flat triangular panel on face ABC (outward normal by winding) with a large
    triangular window: a uniform-width rim, extruded `thick` inward."""
    a, b, c = (B - C).length, (C - A).length, (A - B).length
    inc = (A * a + B * b + C * c) / (a + b + c)
    area = (B - A).cross(C - A).length / 2
    r_in = 2 * area / (a + b + c)
    nrm = (B - A).cross(C - A).normalized()
    outer = [A, B, C]
    inner = [inc + (v - inc) * (r_in - rim) / r_in for v in outer]
    off = -nrm * thick
    o1 = [bm.verts.new(v) for v in outer]; i1 = [bm.verts.new(v) for v in inner]
    o2 = [bm.verts.new(v + off) for v in outer]; i2 = [bm.verts.new(v + off) for v in inner]
    for k in range(3):
        n = (k + 1) % 3
        bm.faces.new((o1[k], o1[n], i1[n], i1[k]))      # outer face of the rim
        bm.faces.new((o2[n], o2[k], i2[k], i2[n]))      # inner face of the rim
        bm.faces.new((o1[n], o1[k], o2[k], o2[n]))      # outside edge wall
        bm.faces.new((i1[k], i1[n], i2[n], i2[k]))      # window wall
    return nrm

def build_module(coll):
    """Matches the reference: a 300 x 300 mm tetrahedron whose four faces are thick
    flat printed panels, each with a large triangular window (plant pockets / flow
    roughness), solid rounded corners with dowel holes for interlocking, and a
    truncated top with a square socket. Fused into one watertight printable solid."""
    A = Vector((-S / 2, -TRI_H / 3, 0)); B = Vector((S / 2, -TRI_H / 3, 0)); C = Vector((0, 2 * TRI_H / 3, 0))
    D = Vector((0, 0, H_MOD))
    RIM, THICK = 0.054, 0.034
    bm = bmesh.new()
    for f in ((A, C, B), (A, B, D), (B, C, D), (C, A, D)):   # base + 3 sides, outward winding
        face_panel(bm, *f, RIM, THICK)
    # solid corner blocks (thickened corners seen on the reference)
    cen = (A + B + C + D) / 4
    for v in (A, B, C):
        add_box(bm, v + (cen - v).normalized() * 0.045 + Vector((0, 0, 0.0)), (0.06, 0.06, 0.05),
                Matrix.Rotation(math.atan2(v.y, v.x), 3, "Z"))
    # truncated top: square collar
    top = Vector((0, 0, H_MOD - 0.03))
    add_box(bm, top, (0.064, 0.064, 0.06))
    blob = obj_from_bm(bm, "LS_Module", coll)

    cut = bmesh.new()
    add_box(cut, Vector((0, 0, H_MOD + 0.05)), (0.5, 0.5, 0.1))          # flat-top the apex
    add_box(cut, Vector((0, 0, H_MOD - 0.02)), (0.032, 0.032, 0.08))     # square socket
    for v in (A, B, C):   # dowel holes through each corner, pointing outward
        ang = math.atan2(v.y, v.x)
        add_cyl(cut, v + (cen - v).normalized() * 0.04, 0.0105, 0.14,
                Matrix.Rotation(ang, 3, "Z") @ Matrix.Rotation(math.pi / 2, 3, "Y"), 20)
        add_cyl(cut, v + (cen - v).normalized() * 0.04, 0.009, 0.2, None, 16)   # vertical pin hole
    add_cyl(cut, top, 0.011, 0.2, Matrix.Rotation(math.pi / 2, 3, "X"), 20)  # cross hole through collar
    cutter = obj_from_bm(cut, "Cutter", coll)

    r = blob.modifiers.new("Fuse", "REMESH"); r.mode = "VOXEL"; r.voxel_size = 0.0025
    sm = blob.modifiers.new("Round", "SMOOTH"); sm.factor = 0.5; sm.iterations = 3
    bo = blob.modifiers.new("Holes", "BOOLEAN"); bo.object = cutter; bo.operation = "DIFFERENCE"
    bo.solver = "EXACT"; bo.use_self = True
    dc = blob.modifiers.new("Decimate", "DECIMATE"); dc.ratio = 0.3
    apply_all(blob)
    bpy.data.objects.remove(cutter)
    smooth(blob)
    blob.data.materials.append(concrete_material())
    return blob

def export_module(obj):
    # exporters read the real selection state, so select the module explicitly
    for o in bpy.context.scene.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    with bpy.context.temp_override(selected_objects=[obj], active_object=obj, object=obj):
        try:
            bpy.ops.wm.stl_export(filepath=os.path.join(HERE, "module_triangle.stl"), export_selected_objects=True,
                                  global_scale=1000.0)  # millimetres for slicers
        except Exception as e:
            print("STL export skipped:", e)
        try:
            bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, "module_triangle.glb"), use_selection=True)
        except Exception as e:
            print("GLB export skipped:", e)
    bpy.data.libraries.write(os.path.join(HERE, "module_triangle.blend"), {obj}, fake_user=True)


# ============================================================ vegetation assets
def leaf_blade(bm, length, width, bend, ang, tilt, origin=Vector(), segs=7):
    cols = [[], [], []]
    for i in range(segs + 1):
        t = i / segs
        w = width * math.sin(math.pi * (0.12 + 0.88 * t)) if i < segs else 0.0
        y = bend * length * t * t
        z = length * t * (1 - 0.35 * bend * t)
        crease = w * 0.22
        cols[0].append(Vector((-w / 2, y + crease, z)))
        cols[1].append(Vector((0, y, z + 0.002)))
        cols[2].append(Vector((w / 2, y + crease, z)))
    mtx = Matrix.Translation(origin) @ Matrix.Rotation(ang, 4, "Z") @ Matrix.Rotation(tilt, 4, "X")
    vs = [[bm.verts.new(mtx @ p) for p in c] for c in cols]
    for i in range(segs):
        for c in range(2):
            a, b = vs[c], vs[c + 1]
            if i == segs - 1:
                bm.faces.new((a[i], b[i], b[i + 1]))  # tip collapses to a point
            else:
                bm.faces.new((a[i], b[i], b[i + 1], a[i + 1]))

def plant_mesh(kind, mats):
    bm = bmesh.new()
    nleaf = None
    if kind == "sedge":
        for i in range(30):
            leaf_blade(bm, random.uniform(0.22, 0.42), random.uniform(0.008, 0.013), random.uniform(0.3, 0.9),
                       random.uniform(0, math.tau), random.uniform(0.05, 0.55))
    elif kind == "lomandra":
        for i in range(18):
            leaf_blade(bm, random.uniform(0.3, 0.5), random.uniform(0.018, 0.026), random.uniform(0.5, 1.1),
                       random.uniform(0, math.tau), random.uniform(0.15, 0.7))
    elif kind == "broadleaf":
        for i in range(11):
            leaf_blade(bm, random.uniform(0.16, 0.26), random.uniform(0.06, 0.085), random.uniform(0.6, 1.0),
                       i / 11 * math.tau + random.uniform(-0.2, 0.2), random.uniform(0.4, 0.9), segs=8)
    elif kind in ("flower_y", "flower_p"):
        for i in range(20):
            leaf_blade(bm, random.uniform(0.18, 0.3), random.uniform(0.008, 0.012), random.uniform(0.4, 0.9),
                       random.uniform(0, math.tau), random.uniform(0.1, 0.6))
        nleaf = len(bm.faces)
        for i in range(6):
            a = random.uniform(0, math.tau); h = random.uniform(0.32, 0.46); rr = random.uniform(0.02, 0.07)
            tip = Vector((rr * math.cos(a), rr * math.sin(a), h))
            add_cyl(bm, tip / 2, 0.0025, tip.length, tip.to_track_quat("Z", "Y").to_matrix(), 6)
            ret = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.016 if kind == "flower_y" else 0.012)
            bmesh.ops.transform(bm, matrix=Matrix.Translation(tip) @ Matrix.Diagonal((1, 1, 1.6 if kind == "flower_p" else 0.8, 1)),
                                verts=ret["verts"])
    me = bpy.data.meshes.new(f"Plant_{kind}")
    bm.to_mesh(me); bm.free()
    me.materials.append(mats["leaf"] if kind != "lomandra" else mats["leaf2"])
    if nleaf is not None:
        me.materials.append(mats["stem"]); me.materials.append(mats[kind])
        for p in list(me.polygons)[nleaf:]:
            p.material_index = 2 if p.loop_total == 3 else 1
    smooth_mesh(me)
    return me

def smooth_mesh(me):
    for p in me.polygons:
        p.use_smooth = True

def grass_clump(mat):
    bm = bmesh.new()
    for i in range(16):
        r = random.uniform(0, 0.05); a = random.uniform(0, math.tau)
        leaf_blade(bm, random.uniform(0.07, 0.17), random.uniform(0.004, 0.007), random.uniform(0.2, 0.8),
                   random.uniform(0, math.tau), random.uniform(0.0, 0.5),
                   origin=Vector((r * math.cos(a), r * math.sin(a), 0)), segs=4)
    me = bpy.data.meshes.new("GrassClump"); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    smooth_mesh(me)
    return me

def rock_mesh(seed, mat):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
    off = Vector((seed * 3.1, seed * 1.7, seed * 0.9))
    for v in bm.verts:
        v.co *= 1 + noise.fractal(v.co * 1.4 + off, 0.6, 2.0, 4) * 0.22
    bmesh.ops.scale(bm, vec=(1.0, random.uniform(0.7, 0.9), random.uniform(0.45, 0.65)), verts=bm.verts)
    me = bpy.data.meshes.new(f"Rock{seed}"); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    smooth_mesh(me)
    return me

def leaf_cards(mat):
    c = bpy.data.collections.new("LeafCards")
    for k in range(2):
        bm = bmesh.new()
        w, l = 0.045 + 0.01 * k, 0.075
        vs = [bm.verts.new(p) for p in ((0, 0, 0), (w / 2, 0.01, l * 0.45), (0, 0, l), (-w / 2, 0.01, l * 0.45))]
        bm.faces.new(vs)
        me = bpy.data.meshes.new(f"Leaf{k}"); bm.to_mesh(me); bm.free()
        me.materials.append(mat)
        c.objects.link(bpy.data.objects.new(f"Leaf{k}", me))
    return c

def tree_template(idx, height, mats, leaves):
    """A tree as its own collection: tapered trunk + limbs, a dark noisy crown
    volume, and thousands of instanced leaf cards over its surface."""
    coll = bpy.data.collections.new(f"TreeTpl{idx}")
    bm = bmesh.new()
    ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=0.17, radius2=0.07, depth=height)
    bmesh.ops.translate(bm, vec=(0, 0, height / 2), verts=ret["verts"])
    for i in range(5):
        a = i / 5 * math.tau + random.uniform(-0.4, 0.4)
        d = Vector((math.cos(a) * 0.9, math.sin(a) * 0.9, 1.3)).normalized()
        L = height * random.uniform(0.3, 0.42)
        ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.06, radius2=0.02, depth=L)
        bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector((0, 0, height * random.uniform(0.6, 0.8))) + d * L / 2)
                            @ d.to_track_quat("Z", "Y").to_matrix().to_4x4(), verts=ret["verts"])
    obj_from_bm(bm, f"Trunk{idx}", coll, [mats["bark"]])
    bm = bmesh.new()
    crown_c = Vector((0, 0, height * 1.0))
    spread = random.uniform(0.9, 1.25)
    for i in range(48):
        p = crown_c + Vector((random.gauss(0, 0.8 * spread), random.gauss(0, 0.8 * spread), random.gauss(0, 0.55)))
        ret = bmesh.ops.create_icosphere(bm, subdivisions=3, radius=random.uniform(0.28, 0.48))
        off = Vector((random.random() * 50, random.random() * 50, 0))
        for v in ret["verts"]:
            v.co = p + v.co * (1 + 0.45 * noise.fractal(v.co * 4 + off, 0.6, 2, 3))
    can = obj_from_bm(bm, f"Crown{idx}", coll, [mats["crown"]])
    smooth_mesh(can.data)
    scatter(can, f"Leaves{idx}", leaves, 420.0, -100, 100, -2.0, (0.7, 1.3), seed=idx, tilt=math.pi)
    return coll

def place_tree(coll, tpl, loc, scale, rot):
    e = bpy.data.objects.new(f"Tree_{tpl.name}", None)
    e.instance_type = "COLLECTION"; e.instance_collection = tpl
    e.location = loc; e.scale = (scale,) * 3; e.rotation_euler.z = rot
    coll.objects.link(e)


# ============================================================ geometry-node scattering
def scatter(obj, name, inst_coll, density, zmin, zmax, nz_min, scale=(0.7, 1.3), seed=0, exclude_x=None,
            box=None, tilt=0.08, realize=True):
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N = ng.nodes; L = ng.links
    gi = N.new("NodeGroupInput"); go = N.new("NodeGroupOutput")
    pos = N.new("GeometryNodeInputPosition"); nrm = N.new("GeometryNodeInputNormal")
    ps = N.new("ShaderNodeSeparateXYZ"); ns = N.new("ShaderNodeSeparateXYZ")
    L.new(pos.outputs[0], ps.inputs[0]); L.new(nrm.outputs[0], ns.inputs[0])

    def cmp(src, op, val):
        c = N.new("FunctionNodeCompare"); c.data_type = "FLOAT"; c.operation = op
        L.new(src, sock(c, "A")); sock(c, "B").default_value = val
        return c.outputs[0]

    def band(a, b):
        x = N.new("FunctionNodeBooleanMath"); x.operation = "AND"
        L.new(a, x.inputs[0]); L.new(b, x.inputs[1])
        return x.outputs[0]

    sel = band(band(cmp(ps.outputs["Z"], "GREATER_THAN", zmin), cmp(ps.outputs["Z"], "LESS_THAN", zmax)),
               cmp(ns.outputs["Z"], "GREATER_THAN", nz_min))
    if exclude_x is not None:
        ab = N.new("ShaderNodeMath"); ab.operation = "ABSOLUTE"; L.new(ps.outputs["X"], ab.inputs[0])
        sel = band(sel, cmp(ab.outputs[0], "GREATER_THAN", exclude_x))
    if box is not None:
        sel = band(sel, band(band(cmp(ps.outputs["X"], "GREATER_THAN", box[0]), cmp(ps.outputs["X"], "LESS_THAN", box[1])),
                             band(cmp(ps.outputs["Y"], "GREATER_THAN", box[2]), cmp(ps.outputs["Y"], "LESS_THAN", box[3]))))
    dist = N.new("GeometryNodeDistributePointsOnFaces")
    dist.inputs["Density"].default_value = density; dist.inputs["Seed"].default_value = seed
    L.new(gi.outputs[0], dist.inputs["Mesh"]); L.new(sel, dist.inputs["Selection"])
    ci = N.new("GeometryNodeCollectionInfo"); ci.inputs["Collection"].default_value = inst_coll
    ci.inputs["Separate Children"].default_value = True; ci.inputs["Reset Children"].default_value = True
    iop = N.new("GeometryNodeInstanceOnPoints"); iop.inputs["Pick Instance"].default_value = True
    rv = N.new("FunctionNodeRandomValue"); rv.data_type = "FLOAT_VECTOR"
    sock(rv, "Min").default_value = (-tilt, -tilt, 0); sock(rv, "Max").default_value = (tilt, tilt, math.tau)
    rs = N.new("FunctionNodeRandomValue"); rs.data_type = "FLOAT"
    sock(rs, "Min").default_value = scale[0]; sock(rs, "Max").default_value = scale[1]
    sock(rs, "Seed").default_value = seed + 3
    ri = N.new("FunctionNodeRandomValue"); ri.data_type = "INT"
    sock(ri, "Min").default_value = 0; sock(ri, "Max").default_value = 99
    L.new(dist.outputs["Points"], iop.inputs["Points"])
    L.new(ci.outputs[0], iop.inputs["Instance"])
    L.new(sock(ri, "Value", True), iop.inputs["Instance Index"])
    L.new(sock(rv, "Value", True), iop.inputs["Rotation"])
    L.new(sock(rs, "Value", True), iop.inputs["Scale"])
    j = N.new("GeometryNodeJoinGeometry")
    inst_out = iop.outputs[0]
    if realize:
        rl = N.new("GeometryNodeRealizeInstances")
        L.new(iop.outputs[0], rl.inputs[0])
        inst_out = rl.outputs[0]
    L.new(gi.outputs[0], j.inputs[0]); L.new(inst_out, j.inputs[0])
    L.new(j.outputs[0], go.inputs[0])
    md = obj.modifiers.new(name, "NODES"); md.node_group = ng


# ============================================================ river terrain + water
def profile_z(y):
    if y <= FAR_TOP:
        return TOP_Z + 0.02 * (FAR_TOP - y)
    if y <= FAR_TOE:
        t = (y - FAR_TOP) / (FAR_TOE - FAR_TOP)
        return TOP_Z + (BED_Z - TOP_Z) * t
    if y <= Y_TOE:
        return BED_Z
    if y <= Y_TOP:
        return BED_Z + (y - Y_TOE) * math.tan(SLOPE)
    return TOP_Z + 0.015 * (y - Y_TOP)

def build_terrain(coll, mat):
    nx, ny = 520, 500
    XH, YH = 45.0, 40.0
    bm = bmesh.new()
    grid = []
    for j in range(ny + 1):
        u = 2 * j / ny - 1   # denser rows around the channel
        y = -1.3 + YH * math.copysign(abs(u) ** 2.1, u)
        row = []
        for i in range(nx + 1):
            q = 2 * i / nx - 1
            x = XH * math.copysign(abs(q) ** 1.8, q)
            z = profile_z(y)
            p = Vector((x * 0.37, y * 0.37, 0.0))
            fine = noise.fractal(p * 3.0, 0.55, 2.1, 5)
            on_near_slope = Y_TOE - 0.2 < y < Y_TOP + 0.2
            if on_near_slope and abs(x) < INSTALL_HALF + 0.2:
                z += 0.004 * fine     # engineer-graded bank under the modules
            elif on_near_slope or FAR_TOP - 0.2 < y < FAR_TOE + 0.2:
                # eroded, scalloped bank face with an undercut near the waterline
                z += 0.10 * fine + 0.08 * noise.fractal(Vector((x * 0.9, y * 0.3, 0)), 0.5, 2, 3)
                z -= 0.12 * math.exp(-((z - 0.05) / 0.18) ** 2) * (0.5 + 0.5 * noise.noise(Vector((x * 1.3, 0, 0))))
            elif y > Y_TOP or y < FAR_TOP:
                far = max(0.0, abs(y) - 12) + max(0.0, abs(x) - 20)
                z += 0.06 * noise.fractal(p * 0.8, 0.5, 2, 4) + 0.01 * fine + 0.035 * far * (1 + noise.noise(p * 0.2))
            else:
                z += 0.05 * fine
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    t = obj_from_bm(bm, "Terrain", coll, [mat])
    smooth_mesh(t.data)
    return t

def build_water(coll, frame_end):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=900, y_segments=80, size=0.5)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, (FAR_TOE + Y_TOE) / 2, WATER_Z)) @ Matrix.Diagonal((90, 5.8, 1, 1)),
                        verts=bm.verts)
    w = obj_from_bm(bm, "River", coll)
    oc = w.modifiers.new("Current", "OCEAN")
    oc.geometry_mode = "DISPLACE"; oc.resolution = 12; oc.spatial_size = 6
    oc.wave_scale = 0.06; oc.choppiness = 0.8; oc.wind_velocity = 6
    oc.wave_alignment = 0.75; oc.wave_direction = 0.0; oc.damping = 0.5
    set_interp("LINEAR")
    oc.time = 1.0; oc.keyframe_insert("time", frame=1)
    oc.time = 1.0 + frame_end / FPS * 1.4; oc.keyframe_insert("time", frame=frame_end)
    set_interp("BEZIER")

    m, nt, b = nodes_mat("RiverWater")
    b.inputs["Base Color"].default_value = (0.035, 0.12, 0.10, 1)
    b.inputs["Roughness"].default_value = 0.035
    b.inputs["IOR"].default_value = 1.33
    coord = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 9; nz.inputs["Detail"].default_value = 6
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.08
    nt.links.new(coord.outputs["Object"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"]); nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    set_interp("LINEAR")
    loc = mp.inputs["Location"]
    loc.default_value = (0, 0, 0); loc.keyframe_insert("default_value", frame=1)
    loc.default_value = (-0.028 * frame_end, 0, 0); loc.keyframe_insert("default_value", frame=frame_end)
    set_interp("BEZIER")
    w.data.materials.append(m)
    smooth_mesh(w.data)
    return w


# ============================================================ installation
def slope_frame():
    u = Vector((1, 0, 0))
    v = Vector((0, math.cos(SLOPE), math.sin(SLOPE)))
    n = u.cross(v).normalized()
    d0 = (WATER_Z - 0.16 - BED_Z) / math.sin(SLOPE)
    return Vector((0, Y_TOE, BED_Z)) + v * d0, u, v, n

def place_modules(coll, module_me, plant_meshes, t):
    origin, u, v, n = slope_frame()
    basis = Matrix((u, v, n)).transposed().to_4x4()
    ROWS = 6
    COLS = int(INSTALL_HALF * 2 / S)
    x0 = -COLS * S / 2
    slots = []
    for r in range(ROWS):
        shift = (r % 2) * S / 2
        for k in range(COLS * 2 - (1 if r % 2 else 0)):
            c, up = k // 2, k % 2 == 0
            bx = x0 + shift + c * S
            if up:
                slots.append((r, bx + S / 2, r * TRI_H + TRI_H / 3, 0.0))
            else:
                slots.append((r, bx + S, r * TRI_H + 2 * TRI_H / 3, math.pi))
    # installed in courses: bottom row first, working along the river
    slots.sort(key=lambda s: (s[0], s[1]))
    a0, a1, drop = t["install"]
    g0, g1, grow = t["grow"]
    step = (a1 - a0 - drop) / (len(slots) - 1)
    gstep = (g1 - g0 - grow) / (len(slots) - 1)
    kinds = list(plant_meshes.keys())
    for i, (r, cu, cv, rot) in enumerate(slots):
        pos = origin + u * cu + v * cv
        ob = bpy.data.objects.new(f"Module_{i:03d}", module_me)
        coll.objects.link(ob)
        ob.matrix_world = Matrix.Translation(pos) @ basis @ Matrix.Rotation(rot, 4, "Z")
        fl, fr = ob.location.copy(), ob.rotation_euler.copy()
        f0 = int(a0 + i * step)
        ob.scale = (0, 0, 0); ob.keyframe_insert("scale", frame=f0 - 1)
        ob.scale = (1, 1, 1); ob.keyframe_insert("scale", frame=f0)
        # lowered vertically from a placement height, then seated onto the bank
        ob.location = fl + n * 0.12 + Vector((0, 0, 0.16)); ob.keyframe_insert("location", frame=f0)
        ob.location = fl + n * 0.02; ob.keyframe_insert("location", frame=f0 + drop - 3)
        ob.location = fl; ob.keyframe_insert("location", frame=f0 + drop)
        ob.rotation_euler = (fr.x, fr.y, fr.z + random.uniform(-0.25, 0.25)); ob.keyframe_insert("rotation_euler", frame=f0)
        ob.rotation_euler = fr; ob.keyframe_insert("rotation_euler", frame=f0 + drop - 3)
        if r == 0:
            continue  # submerged toe course: no planting
        kind = random.choice(kinds) if r > 1 else random.choice(["sedge", "lomandra"])
        pl = bpy.data.objects.new(f"Plant_{i:03d}", plant_meshes[kind])
        coll.objects.link(pl)
        pl.location = pos + n * 0.02
        pl.rotation_euler = (random.uniform(-0.12, 0.12), random.uniform(-0.12, 0.12), random.uniform(0, math.tau))
        s = random.uniform(1.3, 1.8)
        p0 = int(g0 + i * gstep + random.uniform(-5, 5))
        pl.scale = (0.001, 0.001, 0.001); pl.keyframe_insert("scale", frame=1); pl.keyframe_insert("scale", frame=p0)
        pl.scale = (s, s, s); pl.keyframe_insert("scale", frame=p0 + grow)


# ============================================================ lighting / camera / render
def setup_render(scn, frame_end):
    r = scn.render
    r.engine = "BLENDER_EEVEE"
    r.resolution_x, r.resolution_y, r.resolution_percentage = 1920, 1080, 100
    r.fps = FPS
    scn.frame_start, scn.frame_end = 1, frame_end
    r.use_motion_blur = True
    r.motion_blur_shutter = 0.5
    e = scn.eevee
    e.taa_render_samples = 64
    e.use_raytracing = True
    e.ray_tracing_method = "SCREEN"
    e.use_shadows = True
    e.use_fast_gi = True
    ro = e.ray_tracing_options
    for attr, val in (("resolution_scale", "1"), ("use_denoise", True)):
        try:
            setattr(ro, attr, val)
        except Exception:
            pass
    scn.view_settings.view_transform = "AgX"
    scn.view_settings.look = "AgX - Medium High Contrast"
    r.image_settings.file_format = "PNG"
    r.image_settings.color_mode = "RGB"

def sky_world(name, elevation=32, rotation=-30, strength=0.18):
    w = bpy.data.worlds.new(name); w.use_nodes = True
    nt = w.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "MULTIPLE_SCATTERING"
    sky.sun_disc = False
    sky.sun_elevation = math.radians(elevation); sky.sun_rotation = math.radians(rotation)
    sky.altitude = 200; sky.air_density = 1.0; sky.aerosol_density = 1.2
    bg = nt.nodes["Background"]; bg.inputs["Strength"].default_value = strength
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    return w

def camera_rig(scn, coll, keys, lens=30, fstop=5.6):
    target = link(bpy.data.objects.new(f"{scn.name}_Target", None), coll)
    cd = bpy.data.cameras.new(f"{scn.name}_Cam"); cd.lens = lens
    cd.dof.use_dof = True; cd.dof.focus_object = target; cd.dof.aperture_fstop = fstop
    cam = link(bpy.data.objects.new(f"{scn.name}_Cam", cd), coll)
    scn.camera = cam
    tc = cam.constraints.new("TRACK_TO"); tc.target = target
    tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
    for f, cp, tp in keys:
        cam.location = cp; cam.keyframe_insert("location", frame=f)
        target.location = tp; target.keyframe_insert("location", frame=f)
    return cam, target


# ============================================================ scene: River
def build_river_scene(module_me):
    scn = bpy.data.scenes.new("River")
    root = scn.collection
    env = new_coll("Environment", root)
    assets = new_coll("Assets", root)
    assets.hide_render = True
    scn.view_layers[0].layer_collection.children["Assets"].hide_viewport = True

    mats = {
        "leaf": leaf_material("Leaf", (0.07, 0.24, 0.04), (0.22, 0.42, 0.08)),
        "leaf2": leaf_material("LeafBlue", (0.10, 0.25, 0.10), (0.20, 0.36, 0.12)),
        "grass": leaf_material("GrassBlade", (0.10, 0.25, 0.04), (0.30, 0.42, 0.10)),
        "stem": flat_material("Stem", (0.2, 0.3, 0.1), 0.6),
        "flower_y": flat_material("FlowerYellow", (0.95, 0.70, 0.08), 0.4),
        "flower_p": flat_material("FlowerPurple", (0.45, 0.18, 0.65), 0.4),
        "bark": flat_material("Bark", (0.16, 0.11, 0.08), 0.9),
        "canopy": leaf_material("Canopy", (0.05, 0.16, 0.03), (0.20, 0.34, 0.07)),
        "crown": flat_material("CrownShade", (0.02, 0.06, 0.015), 0.9),
        "rock": flat_material("Rock", (0.32, 0.30, 0.27), 0.8),
    }
    terrain = build_terrain(env, terrain_material())
    build_water(env, RIVER_END)

    grass_c = new_coll("GrassAssets", assets)
    for k in range(3):
        link(bpy.data.objects.new(f"Grass{k}", grass_clump(mats["grass"])), grass_c)
    rock_c = new_coll("RockAssets", assets)
    for k in range(5):
        link(bpy.data.objects.new(f"Rock{k}", rock_mesh(k, mats["rock"])), rock_c)
    plants = {k: plant_mesh(k, mats) for k in ("sedge", "lomandra", "broadleaf", "flower_y", "flower_p")}
    wild_c = new_coll("WildAssets", assets)
    for k in ("sedge", "flower_y", "lomandra"):
        link(bpy.data.objects.new(f"Wild_{k}", plants[k]), wild_c)

    scatter(terrain, "Grass", grass_c, 26.0, TOP_Z - 0.05, 9, 0.9, (0.8, 1.5), seed=1, box=(-22, 22, -16, 14))
    scatter(terrain, "GrassFar", grass_c, 5.0, TOP_Z - 0.05, 9, 0.9, (1.0, 1.8), seed=4, box=(-30, 30, 14, 26))
    scatter(terrain, "Wildflowers", wild_c, 0.5, TOP_Z - 0.05, 9, 0.9, (0.7, 1.2), seed=5, box=(-22, 22, -16, 14))
    scatter(terrain, "BankRocks", rock_c, 1.2, -0.25, 0.25, 0.3, (0.05, 0.16), seed=2, exclude_x=INSTALL_HALF + 0.3)
    scatter(terrain, "BedRocks", rock_c, 1.6, -0.75, -0.45, 0.8, (0.04, 0.12), seed=9)

    trees = new_coll("Trees", env)
    leaves = leaf_cards(mats["canopy"])
    tpls = [tree_template(k, random.uniform(3.4, 4.6), mats, leaves) for k in range(4)]
    spots = [(-11, 7.5), (-6.5, 10), (-2, 8.2), (2.5, 11), (6.5, 8), (10.5, 10), (14, 7.6),
             (-4.5, -12.5), (3.0, -13.5), (11, -12)]
    for _ in range(46):   # distant treeline on both sides
        side = random.choice((1, -1))
        spots.append((random.uniform(-40, 40), side * random.uniform(14, 34)))
    for x, y in spots:
        place_tree(trees, random.choice(tpls), Vector((x, y, profile_z(y) - 0.05)), random.uniform(0.85, 1.35),
                   random.uniform(0, math.tau))

    install = new_coll("Installation", root)
    place_modules(install, module_me, plants, {"install": (78, 238, 10), "grow": (236, 300, 30)})

    sun = bpy.data.lights.new("Sun", "SUN"); sun.energy = 4.2; sun.angle = math.radians(1.2)
    sun.color = (1.0, 0.95, 0.86)
    so = link(bpy.data.objects.new("Sun", sun), env)
    so.rotation_euler = (math.radians(58), 0, math.radians(150))
    scn.world = sky_world("RiverSky", elevation=32, rotation=-30)

    keys = [  # frame, camera, look-at
        (1,   (-9.5, -9.0, 4.6), (-0.5, 0.9, 0.2)),
        (72,  (-7.0, -6.6, 3.0), (-1.2, 0.8, 0.2)),
        (150, (-3.6, -4.2, 1.55), (-0.6, 0.6, 0.1)),
        (236, (0.8, -3.4, 1.25), (1.6, 0.65, 0.2)),
        (300, (2.6, -2.2, 0.75), (0.6, 0.75, 0.35)),
        (RIVER_END, (7.0, -6.4, 2.9), (0.2, 0.7, 0.3)),
    ]
    camera_rig(scn, env, keys, lens=30, fstop=6.3)
    setup_render(scn, RIVER_END)
    return scn


# ============================================================ scene: Studio (module intro)
def dim_line(coll, a, b, label, mat, font, cam, parent, offset_text):
    bm = bmesh.new()
    d = b - a
    add_cyl(bm, (a + b) / 2, 0.0018, d.length - 0.03, d.to_track_quat("Z", "Y").to_matrix(), 8)
    for end, sgn in ((a, 1), (b, -1)):
        ret = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.007, radius2=0.0, depth=0.02)
        r2 = (d * -sgn).to_track_quat("Z", "Y").to_matrix()
        bmesh.ops.transform(bm, matrix=Matrix.Translation(end + d.normalized() * sgn * 0.01) @ r2.to_4x4(), verts=ret["verts"])
    line = obj_from_bm(bm, f"Dim_{label}", coll, [mat])
    td = bpy.data.curves.new(f"DimText_{label}", "FONT"); td.body = label; td.size = 0.034
    td.align_x = "CENTER"; td.align_y = "CENTER"
    if font:
        td.font = font
    td.materials.append(mat)
    txt = link(bpy.data.objects.new(f"DimText_{label}", td), coll)
    txt.location = (a + b) / 2 + offset_text
    c = txt.constraints.new("TRACK_TO"); c.target = cam; c.track_axis = "TRACK_Z"; c.up_axis = "UP_Y"
    line.parent = parent
    txt.parent = parent
    return [line, txt]

def build_studio_scene(module_me):
    scn = bpy.data.scenes.new("Studio")
    root = scn.collection
    bm = bmesh.new()   # seamless cyclorama
    prof = [(-3, 0)] + [(1.2 + 0.8 * math.sin(a), 0.8 - 0.8 * math.cos(a))
                        for a in [i / 12 * math.pi / 2 for i in range(13)]] + [(2.0, 3.5)]
    left = [bm.verts.new((-6, y, z)) for y, z in prof]
    right = [bm.verts.new((6, y, z)) for y, z in prof]
    for i in range(len(prof) - 1):
        bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    cyc = obj_from_bm(bm, "Cyclorama", root, [flat_material("Cyclorama", (0.36, 0.40, 0.40), 0.6)])
    smooth_mesh(cyc.data)

    hero = link(bpy.data.objects.new("Hero", module_me), root)
    set_interp("LINEAR")
    hero.rotation_euler = (0, 0, math.radians(-20)); hero.keyframe_insert("rotation_euler", frame=1)
    hero.rotation_euler = (0, 0, math.radians(70)); hero.keyframe_insert("rotation_euler", frame=92)
    set_interp("BEZIER")

    # three neighbours slide in and pin to the hero (edge-sharing triangle tiling)
    for k, off in enumerate([Vector((S / 2, TRI_H / 3, 0)), Vector((-S / 2, TRI_H / 3, 0)),
                             Vector((0, -2 * TRI_H / 3, 0))]):
        nb = link(bpy.data.objects.new(f"Neighbour{k}", module_me), root)
        nb.parent = hero
        nb.rotation_euler = (0, 0, math.pi)
        f = 92 + k * 8
        nb.location = off * 2.6
        nb.scale = (0, 0, 0); nb.keyframe_insert("scale", frame=f)
        nb.scale = (1, 1, 1); nb.keyframe_insert("scale", frame=f + 1)
        nb.keyframe_insert("location", frame=f + 1)
        nb.location = off; nb.keyframe_insert("location", frame=f + 21)

    keys = [
        (1,   (0.95, -0.95, 0.62), (0, 0, 0.13)),
        (92,  (0.80, -0.80, 0.50), (0, 0, 0.14)),
        (STUDIO_END, (1.05, -1.25, 1.15), (0.09, 0.03, 0.09)),
    ]
    cam, tgt = camera_rig(scn, root, keys, lens=50, fstop=8.0)

    font = None
    for f in ("C:/Windows/Fonts/segoeuisb.ttf", "C:/Windows/Fonts/segoeui.ttf"):
        if os.path.exists(f):
            font = bpy.data.fonts.load(f); break
    dim_m = flat_material("DimInk", (0.0, 0.30, 0.20), 0.4, emit=0.9)
    b0, b1 = Vector((-S / 2, -TRI_H / 3, 0)), Vector((S / 2, -TRI_H / 3, 0))
    dims = dim_line(root, b0 + Vector((0, -0.07, 0.005)), b1 + Vector((0, -0.07, 0.005)), "300 mm", dim_m, font, cam,
                    hero, Vector((0, -0.08, 0.012)))
    dims += dim_line(root, Vector((S / 2 + 0.06, -TRI_H / 3, 0)), Vector((S / 2 + 0.06, -TRI_H / 3, H_MOD)),
                     "300 mm ", dim_m, font, cam, hero, Vector((0.065, 0, 0.02)))
    for o in dims:  # shown during the turntable, removed before the interlock
        o.scale = (0, 0, 0); o.keyframe_insert("scale", frame=10)
        o.scale = (1, 1, 1); o.keyframe_insert("scale", frame=18)
        o.keyframe_insert("scale", frame=80)
        o.scale = (0, 0, 0); o.keyframe_insert("scale", frame=88)

    for name, energy, loc, size, col in (("Key", 45, (1.6, -1.4, 1.9), 1.2, (1, 0.96, 0.9)),
                                         ("Fill", 12, (-1.8, -0.8, 0.9), 1.6, (0.85, 0.92, 1)),
                                         ("Rim", 40, (-0.6, 1.6, 1.4), 0.8, (1, 1, 1))):
        ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.size = size; ld.color = col
        lo = link(bpy.data.objects.new(name, ld), root); lo.location = loc
        tc = lo.constraints.new("TRACK_TO"); tc.target = tgt; tc.track_axis = "TRACK_NEGATIVE_Z"; tc.up_axis = "UP_Y"
    w = bpy.data.worlds.new("StudioWorld"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.58, 0.6, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.12
    scn.world = w
    setup_render(scn, STUDIO_END)
    return scn


# ============================================================ main
reset()
lib_scene = bpy.context.scene
lib_scene.name = "Library"
lib = new_coll("ModuleLibrary", lib_scene.collection)
module = build_module(lib)
print("MODULE dims", tuple(round(d, 3) for d in module.dimensions), "tris",
      sum(len(p.vertices) - 2 for p in module.data.polygons))
export_module(module)

studio = build_studio_scene(module.data)
river = build_river_scene(module.data)
for sc in (studio, river):
    sc.render.filepath = "//render/" + sc.name + "/"
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "livingshield_scene.blend"))

print("LIVINGSHIELD DONE")
