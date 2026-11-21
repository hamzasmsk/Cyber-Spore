#!/usr/bin/env python3
"""Builds game/assets from Kenney's CC0 asset packs (side-view run-and-gun edition).

Usage:  python3 game/tools/build_assets.py <path-to-kenney-checkout>
(the checkout is https://github.com/shorepine/kenney, a mirror of kenney.nl, CC0)

Produces:
  assets/atlas.png + assets/atlas.js   every in-game sprite (heroes, enemies, bosses, tiles, props, backgrounds, fx)
  assets/ui/*.png                      images used by the HTML interface
"""
import json
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageOps

K = sys.argv[1] if len(sys.argv) > 1 else '/home/user/shorepine/kenney'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets')
UIDIR = os.path.join(OUT, 'ui')
shutil.rmtree(UIDIR, ignore_errors=True)
os.makedirs(UIDIR)

NP = f'{K}/2d/New Platformer Pack/Sprites'
MON = f'{K}/2d/Monster Builder Pack'
PART = f'{K}/2d/Particle Pack/PNG (Transparent)'
EXP = f'{K}/2d/Explosion Pack'
SMOKE = f'{K}/2d/Smoke Particles'
GI = f'{K}/icons/Game Icons/White/2x'
GE = f'{K}/icons/Game Icons Expansion/White/2x'

frames = {}


def load(path):
    return Image.open(path).convert('RGBA')


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def fit(im, h=None, w=None):
    if h:
        return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)
    return im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)


def add(name, im):
    frames[name] = im


# ------------------------------------------------------------------ heroes (same 128x128 canvas for every frame)
COLORS = ['beige', 'green', 'pink', 'purple', 'yellow']
POSES = ['idle', 'walk_a', 'walk_b', 'jump', 'hit', 'duck', 'front']
for c in COLORS:
    for p in POSES:
        add(f'ch_{c}_{p}', load(f'{NP}/Characters/character_{c}_{p}.png'))

# ------------------------------------------------------------------ enemies (64x64 canvases, kept untrimmed so frames line up)
EN = ['slime_normal_walk_a', 'slime_normal_walk_b', 'slime_normal_flat', 'slime_fire_walk_a', 'slime_fire_walk_b', 'slime_spike_walk_a', 'slime_spike_walk_b',
      'slime_block_walk_a', 'slime_block_walk_b', 'mouse_walk_a', 'mouse_walk_b', 'snail_walk_a', 'snail_walk_b', 'snail_shell', 'frog_idle', 'frog_jump',
      'bee_a', 'bee_b', 'fly_a', 'fly_b', 'ladybug_walk_a', 'ladybug_walk_b', 'barnacle_attack_a', 'barnacle_attack_b', 'barnacle_attack_rest',
      'worm_normal_move_a', 'worm_normal_move_b', 'saw_a', 'saw_b']
for n in EN:
    add('en_' + n, load(f'{NP}/Enemies/{n}.png'))


# ------------------------------------------------------------------ bosses composed from Monster Builder parts
def part(n):
    return load(f'{MON}/{n}.png')


def compose(body, eyes, mouth, legs=None, arms=None, top=None):
    b = part(body)
    pad = 110
    c = Image.new('RGBA', (b.width + pad * 2, b.height + pad * 2))
    bx = by = pad

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
        for sx in (-1, 1):
            put(part(f), bx + b.width * (0.5 + sx * fx), by + b.height * fy, s, flip=sx > 0)
    c.alpha_composite(b, (bx, by))
    for f, fx, fy, s in eyes:
        put(part(f), bx + b.width * fx, by + b.height * fy, s, flip=fx > 0.5)
    f, fx, fy, s = mouth
    put(part(f), bx + b.width * fx, by + b.height * fy, s)
    return trim(c)


