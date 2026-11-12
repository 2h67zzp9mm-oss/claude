# Little Town home plot, as a white clay template (to paint over later).
# blender -b --python art/blender/homestead.py -- OUTDIR
#   OUTDIR/ground.png   everything flat: grass, path, pond, garden beds and fence (full frame)
#   OUTDIR/house.png    the house on its own (full frame, cropped later) so people can walk behind it
#   OUTDIR/sprites/*.png  tree, bush, mailbox (flag up/down), crate, wet soil, crops by stage, fish
#   OUTDIR/camera.json  how ground metres map to pixels
# Same camera angle as walker.py, so the walkers stand in it at the right size (81.92 px per metre).
import bpy, bmesh, math, sys, json, os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
OUT = sys.argv[sys.argv.index('--') + 1]; os.makedirs(os.path.join(OUT, 'sprites'), exist_ok=True)
L = json.load(open(os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'homestead', 'layout.json')))
R = math.radians
_mats = {}
PPM = 81.92                       # pixels per metre (walker cells are 102.4 px/m, stored at 0.8)
W, H = 2560, 1720
CLAY, DARK, WET = (0.82, 0.80, 0.76), (0.62, 0.60, 0.57), (0.50, 0.48, 0.46)
# World theme: THEME=scifi blender ... repaints the same scene. Same layout, same gameplay.
THEME = os.environ.get('THEME', 'clay')
TINT = [None]   # while set, plain clay parts take this colour (e.g. plants)
# clay colour -> (colour, glow, metallic)
SCIFI = {
    CLAY: ((0.80, 0.84, 0.90), 0, 0.5), DARK: ((0.10, 0.75, 0.95), 2.5, 0), WET: ((0.12, 0.14, 0.22), 0, 0),
    (0.72, 0.70, 0.67): ((0.32, 0.35, 0.44), 0, 0.6), (0.74, 0.72, 0.69): ((0.25, 0.80, 0.95), 0.8, 0),
    (0.42, 0.44, 0.46): ((0.05, 0.85, 0.75), 1.6, 0), (0.70, 0.68, 0.65): ((0.16, 0.13, 0.22), 0, 0),
    'ground': ((0.38, 0.30, 0.46), 0, 0), 'plant': ((0.25, 0.85, 0.55), 0.5, 0), 'crystal': ((0.75, 0.35, 1.0), 1.8, 0),
    'beacon': ((0.3, 1.0, 0.45), 3.0, 0), 'off': ((0.2, 0.22, 0.28), 0, 0.4), 'accent': ((1.0, 0.55, 0.15), 1.2, 0),
}
SKY = {'clay': (0.62, 0.68, 0.78), 'scifi': (0.10, 0.10, 0.22)}[THEME]

def reset(w, h, scale, centre):
    bpy.ops.wm.read_factory_settings(use_empty=True); _mats.clear()
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE'; sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = w, h; sc.view_settings.view_transform = 'Standard'
    try: sc.eevee.use_gtao = True; sc.eevee.gtao_distance = 1.5
    except Exception: pass
    wd = bpy.data.worlds.new('w'); sc.world = wd; wd.use_nodes = True
    wd.node_tree.nodes['Background'].inputs[0].default_value = (*SKY, 1); wd.node_tree.nodes['Background'].inputs[1].default_value = 0.45
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = scale
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    co.rotation_euler = (R(60), 0, R(45)); d = Vector((0, 0, 1)); d.rotate(co.rotation_euler); co.location = Vector(centre) + d * 60
    cam.clip_end = 200
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.2; sun.angle = R(10); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (R(50), 0, R(-20))
    return sc, co

def mat(col, rough=0.6):
    if col == CLAY and TINT[0]: col = TINT[0]
    if col in _mats: return _mats[col]
    base, glow, metal = (col, 0, 0) if THEME == 'clay' or col not in SCIFI else SCIFI[col]
    if isinstance(base, str): base = CLAY
    m = bpy.data.materials.new('clay'); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*base, 1); p.inputs['Roughness'].default_value = 0.5 if metal else rough
    p.inputs['Metallic'].default_value = metal
    if glow: p.inputs['Emission Color'].default_value = (*base, 1); p.inputs['Emission Strength'].default_value = glow
    _mats[col] = m; return m

