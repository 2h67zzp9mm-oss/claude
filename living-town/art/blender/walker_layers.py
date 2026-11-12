# Character-creator layers: each body rendered once in plain white plus a colour-region map, and each
# hairstyle / extra on its own (hidden behind the body where it should be), so the game can paint any look.
# blender -b --python art/blender/walker_layers.py -- OUTDIR WORLD BODY      WORLD: clay|scifi  BODY: man|woman|kid
#   -> OUTDIR/<layer>/d<dir>_f<frame>.png, OUTDIR/layers.json
import bpy, sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import walker as W
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
args = sys.argv[sys.argv.index('--') + 1:]
OUT, WORLD, BODY = args[0], args[1], args[2]
ONLY = args[3].split(',') if len(args) > 3 else None   # re-render just these layers
WHITE = (0.86, 0.85, 0.83)
sex = 'female' if BODY == 'woman' else 'male'
base = dict(W.OUTFITS['space_kid' if BODY == 'kid' else 'space'] if WORLD == 'scifi' else W.OUTFITS['clay_kid' if BODY == 'kid' else 'clay'])
base.update(name=('space' if WORLD == 'scifi' else 'clay') + ('_kid' if BODY == 'kid' else ''), bald=True)
for k in ('skin', 'shirt', 'pants', 'boots'): base[k] = WHITE
if WORLD == 'scifi': base.update(accent_m=WHITE, accent_f=WHITE, shirt=(0.92, 0.88, 0.80), pants=(0.92, 0.88, 0.80))
# region -> what it's painted with ('fixed' keeps its own colour)
REMAP = {'skin': 'shirt', 'boots': 'shirt', 'shoes': 'shirt', 'trim': 'shirt', 'shirt': 'fixed', 'pants': 'fixed'} if WORLD == 'scifi' else {'trim': 'shirt'}
MASK = {'skin': (1, 0, 0), 'shirt': (0, 1, 0), 'pants': (0, 0, 1), 'shoes': (1, 1, 0), 'fixed': (1, 0, 1)}
layers = {'base': {}}
if WORLD == 'clay':
    for h in ('buzz', 'short', 'long', 'ponytail', 'pigtails', 'buns', 'curls'): layers['hair_' + h] = dict(bald=False, hairk=h, hair=WHITE)
    layers['acc_glasses'] = dict(glasses=(0.12, 0.10, 0.12))
    layers['acc_bow'] = dict(bow=WHITE, bowonly=True)
    if BODY == 'man': layers['acc_beard'] = dict(beard=WHITE)
OVER = {'hair_': 'hair', 'acc_glasses': 'glasses', 'acc_bow': 'bow', 'acc_beard': 'beard'}

def region_of(m):
    r = m.get('region') if m else None
    return REMAP.get(r, r) if r else 'fixed'
def flat(col):
    m = bpy.data.materials.new('flat'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*col, 1); o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(e.outputs[0], o.inputs[0]); return m
def holdout():
    m = bpy.data.materials.new('hold'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    h = nt.nodes.new('ShaderNodeHoldout'); o = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(h.outputs[0], o.inputs[0]); return m
def swap(fn):
    for o in bpy.context.scene.objects:
        if o.type == 'MESH' and o.data.materials: o.data.materials[0] = fn(o.data.materials[0])

def render_all(sc, J, folder):
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    for d in range(W.DIRS):
        J['root'].rotation_euler.z = W.R(45 - 45 * d)
        for f in range(W.FRAMES):
            W.pose(J, f / W.FRAMES); W.ground(J)
            sc.render.filepath = os.path.join(OUT, folder, 'd%d_f%d.png' % (d, f)); bpy.ops.render.render(write_still=True)
        W.stand(J); W.ground(J)
        sc.render.filepath = os.path.join(OUT, folder, 'd%d_f%d.png' % (d, W.FRAMES)); bpy.ops.render.render(write_still=True)
        J['shL'].rotation_euler.y = J['shR'].rotation_euler.y = 0

meta = {}
for name, extra in layers.items():
    if ONLY and name not in ONLY: continue
    sc, cam = W.reset(); J = W.build(sex, dict(base, **extra))
    if name == 'base':
        v = world_to_camera_view(sc, cam, Vector((0, 0, 0))); meta = {'ax': round(v.x * W.CW, 1), 'ay': round((1 - v.y) * W.CH, 1), 'layers': list(layers)}
        render_all(sc, J, 'base')
        flats = {k: flat(c) for k, c in MASK.items()}; swap(lambda m: flats[region_of(m)])
        sc.eevee.taa_render_samples = 1; sc.render.filter_size = 0.01
        render_all(sc, J, 'mask')
    else:
        want = next(v for k, v in OVER.items() if name.startswith(k)); hold = holdout()
        swap(lambda m: m if (m and m.get('region') == want) else hold)
        render_all(sc, J, name)
if not ONLY: json.dump(meta, open(os.path.join(OUT, 'layers.json'), 'w'), indent=1)
