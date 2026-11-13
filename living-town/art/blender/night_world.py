# Night Forest world (THEME=night), after Hazel's pick: the same floating island at night, teal grass,
# glowing blue blossom trees, glowing mushrooms, fireflies, a moonlit pond. Four houses the family picks
# from: stump, shroom (mushroom), willow (treehouse), moon (crystal cottage). Everything smooth: Hazel says no bumps.
# Loaded by homestead.py with exec() AFTER castle_world.py, reusing its helpers (leafy, veg, c_bed, ...).
from mathutils import Vector, Quaternion
CASTLE.update({
    'dirt': ((0.30, 0.20, 0.26), 0, 0, None, 0), 'cream': ((0.80, 0.78, 0.92), 0, 0, None, 0), 'gold': ((0.95, 0.74, 0.40), 0, 0.85, None, 0),
    'water': ((0.10, 0.25, 0.70), 0.6, 0, None, 0), 'leaf': ((0.04, 0.24, 0.26), 0, 0, None, 0), 'leaf2': ((0.07, 0.36, 0.38), 0, 0, None, 0),
    'leaf3': ((0.13, 0.50, 0.47), 0, 0, None, 0), 'leafdark': ((0.02, 0.07, 0.11), 0, 0, None, 0),
    'blossom': ((0.45, 0.68, 1.0), 1.3, 0, None, 0), 'trunk': ((0.36, 0.24, 0.27), 0, 0, None, 0),
    'crystal': ((0.58, 0.45, 1.0), 1.3, 0, None, 0), 'crystal1': ((1.0, 0.50, 0.88), 1.3, 0, None, 0), 'crystal2': ((0.40, 0.75, 1.0), 1.3, 0, None, 0),
    'pad': ((0.12, 0.40, 0.34), 0, 0, None, 0), 'lotus': ((1.0, 0.55, 0.92), 0.9, 0, None, 0),
    'cloud': ((0.30, 0.30, 0.66), 0.45, 0, None, 0), 'cloud2': ((0.42, 0.30, 0.70), 0.4, 0, None, 0), 'mail': ((0.45, 0.36, 0.88), 0, 0, None, 0),
    'wooddark': ((0.26, 0.16, 0.18), 0, 0, None, 0), 'path': ((0.60, 0.58, 0.80), 0, 0, None, 0), 'falls': ((0.45, 0.68, 1.0), 0.9, 0, None, 0),
    'flag': ((0.90, 0.60, 1.0), 0, 0, None, 0), 'lampglow': ((1.0, 0.80, 0.45), 3.0, 0, None, 0),
    'f0': ((0.45, 0.62, 1.0), 1.1, 0, None, 0), 'f1': ((0.78, 0.50, 1.0), 1.1, 0, None, 0), 'f2': ((0.88, 0.94, 1.0), 0.9, 0, None, 0),
    'f3': ((1.0, 0.86, 0.45), 1.1, 0, None, 0), 'f4': ((1.0, 0.55, 0.88), 1.0, 0, None, 0),
    'window': ((1.0, 0.76, 0.36), 2.2, 0, None, 0), 'door': ((0.55, 0.34, 0.24), 0, 0, None, 0), 'doorframe': ((0.36, 0.22, 0.18), 0, 0, None, 0),
    'stumprim': ((0.78, 0.58, 0.42), 0, 0, None, 0), 'stalk': ((0.94, 0.88, 0.80), 0, 0, None, 0), 'cap': ((0.56, 0.30, 0.88), 0, 0, None, 0),
    'capspot': ((1.0, 0.96, 1.0), 0.6, 0, None, 0), 'willow': ((0.16, 0.42, 0.95), 0.3, 0, None, 0), 'willow2': ((0.22, 0.50, 1.0), 0.35, 0, None, 0),
    'willow3': ((0.32, 0.60, 0.98), 0.45, 0, None, 0), 'willowdark': ((0.05, 0.12, 0.35), 0.2, 0, None, 0),
    'cabin': ((0.58, 0.40, 0.42), 0, 0, None, 0), 'roofn': ((0.34, 0.30, 0.78), 0, 0, None, 0),
    'silver': ((0.74, 0.76, 0.92), 0, 0.45, None, 0), 'moonwall': ((0.88, 0.86, 0.97), 0, 0, None, 0), 'moonglow': ((1.0, 0.92, 0.58), 2.2, 0, None, 0),
    'nightglass': ((0.10, 0.12, 0.34), 0.3, 0, None, 0), 'firefly': ((1.0, 0.92, 0.45), 4.0, 0, None, 0),
    'glowcap': ((0.55, 0.38, 1.0), 0.9, 0, None, 0), 'glowcap2': ((0.25, 0.70, 1.0), 0.9, 0, None, 0), 'glowcap3': ((1.0, 0.40, 0.80), 0.9, 0, None, 0),
})
TEXTINT = {'grass': (0.17, 0.32, 0.56), 'stone': (0.62, 0.58, 0.86), 'wood': (0.78, 0.62, 0.70), 'cliff': (0.50, 0.42, 0.68), 'soil': (0.9, 0.85, 0.95)}
COLMAP = {(0.38, 0.66, 0.2): 'leaf3', (0.08, 0.26, 0.07): 'leafdark'}
WILLOW = [False]   # while set, the shared leaves turn glowing blue (willow canopy)
SWAPW = {'leaf': 'willow', 'leaf2': 'willow2', 'leaf3': 'willow3', 'leafdark': 'willowdark'}

