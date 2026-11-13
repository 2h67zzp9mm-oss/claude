# Smooth building blocks shared by the Night Forest and Pirate Cove worlds (Hazel: no bumps on anything).
# Loaded by homestead.py with exec() after castle_world.py; mat() is whichever the world defines.
from mathutils import Vector, Quaternion
def revolve(cx, cy, z0, prof, col, n=56, name='rev'):
    # spin a side profile [(radius, height), ...] (bottom to top) round a vertical axis: one smooth surface
    bm = bmesh.new(); rings = []
    for (r, z) in prof: rings.append([bm.verts.new((cx + max(r, 0.001) * math.cos(2 * math.pi * k / n), cy + max(r, 0.001) * math.sin(2 * math.pi * k / n), z0 + z)) for k in range(n)])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(n): bm.faces.new((r0[k], r0[(k + 1) % n], r1[(k + 1) % n], r1[k]))
    if prof[0][0] > 0.01: bm.faces.new(rings[0][::-1])
    if prof[-1][0] > 0.01: bm.faces.new(rings[-1])
    me = bpy.data.meshes.new(name); bm.to_mesh(me)
    for f in me.polygons: f.use_smooth = True
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); o.data.materials.append(mat(col)); return o
def surf(prof, t):
    # point and outward slope along a profile at fraction t (0 bottom .. 1 top)
    seg = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(prof, prof[1:])]; d = t * sum(seg)
    for (a, b), s in zip(zip(prof, prof[1:]), seg):
        if d <= s or s == seg[-1]:
            u = min(1, d / s) if s else 0; r, z = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
            return r, z, (b[1] - a[1], -(b[0] - a[0]))
        d -= s
def on_profile(cx, cy, z0, prof, a, t, sx, sz, col, out=0.0):
    # a flattened ball lying on a revolved surface (spots on a mushroom cap)
    r, z, (nr, nz) = surf(prof, t); L = math.hypot(nr, nz) or 1; nr, nz = nr / L, nz / L
    o = ball(cx + (r + nr * out) * math.cos(a), cy + (r + nr * out) * math.sin(a), z0 + z + nz * out, sx, sx, sz, col)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((nr * math.cos(a), nr * math.sin(a), nz)).to_track_quat('Z', 'X'); return o
def disc(x, y, z, a, r, col, depth=0.08, tilt=90):
    # a round flat thing facing outward at angle a (windows, frames)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=depth, location=(x, y, z), rotation=(0, R(tilt), a)); return put(bpy.context.object, col, True)
def round_window(cx, cy, z, a, r, wr=0.3, frame='doorframe', cross=True):
    x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
    disc(x, y, z, a, wr + 0.07, frame, 0.1)
    disc(x + math.cos(a) * 0.03, y + math.sin(a) * 0.03, z, a, wr, 'window', 0.1)
    if cross:
        for (w, h) in ((0.035, wr), (wr, 0.035)):
            o = box(-0.03, -w, -h, 0.03, w, h, frame); o.location = (x + math.cos(a) * 0.08, y + math.sin(a) * 0.08, z); o.rotation_euler = (0, 0, a)
def arched_door(x, dy, z=0.25, w=0.45, h=1.25, frame='doorframe', col='door'):
    box(x - 0.12, dy - w - 0.08, z, x + 0.05, dy + w + 0.08, z + h, frame); box(x - 0.1, dy - w, z, x + 0.08, dy + w, z + h, col)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=w + 0.08, depth=0.17, location=(x - 0.03, dy, z + h), rotation=(0, R(90), 0)); put(bpy.context.object, frame)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=w, depth=0.18, location=(x - 0.01, dy, z + h), rotation=(0, R(90), 0)); put(bpy.context.object, col)
    for k in (-1, 1): box(x + 0.07, dy + k * w * 0.4 - 0.015, z + 0.05, x + 0.09, dy + k * w * 0.4 + 0.015, z + h + w * 0.8, 'doorframe')
    ball(x + 0.11, dy + w * 0.6, z + h * 0.55, 0.05, 0.05, 0.05, 'gold')
    disc(x + 0.1, dy, z + h + 0.12, 0, 0.14, 'window', 0.04)   # little round glowing peephole
def steps(x, dy, w=0.8, col='stone'):
    for k, (d, z) in enumerate(((0.0, 0.26), (0.3, 0.17), (0.6, 0.08))): rbox(x + d - 0.05, dy - w, 0, x + d + 0.32, dy + w, z, col, 0.04)
def lantern(x, y, z, s=1.0):
    cyl(x, y, z + 0.3 * s, 0.012, 0.25 * s, 'wooddark')
    rbox(x - 0.09 * s, y - 0.09 * s, z, x + 0.09 * s, y + 0.09 * s, z + 0.24 * s, 'lampglow', 0.02)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.15 * s, depth=0.12 * s, location=(x, y, z + 0.3 * s), rotation=(0, 0, R(45))); put(bpy.context.object, 'wooddark')
    rbox(x - 0.1 * s, y - 0.1 * s, z - 0.04 * s, x + 0.1 * s, y + 0.1 * s, z, 'wooddark', 0.01)
