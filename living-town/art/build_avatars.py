# Packs art/blender/walker_layers.py renders into public/homestead/avatar/: one sheet per layer
# (8 rows = directions, 5 columns = 4 walk frames + standing), plus <world>.json describing them.
# python art/build_avatars.py LAYER_ROOT        (LAYER_ROOT/<world>/<body>/<layer>/d*_f*.png)
import sys, os, json, time
from PIL import Image
ROOT = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'homestead', 'avatar')
X0, Y0, OW, OH, SC = 16, 20, 160, 200, 0.8
ow, oh = round(OW * SC), round(OH * SC)
for world in sorted(os.listdir(ROOT)):
    wdir = os.path.join(ROOT, world)
    if not os.path.isdir(wdir): continue
    index = {'version': int(time.time()), 'cw': ow, 'ch': oh, 'bodies': {}}
    for body in sorted(os.listdir(wdir)):
        bdir = os.path.join(wdir, body)
        if not os.path.exists(os.path.join(bdir, 'layers.json')): continue
        meta = json.load(open(os.path.join(bdir, 'layers.json')))
        out = os.path.join(OUT, world, body); os.makedirs(out, exist_ok=True)
        layers = ['base', 'mask'] + [l for l in meta['layers'] if l != 'base']
        for layer in layers:
            sheet = Image.new('RGBA', (ow * 5, oh * 8))
            for d in range(8):
                for f in range(5):
                    im = Image.open(os.path.join(bdir, layer, 'd%d_f%d.png' % (d, f))).convert('RGBA')
                    im = im.crop((X0, Y0, X0 + OW, Y0 + OH)).resize((ow, oh), Image.NEAREST if layer == 'mask' else Image.LANCZOS)
                    sheet.alpha_composite(im, (f * ow, d * oh))
            if layer == 'mask': sheet.save(os.path.join(out, 'mask.png'), optimize=True)
            else: sheet.save(os.path.join(out, layer + '.webp'), quality=92, method=6)
        index['bodies'][body] = {'ax': round((meta['ax'] - X0) * SC, 1), 'ay': round((meta['ay'] - Y0) * SC, 1), 'layers': [l for l in layers if l not in ('base', 'mask')]}
    json.dump(index, open(os.path.join(OUT, world + '.json'), 'w'), indent=1)
    print(world, {b: len(v['layers']) for b, v in index['bodies'].items()})