def mat(col, rough=0.6):
    if col == CLAY: col = TINT[0] or 'cream'
    if isinstance(col, tuple) and col in COLMAP: col = COLMAP[col]
    if WILLOW[0] and col in SWAPW: col = SWAPW[col]
    if col in _mats: return _mats[col]
    base, glow, metal, tex, tiles = CASTLE[col] if col in CASTLE else (col if isinstance(col, tuple) else (0.9, 0.9, 0.9), 0, 0, None, 0)
    m = bpy.data.materials.new(str(col)); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*base, 1); p.inputs['Roughness'].default_value = 0.3 if metal else (0.08 if col == 'water' else rough)
    p.inputs['Metallic'].default_value = metal
    if glow:
        p.inputs['Base Color'].default_value = (*[c * 0.5 for c in base], 1) if glow < 1 else (*[c * 0.2 for c in base], 1)
        p.inputs['Emission Color'].default_value = (*base, 1); p.inputs['Emission Strength'].default_value = glow
    if tex:   # the castle's painted textures, tinted for night
        g = nt.nodes.new('ShaderNodeNewGeometry'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (tiles, tiles, tiles)
        im = nt.nodes.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(os.path.join(TEX, tex + '.jpg'), check_existing=True)
        im.projection = 'BOX'; im.projection_blend = 0.3
        nt.links.new(g.outputs['Position'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], im.inputs['Vector'])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
        nt.links.new(im.outputs['Color'], mx.inputs['A'])
        tint = TEXTINT.get(col, (1, 1, 1))
        if col == 'grass':   # soft light/dark patches, like moonlight through leaves
            n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 0.35; ramp = nt.nodes.new('ShaderNodeValToRGB')
            ramp.color_ramp.elements[0].color = (*[c * 0.62 for c in tint], 1); ramp.color_ramp.elements[1].color = (*tint, 1)
            nt.links.new(g.outputs['Position'], n.inputs['Vector']); nt.links.new(n.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], mx.inputs['B'])
        else: mx.inputs['B'].default_value = (*tint, 1)
        nt.links.new(mx.outputs['Result'], p.inputs['Base Color'])
    if col == 'boulder':
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 6; ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (0.26, 0.24, 0.40, 1); ramp.color_ramp.elements[1].color = (0.46, 0.44, 0.62, 1)
        nt.links.new(n.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    _mats[col] = m; return m

# ---------- night shapes (revolve, round_window, arched_door, steps, lantern... live in smooth_shapes.py) ----------
def shroom(x, y, z, s, col='glowcap', tilt=(0, 0)):
    st = revolve(x, y, z, [(0.09 * s, 0), (0.07 * s, 0.25 * s), (0.065 * s, 0.42 * s), (0.08 * s, 0.5 * s)], 'stalk', 20, 'st')
    cp = [(0.06 * s, 0), (0.24 * s, 0.01 * s), (0.27 * s, 0.06 * s), (0.22 * s, 0.17 * s), (0.12 * s, 0.25 * s), (0.001, 0.28 * s)]
    c = revolve(x, y, z + 0.44 * s, cp, col, 28, 'cp')
    for o in (st, c): o.rotation_euler = (R(tilt[0]), R(tilt[1]), 0)
    if s > 0.6:
        for k in range(4): on_profile(x, y, z + 0.44 * s, cp, k * 1.6 + 0.4, 0.55 + 0.1 * (k % 2), 0.03 * s, 0.008 * s, 'capspot', 0.004)
def roots(cx, cy, r, angles, size=0.6, col='trunk'):
    for a in angles:
        a = R(a); o = ball(cx + math.cos(a) * (r + size * 0.15), cy + math.sin(a) * (r + size * 0.15), 0.05, size, size * 0.42, size * 0.5, col); o.rotation_euler = (0, R(-12), a)
def glow_bed(x, y):   # a few glowing flowers in a clump
    leafy([(x, y, 0.12, 0.2)], ls=0.4)
    for j in range(5): flower_dot(x + 0.17 * math.cos(j * 1.3), y + 0.17 * math.sin(j * 1.3), (0, 1, 4, 0, 2)[j], 1.6)

# ---------- the four houses (all inside the footprint x 3..8.5, y 13..17.5, door facing +x at y 15.25) ----------
def stump_scene():
    h = L['house']; x1 = h['x1']; dy = h['door'][1]; cx, cy, r = 6.15, dy, 2.25
    prof = [(r + 0.5, 0.0), (r + 0.22, 0.25), (r + 0.06, 0.6), (r, 1.2), (r - 0.04, 2.4), (r, 3.2), (r + 0.06, 3.45), (r - 0.06, 3.55), (r - 0.3, 3.5), (r - 0.34, 3.2), (0.001, 3.15)]
    revolve(cx, cy, 0, prof, 'trunk', 72, 'stump')
    ring(cx, cy, 3.5, r - 0.15, r - 0.15, 0.11, 'stumprim')
    roots(cx, cy, r, (70, 130, 190, 245, 300), 0.7)
    for (a, z) in ((-62, 1.35), (-28, 2.45), (-100, 2.3), (25, 2.5)): round_window(cx, cy, z, R(a), r + 0.01, 0.3)
    arched_door(x1 - 0.05, dy); steps(x1 + 0.05, dy, col='path')
    lantern(x1 + 0.05, dy - 0.75, 1.75); box(x1 - 0.1, dy - 0.77, 2.05, x1 + 0.08, dy - 0.73, 2.08, 'wooddark')
    # a little branch with leaves and glowing mushrooms on the rim
    leafy([(cx - 1.3, cy + 1.3, 3.65, 0.5), (cx - 0.7, cy + 1.75, 3.6, 0.38), (cx - 1.75, cy + 0.6, 3.6, 0.36)], ls=0.5)
    for (bx, by) in ((cx - 1.0, cy + 1.0), (cx - 1.6, cy + 1.1), (cx - 0.6, cy + 1.6)): flower_dot(bx, by, 3.95, 0) if False else [ball(bx + 0.06 * math.cos(j * 1.256), by + 0.06 * math.sin(j * 1.256), 4.05, 0.05, 0.05, 0.05, 'blossom') for j in range(5)]
    shroom(cx + 1.1, cy - 1.55, 3.42, 0.9, 'glowcap3'); shroom(cx + 1.45, cy - 1.0, 3.42, 0.6, 'glowcap')
    for (a, z, s, c) in ((-80, 0.4, 0.9, 'glowcap'), (-45, 0.32, 0.7, 'glowcap2'), (40, 0.3, 0.8, 'glowcap3')):
        shroom(cx + math.cos(R(a)) * (r + 0.35), cy + math.sin(R(a)) * (r + 0.35), 0, s, c)
    glow_bed(x1 + 0.1, dy + 1.05); glow_bed(x1 - 0.3, dy - 1.35)

def shroom_scene():
    h = L['house']; x1 = h['x1']; dy = h['door'][1]; cx, cy = 6.3, dy
    revolve(cx, cy, 0, [(2.1, 0), (2.0, 0.3), (1.88, 1.2), (1.82, 2.2), (1.9, 2.65), (1.3, 2.85)], 'stalk', 72, 'stalk')
    z0, Rc = 2.5, 2.7
    cp = [(1.2, 0), (Rc * 0.86, 0.02), (Rc, 0.2), (Rc * 0.99, 0.48), (Rc * 0.88, 1.0), (Rc * 0.62, 1.62), (Rc * 0.3, 1.98), (0.001, 2.08)]
    revolve(cx, cy, z0, cp, 'cap', 80, 'cap')
    ring(cx, cy, z0 + 0.12, Rc * 0.94, Rc * 0.94, 0.12, 'cap')   # soft rolled rim
    for k, (a, t, s) in enumerate(((-45, 0.45, 0.42), (-5, 0.4, 0.34), (-90, 0.42, 0.36), (-70, 0.72, 0.3), (-20, 0.7, 0.28), (25, 0.5, 0.3), (-130, 0.55, 0.32),
                                   (-45, 0.88, 0.22), (60, 0.62, 0.3), (180, 0.6, 0.35), (120, 0.45, 0.38), (-160, 0.82, 0.25))):
        on_profile(cx, cy, z0, cp, R(a), t, s, 0.05, 'capspot', 0.01)
    for (a, z) in ((-58, 1.3), (-25, 1.95), (-100, 1.75), (30, 1.8)): round_window(cx, cy, z, R(a), 1.85, 0.27)
    arched_door(x1 - 0.12, dy, h=1.15); steps(x1, dy, col='path')
    shroom(cx - 0.9, cy + 0.9, z0 + 1.78, 0.9, 'glowcap')   # a tiny mushroom chimney
    lantern(x1 + 0.0, dy + 0.75, 1.65); box(x1 - 0.18, dy + 0.73, 1.95, x1 + 0.03, dy + 0.77, 1.98, 'wooddark')
    for (a, s, c) in ((-80, 0.9, 'glowcap2'), (-40, 0.7, 'glowcap3'), (35, 0.8, 'glowcap'), (-120, 0.75, 'glowcap3')):
        shroom(cx + math.cos(R(a)) * 2.3, cy + math.sin(R(a)) * 2.3, 0, s, c)
    glow_bed(x1 + 0.1, dy - 1.05); glow_bed(x1 - 0.2, dy + 1.45)

def willow_scene():
    h = L['house']; x1 = h['x1']; dy = h['door'][1]; tx, ty = 5.2, 15.7; px, py, pr, pz = 5.55, 15.35, 2.05, 2.75
    revolve(tx, ty, 0, [(1.35, 0), (1.0, 0.35), (0.78, 1.1), (0.72, 2.2), (0.8, 2.8), (0.72, 4.6), (0.6, 6.4), (0.001, 6.9)], 'trunk', 48, 'trunk')
    roots(tx, ty, 0.9, (40, 110, 180, 250, 310), 0.75)
    for (a, tilt) in ((30, 55), (150, 50), (260, 50), (-30, 45)):   # branches out into the canopy
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.14, depth=2.0, location=(tx + 0.6 * math.cos(R(a)), ty + 0.6 * math.sin(R(a)), 6.2), rotation=(R(tilt) * math.sin(R(a)), -R(tilt) * math.cos(R(a)), 0)); put(bpy.context.object, 'trunk', True)
    # platform with a rail, and a round cabin with a pointy roof
    cyl(px, py, pz - 0.18, pr, 0.2, 'wood', 64); ring(px, py, pz - 0.08, pr, pr, 0.09, 'wooddark')
    for k in range(18):
        a = 2 * math.pi * k / 18
        if -1.15 < a - 2 * math.pi * (k > 9) < -0.35: continue   # opening where the stairs come up
        cyl(px + math.cos(a) * (pr - 0.08), py + math.sin(a) * (pr - 0.08), pz, 0.04, 0.55, 'wooddark', 10)
    ring(px, py, pz + 0.55, pr - 0.08, pr - 0.08, 0.045, 'wooddark')
    cx, cy = 5.3, 15.55
    revolve(cx, cy, pz, [(1.2, 0), (1.2, 1.55), (1.25, 1.6)], 'cabin', 56, 'cabin')
    revolve(cx, cy, pz + 1.55, [(1.6, 0), (1.45, 0.18), (1.0, 0.6), (0.45, 1.1), (0.001, 1.45)], 'roofn', 56, 'roof')
    ball(cx, cy, pz + 3.05, 0.09, 0.09, 0.09, 'gold')
    for (a, z) in ((-75, pz + 0.85), (-10, pz + 0.85)): round_window(cx, cy, z, R(a), 1.21, 0.24)
    a = R(-42); dx, dyy = cx + math.cos(a) * 1.2, cy + math.sin(a) * 1.2
    o = box(-0.1, -0.36, 0, 0.08, 0.36, 1.1, 'door'); o.location = (dx, dyy, pz); o.rotation_euler = (0, 0, a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.36, depth=0.18, location=(dx, dyy, pz + 1.1), rotation=(0, R(90), a)); put(bpy.context.object, 'door')
    ball(dx + math.cos(a) * 0.1 - math.sin(a) * 0.2, dyy + math.sin(a) * 0.1 + math.cos(a) * 0.2, pz + 0.6, 0.04, 0.04, 0.04, 'gold')
    lantern(px + 1.5, py - 1.2, pz + 0.6, 0.9)
    # spiral stairs from the garden path (by the door spot) round the front up to the platform
    n = 15; sr = pr + 0.42
    for k in range(n):
        t = k / (n - 1); ang = R(8 - 70 * t); z = 0.12 + (pz - 0.2) * t
        sx, sy = px + math.cos(ang) * sr, py + math.sin(ang) * sr
        o = rbox(-0.32, -0.22, -0.06, 0.32, 0.22, 0.06, 'wood', 0.03); o.location = (sx, sy, z); o.rotation_euler = (0, 0, ang)
        if k % 2 == 0: cyl(sx + math.cos(ang) * 0.3, sy + math.sin(ang) * 0.3, z - 0.06, 0.03, 0.55, 'wooddark', 10)
    lantern(px + math.cos(R(8)) * (sr + 0.35), py + math.sin(R(8)) * (sr + 0.35) + 0.45, 0.0, 1.3)
    # big glowing blue willow canopy, with long hanging fronds made of the same smooth leaves
    WILLOW[0] = True
    blobs = tuple((x, y, z + 0.45, r) for (x, y, z, r) in ((tx - 0.2, ty + 0.2, 6.75, 1.6), (tx + 0.6, ty - 0.4, 6.35, 1.2), (tx - 1.05, ty + 0.7, 6.4, 1.3), (tx + 0.3, ty + 0.9, 7.0, 1.0), (tx - 0.3, ty - 0.2, 7.1, 0.95), (tx - 1.0, ty - 0.5, 6.4, 1.0), (tx + 0.9, ty + 0.6, 6.5, 1.0)))
    leafy(blobs, dens=420)
    import random as _r; rr = _r.Random(11); col = bpy.context.scene.collection; lm = _leaf_meshes
    for k in range(46):
        a = k * 2.39996; rad = 2.2 + rr.uniform(0, 0.6); top = 6.6 - (rad - 2.2) * 0.6 + rr.uniform(-0.2, 0.2)
        front = math.cos(a + R(45)) > 0.55   # camera side: shorter, so the cabin shows
        Lf = rr.uniform(0.9, 1.5) if front else rr.uniform(2.2, 3.6)
        fx, fy = tx + math.cos(a) * rad, ty + math.sin(a) * rad
        m = int(Lf / 0.13)
        for j in range(m):
            zz = top - j * 0.13; sw = 0.04 * math.sin(j * 0.7)
            for side in (-1, 1):
                o = bpy.data.objects.new('leaf', lm[(j + side) % 3]); col.objects.link(o)
                o.location = (fx + side * 0.05 * math.cos(a + 1.57) + sw, fy + side * 0.05 * math.sin(a + 1.57), zz)
                o.rotation_euler = (0, R(70 + 15 * side), a + side * 0.6); sc = 0.85 - 0.3 * j / m; o.scale = (sc, sc, sc)
    WILLOW[0] = False
    for (x, y, s, c) in ((x1 - 0.4, dy + 1.4, 0.9, 'glowcap'), (tx - 1.2, ty - 1.3, 0.8, 'glowcap3'), (x1 - 0.2, dy - 1.5, 0.7, 'glowcap2')): shroom(x, y, 0, s, c)
    glow_bed(tx + 0.4, ty - 1.4)

