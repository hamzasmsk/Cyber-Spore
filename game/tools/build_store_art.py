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


def icon_art(n=64, hero_k=3, sk=1):
    """n x n art: burst background, the captain facing us, a shuriken flying in at the top right."""
    im = burst_bg(n, n, n * 0.42, n * 0.6, RAMP, rays=10, spin=0.2)
    d = ImageDraw.Draw(im)
    hero = outline(spr('h_NinjaBlue_d0', hero_k))
    hx, hy = n * 0.04, n - hero.height - 2
    sh = outline(spr('p_Shuriken_0', 1).resize((24, 24), Image.NEAREST)) if sk == 1 else outline(spr('p_Shuriken_0', sk))
    sx, sy = n - sh.width - 2, 2
    for i in range(3):   # speed lines behind the shuriken
        streak(d, sx - 2, sy + 8 + i * 4, sx - 12 - i * 3, sy + 14 + i * 4, rgba('#fff4d6'))
    paste(im, Image.new('RGBA', (hero.width - 6, 3), (19, 27, 27, 110)), hx + 3, hy + hero.height - 3)
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
    fg = burst_bg(96, 96, 48, 52, RAMP, rays=10, spin=0.2)
    fg.alpha_composite(icon_art(64), (16, 16))
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


# ------------------------------------------------------------------ feature graphic (1024x500 = 256x125 art x4)
def font(px):
    from fontTools.ttLib import TTFont
    fonts = []
    for n in ('pixelify-sans-latin-700-normal.woff2', 'pixelify-sans-latin-ext-700-normal.woff2'):
        t = TTFont(os.path.join(ROOT, 'assets', 'fonts', n))
        t.flavor = None
        b = io.BytesIO(); t.save(b); b.seek(0)
        fonts.append((ImageFont.truetype(b, px), set(t.getBestCmap().keys())))
    return fonts


def text(im, s, x, y, fonts, col, shadow):
    """Hard-pixel text (no anti-aliasing), each character from the font that has it, with a 1-px drop shadow."""
    d = ImageDraw.Draw(im)
    d.fontmode = '1'
    cx = x
    for ch in s:
        f = next((fo for fo, cm in fonts if ord(ch) in cm), fonts[0][0])
        d.text((cx + 1, y + 1), ch, font=f, fill=shadow)
        d.text((cx, y), ch, font=f, fill=col)
        cx += d.textlength(ch, font=f)
    return cx


def feature(lang):
    W, H = 256, 125
    im = burst_bg(W, H, W * 0.70, H * 0.55, ['#1d1a2e', '#3a2440', '#8f3e56', '#d14b34', '#ff9554'], rays=14, spin=0.4)
    # boss on the right, squad below throwing at it, projectiles and bursts in between
    boss = outline(spr('b_TenguRed_0'))
    paste(im, boss, W - boss.width - 6, 2)
    for name, x, y in (('vx_burst_gold_3', 150, 20), ('vx_burst_neon_3', 196, 46)):
        b = spr(name)
        paste(im, b, x - b.width // 2, y - b.height // 2)
    d = ImageDraw.Draw(im)
    for (x0, y0, x1, y1, c) in ((150, 92, 178, 52, '#ffe18d'), (178, 98, 196, 60, '#3fd0e8'), (206, 96, 214, 62, '#ff4fb0')):
        streak(d, x0, y0, x1, y1, rgba(c))
    for name, x, y in (('p_Shuriken_0', 172, 58), ('p_Plasma_0', 192, 64), ('p_Laser_0', 210, 70)):
        paste(im, outline(spr(name)) if name != 'p_Laser_0' else spr(name).rotate(60, expand=True), x, y)
    for name, x, y, fl in (('h_NinjaRed_ra', 132, 88, False), ('h_NinjaBlue_ua', 160, 94, False), ('h_NinjaYellow_la', 196, 92, False), ('h_NinjaBomb_ra', 222, 98, False)):
        if name in FR:
            h = outline(spr(name, 2, fl))
            paste(im, Image.new('RGBA', (h.width - 4, 3), (19, 27, 27, 120)), x + 2, y + h.height - 3)
            paste(im, h, x, y)
    # left: dark panel with the title
    panel = Image.new('RGBA', (112, H), (19, 27, 27, 215))
    im.alpha_composite(panel, (0, 0))
    for x in range(112, 120):
        for y in range(H):
            if (x + y) % (x - 110) == 0:
                im.putpixel((x, y), (19, 27, 27, 160))
    big = font(24)
    text(im, 'SHURIKEN', 8, 22, big, rgba('#ffe18d'), rgba('#8f3e56'))
    text(im, 'SQUAD', 8, 46, big, rgba('#ffe18d'), rgba('#8f3e56'))
    out = im.resize((W * 4, H * 4), Image.NEAREST)
    lay = Image.new('RGBA', (W * 2, H * 2))
    small = font(16)
    lines = ['Ninja takımını kur,', 'sürüleri biç,', 'bossları devir!', 'İnternetsiz oyna.'] if lang == 'tr' else \
            ['Build your squad,', 'mow down hordes,', 'topple bosses!', 'Play offline.']
    for i, ln in enumerate(lines):
        text(lay, ln, 16, 152 + i * 20, small, rgba('#fce2ca') if i < 3 else rgba('#3fd0e8'), INK)
    out.alpha_composite(lay.resize((W * 4, H * 4), Image.NEAREST))
    name = 'feature-graphic-1024x500.png' if lang == 'tr' else 'feature-graphic-1024x500-en.png'
    out.save(os.path.join(ROOT, 'store', name), optimize=True)


if __name__ == '__main__':
    icons()
    feature('tr')
    feature('en')
    print('store art done')
