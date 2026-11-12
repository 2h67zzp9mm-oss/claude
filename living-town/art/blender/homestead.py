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
    CLAY: ((0.62, 0.57, 0.50), 0, 0.1), DARK: ((0.10, 0.75, 0.95), 2.5, 0), WET: ((0.12, 0.14, 0.22), 0, 0),
    (0.72, 0.70, 0.67): ((0.32, 0.35, 0.44), 0, 0.6), (0.74, 0.72, 0.69): ((0.25, 0.80, 0.95), 0.8, 0),
    (0.42, 0.44, 0.46): ((0.05, 0.85, 0.75), 1.6, 0), (0.70, 0.68, 0.65): ((0.16, 0.13, 0.22), 0, 0),
    'ground': ((0.15, 0.075, 0.19), 0, 0), 'plant': ((0.25, 0.85, 0.55), 0.5, 0), 'crystal': ((0.85, 0.25, 0.75), 2.0, 0),
    'beacon': ((0.3, 1.0, 0.45), 3.0, 0), 'off': ((0.2, 0.22, 0.28), 0, 0.4), 'accent': ((1.0, 0.55, 0.15), 1.2, 0),
    'panel': ((0.55, 0.52, 0.48), 0, 0.2), 'glow': ((0.0, 0.9, 1.0), 2.2, 0), 'wood': ((0.38, 0.18, 0.08), 0, 0),
    'soil': ((0.16, 0.09, 0.10), 0, 0), 'trunk': ((0.20, 0.09, 0.06), 0, 0), 'cap': ((0.13, 0.36, 0.28), 0, 0),
    'capdot': ((0.30, 0.55, 0.45), 0, 0), 'rock': ((0.17, 0.09, 0.22), 0, 0), 'cliff': ((0.13, 0.06, 0.17), 0, 0),
    'water': ((0.05, 0.9, 0.75), 1.1, 0), 'pad': ((0.30, 0.65, 0.35), 0.2, 0), 'tile': ((0.25, 0.85, 0.95), 0.8, 0),
    'shrub': ((0.10, 0.38, 0.33), 0, 0), 'dark': ((0.12, 0.10, 0.16), 0, 0.3), 'moss': ((0.42, 0.30, 0.50), 0, 0),
    'c_carrot': ((1.0, 0.45, 0.1), 2.4, 0), 'c_strawberry': ((1.0, 0.2, 0.45), 2.4, 0), 'c_tomato': ((1.0, 0.25, 0.15), 2.4, 0),
    'c_blueberry': ((0.3, 0.45, 1.0), 2.4, 0), 'c_corn': ((1.0, 0.85, 0.2), 2.4, 0), 'c_sunflower': ((1.0, 0.75, 0.1), 2.4, 0),
    'r0': ((1.0, 0.25, 0.7), 2.2, 0), 'r1': ((0.1, 0.85, 1.0), 2.2, 0), 'r2': ((0.6, 0.3, 1.0), 2.2, 0), 'r3': ((1.0, 0.8, 0.15), 2.2, 0), 'r4': ((0.4, 1.0, 0.3), 2.2, 0),
    'lampglow': ((1.0, 0.85, 0.55), 3.5, 0), 'paving': ((0.26, 0.18, 0.28), 0, 0),
    'c_watermelon': ((0.3, 1.0, 0.4), 2.4, 0), 'c_pumpkin': ((1.0, 0.5, 0.05), 2.4, 0), 'leaf': ((0.12, 0.55, 0.40), 0.15, 0),
}
SKY = {'clay': (0.62, 0.68, 0.78), 'scifi': (0.42, 0.30, 0.62), 'castle': (0.86, 0.72, 0.86)}[THEME]

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
    if THEME == 'castle':   # warm sunset light from the right, pink fill from behind, soft bloom
        sun.color = (1.0, 0.88, 0.74); sun.energy = 3.0; so.rotation_euler = (R(48), 0, R(-35))
        rim = bpy.data.lights.new('rim', 'SUN'); rim.energy = 1.1; rim.color = (1.0, 0.62, 0.82); ro = bpy.data.objects.new('rim', rim); sc.collection.objects.link(ro); ro.rotation_euler = (R(60), 0, R(150))
        nt = bpy.data.node_groups.new('comp', 'CompositorNodeTree'); sc.compositing_node_group = nt
        nt.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        rl = nt.nodes.new('CompositorNodeRLayers'); gl = nt.nodes.new('CompositorNodeGlare'); out = nt.nodes.new('NodeGroupOutput')
        gl.inputs['Type'].default_value = 'Bloom'; gl.inputs['Threshold'].default_value = 0.9; gl.inputs['Strength'].default_value = 0.5; gl.inputs['Size'].default_value = 0.5
        nt.links.new(rl.outputs['Image'], gl.inputs['Image']); nt.links.new(gl.outputs['Image'], out.inputs[0])
    if THEME == 'scifi':
        sun.color = (1.0, 0.86, 0.78); sun.energy = 2.7
        rim = bpy.data.lights.new('rim', 'SUN'); rim.energy = 1.2; rim.color = (0.55, 0.6, 1.0); ro = bpy.data.objects.new('rim', rim); sc.collection.objects.link(ro); ro.rotation_euler = (R(60), 0, R(150))   # bloom, so glowing things bleed light like the concept art
        nt = bpy.data.node_groups.new('comp', 'CompositorNodeTree'); sc.compositing_node_group = nt
        nt.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        rl = nt.nodes.new('CompositorNodeRLayers'); gl = nt.nodes.new('CompositorNodeGlare'); out = nt.nodes.new('NodeGroupOutput')
        gl.inputs['Type'].default_value = 'Bloom'; gl.inputs['Threshold'].default_value = 0.75; gl.inputs['Strength'].default_value = 0.9; gl.inputs['Size'].default_value = 0.6
        nt.links.new(rl.outputs['Image'], gl.inputs['Image']); nt.links.new(gl.outputs['Image'], out.inputs[0])
    return sc, co