def put(o, col=CLAY, smooth=False):
    o.data.materials.append(mat(col))
    if smooth: bpy.ops.object.shade_smooth()
    return o
def box(x0, y0, z0, x1, y1, z1, col=CLAY):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.object; o.scale = (x1 - x0, y1 - y0, z1 - z0); return put(o, col)
def cyl(x, y, z, r, h, col=CLAY, v=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=h, location=(x, y, z + h / 2)); return put(bpy.context.object, col)
def ball(x, y, z, sx, sy, sz, col=CLAY):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=(x, y, z))
    o = bpy.context.object; o.scale = (sx, sy, sz); return put(o, col, True)
def cone(x, y, z, r, h, col=CLAY):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r, depth=h, location=(x, y, z + h / 2)); return put(bpy.context.object, col, True)

def project(sc, cam, p):
    v = world_to_camera_view(sc, cam, Vector(p)); r = sc.render
    return [round(v.x * r.resolution_x, 2), round((1 - v.y) * r.resolution_y, 2)]

# ---------- ground ----------
def ground_scene():
    S = L['size']
    # grass slab with a dip for the pond
    bm = bmesh.new(); N = 84
    P = L['pond']
    verts = {}
    for i in range(N + 1):
        for j in range(N + 1):
            x, y = i * S / N, j * S / N
            e = ((x - P['x']) / P['rx']) ** 2 + ((y - P['y']) / P['ry']) ** 2
            z = -0.45 * max(0, 1 - e) ** 0.6 if e < 1 else 0
            verts[i, j] = bm.verts.new((x, y, z))
    for i in range(N):
        for j in range(N): bm.faces.new((verts[i, j], verts[i + 1, j], verts[i + 1, j + 1], verts[i, j + 1]))
    me = bpy.data.meshes.new('ground'); bm.to_mesh(me); o = bpy.data.objects.new('ground', me); bpy.context.scene.collection.objects.link(o)
    G0 = 'ground' if THEME == 'scifi' else CLAY
    o.data.materials.append(mat(G0)); bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.shade_smooth()
    box(0, 0, -0.6, S, S, -0.48, G0)  # thickness so the edge reads
    # water surface, a little below the rim
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1, fill_type='NGON', location=(P['x'], P['y'], -0.07))
    w = bpy.context.object; w.scale = (P['rx'] * 0.95, P['ry'] * 0.95, 1); put(w, (0.42, 0.44, 0.46))
    for k in range(10):  # stones round the edge
        a = k / 10 * 2 * math.pi + 0.3
        ball(P['x'] + math.cos(a) * P['rx'] * 1.02, P['y'] + math.sin(a) * P['ry'] * 1.02, 0.02, 0.28, 0.22, 0.16)
    for (dx, dy) in ((-1.2, 0.6), (0.8, -0.9), (1.6, 0.9)):  # lily pads
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.32, depth=0.03, location=(P['x'] + dx, P['y'] + dy, -0.04)); put(bpy.context.object)
    for (dx, dy) in ((-2.6, -1.2), (-2.4, 1.4), (2.7, 1.3)):  # reeds
        for k in range(5): cyl(P['x'] + dx + (k % 3) * 0.12, P['y'] + dy + (k // 3) * 0.12, -0.05, 0.025, 0.9 + (k % 2) * 0.3)
    # path: flat stepping strip
    pts = L['path']
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(bx - ax, by - ay) / 0.55))
        for k in range(n):
            t = (k + 0.5) / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.36 + 0.06 * ((k * 7) % 3) / 2, depth=0.06, location=(x + 0.18 * math.sin(k * 2.1), y + 0.18 * math.cos(k * 1.7), 0.0))
            put(bpy.context.object, (0.74, 0.72, 0.69))
    # garden beds (raised soil) and a low picket fence with a gate
    G = L['garden']; ps = G['plot']
    for (x, y) in G['plots']:
        box(x, y, -0.02, x + ps, y + ps, 0.14, (0.70, 0.68, 0.65))
        for r in range(3): box(x + 0.1, y + 0.12 + r * 0.4, 0.14, x + ps - 0.1, y + 0.3 + r * 0.4, 0.2, (0.70, 0.68, 0.65))  # furrows
    gx, gy, gw = G['gate']
    def fence(ax, ay, bx, by):
        n = max(1, int(math.hypot(bx - ax, by - ay) / 0.5))
        for k in range(n + 1):
            t = k / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            box(x - 0.05, y - 0.05, 0, x + 0.05, y + 0.05, 0.62)
        if abs(bx - ax) > abs(by - ay): box(min(ax, bx), ay - 0.03, 0.38, max(ax, bx), ay + 0.03, 0.46)
        else: box(ax - 0.03, min(ay, by), 0.38, ax + 0.03, max(ay, by), 0.46)
    x0, y0, x1, y1 = G['x0'], G['y0'], G['x1'], G['y1']
    fence(x0, y0, x1, y0); fence(x0, y1, x1, y1); fence(x0, y0, x0, y1)
    fence(x1, y0, x1, gy - gw / 2); fence(x1, gy + gw / 2, x1, y1)

