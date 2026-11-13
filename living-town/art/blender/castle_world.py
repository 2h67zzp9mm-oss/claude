# Cloud Castle world (THEME=castle), after Hazel's pick: a floating island with a little pastel castle,
# lush flowery grass, purple crystals, round blossom trees, a rock-ringed pond with a waterfall, cream
# fence with gold-tipped posts. Textures in art/textures/castle/ were painted by an image model.
# Loaded by homestead.py with exec(), so it shares its helpers (box, cyl, ball, cone, ring, rbox, put...).
TEX = os.path.join(os.path.dirname(__file__), '..', 'textures', 'castle')
# name -> (colour, glow, metal, texture, tiles per metre)
CASTLE = {
    'grass': ((0.42, 0.72, 0.22), 0, 0, 'grass', 0.16), 'stone': ((0.80, 0.76, 0.86), 0, 0, 'stone', 0.55),
    'roof': ((0.55, 0.32, 0.80), 0, 0, 'roof', 0.85), 'wood': ((0.75, 0.48, 0.22), 0, 0, 'wood', 0.7),
    'cliff': ((0.50, 0.42, 0.36), 0, 0, 'cliff', 0.35), 'dirt': ((0.55, 0.34, 0.19), 0, 0, None, 0), 'soil': ((0.22, 0.13, 0.08), 0, 0, 'soil', 0.9),
    'cream': ((0.96, 0.91, 0.87), 0, 0, None, 0), 'gold': ((1.0, 0.70, 0.22), 0, 0.85, None, 0),
    'door': ((0.58, 0.36, 0.78), 0, 0, None, 0), 'window': ((1.0, 0.78, 0.38), 1.6, 0, None, 0),
    'water': ((0.08, 0.62, 0.86), 0.5, 0, None, 0), 'sparkle': ((1.0, 1.0, 1.0), 2.0, 0, None, 0),
    'boulder': ((0.74, 0.66, 0.60), 0, 0, None, 0), 'leaf': ((0.14, 0.42, 0.10), 0, 0, None, 0),
    'leaf2': ((0.26, 0.56, 0.14), 0, 0, None, 0), 'blossom': ((1.0, 0.36, 0.62), 0.15, 0, None, 0),
    'trunk': ((0.46, 0.29, 0.16), 0, 0, None, 0), 'crystal': ((0.72, 0.50, 1.0), 0.55, 0, None, 0),
    'crystal1': ((1.0, 0.58, 0.85), 0.55, 0, None, 0), 'crystal2': ((0.62, 0.72, 1.0), 0.55, 0, None, 0),
    'pad': ((0.36, 0.66, 0.30), 0, 0, None, 0), 'lotus': ((1.0, 0.62, 0.80), 0.1, 0, None, 0),
    'cloud': ((1.0, 0.90, 0.95), 0.75, 0, None, 0), 'cloud2': ((0.96, 0.78, 0.90), 0.6, 0, None, 0), 'mail': ((0.64, 0.44, 0.86), 0, 0, None, 0),
    'wooddark': ((0.40, 0.23, 0.11), 0, 0, None, 0), 'path': ((0.86, 0.78, 0.68), 0, 0, None, 0),
    'falls': ((0.55, 0.88, 1.0), 0.7, 0, None, 0), 'flag': ((1.0, 0.55, 0.78), 0, 0, None, 0),
    'lampglow': ((1.0, 0.82, 0.50), 2.2, 0, None, 0), 'f0': ((1.0, 0.55, 0.75), 0.05, 0, None, 0),
    'f1': ((0.75, 0.60, 1.0), 0.05, 0, None, 0), 'f2': ((1.0, 0.98, 0.95), 0, 0, None, 0),
    'f3': ((1.0, 0.85, 0.35), 0.05, 0, None, 0), 'f4': ((1.0, 0.70, 0.55), 0.05, 0, None, 0),
    'orange': ((1.0, 0.48, 0.10), 0, 0, None, 0), 'red': ((0.92, 0.16, 0.12), 0, 0, None, 0),
    'berry': ((0.95, 0.12, 0.25), 0, 0, None, 0), 'blue': ((0.25, 0.32, 0.85), 0, 0, None, 0),
    'yellow': ((1.0, 0.82, 0.20), 0, 0, None, 0), 'brown': ((0.35, 0.20, 0.08), 0, 0, None, 0),
    'melon': ((0.16, 0.42, 0.14), 0, 0, None, 0), 'unripe': ((0.55, 0.78, 0.30), 0, 0, None, 0),
}