def mat(col, rough=0.6):
    if col == CLAY and TINT[0]: col = TINT[0]
    if col in _mats: return _mats[col]
    base, glow, metal = (col, 0, 0) if THEME == 'clay' or col not in SCIFI else SCIFI[col]
    if isinstance(base, str): base = CLAY
    m = bpy.data.materials.new('clay'); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*base, 1); p.inputs['Roughness'].default_value = 0.5 if metal else rough
    p.inputs['Metallic'].default_value = metal
    if glow:   # dark base + coloured light, so glowing things stay saturated instead of clipping to white
        p.inputs['Base Color'].default_value = (*[c * 0.2 for c in base], 1)
        p.inputs['Emission Color'].default_value = (*base, 1); p.inputs['Emission Strength'].default_value = 0.85 if (isinstance(col, str) and (col.startswith('c_') or col[:1] == 'r' and col[1:].isdigit())) else min(glow, 1.4)
    if THEME == 'scifi' and col in ('ground', 'rock', 'cliff', 'moss'):   # speckled, like rough alien soil
        nt = m.node_tree; n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 14; n.inputs['Detail'].default_value = 8
        ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (*[c * 0.72 for c in base], 1); ramp.color_ramp.elements[1].color = ((min(1, base[0] * 1.5), base[1] * 1.15, min(1, base[2] * 1.35), 1) if col == 'ground' else (*[min(1, c * 1.25) for c in base], 1))
        nt.links.new(n.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
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
    gx, gy, gw = G['gate']
    garden_paths(G)
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

def garden_paths(G):
    # paving slabs over the whole garden floor; the beds sit on top, the gaps are the paths
    col = 'paving' if THEME == 'scifi' else (0.74, 0.72, 0.69)
    k = 0; y = G['y0'] + 0.05
    while y < G['y1'] - 0.1:
        x = G['x0'] + 0.05 + (0.25 if k % 2 else 0)
        while x < G['x1'] - 0.1:
            x2 = min(x + 0.5, G['x1'] - 0.05); y2 = min(y + 0.42, G['y1'] - 0.05)
            box(x + 0.02, y + 0.02, -0.01, x2 - 0.02, y2 - 0.02, 0.025, col); x += 0.5
        y += 0.45; k += 1
    gx, gy, gw = G['gate']
    for t in range(3): box(G['x1'] - 0.1 + t * 0.45, gy - 0.5, -0.01, G['x1'] + 0.3 + t * 0.45, gy + 0.5, 0.025, col)   # step out of the gate

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


# ---------- sci-fi world (THEME=scifi), after the concept art ----------
def rbox(x0, y0, z0, x1, y1, z1, col=CLAY, bevel=0.06):
    o = box(x0, y0, z0, x1, y1, z1, col); m = o.modifiers.new('b', 'BEVEL'); m.width = bevel; m.segments = 3; return o
def ring(x, y, z, rx, ry, minor, col):
    bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=minor, major_segments=48, minor_segments=8, location=(x, y, z))
    t = bpy.context.object; t.scale = (rx, ry, 1); return put(t, col, True)