BOSSES = {
    'brood': compose('body_redD', [('eye_red', 0.3, 0.38, 1.0), ('eye_red', 0.7, 0.38, 1.0)], ('mouthJ', 0.5, 0.72, 1.4), 'leg_redD', 'arm_redC', ('detail_red_horn_large', 0.36, 0.02, 1.4)),
    'golem': compose('body_whiteA', [('eye_psycho_dark', 0.3, 0.4, 1.2), ('eye_psycho_dark', 0.7, 0.4, 1.2)], ('mouthI', 0.5, 0.74, 1.4), 'leg_whiteD', 'arm_whiteE', ('detail_white_horn_large', 0.38, 0.0, 1.4)),
    'hydra': compose('body_greenD', [('eye_yellow', 0.26, 0.38, 1.0), ('eye_yellow', 0.5, 0.3, 1.0), ('eye_yellow', 0.74, 0.38, 1.0)], ('mouthH', 0.5, 0.74, 1.4), 'leg_greenD', 'arm_greenC', ('detail_green_antenna_large', 0.3, -0.05, 1.3)),
    'prism': compose('body_blueA', [('eye_human_blue', 0.3, 0.38, 1.2), ('eye_human_blue', 0.7, 0.38, 1.2)], ('mouthE', 0.5, 0.74, 1.4), 'leg_blueD', 'arm_blueC', ('detail_blue_horn_large', 0.38, 0.0, 1.4)),
    'core': compose('body_yellowD', [('eye_angry_red', 0.28, 0.36, 1.2), ('eye_red', 0.5, 0.24, 1.0), ('eye_angry_red', 0.72, 0.36, 1.2)], ('mouthF', 0.5, 0.74, 1.6), 'leg_yellowD', 'arm_yellowE', ('detail_yellow_horn_large', 0.36, 0.0, 1.5)),
}
for n, im in BOSSES.items():
    add('boss_' + n, fit(im, h=260))

# ------------------------------------------------------------------ terrain (64px tiles)
for b in ['grass', 'dirt', 'sand', 'snow', 'stone', 'purple']:
    for p in ['top', 'top_left', 'top_right', 'center', 'left', 'right']:
        add(f't_{b}_{p}', load(f'{NP}/Tiles/terrain_{b}_block_{p}.png'))
    if os.path.exists(f'{NP}/Tiles/terrain_{b}_horizontal_middle.png'):
        for p in ['left', 'middle', 'right']:
            add(f't_{b}_h_{p}', load(f'{NP}/Tiles/terrain_{b}_horizontal_{p}.png'))

# ------------------------------------------------------------------ props & pickups
PROPS = ['block_planks', 'block_strong_empty', 'block_exclamation', 'block_coin', 'spring', 'spring_out', 'spikes', 'bush', 'cactus', 'rock',
         'mushroom_red', 'mushroom_brown', 'fence', 'sign_right', 'sign_exit', 'grass', 'grass_purple', 'snow', 'torch_on_a', 'torch_on_b',
         'flag_green_a', 'flag_green_b', 'flag_red_a', 'flag_red_b', 'flag_off', 'chain', 'bomb', 'bomb_active', 'heart', 'coin_gold',
         'coin_gold_side', 'gem_blue', 'gem_red', 'gem_yellow', 'gem_green', 'star', 'hill', 'hill_top', 'lock_yellow', 'key_yellow', 'bridge']
for n in PROPS:
    add('p_' + n, load(f'{NP}/Tiles/{n}.png'))

# ------------------------------------------------------------------ parallax backgrounds (256x256, tile horizontally)
def keyout(im, rgb, tol=10, soft=40):
    """make one flat colour transparent (soft edge) so the layers can be stacked as parallax"""
    px = im.load()
    for yy in range(im.height):
        for xx in range(im.width):
            r, g, b2, a = px[xx, yy]
            d = abs(r - rgb[0]) + abs(g - rgb[1]) + abs(b2 - rgb[2])
            if d < tol + soft:
                px[xx, yy] = (r, g, b2, int(a * max(0, d - tol) / soft))
    return im