def mat(col, rough=0.6):
    if col == CLAY: col = TINT[0] or 'cream'
    if col in _mats: return _mats[col]
    base, glow, metal, tex, tiles = CASTLE[col] if col in CASTLE else (col if isinstance(col, tuple) else (0.9, 0.9, 0.9), 0, 0, None, 0)
    m = bpy.data.materials.new(str(col)); m.use_nodes = True; nt = m.node_tree; p = nt.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*base, 1); p.inputs['Roughness'].default_value = 0.35 if metal else (0.08 if col == 'water' else rough)
    p.inputs['Metallic'].default_value = metal
    if glow:
        p.inputs['Base Color'].default_value = (*[c * 0.5 for c in base], 1) if glow < 1 else (*[c * 0.2 for c in base], 1)
        p.inputs['Emission Color'].default_value = (*base, 1); p.inputs['Emission Strength'].default_value = glow
    if tex:   # painted texture, box-projected in world space so walls, ground and planks all tile evenly
        g = nt.nodes.new('ShaderNodeNewGeometry'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (tiles, tiles, tiles)
        im = nt.nodes.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(os.path.join(TEX, tex + '.jpg'), check_existing=True)
        im.projection = 'BOX'; im.projection_blend = 0.3
        nt.links.new(g.outputs['Position'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], im.inputs['Vector'])
        if col == 'grass':   # calmer, deeper green than the raw painting, with big soft light/dark patches
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1.0
            n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 0.35; ramp = nt.nodes.new('ShaderNodeValToRGB')
            ramp.color_ramp.elements[0].color = (0.42, 0.52, 0.36, 1); ramp.color_ramp.elements[1].color = (0.66, 0.74, 0.55, 1)
            nt.links.new(g.outputs['Position'], n.inputs['Vector']); nt.links.new(n.outputs['Fac'], ramp.inputs['Fac'])
            nt.links.new(im.outputs['Color'], mx.inputs['A']); nt.links.new(ramp.outputs['Color'], mx.inputs['B']); nt.links.new(mx.outputs['Result'], p.inputs['Base Color'])
        else: nt.links.new(im.outputs['Color'], p.inputs['Base Color'])
    if col == 'boulder':
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 6; ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (0.58, 0.50, 0.46, 1); ramp.color_ramp.elements[1].color = (0.86, 0.80, 0.74, 1)
        nt.links.new(n.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    _mats[col] = m; return m

def clear_spot(x, y, pad=0.0):
    h = L['house']; P = L['pond']; G = L['garden']
    if h['x0'] - 0.4 - pad < x < h['x1'] + 1.0 + pad and h['y0'] - 0.4 - pad < y < h['y1'] + 0.4 + pad: return False
    if ((x - P['x']) / (P['rx'] + 0.5 + pad)) ** 2 + ((y - P['y']) / (P['ry'] + 0.5 + pad)) ** 2 < 1: return False
    if G['x0'] - 0.2 < x < G['x1'] + 0.2 and G['y0'] - 0.2 < y < G['y1'] + 0.2: return False
    for (ax, ay), (bx, by) in zip(L['path'], L['path'][1:]):
        L2 = (bx - ax) ** 2 + (by - ay) ** 2; t = max(0, min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L2))
        if math.hypot(ax + t * (bx - ax) - x, ay + t * (by - ay) - y) < 0.75: return False
    return True

def flower_dot(x, y, c, s=1.0):
    for k in range(5):
        a = k * 1.256; ball(x + 0.045 * s * math.cos(a), y + 0.045 * s * math.sin(a), 0.035, 0.035 * s, 0.035 * s, 0.018 * s, 'f%d' % c)
    ball(x, y, 0.045, 0.022 * s, 0.022 * s, 0.015 * s, 'f3' if c != 3 else 'f4')

def island_under(rr):
    S = L['size']
    # one smooth island underside: a dirt band under the grass, then a rounded rock cone tapering into the clouds
    def rring(bm, inset, z, cr, n=24):
        pts = []; x0, y0, x1, y1 = inset, inset, S - inset, S - inset
        for (cx, cy, a0) in ((x1 - cr, y0 + cr, -90), (x1 - cr, y1 - cr, 0), (x0 + cr, y1 - cr, 90), (x0 + cr, y0 + cr, 180)):
            for k in range(n): a = R(a0 + 90 * k / n); pts.append(bm.verts.new((cx + cr * math.cos(a), cy + cr * math.sin(a), z)))
        return pts
    def loft(levels, col):
        bm = bmesh.new(); rings = [rring(bm, *lv) for lv in levels]
        for r0, r1 in zip(rings, rings[1:]):
            m = len(r0)
            for k in range(m): bm.faces.new((r0[k], r0[(k + 1) % m], r1[(k + 1) % m], r1[k]))
        bm.faces.new(rings[-1][::-1])
        me = bpy.data.meshes.new(col); bm.to_mesh(me)
        for f in me.polygons: f.use_smooth = True
        o = bpy.data.objects.new(col, me); bpy.context.scene.collection.objects.link(o); o.data.materials.append(mat(col)); return o
    loft([(0.0, -0.02, 0.05), (0.0, -0.5, 0.05), (0.04, -0.62, 0.12)], 'dirt')
    loft([(0.04, -0.6, 0.12)] + [(0.04 + 2.6 * t ** 1.6, -0.6 - 3.0 * t, 0.12 + 2.0 * t) for t in (0.1, 0.25, 0.4, 0.55, 0.7, 0.82, 0.92, 1.0)], 'cliff')
    for k in range(int(S / 0.7)):                                                                # soft clouds hugging the bottom
        t = (k + 0.3) * 0.7 - 1.0
        for (x, y) in ((t, -0.9 + rr.uniform(-0.6, 0.6)), (S + 0.9 + rr.uniform(-0.6, 0.6), t)):
            r = 0.7 + 0.9 * rr.random(); ball(x, y, -2.4 - 0.9 * rr.random(), r * 1.3, r * 1.3, r * 0.75, 'cloud' if k % 3 else 'cloud2')
            ball(x + rr.uniform(-0.5, 0.5), y + rr.uniform(-0.5, 0.5), -1.9 - 0.4 * rr.random(), r * 0.7, r * 0.7, r * 0.5, 'cloud')
def garden_fence(ax, ay, bx, by):
    Lf = math.hypot(bx - ax, by - ay); n = max(1, int(Lf / 1.15)); horiz = abs(bx - ax) > abs(by - ay)
    for k in range(n + 1):
        t = k / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
        rbox(x - 0.1, y - 0.1, 0, x + 0.1, y + 0.1, 0.78, 'cream', 0.03); rbox(x - 0.13, y - 0.13, 0.74, x + 0.13, y + 0.13, 0.82, 'cream', 0.02)
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.12, depth=0.22, location=(x, y, 0.93), rotation=(0, 0, R(45))); put(bpy.context.object, 'gold')
    m = max(1, int(Lf / 0.2))
    for k in range(m):
        t = (k + 0.5) / m; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
        box(x - 0.035, y - 0.035, 0, x + 0.035, y + 0.035, 0.52, 'cream')
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.05, depth=0.1, location=(x, y, 0.57), rotation=(0, 0, R(45))); put(bpy.context.object, 'cream')
    for z in (0.16, 0.4):
        if horiz: box(min(ax, bx), ay - 0.025, z, max(ax, bx), ay + 0.025, z + 0.06, 'cream')
        else: box(ax - 0.025, min(ay, by), z, ax + 0.025, max(ay, by), z + 0.06, 'cream')