def moon_scene():
    h = L['house']; x1 = h['x1']; dy = h['door'][1]; cx, cy, r = 6.2, dy, 2.1
    revolve(cx, cy, 0, [(r + 0.3, 0), (r + 0.3, 0.3), (r - 0.05, 0.33)], 'stone', 64, 'base')
    revolve(cx, cy, 0.3, [(r, 0), (r, 2.0), (r + 0.1, 2.05), (r + 0.1, 2.18)], 'moonwall', 72, 'wall')
    z0, dr, dh = 2.15, r + 0.05, 2.0
    revolve(cx, cy, z0, [(dr * math.cos(R(t)), dh * math.sin(R(t))) for t in range(0, 91, 6)], 'silver', 72, 'dome')
    ring(cx, cy, z0 + 0.03, dr + 0.04, dr + 0.04, 0.06, 'gold')
    for k in range(8):   # smooth gold ribs over the dome
        o = ring(cx, cy, z0, dr + 0.005, dh + 0.005, 0.035, 'gold'); o.scale = (dr + 0.01, dh + 0.01, 1); o.rotation_euler = (R(90), 0, k * math.pi / 8)
    revolve(cx, cy, z0 + dh - 0.1, [(0.42, 0), (0.42, 0.45), (0.5, 0.5), (0.5, 0.58)], 'moonglow', 32, 'cupola')
    revolve(cx, cy, z0 + dh + 0.48, [(0.5 * math.cos(R(t)), 0.4 * math.sin(R(t))) for t in range(0, 91, 10)], 'silver', 32, 'cap')
    cyl(cx, cy, z0 + dh + 0.85, 0.025, 0.45, 'gold')
    bm = bmesh.new(); pts = []
    for k in range(10):   # a flat glowing star on top
        rad = 0.26 if k % 2 == 0 else 0.11; a = R(90 + 36 * k); pts.append(bm.verts.new((rad * math.cos(a), 0, rad * math.sin(a))))
    bm.faces.new(pts); me = bpy.data.meshes.new('star'); bm.to_mesh(me); st = bpy.data.objects.new('star', me); bpy.context.scene.collection.objects.link(st)
    st.location = (cx, cy, z0 + dh + 1.45); st.rotation_euler = (0, 0, R(45)); st.modifiers.new('s', 'SOLIDIFY').thickness = 0.06; st.data.materials.append(mat('moonglow'))
    # a big crescent-moon window and arched windows
    a = R(-58); wx, wy = cx + math.cos(a) * r, cy + math.sin(a) * r
    disc(wx, wy, 1.55, a, 0.58, 'silver', 0.1); disc(wx + math.cos(a) * 0.03, wy + math.sin(a) * 0.03, 1.55, a, 0.5, 'nightglass', 0.1)
    b = a + 1.5708; disc(wx + math.cos(a) * 0.06, wy + math.sin(a) * 0.06, 1.55, a, 0.4, 'moonglow', 0.05)
    disc(wx + math.cos(a) * 0.08 + math.cos(b) * 0.2, wy + math.sin(a) * 0.08 + math.sin(b) * 0.2, 1.62, a, 0.36, 'nightglass', 0.05)
    for (aa, z) in ((-18, 1.0), (-100, 1.0), (28, 1.0)): arch_window(cx, cy, z, R(aa), r, 0.36, 0.6)
    arched_door(x1 - 0.2, dy, z=0.3, frame='silver', col='mail'); steps(x1 - 0.1, dy, col='stone')
    for s in (-1, 1): lantern(x1 + 0.0, dy + s * 0.75, 1.7); box(x1 - 0.3, dy + s * 0.75 - 0.02, 2.0, x1 + 0.03, dy + s * 0.75 + 0.02, 2.03, 'silver')
    for k, (aa, d, hgt, cc) in enumerate(((-75, 2.45, 0.9, 'crystal'), (-40, 2.5, 0.6, 'crystal2'), (-128, 2.4, 0.75, 'crystal1'), (40, 2.45, 0.8, 'crystal'), (120, 2.4, 1.0, 'crystal2'), (165, 2.4, 0.7, 'crystal1'))):
        x, y = cx + math.cos(R(aa)) * d, cy + math.sin(R(aa)) * d
        crystal(x, y, 0.13, hgt, 10 * ((k % 3) - 1), 12, cc); crystal(x + 0.18, y - 0.1, 0.09, hgt * 0.6, 20, -15, cc)
    glow_bed(x1 + 0.1, dy - 1.15); glow_bed(x1 + 0.1, dy + 1.15)

