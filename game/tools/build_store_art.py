#!/usr/bin/env python3
"""Store art built from the game's own sprites (atlas) on the pixel grid, upscaled with hard pixels:
  store/icon-512.png                      Play Store icon (front-facing captain + spinning shuriken on a burst)
  icon.png                                web / PWA icon (same picture)
  android/.../mipmap-*/ic_launcher*.png   launcher icons (legacy, round, adaptive foreground)
  store/feature-graphic-1024x500.png      Turkish feature graphic
  store/feature-graphic-1024x500-en.png   English feature graphic
Usage: python3 game/tools/build_store_art.py
"""
import io
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
ATL = Image.open(os.path.join(ROOT, 'assets', 'atlas.png')).convert('RGBA')
with open(os.path.join(ROOT, 'assets', 'atlas.js')) as f:
    FR = json.loads(f.read()[len('window.ATLAS='):].rstrip().rstrip(';'))['frames']
INK = (19, 27, 27, 255)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def rgba(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def spr(name, k=1, flip=False):
    x, y, w, h = FR[name]
    im = ATL.crop((x, y, x + w, y + h))
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im.resize((w * k, h * k), Image.NEAREST) if k != 1 else im


def burst_bg(w, h, cx, cy, ramp, rays=12, spin=0.0):
    """Dithered radial glow with soft starburst rays (the game's VFX look)."""
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    dx, dy = xx - cx, yy - cy
    r = np.hypot(dx, dy) / max(w, h)
    a = np.arctan2(dy, dx) + spin
    ray = (np.cos(a * rays) > 0.55) * 0.55
    lvl = np.clip((1 - r * 1.55) * (len(ramp) - 1) + ray * (1 - r), 0, len(ramp) - 1)
    by = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
    idx = np.floor(lvl + by - 0.5).clip(0, len(ramp) - 1).astype(int)
    out = np.zeros((h, w, 4), np.uint8)
    for i, c in enumerate(ramp):
        out[idx == i] = rgba(c)
    return Image.fromarray(out, 'RGBA')


def outline(im, col=INK):
    a = np.array(im)
    m = a[:, :, 3] > 0
    p = np.pad(m, 1)
    ring = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~m
    a[ring] = col
    return Image.fromarray(a, 'RGBA')


def paste(dst, im, x, y):
    dst.alpha_composite(im, (int(x), int(y)))


def streak(d, x0, y0, x1, y1, col):
    n = int(max(abs(x1 - x0), abs(y1 - y0)))
    for i in range(n):
        if i % 2 == 0:
            d.point((round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)), fill=col)


RAMP = ['#5a2440', '#8f3e56', '#d14b34', '#ff9554', '#ffe18d']


def icon_bg(n):
    """Crisp sunburst: alternating ray tones over hard radial bands (no noise), warm centre, deep edge."""
    yy, xx = np.mgrid[0:n, 0:n] + 0.5
    cx, cy = n * 0.44, n * 0.58
    r = np.hypot(xx - cx, yy - cy) / n
    a = np.arctan2(yy - cy, xx - cx)
    band = np.clip((r / 0.17).astype(int), 0, 4)
    ray = (np.floor((a + np.pi) / (2 * np.pi) * 18) % 2).astype(int)
    lit = [['#ffe18d', '#ffd36b'], ['#ff9554', '#f2843f'], ['#e0603c', '#d14b34'], ['#b8434a', '#a83c46'], ['#8f3e56', '#7d344d']]
    out = np.zeros((n, n, 4), np.uint8)
    for b in range(5):
        for k in range(2):
            out[(band == b) & (ray == k)] = rgba(lit[b][k])
    return Image.fromarray(out, 'RGBA')


def rim(im, col):
    """1-px light rim around an already outlined sprite (makes it pop off the background)."""
    return outline(im, col)


def icon_art(n=64, hero_k=3, bg=True):
    im = icon_bg(n) if bg else Image.new('RGBA', (n, n))
    d = ImageDraw.Draw(im)
    hero = rim(outline(spr('h_NinjaBlue_d0', hero_k)), rgba('#fff4d6'))
    hx, hy = n * 0.05, n - hero.height - 1
    sh = rim(outline(spr('p_Shuriken_0', 1).resize((22, 22), Image.NEAREST)), rgba('#fff4d6'))
    sx, sy = n - sh.width - 3, 3
    for i in range(3):   # speed lines behind the shuriken
        streak(d, sx - 2, sy + 7 + i * 4, sx - 13 - i * 3, sy + 13 + i * 4, rgba('#fff4d6'))
    lay = Image.new('RGBA', im.size)
    ImageDraw.Draw(lay).ellipse((hx + 4, n - 6, hx + hero.width - 4, n + 2), fill=(90, 36, 64, 150))
    im.alpha_composite(lay)
    paste(im, hero, hx, hy)
    paste(im, sh, sx, sy)
    return im