def ground_castle():
    S = L['size']; P = L['pond']
    bm = bmesh.new(); N = 84; verts = {}
    for i in range(N + 1):
        for j in range(N + 1):
            x, y = i * S / N, j * S / N
            e = ((x - P['x']) / P['rx']) ** 2 + ((y - P['y']) / P['ry']) ** 2
            z = -0.45 * max(0, 1 - e) ** 0.6 if e < 1 else 0.025 * math.sin(x * 1.1) * math.cos(y * 0.9)
            verts[i, j] = bm.verts.new((x, y, z))
    for i in range(N):
        for j in range(N): bm.faces.new((verts[i, j], verts[i + 1, j], verts[i + 1, j + 1], verts[i, j + 1]))
    me = bpy.data.meshes.new('ground'); bm.to_mesh(me); o = bpy.data.objects.new('ground', me); bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat('grass')); bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.shade_smooth()
    # grassy lip, then the rocky cliff of the floating island, tapering down into clouds
    box(0, 0, -0.56, S, S, -0.47, 'grass')   # keep its top below the pond so the water shows
    import random as _r; rr = _r.Random(5)
    island_under(rr)   # the island's underside (other worlds swap this)
    # pond: clear blue water, ring of boulders, lily pads with lotus, sparkles, a little waterfall at the back
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=1, fill_type='NGON', location=(P['x'], P['y'], -0.08))
    w = bpy.context.object; w.scale = (P['rx'] * 0.96, P['ry'] * 0.96, 1); put(w, 'water')
    for k in range(22):
        a = k / 22 * 2 * math.pi + 0.1; sz = 0.3 + 0.18 * rr.random()
        ball(P['x'] + math.cos(a) * P['rx'] * 1.02, P['y'] + math.sin(a) * P['ry'] * 1.02, 0.05, sz * 1.25, sz, sz * 0.85, 'boulder')
    for (dx, dy, r) in ((-1.3, 0.5, 0.32), (0.9, -1.0, 0.28), (1.7, 0.7, 0.26), (-0.4, -1.3, 0.22), (0.3, 1.2, 0.24)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r, depth=0.025, location=(P['x'] + dx, P['y'] + dy, -0.06)); put(bpy.context.object, 'pad')
        if r > 0.25:
            for j in range(6): a = j * 1.05; ball(P['x'] + dx + 0.06 * math.cos(a), P['y'] + dy + 0.06 * math.sin(a), 0.0, 0.07, 0.03, 0.06, 'lotus').rotation_euler = (0, R(30), a)
    for k in range(40):
        a = rr.random() * 2 * math.pi; d = rr.random() ** 0.5 * 0.85
        ball(P['x'] + math.cos(a) * P['rx'] * d, P['y'] + math.sin(a) * P['ry'] * d, -0.07, 0.03, 0.03, 0.006, 'sparkle')
    fx, fy = P['x'] - 0.8, P['y'] + P['ry'] + 0.2                                                # waterfall rocks (back edge)
    for (dx, dy, z, s) in ((-0.9, 0.3, 0.2, 0.55), (0.9, 0.25, 0.2, 0.6), (-0.5, 0.6, 0.7, 0.5), (0.55, 0.6, 0.75, 0.5), (0, 0.85, 1.1, 0.55), (-1.4, 0.0, 0.1, 0.45), (1.5, -0.1, 0.1, 0.45)):
        ball(fx + dx, fy + dy, z, s * 1.2, s, s * 0.9, 'boulder')
    bm = bmesh.new()   # a thin curved sheet of water spilling forward off the rocks
    rows = []
    for i in range(9):
        t = i / 8; yy = fy + 0.3 - 0.55 * t ** 1.6; zz = 1.05 - 1.12 * t
        rows.append([bm.verts.new((fx + s * (0.22 + 0.08 * t), yy, zz)) for s in (-1, 1)])
    for i in range(8): bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
    me = bpy.data.meshes.new('falls'); bm.to_mesh(me); fo = bpy.data.objects.new('falls', me); bpy.context.scene.collection.objects.link(fo)
    fo.modifiers.new('s', 'SOLIDIFY').thickness = 0.05; fo.data.materials.append(mat('falls'))
    for k in range(8): ball(fx + rr.uniform(-0.35, 0.35), fy - 0.3 + rr.uniform(-0.15, 0.15), -0.04, 0.12, 0.09, 0.05, 'sparkle')
    # round cream stepping stones
    pts = L['path']
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(bx - ax, by - ay) / 0.85))
        for k in range(n):
            t = (k + 0.5) / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.38 + 0.05 * ((k * 7) % 3) / 2, depth=0.06, location=(x + 0.12 * math.sin(k * 2.1), y + 0.12 * math.cos(k * 1.7), 0.0))
            o = bpy.context.object; o.scale = (1.15, 1, 1); put(o, 'path'); m = o.modifiers.new('b', 'BEVEL'); m.width = 0.03; m.segments = 2
    # garden: grass inside, cream picket fence, chunky posts with gold tips
    G = L['garden']; gx, gy, gw = G['gate']
    fence = garden_fence
    x0, y0, x1, y1 = G['x0'], G['y0'], G['x1'], G['y1']
    fence(x0, y0, x1, y0); fence(x0, y1, x1, y1); fence(x0, y0, x0, y1)
    fence(x1, y0, x1, gy - gw / 2); fence(x1, gy + gw / 2, x1, y1)
    # lots of little flowers in the grass (flat enough to walk over)
    for k in range(90):    # flowers grow in little patches, like the picture
        cx, cy = rr.uniform(0.5, S - 0.5), rr.uniform(0.5, S - 0.5); c = rr.choice((0, 0, 1, 1, 2, 3, 4))
        for j in range(rr.randint(3, 7)):
            x, y = cx + rr.gauss(0, 0.25), cy + rr.gauss(0, 0.25)
            if 0.3 < x < S - 0.3 and 0.3 < y < S - 0.3 and clear_spot(x, y): flower_dot(x, y, c if j % 3 else rr.choice((0, 1, 2)), rr.uniform(1.4, 2.0))
    for k in range(160):   # a few between the beds too
        x, y = rr.uniform(x0 + 0.2, x1 - 0.2), rr.uniform(y0 + 0.2, y1 - 0.2)
        if any(px - 0.1 < x < px + G['plot'] + 0.1 and py - 0.1 < y < py + G['plot'] + 0.1 for px, py in G['plots']): continue
        flower_dot(x, y, rr.choice((0, 1, 2)), 0.8)

