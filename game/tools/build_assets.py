#!/usr/bin/env python3
"""Builds game/assets from Kenney's CC0 asset packs.

Usage:  python3 game/tools/build_assets.py <path-to-kenney-checkout>
(the checkout is https://github.com/shorepine/kenney, a mirror of kenney.nl, CC0)

Produces:
  assets/atlas.png + atlas.json   all in-game sprites (heroes, composed monsters, tiles, decor, fx, pickups)
  assets/ui/*.png                 UI pieces used from CSS (buttons, panels, icons)
"""
import json
import os
import shutil
import sys

from PIL import Image, ImageEnhance, ImageOps

K = sys.argv[1] if len(sys.argv) > 1 else '/home/user/shorepine/kenney'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets')
os.makedirs(os.path.join(OUT, 'ui'), exist_ok=True)

ANIMALS = f'{K}/2d/Animal Pack Remastered/Round (outline)'
MON = f'{K}/2d/Monster Builder Pack'
TILES = f'{K}/2d/Topdown Shooter/Tiles'
BG = f'{K}/2d/Background Elements Remastered'
PART = f'{K}/2d/Particle Pack/PNG (Transparent)'
SPLAT = f'{K}/2d/Splat Pack'
PLAT = f'{K}/2d/New Platformer Pack/Sprites/Tiles/Double'
UI = f'{K}/ui/UI Pack'
ICONS = f'{K}/icons/Game Icons/White/2x'

frames = {}  # name -> PIL image


def load(path):
    return Image.open(path).convert('RGBA')


def fit(im, h=None, w=None):
    if h:
        w2 = max(1, round(im.width * h / im.height))
        return im.resize((w2, h), Image.LANCZOS)
    h2 = max(1, round(im.height * w / im.width))
    return im.resize((w, h2), Image.LANCZOS)


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def add(name, im):
    frames[name] = im


# ------------------------------------------------------------------ heroes
for a in ['panda', 'rabbit', 'bear', 'owl', 'frog', 'penguin']:
    add('hero_' + a, fit(trim(load(f'{ANIMALS}/{a}.png')), h=120))


# ------------------------------------------------------------------ monsters (composed from Monster Builder parts)
def part(n):
    return load(f'{MON}/{n}.png')


def compose(body, eyes, mouth, legs=None, arms=None, top=None, top_mirror=True, extra=()):
    """eyes: list of (file, fx, fy, scale); mouth: (file, fx, fy, scale); top: (file, fx, fy, scale) mirrored."""
    b = part(body)
    pad = 110
    W, H = b.width + pad * 2, b.height + pad * 2
    c = Image.new('RGBA', (W, H))
    bx, by = pad, pad

    def put(im, cx, cy, s=1.0, flip=False):
        if s != 1.0:
            im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        if flip:
            im = ImageOps.mirror(im)
        c.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))

    if legs:
        L = part(legs)
        for sx in (-1, 1):
            put(L, bx + b.width / 2 + sx * b.width * 0.2, by + b.height - 10, 0.55, flip=sx > 0)
    if arms:
        A = part(arms)
        for sx in (-1, 1):
            put(A.rotate(sx * 35, expand=True, resample=Image.BICUBIC), bx + b.width / 2 + sx * b.width * 0.55, by + b.height * 0.6, 0.6, flip=sx > 0)
    if top:
        f, fx, fy, s = top
        T = part(f)
        for sx in ((-1, 1) if top_mirror else (0,)):
            put(T, bx + b.width * (0.5 + sx * fx), by + b.height * fy, s, flip=sx > 0)
    c.alpha_composite(b, (bx, by))
    for f, fx, fy, s in eyes:
        put(part(f), bx + b.width * fx, by + b.height * fy, s, flip=fx > 0.5)
    if mouth:
        f, fx, fy, s = mouth
        put(part(f), bx + b.width * fx, by + b.height * fy, s)
    for f, fx, fy, s in extra:
        put(part(f), bx + b.width * fx, by + b.height * fy, s)
    return trim(c)