for n in ['color_hills', 'color_trees', 'color_desert', 'color_mushrooms', 'fade_hills', 'fade_trees', 'fade_desert', 'fade_mushrooms']:
    add('bg_' + n, keyout(load(f'{NP}/Backgrounds/background_{n}.png'), (255, 255, 255)))
add('bg_clouds', keyout(load(f'{NP}/Backgrounds/background_clouds.png'), (195, 227, 255)))

# ------------------------------------------------------------------ fx
for i in range(9):
    add(f'fx_expl_{i}', fit(load(f'{EXP}/Regular explosion/regularExplosion0{i}.png'), w=128))
for i in range(6):
    add(f'fx_puff_{i}', fit(load(f'{SMOKE}/White puff/whitePuff0{i}.png'), w=96))
add('fx_flash', fit(load(f'{SMOKE}/Flash/flash00.png'), w=128))
add('fx_burst', fit(load(f'{EXP}/Particles/burst.png'), w=64))
for n, f, w in [('spark', 'star_06', 64), ('muzzle', 'muzzle_02', 64), ('glow', 'circle_05', 64), ('ring', 'circle_02', 128), ('zap', 'spark_05', 64), ('light', 'light_01', 128)]:
    add('fx_' + n, fit(load(f'{PART}/{f}.png'), w=w))

# ------------------------------------------------------------------ pack atlas
items = sorted(frames.items(), key=lambda kv: (-kv[1].height, kv[0]))
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
atlas = Image.new('RGBA', (AW, y + rowh))
meta = {}
for n, im in frames.items():
    px, py = pos[n]
    atlas.alpha_composite(im, (px, py))
    meta[n] = [px, py, im.width, im.height]
atlas.save(os.path.join(OUT, 'atlas.png'), optimize=True)
with open(os.path.join(OUT, 'atlas.js'), 'w') as f:  # JS (not JSON) so it also loads from file://
    f.write('window.ATLAS=' + json.dumps({'frames': meta}, separators=(',', ':')) + ';\n')


# ------------------------------------------------------------------ UI images
def ui(name, im):
    im.save(os.path.join(UIDIR, name + '.png'))


for c in COLORS:
    ui('hero_' + c, trim(frames[f'ch_{c}_idle']))
    ui('helmet_' + c, load(f'{NP}/Tiles/hud_player_helmet_{c}.png'))
for n in ['coin_gold', 'heart', 'gem_blue', 'star', 'bomb', 'lock_yellow', 'flag_green_a', 'chain']:
    ui(n, trim(frames['p_' + n]))
for n in BOSSES:
    ui('boss_' + n, fit(frames['boss_' + n], h=140))
for n in ['slime_normal_walk_a', 'bee_a', 'snail_walk_a', 'barnacle_attack_a', 'slime_spike_walk_a']:
    ui('en_' + n, trim(frames['en_' + n]))
for n in ['color_hills', 'color_mushrooms', 'color_desert', 'color_trees']:
    ui('bg_' + n, frames['bg_' + n])
for t in ['grass', 'dirt', 'sand', 'snow', 'purple']:
    ui('tile_' + t, frames[f't_{t}_top'])


def sticker(im, size=96, boost=1.0, thick=0):
    """white symbol with a thick dark outline (used on buttons and cards)"""
    r, g, b, al = im.convert('RGBA').split()
    if boost != 1:
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
    dark = Image.new('RGBA', (size, size), (27, 32, 51, 255))
    c.paste(dark, (0, 3), mask)
    c.paste(dark, (0, 0), mask)
    c.alpha_composite(white, (ox, oy))
    return c