def tower(cx, cy, r, h, roof_r, roof_h, flag=True):
    cyl(cx, cy, 0.25, r, h - 0.25, 'stone', 40)
    cyl(cx, cy, h - 0.35, r + 0.12, 0.38, 'stone', 40)
    ring(cx, cy, h - 0.36, r + 0.12, r + 0.12, 0.04, 'gold')
    bpy.ops.mesh.primitive_cone_add(vertices=40, radius1=roof_r, depth=roof_h, location=(cx, cy, h + roof_h / 2)); put(bpy.context.object, 'roof', True)
    ring(cx, cy, h + 0.03, roof_r - 0.02, roof_r - 0.02, 0.05, 'gold')
    top = h + roof_h
    ball(cx, cy, top + 0.05, 0.1, 0.1, 0.1, 'gold')
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.06, depth=0.5, location=(cx, cy, top + 0.35)); put(bpy.context.object, 'gold', True)
    if flag:
        cyl(cx, cy, top + 0.1, 0.02, 1.1, 'gold'); ball(cx, cy, top + 1.22, 0.05, 0.05, 0.05, 'gold')
        bm = bmesh.new(); v = [bm.verts.new(p) for p in ((cx, cy, top + 1.15), (cx - 0.55, cy - 0.35, top + 1.0), (cx - 0.05, cy - 0.15, top + 0.95), (cx - 0.5, cy - 0.4, top + 0.78), (cx, cy, top + 0.8))]
        bm.faces.new((v[0], v[1], v[2])); bm.faces.new((v[2], v[3], v[4], v[0]))
        me = bpy.data.meshes.new('flag'); bm.to_mesh(me); f = bpy.data.objects.new('flag', me); bpy.context.scene.collection.objects.link(f)
        f.modifiers.new('s', 'SOLIDIFY').thickness = 0.02; f.data.materials.append(mat('flag'))

def arch_window(cx, cy, z, a, r, w=0.42, hgt=0.7):
    # an arched glowing window set into a round tower wall at angle a, with a gold frame
    x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
    for (col, grow, out) in (('gold', 0.08, 0.0), ('window', 0.0, 0.03)):
        o = box(-0.05, -(w / 2 + grow), -grow, 0.05, w / 2 + grow, hgt, col); o.location = (x + math.cos(a) * out, y + math.sin(a) * out, z); o.rotation_euler = (0, 0, a)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=w / 2 + grow, depth=0.1, location=(x + math.cos(a) * out, y + math.sin(a) * out, z + hgt), rotation=(0, R(90), a)); put(bpy.context.object, col)
    o = box(-0.06, -0.02, 0, 0.06, 0.02, hgt + w / 2, 'gold'); o.location = (x + math.cos(a) * 0.05, y + math.sin(a) * 0.05, z); o.rotation_euler = (0, 0, a)

