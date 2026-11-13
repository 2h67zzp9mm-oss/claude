# Pets for the home plot: cute, smooth, original animals, rendered in plain white (tinted by the game) with a
# colour-region map (red = body colour, magenta = keep: eyes, horn, mane, belly...). Same camera as the walkers.
# blender -b --python art/blender/pets.py -- OUTDIR [species,...]
#   -> OUTDIR/<species>/{base,mask}/d<dir>_f<frame>.png + layers.json   (pack with art/build_avatars.py)
import bpy, sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import walker as W
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
R = math.radians
args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
WHITE = (0.86, 0.85, 0.83)

def body_mat():
    m = W.mat(WHITE, 0.6); m['pet'] = 'body'; return m
def keep(col, rough=0.5, glow=0):
    return W.mat(col, rough, glow)
def cone(parent, loc, r, h, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=r, depth=h, location=(0, 0, 0))
    o = bpy.context.object; bpy.ops.object.shade_smooth(); o.parent = parent; o.location = loc; o.rotation_euler = rot; o.data.materials.append(m); return o
def eyes(head, y, z, sx, r, dark=(0.05, 0.04, 0.06)):
    ink, shine = keep(dark, 0.2), keep((1, 1, 1), 0.2, 2.0)
    for s in (-1, 1):
        W.blob(head, (s * sx, y, z), (r, r * 0.6, r * 1.15), ink)
        W.blob(head, (s * sx + 0.25 * r, y - 0.5 * r, z + 0.45 * r), (r * 0.32, r * 0.2, r * 0.32), shine)
def legs(parent, J, spots, length, r, m, foot=None):
    for i, (x, y, z) in enumerate(spots):
        hp = W.empty('leg%d' % i, parent, (x, y, z)); J['leg%d' % i] = hp
        W.limb(hp, length, r, r * 0.9, m)
        if foot: W.blob(hp, (0, -0.01, -length - r * 0.4), (r * 1.15, r * 1.3, r * 0.7), foot)
def tail_chain(parent, pts, r0, r1, m):   # one smooth tapered tube through the points, rounded at the tip
    cu = bpy.data.curves.new('tail', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 1.0; cu.bevel_resolution = 5; cu.use_fill_caps = True; cu.resolution_u = 12
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1); sp.use_endpoint_u = True; sp.order_u = min(4, len(pts))
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1); sp.points[i].radius = r0 + (r1 - r0) * i / max(1, len(pts) - 1)
    o = bpy.data.objects.new('tail', cu); bpy.context.scene.collection.objects.link(o); o.data.materials.append(m)
    for x in bpy.context.selected_objects: x.select_set(False)
    bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.convert(target='MESH'); bpy.ops.object.shade_smooth()
    o.parent = parent
    W.blob(parent, pts[-1], (r1, r1, r1), m); W.blob(parent, pts[0], (r0, r0, r0), m)
    return o