def save_up(im, k, path):
    im.resize((im.width * k, im.height * k), Image.NEAREST).save(path, optimize=True)


def icons():
    art = icon_art(64)
    save_up(art, 8, os.path.join(ROOT, 'store', 'icon-512.png'))
    save_up(art, 8, os.path.join(ROOT, 'icon.png'))
    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(res):
        return
    # adaptive foreground: 108 dp, the subject inside the 72 dp safe zone -> 96-grid canvas with a 64-grid icon in the middle
    fg = icon_bg(96)
    fg.alpha_composite(icon_art(64, bg=False), (16, 16))   # same picture, background drawn once over the whole layer
    big = fg.resize((96 * 9, 96 * 9), Image.NEAREST)
    for dpi, (legacy, fsize) in {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216), 'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}.items():
        d = os.path.join(res, 'mipmap-' + dpi)
        big.resize((fsize, fsize), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_foreground.png'), optimize=True)
        lg = art.resize((legacy, legacy), Image.LANCZOS if legacy % 64 else Image.NEAREST)
        lg.save(os.path.join(d, 'ic_launcher.png'), optimize=True)
        mask = Image.new('L', (legacy, legacy), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, legacy - 1, legacy - 1), fill=255)
        rnd = Image.new('RGBA', (legacy, legacy))
        rnd.paste(lg, (0, 0), mask)
        rnd.save(os.path.join(d, 'ic_launcher_round.png'), optimize=True)
    with open(os.path.join(res, 'values', 'ic_launcher_background.xml'), 'w') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#5A2440</color>\n</resources>\n')


# ------------------------------------------------------------------ feature graphic: a real scene from the game
# Built on a 171x84 art grid with the game's own tiles, trees, monsters and effects, shown at 6x (1024x500 crop).
def font(px):
    from fontTools.ttLib import TTFont
    fonts = []
    for n in ('pixelify-sans-latin-700-normal.woff2', 'pixelify-sans-latin-ext-700-normal.woff2'):
        t = TTFont(os.path.join(ROOT, 'assets', 'fonts', n))
        t.flavor = None
        b = io.BytesIO(); t.save(b); b.seek(0)
        fonts.append((ImageFont.truetype(b, px), set(t.getBestCmap().keys())))
    return fonts


def text(im, s, x, y, fonts, col, shadow, depth=1):
    """Hard-pixel text (no anti-aliasing), each character from the font that has it, with a stepped drop shadow."""
    d = ImageDraw.Draw(im)
    d.fontmode = '1'
    cx = x
    for ch in s:
        f = next((fo for fo, cm in fonts if ord(ch) in cm), fonts[0][0])
        for k in range(depth, 0, -1):
            d.text((cx + k, y + k), ch, font=f, fill=shadow)
        d.text((cx, y), ch, font=f, fill=col)
        cx += d.textlength(ch, font=f)
    return cx


def text_outline(im, s, x, y, fonts, col, edge):
    """Text with a 1-px ink outline all round (reads on any background)."""
    lay = Image.new('RGBA', im.size)
    text(lay, s, x, y, fonts, col, col, 0)
    im.alpha_composite(outline(lay, edge))


