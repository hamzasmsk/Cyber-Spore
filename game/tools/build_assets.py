#!/usr/bin/env python3
"""Builds game/assets from ONE art source: the "Ninja Adventure" asset pack by Pixel-boy & AAA (CC0).

Usage:  python3 game/tools/build_assets.py "<path to 'Ninja Adventure - Asset Pack'>" [<path to @fontsource/pixelify-sans package>]

Everything in the game (heroes, monsters, bosses, ground tiles, decor, projectiles, effects, UI frames, icons,
sounds and music) comes from that single pack, so palette, pixel density and outline style match everywhere.

Produces:
  assets/atlas.png + assets/atlas.js   in-game sprites at native 1x pixel size, drawn with nearest-neighbour
                                       scaling (window.ATLAS = {frames: {name: [x, y, w, h]}, anim: {base: n}})
  assets/ui/*.png                      interface images, pre-scaled with nearest-neighbour (shown with
                                       image-rendering: pixelated)
  assets/ui/theme/*.png                9-slice frames for panels, buttons and cards (4x)
  assets/sfx.js                        short sound effects as base64 mp3 (works from file:// too)
  assets/music/*.mp3                   one calm music loop per biome
  assets/fonts/*                       Pixelify Sans (OFL) - pixel font with full Turkish coverage
"""
import base64
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

NA = sys.argv[1] if len(sys.argv) > 1 else '/home/user/na/src/Assets/Art/Ninja Adventure - Asset Pack'
PXF = sys.argv[2] if len(sys.argv) > 2 else None
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets'))
UIDIR = os.path.join(OUT, 'ui')
THEME = os.path.join(UIDIR, 'theme')
for d in (UIDIR, os.path.join(OUT, 'music')):
    shutil.rmtree(d, ignore_errors=True)
os.makedirs(THEME)
os.makedirs(os.path.join(OUT, 'music'))


def A(*p):
    return os.path.join(NA, *p)


frames, anim = {}, {}
pieces = []   # (name, image)


def load(path):
    return Image.open(path).convert('RGBA')


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def add(name, im):
    pieces.append((name, im))


