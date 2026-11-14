# Glint's Grid art, set 1: Glint, his home, a lamp, a crystal tree and the spark fountain.
# Run: glint-blender art/src/town1.py [name ...]   (no names = render all)
# Every sprite is square, see-through, and the spot where the thing touches the ground is at
# (50% across, 80% down) of the picture. grid.js relies on that anchor.
import bpy, sys, math, os
from mathutils import Vector

OUT = os.path.join(os.getcwd(), "art")
ELEV = math.radians(30)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 48
    sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.25, 0.4, 0.75, 1); bg.inputs[1].default_value = 0.9
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.0; sun.color = (1, 0.95, 0.9)
    so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    return sc

def mat(name, col, glow=0.0, rough=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    if glow:
        for key in ("Emission Color", "Emission"):
            if key in b.inputs: b.inputs[key].default_value = (*col, 1); break
        b.inputs["Emission Strength"].default_value = glow
    return m

def put(o, m, flat=True):
    o.data.materials.append(m)
    if not flat: bpy.ops.object.shade_smooth()
    return o

def cyl(r, h, z, m, verts=8, r2=None, loc=(0, 0), rot=(0, 0, 0)):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(loc[0], loc[1], z + h / 2), rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=h, location=(loc[0], loc[1], z + h / 2), rotation=rot)
    return put(bpy.context.object, m)

def ico(r, loc, m, sub=1, scale=(1, 1, 1), smooth=False):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.object; o.scale = scale
    return put(o, m, flat=not smooth)

def box(size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = size
    return put(o, m)

def torus(R, r, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=24, minor_segments=8, location=loc, rotation=rot)
    return put(bpy.context.object, m, flat=False)

def shoot(sc, name, span, px):
    """span = how many world units the square picture covers."""
    cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = span
    co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
    up = Vector((0, math.sin(ELEV), math.cos(ELEV)))
    back = Vector((0, -math.cos(ELEV), math.sin(ELEV)))
    co.location = up * (0.3 * span) + back * 30
    co.rotation_euler = (math.pi / 2 - ELEV, 0, 0)
    sc.render.resolution_x = sc.render.resolution_y = px
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("rendered", name)

# ---------- the things ----------
CYAN, MINT, PINK, GOLD, VIOLET = (0.1, 0.8, 1.0), (0.3, 1.0, 0.7), (1.0, 0.35, 0.7), (1.0, 0.8, 0.3), (0.5, 0.35, 1.0)

def glint(sc):
    body = mat("body", CYAN, 1.6, 0.2)
    ico(0.42, (0, 0, 0.75), body, sub=1, scale=(1, 1, 1.35))               # diamond body
    ico(0.14, (0, 0, 1.55), mat("spark", (1, 1, 0.8), 4))                   # spark on top
    torus(0.6, 0.035, (0, 0, 0.62), mat("ring", GOLD, 3), rot=(math.radians(14), 0, 0))
    eye = mat("eye", (1, 1, 1), 5); pup = mat("pup", (0.02, 0.05, 0.15))
    for sx in (-0.15, 0.15):
        ico(0.1, (sx, -0.36, 0.86), eye, sub=2, smooth=True)
        ico(0.05, (sx, -0.45, 0.87), pup, sub=2, smooth=True)
    shoot(sc, "glint", 2.2, 192)

def home(sc):
    wall = mat("wall", (0.12, 0.2, 0.42), 0, 0.6); trim = mat("trim", CYAN, 3)
    roof = mat("roof", VIOLET, 0.25, 0.4); warm = mat("warm", GOLD, 4)
    cyl(1.25, 0.18, 0, mat("step", (0.2, 0.3, 0.55)), verts=8)             # step
    cyl(1.0, 1.3, 0.18, wall, verts=8)                                     # walls
    cyl(1.04, 0.07, 0.2, trim, verts=8); cyl(1.04, 0.07, 1.42, trim, verts=8)
    cyl(1.3, 1.25, 1.48, roof, verts=8, r2=0.12)                           # roof
    ico(0.22, (0, 0, 3.0), mat("gem", CYAN, 5), scale=(1, 1, 1.5))          # roof gem
    box((0.42, 0.1, 0.72), (0, -0.93, 0.56), warm)                         # door
    cyl(0.21, 0.1, 0, warm, verts=12, loc=(0, -0.93), rot=(math.pi / 2, 0, 0)).location.z = 0.92
    for a in (-45, 45):                                                    # side windows
        r = math.radians(a)
        box((0.3, 0.08, 0.3), (math.sin(r) * 0.93, -math.cos(r) * 0.93, 0.95), warm, rot=(0, 0, r))
    cyl(0.14, 0.7, 1.9, wall, verts=6, loc=(0.55, 0.2))                    # chimney
    ico(0.09, (0.55, 0.2, 2.75), mat("puff", PINK, 4))
    shoot(sc, "home", 4.4, 384)

def lamp(sc):
    pole = mat("pole", (0.15, 0.22, 0.45))
    cyl(0.16, 0.1, 0, pole); cyl(0.05, 1.3, 0.1, pole)
    cyl(0.14, 0.06, 1.4, mat("cup", CYAN, 2))
    ico(0.24, (0, 0, 1.68), mat("bulb", (1, 0.85, 0.45), 6), sub=2, smooth=True)
    shoot(sc, "lamp", 2.6, 160)

def tree(sc):
    cyl(0.14, 0.9, 0, mat("trunk", (0.3, 0.22, 0.5)), verts=6, r2=0.09)
    leaf = mat("leaf", MINT, 0.5, 0.35); leaf2 = mat("leaf2", (0.1, 0.75, 0.75), 0.5, 0.35)
    ico(0.62, (0, 0, 1.25), leaf); ico(0.45, (0.38, 0.05, 1.7), leaf2); ico(0.42, (-0.36, -0.05, 1.75), leaf2)
    ico(0.4, (0.02, 0, 2.15), leaf)
    fruit = mat("fruit", PINK, 5)
    for p in ((0.3, -0.5, 1.3), (-0.42, -0.4, 1.55), (0.1, -0.4, 2.05), (0.62, -0.3, 1.85)):
        ico(0.08, p, fruit, sub=2, smooth=True)
    shoot(sc, "tree", 3.2, 224)

def fountain(sc):
    stone = mat("stone", (0.16, 0.24, 0.5), 0, 0.6)
    cyl(1.1, 0.35, 0, stone, verts=10)
    cyl(0.92, 0.04, 0.34, mat("water", CYAN, 2.5), verts=10)
    cyl(1.12, 0.06, 0.3, mat("rim", MINT, 2), verts=10).scale = (1, 1, 1)
    cyl(0.22, 0.5, 0.35, stone, verts=6)
    ico(0.34, (0, 0, 1.3), mat("heart", PINK, 4), scale=(1, 1, 1.5))
    for i in range(5):
        a = i * math.tau / 5 + 0.3
        ico(0.07, (math.cos(a) * 0.6, math.sin(a) * 0.6, 0.75 + 0.12 * (i % 2)), mat("drop%d" % i, (1, 1, 0.8), 5))
    shoot(sc, "fountain", 3.4, 256)

ALL = {"glint": glint, "home": home, "lamp": lamp, "tree": tree, "fountain": fountain}
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for n in (args or ALL):
    ALL[n](reset())