def rocks(cx, cy, n, spread, size, seed=1):
    for k in range(n):
        a = (k * 2.399 + seed) % (2 * math.pi); d = spread * (0.35 + 0.65 * ((k * 0.618 + seed * 0.3) % 1))
        sz = size * (0.6 + 0.6 * ((k * 0.37) % 1))
        ball(cx + math.cos(a) * d, cy + math.sin(a) * d, 0.0, sz * 1.2, sz, sz * 0.75, 'rock')

def ground_scifi():
    S = L['size']; P = L['pond']
    bm = bmesh.new(); N = 84; verts = {}
    for i in range(N + 1):
        for j in range(N + 1):
            x, y = i * S / N, j * S / N
            e = ((x - P['x']) / P['rx']) ** 2 + ((y - P['y']) / P['ry']) ** 2
            z = -0.45 * max(0, 1 - e) ** 0.6 if e < 1 else 0.03 * math.sin(x * 1.3) * math.cos(y * 1.1)
            verts[i, j] = bm.verts.new((x, y, z))
    for i in range(N):
        for j in range(N): bm.faces.new((verts[i, j], verts[i + 1, j], verts[i + 1, j + 1], verts[i, j + 1]))
    me = bpy.data.meshes.new('ground'); bm.to_mesh(me); o = bpy.data.objects.new('ground', me); bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat('ground')); bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.shade_smooth()
    # the island's rocky cliff edge
    box(0, 0, -1.6, S, S, -0.48, 'cliff')
    for k in range(int(S / 0.9)):
        t = (k + 0.5) * 0.9
        for (x, y) in ((t, 0), (S, t)):
            ball(x, y, -0.7 - 0.25 * (k % 3), 0.55, 0.55, 0.7, 'cliff')
    # glowing pond with a ring of chunky rocks
    bpy.ops.mesh.primitive_circle_add(vertices=48, radius=1, fill_type='NGON', location=(P['x'], P['y'], -0.07))
    w = bpy.context.object; w.scale = (P['rx'] * 0.95, P['ry'] * 0.95, 1); put(w, 'water')
    for k in range(18):
        a = k / 18 * 2 * math.pi + 0.2; sz = 0.26 + 0.12 * ((k * 5) % 3) / 2
        ball(P['x'] + math.cos(a) * P['rx'] * 1.0, P['y'] + math.sin(a) * P['ry'] * 1.0, 0.02, sz * 1.2, sz, sz * 0.8, 'rock')
    for (dx, dy, r) in ((-1.2, 0.6, 0.32), (0.8, -0.9, 0.28), (1.6, 0.9, 0.24), (-0.3, -0.2, 0.2)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r, depth=0.03, location=(P['x'] + dx, P['y'] + dy, -0.04)); put(bpy.context.object, 'pad')
    for (dx, dy) in ((-2.7, -1.2), (-2.5, 1.4), (2.8, 1.3)):
        for k in range(4): cyl(P['x'] + dx + (k % 2) * 0.14, P['y'] + dy + (k // 2) * 0.14, -0.05, 0.03, 0.7 + (k % 2) * 0.35, 'shrub'); ball(P['x'] + dx + (k % 2) * 0.14, P['y'] + dy + (k // 2) * 0.14, 0.75 + (k % 2) * 0.35, 0.06, 0.06, 0.12, 'glow')
    # path: square glowing tiles
    pts = L['path']
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(bx - ax, by - ay) / 0.75))
        ang = math.atan2(by - ay, bx - ax)
        for k in range(n):
            t = (k + 0.5) / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            o = rbox(x - 0.3, y - 0.24, -0.01, x + 0.3, y + 0.24, 0.05, 'tile', 0.08); o.rotation_euler = (0, 0, ang)
    # wooden garden beds of dark soil, cream fence with posts
    G = L['garden']; ps = G['plot']
    gx, gy, gw = G['gate']
    garden_paths(G)
    def fence(ax, ay, bx, by):
        n = max(1, int(math.hypot(bx - ax, by - ay) / 0.7))
        for k in range(n + 1):
            t = k / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            rbox(x - 0.07, y - 0.07, 0, x + 0.07, y + 0.07, 0.6, CLAY, 0.03); ball(x, y, 0.62, 0.08, 0.08, 0.05)
        for z in (0.22, 0.45):
            if abs(bx - ax) > abs(by - ay): box(min(ax, bx), ay - 0.03, z, max(ax, bx), ay + 0.03, z + 0.06)
            else: box(ax - 0.03, min(ay, by), z, ax + 0.03, max(ay, by), z + 0.06)
    x0, y0, x1, y1 = G['x0'], G['y0'], G['x1'], G['y1']
    fence(x0, y0, x1, y0); fence(x0, y1, x1, y1); fence(x0, y0, x0, y1)
    fence(x1, y0, x1, gy - gw / 2); fence(x1, gy + gw / 2, x1, y1)
    # lots of flat pebbles everywhere (low enough to walk over), clustered like the concept's ground
    import random as _r; rr = _r.Random(3)
    def clear(x, y):
        h = L['house']; P = L['pond']; G = L['garden']
        if h['x0'] - 0.3 < x < h['x1'] + 0.7 and h['y0'] - 0.3 < y < h['y1'] + 0.3: return False
        if ((x - P['x']) / P['rx']) ** 2 + ((y - P['y']) / P['ry']) ** 2 < 1.05: return False
        if G['x0'] < x < G['x1'] and G['y0'] < y < G['y1']: return False
        return True
    for k in range(420):
        x, y = rr.uniform(0.2, S - 0.2), rr.uniform(0.2, S - 0.2)
        if not clear(x, y): continue
        r = rr.uniform(0.05, 0.16); ball(x, y, 0.0, r * 1.3, r, r * 0.35, 'rock' if k % 3 else 'moss')
    # scattered pebbles and shrubs only where nobody walks (the margins)
    for k in range(26):
        t = (k * 0.81) % S
        for (x, y) in ((0.6, t), (t, S - 0.6)):
            if (k + int(x)) % 2: ball(x + 0.2 * math.sin(k), y, 0.0, 0.18, 0.15, 0.1, 'rock')
            else: ball(x, y + 0.2 * math.cos(k), 0.1, 0.22, 0.22, 0.2, 'shrub')

