# Pirate Cove world (THEME=pirate): the home plot as a sunny sand island in a turquoise sea. Palm trees, a rope
# fence, tiki torches, shells and starfish in the sand, a little pier where the path leaves for town. Four houses
# the family picks from: shack (thatched beach shack), ship (a beached pirate ship), light (lighthouse), chest
# (a giant treasure chest). Ideas borrowed from Sean's Blacksteel Cove art (thatch, teal planks, barrels, lanterns),
# rebuilt smooth: Hazel says no bumps. Loaded by homestead.py with exec() AFTER castle_world.py and smooth_shapes.py.
PTEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'textures', 'pirate')
CASTLE.update({
    'grass': ((0.95, 0.82, 0.55), 0, 0, 'sand', 0.14), 'lawn': ((0.42, 0.72, 0.22), 0, 0, 'grass', 0.16),
    'sandwet': ((0.80, 0.64, 0.40), 0, 0, None, 0), 'dirt': ((0.86, 0.70, 0.44), 0, 0, None, 0),
    'planks': ((0.36, 0.70, 0.70), 0, 0, 'planks', 0.5), 'thatch': ((0.92, 0.72, 0.30), 0, 0, 'thatch', 0.42),
    'hull': ((0.55, 0.34, 0.20), 0, 0, 'wood', 0.6), 'deck': ((0.80, 0.60, 0.36), 0, 0, 'wood', 0.7),
    'cloud': ((0.97, 1.0, 1.0), 0.7, 0, None, 0), 'cloud2': ((0.72, 0.95, 0.96), 0.6, 0, None, 0),
    'water': ((0.05, 0.70, 0.80), 0.5, 0, None, 0), 'falls': ((0.60, 0.92, 1.0), 0.7, 0, None, 0),
    'cream': ((0.97, 0.94, 0.86), 0, 0, None, 0), 'white': ((0.98, 0.97, 0.94), 0, 0, None, 0), 'sail': ((0.99, 0.95, 0.84), 0, 0, None, 0),
    'path': ((0.70, 0.52, 0.34), 0, 0, None, 0), 'trunk': ((0.52, 0.37, 0.24), 0, 0, None, 0), 'coconut': ((0.42, 0.27, 0.16), 0, 0, None, 0),
    'leaf': ((0.09, 0.42, 0.15), 0, 0, None, 0), 'leaf2': ((0.18, 0.58, 0.19), 0, 0, None, 0), 'blossom': ((1.0, 0.26, 0.36), 0.12, 0, None, 0),
    'rope': ((0.88, 0.74, 0.48), 0, 0, None, 0), 'iron': ((0.30, 0.31, 0.36), 0, 0.5, None, 0), 'black': ((0.10, 0.10, 0.14), 0, 0, None, 0),
    'red': ((0.90, 0.17, 0.14), 0, 0, None, 0), 'flag': ((0.90, 0.17, 0.14), 0, 0, None, 0), 'mail': ((0.90, 0.17, 0.14), 0, 0, None, 0),
    'door': ((0.74, 0.38, 0.20), 0, 0, None, 0), 'doorframe': ((0.42, 0.25, 0.14), 0, 0, None, 0), 'window': ((1.0, 0.80, 0.42), 1.5, 0, None, 0),
    'wooddark': ((0.42, 0.25, 0.13), 0, 0, None, 0), 'bamboo': ((0.66, 0.50, 0.24), 0, 0, None, 0),
    'flame': ((1.0, 0.42, 0.08), 1.3, 0, None, 0), 'flame2': ((1.0, 0.78, 0.25), 1.6, 0, None, 0), 'lightglow': ((1.0, 0.94, 0.60), 3.0, 0, None, 0),
    'lampglow': ((1.0, 0.82, 0.45), 2.4, 0, None, 0), 'glass': ((0.45, 0.88, 0.80), 0.35, 0, None, 0),
    'shell': ((0.92, 0.46, 0.50), 0, 0, None, 0), 'shell2': ((0.86, 0.72, 0.52), 0, 0, None, 0), 'shell3': ((0.58, 0.46, 0.82), 0, 0, None, 0),
    'starfish': ((0.95, 0.40, 0.18), 0, 0, None, 0), 'pebble': ((0.60, 0.60, 0.64), 0, 0, None, 0), 'pearl': ((0.86, 0.84, 0.86), 0, 0, None, 0),
    'f0': ((1.0, 0.35, 0.60), 0.05, 0, None, 0), 'f1': ((1.0, 0.55, 0.15), 0.05, 0, None, 0), 'f2': ((1.0, 0.98, 0.95), 0, 0, None, 0),
    'f3': ((1.0, 0.85, 0.25), 0.05, 0, None, 0), 'f4': ((0.95, 0.22, 0.25), 0.05, 0, None, 0),
    'crystal': ((0.30, 0.85, 0.60), 0.5, 0, None, 0), 'crystal1': ((1.0, 0.35, 0.50), 0.5, 0, None, 0), 'crystal2': ((0.35, 0.60, 1.0), 0.5, 0, None, 0),
})
TEXTINT = {'thatch': (0.74, 0.60, 0.42), 'hull': (0.78, 0.60, 0.50), 'stone': (0.90, 0.86, 0.70)}

