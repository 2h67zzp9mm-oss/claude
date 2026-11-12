# Little Town walkers (copied from Isles of Gods, own original models): 8 directions x 4 walk frames, rendered at the home plot's camera.
# blender -b --python art/blender/walker.py -- OUTDIR [outfit]   (outfit: clay = white template, townsman, ...)
#   -> OUTDIR/walker_male_guide.png, walker_female_guide.png  (8 columns = directions, 4 rows = walk frames, on magenta)
#   -> OUTDIR/<sex>/d<dir>_f<frame>.png (transparent) + anchors.json
# Columns (screen directions): 0 S (toward viewer), 1 SW, 2 W, 3 NW, 4 N (away), 5 NE, 6 E, 7 SE.
import bpy, math, sys, json, os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
OUT = sys.argv[sys.argv.index('--') + 1]; os.makedirs(OUT, exist_ok=True)
CW, CH, DIRS, FRAMES = 192, 256, 8, 4
R = math.radians

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE'; sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = CW, CH; sc.view_settings.view_transform = 'Standard'
    sc.render.filter_size = 1.2
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.62, 0.68, 0.78, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.45
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 2.5
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    co.rotation_euler = (R(60), 0, R(45)); d = Vector((0, 0, 1)); d.rotate(co.rotation_euler); co.location = Vector((0, 0, 0.88)) + d * 20
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 3.2; sun.angle = R(10); so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
    so.rotation_euler = (R(50), 0, R(-20))
    return sc, co

def mat(col, rough=0.55, glow=0):
    m = bpy.data.materials.new('clay'); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*col, 1); p.inputs['Roughness'].default_value = rough
    if glow: p.inputs['Base Color'].default_value = (*[c * 0.2 for c in col], 1); p.inputs['Emission Color'].default_value = (*col, 1); p.inputs['Emission Strength'].default_value = glow
    return m

def empty(name, parent, loc):
    e = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(e); e.parent = parent; e.location = loc; return e

def blob(parent, loc, size, m, rot=(0, 0, 0)):  # smooth ellipsoid body part
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14, radius=1, location=(0, 0, 0))
    o = bpy.context.object; o.scale = size; o.rotation_euler = rot; bpy.ops.object.shade_smooth()
    o.parent = parent; o.location = loc; o.data.materials.append(m); return o

def limb(parent, length, r0, r1, m):  # tapered segment hanging down from a joint
    r0, r1 = r0 * 1.35, r1 * 1.35
    blob(parent, (0, 0, -length / 2), (r0 * 0.5 + r1 * 0.5, r0 * 0.5 + r1 * 0.5, length / 2 + 0.02), m)
    blob(parent, (0, 0, 0), (r0, r0, r0), m)

