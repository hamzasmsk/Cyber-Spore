#!/usr/bin/env python3
"""Neo Ninja + effect skins: original pixel art drawn here on the pixel grid (no outside art), appended to the
game atlas so the renderer needs no second texture.

Usage:  python3 game/tools/build_neo.py      (idempotent: earlier Neo frames are removed first; build_assets.py
                                             calls it at the end, so a full asset rebuild keeps them)

Adds to assets/atlas.png + assets/atlas.js:
  p_Plasma_0..1  p_Laser_0  p_Katana_0..1  p_Rail_0  p_Drone_0..1     Neo Ninja projectiles
  wh_Katana  wh_NeoBow                                               held weapons
  fxp_petal_* fxp_ember_* fxp_bolt_* fxp_moon_0 fxp_bit_*            effect-skin particles
  vx_glow24/40_*, vx_burst_*, vx_ring_*  for neon, laser, dragon, lotus, sakura, moon
  vx_slash_moon / vx_slash_neon                                      crescent slash (6 frames)
and to assets/ui/: wi_Plasma.png ... wi_Drone.png (weapon icons), fxi_<skin>.png (effect skin icons, each its own motif), fxi_all.png, ic_neo.png.
Style rules of the pack: 1 px ink outline (#131b1b), 3-tone ramps, hard pixels, dithered glow falloff.
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'assets'))
UIDIR = os.path.join(OUT, 'ui')
INK = (19, 27, 27, 255)


def rgba(h, a=255):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (a,)


C = {k: rgba(v) for k, v in {
    'cy0': '#1b5f8c', 'cy1': '#3fd0e8', 'cy2': '#a8f6ff', 'wh': '#ffffff',
    'mg0': '#7a1f5c', 'mg1': '#ff4fb0', 'mg2': '#ffb3df',
    'st0': '#3a4152', 'st1': '#7d8aa3', 'st2': '#c9d3e3',
    'vi0': '#4b2a7a', 'vi1': '#8a5cf0', 'vi2': '#c9b0ff',
    'go': '#ffe18d', 'go0': '#c98a2e', 'rd': '#e0394c',
    'pk0': '#b44a7c', 'pk1': '#f27fae', 'pk2': '#ffc2dc',
    'or0': '#a82424', 'or1': '#ff7a2e', 'or2': '#ffd36b',
}.items()}

pieces = []   # (name, image)
anim = {}


def add(name, im):
    pieces.append((name, im))


def outline(im):
    """1 px ink outline around every opaque pixel (4-neighbourhood), like the pack's sprites."""
    a = np.array(im)[:, :, 3] > 0
    p = np.pad(a, 1)
    ring = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~a
    big = Image.new('RGBA', (im.width + 2, im.height + 2))
    arr = np.array(big)
    r2 = np.pad(ring, 1)
    arr[r2] = INK
    big = Image.fromarray(arr, 'RGBA')
    big.alpha_composite(im, (1, 1))
    # outline once more around the padded image so the ring sits outside
    a2 = np.array(big)[:, :, 3] > 0
    p = np.pad(a2, 1)
    ring2 = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~a2
    arr = np.array(big); arr[ring2] = INK
    return trim(Image.fromarray(arr, 'RGBA'))


