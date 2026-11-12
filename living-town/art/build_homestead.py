# Packs the Blender renders into public/homestead/: ground, house layer, sprites, walker sheets, art.json.
# python art/build_homestead.py RENDER_DIR WALKER_DIR
#   RENDER_DIR: output of art/blender/homestead.py; WALKER_DIR: holds clay/ and clay_kid/ from art/blender/walker.py
import sys, os, json
from PIL import Image
RD, WD = sys.argv[1], sys.argv[2]
WORLD = sys.argv[3] if len(sys.argv) > 3 else ''   # e.g. scifi -> public/homestead/worlds/scifi/
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'homestead', *(['worlds', WORLD] if WORLD else [])); os.makedirs(OUT, exist_ok=True)
cam = json.load(open(os.path.join(RD, 'camera.json')))
art = {'camera': cam, 'sprites': {}, 'walkers': {}, 'bg': {'scifi': '#2b1d47'}.get(WORLD, '#7d8fae')}

g = Image.open(os.path.join(RD, 'ground.png')).convert('RGBA')
g.save(os.path.join(OUT, 'ground.webp'), quality=88, method=6)
h = Image.open(os.path.join(RD, 'house.png')).convert('RGBA'); bb = h.getbbox()
h.crop(bb).save(os.path.join(OUT, 'house.webp'), quality=90, method=6)
art['house'] = {'x': bb[0], 'y': bb[1], 'w': bb[2] - bb[0], 'h': bb[3] - bb[1]}

anchors = json.load(open(os.path.join(RD, 'sprites', '..', 'anchors.json')))
sheet_items = []
for name, (ax, ay) in anchors.items():
    im = Image.open(os.path.join(RD, 'sprites', name + '.png')).convert('RGBA'); bb = im.getbbox()
    if not bb: continue
    sheet_items.append((name, im.crop(bb), ax - bb[0], ay - bb[1]))
# one atlas for all the small things
x = y = rowh = 0; W = 1024; place = []
for name, im, ax, ay in sorted(sheet_items, key=lambda t: -t[1].height):
    if x + im.width > W: x, y, rowh = 0, y + rowh + 2, 0
    place.append((name, im, x, y, ax, ay)); x += im.width + 2; rowh = max(rowh, im.height)
atlas = Image.new('RGBA', (W, y + rowh))
for name, im, px, py, ax, ay in place:
    atlas.alpha_composite(im, (px, py)); art['sprites'][name] = {'x': px, 'y': py, 'w': im.width, 'h': im.height, 'ax': round(ax, 1), 'ay': round(ay, 1)}
atlas.save(os.path.join(OUT, 'sprites.webp'), quality=92, method=6)

# walkers: 8 rows (S, SW, W, NW, N, NE, E, SE) x 4 frames, at 0.8 of the render (= the ground's pixels per metre)
CW, CH, SC = 192, 256, 0.8
X0, Y0, OW, OH = 16, 20, 160, 200
for folder, kinds in (('clay', ('male', 'female')), ('clay_kid', ('male', 'female'))):
    meta = json.load(open(os.path.join(WD, folder, 'anchors.json')))
    for sex in kinds:
        key = ('kid_' if folder == 'clay_kid' else '') + sex
        ow, oh = round(OW * SC), round(OH * SC); sheet = Image.new('RGBA', (ow * 4, oh * 8))
        for d in range(8):
            for f in range(4):
                im = Image.open(os.path.join(WD, folder, sex, 'd%d_f%d.png' % (d, f))).convert('RGBA')
                sheet.alpha_composite(im.crop((X0, Y0, X0 + OW, Y0 + OH)).resize((ow, oh), Image.LANCZOS), (f * ow, d * oh))
        sheet.save(os.path.join(OUT, 'walk_%s.webp' % key), quality=92, method=6)
        a = meta[sex]; art['walkers'][key] = {'cw': ow, 'ch': oh, 'ax': round((a['ax'] - X0) * SC, 1), 'ay': round((a['ay'] - Y0) * SC, 1)}
json.dump(art, open(os.path.join(OUT, 'art.json'), 'w'), indent=1)
print('ok', {k: v for k, v in art['walkers'].items()})