OUTFITS = {  # colours per body region; 'clay' is the plain white template
  'clay': dict(skin=(0.82, 0.80, 0.76), shirt=(0.82, 0.80, 0.76), pants=(0.82, 0.80, 0.76), boots=(0.82, 0.80, 0.76), belt=(0.82, 0.80, 0.76),
               hat=None, hair=(0.42, 0.40, 0.38), eye=(0.42, 0.40, 0.38), beard=None, sex='both'),
  'townsman': dict(skin=(0.78, 0.52, 0.36), shirt=(0.80, 0.70, 0.50), pants=(0.36, 0.25, 0.15), boots=(0.13, 0.09, 0.06), belt=(0.22, 0.13, 0.07),
               hat=(0.62, 0.10, 0.07), hair=(0.20, 0.12, 0.07), eye=(0.06, 0.04, 0.03), beard=(0.22, 0.13, 0.08), sex='male', sleeves='rolled'),
  'lady': dict(skin=(0.86, 0.64, 0.50), shirt=(0.93, 0.89, 0.80), pants=(0.62, 0.30, 0.42), boots=(0.30, 0.18, 0.10), belt=(0.85, 0.72, 0.40),
               hat=None, hair=(0.45, 0.24, 0.10), eye=(0.06, 0.04, 0.03), beard=None, sex='female', skirt=(0.62, 0.30, 0.42), sleeves='rolled'),
  'farmer': dict(skin=(0.74, 0.50, 0.34), shirt=(0.58, 0.72, 0.48), pants=(0.50, 0.42, 0.30), boots=(0.25, 0.17, 0.10), belt=(0.30, 0.20, 0.10),
               hat=(0.90, 0.78, 0.45), hair=(0.35, 0.22, 0.12), eye=(0.06, 0.04, 0.03), beard=None, sex='male', hatk='straw', sleeves='rolled'),
  'guard': dict(skin=(0.70, 0.48, 0.33), shirt=(0.18, 0.28, 0.55), pants=(0.85, 0.82, 0.74), boots=(0.10, 0.08, 0.06), belt=(0.85, 0.70, 0.25),
               hat=(0.12, 0.10, 0.10), hair=(0.10, 0.08, 0.06), eye=(0.06, 0.04, 0.03), beard=(0.12, 0.09, 0.07), sex='male', hatk='tricorn', coat=(0.18, 0.28, 0.55)),
  'porter': dict(skin=(0.55, 0.36, 0.24), shirt=(0.90, 0.88, 0.82), pants=(0.32, 0.36, 0.45), boots=(0.20, 0.14, 0.08), belt=(0.25, 0.15, 0.08),
               hat=None, hair=(0.08, 0.06, 0.05), eye=(0.04, 0.03, 0.02), beard=None, sex='male', vest=(0.50, 0.32, 0.18), sleeves='rolled'),
  'trader': dict(skin=(0.80, 0.58, 0.42), shirt=(0.95, 0.92, 0.85), pants=(0.25, 0.20, 0.18), boots=(0.15, 0.10, 0.07), belt=(0.85, 0.70, 0.25),
               hat=(0.40, 0.12, 0.30), hair=(0.55, 0.55, 0.55), eye=(0.06, 0.04, 0.03), beard=(0.60, 0.60, 0.60), sex='male', hatk='tricorn', coat=(0.40, 0.12, 0.30)),
  'clay_kid': dict(skin=(0.82, 0.80, 0.76), shirt=(0.82, 0.80, 0.76), pants=(0.82, 0.80, 0.76), boots=(0.82, 0.80, 0.76), belt=(0.82, 0.80, 0.76),
               hat=None, hair=(0.42, 0.40, 0.38), eye=(0.42, 0.40, 0.38), beard=None, sex='both', scale=0.66, kid=True),
  # Sci-fi world space suits (accent colour per walker: dad, mum, kids)
  'space': dict(skin=(0.30, 0.85, 0.85), shirt=(0.92, 0.88, 0.80), pants=(0.92, 0.88, 0.80), boots=(0.30, 0.85, 0.85), belt=(0.30, 0.85, 0.85),
               hat=None, hair=(0.2, 0.2, 0.2), eye=(0.1, 0.1, 0.1), beard=None, sex='both', space=True,
               accent_m=(0.15, 0.80, 0.85), accent_f=(0.95, 0.35, 0.70)),
  'space_kid': dict(skin=(1.0, 0.55, 0.15), shirt=(0.92, 0.88, 0.80), pants=(0.92, 0.88, 0.80), boots=(1.0, 0.55, 0.15), belt=(1.0, 0.55, 0.15),
               hat=None, hair=(0.2, 0.2, 0.2), eye=(0.1, 0.1, 0.1), beard=None, sex='both', space=True, scale=0.66, kid=True,
               accent_m=(1.0, 0.55, 0.15), accent_f=(0.70, 0.40, 1.0)),
  # Little Town's family (colours from their in-game looks)
  'sean': dict(skin=(0.93, 0.78, 0.66), shirt=(0.05, 0.20, 0.48), pants=(0.30, 0.30, 0.34), boots=(0.20, 0.14, 0.10), belt=(0.25, 0.17, 0.10),
               hat=None, hair=(0.30, 0.20, 0.13), eye=(0.06, 0.04, 0.03), beard=(0.36, 0.24, 0.15), sex='male', bald=True),
  'olive': dict(skin=(0.93, 0.78, 0.66), shirt=(0.38, 0.10, 0.49), pants=(0.20, 0.22, 0.32), boots=(0.92, 0.92, 0.95), belt=(0.20, 0.22, 0.32),
               hat=None, hair=(0.33, 0.20, 0.11), eye=(0.06, 0.04, 0.03), beard=None, sex='female', hairk='short', glasses=(0.12, 0.10, 0.12), scale=0.9),
  'hazel': dict(skin=(0.95, 0.78, 0.65), shirt=(0.83, 0.34, 1.0), pants=(0.89, 0.57, 1.0), boots=(1.0, 0.88, 0.54), belt=(0.83, 0.34, 1.0),
               hat=None, hair=(0.55, 0.34, 0.18), eye=(0.06, 0.04, 0.03), beard=None, sex='female', hairk='long', bow=(1.0, 0.45, 0.65), scale=0.66, kid=True),
}
def build(sex, O):
    F = sex == 'female' and not O.get('kid');   # children get a plain child's body
    G = sex == 'female'                          # (still used for hair / trim colour)
    BUFF = sex == 'male' and not O.get('kid'); lin = (lambda c: c) if O.get('name', '').startswith('clay') else (lambda c: tuple(x ** 2.2 for x in c))  # outfit colours are sRGB
    if O.get('space'):  # trim colour for this walker: gloves, boots, belt
        acc = O['accent_f' if G else 'accent_m']; O = dict(O, skin=acc, boots=acc, belt=acc, bald=True)
    M = {k: mat(lin(v), 0.75 if k in ('shirt', 'pants', 'hat') else 0.55) for k, v in O.items() if isinstance(v, tuple)}
    skin, shirt, pants, boots, belt, hair, eye = (M[k] for k in ('skin', 'shirt', 'pants', 'boots', 'belt', 'hair', 'eye'))
    s = O.get('scale', 0.95 if F else 1.0)  # overall scale
    root = empty('root', None, (0, 0, 0)); root.scale = (s, s, s)
    hips = empty('hips', root, (0, 0, 0.92)); J = {'root': root, 'hips': hips}
    blob(hips, (0, 0, 0.02), (0.21 if F else 0.16, 0.13 if F else 0.12, 0.13 if F else 0.12), pants)  # pelvis
    if F:
        for sx in (-1, 1): blob(hips, (sx * 0.08, 0.06, -0.02), (0.1, 0.09, 0.1), pants)          # seat
    spine = empty('spine', hips, (0, 0, 0.08)); J['spine'] = spine
    blob(spine, (0, 0, 0.12), (0.12 if F else 0.16, 0.10 if F else 0.12, 0.14), shirt)  # waist
    if 'clay' not in O.get('name', ''): blob(spine, (0, 0, 0.02), (0.165 if not F else 0.13, 0.125 if not F else 0.105, 0.03), belt)  # belt
    blob(spine, (0, 0, 0.33), (0.18 if F else (0.27 if BUFF else 0.22), 0.14 if not BUFF else 0.17, 0.18 if not BUFF else 0.2), shirt)  # chest (broad for grown men)
    if BUFF:
        for sx in (-1, 1): blob(spine, (sx * 0.2, 0, 0.42), (0.1, 0.1, 0.09), shirt)             # shoulders
    if F:
        for sx in (-1, 1): blob(spine, (sx * 0.07, -0.1, 0.33), (0.08, 0.075, 0.075), shirt)
    blob(spine, (0, 0, 0.53), (0.065 if BUFF else 0.05, 0.065 if BUFF else 0.05, 0.07), skin)   # neck
    head = empty('head', spine, (0, 0, 0.66)); J['head'] = head
    if O.get('kid'): head.scale = (1.3, 1.3, 1.3)
    blob(head, (0, 0, 0.05), (0.13, 0.14, 0.155), skin)                                        # skull
    blob(head, (0, -0.14, 0.04), (0.03, 0.04, 0.035), skin)                                     # nose (shows facing)
    for sx in (-1, 1): blob(head, (sx * 0.05, -0.122, 0.08), (0.02, 0.012, 0.022), eye)        # eyes
    for sx in (-1, 1): blob(head, (sx * 0.13, 0, 0.04), (0.022, 0.038, 0.045), skin)           # ears
    if O.get('beard'): blob(head, (0, -0.08, -0.04), (0.105, 0.08, 0.075), M['beard'])          # beard
    if O.get('glasses'):
        g = M['glasses']
        for sx in (-1, 1): blob(head, (sx * 0.05, -0.128, 0.08), (0.034, 0.008, 0.03), g)       # lenses' rims
        blob(head, (0, -0.135, 0.085), (0.02, 0.006, 0.006), g)
    if O.get('bald'): pass
    elif O.get('hairk') == 'short':
        blob(head, (0, 0.03, 0.09), (0.145, 0.15, 0.13), hair); blob(head, (0, 0.06, -0.01), (0.14, 0.11, 0.1), hair)  # bob
    elif O.get('hairk') == 'long':
        blob(head, (0, 0.03, 0.1), (0.145, 0.15, 0.125), hair); blob(head, (0, 0.09, -0.1), (0.13, 0.08, 0.18), hair)  # long down the back
        if O.get('bow'): blob(head, (0.09, 0.05, 0.17), (0.06, 0.03, 0.04), M['bow']); blob(head, (0.09, 0.05, 0.17), (0.02, 0.035, 0.02), M['bow'])
    elif G:
        blob(head, (0, 0.03, 0.1), (0.14, 0.145, 0.125), hair)                                  # hair cap
        blob(head, (0, 0.15, 0.07), (0.08, 0.075, 0.08), hair)                                 # bun
        blob(head, (0, 0.17, -0.1), (0.05, 0.05, 0.13), hair)                                   # ponytail
    elif not O.get('bald'):
        blob(head, (0, 0.025, 0.1), (0.135, 0.14, 0.1), hair)                                   # short hair
    if O.get('skirt'):  # long skirt from the waist to the shins
        blob(hips, (0, 0.01, -0.22), (0.25, 0.22, 0.34), M['skirt']); blob(hips, (0, 0.01, -0.48), (0.27, 0.24, 0.12), M['skirt'])
    if O.get('vest'):
        blob(spine, (0, 0, 0.3), (0.235, 0.15, 0.2), M['vest'])
    if O.get('coat'):  # long coat: body plus tails over the hips
        blob(spine, (0, 0, 0.3), (0.235, 0.155, 0.21), M['coat']); blob(hips, (0, 0.03, -0.12), (0.2, 0.15, 0.22), M['coat'])
    if O.get('hatk') == 'straw':
        h = M['hat']; blob(head, (0, 0, 0.13), (0.15, 0.155, 0.11), h); blob(head, (0, 0, 0.12), (0.3, 0.3, 0.025), h)
    elif O.get('hatk') == 'tricorn':
        h = M['hat']; blob(head, (0, 0, 0.14), (0.15, 0.155, 0.11), h)
        for a in (0, 120, 240): blob(head, (0.13 * math.sin(R(a)), -0.13 * math.cos(R(a)), 0.15), (0.14, 0.06, 0.06), h, (R(15), 0, R(-a)))
    elif O.get('hat'):  # bandana: snug cap plus a knot and two tails at the back
        h = M['hat']; blob(head, (0, 0.01, 0.12), (0.142, 0.15, 0.1), h); blob(head, (0, 0.15, 0.1), (0.045, 0.04, 0.04), h)
        for sx in (-1, 1): blob(head, (sx * 0.03, 0.17, 0.03), (0.025, 0.02, 0.07), h, (R(-25), R(sx * 15), 0))
    if O.get('space'):  # round helmet with a glowing visor, backpack and a chest light
        acc = lin(O['skin'])
        blob(head, (0, 0, 0.05), (0.2, 0.2, 0.2), mat(lin((0.94, 0.91, 0.85)), 0.3))
        blob(head, (0, -0.1, 0.06), (0.16, 0.12, 0.13), mat(lin((0.10, 0.55, 0.75)), 0.15, 0.6))
        blob(head, (0, 0, -0.13), (0.15, 0.15, 0.04), mat(acc, 0.4))                            # helmet collar
        blob(head, (0.1, 0.05, 0.25), (0.012, 0.012, 0.06), mat(acc, 0.4)); blob(head, (0.1, 0.05, 0.32), (0.025, 0.025, 0.025), mat(acc, 0.3, 1.5))  # antenna
        blob(spine, (0, 0.17, 0.3), (0.16, 0.08, 0.19), mat(lin((0.80, 0.76, 0.70)), 0.4))     # backpack
        for sx in (-1, 1): blob(spine, (sx * 0.08, 0.25, 0.38), (0.025, 0.012, 0.025), mat(acc, 0.3, 1.5))
        blob(spine, (0, -0.15, 0.36), (0.05, 0.02, 0.04), mat(acc, 0.3, 1.8))                   # chest light
        for sx in (-1, 1): blob(spine, (sx * 0.1, -0.13, 0.12), (0.035, 0.02, 0.1), mat(acc, 0.4))  # suit stripes
    sw = 0.175 if F else (0.26 if BUFF else 0.22); rolled = O.get('sleeves') == 'rolled'
    for side, sx in (('L', 1), ('R', -1)):
        sh = empty('sh' + side, spine, (sx * sw, 0, 0.42)); J['sh' + side] = sh
        limb(sh, 0.27, 0.055 if F else (0.085 if BUFF else 0.065), 0.058 if BUFF else 0.045, M.get('coat', shirt))
        el = empty('el' + side, sh, (0, 0, -0.28)); J['el' + side] = el
        limb(el, 0.25, 0.056 if BUFF else 0.045, 0.045 if BUFF else 0.038, skin if rolled else M.get('coat', shirt)); blob(el, (0, -0.01, -0.29), (0.04, 0.045, 0.055), skin)  # forearm + hand
        if rolled: blob(el, (0, 0, -0.02), (0.068, 0.068, 0.045), shirt)                        # rolled cuff
        hp = empty('hp' + side, hips, (sx * (0.11 if F else 0.09), 0, -0.04)); J['hp' + side] = hp
        limb(hp, 0.42, 0.095 if F else 0.08, 0.06, pants)
        kn = empty('kn' + side, hp, (0, 0, -0.43)); J['kn' + side] = kn
        limb(kn, 0.40, 0.06, 0.045, pants)
        if boots is not pants: blob(kn, (0, 0, -0.3), (0.075, 0.075, 0.13), boots)             # boot shaft
        an = empty('an' + side, kn, (0, 0, -0.41)); J['an' + side] = an
        blob(an, (0, -0.06, -0.035), (0.065, 0.12, 0.05), boots)                                # foot (points forward = -y)
    return J