# ---------- house ----------
def house_scene():
    h = L['house']; x0, y0, x1, y1, wh = h['x0'], h['y0'], h['x1'], h['y1'], h['wall']
    box(x0 - 0.15, y0 - 0.15, 0, x1 + 0.15, y1 + 0.15, 0.25, (0.72, 0.70, 0.67))  # stone footing
    box(x0, y0, 0.25, x1, y1, wh)
    # gable roof, ridge along x
    cy, ov, rh = (y0 + y1) / 2, 0.4, 1.9
    bm = bmesh.new()
    a = [bm.verts.new(v) for v in ((x0 - ov, y0 - ov, wh), (x1 + ov, y0 - ov, wh), (x1 + ov, cy, wh + rh), (x0 - ov, cy, wh + rh))]
    b = [bm.verts.new(v) for v in ((x0 - ov, y1 + ov, wh), (x1 + ov, y1 + ov, wh), (x1 + ov, cy, wh + rh), (x0 - ov, cy, wh + rh))]
    bm.faces.new(a); bm.faces.new(b[::-1])
    me = bpy.data.meshes.new('roof'); bm.to_mesh(me); ro = bpy.data.objects.new('roof', me); bpy.context.scene.collection.objects.link(ro)
    mod = ro.modifiers.new('s', 'SOLIDIFY'); mod.thickness = 0.18; ro.data.materials.append(mat(CLAY))
    # gable ends (triangles) filling the walls under the roof
    for xx in (x0, x1):
        bm = bmesh.new(); t = [bm.verts.new(v) for v in ((xx, y0, wh), (xx, y1, wh), (xx, cy, wh + rh - 0.05))]; bm.faces.new(t)
        me = bpy.data.meshes.new('gable'); bm.to_mesh(me); g = bpy.data.objects.new('gable', me); bpy.context.scene.collection.objects.link(g)
        g.modifiers.new('s', 'SOLIDIFY').thickness = 0.1; g.data.materials.append(mat(CLAY))
    box(x0 + 1.0, y1 - 1.2, wh + 0.6, x0 + 1.6, y1 - 0.6, wh + 2.6)  # chimney
    dx, dy = h['door']
    box(x1 - 0.02, dy - 0.5, 0.25, x1 + 0.08, dy + 0.5, 2.15, DARK)                # door
    box(x1, dy - 0.75, 0, x1 + 0.7, dy + 0.75, 0.18, (0.72, 0.70, 0.67))          # step
    ball(x1 + 0.1, dy + 0.32, 1.2, 0.05, 0.05, 0.05)                               # knob
    for wy in (y0 + 0.9, y1 - 0.9):                                                # side windows
        box(x1 - 0.02, wy - 0.45, 1.1, x1 + 0.06, wy + 0.45, 1.95, DARK); box(x1, wy - 0.55, 1.0, x1 + 0.14, wy + 0.55, 1.08)
    for wx in (x0 + 1.3, x1 - 1.4):                                                # front windows
        box(wx - 0.5, y0 - 0.06, 1.1, wx + 0.5, y0 + 0.02, 1.95, DARK); box(wx - 0.6, y0 - 0.14, 1.0, wx + 0.6, y0, 1.08)
        ball(wx - 0.3, y0 - 0.35, 0.95, 0.25, 0.2, 0.18); ball(wx + 0.3, y0 - 0.35, 0.95, 0.25, 0.2, 0.18)  # window box plants
        box(wx - 0.55, y0 - 0.45, 0.8, wx + 0.55, y0 - 0.1, 0.95)