def build(kind):
    B = body_mat(); root = W.empty('root', None, (0, 0, 0)); J = {'root': root}
    body = W.empty('body', root, (0, 0, 0)); J['body'] = body
    pink = keep((1.0, 0.55, 0.65), 0.4); cream = keep((0.97, 0.92, 0.82), 0.6); white = keep((0.97, 0.97, 0.97), 0.6)
    if kind in ('kitty', 'fox', 'puppy'):
        W.blob(body, (0, 0.02, 0.2), (0.11, 0.17, 0.11), B)                                      # body
        head = W.empty('head', body, (0, -0.17, 0.34)); J['head'] = head
        W.blob(head, (0, 0, 0), (0.13, 0.12, 0.115), B)
        legs(body, J, [(-0.06, -0.1, 0.14), (0.06, -0.1, 0.14), (-0.06, 0.13, 0.14), (0.06, 0.13, 0.14)], 0.1, 0.033, B)
        if kind == 'kitty':
            for s in (-1, 1): cone(head, (s * 0.075, 0.0, 0.105), 0.045, 0.09, B, (0, R(s * 18), 0)); cone(head, (s * 0.075, -0.012, 0.1), 0.025, 0.06, pink, (0, R(s * 18), 0))
            W.blob(head, (0, -0.1, -0.03), (0.055, 0.035, 0.035), white); W.blob(head, (0, -0.125, -0.005), (0.016, 0.01, 0.012), pink)
            tail_chain(body, [(0, 0.19, 0.22), (0, 0.24, 0.27), (0, 0.26, 0.33), (0.01, 0.25, 0.39), (0.03, 0.22, 0.43)], 0.03, 0.026, B)
            eyes(head, -0.1, 0.02, 0.05, 0.026)
        elif kind == 'fox':
            for s in (-1, 1): cone(head, (s * 0.07, 0.0, 0.115), 0.05, 0.12, B, (0, R(s * 15), 0)); cone(head, (s * 0.07, -0.014, 0.11), 0.028, 0.08, white, (0, R(s * 15), 0))
            W.blob(head, (0, -0.12, -0.035), (0.05, 0.08, 0.04), white); W.blob(head, (0, -0.2, -0.03), (0.016, 0.012, 0.014), keep((0.05, 0.04, 0.06), 0.2))
            W.blob(body, (0, -0.12, 0.2), (0.07, 0.05, 0.08), white)                              # white chest
            tail_chain(body, [(0, 0.15, 0.22), (0, 0.26, 0.24), (0, 0.34, 0.3), (0, 0.38, 0.37)], 0.04, 0.065, B); W.blob(body, (0, 0.4, 0.42), (0.06, 0.06, 0.06), white)  # bushy tail, white tip
            eyes(head, -0.095, 0.025, 0.05, 0.024)
        else:   # puppy
            W.blob(head, (0, -0.12, -0.03), (0.06, 0.06, 0.045), cream); W.blob(head, (0, -0.175, -0.01), (0.022, 0.015, 0.016), keep((0.05, 0.04, 0.06), 0.2))
            for s in (-1, 1): W.blob(head, (s * 0.12, 0.01, 0.0), (0.03, 0.05, 0.09), B, (R(10), R(s * -20), 0))   # floppy ears
            W.blob(body, (0, 0.2, 0.28), (0.025, 0.025, 0.07), B, (R(-30), 0, 0))
            W.blob(head, (0, -0.135, -0.07), (0.025, 0.012, 0.02), pink)                            # tongue
            eyes(head, -0.1, 0.03, 0.05, 0.026)
    elif kind == 'bunny':
        W.blob(body, (0, 0.03, 0.17), (0.13, 0.15, 0.13), B)
        head = W.empty('head', body, (0, -0.12, 0.31)); J['head'] = head
        W.blob(head, (0, 0, 0), (0.115, 0.105, 0.1), B)
        for s in (-1, 1): W.blob(head, (s * 0.045, 0.02, 0.17), (0.035, 0.02, 0.12), B, (R(-8), R(s * 10), 0)); W.blob(head, (s * 0.045, 0.0, 0.17), (0.02, 0.01, 0.09), pink, (R(-8), R(s * 10), 0))
        W.blob(head, (0, -0.095, -0.02), (0.04, 0.03, 0.03), white); W.blob(head, (0, -0.11, 0.0), (0.014, 0.01, 0.01), pink)
        W.blob(body, (0, 0.18, 0.18), (0.05, 0.05, 0.05), white)                                  # puff tail
        legs(body, J, [(-0.05, -0.08, 0.08), (0.05, -0.08, 0.08), (-0.08, 0.1, 0.08), (0.08, 0.1, 0.08)], 0.05, 0.035, B, B)
        eyes(head, -0.09, 0.025, 0.048, 0.024)
    elif kind == 'unicorn':
        gold = keep((0.95, 0.75, 0.3), 0.25); mane = [keep(c, 0.5) for c in ((1.0, 0.6, 0.8), (0.75, 0.6, 1.0), (0.6, 0.85, 1.0))]
        W.blob(body, (0, 0.02, 0.36), (0.12, 0.22, 0.12), B)
        legs(body, J, [(-0.06, -0.13, 0.3), (0.06, -0.13, 0.3), (-0.06, 0.16, 0.3), (0.06, 0.16, 0.3)], 0.26, 0.032, B, gold)
        W.blob(body, (0, -0.2, 0.48), (0.06, 0.07, 0.13), B, (R(-30), 0, 0))                      # neck
        head = W.empty('head', body, (0, -0.28, 0.62)); J['head'] = head
        W.blob(head, (0, 0, 0), (0.085, 0.1, 0.085), B); W.blob(head, (0, -0.08, -0.03), (0.06, 0.07, 0.055), B)
        for s in (-1, 1): cone(head, (s * 0.05, 0.03, 0.085), 0.025, 0.07, B, (0, R(s * 15), 0))
        cone(head, (0, -0.02, 0.15), 0.025, 0.17, gold, (R(-15), 0, 0))                           # horn
        for j, dx in enumerate((-0.018, 0.0, 0.018)): tail_chain(body, [(dx, -0.3, 0.72), (dx, -0.24, 0.66), (dx, -0.18, 0.56), (dx, -0.13, 0.47)], 0.03, 0.022, mane[j])   # flowing mane
        tail_chain(body, [(0.012, 0.22, 0.42), (0.012, 0.3, 0.38), (0.012, 0.34, 0.28), (0.012, 0.33, 0.18)], 0.04, 0.03, mane[0]); tail_chain(body, [(-0.012, 0.22, 0.42), (-0.012, 0.29, 0.36), (-0.012, 0.31, 0.26), (-0.012, 0.29, 0.17)], 0.035, 0.028, mane[1])
        eyes(head, -0.07, 0.015, 0.055, 0.022)
    elif kind == 'dragon':
        horn = keep((0.98, 0.92, 0.75), 0.4)
        W.blob(body, (0, 0.02, 0.22), (0.13, 0.17, 0.13), B); W.blob(body, (0, -0.06, 0.2), (0.1, 0.1, 0.11), cream)   # body, cream tummy
        head = W.empty('head', body, (0, -0.16, 0.4)); J['head'] = head
        W.blob(head, (0, 0, 0), (0.12, 0.115, 0.11), B); W.blob(head, (0, -0.1, -0.03), (0.07, 0.06, 0.05), B)
        for s in (-1, 1): cone(head, (s * 0.06, 0.03, 0.1), 0.022, 0.08, horn, (R(-25), R(s * 15), 0)); W.blob(head, (s * 0.025, -0.155, -0.015), (0.008, 0.006, 0.006), keep((0.2, 0.1, 0.1)))
        for s in (-1, 1): W.blob(body, (s * 0.16, 0.08, 0.34), (0.14, 0.012, 0.09), B, (0, R(-s * 25), R(s * 25)))   # little wings
        legs(body, J, [(-0.07, -0.08, 0.12), (0.07, -0.08, 0.12), (-0.07, 0.12, 0.12), (0.07, 0.12, 0.12)], 0.07, 0.04, B)
        tail_chain(body, [(0, 0.2, 0.15), (0, 0.27, 0.12), (0, 0.33, 0.1), (0, 0.38, 0.09)], 0.05, 0.025, B)
        cone(body, (0, 0.42, 0.09), 0.03, 0.06, horn, (R(-90), 0, 0))
        for i in range(3): cone(body, (0, 0.0 + i * 0.08, 0.35 - i * 0.02), 0.022, 0.05, horn)  # back spikes
        eyes(head, -0.095, 0.03, 0.05, 0.026)
    return J