def castle_scene():
    h = L['house']; x0, y0, x1, y1 = h['x0'], h['y0'], h['x1'], h['y1']; dx, dy = h['door']
    rbox(x0 - 0.1, y0 - 0.1, 0, x1 + 0.05, y1 + 0.1, 0.28, 'stone', 0.05)
    # the keep, with a purple gabled roof
    kx0, ky0, kx1, ky1, kh = x0 + 0.3, y0 + 0.35, x1 - 1.2, y1 - 0.3, 3.3
    box(kx0, ky0, 0.25, kx1, ky1, kh, 'stone')
    cy0, ov, rh = (ky0 + ky1) / 2, 0.3, 1.7
    bm = bmesh.new()
    a = [bm.verts.new(v) for v in ((kx0 - ov, ky0 - ov, kh), (kx1 + ov, ky0 - ov, kh), (kx1 + ov, cy0, kh + rh), (kx0 - ov, cy0, kh + rh))]
    b = [bm.verts.new(v) for v in ((kx0 - ov, ky1 + ov, kh), (kx1 + ov, ky1 + ov, kh), (kx1 + ov, cy0, kh + rh), (kx0 - ov, cy0, kh + rh))]
    bm.faces.new(a); bm.faces.new(b[::-1])
    me = bpy.data.meshes.new('roof'); bm.to_mesh(me); ro = bpy.data.objects.new('roof', me); bpy.context.scene.collection.objects.link(ro)
    ro.modifiers.new('s', 'SOLIDIFY').thickness = 0.16; ro.data.materials.append(mat('roof'))
    for xx in (kx0, kx1):
        bm = bmesh.new(); t = [bm.verts.new(v) for v in ((xx, ky0, kh), (xx, ky1, kh), (xx, cy0, kh + rh - 0.05))]; bm.faces.new(t)
        me = bpy.data.meshes.new('gable'); bm.to_mesh(me); g = bpy.data.objects.new('gable', me); bpy.context.scene.collection.objects.link(g)
        g.modifiers.new('s', 'SOLIDIFY').thickness = 0.1; g.data.materials.append(mat('stone'))
    box(kx0 - ov, cy0 - 0.06, kh + rh - 0.02, kx1 + ov, cy0 + 0.06, kh + rh + 0.08, 'gold')     # gold ridge
    # front windows on the keep (arched, glowing) and a round window in the gable
    for wx in (kx0 + 0.9, kx0 + 2.1):
        o = box(wx - 0.32, ky0 - 0.06, 1.3, wx + 0.32, ky0 + 0.02, 2.3, 'gold'); o2 = box(wx - 0.24, ky0 - 0.09, 1.36, wx + 0.24, ky0, 2.3, 'window')
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.32, depth=0.08, location=(wx, ky0 - 0.02, 2.3), rotation=(R(90), 0, 0)); put(bpy.context.object, 'gold')
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.24, depth=0.08, location=(wx, ky0 - 0.05, 2.3), rotation=(R(90), 0, 0)); put(bpy.context.object, 'window')
        box(wx - 0.03, ky0 - 0.1, 1.36, wx + 0.03, ky0 - 0.07, 2.5, 'gold')
        box(wx - 0.42, ky0 - 0.3, 1.18, wx + 0.42, ky0, 1.3, 'stone')
        for j in range(4): ball(wx - 0.3 + j * 0.2, ky0 - 0.18, 1.36, 0.12, 0.1, 0.1, 'leaf' if j % 2 else 'blossom')
    # big round tower with the front door
    tx, tr = x1 - 1.25, 1.25
    tower(tx, dy, tr, 5.0, 1.55, 2.7)
    for (a, z) in ((R(-35), 3.2), (R(-80), 3.2), (R(-60), 1.9)): arch_window(tx, dy, z, a, tr)
    for k in range(10):   # little crenels round the top
        a = k / 10 * 2 * math.pi; ball(tx + math.cos(a) * (tr + 0.12), dy + math.sin(a) * (tr + 0.12), 4.55, 0.06, 0.06, 0.06, 'gold')
    # arched purple door with a gold frame and star, stone steps
    box(x1 - 0.12, dy - 0.48, 0.28, x1 + 0.06, dy + 0.48, 1.6, 'gold'); box(x1 - 0.1, dy - 0.4, 0.28, x1 + 0.09, dy + 0.4, 1.6, 'door')
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.48, depth=0.18, location=(x1 - 0.03, dy, 1.6), rotation=(0, R(90), 0)); put(bpy.context.object, 'gold')
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.4, depth=0.19, location=(x1 - 0.0, dy, 1.6), rotation=(0, R(90), 0)); put(bpy.context.object, 'door')
    box(x1 + 0.08, dy - 0.02, 0.3, x1 + 0.11, dy + 0.02, 1.95, 'gold')
    ball(x1 + 0.12, dy, 1.62, 0.03, 0.09, 0.09, 'gold'); ball(x1 + 0.12, dy + 0.22, 1.0, 0.04, 0.04, 0.04, 'gold')
    for k, (d, z) in enumerate(((0.0, 0.28), (0.3, 0.19), (0.6, 0.1))):
        rbox(x1 + d - 0.05, dy - 0.75 + k * 0.0, 0, x1 + d + 0.32, dy + 0.75, z, 'stone', 0.03)
    for s in (-1, 1):   # flowers either side of the door
        leafy([(x1 + 0.25, dy + s * 0.95, 0.25, 0.27)], ls=0.45); [ball(x1 + 0.25 + 0.15 * math.cos(j), dy + s * 0.95 + 0.15 * math.sin(j), 0.42, 0.06, 0.06, 0.05, 'blossom') for j in range(5)]
    # more towers: tall one at the back, small one at the front corner, a turret behind the big tower
    tower(x0 + 0.75, y1 - 0.75, 0.75, 5.6, 0.95, 2.2)
    tower(x0 + 0.7, y0 + 0.7, 0.62, 4.0, 0.8, 1.8, flag=False)
    tower(x1 - 1.4, y1 - 0.55, 0.55, 4.4, 0.72, 1.6, flag=False)
    arch_window(x0 + 0.7, y0 + 0.7, 2.4, R(-70), 0.62, 0.3, 0.5)
    arch_window(x0 + 0.75, y1 - 0.75, 3.6, R(-30), 0.75, 0.3, 0.5)
    for (x, y) in ((x0 + 1.6, y0 - 0.05), (x0 + 3.0, y0 - 0.05), (x1 - 0.2, y0 + 0.4)):   # climbing flowers at the base
        leafy([(x, y, 0.3, 0.28), (x, y, 0.5, 0.2)], ls=0.45); [ball(x + 0.18 * math.cos(j * 1.3), y - 0.12, 0.3 + 0.12 * (j % 3), 0.06, 0.05, 0.06, 'blossom') for j in range(5)]