def dome_scene():
    h = L['house']; x0, y0, x1, y1 = h['x0'], h['y0'], h['x1'], h['y1']
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    cyl(cx, cy, 0, max(rx, ry) + 0.2, 0.3, (0.72, 0.70, 0.67), 48)                 # landing pad
    d = ball(cx, cy, 0.3, rx, ry, 2.9)                                              # dome, top half only
    bm = bmesh.new(); bm.from_mesh(d.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context='VERTS'); bm.to_mesh(d.data); bm.free()
    bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=0.04, location=(cx, cy, 1.5)); t = bpy.context.object; t.scale = (rx * 0.89, ry * 0.89, 1); put(t, DARK)  # window band
    dx, dy = h['door']
    box(x1 - 0.6, dy - 0.75, 0.3, x1 + 0.5, dy + 0.75, 2.4)                         # airlock
    box(x1 + 0.48, dy - 0.5, 0.3, x1 + 0.53, dy + 0.5, 2.15, DARK)                  # door glow
    box(x1 + 0.4, dy - 0.75, 0, x1 + 0.9, dy + 0.75, 0.18, (0.72, 0.70, 0.67))      # step
    cyl(x0 + 1.2, y1 - 1.0, 2.6, 0.04, 1.8, (0.72, 0.70, 0.67)); ball(x0 + 1.2, y1 - 1.0, 4.45, 0.12, 0.12, 0.12, 'accent')  # antenna
    for wx in (x0 + 1.3, x1 - 1.4):                                                 # little round windows
        ball(wx, y0 + 0.35, 1.0, 0.3, 0.06, 0.3, DARK)
def alien_tree():
    TINT[0] = 'plant'; cyl(0, 0, 0, 0.12, 2.2); TINT[0] = None
    ball(0, 0, 2.6, 0.9, 0.9, 0.45, 'plant')
    for k in range(5): an = k * 1.26; ball(0.55 * math.cos(an), 0.55 * math.sin(an), 2.2, 0.12, 0.12, 0.12, 'crystal')
def crystals():
    for k, (x, y, hgt) in enumerate(((0, 0, 0.9), (0.28, -0.1, 0.55), (-0.22, 0.15, 0.6), (0.1, 0.3, 0.45))):
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.14, depth=hgt, location=(x, y, hgt / 2), rotation=(R(8 * (k - 1.5)), R(6 * k), 0)); put(bpy.context.object, 'crystal')
def beacon(up):
    cyl(0, 0, 0, 0.25, 0.12, (0.72, 0.70, 0.67)); cyl(0, 0, 0.12, 0.05, 1.2)
    box(-0.22, -0.22, 1.2, 0.22, 0.22, 1.5); ball(0, 0, 1.68, 0.16, 0.16, 0.16, 'beacon' if up else 'off')
def pod():
    ball(0, 0, 0.42, 0.5, 0.45, 0.42); box(-0.52, -0.06, 0.15, 0.52, 0.06, 0.7, 'accent'); cyl(0, 0, 0, 0.35, 0.08, (0.72, 0.70, 0.67))

