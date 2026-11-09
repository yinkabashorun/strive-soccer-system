# Renders a photo-real gold trophy engraved STRIVE ELITE on a transparent background.
# usage: python3.11 trophy.py out.png [width height samples]
import sys, math, bpy, bmesh

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else (sys.argv[1] if len(sys.argv) > 1 else "trophy.png")
args = sys.argv[sys.argv.index(out) + 1:] if out in sys.argv else []
W = int(args[0]) if len(args) > 0 else 900
H = int(args[1]) if len(args) > 1 else 1350
SAMPLES = int(args[2]) if len(args) > 2 else 96

import os
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PlayfairDisplay-Bold.ttf")
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ---------- materials
def principled(name, color, metallic, rough, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.05
    return m

GOLD = principled("gold", (1.0, 0.80, 0.42), 1.0, 0.13)
GOLD_BRUSHED = principled("gold_b", (0.98, 0.79, 0.44), 1.0, 0.3)
BLACK = principled("black", (0.012, 0.012, 0.014), 0.0, 0.08, coat=1.0)
ENGRAVE = principled("engrave", (0.05, 0.035, 0.015), 1.0, 0.55)

def smooth(obj, levels=2):
    for p in obj.data.polygons: p.use_smooth = True
    if levels:
        m = obj.modifiers.new("sub", "SUBSURF"); m.levels = levels; m.render_levels = levels

# ---------- lathe helper
def lathe(name, profile, mat, segs=96):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for j in range(len(profile) - 1):
            bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    ob.data.materials.append(mat); smooth(ob, 1)
    return ob

# cup: outer wall up to the rim, lip, inner wall back down
cup = [(0.0, 1.02), (0.10, 1.03), (0.26, 1.08), (0.46, 1.22), (0.60, 1.42), (0.68, 1.66),
       (0.72, 1.90), (0.75, 2.04), (0.77, 2.08), (0.755, 2.10), (0.72, 2.07), (0.68, 1.90),
       (0.63, 1.62), (0.52, 1.36), (0.30, 1.16), (0.0, 1.10)]
CUP = lathe("cup", cup, GOLD)
# bands around the bowl
for z, r in ((1.62, 0.668), (1.67, 0.676)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.012, location=(0, 0, z), major_segments=96)
    bpy.context.object.data.materials.append(GOLD_BRUSHED); smooth(bpy.context.object, 0)


stem = [(0.0, 1.06), (0.11, 1.05), (0.075, 0.96), (0.06, 0.82), (0.07, 0.72), (0.12, 0.66),
        (0.10, 0.62), (0.07, 0.58), (0.09, 0.52), (0.20, 0.46), (0.34, 0.42), (0.38, 0.39),
        (0.38, 0.36), (0.0, 0.36)]
lathe("stem", stem, GOLD)

# ---------- handles (bevelled bezier curves)
def handle(side):
    cu = bpy.data.curves.new("h", "CURVE"); cu.dimensions = "3D"
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(2)
    s = side
    pts = [(s * 0.70, 0, 1.92), (s * 1.08, 0, 1.70), (s * 0.58, 0, 1.30)]
    hl = [((s * 0.70, 0, 1.92), (s * 0.95, 0, 2.02)),
          ((s * 1.10, 0, 1.92), (s * 1.06, 0, 1.46)),
          ((s * 0.85, 0, 1.28), (s * 0.50, 0, 1.30))]
    for bp, p, (l, r) in zip(sp.bezier_points, pts, [((s*0.55,0,1.84),(s*0.95,0,2.02)), ((s*1.10,0,1.92),(s*1.06,0,1.46)), ((s*0.85,0,1.28),(s*0.45,0,1.31))]):
        bp.co = p; bp.handle_left = l; bp.handle_right = r
    cu.bevel_depth = 0.045; cu.bevel_resolution = 6; cu.resolution_u = 24
    ob = bpy.data.objects.new("handle", cu); sc.collection.objects.link(ob)
    ob.data.materials.append(GOLD)
for s in (1, -1): handle(s)

# ---------- plinth
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.18))
pl = bpy.context.object; pl.scale = (0.98, 0.98, 0.36); pl.data.materials.append(BLACK)
bv = pl.modifiers.new("bev", "BEVEL"); bv.width = 0.012; bv.segments = 4
for p in pl.data.polygons: p.use_smooth = True
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.365))
tr = bpy.context.object; tr.scale = (1.0, 1.0, 0.018); tr.data.materials.append(GOLD_BRUSHED)
# front plate
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.495, 0.18))
plate = bpy.context.object; plate.scale = (0.74, 0.012, 0.17); plate.data.materials.append(GOLD_BRUSHED)
b2 = plate.modifiers.new("bev", "BEVEL"); b2.width = 0.006; b2.segments = 3
# engraved text (raised a hair, dark fill reads as engraving)
for txt, z, size in (("STRIVE ELITE", 0.185, 0.085),):
    cu = bpy.data.curves.new("t", "FONT"); cu.body = txt; cu.align_x = "CENTER"; cu.align_y = "CENTER"
    cu.size = size; cu.extrude = 0.002; cu.space_character = 1.15
    try:
        cu.font = bpy.data.fonts.load(FONT)
    except Exception:
        pass
    t = bpy.data.objects.new("txt", cu); sc.collection.objects.link(t)
    t.location = (0, -0.5025, z); t.rotation_euler = (math.radians(90), 0, 0)
    t.data.materials.append(ENGRAVE)