# ---------- small things ----------
def leaf_mesh(name, L=0.26, W=0.11):
    # one pointed, gently cupped leaf with a raised middle vein, shared by every leaf on the tree
    bm = bmesh.new(); n = 7; top, bot = [], []
    for k in range(n + 1):
        t = k / n; x = (t - 0.5) * L; w = W * math.sin(math.pi * t) ** 0.8
        top.append(bm.verts.new((x, w, -0.012 * (w / W) ** 2 * 3))); bot.append(bm.verts.new((x, -w, -0.012 * (w / W) ** 2 * 3)))
    mid = [bm.verts.new(((k / n - 0.5) * L, 0, 0.008 * math.sin(math.pi * k / n))) for k in range(n + 1)]
    for k in range(n):
        bm.faces.new((mid[k], mid[k + 1], top[k + 1], top[k])); bm.faces.new((mid[k], bot[k], bot[k + 1], mid[k + 1]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me)
    for f in me.polygons: f.use_smooth = True
    return me
_leaf_meshes = []
def leafy(blobs, dens=520, ls=1.0, dark=0.86):
    # cover round blobs (x, y, z, r) in little pointy leaves, lighter on top and facing the camera, dark inside
    from mathutils import Vector, Quaternion
    import random as _r; rr = _r.Random(int(sum(b[0] * 7 + b[1] * 13 + b[3] * 31 for b in blobs) * 100))
    if _leaf_meshes:
        try: _leaf_meshes[0].name
        except ReferenceError: _leaf_meshes.clear()   # the scene was reset between renders
    if not _leaf_meshes:
        _leaf_meshes.extend([leaf_mesh('leafA'), leaf_mesh('leafB', 0.23, 0.1), leaf_mesh('leafC', 0.28, 0.12)])
        for me, c in zip(_leaf_meshes, ('leaf', 'leaf2', (0.38, 0.66, 0.2))): me.materials.append(mat(c))
    for (x, y, z, r) in blobs: ball(x, y, z, r * dark, r * dark, r * dark * 0.93, (0.08, 0.26, 0.07))
    col = bpy.context.scene.collection
    for (bx, by, bz, r) in blobs:
        cnt = max(12, int(dens * r * r / (ls * ls)))
        for k in range(cnt):
            zz = 1 - 2 * (k + 0.5) / cnt; ph = k * 2.39996; rad = math.sqrt(1 - zz * zz)
            nx, ny, nz = rad * math.cos(ph), rad * math.sin(ph), zz
            if nz < -0.6 and bz - r < 0.15: continue   # nothing under the ground
            px, py, pz = bx + nx * r, by + ny * r, bz + nz * r * 0.92
            if any(((px - ox) ** 2 + (py - oy) ** 2 + ((pz - oz) / 0.92) ** 2) < (orr * 0.97) ** 2 for (ox, oy, oz, orr) in blobs if (ox, oy, oz, orr) != (bx, by, bz, r)): continue
            light = nz * 0.6 - ny * 0.5 + rr.uniform(-0.4, 0.4)
            o = bpy.data.objects.new('leaf', _leaf_meshes[2] if light > 0.45 else _leaf_meshes[1] if light > -0.1 else _leaf_meshes[0]); col.objects.link(o)
            j = 0.04 * ls; o.location = (px + rr.uniform(-j, j), py + rr.uniform(-j, j), pz + rr.uniform(-j, j))
            o.rotation_mode = 'QUATERNION'
            nrm = Vector((nx + rr.uniform(-0.5, 0.5), ny + rr.uniform(-0.5, 0.5), nz + 0.4 + rr.uniform(-0.3, 0.3))).normalized()
            o.rotation_quaternion = nrm.to_track_quat('Z', 'X') @ Quaternion((0, 0, 1), rr.uniform(0, 6.283)); sc = ls * rr.uniform(0.85, 1.25); o.scale = (sc, sc, sc)
def c_tree():
    import random as _r; rr = _r.Random(2)
    cyl(0, 0, 0, 0.2, 1.5, 'trunk'); cyl(0, 0, 0, 0.3, 0.2, 'trunk')
    for (a, tilt) in ((0.4, 40), (2.6, 35), (4.4, 45)):   # a few branches up into the leaves
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.07, depth=0.8, location=(0.22 * math.cos(a), 0.22 * math.sin(a), 1.7), rotation=(R(tilt) * math.sin(a), -R(tilt) * math.cos(a), 0)); put(bpy.context.object, 'trunk', True)
    blobs = ((0, 0, 2.15, 1.05), (0.5, -0.35, 2.55, 0.7), (-0.55, 0.2, 2.5, 0.68), (0.1, 0.45, 2.8, 0.62), (0.15, -0.2, 3.0, 0.6))
    for (x, y, z, r) in blobs: ball(x, y, z, r * 0.86, r * 0.86, r * 0.8, (0.08, 0.26, 0.07))   # dark inside so gaps look deep
    leafy(blobs)
    for k in range(26):   # pink blossoms on the camera side
        a = rr.uniform(-2.2, 0.6); z = rr.uniform(1.7, 3.2); rad = 1.08 - abs(z - 2.4) * 0.35
        x, y = math.cos(a) * rad, math.sin(a) * rad
        for j in range(5): ball(x + 0.06 * math.cos(j * 1.256), y + 0.06 * math.sin(j * 1.256), z, 0.05, 0.05, 0.05, 'blossom')
        ball(x, y, z, 0.03, 0.03, 0.03, 'f3')
def crystal(x, y, r, hgt, tx, ty, col):
    # a six-sided prism with a pointed tip, standing at (x, y), tilted
    bm = bmesh.new(); body = hgt * 0.72
    ring0 = [bm.verts.new((r * math.cos(k * math.pi / 3), r * math.sin(k * math.pi / 3), 0)) for k in range(6)]
    ring1 = [bm.verts.new((r * math.cos(k * math.pi / 3), r * math.sin(k * math.pi / 3), body)) for k in range(6)]
    tip = bm.verts.new((0, 0, hgt))
    for k in range(6):
        j = (k + 1) % 6; bm.faces.new((ring0[k], ring0[j], ring1[j], ring1[k])); bm.faces.new((ring1[k], ring1[j], tip))
    bm.faces.new(ring0[::-1])
    me = bpy.data.meshes.new('crystal'); bm.to_mesh(me); o = bpy.data.objects.new('crystal', me); bpy.context.scene.collection.objects.link(o)
    o.location = (x, y, 0); o.rotation_euler = (R(tx), R(ty), 0); o.data.materials.append(mat(col)); return o