def add_strip(base, im, n=None):
    """Cut a horizontal strip into n equal cells: base_0 .. base_{n-1}."""
    n = n or (im.width // im.height if im.width % im.height == 0 else 1)
    cw = im.width // n
    for c in range(n):
        add(f'{base}_{c}', im.crop((c * cw, 0, c * cw + cw, im.height)))
    anim[base] = n


def add_gaps(base, im):
    """Split a strip on fully transparent columns (particles of different widths)."""
    a = im.getchannel('A').load()
    cols = [any(a[x, y] for y in range(im.height)) for x in range(im.width)]
    parts, x = [], 0
    while x < im.width:
        if cols[x]:
            s = x
            while x < im.width and cols[x]:
                x += 1
            parts.append((s, x))
        else:
            x += 1
    for i, (s, e) in enumerate(parts):
        add(f'{base}_{i}', trim(im.crop((s, 0, e, im.height))))
    anim[base] = len(parts)


def up(im, k=4):
    return im.resize((im.width * k, im.height * k), Image.NEAREST)


def save_ui(name, im, k=4):
    up(im, k).save(os.path.join(UIDIR, name + '.png'), optimize=True)


# ------------------------------------------------------------------ actors
# squad (5 ninjas) + leader skins; sheet = 4 columns (down, up, left, right) x 7 rows (4 walk, attack, jump, misc)
HEROES = ['NinjaBlue', 'NinjaRed', 'NinjaYellow', 'NinjaBomb', 'NinjaMasked',
          'SamuraiBlue', 'KnightGold', 'MaskFrog', 'Skeleton', 'RedNinja3', 'Master',
          # Ninja Yolu season-exclusive costumes
          'NinjaMageBlack', 'NinjaEskimo', 'Tengu', 'MaskRacoon', 'SamuraiRed', 'NinjaDark', 'Vampire', 'Princess']
DIRS = 'dulr'
for h in HEROES:
    shp = A('Actor', 'Characters', h, 'SpriteSheet.png')
    if not os.path.exists(shp):   # a few characters name their sheet differently
        shp = [p for p in glob.glob(A('Actor', 'Characters', h, '*.png')) if 'Faceset' not in p][0]
    sh = load(shp)
    for c, d in enumerate(DIRS):
        for r in range(4):
            add(f'h_{h}_{d}{r}', sh.crop((c * 16, r * 16, c * 16 + 16, r * 16 + 16)))
        add(f'h_{h}_{d}a', sh.crop((c * 16, 64, c * 16 + 16, 80)))
        add(f'h_{h}_{d}j', sh.crop((c * 16, 80, c * 16 + 16, 96)))
    save_ui(f'face_{h}', load(A('Actor', 'Characters', h, 'Faceset.png')), 3)
add('shadow', load(A('Actor', 'Characters', 'Shadow.png')))

MONSTERS = ['Slime3', 'Mushroom', 'Snake2', 'Butterfly',
            'Bamboo', 'KappaGreen', 'Racoon', 'SpiderRed', 'BlueBat',
            'Lizard', 'Mole', 'Reptile2', 'YellowsBat', 'Skull',
            'Slime', 'AxolotBlue', 'Octopus2', 'Eye', 'SkullBlue',
            'Flam', 'Spirit2', 'Cyclope', 'Beast2', 'LanternRed', 'GoldRacoon']
for m in MONSTERS:
    src = [p for p in glob.glob(A('Actor', 'Monsters', m, '*.png')) if 'Faceset' not in p][0]
    sh = load(src)
    cw, ch = sh.width // 4, sh.height // 4
    for c, d in enumerate(DIRS):
        for r in range(4):
            add(f'm_{m}_{d}{r}', sh.crop((c * cw, r * ch, c * cw + cw, r * ch + ch)))
    save_ui(f'mon_{m}', load(A('Actor', 'Monsters', m, 'Faceset.png')), 3)

BOSSES = {'GiantSlime2': 'Idle.png', 'GiantFrog': 'Idle40x40.png', 'GiantBamboo': 'Idle.png', 'GiantRacoon': 'Idle.png',
          'DemonCyclop': 'Idle.png', 'GiantRacoonGold': 'Idle.png', 'GiantSpirit': 'Idle.png', 'TenguBlue': 'Idle.png',
          'GiantFlam': 'Idle.png', 'TenguRed': 'Idle.png'}
for b, f in BOSSES.items():
    im = load(A('Actor', 'Boss', b, f))
    n = min([k for k in range(1, 20) if im.width % k == 0], key=lambda k: abs(im.width / k - im.height))
    add_strip(f'b_{b}', im, n)
    save_ui(f'boss_{b}', load(A('Actor', 'Boss', b, 'Faceset.png')), 3)

# ------------------------------------------------------------------ projectiles & effects
PJ = A('FX', 'Projectile')
for name, n in [('Shuriken', 2), ('ShurikenMagic', 2), ('Kunai', 1), ('Arrow', 1), ('BigKunai', 1), ('BigShuriken', 2),
                ('IceSpike', 8), ('Fireball', 4), ('EnergyBall', 4), ('BigEnergyBall', 4), ('CanonBall', 5),
                ('PlantSpike', 4), ('SpriteSheetRock', 4)]:
    im = load(os.path.join(PJ, name + '.png'))
    add_strip(f'p_{name}', im, n)
    save_ui(f'w_{name}', trim(im.crop((0, 0, im.width // n, im.height))), 4)

add_strip('fx_smoke', load(A('FX', 'Smoke', 'Smoke', 'SpriteSheet.png')), 6)
add_gaps('fx_smokec', load(A('FX', 'Smoke', 'SmokeCircular', 'SpriteSheet.png')))
add_strip('fx_cut', load(A('FX', 'SlashFx', 'Cut', 'SpriteSheet.png')), 5)
add_strip('fx_claw', load(A('FX', 'SlashFx', 'Claw', 'SpriteSheet.png')), 4)
add_strip('fx_flam', load(A('FX', 'Elemental', 'Flam', 'SpriteSheet.png')), 5)
add_strip('fx_thunder', load(A('FX', 'Elemental', 'Thunder', 'SpriteSheet.png')), 5)
add_strip('fx_ice', load(A('FX', 'Elemental', 'Ice', 'SpriteSheet.png')), 10)
add_strip('fx_spark', load(A('FX', 'Magic', 'Spark', 'SpriteSheet.png')), 5)
add_strip('fx_circle', load(A('FX', 'Magic', 'Circle', 'SpriteSheetOrange.png')), 4)
add_strip('fx_circlew', load(A('FX', 'Magic', 'Circle', 'SpriteSheetWhite.png')), 4)
add_strip('fx_aura', load(A('FX', 'Magic', 'Aura', 'SpriteSheetWhite.png')), 4)
add_strip('fx_shield', load(A('FX', 'Magic', 'Shield', 'SpriteSheetYellow.png')), 6)
for q in ['Leaf', 'LeafPink', 'Snow', 'Fire', 'Rock', 'RockGray', 'Spark', 'Grass', 'Wood']:
    add_gaps(f'q_{q}', load(A('FX', 'Particle', q + '.png')))

coin = load(A('Items', 'Treasure', 'Coin2.png'))
add_strip('coin', coin, 4)
hearts = load(A('Ui', 'heart.png'))
add('heart', hearts.crop((64, 0, 80, 16)))
add('heart_empty', hearts.crop((0, 0, 16, 16)))
# weapons held in hand (pack sprites point down; drawn rotated by multiples of 90 degrees, which is lossless)
WPN = A('Items', 'Weapons')
add('wh_Bow', load(os.path.join(WPN, 'Bow', 'Sprite.png')))
add('wh_Wand', load(os.path.join(WPN, 'MagicWand', 'SpriteInHand.png')))
add('wh_Book', load(os.path.join(WPN, 'Book', 'SpriteInHand.png')))
add('gem_icon', trim(load(A('Backgrounds', 'Tilesets', 'TilesetNature.png')).crop((16, 240, 32, 256))))
add('bar_under', load(A('Ui', 'LifeBarMiniUnder.png')))
add('bar_red', load(A('Ui', 'LifeBarMiniProgress.png')))

# ------------------------------------------------------------------ ground tiles (TilesetFloor terrain blocks)
FLOOR = load(A('Backgrounds', 'Tilesets', 'TilesetFloor.png'))
NAT = load(A('Backgrounds', 'Tilesets', 'TilesetNature.png'))
DES = load(A('Backgrounds', 'Tilesets', 'TilesetDesert.png'))
TERRAIN = {'grass': (0, 7), 'forest': (11, 7), 'sand': (0, 0), 'snow': (0, 14), 'ash': (11, 14)}


def tile(tx, ty):
    return FLOOR.crop((tx * 16, ty * 16, tx * 16 + 16, ty * 16 + 16))


for k, (bx, by) in TERRAIN.items():
    add(f't_{k}_fill', tile(bx, by + 5))
    for i in range(1, 5):
        add(f't_{k}_d{i}', tile(bx + i, by + 5))
    for nm, (dx, dy) in {'pl': (0, 1), 'pc': (1, 1), 'pr': (2, 1), 'pc2': (0, 4), 'pc3': (1, 4),
                         'ptl': (0, 0), 'pt': (1, 0), 'ptr': (2, 0)}.items():
        add(f't_{k}_{nm}', tile(bx + dx, by + dy))

DECOR = {   # name: (sheet, x0, y0, x1, y1) in pixels
    'tree_round': (NAT, 0, 0, 32, 32), 'tree_pine': (NAT, 32, 0, 64, 32), 'tree_dead': (NAT, 64, 0, 96, 32),
    'tree_dark': (NAT, 96, 0, 128, 32), 'tree_snowpine': (NAT, 128, 0, 160, 32), 'tree_snowpine2': (NAT, 160, 0, 192, 32),
    'tree_snowround': (NAT, 192, 0, 224, 32), 'tree_pink': (NAT, 224, 0, 256, 32), 'tree_light': (NAT, 256, 0, 288, 32),
    'tree_light2': (NAT, 288, 0, 320, 32),
    'trio_pine': (NAT, 0, 32, 64, 80), 'trio_round': (NAT, 64, 32, 128, 80), 'trio_snow': (NAT, 128, 32, 192, 80),
    'trio_light': (NAT, 256, 32, 320, 80), 'trio_dead': (NAT, 0, 80, 64, 128), 'trio_snowpine': (NAT, 128, 80, 192, 128),
    'rocks_brown': (NAT, 192, 80, 256, 128), 'rocks_grey': (NAT, 256, 80, 320, 128),
    'stump_dark': (NAT, 0, 128, 32, 160), 'stump': (NAT, 32, 128, 64, 160), 'stump_small': (NAT, 64, 128, 80, 144),
    'tree_small': (NAT, 96, 128, 128, 160),
    'rock_brown': (NAT, 208, 128, 240, 160), 'rock_brown_s': (NAT, 240, 144, 256, 160),
    'rock_grey': (NAT, 256, 128, 288, 160), 'rock_grey_s': (NAT, 288, 144, 304, 160),
    'boulder_teal': (NAT, 0, 192, 32, 224), 'boulder_snow': (NAT, 32, 192, 64, 224),
    'snowrock': (NAT, 64, 192, 80, 208), 'snowball': (NAT, 80, 192, 96, 208), 'tealspike': (NAT, 96, 192, 112, 208),
    'tealrock': (NAT, 112, 192, 128, 208), 'icespike': (NAT, 128, 208, 144, 224),
    'crystal_o': (NAT, 0, 224, 16, 240), 'crystal_t': (NAT, 16, 224, 32, 240), 'crystal_p': (NAT, 32, 224, 48, 240),
    'big_pink': (NAT, 0, 288, 48, 336), 'big_green': (NAT, 48, 288, 96, 336), 'big_white': (NAT, 96, 288, 144, 336),
    'big_orange': (NAT, 144, 288, 192, 336),
    'palm': (DES, 160, 160, 192, 192), 'palm2': (DES, 192, 160, 224, 192), 'drybush': (DES, 128, 143, 144, 160),
}
for i in range(11):
    DECOR[f'bush{i}'] = (NAT, i * 16, 160, i * 16 + 16, 176)
for i, n in enumerate(['flower_sun', 'flower_sun2', 'clover', 'flower_red', 'leafy', 'leafy2', 'flower_white']):
    DECOR[n] = (NAT, i * 16, 176, i * 16 + 16, 192)
for n, (sh, x0, y0, x1, y1) in DECOR.items():
    add('d_' + n, trim(sh.crop((x0, y0, x1, y1))))

# ------------------------------------------------------------------ bitmap font for in-canvas numbers (pack font8x8, ASCII 32..)
# each glyph is trimmed to its width, given a 1px ink outline and baked in 4 colours: g<colour>_<charcode>
FONT8 = load(A('Ui', 'Font', 'font8x8.png'))
GCOL = {'w': (252, 226, 202), 'y': (255, 225, 141), 'r': (239, 149, 151), 'o': (255, 149, 84)}
for code in range(33, 127):
    i = code - 32
    cell = np.array(FONT8.crop(((i % 15) * 8, (i // 15) * 8, (i % 15) * 8 + 8, (i // 15) * 8 + 8)))[:, :, 3] > 0
    if not cell.any():
        continue
    cs = np.where(cell.any(0))[0]
    m = cell[:, cs[0]:cs[-1] + 1]
    M = np.zeros((m.shape[0] + 2, m.shape[1] + 2), bool)
    M[1:-1, 1:-1] = m
    O = M.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            O |= np.roll(np.roll(M, dy, 0), dx, 1)
    for k, c in GCOL.items():
        a = np.zeros(M.shape + (4,), np.uint8)
        a[O] = (19, 27, 27, 255)
        a[M] = c + (255,)
        add(f'g{k}_{code}', Image.fromarray(a, 'RGBA'))

# ------------------------------------------------------------------ generated pixel VFX (pack palette, ordered dithering)
# The pack has few large effects, so glows, bursts and shock rings are generated here on the pixel grid with a
# 4x4 Bayer matrix: hard edges and dithered falloff, so they sit next to the hand-drawn art.
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
VCOL = {'gold': ['#ff9554', '#ffe18d', '#ffffff'], 'ice': ['#548789', '#8feff1', '#ffffff'], 'fire': ['#d14b34', '#ff9554', '#ffe18d'],
        'magic': ['#a5608b', '#d3a2c0', '#ffffff'], 'leaf': ['#56864c', '#adbc3a', '#ffffff'], 'ink': ['#46402e', '#8d977f', '#fce2ca']}


def rgba(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def dith_layers(level, size):
    """level: float array 0..3 -> image using palette layers with dithered borders."""
    by = np.tile(BAYER, (size // 4 + 1, size // 4 + 1))[:size, :size]
    return np.floor(level + by - 0.5).clip(0, 3).astype(int)


for name, cols in VCOL.items():
    pal = [None] + [rgba(c) for c in cols]
    # glow blob (drawn additively behind projectiles)
    for sz in (24, 40):
        yy, xx = np.mgrid[0:sz, 0:sz] + 0.5
        d = np.hypot(xx - sz / 2, yy - sz / 2) / (sz / 2)
        L = dith_layers(np.clip(1 - d, 0, 1) ** 1.2 * 3.4, sz)
        im = np.zeros((sz, sz, 4), np.uint8)
        for k in (1, 2, 3):
            im[L == k] = pal[k]
        add(f'vx_glow{sz}_{name}', Image.fromarray(im, 'RGBA'))
    # starburst impact: 8 frames, rays grow then thin out, core shrinks
    sz, n = 48, 8
    for f in range(n):
        t = f / (n - 1)
        yy, xx = np.mgrid[0:sz, 0:sz] + 0.5
        dx, dy = xx - sz / 2, yy - sz / 2
        r = np.hypot(dx, dy); a = np.arctan2(dy, dx)
        reach = (0.35 + 0.65 * min(1, t * 2.2)) * sz / 2
        width = (1 - t) * 0.22 + 0.04
        ang = np.abs(((a + np.pi / 8) % (np.pi / 4)) - np.pi / 8)
        long_ = (np.round((a + np.pi) / (np.pi / 4)) % 2 == 0)
        ray = (ang < width * (1 - r / reach)) & (r < reach * np.where(long_, 1, 0.6))
        core = r < (1 - t) ** 1.5 * sz * 0.2
        L = np.zeros((sz, sz), int)
        L[ray] = np.where(r[ray] < reach * 0.45, 3, 2)
        L[core] = 3
        edge = (r < (1 - t) ** 1.5 * sz * 0.2 + 2) & ~core & (t < 0.6)
        L[edge & (L == 0)] = 1
        im = np.zeros((sz, sz, 4), np.uint8)
        for k in (1, 2, 3):
            im[L == k] = pal[k]
        add(f'vx_burst_{name}_{f}', Image.fromarray(im, 'RGBA'))
    anim[f'vx_burst_{name}'] = n
    # shock ring: 8 frames, dithered thinning ring
    sz = 64
    for f in range(n):
        t = f / (n - 1)
        yy, xx = np.mgrid[0:sz, 0:sz] + 0.5
        r = np.hypot(xx - sz / 2, yy - sz / 2)
        R0 = 4 + t * (sz / 2 - 5); th = 4 * (1 - t) + 1
        v = np.clip(1 - np.abs(r - R0) / th, 0, 1) * 3.3 * (1 - t * 0.5)
        L = dith_layers(v, sz)
        im = np.zeros((sz, sz, 4), np.uint8)
        for k in (1, 2, 3):
            im[L == k] = pal[k]
        add(f'vx_ring_{name}_{f}', Image.fromarray(im, 'RGBA'))
    anim[f'vx_ring_{name}'] = n

# ------------------------------------------------------------------ pack the atlas (shelf packer, 2px gutter)
pieces.sort(key=lambda p: (-p[1].height, -p[1].width))
AW, x, y, rowh, pad = 1024, 0, 0, 0, 2
pos = []
for name, im in pieces:
    if x + im.width + pad > AW:
        x, y, rowh = 0, y + rowh + pad, 0
    pos.append((name, im, x, y))
    x += im.width + pad
    rowh = max(rowh, im.height)
AH = y + rowh
atlas = Image.new('RGBA', (AW, AH))
for name, im, px, py in pos:
    atlas.alpha_composite(im, (px, py))
    frames[name] = [px, py, im.width, im.height]
atlas.save(os.path.join(OUT, 'atlas.png'), optimize=True)
with open(os.path.join(OUT, 'atlas.js'), 'w') as f:
    f.write('window.ATLAS=' + json.dumps({'frames': frames, 'anim': anim}, separators=(',', ':')) + ';\n')
print('atlas', AW, AH, len(frames), 'frames')

# ------------------------------------------------------------------ UI images
ICON = A('Ui', 'Icon')
UIMAP = {
    'ic_power': 'Spell/AttackUpgrade', 'ic_rate': 'Items&Weapon/Kunai', 'ic_money': 'Items&Weapon/Money',
    'ic_rebirth': 'Spell/Alchemy', 'ic_weapon': 'Items&Weapon/Shuriken', 'ic_team': 'Spell/Counter',
    'ic_auto': 'Spell/Permutation', 'ic_missions': 'Items&Weapon/Scroll', 'ic_mine': 'Job&Action/Mine',
    'ic_shop': 'Job&Action/Potion', 'ic_piggy': 'Job&Action/Water', 'ic_skins': 'Spell/Camouflage',
    'ic_boost': 'Spell/Upgrade', 'ic_settings': 'Job&Action/Repair', 'ic_sound_on': 'Job&Action/Sing',
    'ic_sound_off': 'Job&Action/SingDisabled', 'ic_heal': 'Spell/Heal', 'ic_death': 'Spell/Death',
    'ic_fire': 'Spell/Fireball', 'ic_explosion': 'Spell/Explosion', 'ic_luck': 'Spell/LuckUpgrade',
    'ic_shield': 'Spell/DefenseUpgrade', 'ic_vision': 'Spell/Vision', 'ic_sun': 'Meteo/Sun', 'ic_moon': 'Meteo/Moon',
    'ic_ring': 'Items&Weapon/Ring', 'ic_amulet': 'Items&Weapon/Amulet', 'ic_boot': 'Items&Weapon/Boot',
    'ic_magic': 'Spell/MagicWeapon', 'ic_book': 'Spell/BookLight', 'ic_orb': 'Spell/OrbLight', 'ic_down': 'Spell/Downgrade',
}
for k, v in UIMAP.items():
    save_ui(k, load(os.path.join(ICON, v + '.png')))
save_ui('coin', coin.crop((0, 0, 10, 10)), 4)
save_ui('gem', trim(NAT.crop((16, 240, 32, 256))), 4)
save_ui('gem_big', trim(NAT.crop((16, 256, 32, 272))), 4)
save_ui('crystal', trim(NAT.crop((16, 224, 32, 240))), 4)
save_ui('heart', hearts.crop((64, 0, 80, 16)), 4)
chest = load(A('Items', 'Treasure', 'BigTreasureChest.png'))
save_ui('chest', trim(chest.crop((0, 0, 16, 14))), 4)
save_ui('chest_open', trim(chest.crop((16, 0, 32, 14))), 4)
save_ui('cup', load(A('Items', 'Treasure', 'GoldCup.png')), 4)
save_ui('key', load(A('Items', 'Treasure', 'GoldKey.png')), 4)
save_ui('shuriken', load(A('Ui', 'Shuriken.png')), 4)
save_ui('lever', load(A('Ui', 'Lever.png')), 2)

# custom 12x12 glyphs drawn in the pack palette (no pack equivalent): close X, lock, play triangle
INK, CREAM = (19, 27, 27, 255), (252, 226, 202, 255)


def glyph(rows, cmap):
    im = Image.new('RGBA', (len(rows[0]), len(rows)))
    for yy, row in enumerate(rows):
        for xx, ch in enumerate(row):
            if ch in cmap:
                im.putpixel((xx, yy), cmap[ch])
    return im


save_ui('x', glyph(['.oo......oo.', 'oxxo....oxxo', 'oxxxo..oxxxo', '.oxxxooxxxo.', '..oxxxxxxo..', '...oxxxxo...',
                    '...oxxxxo...', '..oxxxxxxo..', '.oxxxooxxxo.', 'oxxxo..oxxxo', 'oxxo....oxxo', '.oo......oo.'],
                   {'o': INK, 'x': CREAM}))
save_ui('lock', glyph(['...oooooo...', '..oxxxxxxo..', '.oxo....oxo.', '.oxo....oxo.', 'oooooooooooo', 'oyyyyyyyyyyo',
                       'oyyyyooyyyyo', 'oyyyyooyyyyo', 'oyyyyyoyyyyo', 'oyyyyyyyyyyo', 'owwwwwwwwwwo', 'oooooooooooo'],
                      {'o': INK, 'x': (141, 151, 127, 255), 'y': (241, 196, 113, 255), 'w': (215, 139, 74, 255)}))
save_ui('play', glyph(['oo..........', 'oxoo........', 'oxxxoo......', 'oxxxxxoo....', 'oxxxxxxxoo..', 'oxxxxxxxxxo.',
                       'oxxxxxxxxxo.', 'oxxxxxxxoo..', 'oxxxxxoo....', 'oxxxoo......', 'oxoo........', 'oo..........'],
                      {'o': INK, 'x': CREAM}))

# weapon icon tiles in the pack's icon style (one per weapon tier)
for w, src in {'Shuriken': 'Items&Weapon/Shuriken', 'Kunai': 'Items&Weapon/Kunai', 'Arrow': 'Items&Weapon/Arrow',
               'BigKunai': 'Spell/Cut', 'ShurikenMagic': 'Spell/OrbLight', 'IceSpike': 'Spell/BookIce',
               'Fireball': 'Spell/Fireball', 'BigEnergyBall': 'Spell/OrbWater'}.items():
    save_ui(f'wi_{w}', load(os.path.join(ICON, src + '.png')))
# settings: a cog drawn in the pack's icon-tile style (the pack has no gear icon), computed on the pixel grid
def gear_icon():
    import math
    T = np.zeros((24, 24, 4), np.uint8)
    T[1:22, 1:23] = (84, 135, 137, 255)
    T[21, 1:23] = (45, 105, 123, 255)
    for (y, x) in [(1, 1), (1, 22), (21, 1), (21, 22)]:
        T[y, x] = (0, 0, 0, 0)
    cx, cy = 11.5, 10.5
    yy, xx = np.mgrid[0:24, 0:24]
    r = np.hypot(xx - cx, yy - cy)
    ang = (np.degrees(np.arctan2(yy - cy, xx - cx)) + 360) % 45
    tooth = (np.minimum(ang, 45 - ang) < 8) & (r <= 8.8)
    body = ((r <= 6.4) | tooth) & (r >= 3.1)
    out = body.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out |= np.roll(np.roll(body, dy, 0), dx, 1)
    T[out & ~body] = (19, 27, 27, 255)
    T[body] = (242, 234, 241, 255)
    T[body & (yy - cy > 2.5) & (r > 4.5)] = (184, 220, 229, 255)
    T[3, 4] = T[18, 19] = (184, 220, 229, 255)
    return Image.fromarray(T, 'RGBA')


save_ui('ic_gear', gear_icon())

# 9-slice frames (4x) + palette-swapped button colours
TW = A('Ui', 'Theme', 'ThemeWood')
for n, p in {'panel': 'nine_path_panel.png', 'panel_light': 'nine_path_panel_3.png', 'cell': 'inventory_cell.png',
             'bg': 'nine_path_bg.png', 'bg2': 'nine_path_bg_2.png', 'btn': 'button_normal.png',
             'btn_down': 'button_pressed.png', 'tab': 'tab_selected.png', 'tab_off': 'tab_unselected.png',
             'slider': 'slider_progress.png', 'arrow_l': 'arrow_left.png', 'arrow_r': 'arrow_right.png',
             'check': 'checked.png', 'uncheck': 'unchecked.png'}.items():
    up(load(os.path.join(TW, p))).save(os.path.join(THEME, n + '.png'))
for n in ['ThemeWood2', 'ThemeMetal', 'ThemeMap', 'ThemeDark', 'ThemeBamboo', 'ThemeRed', 'ThemeBubble']:
    up(load(A('Ui', 'Theme', 'Wip', n, 'nine_path_panel.png'))).save(os.path.join(THEME, n.lower().replace('theme', 'p_') + '.png'))
for n, p in {'dialog': 'DialogueBoxSimple.png', 'facebox': 'FacesetBox.png'}.items():
    up(load(A('Ui', 'Dialog', p))).save(os.path.join(THEME, n + '.png'))


def hx(s):
    return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


ORANGE = ['#9b513c', '#f06733', '#ffad55']   # dark rim, face, highlight (the pack's wood theme)
RAMPS = {'green': ['#345a52', '#74a334', '#adbc3a'], 'blue': ['#2d697b', '#548789', '#79b8ce'],
         'purple': ['#543c52', '#a5608b', '#d3a2c0'], 'red': ['#8f3e56', '#e0394c', '#ef9597'],
         'grey': ['#4e484a', '#8e7c73', '#b3957f'], 'yellow': ['#d78b4a', '#f1c471', '#ffe18d'],
         'sage': ['#46402e', '#56634d', '#8d977f']}


def swap(im, ramp):
    src = [hx(c) for c in ORANGE]
    dst = [hx(c) for c in ramp]
    out = im.copy()
    px = out.load()
    for yy in range(out.height):
        for xx in range(out.width):
            p = px[xx, yy]
            if p in src:
                px[xx, yy] = dst[src.index(p)]
    return out


for col, ramp in RAMPS.items():
    for n, p in {'btn': 'button_normal.png', 'btn_down': 'button_pressed.png', 'slider': 'slider_progress.png'}.items():
        up(swap(load(os.path.join(TW, p)), ramp)).save(os.path.join(THEME, f'{n}_{col}.png'))

# app icon: leader faceset on the wood panel
face = load(A('Actor', 'Characters', 'NinjaBlue', 'Faceset.png'))
panel = load(os.path.join(TW, 'nine_path_panel_3.png'))
ic = Image.new('RGBA', (64, 64))
ic.alpha_composite(panel.resize((64, 64), Image.NEAREST))
ic.alpha_composite(face.resize((38, 38), Image.NEAREST), (13, 11))
ic.resize((512, 512), Image.NEAREST).save(os.path.join(OUT, '..', 'icon.png'), optimize=True)

# ------------------------------------------------------------------ audio (soft, relaxing mix)
# Effects are the pack's softest (lowest spectral centroid) sounds, high-cut and loudness-matched so nothing is
# shrill; a few "reward" sounds get a short room echo. Music: one calm, warm track per biome (loudness -24 LUFS).
SFX = {  # name: (source, low-pass Hz, echo)
    # throws (one per weapon family) and impacts
    'throw': ('Game/Sword', 2600, 0), 'throw2': ('Game/Sword2', 2400, 0), 'throw_fire': ('Game/Fireball2', 2600, 0),
    'throw_magic': ('Game/Magic2', 3600, 0), 'hit': ('Game/Hit', 3200, 0), 'hit2': ('Game/Hit1', 3000, 0),
    'hit3': ('Game/Hit5', 3000, 0), 'hit_ice': ('Menu/Menu9', 4200, 0), 'hit_fire': ('Game/Fire3', 2600, 0),
    'kill': ('Game/MiniImpact', 3600, 0), 'boom': ('Game/Explosion2', 2400, 0), 'lob': ('Game/Fireball', 3000, 0),
    # rewards and progression
    'coin': ('Game/Coin', 4200, 0), 'gold': ('Game/Gold1', 4500, 1), 'gem': ('Game/Gold3', 4500, 1),
    'buy': ('Game/PowerUp1', 5000, 1), 'bonus': ('Game/Bonus', 4500, 1), 'skill': ('Game/PowerUp2', 5000, 1),
    'stage': ('Game/Success2', 5000, 1), 'win': ('Game/Success3', 5000, 1), 'boss': ('Game/Secret1', 5000, 1),
    'elite': ('Game/Alert2', 3000, 1), 'treasure': ('Game/Gold2', 4500, 1), 'magic': ('Game/Magic2', 4500, 1),
    # squad
    'hurt': ('Game/Hit2', 2600, 0), 'fail': ('Game/GameOver2', 4000, 1), 'voice': ('Game/Voice2', 4000, 0),
    # interface
    'click': ('Menu/Menu12', 4500, 0), 'open': ('Menu/Menu4', 4500, 1), 'close': ('Menu/Menu5', 4000, 0),
    'tick': ('Menu/Menu8', 4500, 0), 'no': ('Menu/Menu11', 3500, 0), 'accept': ('Menu/Accept2', 4500, 1)}
tmp = tempfile.mkdtemp()
data = {}
for k, (v, lp, echo) in SFX.items():
    dst = os.path.join(tmp, k + '.mp3')
    af = f'highpass=f=90,lowpass=f={lp},loudnorm=I=-20:TP=-3,afade=t=in:d=0.004'
    if echo:
        af += ',aecho=0.8:0.6:60|140:0.18|0.09,apad=pad_dur=0.25'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', A('Sounds', v + '.wav'), '-af', af, '-ac', '1', '-ar', '44100',
                    '-b:a', '64k', dst], check=True)
    data[k] = base64.b64encode(open(dst, 'rb').read()).decode()
with open(os.path.join(OUT, 'sfx.js'), 'w') as f:
    f.write('window.SFXDATA=' + json.dumps(data, separators=(',', ':')) + ';\n')
MUSIC = {'grass': '31 - Sunny', 'forest': '11 - Clearing', 'sand': '27 - Chill', 'snow': '22 - Dream', 'ash': '15 - Credit Theme'}
for k, v in MUSIC.items():
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', A('Musics', v + '.ogg'),
                    '-af', 'highpass=f=40,lowpass=f=9000,loudnorm=I=-24:TP=-4', '-ac', '1', '-ar', '44100', '-b:a', '64k',
                    os.path.join(OUT, 'music', k + '.mp3')], check=True)
shutil.rmtree(tmp)

# ------------------------------------------------------------------ font
if PXF:
    fd = os.path.join(OUT, 'fonts')
    shutil.rmtree(fd, ignore_errors=True)
    os.makedirs(fd)
    for s in ('latin', 'latin-ext'):
        shutil.copy(os.path.join(PXF, 'files', f'pixelify-sans-{s}-700-normal.woff2'), fd)
    shutil.copy(os.path.join(PXF, 'LICENSE'), os.path.join(fd, 'OFL.txt'))
# numbers use the pack's own pixel font (clearer digits); subset to digits and number punctuation
from fontTools import subset
opts = subset.Options()
opts.flavor = 'woff2'
fnt = subset.load_font(A('Ui', 'Font', 'NormalFont.ttf'), opts)
sub = subset.Subsetter(opts)
sub.populate(text='0123456789.,/+-:')
sub.subset(fnt)
subset.save_font(fnt, os.path.join(OUT, 'fonts', 'squadnum.woff2'), opts)

with open(os.path.join(OUT, 'LICENSE-ASSETS.txt'), 'w') as f:
    f.write('Graphics, sound effects and music: "Ninja Adventure" asset pack by Pixel-boy and AAA\n'
            '(https://pixel-boy.itch.io/ninja-adventure-asset-pack), Creative Commons Zero (CC0).\n'
            'Number font: NormalFont from the same pack (CC0).\n'
            'Font: Pixelify Sans by Stefie Justprince, SIL Open Font License 1.1 (via @fontsource/pixelify-sans).\n')
# extra art drawn on the pixel grid: Neo Ninja weapons + effect skins (atlas), one-icon-per-meaning set (ui)
subprocess.run([sys.executable, os.path.join(HERE, 'build_neo.py')], check=True)
subprocess.run([sys.executable, os.path.join(HERE, 'build_icons.py'), NA], check=True)
print('done')