def shape(kind):
    S = 400
    im = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(im)
    w = (255, 255, 255, 255)
    if kind == 'bolt':
        d.polygon([(230, 20), (90, 220), (190, 220), (150, 380), (310, 160), (205, 160), (260, 20)], fill=w)
    elif kind == 'bullets':
        for x0 in (40, 150, 260):
            d.rounded_rectangle((x0, 160, x0 + 90, 370), 14, fill=w)
            d.pieslice((x0, 40, x0 + 90, 260), 180, 360, fill=w)
            d.rectangle((x0, 148, x0 + 90, 162), fill=(0, 0, 0, 0))
    elif kind == 'jump':
        d.polygon([(200, 30), (370, 220), (270, 220), (270, 370), (130, 370), (130, 220), (30, 220)], fill=w)
    elif kind == 'fire':  # crosshair
        d.ellipse((60, 60, 340, 340), outline=w, width=46)
        for a, b2 in [((185, 10), (215, 130)), ((185, 270), (215, 390)), ((10, 185), (130, 215)), ((270, 185), (390, 215))]:
            d.rectangle((a, b2), fill=w)
        d.ellipse((165, 165, 235, 235), fill=w)
    elif kind == 'swap':
        d.polygon([(40, 130), (250, 130), (250, 60), (370, 160), (250, 260), (250, 190), (40, 190)], fill=w)
        d.polygon([(360, 270), (150, 270), (150, 340), (30, 240), (150, 140), (150, 210), (360, 210)], fill=w)
    elif kind == 'team':
        for cx, cy, r in [(130, 150, 70), (270, 150, 70)]:
            d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=w)
            d.pieslice((cx - 110, cy + 70, cx + 110, cy + 300), 180, 360, fill=w)
    elif kind == 'magnet':
        d.arc((60, 40, 340, 320), 180, 360, fill=w, width=90)
        d.rectangle((60, 180, 150, 330), fill=w)
        d.rectangle((250, 180, 340, 330), fill=w)
    return im


STICKERS = {
    'ic_power': load(f'{GE}/fightFist.png'), 'ic_rate': shape('bullets'), 'ic_jump': shape('jump'), 'ic_fire': shape('fire'),
    'ic_swap': shape('swap'), 'ic_team': shape('team'), 'ic_magnet': shape('magnet'), 'ic_chain': shape('bolt'),
    'ic_dash': load(f'{GI}/fastForward.png'), 'ic_pause': load(f'{GI}/pause.png'), 'ic_home': load(f'{GI}/home.png'),
    'ic_left': load(f'{GI}/arrowLeft.png'), 'ic_right': load(f'{GI}/arrowRight.png'), 'ic_back': load(f'{GI}/arrowLeft.png'),
    'ic_sound_on': load(f'{GI}/audioOn.png'), 'ic_sound_off': load(f'{GI}/audioOff.png'), 'ic_lock': load(f'{GI}/locked.png'),
    'ic_play': load(f'{GI}/forward.png') if os.path.exists(f'{GI}/forward.png') else load(f'{GI}/arrowRight.png'),
    'ic_retry': load(f'{GI}/return.png'), 'ic_plus': load(f'{GI}/plus.png'), 'ic_star': load(f'{GI}/star.png'),
}
for n, im in STICKERS.items():
    ui(n, sticker(im))

# app icon: hero on a sunny badge
ic = Image.new('RGBA', (512, 512))
dd = ImageDraw.Draw(ic)
dd.rounded_rectangle((0, 0, 511, 511), 110, fill=(84, 186, 255, 255))
dd.rounded_rectangle((0, 330, 511, 511), 110, fill=(54, 190, 110, 255))
dd.rectangle((0, 330, 511, 420), fill=(54, 190, 110, 255))
hero = fit(trim(frames['ch_yellow_idle']), h=380)
ic.alpha_composite(hero, ((512 - hero.width) // 2, 512 - hero.height - 40))
ic.save(os.path.join(HERE, '..', 'icon.png'))

with open(os.path.join(OUT, 'LICENSE-ASSETS.txt'), 'w') as f:
    f.write('Graphics: Kenney (www.kenney.nl), Creative Commons Zero (CC0) - free for personal and commercial use.\n'
            'Packs: New Platformer Pack, Monster Builder Pack, Explosion Pack, Smoke Particles, Particle Pack, Game Icons.\n'
            'Font: Baloo 2 by Ek Type, SIL Open Font License 1.1 (via @fontsource/baloo-2).\n')
print('atlas', AW, atlas.height, len(frames), 'frames')