def pose(J, t):
    c, sn = math.cos(2 * math.pi * t), math.sin(2 * math.pi * t)  # t=0 left foot forward, t=.5 right foot forward
    J['hpL'].rotation_euler.x = R(-26 * c); J['hpR'].rotation_euler.x = R(26 * c)
    J['knL'].rotation_euler.x = R(6 + 40 * max(0, -sn)); J['knR'].rotation_euler.x = R(6 + 40 * max(0, sn))
    for s in 'LR': J['an' + s].rotation_euler.x = -(J['hp' + s].rotation_euler.x + J['kn' + s].rotation_euler.x) * 0.85
    J['shL'].rotation_euler.x = R(22 * c); J['shR'].rotation_euler.x = R(-22 * c)
    J['elL'].rotation_euler.x = R(-14 - 10 * max(0, -c)); J['elR'].rotation_euler.x = R(-14 - 10 * max(0, c))
    J['spine'].rotation_euler = (R(-3), 0, R(5 * c)); J['hips'].rotation_euler.z = R(-6 * c)
    J['head'].rotation_euler.x = R(3)

def stand(J):
    for k in ('hpL', 'hpR', 'knL', 'knR', 'anL', 'anR'): J[k].rotation_euler.x = 0
    J['shL'].rotation_euler.x = J['shR'].rotation_euler.x = 0; J['shL'].rotation_euler.y = R(-4); J['shR'].rotation_euler.y = R(4)
    J['elL'].rotation_euler.x = J['elR'].rotation_euler.x = R(-8)
    J['spine'].rotation_euler = (0, 0, 0); J['hips'].rotation_euler.z = 0; J['head'].rotation_euler.x = R(2)