MONSTERS = {
    'mite': (compose('body_redB', [('eye_angry_red', 0.33, 0.42, 0.9), ('eye_angry_red', 0.67, 0.42, 0.9)], ('mouthC', 0.5, 0.7, 0.8),
                     legs='leg_redA', top=('detail_red_horn_small', 0.3, 0.05, 1.0)), 92),
    'runner': (compose('body_yellowC', [('eye_yellow', 0.5, 0.38, 1.0)], ('mouth_closed_fangs', 0.5, 0.68, 0.8),
                       legs='leg_yellowC', top=('detail_yellow_antenna_large', 0.15, -0.05, 0.9)), 84),
    'brute': (compose('body_darkA', [('eye_psycho_light', 0.3, 0.38, 0.9), ('eye_psycho_light', 0.7, 0.38, 0.9)], ('mouthF', 0.5, 0.72, 1.1),
                      legs='leg_darkD', arms='arm_darkB', top=('detail_dark_horn_large', 0.38, 0.0, 1.1)), 140),
    'spitter': (compose('body_blueD', [('eye_human_blue', 0.36, 0.4, 0.8), ('eye_human_blue', 0.64, 0.4, 0.8)], ('mouthG', 0.5, 0.72, 0.8),
                        legs='leg_blueB', top=('detail_blue_antenna_small', 0.25, -0.02, 1.0)), 98),
    'splitter': (compose('body_greenB', [('eye_cute_light', 0.34, 0.42, 0.75), ('eye_cute_light', 0.66, 0.42, 0.75)], ('mouthH', 0.5, 0.72, 0.8),
                         legs='leg_greenA', top=('detail_green_ear_round', 0.42, 0.12, 0.9)), 106),
    'mini': (compose('body_greenC', [('eye_cute_dark', 0.5, 0.42, 0.9)], ('mouth_closed_happy', 0.5, 0.72, 0.8), legs='leg_greenE'), 58),
    'boss_brood': (compose('body_redD', [('eye_red', 0.3, 0.38, 1.0), ('eye_red', 0.7, 0.38, 1.0)], ('mouthJ', 0.5, 0.72, 1.4),
                           legs='leg_redD', arms='arm_redC', top=('detail_red_horn_large', 0.36, 0.02, 1.4)), 230),
    'boss_golem': (compose('body_whiteA', [('eye_psycho_dark', 0.3, 0.4, 1.2), ('eye_psycho_dark', 0.7, 0.4, 1.2)], ('mouthI', 0.5, 0.74, 1.4),
                           legs='leg_whiteD', arms='arm_whiteE', top=('detail_white_horn_large', 0.38, 0.0, 1.4)), 240),
    'boss_hydra': (compose('body_greenD', [('eye_yellow', 0.26, 0.38, 1.0), ('eye_yellow', 0.5, 0.3, 1.0), ('eye_yellow', 0.74, 0.38, 1.0)], ('mouthH', 0.5, 0.74, 1.4),
                           legs='leg_greenD', arms='arm_greenC', top=('detail_green_antenna_large', 0.3, -0.05, 1.3)), 240),
    'boss_prism': (compose('body_blueA', [('eye_human_blue', 0.3, 0.38, 1.2), ('eye_human_blue', 0.7, 0.38, 1.2)], ('mouthE', 0.5, 0.74, 1.4),
                           legs='leg_blueD', arms='arm_blueC', top=('detail_blue_horn_large', 0.38, 0.0, 1.4)), 240),
    'boss_core': (compose('body_yellowD', [('eye_angry_red', 0.28, 0.36, 1.2), ('eye_red', 0.5, 0.24, 1.0), ('eye_angry_red', 0.72, 0.36, 1.2)], ('mouthF', 0.5, 0.74, 1.6),
                          legs='leg_yellowD', arms='arm_yellowE', top=('detail_yellow_horn_large', 0.36, 0.0, 1.5)), 260),
}
for n, (im, h) in MONSTERS.items():
    add('mon_' + n, fit(im, h=h))