# hairlines on the plate
for z in (0.12, 0.25):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.5022, z))
    l = bpy.context.object; l.scale = (0.58, 0.001, 0.0035); l.data.materials.append(ENGRAVE)

# ---------- studio: dark world, softboxes, reflection strips (invisible to camera)
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.018, 0.015, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.5

def area(loc, rot, size, energy, color=(1, 0.96, 0.9)):
    bpy.ops.object.light_add(type="AREA", location=loc)
    L = bpy.context.object; L.rotation_euler = [math.radians(a) for a in rot]
    L.data.shape = "RECTANGLE"; L.data.size, L.data.size_y = size; L.data.energy = energy * 1.5; L.data.color = color
area((-3.0, -3.0, 3.0), (60, 0, -45), (2.5, 4.0), 900)
area((3.2, -2.4, 2.4), (65, 0, 50), (1.2, 4.0), 700, (1, 0.9, 0.75))
area((0, 3.0, 3.0), (-55, 0, 180), (3.0, 1.5), 900)
area((0, -1.5, 5.0), (15, 0, 0), (3.0, 3.0), 400)

def strip(loc, rot, scale, strength):
    bpy.ops.mesh.primitive_plane_add(location=loc)
    o = bpy.context.object; o.rotation_euler = [math.radians(a) for a in rot]; o.scale = scale
    m = bpy.data.materials.new("em"); m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission"); e.inputs[1].default_value = strength
    e.inputs[0].default_value = (1, 0.95, 0.88, 1)
    outn = nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(e.outputs[0], outn.inputs[0])
    o.data.materials.append(m); o.visible_camera = False
strip((-2.2, -2.0, 1.6), (90, 0, -40), (0.18, 1.8, 1), 18)
strip((2.4, -1.4, 1.6), (90, 0, 55), (0.25, 1.8, 1), 14)
strip((0, -3.2, 3.4), (60, 0, 0), (2.0, 0.12, 1), 10)

# ---------- camera
bpy.ops.object.camera_add(location=(0, -6.2, 1.75))
cam = bpy.context.object; sc.camera = cam
cam.data.lens = 62
d = bpy.data.objects.new("tgt", None); sc.collection.objects.link(d); d.location = (0, 0, 1.08)
c = cam.constraints.new("TRACK_TO"); c.target = d; c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"

r = sc.render; r.engine = "CYCLES"; r.resolution_x = W; r.resolution_y = H; r.film_transparent = True
sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True; sc.cycles.device = "CPU"
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"; sc.view_settings.exposure = 0.35
r.filepath = out; r.image_settings.file_format = "PNG"; r.image_settings.color_mode = "RGBA"
bpy.ops.render.render(write_still=True)
print("wrote", out)