HOUSES = (('stump', stump_scene), ('shroom', shroom_scene), ('willow', willow_scene), ('moon', moon_scene))
castle_scene = stump_scene

# ---------- small things for the night ----------
_ground_castle = ground_castle
def ground_castle():
    _ground_castle()
    import random as _r; rr = _r.Random(9); S = L['size']
    for k in range(70):   # fireflies drifting just above the grass
        x, y = rr.uniform(0.5, S - 0.5), rr.uniform(0.5, S - 0.5)
        if clear_spot(x, y, 0.3): ball(x, y, rr.uniform(0.25, 0.9), 0.035, 0.035, 0.035, 'firefly')
    for k in range(26):   # little glowing mushroom patches round the edges
        x, y = rr.uniform(0.6, S - 0.6), rr.uniform(0.6, S - 0.6)
        if min(x, y, S - x, S - y) < 2.2 and clear_spot(x, y, 0.4):
            for j in range(rr.randint(2, 4)): shroom(x + rr.uniform(-0.3, 0.3), y + rr.uniform(-0.3, 0.3), 0, rr.uniform(0.35, 0.6), rr.choice(('glowcap', 'glowcap2', 'glowcap3')))
def c_tree():   # round tree, deep teal leaves, glowing blue blossoms
    import random as _r; rr = _r.Random(2)
    cyl(0, 0, 0, 0.2, 1.5, 'trunk'); revolve(0, 0, 0, [(0.42, 0), (0.26, 0.2), (0.2, 0.5)], 'trunk', 24)
    for (a, tilt) in ((0.4, 40), (2.6, 35), (4.4, 45)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.07, depth=0.8, location=(0.22 * math.cos(a), 0.22 * math.sin(a), 1.7), rotation=(R(tilt) * math.sin(a), -R(tilt) * math.cos(a), 0)); put(bpy.context.object, 'trunk', True)
    blobs = ((0, 0, 2.15, 1.05), (0.5, -0.35, 2.55, 0.7), (-0.55, 0.2, 2.5, 0.68), (0.1, 0.45, 2.8, 0.62), (0.15, -0.2, 3.0, 0.6))
    leafy(blobs)
    for k in range(30):
        a = rr.uniform(-2.2, 0.6); z = rr.uniform(1.7, 3.2); rad = 1.08 - abs(z - 2.4) * 0.35
        x, y = math.cos(a) * rad, math.sin(a) * rad
        for j in range(5): ball(x + 0.06 * math.cos(j * 1.256), y + 0.06 * math.sin(j * 1.256), z, 0.05, 0.05, 0.05, 'blossom')
        ball(x, y, z, 0.03, 0.03, 0.03, 'f2')
    for k in range(6): ball(rr.uniform(-1.3, 1.3), rr.uniform(-1.3, 0.2), rr.uniform(1.0, 3.4), 0.035, 0.035, 0.035, 'firefly')