def mat(col, rough=0.6):
    if col == CLAY: col = TINT[0] or 'cream'
    if col in _mats: return _mats[col]
    base, glow, metal, tex, tiles = CASTLE[col] if col in CASTLE else (col if isinstance(col, tuple) else (0.9, 0.9, 0.9), 0, 0, None, 0)
    m = bpy.data.materials.new(str(col)); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*base, 1); p.inputs['Roughness'].default_value = 0.3 if metal else (0.08 if col in ('water', 'glass', 'pearl') else rough)
    p.inputs['Metallic'].default_value = metal
    if glow:
        p.inputs['Base Color'].default_value = (*[c * 0.5 for c in base], 1) if glow < 1 else (*[c * 0.2 for c in base], 1)
        p.inputs['Emission Color'].default_value = (*base, 1); p.inputs['Emission Strength'].default_value = glow
    if tex:   # painted textures: the pirate ones first, the castle's (wood, stone, soil, grass) otherwise
        g = nt.nodes.new('ShaderNodeNewGeometry'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (tiles, tiles, tiles)
        im = nt.nodes.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(os.path.join(PTEX if os.path.exists(os.path.join(PTEX, tex + '.jpg')) else TEX, tex + '.jpg'), check_existing=True)
        im.projection = 'BOX'; im.projection_blend = 0.3
        nt.links.new(g.outputs['Position'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], im.inputs['Vector'])
        if col in ('grass', 'lawn') or col in TEXTINT:
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
            nt.links.new(im.outputs['Color'], mx.inputs['A'])
            if col in TEXTINT: mx.inputs['B'].default_value = (*TEXTINT[col], 1)
            else:   # big soft light/dark patches, so the sand and lawn aren't one flat colour
                n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 0.35; ramp = nt.nodes.new('ShaderNodeValToRGB')
                lo, hi = ((0.82, 0.68, 0.50), (0.94, 0.84, 0.64)) if col == 'grass' else ((0.48, 0.60, 0.40), (0.72, 0.80, 0.58))
                if col == 'grass': mx.blend_type = 'MIX'; mx.inputs['Factor'].default_value = 0.45   # paler, softer sand than the painted texture
                ramp.color_ramp.elements[0].color = (*lo, 1); ramp.color_ramp.elements[1].color = (*hi, 1)
                nt.links.new(g.outputs['Position'], n.inputs['Vector']); nt.links.new(n.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], mx.inputs['B'])
            nt.links.new(mx.outputs['Result'], p.inputs['Base Color'])
        else: nt.links.new(im.outputs['Color'], p.inputs['Base Color'])
    if col == 'boulder':
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 6; ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (0.40, 0.37, 0.36, 1); ramp.color_ramp.elements[1].color = (0.66, 0.62, 0.57, 1)
        nt.links.new(n.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    _mats[col] = m; return m

# ---------- more smooth shapes ----------
def _obj(bm, name, col, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me)
    for f in me.polygons: f.use_smooth = smooth
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.data.materials.append(mat(col)); return o
def tube(path, col, n=12, name='tube'):
    # a smooth bendy tube through points (x, y, z, radius): palm trunks, ropes, ship rails
    bm = bmesh.new(); rings = []; U = None
    for i, (x, y, z, r) in enumerate(path):
        T = (Vector(path[min(i + 1, len(path) - 1)][:3]) - Vector(path[max(i - 1, 0)][:3])).normalized()
        if U is None: U = Vector((1, 0, 0)) if abs(T.x) < 0.8 else Vector((0, 1, 0))
        U = (U - T * T.dot(U)).normalized(); V = T.cross(U)
        rings.append([bm.verts.new(Vector((x, y, z)) + (U * math.cos(2 * math.pi * k / n) + V * math.sin(2 * math.pi * k / n)) * r) for k in range(n)])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(n): bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    return _obj(bm, name, col)
def rope(ax, ay, az, bx, by, bz, sag=0.1, r=0.022, col='rope'):
    return tube([(ax + (bx - ax) * t / 8, ay + (by - ay) * t / 8, az + (bz - az) * t / 8 - sag * math.sin(math.pi * t / 8), r) for t in range(9)], col, 8, 'rope')
def gable(ax, bx, ay, by, z0, z1, col, thick=0.22):
    # a pitched roof: ridge along x, soft thick edges
    bm = bmesh.new(); my = (ay + by) / 2
    v = [bm.verts.new(p) for p in ((ax, ay, z0), (ax, my, z1), (ax, by, z0), (bx, ay, z0), (bx, my, z1), (bx, by, z0))]
    bm.faces.new((v[0], v[3], v[4], v[1])); bm.faces.new((v[1], v[4], v[5], v[2]))
    o = _obj(bm, 'roof', col, False); s = o.modifiers.new('s', 'SOLIDIFY'); s.thickness = thick; s.offset = 0
    b = o.modifiers.new('b', 'BEVEL'); b.width = 0.07; b.segments = 3; return o
def prism(ax, bx, ay, by, z0, z1, col):
    bm = bmesh.new(); my = (ay + by) / 2
    v = [bm.verts.new(p) for p in ((ax, ay, z0), (ax, my, z1), (ax, by, z0), (bx, ay, z0), (bx, my, z1), (bx, by, z0))]
    for f in ((0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (0, 2, 5, 3)): bm.faces.new([v[k] for k in f])
    return _obj(bm, 'gable', col, False)
def barrel(x, y, z=0.0, s=1.0):
    revolve(x, y, z, [(0.2 * s, 0), (0.26 * s, 0.13 * s), (0.29 * s, 0.32 * s), (0.26 * s, 0.52 * s), (0.2 * s, 0.64 * s), (0.17 * s, 0.62 * s), (0.001, 0.62 * s)], 'hull', 24, 'barrel')
    for zz, rr in ((0.14, 0.265), (0.5, 0.265)): ring(x, y, z + zz * s, rr * s, rr * s, 0.018 * s, 'iron')
def skull(x, y, z, a, s=1.0):
    # a friendly little skull-and-crossbones badge facing outward at angle a
    ca, sa = math.cos(a), math.sin(a)
    for t in (-38, 38):
        o = rbox(-0.012, -0.3 * s, -0.035 * s, 0.012, 0.3 * s, 0.035 * s, 'white', 0.01); o.location = (x + ca * 0.01, y + sa * 0.01, z - 0.03 * s); o.rotation_euler = (R(t), 0, a)
    disc(x + ca * 0.02, y + sa * 0.02, z + 0.04 * s, a, 0.17 * s, 'white', 0.04)
    o = rbox(-0.02, -0.09 * s, -0.07 * s, 0.02, 0.09 * s, 0.05 * s, 'white', 0.015); o.location = (x + ca * 0.02, y + sa * 0.02, z - 0.11 * s); o.rotation_euler = (0, 0, a)
    for k in (-1, 1): disc(x + ca * 0.035 - sa * k * 0.065 * s, y + sa * 0.035 + ca * k * 0.065 * s, z + 0.045 * s, a, 0.042 * s, 'black', 0.03)
def hibiscus(x, y, z, s=1.0, col='blossom'):
    for j in range(5): ball(x + 0.06 * s * math.cos(j * 1.256), y + 0.06 * s * math.sin(j * 1.256), z, 0.05 * s, 0.05 * s, 0.05 * s, col)
    ball(x, y, z, 0.03 * s, 0.03 * s, 0.03 * s, 'f3')
def bush(x, y, s=1.0, n=7, seed=1):
    import random as _r; rr = _r.Random(seed)
    leafy([(x, y, 0.3 * s, 0.4 * s), (x + 0.28 * s, y - 0.18 * s, 0.24 * s, 0.28 * s), (x - 0.26 * s, y + 0.15 * s, 0.25 * s, 0.3 * s)], ls=0.55)
    for k in range(n):
        a = rr.uniform(-2.4, 0.8); z = rr.uniform(0.25, 0.62) * s
        hibiscus(x + math.cos(a) * 0.4 * s, y + math.sin(a) * 0.4 * s, z, 0.75, ('blossom', 'f0', 'f3')[k % 3])
def starfish(x, y, z, s=1.0, col='starfish', spin=0.0):
    for k in range(5):
        a = spin + k * 1.2566; ball(x + 0.07 * s * math.cos(a), y + 0.07 * s * math.sin(a), z, 0.085 * s, 0.034 * s, 0.022 * s, col).rotation_euler = (0, 0, a)
    ball(x, y, z + 0.004, 0.05 * s, 0.05 * s, 0.028 * s, col)
def seashell(x, y, z, s=1.0, col='shell'):
    ball(x, y, z + 0.02 * s, 0.06 * s, 0.045 * s, 0.035 * s, col); ball(x + 0.045 * s, y + 0.01 * s, z + 0.02 * s, 0.03 * s, 0.028 * s, 0.024 * s, col)

# ---------- palm tree: a smooth bent trunk, fronds made of rows of the same real leaves as every other tree ----------
def palm(h=3.05, lean=(0.45, -0.25), fronds=10, seed=3):
    import random as _r; rr = _r.Random(seed); col = bpy.context.scene.collection
    tube([(lean[0] * (i / 12) ** 2, lean[1] * (i / 12) ** 2, h * i / 12, 0.17 - 0.06 * i / 12 + 0.1 * (1 - i / 12) ** 6) for i in range(13)], 'trunk', 20, 'trunk')
    tx, ty = lean; ball(tx, ty, h, 0.17, 0.17, 0.15, 'trunk')
    for a in (0.2, 2.3, 4.4): ball(tx + 0.19 * math.cos(a), ty + 0.19 * math.sin(a), h - 0.17, 0.13, 0.13, 0.14, 'coconut')
    lm = [leaf_mesh('palmA', 0.56, 0.08), leaf_mesh('palmB', 0.5, 0.075), leaf_mesh('palmC', 0.6, 0.085)]
    for me, c in zip(lm, ((0.04, 0.27, 0.09), (0.08, 0.36, 0.10), (0.20, 0.46, 0.10))): me.materials.append(mat(c))
    for j in range(fronds):
        a = j * 2 * math.pi / fronds + rr.uniform(-0.15, 0.15); Lf = 1.75 + rr.uniform(-0.2, 0.2); up = 1.0 if j % 3 == 1 else rr.uniform(0.4, 0.62)
        m = 16; P = lambda t: Vector((tx + math.cos(a) * Lf * (t - 0.2 * t * t), ty + math.sin(a) * Lf * (t - 0.2 * t * t), h + 0.1 + Lf * (up * t - 0.95 * t * t)))
        tube([(*P(i / m), 0.03 * (1 - 0.75 * i / m)) for i in range(m + 1)], (0.04, 0.27, 0.09), 6, 'rib')
        for i in range(1, m + 1):
            t = i / m; p = P(t); T = (P(min(1, t + 0.03)) - P(t - 0.03)).normalized(); S = T.cross(Vector((0, 0, 1))).normalized()
            sc = 0.5 + 0.62 * math.sin(math.pi * (0.12 + 0.86 * t)) ** 0.8
            for side in (-1, 1):
                d = (S * side * 0.85 + T * 0.5 + Vector((0, 0, -0.42))).normalized()
                o = bpy.data.objects.new('leaf', lm[2 if up > 0.9 else (j + (i // 5)) % 2]); col.objects.link(o)
                o.location = p + d * 0.26 * sc; o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = d.to_track_quat('X', 'Z'); o.scale = (sc, sc, sc)

# ---------- a boat hull (the ship house and the rowboat on the beach) ----------
def hull(tf, Lh, Wm, depth, sheer, rake, col='hull', deck='deck', rail='red', M=18, N=22):
    # stern at x=0, bow toward -x, keel at z=0; tf(x, y, z) moves it into the world. Returns width and deck height along it.
    def station(t):
        w = max(0.02, Wm * (1 - t ** 2.4) ** 0.6 * (0.84 + 0.16 * min(1, t / 0.3))); zd = depth + sheer * (2 * t - 1) ** 2; pts = []
        for j in range(M + 1):
            th = math.pi * j / M; c, s = math.cos(th), math.sin(th); zf = 1 - s ** 0.5
            pts.append((-Lh * t - rake * t ** 4 * zf, w * abs(c) ** 0.5 * (1 if c >= 0 else -1), zd * zf))
        return pts, w, zd
    bm = bmesh.new(); st = [station(i / N) for i in range(N + 1)]; rings = [[bm.verts.new(tf(*p)) for p in s[0]] for s in st]
    for r0, r1 in zip(rings, rings[1:]):
        for j in range(M): bm.faces.new((r0[j], r1[j], r1[j + 1], r0[j + 1]))
    _obj(bm, 'hull', col)
    bm = bmesh.new(); bm.faces.new([bm.verts.new(tf(*p)) for p in st[0][0]]); _obj(bm, 'transom', col, False)
    bm = bmesh.new(); dk = [[bm.verts.new(tf(s[0][0][0] + 0.02, k * s[1] * 0.97, s[2] * 0.86)) for k in (1, -1)] for s in st]
    for d0, d1 in zip(dk, dk[1:]): bm.faces.new((d0[0], d0[1], d1[1], d1[0]))
    _obj(bm, 'deck', deck, False)
    for j in (0, M): tube([(*tf(*s[0][j]), 0.035 * Wm + 0.01) for s in st], rail, 10, 'rail')
    for j in (3, M - 3): tube([(*tf(*s[0][j]), 0.02 * Wm + 0.008) for s in st[:-1]], 'wooddark', 8, 'wale')
    return lambda t: station(t)[1:]

# ---------- the four houses (all inside the footprint x 3..8.5, y 13..17.5, door facing +x at y 15.25) ----------
def shack_scene():
    h = L['house']; x1 = h['x1']; dy = h['door'][1]; ax, bx, ay, by = 3.9, x1 - 0.1, dy - 1.8, dy + 1.8
    rbox(ax - 0.15, ay - 0.15, 0, bx + 0.15, by + 0.15, 0.3, 'stone', 0.06)
    box(ax, ay, 0.25, bx, by, 2.5, 'planks'); prism(ax + 0.02, bx - 0.02, ay, by, 2.5, 4.1, 'planks')
    for (x, y) in ((ax, ay), (bx, ay), (bx, by), (ax, by)): cyl(x, y, 0.2, 0.11, 2.35, 'hull', 16)
    box(ax - 0.05, ay - 0.05, 2.42, bx + 0.05, by + 0.05, 2.56, 'hull')
    gable(ax - 0.4, bx + 0.45, ay - 0.55, by + 0.55, 2.28, 4.32, 'thatch', 0.26)
    gable(ax - 0.3, bx + 0.35, dy - 1.2, dy + 1.2, 3.42, 4.47, 'thatch', 0.2)          # a second, shorter layer of thatch up top
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.14, depth=bx - ax + 1.2, location=((ax + bx) / 2, dy, 4.62), rotation=(0, R(90), 0)); put(bpy.context.object, 'hull', True)
    for x in (ax + 0.2, (ax + bx) / 2, bx - 0.1): ring(x, dy, 4.62, 0.16, 0.16, 0.03, 'rope').rotation_euler = (0, R(90), 0)
    rbox(ax + 0.5, by - 1.35, 2.6, ax + 1.2, by - 0.65, 4.95, 'stone', 0.05); rbox(ax + 0.42, by - 1.43, 4.9, ax + 1.28, by - 0.57, 5.08, 'stone', 0.04)
    arched_door(bx + 0.06, dy, z=0.3, w=0.42, h=1.05); steps(x1 + 0.05, dy, col='deck')
    for s in (-1, 1): lantern(bx + 0.16, dy + s * 0.95, 1.5); box(bx - 0.02, dy + s * 0.95 - 0.02, 1.8, bx + 0.2, dy + s * 0.95 + 0.02, 1.83, 'wooddark')
    # a red banner with a friendly skull over the door, hung from a rope-tied pole
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.04, depth=1.7, location=(bx + 0.1, dy, 3.2), rotation=(R(90), 0, 0)); put(bpy.context.object, 'hull', True)
    rbox(bx + 0.07, dy - 0.68, 2.3, bx + 0.11, dy + 0.68, 3.2, 'flag', 0.015); skull(bx + 0.11, dy, 2.78, 0, 1.25)
    for (wx, wz) in ((ax + 1.15, 1.45), (bx - 1.15, 1.45)):   # square windows with shutters on the garden side
        box(wx - 0.4, ay - 0.05, wz - 0.4, wx + 0.4, ay + 0.02, wz + 0.4, 'doorframe'); box(wx - 0.32, ay - 0.07, wz - 0.32, wx + 0.32, ay, wz + 0.32, 'window')
        box(wx - 0.02, ay - 0.09, wz - 0.32, wx + 0.02, ay, wz + 0.32, 'doorframe'); box(wx - 0.32, ay - 0.09, wz - 0.02, wx + 0.32, ay, wz + 0.02, 'doorframe')
        for s in (-1, 1): rbox(wx + s * 0.6 - 0.17, ay - 0.08, wz - 0.4, wx + s * 0.6 + 0.17, ay - 0.02, wz + 0.4, 'door', 0.02)
        rbox(wx - 0.5, ay - 0.2, wz - 0.52, wx + 0.5, ay, wz - 0.42, 'hull', 0.02)
    wx, wz = (ax + bx) / 2, 1.5   # a ship's wheel between the windows
    ring(wx, ay - 0.06, wz, 0.34, 0.34, 0.035, 'hull').rotation_euler = (R(90), 0, 0)
    for k in range(4): o = rbox(-0.44, -0.025, -0.025, 0.44, 0.025, 0.025, 'hull', 0.01); o.location = (wx, ay - 0.06, wz); o.rotation_euler = (0, R(45 * k), 0)
    disc(wx, ay - 0.08, wz, R(-90), 0.09, 'gold', 0.06)
    barrel(bx - 0.45, ay - 0.42, 0, 1.15); barrel(bx - 1.1, ay - 0.36, 0, 0.95)
    rbox(ax + 0.3, ay - 0.62, 0, ax + 0.9, ay - 0.08, 0.5, 'deck', 0.03); rbox(ax + 0.42, ay - 0.5, 0.5, ax + 0.82, ay - 0.14, 0.82, 'deck', 0.03)
    bush(x1 + 0.1, dy + 1.45, 0.8, 5, 2); bush(x1 + 0.05, dy - 1.5, 0.7, 4, 3)

def ship_scene():
    h = L['house']; x1 = h['x1']; dy = h['door'][1]; xs = x1 - 0.15; tf = lambda x, y, z: (xs + x, dy + y, z)
    at = hull(tf, 4.75, 1.9, 2.0, 0.55, 0.6)
    for (x, y, sx, sy) in ((6.0, dy - 1.5, 2.3, 0.5), (6.0, dy + 1.5, 2.3, 0.5), (xs - 0.1, dy - 1.3, 0.6, 0.45), (xs - 0.1, dy + 1.3, 0.6, 0.45)): ball(x, y, 0, sx, sy, 0.3, 'grass')
    # captain's cabin at the stern, teal planks like Blacksteel, with a lookout deck on top
    cx0, cx1, cw = xs - 1.9, xs - 0.05, 1.3
    rbox(cx0, dy - cw, 1.6, cx1, dy + cw, 3.6, 'planks', 0.05); rbox(cx0 - 0.12, dy - cw - 0.12, 3.58, cx1 + 0.14, dy + cw + 0.12, 3.72, 'deck', 0.04)
    for k in (-1, 0, 1): arch_window(cx1 - 1.0, dy, 2.55, 0, 1.0, 0.4, 0.5) if False else disc(cx1 + 0.01, dy + k * 0.78, 3.0, 0, 0.27, 'doorframe', 0.08); disc(cx1 + 0.03, dy + k * 0.78, 3.0, 0, 0.21, 'window', 0.08)
    for x in (cx0 + 0.55, cx0 + 1.35): disc(x, dy - cw - 0.01, 2.85, R(-90), 0.26, 'doorframe', 0.08); disc(x, dy - cw - 0.03, 2.85, R(-90), 0.2, 'window', 0.08)
    post = [(cx1 + 0.08, dy + k * (cw + 0.05)) for k in (-1, -0.5, 0, 0.5, 1)] + [(cx0 + 0.9, dy - cw - 0.05), (cx0 - 0.05, dy - cw - 0.05)]
    for (x, y) in post: cyl(x, y, 3.7, 0.04, 0.45, 'hull', 10)
    tube([(cx0 - 0.05, dy - cw - 0.05, 4.17, 0.04), (cx1 + 0.08, dy - cw - 0.05, 4.17, 0.04), (cx1 + 0.08, dy + cw + 0.05, 4.17, 0.04)], 'red', 10)
    lantern(cx1 + 0.1, dy, 4.3, 1.7); cyl(cx1 + 0.1, dy, 4.17, 0.03, 0.2, 'wooddark', 8)
    arched_door(xs + 0.05, dy, z=0.3, w=0.42, h=1.05); steps(x1 + 0.05, dy, col='deck')
    for k in (-1, 1): disc(xs + 0.01, dy + k * 1.05, 1.85, 0, 0.26, 'doorframe', 0.08); disc(xs + 0.03, dy + k * 1.05, 1.85, 0, 0.2, 'window', 0.08)
    for t in (0.3, 0.48, 0.66):   # portholes along the side
        w, zd = at(t); round_window(xs - 4.75 * t, dy, 1.3, R(-90), w * 0.985, 0.2, 'gold', False)
    # mast, yards, a full cream sail, crow's nest and the flag
    mx = xs - 3.0; cyl(mx, dy, 1.6, 0.1, 5.9, 'hull', 16)
    for (z, half) in ((3.95, 1.75), (6.3, 1.45)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.06, depth=half * 2, location=(mx + 0.1, dy, z), rotation=(R(90), 0, 0)); put(bpy.context.object, 'hull', True)
    bm = bmesh.new(); g = [[bm.verts.new((mx + 0.16 + 0.5 * math.sin(math.pi * u / 10) * math.sin(math.pi * (0.1 + 0.8 * v / 10)), dy + (1.7 - 0.28 * v / 10) * (u / 5 - 1), 4.0 + 2.25 * v / 10)) for u in range(11)] for v in range(11)]
    for v in range(10):
        for u in range(10): bm.faces.new((g[v][u], g[v][u + 1], g[v + 1][u + 1], g[v + 1][u]))
    o = _obj(bm, 'sail', 'sail'); o.modifiers.new('s', 'SOLIDIFY').thickness = 0.04
    skull(mx + 0.71, dy, 5.15, 0, 2.2)
    revolve(mx, dy, 6.55, [(0.26, 0), (0.36, 0.34), (0.38, 0.38), (0.34, 0.38), (0.24, 0.06), (0.001, 0.06)], 'deck', 24, 'nest'); ring(mx, dy, 6.92, 0.37, 0.37, 0.03, 'red')
    ball(mx, dy, 7.52, 0.07, 0.07, 0.07, 'gold')
    o = rbox(0, -0.015, 0, 0.85, 0.015, 0.5, 'black', 0.01); o.location = (mx + 0.31, dy + 0.31, 7.2); o.rotation_euler = (0, 0, R(45))
    skull(mx + 0.32, dy + 0.28, 7.22, R(-45), 0.75)
    tube([(xs - 4.9, dy, 2.45, 0.07), (xs - 5.35, dy, 2.75, 0.06), (xs - 5.75, dy, 3.1, 0.04)], 'hull', 10)   # bowsprit
    rope(mx, dy, 6.5, xs - 5.7, dy, 3.1, 0.25, 0.018)
    barrel(x1 + 0.0, dy + 1.25, 0, 0.9); bush(x1 + 0.05, dy - 1.5, 0.7, 4, 5)

def light_scene():
    h = L['house']; x1 = h['x1']; dy = h['door'][1]; cx, cy = 6.6, dy; rad = lambda z: 1.78 - 0.165 * z
    revolve(cx, cy, 0, [(2.3, 0), (2.25, 0.22), (1.95, 0.34), (1.7, 0.36)], 'stone', 64, 'base')
    zs = [0.3, 1.26, 2.22, 3.18, 4.14, 5.1]
    for k, (z0, z1) in enumerate(zip(zs, zs[1:])): revolve(cx, cy, 0, [(rad(z0), z0), (rad(z1), z1)], 'white' if k % 2 else 'red', 72, 'band')
    revolve(cx, cy, 5.1, [(0.95, 0), (1.32, 0.1), (1.34, 0.2), (0.8, 0.22)], 'iron', 48, 'gallery')
    for k in range(14): a = 2 * math.pi * k / 14; cyl(cx + 1.26 * math.cos(a), cy + 1.26 * math.sin(a), 5.3, 0.03, 0.42, 'iron', 8)
    ring(cx, cy, 5.72, 1.26, 1.26, 0.035, 'red')
    revolve(cx, cy, 5.3, [(0.72, 0), (0.72, 0.95)], 'lightglow', 40, 'lamp')
    for k in range(8): a = 2 * math.pi * k / 8 + 0.2; cyl(cx + 0.73 * math.cos(a), cy + 0.73 * math.sin(a), 5.3, 0.03, 0.95, 'iron', 8)
    revolve(cx, cy, 6.23, [(0.92, 0), (0.86, 0.1), (0.55, 0.42), (0.2, 0.74), (0.001, 0.9)], 'red', 48, 'cap'); ball(cx, cy, 7.2, 0.09, 0.09, 0.09, 'gold')
    for (a, z) in ((-62, 2.7), (-28, 3.9), (-96, 1.65), (20, 2.75)): round_window(cx, cy, z, R(a), rad(z) + 0.01, 0.24)
    # a little white porch for the door, with a red roof
    rbox(cx + 1.0, dy - 0.72, 0.3, x1 - 0.12, dy + 0.72, 2.2, 'white', 0.05); gable(cx + 0.9, x1 + 0.0, dy - 0.9, dy + 0.9, 2.12, 2.75, 'red', 0.12)
    arched_door(x1 - 0.08, dy, z=0.3, w=0.4, h=1.0); steps(x1 + 0.05, dy, col='stone')
    lantern(x1 - 0.02, dy - 0.95, 1.45); box(x1 - 0.2, dy - 0.97, 1.75, x1, dy - 0.93, 1.78, 'iron')
    for (a, d, s) in ((-70, 2.3, 0.42), (-105, 2.35, 0.5), (-140, 2.3, 0.36), (65, 2.3, 0.45), (120, 2.35, 0.5), (170, 2.25, 0.4)):
        ball(cx + math.cos(R(a)) * d, cy + math.sin(R(a)) * d, 0.08, s * 1.2, s, s * 0.8, 'boulder')
    bush(cx + math.cos(R(-42)) * 2.25, cy + math.sin(R(-42)) * 2.25, 0.7, 4, 6); starfish(cx - 0.4, cy - 2.2, 0.5, 2.2, 'starfish', 0.4)

def chest_scene():
    h = L['house']; x1 = h['x1']; dy = h['door'][1]; ax, bx, ay, by = 4.25, x1 - 0.15, dy - 1.9, dy + 1.9; mx = (ax + bx) / 2; rr0 = (bx - ax) / 2
    rbox(ax, ay, 0.05, bx, by, 2.3, 'hull', 0.1)
    def lidpart(y0, y1, grow, col):   # the rounded lid: half a barrel lying along y
        bm = bmesh.new(); r = rr0 + grow; n = 40
        A = [bm.verts.new((mx + r * math.cos(math.pi * k / n), y0, 2.3 + 0.72 * r * math.sin(math.pi * k / n))) for k in range(n + 1)]
        B = [bm.verts.new((mx + r * math.cos(math.pi * k / n), y1, 2.3 + 0.72 * r * math.sin(math.pi * k / n))) for k in range(n + 1)]
        for k in range(n): bm.faces.new((A[k], B[k], B[k + 1], A[k + 1]))
        bm.faces.new(A); bm.faces.new(B[::-1]); o = _obj(bm, 'lid', col)
        m = o.modifiers.new('e', 'EDGE_SPLIT'); m.split_angle = R(40); return o
    lidpart(ay, by, 0.0, 'hull'); rbox(ax - 0.06, ay - 0.06, 2.16, bx + 0.06, by + 0.06, 2.42, 'gold', 0.05)
    for y in (ay + 0.55, by - 0.55):   # gold straps over the lid and down the sides
        lidpart(y - 0.2, y + 0.2, 0.05, 'gold'); rbox(ax - 0.05, y - 0.2, 0.05, bx + 0.05, y + 0.2, 2.3, 'gold', 0.03)
    for y in (ay, by): lidpart(y - 0.08, y + 0.08, 0.04, 'gold')
    lidpart(ay - 0.12, ay, -0.14, 'hull')
    for (x, y) in ((ax, ay), (bx, ay), (bx, by), (ax, by)): rbox(x - 0.09, y - 0.09, 0.03, x + 0.09, y + 0.09, 2.2, 'gold', 0.03)
    # the lock is a big gold plate with a glowing keyhole; the door is underneath
    disc(bx + 0.02, dy, 2.5, 0, 0.5, 'gold', 0.12); disc(bx + 0.07, dy, 2.58, 0, 0.14, 'window', 0.06); rbox(bx + 0.06, dy - 0.05, 2.25, bx + 0.11, dy + 0.05, 2.55, 'window', 0.01)
    arched_door(bx + 0.06, dy, z=0.25, w=0.42, h=1.0, frame='gold'); steps(x1 + 0.05, dy, col='deck')
    for s in (-1, 1): disc(bx + 0.01, dy + s * 1.02, 1.35, 0, 0.3, 'gold', 0.08); disc(bx + 0.03, dy + s * 1.02, 1.35, 0, 0.23, 'window', 0.08)
    for x in (mx - 0.75, mx + 0.75): disc(x, ay - 0.01, 1.35, R(-90), 0.34, 'gold', 0.08); disc(x, ay - 0.03, 1.35, R(-90), 0.27, 'window', 0.08)
    ring(mx, ay - 0.1, 0.75, 0.3, 0.3, 0.04, 'gold').rotation_euler = (R(90), 0, 0)
    # treasure spilling out at the corner: a soft heap of gold, loose coins, gems and a pearl
    tx, ty = bx - 0.5, ay - 0.42
    ball(tx - 0.2, ty - 0.05, 0.0, 0.5, 0.42, 0.3, 'gold'); ball(tx - 0.65, ty - 0.02, 0.0, 0.3, 0.26, 0.16, 'gold')
    import random as _r; rr = _r.Random(8)
    for k in range(26):
        a = rr.uniform(0, 6.28); d = rr.uniform(0.1, 0.7); o = cyl(tx - 0.25 + math.cos(a) * d * 1.05, ty - 0.05 + math.sin(a) * d * 0.8, 0.02 + 0.27 * max(0, 1 - (d / 0.6) ** 2), 0.085, 0.025, 'f3', 20); o.rotation_euler = (rr.uniform(-0.5, 0.5), rr.uniform(-0.5, 0.5), 0)
    for k, (gx, gy, gz) in enumerate(((tx - 0.05, ty - 0.25, 0.26), (tx - 0.5, ty - 0.2, 0.2), (tx - 0.25, ty - 0.42, 0.14))): ball(gx, gy, gz, 0.09, 0.09, 0.09, ('crystal1', 'crystal', 'crystal2')[k])
    ball(tx + 0.22, ty - 0.3, 0.08, 0.07, 0.07, 0.07, 'pearl')
    lantern(bx + 0.14, dy - 0.95, 1.9, 0.9); box(bx - 0.02, dy - 0.97, 2.17, bx + 0.16, dy - 0.93, 2.2, 'gold')
    bush(x1 + 0.05, dy + 1.5, 0.75, 5, 7)

HOUSES = (('shack', shack_scene), ('ship', ship_scene), ('light', light_scene), ('chest', chest_scene))
castle_scene = shack_scene

# ---------- the island: a beach sloping out to the foam instead of a floating rock; shells instead of meadow flowers ----------
def _rpts(d, z, n=24):
    # a rounded square d metres outside the plot; rounder as it goes out, so the corners stay inside the picture
    S = L['size']; cr = 0.05 + 3.3 * d; pts = []
    for (cx, cy, a0) in ((S + d - cr, -d + cr, -90), (S + d - cr, S + d - cr, 0), (-d + cr, S + d - cr, 90), (-d + cr, -d + cr, 180)):
        for k in range(n): a = R(a0 + 90 * k / n); pts.append((cx + cr * math.cos(a), cy + cr * math.sin(a), z))
    return pts
def _loft(levels, col):
    bm = bmesh.new(); rings = [[bm.verts.new(p) for p in _rpts(d, z)] for (d, z) in levels]
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(len(r0)): bm.faces.new((r0[k], r0[(k + 1) % len(r0)], r1[(k + 1) % len(r0)], r1[k]))
    bm.faces.new(rings[-1][::-1]); return _obj(bm, col, col)
def _even(d, z, step):   # points evenly spaced all the way round that outline
    pts = _rpts(d, z, 40); pts.append(pts[0]); out = []; acc = 0.0
    for a, b in zip(pts, pts[1:]):
        seg = math.hypot(b[0] - a[0], b[1] - a[1]); t = step - acc
        while t <= seg: out.append((a[0] + (b[0] - a[0]) * t / seg, a[1] + (b[1] - a[1]) * t / seg, z)); t += step
        acc = seg - (t - step)
    return out
def island_under(rr):
    _loft([(0.0, -0.02), (0.15, -0.09), (0.6, -0.32), (1.1, -0.54), (1.6, -0.7)], 'grass')
    _loft([(1.6, -0.7), (2.0, -0.82), (2.3, -0.92)], 'sandwet')
    for k, (x, y, z) in enumerate(_even(2.3, -0.9, 0.62)):   # soft white foam where the sea meets the sand
        r = 0.3 + 0.18 * rr.random(); ball(x, y, z, r * 1.25, r * 1.25, 0.1, 'cloud')
    for k, (x, y, z) in enumerate(_even(2.62, -0.93, 1.3)): r = 0.26 + 0.12 * rr.random(); ball(x, y, z, r, r, 0.06, 'cloud2')
def garden_fence(ax, ay, bx, by):   # chunky smooth posts with two swags of rope
    n = max(1, int(math.hypot(bx - ax, by - ay) / 1.15)); pts = [(ax + (bx - ax) * k / n, ay + (by - ay) * k / n) for k in range(n + 1)]
    for (x, y) in pts:
        revolve(x, y, 0, [(0.11, 0), (0.09, 0.1), (0.08, 0.7), (0.1, 0.74), (0.1, 0.8), (0.06, 0.87), (0.001, 0.9)], 'hull', 16, 'post'); ring(x, y, 0.62, 0.09, 0.09, 0.022, 'rope')
    for (p, q) in zip(pts, pts[1:]):
        for z in (0.62, 0.34): rope(p[0], p[1], z, q[0], q[1], z, 0.1)
_flower_dot = flower_dot; _fd = [0]
def flower_dot(x, y, c, s=1.0):
    if s < 1.0: return _flower_dot(x, y, c, s)   # real little flowers on the garden lawn
    _fd[0] += 1
    if _fd[0] % 2: return                         # the beach is calmer than the meadow: half as many things
    if c == 3: starfish(x, y, 0.03, s * 0.75, ('starfish', 'f0')[_fd[0] // 2 % 2], x * 3)
    elif c == 2: ball(x, y, 0.02, 0.055 * s, 0.045 * s, 0.022 * s, 'pebble')
    elif c == 4: _flower_dot(x, y, 0, s)
    else: seashell(x, y, 0.0, s * 0.85, ('shell', 'shell2', 'shell3')[(c + _fd[0] // 2) % 3])
_ground_castle = ground_castle
def ground_castle():
    _ground_castle()
    G = L['garden']; rbox(G['x0'] - 0.3, G['y0'] - 0.3, -0.06, G['x1'] + 0.3, G['y1'] + 0.3, 0.045, 'lawn', 0.1)   # a green lawn for the garden
    # a little pier where the path leaves for town, out over the water from the bottom corner
    S = L['size']; u = 0.7071; sx, sy = S - 0.25, 0.25
    for i in range(7):
        d = 0.2 + 0.3 * i; o = rbox(-0.13, -0.7, -0.07, 0.13, 0.7, 0.0, 'deck', 0.025); o.location = (sx + u * d, sy - u * d, 0.02); o.rotation_euler = (0, 0, R(-45))
    for d in (0.45, 1.95):
        for k in (-1, 1):
            x, y = sx + u * d + k * u * 0.68, sy - u * d + k * u * 0.68; top = 0.7 if d > 1 else 0.3
            cyl(x, y, -0.8, 0.08, 0.8 + top, 'hull', 14); ring(x, y, top - 0.12, 0.085, 0.085, 0.02, 'rope'); ball(x, y, -0.78, 0.24, 0.24, 0.05, 'cloud')
    x, y = sx + u * 1.95, sy - u * 1.95; rope(x - u * 0.68, y - u * 0.68, 0.6, x + u * 0.68, y + u * 0.68, 0.6, 0.12); lantern(x + u * 0.68, y + u * 0.68, 0.74, 1.1)
    # a rowboat pulled up on the beach in front
    bx_, by_, ang = 7.2, -1.05, R(14); ca, sa = math.cos(ang), math.sin(ang)
    tf = lambda x, y, z: (bx_ + x * ca - y * sa, by_ + x * sa + y * ca, -0.56 + z)
    hull(tf, 1.9, 0.5, 0.42, 0.08, 0.3, M=12, N=14)
    for xx in (-0.5, -1.15): o = rbox(-0.09, -0.4, -0.02, 0.09, 0.4, 0.02, 'deck', 0.01); o.location = tf(xx, 0, 0.34); o.rotation_euler = (0, 0, ang)
    starfish(9.0, -1.0, -0.48, 2.0, 'starfish', 0.5); seashell(5.3, -0.8, -0.44, 2.2, 'shell'); seashell(12.5, -0.9, -0.48, 2.0, 'shell3')

# ---------- small things ----------
def c_tree(): palm()
def c_crystals(scale=1.0, cols=('crystal', 'crystal1', 'crystal')):
    if scale == 1.0: return bush(0, 0, 1.25, 9, 4)   # the bush sprite: leafy, with hibiscus flowers
    s = scale / 0.45; m = {'crystal': 'shell', 'crystal1': 'shell3', 'crystal2': 'shell2'}   # small decor: a little heap of shells
    c0 = m.get(cols[0], 'shell'); ball(0, 0.05 * s, 0.045 * s, 0.13 * s, 0.1 * s, 0.05 * s, c0); ball(0.1 * s, 0.08 * s, 0.04 * s, 0.06 * s, 0.055 * s, 0.04 * s, c0)   # a conch
    starfish(0.1 * s, -0.12 * s, 0.02, 1.1 * s, 'starfish', 0.3); seashell(-0.14 * s, -0.08 * s, 0, 1.1 * s, m.get(cols[2], 'shell2'))
    ball(-0.02 * s, -0.16 * s, 0.03 * s, 0.03 * s, 0.03 * s, 0.03 * s, 'pearl')
def c_lamp():   # a tiki torch
    revolve(0, 0, 0, [(0.09, 0), (0.065, 0.06), (0.058, 1.12)], 'bamboo', 16); ring(0, 0, 0.55, 0.05, 0.05, 0.012, 'wooddark'); ring(0, 0, 1.02, 0.055, 0.055, 0.02, 'rope')
    revolve(0, 0, 1.08, [(0.045, 0), (0.1, 0.1), (0.14, 0.24), (0.12, 0.27), (0.001, 0.25)], 'wooddark', 20)
    revolve(0, 0, 1.3, [(0.001, 0), (0.085, 0.06), (0.09, 0.14), (0.05, 0.27), (0.001, 0.38)], 'flame', 16)
    revolve(0, 0, 1.31, [(0.001, 0), (0.045, 0.05), (0.045, 0.1), (0.001, 0.22)], 'flame2', 12)
def c_mailbox(up):   # a message in a bottle on a post; the red flag goes up when there's mail
    revolve(0, 0, 0, [(0.12, 0), (0.08, 0.1), (0.07, 1.0)], 'hull', 16); ring(0, 0, 0.9, 0.075, 0.075, 0.02, 'rope')
    rbox(-0.2, -0.36, 1.0, 0.2, 0.36, 1.08, 'deck', 0.02)
    b = revolve(0, 0, 0, [(0.001, 0), (0.12, 0.015), (0.15, 0.08), (0.15, 0.4), (0.07, 0.54), (0.055, 0.66), (0.065, 0.68)], 'glass', 24, 'bottle'); b.rotation_euler = (R(90), 0, 0); b.location = (0, 0.36, 1.24)
    lb = revolve(0, 0, 0, [(0.155, 0.16), (0.155, 0.34)], 'cream', 24, 'label'); lb.rotation_euler = (R(90), 0, 0); lb.location = (0, 0.36, 1.24)
    ball(0, -0.35, 1.24, 0.06, 0.06, 0.06, 'coconut')
    if up: box(0.2, 0.18, 1.05, 0.24, 0.22, 1.8, 'hull'); box(0.2, 0.18, 1.55, 0.24, 0.5, 1.8, 'flag')
    else: box(0.2, 0.18, 1.05, 0.24, 0.6, 1.12, 'hull')