def c_crystals(scale=1.0, cols=('crystal', 'crystal1', 'crystal')):
    for k, (x, y, hgt, tx, ty) in enumerate(((0, 0, 1.0, 0, 0), (0.25, -0.12, 0.62, 14, 22), (-0.24, 0.1, 0.7, -16, -18), (0.06, 0.28, 0.5, -24, 8), (-0.12, -0.25, 0.45, 20, -12))):
        crystal(x * scale, y * scale, 0.15 * scale, hgt * scale, tx, ty, cols[k % len(cols)])
    for k in range(3): ball(0.3 * math.cos(k * 2.1 + 0.5) * scale, 0.3 * math.sin(k * 2.1 + 0.5) * scale, 0.02, 0.14 * scale, 0.12 * scale, 0.08 * scale, 'leaf')
def c_mailbox(up):
    cyl(0, 0, 0, 0.07, 1.0, 'wood'); rbox(-0.14, -0.14, 0.0, 0.14, 0.14, 0.12, 'wooddark', 0.02)
    rbox(-0.2, -0.32, 1.0, 0.2, 0.32, 1.28, 'mail', 0.03)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.2, depth=0.64, location=(0, 0, 1.28), rotation=(R(90), 0, 0)); put(bpy.context.object, 'mail', True)
    ring(0, -0.32, 1.22, 0.2, 0.2, 0.025, 'gold').rotation_euler = (R(90), 0, 0)
    bpy.ops.mesh.primitive_cone_add(vertices=5, radius1=0.09, depth=0.02, location=(0.21, 0, 1.2), rotation=(0, R(90), 0)); put(bpy.context.object, 'gold')
    if up: box(0.2, 0.18, 1.2, 0.24, 0.22, 1.75, 'gold'); box(0.2, 0.18, 1.55, 0.24, 0.45, 1.75, 'flag')
    else: box(0.2, 0.18, 1.1, 0.24, 0.55, 1.18, 'gold')
def c_crate():
    box(-0.45, -0.45, 0, 0.45, 0.45, 0.7, 'wood')
    for (x0, y0, x1, y1) in ((-0.47, -0.47, -0.37, 0.47), (0.37, -0.47, 0.47, 0.47), (-0.47, -0.47, 0.47, -0.37), (-0.47, 0.37, 0.47, 0.47)):
        box(x0, y0, 0.62, x1, y1, 0.74, 'wooddark'); box(x0, y0, 0, x1, y1, 0.08, 'wooddark')
    for (x, y) in ((-0.42, -0.42), (0.42, -0.42), (-0.42, 0.42), (0.42, 0.42)): box(x - 0.05, y - 0.05, 0, x + 0.05, y + 0.05, 0.74, 'wooddark')
    box(-0.38, -0.38, 0.5, 0.38, 0.38, 0.55, 'soil')
def c_bed():
    h = L['garden']['plot'] / 2
    rbox(-h, -h, -0.02, h, h, 0.22, 'wood', 0.03); box(-h + 0.09, -h + 0.09, 0.2, h - 0.09, h - 0.09, 0.23, 'soil')
    for s in (-1, 1): box(-h - 0.01, s * h - 0.04, 0.0, h + 0.01, s * h + 0.04, 0.24, 'wooddark')
def c_wet():
    h = L['garden']['plot'] / 2 - 0.1; box(-h, -h, 0.23, h, h, 0.24, (0.10, 0.06, 0.05))
def c_lamp():
    rbox(-0.12, -0.12, 0, 0.12, 0.12, 0.1, 'cream', 0.02); cyl(0, 0, 0.1, 0.035, 1.2, 'cream')
    rbox(-0.11, -0.11, 1.25, 0.11, 0.11, 1.5, 'lampglow', 0.02)
    for (x, y) in ((-0.11, -0.11), (0.11, -0.11), (-0.11, 0.11), (0.11, 0.11)): box(x - 0.02, y - 0.02, 1.25, x + 0.02, y + 0.02, 1.5, 'gold')
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.19, depth=0.18, location=(0, 0, 1.6), rotation=(0, 0, R(45))); put(bpy.context.object, 'gold')
    ball(0, 0, 1.72, 0.04, 0.04, 0.04, 'gold')
def c_plant(kind, c):
    if kind == 'flower':        # a clump of big flowers
        ball(0, 0, 0.06, 0.2, 0.2, 0.08, 'leaf')
        for k in range(4):
            a = k * 1.6; x, y = 0.12 * math.cos(a), 0.12 * math.sin(a); hh = 0.22 + 0.08 * (k % 2)
            cyl(x, y, 0, 0.012, hh, 'leaf')
            for j in range(6): ball(x + 0.05 * math.cos(j * 1.05), y + 0.05 * math.sin(j * 1.05), hh, 0.045, 0.045, 0.02, 'f%d' % (c % 5))
            ball(x, y, hh + 0.01, 0.025, 0.025, 0.02, 'f3')
    elif kind == 'shroom':      # small crystal cluster
        c_crystals(0.45, (('crystal', 'crystal1', 'crystal2')[c % 3], 'crystal', ('crystal1', 'crystal2', 'crystal')[c % 3]))
    elif kind == 'succulent':   # round bush with blossoms
        leafy([(0, 0, 0.2, 0.24), (0.12, -0.08, 0.3, 0.15)], ls=0.4)
        for j in range(8): a = j * 0.8 - 1.5; ball(0.22 * math.cos(a), 0.22 * math.sin(a), 0.2 + 0.1 * (j % 3), 0.04, 0.04, 0.04, 'f%d' % (c % 5))
    else:                       # tall bell flowers
        for k in range(3):
            x = 0.08 * (k - 1); hh = 0.35 + 0.1 * (k == 1)
            cyl(x, 0, 0, 0.012, hh, 'leaf')
            for j in range(3): bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.05, depth=0.07, location=(x + 0.02 * j, 0, hh - j * 0.09)); put(bpy.context.object, 'f%d' % ((c + 1) % 5), True)
        ball(0, 0, 0.04, 0.14, 0.12, 0.05, 'leaf')