# ------------------------------------------------------------------ ground tiles (4 per biome)
BIOMES = {
    'grass': ['tile_01', 'tile_02', 'tile_03', 'tile_04'],
    'dirt': ['tile_05', 'tile_06', 'tile_05', 'tile_06'],
    'swamp': ['tile_01', 'tile_02', 'tile_03', 'tile_04'],
    'ice': ['tile_07', 'tile_08', 'tile_09', 'tile_10'],
    'sand': ['tile_13', 'tile_14', 'tile_15', 'tile_16'],
}
for biome, names in BIOMES.items():
    for i, n in enumerate(names):
        im = load(f'{TILES}/{n}.png')
        if biome == 'swamp':
            r, g, b, a = im.split()
            im = Image.merge('RGBA', (r.point(lambda v: v * 0.45), g.point(lambda v: v * 0.62), b.point(lambda v: v * 0.5), a))
        if biome == 'dirt':
            im = ImageEnhance.Brightness(im).enhance(0.92)
        add(f'tile_{biome}_{i}', im)

# ------------------------------------------------------------------ decor per biome
DECOR = {
    'grass': ['tree', 'treeSmall_green1', 'treeSmall_green2', 'bush1', 'bush2', 'bush3', 'bush4'],
    'dirt': ['treeOrange', 'treeSmall_orange1', 'treeSmall_orange2', 'bushOrange1', 'bushOrange2', 'bushOrange3'],
    'swamp': ['treeDead', 'treeLong', 'bushAlt1', 'bushAlt2', 'bushAlt3', 'bushAlt4'],
    'ice': ['treeSnow', 'treePineSnow', 'treeFrozen', 'treePineFrozen', 'treeLongSnow'],
    'sand': ['cactus1', 'cactus2', 'cactus3', 'treePalm', 'treeDead'],
}
decor_names = {}
for biome, names in DECOR.items():
    decor_names[biome] = []
    for n in names:
        im = trim(load(f'{BG}/{n}.png'))
        if n.startswith('treeSmall'):
            im = fit(im, h=110)
        elif n.startswith(('tree', 'cactus')):
            im = fit(im, h=170)
        else:
            im = fit(im, h=56)
        key = f'decor_{n}'
        if key not in frames:
            add(key, im)
        decor_names[biome].append(key)

# ------------------------------------------------------------------ pickups
add('gem_green', fit(trim(load(f'{PLAT}/gem_green.png')), h=40))
add('gem_blue', fit(trim(load(f'{PLAT}/gem_blue.png')), h=48))
add('gem_red', fit(trim(load(f'{PLAT}/gem_red.png')), h=56))
add('coin', fit(trim(load(f'{PLAT}/coin_gold.png')), h=44))
add('heart', fit(trim(load(f'{PLAT}/heart.png')), h=48))
add('star', fit(trim(load(f'{PLAT}/star.png')), h=48))

# ------------------------------------------------------------------ fx (white, tinted at runtime)
FX = {'ring': 'circle_02', 'ring2': 'circle_03', 'glow': 'circle_05', 'smoke': 'smoke_04', 'smoke2': 'smoke_07', 'muzzle': 'muzzle_02',
      'spark': 'star_06', 'star': 'star_08', 'flare': 'flare_01', 'light': 'light_01', 'twirl': 'twirl_01', 'magic': 'magic_03',
      'zap': 'spark_05', 'slash': 'slash_02', 'trace': 'trace_01', 'scorch': 'scorch_02'}
for n, f in FX.items():
    add('fx_' + n, fit(load(f'{PART}/{f}.png'), w=128))
for i, n in enumerate(['splat02', 'splat11', 'splat19', 'splat24']):
    p = f'{SPLAT}/PNG/Default/{n}.png' if os.path.exists(f'{SPLAT}/PNG/Default/{n}.png') else None
    if p is None:
        import glob
        cand = glob.glob(f'{SPLAT}/**/{n}.png', recursive=True)
        p = cand[0]
    add(f'splat_{i}', fit(load(p), w=96))

# ------------------------------------------------------------------ pack atlas (shelf packer, 2px padding)
items = sorted(frames.items(), key=lambda kv: -kv[1].height)
AW = 2048
x = y = rowh = 0
pos = {}
for n, im in items:
    if x + im.width + 2 > AW:
        x = 0
        y += rowh + 2
        rowh = 0
    pos[n] = (x, y)
    x += im.width + 2
    rowh = max(rowh, im.height)