def trim(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def canvas(w, h):
    im = Image.new('RGBA', (w, h))
    return im, ImageDraw.Draw(im)


def px(d, pts, col):
    for x, y in pts:
        d.point((x, y), fill=col)


# ------------------------------------------------------------------ projectiles
def plasma(frame):
    im, d = canvas(13, 13)
    c = 6
    tips = [(c, 0), (12, c), (c, 12), (0, c)] if frame == 0 else [(1, 1), (11, 1), (11, 11), (1, 11)]
    for i, t in enumerate(tips):
        # each blade: a triangle from the tip to two points beside the core (a pinwheel, so it reads as spinning)
        ang = np.arctan2(t[1] - c, t[0] - c)
        side = (c + round(np.cos(ang + 1.9) * 3), c + round(np.sin(ang + 1.9) * 3))
        side2 = (c + round(np.cos(ang - 0.5) * 2), c + round(np.sin(ang - 0.5) * 2))
        d.polygon([t, side, side2], fill=C['cy1'])
        d.line([t, side2], fill=C['cy2'])
    d.ellipse((c - 2, c - 2, c + 2, c + 2), fill=C['mg1'])
    d.point((c, c), fill=C['wh']); d.point((c - 1, c), fill=C['mg2'])
    return outline(im)


def laser():
    im, d = canvas(17, 5)
    d.ellipse((0, 1, 2, 3), outline=C['st1'])               # ring
    d.rectangle((3, 2, 6, 2), fill=C['st0'])                 # handle
    d.point((4, 2), fill=C['mg1'])
    d.polygon([(7, 0), (16, 2), (7, 4)], fill=C['mg1'])     # energy blade
    d.line([(7, 2), (15, 2)], fill=C['wh'])
    d.line([(8, 1), (12, 2)], fill=C['mg2'])
    return outline(im)


def katana_wave(frame):
    im = Image.new('RGBA', (12, 22))
    a = np.zeros((22, 12, 4), np.uint8)
    yy, xx = np.mgrid[0:22, 0:12] + 0.5
    r = np.hypot(xx + 6, yy - 11)
    for lo, hi, col in ((13.5, 17.5, C['cy0']), (14.5, 17.0, C['cy1']), (15.5, 16.6, C['cy2'] if frame == 0 else C['wh'])):
        m = (r >= lo) & (r < hi)
        a[m] = col
    # taper the tips
    tip = (np.abs(yy - 11) > 9) & (r < 16.2)
    a[tip] = 0
    return outline(Image.fromarray(a, 'RGBA'))


def rail():
    im, d = canvas(16, 5)
    d.line([(0, 0), (2, 2)], fill=C['mg1']); d.line([(0, 4), (2, 2)], fill=C['mg1'])   # fletching
    d.line([(1, 2), (11, 2)], fill=C['cy1'])
    d.line([(4, 2), (10, 2)], fill=C['wh'])
    d.polygon([(11, 0), (15, 2), (11, 4)], fill=C['cy2'])
    d.point((13, 2), fill=C['wh'])
    return outline(im)


def drone(frame):
    im, d = canvas(11, 9)
    d.rectangle((2, 3, 8, 7), fill=C['st1'])
    d.line([(3, 3), (7, 3)], fill=C['st2'])
    d.rectangle((2, 7, 8, 7), fill=C['st0'])
    d.point((5, 5), fill=C['rd'] if frame == 0 else C['cy2']); d.point((4, 5), fill=C['st0']); d.point((6, 5), fill=C['st0'])
    # rotors: long / short alternate so they read as spinning
    if frame == 0:
        d.line([(0, 1), (4, 1)], fill=C['cy2']); d.line([(6, 1), (10, 1)], fill=C['cy2'])
    else:
        d.line([(1, 1), (3, 1)], fill=C['cy1']); d.line([(7, 1), (9, 1)], fill=C['cy1'])
    d.point((2, 2), fill=C['st0']); d.point((8, 2), fill=C['st0'])
    return outline(im)


def katana_held():
    im, d = canvas(4, 18)
    d.line([(1, 0), (1, 12)], fill=C['st2']); d.line([(2, 1), (2, 12)], fill=C['cy1'])   # blade with neon edge
    d.point((1, 0), fill=C['wh'])
    d.line([(0, 13), (3, 13)], fill=C['go'])                                          # guard
    d.rectangle((1, 14, 2, 17), fill=C['vi0']); d.point((1, 15), fill=C['vi1'])         # wrapped grip
    return outline(im)


# ------------------------------------------------------------------ effect-skin particles
def petal(rot):
    im, d = canvas(5, 4)
    px(d, [(1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (3, 2), (4, 2), (2, 3), (3, 3)], C['pk1'])
    px(d, [(1, 1), (2, 1)], C['pk2']); px(d, [(3, 3), (4, 2)], C['pk0'])
    im = im.rotate(90 * rot, expand=True)
    return im


def ember(k):
    s = [2, 3, 2][k]
    im, d = canvas(s, s)
    d.rectangle((0, 0, s - 1, s - 1), fill=[C['or1'], C['or2'], C['go']][k])
    if s == 3:
        d.point((1, 1), fill=C['wh'])
    return im


def bolt(k):
    im, d = canvas(5, 7)
    paths = [[(2, 0), (1, 2), (3, 3), (1, 5), (2, 6)], [(1, 0), (3, 2), (1, 3), (3, 5), (2, 6)], [(3, 0), (2, 2), (3, 4), (1, 6)]]
    d.line(paths[k], fill=C['cy2'])
    for x, y in paths[k][1:-1]:
        d.point((x, y), fill=C['wh'])
    return im


def moon():
    im, d = canvas(7, 7)
    d.ellipse((0, 0, 6, 6), fill=C['vi2'])
    d.ellipse((2, -1, 8, 5), fill=(0, 0, 0, 0))
    d.point((1, 3), fill=C['wh'])
    return outline(im)


def bit(k):
    im, d = canvas(2, 2)
    d.rectangle((0, 0, 1, 1), fill=[C['cy1'], C['mg1']][k])
    return im


# ------------------------------------------------------------------ dithered glow / burst / ring (same recipe as build_assets.py)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
VCOL = {'neon': ['#1b5f8c', '#3fd0e8', '#ffffff'], 'laser': ['#7a1f5c', '#ff4fb0', '#ffffff'], 'dragon': ['#a82424', '#ff7a2e', '#ffe18d'],
        'lotus': ['#3b3aa6', '#6fb6ff', '#ffffff'], 'sakura': ['#b44a7c', '#f9a3c8', '#ffffff'], 'moon': ['#4b3f73', '#b9b4e6', '#ffffff']}


def dith(level, size):
    by = np.tile(BAYER, (size // 4 + 1, size // 4 + 1))[:size, :size]
    return np.floor(level + by - 0.5).clip(0, 3).astype(int)


def paint(L, pal):
    im = np.zeros(L.shape + (4,), np.uint8)
    for k in (1, 2, 3):
        im[L == k] = pal[k]
    return Image.fromarray(im, 'RGBA')


def palette_fx(name, cols):
    pal = [None] + [rgba(c) for c in cols]
    for sz in (24, 40):
        yy, xx = np.mgrid[0:sz, 0:sz] + 0.5
        dd = np.hypot(xx - sz / 2, yy - sz / 2) / (sz / 2)
        add(f'vx_glow{sz}_{name}', paint(dith(np.clip(1 - dd, 0, 1) ** 1.2 * 3.4, sz), pal))
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
        add(f'vx_burst_{name}_{f}', paint(L, pal))
    anim[f'vx_burst_{name}'] = n
    sz = 64
    for f in range(n):
        t = f / (n - 1)
        yy, xx = np.mgrid[0:sz, 0:sz] + 0.5
        r = np.hypot(xx - sz / 2, yy - sz / 2)
        R0 = 4 + t * (sz / 2 - 5); th = 4 * (1 - t) + 1
        v = np.clip(1 - np.abs(r - R0) / th, 0, 1) * 3.3 * (1 - t * 0.5)
        add(f'vx_ring_{name}_{f}', paint(dith(v, sz), pal))
    anim[f'vx_ring_{name}'] = n


def slash(name, cols):
    """Crescent slash: a thick arc sweeps open, then thins out (6 frames, 36x36)."""
    pal = [None] + [rgba(c) for c in cols]
    sz, n = 36, 6
    for f in range(n):
        t = f / (n - 1)
        yy, xx = np.mgrid[0:sz, 0:sz] + 0.5
        dx, dy = xx - sz / 2, yy - sz / 2
        r = np.hypot(dx, dy); a = np.arctan2(dy, dx)
        sweep = -2.4 + min(1, t * 2.5) * 3.2          # how far the arc has opened
        R0, th = 13, 5 * (1 - t) + 1
        inside = (a > -2.4) & (a < sweep)
        v = np.clip(1 - np.abs(r - R0) / th, 0, 1) * 3.4 * inside * (1 - t * 0.4)
        add(f'vx_slash_{name}_{f}', paint(dith(v, sz), pal))
    anim[f'vx_slash_{name}'] = n


# ------------------------------------------------------------------ UI icons (24x24 art, saved 4x like the rest)
def icon(name, bg, band, sprite, rot=45, scale=1, sparks=C['cy2']):
    im = Image.new('RGBA', (24, 24), bg)
    d = ImageDraw.Draw(im)
    for i in range(-24, 24, 6):                      # faint circuit grid
        d.line([(0, 12 + i), (24, 12 + i)], fill=band[:3] + (90,))
    d.polygon([(0, 24), (24, 0), (24, 8), (8, 24)], fill=band)
    sp = sprite.rotate(rot, expand=True, resample=Image.NEAREST) if rot else sprite
    if scale != 1:
        sp = sp.resize((sp.width * scale, sp.height * scale), Image.NEAREST)
    sp = trim(sp)
    im.alpha_composite(sp, ((24 - sp.width) // 2, (24 - sp.height) // 2))
    for x, y in ((3, 4), (19, 17), (5, 18)):
        d.point((x, y), fill=sparks); d.point((x - 1, y), fill=sparks[:3] + (120,)); d.point((x + 1, y), fill=sparks[:3] + (120,))
        d.point((x, y - 1), fill=sparks[:3] + (120,)); d.point((x, y + 1), fill=sparks[:3] + (120,))
    im.resize((96, 96), Image.NEAREST).save(os.path.join(UIDIR, name + '.png'), optimize=True)


def motif_icon(name, bgc, border, draw):
    """24x24 effect-skin icon: every skin has its own large motif (no shared picture between icons)."""
    im = Image.new('RGBA', (24, 24), rgba(bgc))
    d = ImageDraw.Draw(im)
    lay = Image.new('RGBA', (24, 24)); draw(ImageDraw.Draw(lay), lay)
    im.alpha_composite(lay)
    d.rectangle((0, 0, 23, 23), outline=rgba(border))
    im.resize((96, 96), Image.NEAREST).save(os.path.join(UIDIR, name + '.png'), optimize=True)


def m_dragon(d, im):   # a curling flame tongue with embers
    d.polygon([(12, 3), (17, 10), (18, 16), (14, 21), (8, 20), (6, 15), (9, 11), (10, 14), (12, 11)], fill=C['or0'])
    d.polygon([(12, 7), (15, 12), (15, 17), (12, 19), (9, 17), (10, 15), (12, 14)], fill=C['or1'])
    d.polygon([(12, 12), (13, 15), (12, 18), (10, 17)], fill=C['or2'])
    for x, y in ((4, 6), (19, 5), (20, 19), (3, 18)):
        d.point((x, y), fill=C['go'])


def m_lotus(d, im):    # a lightning bolt over lotus petals
    for cx in (6, 12, 18):
        d.ellipse((cx - 3, 13, cx + 3, 21), fill=rgba('#3b3aa6'))
    d.ellipse((9, 11, 15, 21), fill=rgba('#6fb6ff'))
    d.polygon([(14, 2), (8, 12), (12, 12), (9, 20), (16, 9), (12, 9)], fill=C['wh'])
    d.line([(14, 2), (8, 12)], fill=C['cy1'])


def m_sakura(d, im):   # five-petal blossom
    import math
    for k in range(5):
        a = -math.pi / 2 + k * 2 * math.pi / 5
        x, y = 12 + math.cos(a) * 6, 12 + math.sin(a) * 6
        d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=C['pk1'])
        d.ellipse((x - 2, y - 2, x + 1, y + 1), fill=C['pk2'])
    d.ellipse((9, 9, 15, 15), fill=C['pk0'])
    d.ellipse((11, 11, 13, 13), fill=C['go'])


def m_moon(d, im):     # large crescent with stars
    d.ellipse((3, 3, 20, 20), fill=C['vi2'])
    d.ellipse((8, 1, 24, 17), fill=(0, 0, 0, 0))
    d.ellipse((5, 6, 9, 10), fill=C['wh'])
    for x, y in ((18, 6), (20, 15), (14, 19)):
        d.point((x, y), fill=C['wh']); d.point((x + 1, y), fill=C['vi1'])


def m_neon(d, im):     # circuit chip
    d.rectangle((7, 7, 16, 16), fill=C['st0'])
    d.rectangle((9, 9, 14, 14), fill=C['cy1']); d.rectangle((11, 11, 12, 12), fill=C['wh'])
    for i in (8, 11, 14):
        d.line([(i, 2), (i, 6)], fill=C['cy1']); d.line([(i, 17), (i, 21)], fill=C['cy1'])
        d.line([(2, i), (6, i)], fill=C['mg1']); d.line([(17, i), (21, i)], fill=C['mg1'])
        d.point((i, 2), fill=C['wh']); d.point((21, i), fill=C['wh'])


def m_all(d, im):      # effect skins (section emblem): a paint swatch fan in five colours
    cols = [C['or1'], rgba('#6fb6ff'), C['pk1'], C['vi2'], C['cy1']]
    for k, c in enumerate(cols):
        d.polygon([(4, 20), (4 + k * 4, 4), (8 + k * 4, 4)], fill=c)
    d.ellipse((2, 18, 6, 22), fill=C['go'])


def m_neoemb(d, im):   # Neo Ninja emblem: a neon hexagon with an N
    d.polygon([(12, 2), (21, 7), (21, 17), (12, 22), (3, 17), (3, 7)], fill=C['cy0'])
    d.polygon([(12, 4), (19, 8), (19, 16), (12, 20), (5, 16), (5, 8)], fill=rgba('#13203d'))
    d.line([(8, 16), (8, 8), (16, 16), (16, 8)], fill=C['cy1'], width=2)
    d.point((12, 4), fill=C['mg1']); d.point((12, 20), fill=C['mg1'])


def main():
    add('p_Plasma_0', plasma(0)); add('p_Plasma_1', plasma(1)); anim['p_Plasma'] = 2
    add('p_Laser_0', laser()); anim['p_Laser'] = 1
    add('p_Katana_0', katana_wave(0)); add('p_Katana_1', katana_wave(1)); anim['p_Katana'] = 2
    add('p_Rail_0', rail()); anim['p_Rail'] = 1
    add('p_Drone_0', drone(0)); add('p_Drone_1', drone(1)); anim['p_Drone'] = 2
    add('wh_Katana', katana_held())
    # neon bow: the pack's bow recoloured (same silhouette, neon string and limbs)
    atlas = Image.open(os.path.join(OUT, 'atlas.png')).convert('RGBA')
    with open(os.path.join(OUT, 'atlas.js')) as f:
        A = json.loads(f.read()[len('window.ATLAS='):].rstrip().rstrip(';'))
    base = A.get('neoBase')
    if base:   # drop the previous Neo build
        atlas = atlas.crop((0, 0, atlas.width, base))
        for n in A.get('neo', []):
            A['frames'].pop(n, None)
        for n in A.get('neoAnim', []):
            A['anim'].pop(n, None)
    base = atlas.height
    x, y, w, h = A['frames']['wh_Bow']
    bow = np.array(atlas.crop((x, y, x + w, y + h)))
    lum = bow[:, :, :3].astype(int).sum(2)
    solid = bow[:, :, 3] > 0
    ink = solid & (lum < 120)
    ramp = [C['vi0'], C['vi1'], C['cy1'], C['cy2']]
    for k, (lo, hi) in enumerate(((120, 260), (260, 420), (420, 600), (600, 999))):
        m = solid & ~ink & (lum >= lo) & (lum < hi)
        bow[m] = ramp[k]
    add('wh_NeoBow', Image.fromarray(bow, 'RGBA'))
    for r in range(4):
        add(f'fxp_petal_{r}', petal(r))
    anim['fxp_petal'] = 4
    for k in range(3):
        add(f'fxp_ember_{k}', ember(k)); add(f'fxp_bolt_{k}', bolt(k))
    anim['fxp_ember'] = 3; anim['fxp_bolt'] = 3
    add('fxp_moon_0', moon()); anim['fxp_moon'] = 1
    for k in range(2):
        add(f'fxp_bit_{k}', bit(k))
    anim['fxp_bit'] = 2
    for name, cols in VCOL.items():
        palette_fx(name, cols)
    slash('moon', VCOL['moon']); slash('neon', VCOL['neon'])

    # icons
    nav, band = rgba('#24305e'), rgba('#2f3f7a')
    icon('wi_Plasma', nav, band, plasma(0), rot=0, scale=1)
    icon('wi_Laser', rgba('#3d1d4f'), rgba('#53275f'), laser(), rot=45, sparks=C['mg2'])
    icon('wi_Katana', nav, band, katana_held(), rot=-45)
    icon('wi_Rail', rgba('#1d3b4f'), rgba('#265066'), rail(), rot=45)
    icon('wi_Drone', rgba('#2b3040'), rgba('#3a4152'), drone(0), rot=0, scale=1, sparks=C['rd'])
    motif_icon('fxi_dragon', '#3a1a1a', '#ff7a2e', m_dragon); motif_icon('fxi_lotus', '#151a40', '#6fb6ff', m_lotus)
    motif_icon('fxi_sakura', '#3a1d33', '#f9a3c8', m_sakura); motif_icon('fxi_moon', '#1a1733', '#b9b4e6', m_moon)
    motif_icon('fxi_neon', '#0f1a2b', '#3fd0e8', m_neon); motif_icon('fxi_all', '#2b2333', '#ffe18d', m_all)
    motif_icon('ic_neo', '#0f1a2b', '#3fd0e8', m_neoemb)

    # pack below the existing atlas (shelf packer, 2 px gutter)
    pcs = sorted(pieces, key=lambda p: (-p[1].height, -p[1].width))
    AW, cx, cy, rowh, pad = atlas.width, 0, base + 2, 0, 2
    pos = []
    for name, im in pcs:
        if cx + im.width + pad > AW:
            cx, cy, rowh = 0, cy + rowh + pad, 0
        pos.append((name, im, cx, cy)); cx += im.width + pad; rowh = max(rowh, im.height)
    out = Image.new('RGBA', (AW, cy + rowh))
    out.alpha_composite(atlas)
    for name, im, x, y in pos:
        out.alpha_composite(im, (x, y))
        A['frames'][name] = [x, y, im.width, im.height]
    A['anim'].update(anim)
    A['neoBase'], A['neo'], A['neoAnim'] = base, [p[0] for p in pieces], list(anim)
    out.save(os.path.join(OUT, 'atlas.png'), optimize=True)
    with open(os.path.join(OUT, 'atlas.js'), 'w') as f:
        f.write('window.ATLAS=' + json.dumps(A, separators=(',', ':')) + ';\n')
    print('neo: %d frames, atlas %dx%d' % (len(pieces), out.width, out.height))


if __name__ == '__main__':
    main()