def scene(W, H, seed=3):
    """256x125 art: grass field, a dirt path going up, the boss at the top, the squad big in the foreground."""
    rnd = np.random.default_rng(seed)
    im = Image.new('RGBA', (W, H))
    path_x = 150
    for ty in range(-1, H // 16 + 2):
        for tx in range(-1, W // 16 + 2):
            x, y = tx * 16 + (path_x % 16), ty * 16 - 3
            if path_x <= x < path_x + 48:
                n = ['t_grass_pl', 't_grass_pc', 't_grass_pr'][(x - path_x) // 16]
                if n == 't_grass_pc' and rnd.random() < 0.3:
                    n = 't_grass_pc2' if rnd.random() < 0.5 else 't_grass_pc3'
            else:
                n = 't_grass_fill' if rnd.random() < 0.6 else 't_grass_d%d' % rnd.integers(1, 5)
            paste(im, spr(n), x, y)

    def shadow(x, y, w):
        lay = Image.new('RGBA', im.size)
        ImageDraw.Draw(lay).ellipse((x - w // 2, y - max(1, w // 6), x + w // 2, y + max(1, w // 6)), fill=(19, 27, 27, 80))
        im.alpha_composite(lay)

    def put(name, x, y, k=1, sh=True, flip=False):   # (x, y) = feet
        sp = spr(name, k, flip)
        if sh:
            shadow(x, y - 1, sp.width - 4 * k)
        paste(im, sp, x - sp.width // 2, y - sp.height)
    # scenery framing both sides of the path
    for name, x, y in (('d_tree_round', 238, 40), ('d_tree_light', 252, 92), ('d_tree_round', 222, 128), ('d_tree_light2', 132, 44),
                       ('d_tree_round', 112, 100), ('d_tree_dark', 96, 30), ('d_tree_round', 70, 70), ('d_tree_light', 40, 30), ('d_tree_dark', 20, 110)):
        put(name, x, y)
    for name, x, y in (('d_bush1', 212, 70), ('d_bush4', 140, 74), ('d_flower_sun', 214, 104), ('d_flower_red', 138, 112),
                       ('d_bush7', 224, 16), ('d_flower_white', 206, 30), ('d_bush3', 128, 18)):
        put(name, x, y, sh=False)
    # boss at the top of the path
    put('b_TenguBlue_0', 174, 62)
    # a few monsters between the boss and the squad
    for name, x, y, fl in (('m_Slime3_d0', 160, 78, False), ('m_Mushroom_d1', 190, 76, False), ('m_Slime3_d2', 176, 86, False)):
        put(name, x, y, flip=fl)
    # throws: dotted trails from the squad to the boss, one clean impact on its shoulder
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1, c in ((150, 100, 162, 50, '#ffe18d'), (198, 100, 186, 48, '#3fd0e8')):
        streak(d, x0, y0, x1, y1, rgba(c))
    paste(im, outline(spr('p_Shuriken_0')), 156, 44)
    paste(im, outline(spr('p_Plasma_0')), 182, 40)
    burst = spr('vx_burst_gold_2')
    a = np.array(burst).astype(float); a[:, :, 3] *= 0.9
    burst = Image.fromarray(a.astype(np.uint8), 'RGBA').resize((32, 32), Image.NEAREST)
    paste(im, burst, 186 - 16, 30 - 16)
    for i, (x, y) in enumerate(((206, 58), (211, 52), (215, 60))):
        paste(im, spr('coin_%d' % (i % 4)), x, y)
    # the squad, twice as big in the foreground: the captain faces us, the two others throw from the sides
    for name, x, y in (('h_NinjaRed_ra', 140, 120), ('h_NinjaYellow_la', 208, 120), ('h_NinjaBlue_d0', 174, 124)):
        put(name, x, y, k=2)
    return im


def grade(im, left):
    """Warm evening light, vignette, and a dithered dark fade under the title on the left."""
    W, H = im.size
    a = np.array(im).astype(float)
    yy, xx = np.mgrid[0:H, 0:W] + 0.5
    warm = np.array([255, 170, 110]) / 255.0
    a[:, :, :3] = a[:, :, :3] * (0.82 + 0.18 * warm)
    v = np.clip(np.hypot((xx - W * 0.7) / W, (yy - H * 0.5) / H) * 1.25, 0, 1) ** 2
    a[:, :, :3] *= (1 - 0.55 * v)[:, :, None]
    by = np.tile(BAYER, (H // 4 + 1, W // 4 + 1))[:H, :W]
    fade = np.clip((left - xx) / 40.0 + 0.3, 0, 1)
    step = (np.floor(fade * 4 + by) / 4).clip(0, 1) * 0.82
    ink = np.array([19, 27, 27])
    a[:, :, :3] = a[:, :, :3] * (1 - step[:, :, None]) + ink * step[:, :, None]
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')


def feature(lang):
    W, H, K = 256, 125, 4
    im = grade(scene(W, H), 112)
    big = font(24)
    text(im, 'SHURIKEN', 10, 22, big, rgba('#ffe18d'), rgba('#8f3e56'), 2)
    text(im, 'SQUAD', 10, 48, big, rgba('#ffe18d'), rgba('#8f3e56'), 2)
    d = ImageDraw.Draw(im)
    for x in range(11, 100, 2):                       # a small dotted rule under the title
        d.point((x, 78), fill=rgba('#d14b34'))
    out = im.resize((W * K, H * K), Image.NEAREST)
    lay = Image.new('RGBA', (W * 2, H * 2))           # tagline on a 2x grid so the letters stay crisp
    small = font(16)
    lines = ['Ninja takımını kur,', 'bossları devir!'] if lang == 'tr' else ['Build your ninja squad.', 'Topple giant bosses!']
    for i, ln in enumerate(lines):
        text(lay, ln, 22, 170 + i * 22, small, rgba('#fce2ca'), INK)
    out.alpha_composite(lay.resize((W * K, H * K), Image.NEAREST))
    name = 'feature-graphic-1024x500.png' if lang == 'tr' else 'feature-graphic-1024x500-en.png'
    out.save(os.path.join(ROOT, 'store', name), optimize=True)


if __name__ == '__main__':
    icons()
    feature('tr')
    feature('en')
    print('store art done')