AH = y + rowh
atlas = Image.new('RGBA', (AW, AH))
meta = {}
for n, im in frames.items():
    px, py = pos[n]
    atlas.alpha_composite(im, (px, py))
    meta[n] = [px, py, im.width, im.height]
atlas.save(os.path.join(OUT, 'atlas.png'), optimize=True)
with open(os.path.join(OUT, 'atlas.js'), 'w') as f:  # JS (not JSON) so it also loads from file://
    f.write('window.ATLAS=' + json.dumps({'frames': meta, 'decor': decor_names}, separators=(',', ':')) + ';\n')
# app icon: hero on a yellow rounded square
ic = Image.new('RGBA', (512, 512))
from PIL import ImageDraw
ImageDraw.Draw(ic).rounded_rectangle((0, 0, 511, 511), 110, fill=(255, 205, 64, 255))
ImageDraw.Draw(ic).rounded_rectangle((0, 300, 511, 511), 110, fill=(47, 190, 110, 255))
ImageDraw.Draw(ic).rectangle((0, 300, 511, 400), fill=(47, 190, 110, 255))
hero = fit(trim(load(f'{ANIMALS}/panda.png')), w=380)
ic.alpha_composite(hero, ((512 - hero.width) // 2, (512 - hero.height) // 2 + 20))
ic.save(os.path.join(HERE, '..', 'icon.png'))

# ------------------------------------------------------------------ UI pieces for CSS
ui_copy = {
    'btn_green.png': f'{UI}/Green/Default/button_rectangle_depth_gradient.png',
    'btn_yellow.png': f'{UI}/Yellow/Default/button_rectangle_depth_gradient.png',
    'btn_grey.png': f'{UI}/Grey/Default/button_rectangle_depth_gradient.png',
    'btn_round_green.png': f'{UI}/Green/Default/button_round_depth_gradient.png',
    'btn_round_grey.png': f'{UI}/Grey/Default/button_round_depth_gradient.png',
    'panel.png': f'{UI}/Grey/Default/button_square_depth_flat.png',
    'icon_pause.png': f'{ICONS}/pause.png',
    'icon_home.png': f'{ICONS}/home.png',
    'icon_audio_on.png': f'{ICONS}/audioOn.png',
    'icon_audio_off.png': f'{ICONS}/audioOff.png',
    'icon_lock.png': f'{ICONS}/locked.png',
    'icon_back.png': f'{ICONS}/arrowLeft.png',
    'icon_trophy.png': f'{ICONS}/trophy.png',
}
for dst, src in ui_copy.items():
    if not os.path.exists(src):
        import glob
        alt = glob.glob(os.path.join(os.path.dirname(os.path.dirname(src)), '**', os.path.basename(src)), recursive=True)
        if not alt:
            print('missing', src)
            continue
        src = alt[0]
    shutil.copy(src, os.path.join(OUT, 'ui', dst))
for biome in BIOMES:
    frames[f'tile_{biome}_0'].save(os.path.join(OUT, 'ui', f'tile_{biome}.png'))
for n in ['coin', 'heart', 'gem_green', 'star']:
    frames[n].save(os.path.join(OUT, 'ui', n + '.png'))
for a in ['panda', 'rabbit', 'bear', 'owl', 'frog', 'penguin']:
    frames['hero_' + a].save(os.path.join(OUT, 'ui', 'hero_' + a + '.png'))
for n in ['mite', 'brute', 'boss_brood', 'boss_golem', 'boss_hydra', 'boss_prism', 'boss_core']:
    fit(frames['mon_' + n], h=120).save(os.path.join(OUT, 'ui', 'mon_' + n + '.png'))

# sticker icons for upgrade cards: crisp white symbol with a thick dark outline
from PIL import ImageFilter


def sticker(im, size=96, boost=2.2, thick=0):
    im = im.convert('RGBA')
    r, g, b, al = im.split()
    if boost != 1:  # soft particle textures -> crisp shapes
        al = al.point(lambda v: 255 if v * boost > 150 else 0)
        if thick:
            al = al.filter(ImageFilter.MaxFilter(thick))
        al = al.filter(ImageFilter.GaussianBlur(1.2))
    white = Image.new('RGBA', im.size, (255, 255, 255, 255))
    white.putalpha(al)
    white = trim(white)
    white.thumbnail((size - 20, size - 20), Image.LANCZOS)
    c = Image.new('RGBA', (size, size))
    ox, oy = (size - white.width) // 2, (size - white.height) // 2
    mask = Image.new('L', (size, size))
    mask.paste(white.split()[3], (ox, oy))
    mask = mask.filter(ImageFilter.MaxFilter(9)).point(lambda v: 255 if v > 60 else 0)
    dark = Image.new('RGBA', (size, size), (43, 47, 58, 255))
    c.paste(dark, (0, 3), mask)
    c.paste(dark, (0, 0), mask)
    c.alpha_composite(white, (ox, oy))
    return c


GI = f'{K}/icons/Game Icons/White/2x'
GE = f'{K}/icons/Game Icons Expansion/White/2x'
STICKERS = {
    'ic_rate': (f'{PART}/flame_05.png', 1.4, 5), 'ic_multi': (f'{PART}/star_07.png', 1.6, 9),
    'ic_pierce': (f'{GI}/arrowRight.png', 1), 'ic_crit': (f'{GI}/target.png', 1), 'ic_bspd': (f'{GI}/arrowUp.png', 1),
    'ic_speed': (f'{GI}/fastForward.png', 1), 'ic_regen': (f'{GI}/plus.png', 1), 'ic_orbit': (f'{PART}/twirl_01.png', 1.6, 9),
    'ic_nova': (f'{PART}/circle_02.png', 1.6, 11), 'ic_chain': (f'{PART}/spark_05.png', 2.0, 15), 'ic_power': (f'{GE}/fightFist.png', 1),
    'ic_armor': (f'{GI}/locked.png', 1), 'ic_reroll': (f'{GI}/return.png', 1),
}
from PIL import ImageDraw


def shape_icon(kind):
    S = 400
    im = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(im)
    w = (255, 255, 255, 255)
    if kind == 'bolt':
        d.polygon([(230, 20), (90, 220), (190, 220), (150, 380), (310, 160), (205, 160), (260, 20)], fill=w)
    elif kind == 'bullets':
        for x in (40, 150, 260):
            d.rounded_rectangle((x, 160, x + 90, 370), 14, fill=w)
            d.pieslice((x, 40, x + 90, 260), 180, 360, fill=w)
            d.rectangle((x, 148, x + 90, 162), fill=(0, 0, 0, 0))
    elif kind == 'sword':
        d.polygon([(330, 30), (370, 30), (370, 70), (170, 270), (130, 230)], fill=w)
        d.rounded_rectangle((70, 210, 190, 250), 18, fill=w)
        im = im.rotate(0)
        d.line([(110, 250), (60, 300)], fill=w, width=40)
        d.ellipse((30, 290, 90, 350), fill=w)
        d.polygon([(95, 175), (225, 305), (200, 330), (70, 200)], fill=w)
    return im


STICKERS['ic_chain'] = (shape_icon('bolt'), 1)
STICKERS['ic_rate'] = (shape_icon('bullets'), 1)
for n, (src, boost, *th) in STICKERS.items():
    sticker(src if isinstance(src, Image.Image) else load(src), boost=boost, thick=th[0] if th else 0).save(os.path.join(OUT, 'ui', n + '.png'))

with open(os.path.join(OUT, 'LICENSE-ASSETS.txt'), 'w') as f:
    f.write('Graphics: Kenney (www.kenney.nl), Creative Commons Zero (CC0) - free for personal and commercial use.\n'
            'Packs: Animal Pack Remastered, Monster Builder Pack, Topdown Shooter, Background Elements Remastered,\n'
            'Particle Pack, Splat Pack, New Platformer Pack, UI Pack, Game Icons.\n'
            'Font: Baloo 2 by Ek Type, SIL Open Font License 1.1 (via @fontsource/baloo-2).\n')
print('atlas', AW, AH, len(frames), 'frames')