def c_crystals(scale=1.0, cols=('crystal', 'crystal1', 'crystal')):   # night bushes: glowing mushroom clusters
    if scale == 1.0:   # the bush sprite: a round leafy bush (same leaves as the trees), glowing blossoms, tiny mushrooms at its feet
        leafy([(0, 0, 0.42, 0.52), (0.32, -0.2, 0.32, 0.36), (-0.3, 0.18, 0.34, 0.38)], ls=0.6)
        import random as _r; rr = _r.Random(4)
        for k in range(9):
            a = rr.uniform(-2.4, 0.8); z = rr.uniform(0.3, 0.8); x, y = math.cos(a) * 0.5, math.sin(a) * 0.5
            for j in range(5): ball(x + 0.04 * math.cos(j * 1.256), y + 0.04 * math.sin(j * 1.256), z, 0.035, 0.035, 0.035, 'blossom')
        shroom(0.45, -0.45, 0, 0.55, 'glowcap3'); shroom(0.2, -0.6, 0, 0.4, 'glowcap2'); return
    m = {'crystal': 'glowcap', 'crystal1': 'glowcap3', 'crystal2': 'glowcap2'}
    for k, (x, y, s, tx, ty) in enumerate(((0, 0, 1.5, 0, 0), (0.3, -0.15, 1.0, 12, 18), (-0.28, 0.12, 1.1, -14, -16), (0.08, 0.32, 0.8, -20, 6), (-0.15, -0.3, 0.7, 18, -10))):
        shroom(x * scale, y * scale, 0, s * scale, m.get(cols[k % len(cols)], 'glowcap'), (tx, ty))
    leafy([(0.25 * scale, 0.2 * scale, 0.05, 0.22 * scale), (-0.3 * scale, -0.1 * scale, 0.05, 0.2 * scale)], ls=0.45 * max(scale, 0.5))
def c_lamp():   # a lantern on a curly wooden post
    revolve(0, 0, 0, [(0.13, 0), (0.1, 0.08), (0.045, 0.12), (0.04, 1.3)], 'wooddark', 20)
    o = ring(0.14, 0, 1.3, 0.14, 0.14, 0.03, 'wooddark'); o.rotation_euler = (R(90), 0, 0)
    lantern(0.28, 0, 1.0, 1.4)