# ---------- small sprites ----------
def tree(): cyl(0, 0, 0, 0.22, 1.6); ball(0, 0, 2.3, 1.2, 1.2, 1.0); ball(0.4, -0.3, 2.9, 0.75, 0.75, 0.7); ball(-0.45, 0.2, 2.75, 0.7, 0.7, 0.65)
def bush(): ball(0, 0, 0.35, 0.6, 0.55, 0.42); ball(0.35, -0.2, 0.45, 0.35, 0.35, 0.3)
def mailbox(up):
    cyl(0, 0, 0, 0.06, 1.0); box(-0.2, -0.32, 1.0, 0.2, 0.32, 1.32)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.2, depth=0.64, location=(0, 0, 1.32), rotation=(R(90), 0, 0)); put(bpy.context.object)
    if up: box(0.2, 0.05, 1.2, 0.24, 0.1, 1.75); box(0.2, 0.05, 1.55, 0.24, 0.35, 1.75)
    else: box(0.2, 0.05, 1.1, 0.24, 0.45, 1.2)
def crate():
    box(-0.45, -0.45, 0, 0.45, 0.45, 0.7)
    for z in (0.18, 0.45): box(-0.47, -0.47, z, 0.47, 0.47, z + 0.06)
    box(-0.5, -0.5, 0.7, 0.5, 0.5, 0.8)
def wet(): box(-0.62, -0.62, 0.15, 0.62, 0.62, 0.21, WET)
CROPS = {
    'carrot':     lambda st: [ball(0.2 * (k - 1), 0, 0.3 + 0.1 * st, 0.06, 0.06, 0.18 + 0.08 * st) for k in range(3)] + ([cone(0.2 * (k - 1), 0, 0.1, 0.08, 0.2) for k in range(3)] if st == 2 else []),
    'strawberry': lambda st: [ball(0.18 * math.cos(k * 2.1), 0.18 * math.sin(k * 2.1), 0.25, 0.14 + 0.06 * st, 0.12 + 0.06 * st, 0.08 + 0.03 * st) for k in range(3)] + ([ball(0.25 * math.cos(k * 2.1 + 1), 0.25 * math.sin(k * 2.1 + 1), 0.2, 0.06, 0.06, 0.08) for k in range(4)] if st == 2 else []),
    'sunflower':  lambda st: [cyl(0, 0, 0.15, 0.04, 0.3 + 0.6 * st)] + [ball(0.1, 0, 0.35 + 0.4 * st, 0.12, 0.05, 0.07)] + ([cyl(0, -0.02, 1.4, 0.24, 0.06), ball(0, -0.06, 1.43, 0.12, 0.04, 0.12)] if st == 2 else []),
    'pumpkin':    lambda st: [ball(0.2 * math.cos(k * 1.6), 0.2 * math.sin(k * 1.6), 0.22, 0.14, 0.08, 0.05) for k in range(4)] + ([ball(0, 0, 0.42, 0.42, 0.38, 0.28), cyl(0, 0, 0.66, 0.04, 0.1)] if st == 2 else ([ball(0, 0, 0.28, 0.14, 0.13, 0.1)] if st == 1 else [])),
    'tomato':     lambda st: [cyl(0, 0, 0.15, 0.03, 0.4 + 0.3 * st), ball(0, 0, 0.45 + 0.2 * st, 0.22, 0.22, 0.2 + 0.08 * st)] + ([ball(0.18 * math.cos(k * 2.1), -0.12 + 0.1 * math.sin(k * 2.1), 0.5 + 0.12 * (k % 2), 0.09, 0.09, 0.09) for k in range(3)] if st == 2 else []),
    'blueberry':  lambda st: [ball(0, 0, 0.3, 0.2 + 0.1 * st, 0.2 + 0.1 * st, 0.18 + 0.08 * st)] + ([ball(0.22 * math.cos(k * 1.3), -0.15 + 0.12 * math.sin(k * 1.3), 0.35 + 0.08 * (k % 3), 0.05, 0.05, 0.05) for k in range(6)] if st == 2 else []),
    'corn':       lambda st: [cyl(0.2 * (k - 1), 0, 0.15, 0.04, 0.3 + 0.5 * st) for k in range(3)] + [ball(0.2 * (k - 1) + 0.1, 0, 0.4 + 0.3 * st, 0.14, 0.03, 0.05) for k in range(3)] + ([ball(0.2 * (k - 1) + 0.05, -0.05, 0.9, 0.06, 0.06, 0.16) for k in range(3)] if st == 2 else []),
    'watermelon': lambda st: [ball(0.25 * math.cos(k * 1.6), 0.25 * math.sin(k * 1.6), 0.2, 0.15, 0.09, 0.05) for k in range(4)] + ([ball(0, 0, 0.36, 0.48, 0.32, 0.24)] if st == 2 else ([ball(0, 0, 0.26, 0.16, 0.12, 0.1)] if st == 1 else [])),
}
FISH = ['minnow', 'perch', 'sunfish', 'catfish', 'trout', 'koi', 'pike', 'golden']
def fish(k):
    l = 0.5 + 0.12 * (k % 4); hgt = 0.18 + 0.05 * ((k * 3) % 4)
    ball(0, 0, 0, l, 0.08, hgt)
    bm = bmesh.new(); t = [bm.verts.new(v) for v in ((-l * 0.85, 0, 0), (-l * 1.35, 0, hgt * 1.1), (-l * 1.35, 0, -hgt * 1.1))]; bm.faces.new(t)
    me = bpy.data.meshes.new('tail'); bm.to_mesh(me); o = bpy.data.objects.new('tail', me); bpy.context.scene.collection.objects.link(o)
    o.modifiers.new('s', 'SOLIDIFY').thickness = 0.04; o.data.materials.append(mat(CLAY))
    ball(l * 0.6, -0.07, hgt * 0.25, 0.05, 0.03, 0.05, DARK)
    if k == 3: [cyl(l * 0.8, 0, -0.02, 0.01, 0.3) for _ in range(1)]