def dome_scene():
    h = L['house']; x0, y0, x1, y1 = h['x0'], h['y0'], h['x1'], h['y1']
    cx, cy, rx, ry = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2
    cyl(cx, cy, 0, 1, 0.25, 'panel', 48).scale = (rx * 1.02, ry * 1.02, 1)            # base ring
    d = ball(cx, cy, 0.25, rx * 0.95, ry * 0.95, 3.0)                                 # dome, top half only
    bm = bmesh.new(); bm.from_mesh(d.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.01], context='VERTS'); bm.to_mesh(d.data); bm.free()
    for z, f in ((1.0, 0.89), (2.1, 0.63)):                                           # panel seams
        ring(cx, cy, 0.25 + z, rx * 0.95 * f + 0.01, ry * 0.95 * f + 0.01, 0.035, 'panel')
    ring(cx, cy, 3.2, 0.45, 0.45, 0.06, 'panel'); cyl(cx, cy, 3.1, 0.38, 0.18, 'glow')  # skylight
    # round windows with cream frames, facing the camera sides
    for a in (R(200), R(240), R(290), R(330)):
        wx, wy = cx + math.cos(a) * rx * 0.86, cy + math.sin(a) * ry * 0.86
        ball(wx, wy, 1.35, 0.32, 0.32, 0.32, 'glow'); ring(wx, wy, 1.35, 0.36, 0.36, 0.06, 'panel').rotation_euler = (R(90), 0, a + R(90))
    # airlock: a rounded arch on the door side, kept inside the house footprint
    dx, dy = h['door']
    rbox(x1 - 1.0, dy - 0.85, 0.25, x1 + 0.12, dy + 0.85, 2.3, CLAY, 0.18)
    ball(x1 - 0.44, dy, 2.3, 0.56, 0.85, 0.5)
    rbox(x1 + 0.08, dy - 0.55, 0.25, x1 + 0.14, dy + 0.55, 2.0, 'dark', 0.02)
    for (a0, a1, b0, b1) in ((dy - 0.62, dy - 0.55, 0.25, 2.05), (dy + 0.55, dy + 0.62, 0.25, 2.05), (dy - 0.62, dy + 0.62, 1.98, 2.05)):
        box(x1 + 0.12, a0, b0, x1 + 0.17, a1, b1, 'glow')                            # glowing door frame
    rbox(x1 + 0.1, dy - 0.75, 0, x1 + 0.55, dy + 0.75, 0.16, 'panel', 0.04)
    # satellite dish and antenna on top
    cyl(x0 + 1.4, cy + 0.6, 2.5, 0.05, 1.3, 'panel'); ball(x0 + 1.4, cy + 0.6, 3.9, 0.1, 0.1, 0.1, 'accent')
    cyl(x1 - 1.8, cy + 0.9, 2.3, 0.06, 0.7, 'panel')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=0.55, location=(x1 - 1.8, cy + 0.9, 3.25))
    dish = bpy.context.object; dish.scale = (1, 1, 0.35); dish.rotation_euler = (R(35), 0, R(-30)); put(dish, CLAY, True)
    # a potted plant by the door
    cyl(x1 + 0.3, dy - 1.2, 0, 0.22, 0.35, 'panel'); ball(x1 + 0.3, dy - 1.2, 0.5, 0.25, 0.25, 0.25, 'shrub')