def pose(J, t):   # a happy little hop
    c, s = math.cos(2 * math.pi * t), math.sin(2 * math.pi * t)
    J['body'].location.z = 0.05 * abs(s); J['body'].rotation_euler.x = R(-5 * s)
    for i in range(4):
        if 'leg%d' % i in J: J['leg%d' % i].rotation_euler.x = R((20 if i < 2 else -20) * c * (1 if i % 2 else -1))
    if 'head' in J: J['head'].rotation_euler.x = R(4 * s)
def stand(J):
    J['body'].location.z = 0; J['body'].rotation_euler.x = 0
    for i in range(4):
        if 'leg%d' % i in J: J['leg%d' % i].rotation_euler.x = 0
    if 'head' in J: J['head'].rotation_euler = (R(-4), 0, R(8))

def flat(col):
    m = bpy.data.materials.new('flat'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*col, 1); o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], o.inputs[0]); return m

def render_all(sc, J, folder, kind):
    os.makedirs(os.path.join(OUT, kind, folder), exist_ok=True)
    for d in range(W.DIRS):
        J['root'].rotation_euler.z = R(45 - 45 * d)
        for f in range(W.FRAMES):
            pose(J, f / W.FRAMES)
            sc.render.filepath = os.path.join(OUT, kind, folder, 'd%d_f%d.png' % (d, f)); bpy.ops.render.render(write_still=True)
        stand(J); sc.render.filepath = os.path.join(OUT, kind, folder, 'd%d_f%d.png' % (d, W.FRAMES)); bpy.ops.render.render(write_still=True)

KINDS = args[1].split(',') if len(args) > 1 else ['kitty', 'bunny', 'puppy', 'fox', 'unicorn', 'dragon']
for kind in KINDS:
    sc, cam = W.reset(); J = build(kind)
    v = world_to_camera_view(sc, cam, Vector((0, 0, 0)))
    render_all(sc, J, 'base', kind)
    red, mag = flat((1, 0, 0)), flat((1, 0, 1))
    for o in sc.objects:
        if o.type == 'MESH' and o.data.materials: o.data.materials[0] = red if o.data.materials[0].get('pet') == 'body' else mag
    sc.eevee.taa_render_samples = 1; sc.render.filter_size = 0.01
    render_all(sc, J, 'mask', kind)
    json.dump({'ax': round(v.x * W.CW, 1), 'ay': round((1 - v.y) * W.CH, 1), 'layers': ['base']}, open(os.path.join(OUT, kind, 'layers.json'), 'w'), indent=1)