def leaves(n, size, z=0.22, col='leaf', ox=0, oy=0):
    for k in range(n):
        a = k * 2.4 + ox * 3; ball(ox + size * 0.45 * math.cos(a), oy + size * 0.45 * math.sin(a), z + size * 0.3, size * 0.75, size * 0.36, size * 0.14, col if k % 2 else 'leaf2').rotation_euler = (0, R(-30), a)
def veg(c, st):
    if st == 0:   # sprouts
        for (ox, oy) in ((-0.2, -0.12), (0.18, -0.15), (0.0, 0.2)):
            cyl(ox, oy, 0.2, 0.015, 0.12, 'leaf2'); leaves(3, 0.2, 0.3, 'leaf2', ox, oy)
        return
    big = st == 2
    if c == 'carrot':
        for x in (-0.22, 0, 0.22):
            for k in range(4): a = k * 1.57; ball(x + 0.04 * math.cos(a), 0.04 * math.sin(a), 0.42 + 0.1 * big, 0.04, 0.04, 0.2 + 0.08 * big, 'leaf2').rotation_euler = (R(20) * math.cos(a), R(20) * math.sin(a), 0)
            if big or st == 1:
                bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.08 + 0.03 * big, depth=0.25, location=(x, 0, 0.27), rotation=(R(180), 0, 0)); put(bpy.context.object, 'orange', True)
    elif c == 'strawberry':
        leaves(6, 0.3 + 0.08 * big)
        for k in range(4 if big else 2):
            a = k * 1.6 + 0.3; ball(0.2 * math.cos(a), 0.2 * math.sin(a), 0.3, 0.07, 0.07, 0.09, 'berry' if big else 'unripe')
    elif c == 'tomato':
        cyl(0, 0, 0.2, 0.02, 0.6 + 0.2 * big, 'leaf'); ball(0, 0, 0.55 + 0.1 * big, 0.3, 0.3, 0.32, 'leaf'); ball(0.1, -0.1, 0.75, 0.2, 0.2, 0.2, 'leaf2')
        for k in range(5 if big else 3):
            a = k * 1.3 - 1.4; ball(0.27 * math.cos(a), 0.27 * math.sin(a), 0.45 + 0.12 * (k % 3), 0.09, 0.09, 0.085, 'red' if big else 'unripe')
    elif c == 'blueberry':
        ball(0, 0, 0.4, 0.32, 0.32, 0.26, 'leaf'); ball(-0.1, 0.1, 0.55, 0.2, 0.2, 0.16, 'leaf2')
        for k in range(10 if big else 4):
            a = k * 0.7 - 1.8; ball(0.3 * math.cos(a), 0.3 * math.sin(a), 0.35 + 0.08 * (k % 3), 0.045, 0.045, 0.045, 'blue' if big else 'unripe')
    elif c == 'corn':
        for x in (-0.22, 0, 0.22):
            cyl(x, 0, 0.2, 0.03, 0.6 + 0.5 * big, 'leaf')
            for k in range(3): ball(x + 0.1 * (k - 1), 0.0, 0.4 + 0.25 * k, 0.18, 0.04, 0.03, 'leaf2').rotation_euler = (0, R(-30 + 30 * k), k * 2.0)
            if big: ball(x + 0.06, -0.05, 0.75, 0.05, 0.05, 0.14, 'yellow'); ball(x + 0.07, -0.04, 0.72, 0.055, 0.04, 0.12, 'leaf2')
    elif c == 'sunflower':
        cyl(0, 0, 0.2, 0.035, 0.5 + 0.7 * big, 'leaf'); ball(0.1, 0, 0.5, 0.16, 0.05, 0.06, 'leaf2'); ball(-0.1, 0, 0.75, 0.16, 0.05, 0.06, 'leaf2')
        if big:
            for j in range(12): a = j * 0.524; ball(0.17 * math.cos(a), -0.03, 1.38 + 0.17 * math.sin(a), 0.08, 0.02, 0.04, 'yellow').rotation_euler = (0, -a, 0)
            ball(0, -0.05, 1.38, 0.12, 0.04, 0.12, 'brown')
        else: ball(0, 0, 0.75, 0.08, 0.08, 0.08, 'unripe')
    elif c == 'watermelon':
        leaves(6, 0.35)
        if big: ball(0, 0, 0.42, 0.42, 0.3, 0.24, 'melon'); [ball(0, 0, 0.42, 0.425, 0.06 + 0.0, 0.245, 'leaf2').__setattr__('rotation_euler', (0, 0, R(a))) for a in (0, 60, 120)]
        else: ball(0, 0, 0.32, 0.14, 0.11, 0.1, 'unripe')
    elif c == 'pumpkin':
        leaves(6, 0.35)
        if big:
            for k in range(6): a = k * 1.047; ball(0.12 * math.cos(a), 0.12 * math.sin(a), 0.45, 0.24, 0.24, 0.22, 'orange').rotation_euler = (0, 0, a)
            cyl(0, 0, 0.62, 0.035, 0.14, 'brown')
        else: ball(0, 0, 0.32, 0.13, 0.12, 0.1, 'unripe')

FISH_TINT = {'minnow': (0.75, 0.78, 0.82), 'perch': (0.62, 0.70, 0.30), 'sunfish': (1.0, 0.62, 0.25), 'catfish': (0.45, 0.36, 0.28),
             'trout': (0.95, 0.65, 0.70), 'koi': (1.0, 0.45, 0.25), 'pike': (0.35, 0.55, 0.32), 'golden': (1.0, 0.78, 0.2)}