def alien_tree():
    # twisted trunk, a few soft mushroom caps with pale spots
    for k in range(4):
        z = k * 0.5; cyl(0.06 * math.sin(k * 1.7), 0.05 * math.cos(k * 1.3), z, 0.26 - 0.03 * k, 0.55, 'trunk')
    for (x, y, z, r) in ((0, 0, 2.3, 1.15), (0.75, -0.35, 1.7, 0.6), (-0.7, 0.3, 1.9, 0.55)):
        if r < 1: cyl(x * 0.5, y * 0.5, 1.1, 0.08, z - 1.1, 'trunk')
        ball(x, y, z, r, r, r * 0.45, 'cap')
        for j in range(5):
            a = j * 1.26 + r; ball(x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55, z + r * 0.3, r * 0.12, r * 0.12, r * 0.06, 'capdot')
def crystals():
    for k, (x, y, hgt) in enumerate(((0, 0, 1.0), (0.28, -0.1, 0.6), (-0.22, 0.15, 0.7), (0.1, 0.3, 0.45))):
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.15, depth=hgt, location=(x, y, hgt / 2), rotation=(R(10 * (k - 1.5)), R(7 * k), 0)); put(bpy.context.object, ('r0', 'r1', 'r2', 'r0')[k])
    rocks(0, 0, 3, 0.35, 0.14)