def ground(J):  # drop the body so the lowest foot touches the ground
    bpy.context.view_layer.update(); J['root'].location.z = 0; bpy.context.view_layer.update()
    low = min((o.matrix_world @ Vector(v)).z for o in bpy.context.scene.objects if o.type == 'MESH' for v in o.bound_box)
    J['root'].location.z = -low; bpy.context.view_layer.update()

meta = {'cell': [CW, CH], 'dirs': ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'], 'frames': FRAMES}
OUT_NAME = sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else 'clay'
O = dict(OUTFITS[OUT_NAME], name=OUT_NAME)
for sex in (('male', 'female') if O['sex'] == 'both' else (O['sex'],)):
    sc, cam = reset(); J = build(sex, O); os.makedirs(os.path.join(OUT, sex), exist_ok=True)
    v = world_to_camera_view(sc, cam, Vector((0, 0, 0))); meta[sex] = {'ax': round(v.x * CW, 1), 'ay': round((1 - v.y) * CH, 1)}
    for d in range(DIRS):
        J['root'].rotation_euler.z = R(45 - 45 * d)
        for f in range(FRAMES):
            pose(J, f / FRAMES); ground(J)
            sc.render.filepath = os.path.join(OUT, sex, 'd%d_f%d.png' % (d, f)); bpy.ops.render.render(write_still=True)
        stand(J); ground(J)
        sc.render.filepath = os.path.join(OUT, sex, 'd%d_f%d.png' % (d, FRAMES)); bpy.ops.render.render(write_still=True)
        J['shL'].rotation_euler.y = J['shR'].rotation_euler.y = 0
    J['root'].rotation_euler.z = R(45)  # save with the walk cycle keyframed (frames 1-25 loop, one key every 6 frames)
    sc.frame_start, sc.frame_end = 1, 24
    for k in range(5):
        pose(J, (k % 4) / 4); ground(J)
        for o in J.values(): o.keyframe_insert('rotation_euler', frame=1 + k * 6)
        J['root'].keyframe_insert('location', frame=1 + k * 6)
    sc.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'walker_%s_%s.blend' % (OUT_NAME, sex)))
json.dump(meta, open(os.path.join(OUT, 'anchors.json'), 'w'), indent=1)