def sprite(name, build, size=2.0, pxsize=None, side=False):
    px = pxsize or int(size * PPM)
    sc, cam = reset(px, px, size, (0, 0, size * 0.35))
    if side:  # fish: seen from the side, like a picture in a collection book
        cam.data.ortho_scale = size; cam.rotation_euler = (R(90), 0, 0); cam.location = (0, -30, 0)
    build()
    sc.render.filepath = os.path.join(OUT, 'sprites', name + '.png'); bpy.ops.render.render(write_still=True)
    return project(sc, cam, (0, 0, 0))

anchors = {}
mode = sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else 'all'
S = L['size']; centre = (S / 2, S / 2, 1.6)
if mode in ('all', 'scene'):
    for part, fn in (('ground', ground_scene), ('house', dome_scene if THEME == 'scifi' else house_scene)):
        sc, cam = reset(W, H, W / PPM, centre); fn()
        sc.render.filepath = os.path.join(OUT, part + '.png'); bpy.ops.render.render(write_still=True)
    o, ax, ay, az = (project(sc, cam, p) for p in ((0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1)))
    json.dump({'size': [W, H], 'ppm': PPM, 'origin': o, 'ex': [ax[0] - o[0], ax[1] - o[1]], 'ey': [ay[0] - o[0], ay[1] - o[1]], 'ez': [az[0] - o[0], az[1] - o[1]]},
              open(os.path.join(OUT, 'camera.json'), 'w'), indent=1)
if mode in ('all', 'sprites'):
    sf = THEME == 'scifi'
    anchors['tree'] = sprite('tree', alien_tree if sf else tree, 4.6)
    anchors['bush'] = sprite('bush', crystals if sf else bush, 2.0)
    anchors['mailbox_up'] = sprite('mailbox_up', lambda: beacon(True) if sf else mailbox(True), 2.4)
    anchors['mailbox'] = sprite('mailbox', lambda: beacon(False) if sf else mailbox(False), 2.4)
    anchors['crate'] = sprite('crate', pod if sf else crate, 2.0)
    anchors['wet'] = sprite('wet', wet, 2.0)
    TINT[0] = 'plant' if sf else None
    for c, f in CROPS.items():
        for st in range(3): anchors['%s_%d' % (c, st)] = sprite('%s_%d' % (c, st), lambda f=f, st=st: f(st), 2.0)
    TINT[0] = 'crystal' if sf else None
    for k, n in enumerate(FISH): anchors['fish_' + n] = sprite('fish_' + n, lambda k=k: fish(k), 2.2, 160, side=True)
    TINT[0] = None
    json.dump(anchors, open(os.path.join(OUT, 'anchors.json'), 'w'), indent=1)