# little plants and lamps (layout decor/lamps); they block walking in the game
def plant(kind, c):
    col = 'r%d' % c if THEME == 'scifi' else CLAY
    leaf = 'shrub' if THEME == 'scifi' else CLAY
    if kind == 'flower':
        for k in range(3):
            a = k * 2.1; x, y = 0.12 * math.cos(a), 0.12 * math.sin(a); h = 0.3 + 0.1 * k
            cyl(x, y, 0, 0.015, h, leaf); ball(x, y, h, 0.07, 0.07, 0.05, col)
        ball(0, 0, 0.05, 0.16, 0.16, 0.06, leaf)
    elif kind == 'shroom':
        for (x, y, h, r) in ((0, 0, 0.32, 0.16), (0.14, 0.08, 0.2, 0.1), (-0.1, 0.12, 0.16, 0.08)):
            cyl(x, y, 0, r * 0.35, h, CLAY); ball(x, y, h, r, r, r * 0.55, col)
    elif kind == 'succulent':
        for k in range(7):
            a = k * 0.9; bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.05, depth=0.32, location=(0.06 * math.cos(a), 0.06 * math.sin(a), 0.14), rotation=(R(28) * math.cos(a), R(28) * math.sin(a), 0)); put(bpy.context.object, leaf, True)
        ball(0, 0, 0.3, 0.04, 0.04, 0.04, col)
    else:  # orb: a glowing bulb plant
        cyl(0, 0, 0, 0.02, 0.4, leaf); ball(0, 0, 0.45, 0.11, 0.11, 0.12, col); ball(0.1, 0.05, 0.08, 0.1, 0.08, 0.06, leaf); ball(-0.08, -0.06, 0.07, 0.09, 0.07, 0.05, leaf)
def scale_all(f):
    for o in bpy.context.scene.objects:
        if o.type == 'MESH': o.location = o.location * f; o.scale = o.scale * f
def lamp():
    rbox(-0.12, -0.12, 0, 0.12, 0.12, 0.08, 'panel' if THEME == 'scifi' else CLAY, 0.02)
    cyl(0, 0, 0.08, 0.035, 1.25, 'panel' if THEME == 'scifi' else CLAY)
    ball(0, 0, 1.42, 0.14, 0.14, 0.14, 'lampglow' if THEME == 'scifi' else CLAY); ring(0, 0, 1.33, 0.12, 0.12, 0.025, 'panel' if THEME == 'scifi' else CLAY)
def beacon(up):
    rbox(-0.2, -0.2, 0, 0.2, 0.2, 0.12, 'panel', 0.03); cyl(0, 0, 0.12, 0.05, 0.85, 'panel')
    rbox(-0.24, -0.2, 0.95, 0.24, 0.2, 1.35, CLAY, 0.08)                                # little robot head
    ball(-0.25, -0.06, 1.17, 0.02, 0.07, 0.07, 'glow' if up else 'dark'); ball(-0.25, 0.08, 1.17, 0.02, 0.07, 0.07, 'glow' if up else 'dark')
    cyl(0, 0, 1.35, 0.02, 0.3, 'panel'); ball(0, 0, 1.7, 0.08, 0.08, 0.08, 'beacon' if up else 'off')
def pod():
    rbox(-0.55, -0.45, 0, 0.55, 0.45, 0.85, CLAY, 0.1)
    for x in (-0.3, 0.3): rbox(x - 0.06, -0.47, 0.02, x + 0.06, 0.47, 0.83, 'panel', 0.02)
    rbox(-0.18, -0.48, 0.35, 0.18, -0.44, 0.55, 'glow', 0.02)

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
def bed():
    ps = L['garden']['plot']; h = ps / 2
    if THEME == 'scifi':
        rbox(-h, -h, -0.02, h, h, 0.2, 'wood', 0.04); box(-h + 0.09, -h + 0.09, 0.2, h - 0.09, h - 0.09, 0.22, 'soil')
    else:
        box(-h, -h, -0.02, h, h, 0.14, (0.70, 0.68, 0.65))
        for r in range(3): box(-h + 0.1, -h + 0.12 + r * 0.4, 0.14, h - 0.1, -h + 0.3 + r * 0.4, 0.2, (0.70, 0.68, 0.65))
def alien_crop(c, st):
    # leafy rosette that grows, then glowing crystal buds in the crop's own colour
    n = (4, 7, 9)[st]; L0 = (0.18, 0.32, 0.42)[st]
    for k in range(n):
        a = k * 2.4; bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.07 + 0.02 * st, depth=L0, location=(0.08 * math.cos(a), 0.08 * math.sin(a), 0.22 + L0 / 2), rotation=(R(35) * math.cos(a), R(35) * math.sin(a), 0)); put(bpy.context.object, 'leaf', True)
    if st >= 1:
        for k in range(1 if st == 1 else 5):
            a = k * 1.3 + 0.4; d = 0 if k == 0 else 0.18; hgt = (0.22 if st == 1 else 0.34) - 0.05 * (k > 0)
            bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.06 + 0.03 * (st == 2), depth=hgt, location=(d * math.cos(a), d * math.sin(a), 0.3 + hgt / 2), rotation=(R(12) * math.cos(a) * (k > 0), R(12) * math.sin(a) * (k > 0), 0))
            put(bpy.context.object, 'c_' + c)
def wet():
    h = L['garden']['plot'] / 2 - 0.1
    box(-h, -h, 0.22, h, h, 0.235, WET) if THEME == 'scifi' else box(-h, -h, 0.15, h, h, 0.21, WET)
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

CS = THEME == 'castle'
if CS: exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'castle_world.py')).read())
anchors = {}
mode = sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else 'all'
S = L['size']; centre = (S / 2, S / 2, 1.6)
if mode in ('all', 'scene'):
    for part, fn in (('ground', ground_castle if CS else ground_scifi if THEME == 'scifi' else ground_scene), ('house', castle_scene if CS else dome_scene if THEME == 'scifi' else house_scene)):
        sc, cam = reset(W, H, W / PPM, centre); fn()
        sc.render.filepath = os.path.join(OUT, part + '.png'); bpy.ops.render.render(write_still=True)
    o, ax, ay, az = (project(sc, cam, p) for p in ((0, 0, 0), (1, 0, 0), (0, 1, 0), (0, 0, 1)))
    json.dump({'size': [W, H], 'ppm': PPM, 'origin': o, 'ex': [ax[0] - o[0], ax[1] - o[1]], 'ey': [ay[0] - o[0], ay[1] - o[1]], 'ez': [az[0] - o[0], az[1] - o[1]]},
              open(os.path.join(OUT, 'camera.json'), 'w'), indent=1)
if mode in ('all', 'sprites'):
    sf = THEME == 'scifi'
    anchors['tree'] = sprite('tree', c_tree if CS else alien_tree if sf else tree, 4.6)
    anchors['bush'] = sprite('bush', c_crystals if CS else crystals if sf else bush, 2.0)
    anchors['mailbox_up'] = sprite('mailbox_up', lambda: c_mailbox(True) if CS else beacon(True) if sf else mailbox(True), 2.4)
    anchors['mailbox'] = sprite('mailbox', lambda: c_mailbox(False) if CS else beacon(False) if sf else mailbox(False), 2.4)
    anchors['crate'] = sprite('crate', c_crate if CS else pod if sf else crate, 2.0)
    anchors['wet'] = sprite('wet', c_wet if CS else wet, 2.0)
    anchors['bed'] = sprite('bed', c_bed if CS else bed, 2.0)
    anchors['lamp'] = sprite('lamp', c_lamp if CS else lamp, 2.0)
    for kind in ('flower', 'shroom', 'succulent', 'orb'):
        for c in range(5): anchors['%s_%d' % (kind, c)] = sprite('%s_%d' % (kind, c), lambda kind=kind, c=c: ((c_plant if CS else plant)(kind, c), scale_all(1.7)), 1.9)
    for c, f in CROPS.items():
        for st in range(3):
            build = (lambda c=c, st=st: veg(c, st)) if CS else (lambda c=c, st=st: alien_crop(c, st)) if sf else (lambda f=f, st=st: f(st))
            anchors['%s_%d' % (c, st)] = sprite('%s_%d' % (c, st), build, 2.0)
    TINT[0] = 'crystal' if sf else None
    for k, n in enumerate(FISH):
        if CS: TINT[0] = FISH_TINT[n]
        anchors['fish_' + n] = sprite('fish_' + n, lambda k=k: fish(k), 2.2, 160, side=True)
    TINT[0] = None
    json.dump(anchors, open(os.path.join(OUT, 'anchors.json'), 'w'), indent=1)
