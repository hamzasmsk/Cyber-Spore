#!/usr/bin/env python3
"""One icon per meaning. Builds the extra interface icons so no picture stands for two different things
(tools/tests/icons.js checks it). Sources, all in the game's single art style:
  - unused icon tiles of the "Ninja Adventure" pack (CC0), copied under a new name
  - item sprites of the same pack placed on a pack-style icon tile
  - small glyphs drawn here on the pixel grid (ticket, clock, hourglass, bell, ...)
Usage:  python3 game/tools/build_icons.py ["<path to 'Ninja Adventure - Asset Pack'>"]
build_assets.py calls it at the end, so a full rebuild keeps these icons.
"""
import os
import sys

import numpy as np
from PIL import Image

NA = sys.argv[1] if len(sys.argv) > 1 else '/home/user/na/src/Assets/Art/Ninja Adventure - Asset Pack'
HERE = os.path.dirname(os.path.abspath(__file__))
UIDIR = os.path.normpath(os.path.join(HERE, '..', 'assets', 'ui'))
INK = (19, 27, 27, 255)


def rgba(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def save(name, im):
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(UIDIR, name + '.png'), optimize=True)


def tile(col):
    """Pack icon tile: 22x21 coloured plate, darker bottom row, cut corners."""
    c = rgba(col)
    dark = tuple(max(0, int(v * 0.62)) for v in c[:3]) + (255,)
    T = np.zeros((24, 24, 4), np.uint8)
    T[1:22, 1:23] = c
    T[21, 1:23] = dark
    for (y, x) in [(1, 1), (1, 22), (21, 1), (21, 22)]:
        T[y, x] = (0, 0, 0, 0)
    T[3, 4] = T[18, 19] = tuple(min(255, int(v * 1.35)) for v in c[:3]) + (255,)
    return Image.fromarray(T, 'RGBA')


def outline(im):
    a = np.array(im)
    m = a[:, :, 3] > 0
    p = np.pad(m, 1)
    ring = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~m
    a[ring] = INK
    return Image.fromarray(a, 'RGBA')


def on_tile(col, sprite, rot=0, dy=0):
    t = tile(col)
    sp = sprite.rotate(rot, expand=True, resample=Image.NEAREST) if rot else sprite
    sp = sp.crop(sp.getbbox())
    if max(sp.width, sp.height) <= 9:   # tiny items (coins) are shown at 2x so they read as icons
        sp = sp.resize((sp.width * 2, sp.height * 2), Image.NEAREST)
    if sp.width > 18 or sp.height > 18:
        k = 18 / max(sp.width, sp.height)
        sp = sp.resize((max(1, int(sp.width * k)), max(1, int(sp.height * k))), Image.NEAREST)
    big = Image.new('RGBA', (24, 24))
    big.alpha_composite(sp, ((24 - sp.width) // 2, (22 - sp.height) // 2 + dy))
    t.alpha_composite(outline(big))
    return t


def glyph(rows, cmap):
    im = Image.new('RGBA', (max(len(r) for r in rows), len(rows)))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in cmap:
                im.putpixel((x, y), rgba(cmap[ch]) if isinstance(cmap[ch], str) else cmap[ch])
    return im


def A(*p):
    return os.path.join(NA, *p)


W, Y, R, B, G, P, K, O = '#f2eaf1', '#ffe18d', '#e0394c', '#79b8ce', '#adbc3a', '#d3a2c0', '#46402e', '#ff9554'
GLYPHS = {
    'ic_ticket': ('#a5608b', ['..oooooooooo..', '.oyyyyyyyyyyo.', 'oyyoyyyyyyoyyo', 'oyyyyrrrryyyyo', '.oyyyrwwryyyo.', '.oyyyrrrryyyo.',
                              'oyyyyyyyyyyyyo', 'oyyoyyyyyyoyyo', '.oyyyyyyyyyyo.', '..oooooooooo..'], {'o': INK, 'y': Y, 'r': R, 'w': W}),
    'ic_clock': ('#548789', ['....oooooo....', '..oowwwwwwoo..', '.owwwwkwwwwwo.', '.owwwwkwwwwwo.', 'owwwwwkwwwwwwo', 'owwwwwkkkkwwwo',
                             'owwwwwwwwwwwwo', 'owwwwwwwwwwwwo', '.owwwwwwwwwwo.', '.owwwwwwwwwwo.', '..oowwwwwwoo..', '....oooooo....'], {'o': INK, 'w': W, 'k': K}),
    'ic_time': ('#8f3e56', ['oooooooooo', 'oyyyyyyyyo', '.owwwwwwo.', '..owyywo..', '...oyyo...', '...owwo...', '..owwwwo..', '.owwyywwo.',
                            'owyyyyyywo', 'oyyyyyyyyo', 'oooooooooo'], {'o': INK, 'y': Y, 'w': W}),
    'ic_timeup': ('#56864c', ['oooooooooo....', 'oyyyyyyyyo....', '.owwwwwwo.....', '..owyywo...oo.', '...oyyo...oggo', '...owwo..ooggoo', '..owwwwo.ogggggo',
                              '.owwyywwooooggoo', 'owyyyyyywo.oggo.', 'oyyyyyyyyo..oo..', 'oooooooooo......'], {'o': INK, 'y': Y, 'w': W, 'g': G}),
    'ic_chart': ('#2d4f8c', ['..........oo', '..........oo', '......oo.owo', '......owoowo', '..oo..owoowo', '..owo.owoowo', '..owoowoowoo', 'oo.owoowoowo',
                             'owooowoowoowo', 'owoowoowoowo', 'oooooooooooo'], {'o': INK, 'w': Y}),
    'ic_psave': ('#1d2340', ['.....oooo.....', '...ooyyyyo....', '..oyyyyoo.....', '.oyyyyo.......', '.oyyyo...oooo.', 'oyyyyo...owwo.', 'oyyyyo....owo.', 'oyyyyo...owoo.',
                             'oyyyyyo..oooo.', '.oyyyyyo......', '.oyyyyyyoooo..', '..ooyyyyyyyo..', '....ooooooo...'], {'o': INK, 'y': Y, 'w': W}),
    'ic_save': ('#3a6a8c', ['oooooooooooo.', 'owwkkkkkkwwoo', 'owwkkkkkkwwwo', 'owwkkkkwkwwwo', 'owwkkkkkkwwwo', 'owwwwwwwwwwwo', 'owbbbbbbbbbwo', 'owbyyyyyyybwo',
                            'owbbbbbbbbbwo', 'owbyyyyyyybwo', 'owbbbbbbbbbwo', 'ooooooooooooo'], {'o': INK, 'w': '#6f7d99', 'k': '#262b3a', 'b': W, 'y': '#a6b4cc'}),
    'ic_rank': ('#5a3d7a', ['.....oooo.....', '....oyyyyo....', '....oywyyo....', '....oyyyyo....', '.....oooo.....', '....oooooo....', '....owwkwo....', '....owkkwo....',
                            'ooooowwkwo....', 'osssowwkwooooo', 'osssowwkwoccco', 'osssowwwwoccco', 'oooooooooooooo'], {'o': INK, 'y': Y, 'w': '#ffd75e', 'k': '#b07a1d', 's': '#c9d3e0', 'c': '#e09a5a'}),
    'ic_bell': ('#3a6a8c', ['.....oo.....', '....oyyo....', '...oyyyyo...', '..oyyyyyyo..', '..oyyyyyyo..', '..oyywyyyo..', '.oyywyyyyyo.',
                            '.oyyyyyyyyo.', 'oyyyyyyyyyyo', 'oooooooooooo', '....oyyo....', '.....oo.....'], {'o': INK, 'y': Y, 'w': W}),
    'ic_goal': ('#56864c', ['oo..........', 'orroooo.....', 'orrrrrroooo.', 'orrrrrrrrrro', 'orwrrrrrrro.', 'orrrrrroo...', 'orroooo.....', 'oo..........',
                            'oo..........', 'oo..........', 'oo..........', 'oo..........'], {'o': INK, 'r': R, 'w': W}),
    'ic_star': ('#2d4f8c', ['.....oo.....', '....oyyo....', '....oyyo....', 'oooooyyooooo', 'oyyyyyyyyyyo', '.oyyywyyyyo.', '..oyyyyyyo..',
                            '..oyyyyyyo..', '.oyyyooyyyo.', '.oyyo..oyyo.', 'oyoo....ooyo', 'oo........oo'], {'o': INK, 'y': Y, 'w': W}),
    'ic_angry': ('#8f3e56', ['.oo....oo.', 'orro..orro', 'orrro.orro', '.orrrorro.', '..orrrro..', '..orrrro..', '.orrorrro.', 'orro.orrro', 'orro..orro', '.oo....oo.'],
                 {'o': INK, 'r': R}),
    'ic_agile': ('#2d6f6a', ['......oooooo', '.....owwwwwo', 'oooooooooowo', 'owwwwwwwwwo.', 'oooooooooo..', '....ooooooo.', '...owwwwwwwo', '...ooooooooo',
                             '.oooooooo...', 'owwwwwwwo...', 'oooooooo....'], {'o': INK, 'w': W}),
    'ic_paw': ('#7d5a43', ['.oo...oo..', 'owwo.owwo.', 'owwo.owwo.', '.oo...oo..', 'oo.....oo.', 'wwo.oo.oww', 'oo.owwo.oo', '..owwwwo..', '.owwwwwwo.', '.owwwwwwo.', '..oooooo..'],
               {'o': INK, 'w': W}),
    'ic_wave': ('#3a6a8c', ['....oooooo....', '..oowwwwwwoo..', '.owwoooooowwo.', 'owwo......owwo', 'owo..oooo..owo', 'owo.owwwwo.owo', 'owo.owwwwo.owo',
                            'owo..oooo..owo', 'owwo......owwo', '.owwoooooowwo.', '..oowwwwwwoo..', '....oooooo....'], {'o': INK, 'w': B}),
    'ic_week': ('#56864c', ['oooooooooooo', 'orrrrrrrrrro', 'oooooooooooo', 'owwwwwwwwwwo', 'owkwkwkwkwwo', 'owwwwwwwwwwo', 'owkwkwkwkwwo', 'owwwwwwwwwwo',
                            'owkwkwyywwwo', 'owwwwwyywwwo', 'oooooooooooo'], {'o': INK, 'r': R, 'w': W, 'k': K, 'y': Y}),
    'ic_volume': ('#548789', ['.....oo.......', '....owo...o...', '...owwo....o..', 'oooowwo..o..o.', 'owwwwwo...o.o.', 'owwwwwo...o.o.', 'oooowwo..o..o.',
                              '...owwo....o..', '....owo...o...', '.....oo.......'], {'o': INK, 'w': W}),
    'ic_music': ('#a5608b', ['....oooooooo', '....owwwwwwo', '....oooooooo', '....ow....ow', '....ow....ow', '....ow....ow', '.ooow...ooow', 'owwww..owwww',
                             'owwwo..owwwo', '.ooo....ooo.'], {'o': INK, 'w': W}),
    'ic_noads': ('#8f3e56', ['....oooooo....', '..oowwwwwwoo..', '.owwrrwwwwwwo.', '.owwrrrwkwwwo.', 'owwwwrrrkkwwwo', 'owwwkkrrrkkwwo', 'owwwkkkrrrkwwo',
                             'owwwkkwwrrrwwo', '.owwkwwwwrrwo.', '.owwwwwwwwrro.', '..oowwwwwwoo..', '....oooooo....'], {'o': INK, 'w': W, 'r': R, 'k': K}),
    'ic_upq': ('#56864c', ['....oo....', '...oggo...', '..oggggo..', '.oggggggo.', 'ooooggoooo', '...oggo...', '...oggo...', '...oggo...', '...oggo...', '...oooo...'],
               {'o': INK, 'g': G}),
}
COPY = {   # new name: pack icon tile
    'ic_speed': 'Items&Weapon/Boot', 'ic_vibrate': 'Job&Action/Interact', 'ic_eco': 'Job&Action/Plant', 'ic_spike': 'Spell/RockSpike',
    'ic_rapid': 'Spell/WaterCanon', 'ic_crit': 'Spell/OrbDarkness', 'ic_punch': 'Job&Action/Punch', 'ic_guard': 'Items&Weapon/Guard',
    'ic_frost': 'Meteo/Snow', 'ic_flame': 'Spell/OrbFire', 'ic_chain': 'Spell/BookThunder', 'ic_fatal': 'Spell/BookDeath', 'ic_sleep': 'Spell/Mist',
    'ic_armor': 'Items&Weapon/Armor', 'ic_shadow': 'Spell/BookDarkness', 'ic_explore': 'Items&Weapon/Hook', 'ic_summon': 'Spell/Necromancy',
    'ic_reborn': 'Spell/OrbPlant', 'ic_towerach': 'Spell/BookRock', 'ic_weaponm': 'Spell/BookFire', 'ic_squad': 'Job&Action/Talk',
    'ic_rain': 'Meteo/Rain', 'ic_helmet': 'Items&Weapon/Helmet', 'ic_reap': 'Job&Action/Harvest', 'ic_soul': 'Spell/BookPlant', 'ic_wind': 'Spell/BookWind',
}
ITEMS = {   # new name: (tile colour, item sprite, rotation)
    'ic_goldsoul': ('#a5608b', 'Items/Treasure/GoldCoin.png', 0), 'ic_goldrain': ('#56864c', 'Items/Treasure/Coin2.png', 0),
    'ic_lifesteal': ('#8f3e56', 'Items/Potion/LifePot.png', 0), 'ic_pierce': ('#548789', 'Items/Weapons/Lance/Sprite.png', -45),
    'ic_blade': ('#8f3e56', 'Items/Weapons/Katana/Sprite.png', -45), 'ic_treasure': ('#7d5a43', 'Items/Treasure/LittleTreasureChest.png', 0),
    'ic_bosshunt': ('#3a3a5c', 'Items/Weapons/BigSword/Sprite.png', -45), 'ic_elite': ('#2d4f8c', 'Items/Treasure/SilverCup.png', 0),
    'ic_key': ('#a5608b', 'Items/Treasure/GoldKey.png', 0), 'ic_cards': ('#3a3a5c', 'Items/Scroll/ScrollThunder.png', 0),
    'ic_letter': ('#56864c', 'Items/Other/Letter2.png', 0), 'ic_trial': ('#548789', 'Items/Scroll/ScrollEmpty.png', 0),
    'ic_scroll': ('#7d5a43', 'Items/Scroll/ScrollFire.png', 0), 'ic_giant': ('#8f3e56', 'Items/Weapons/Club/Sprite.png', -45),
    'ic_stamp': ('#2d6f6a', 'Items/Other/Stamp.png', 0), 'ic_axe': ('#8f3e56', 'Items/Weapons/Axe/Sprite.png', -45),
    'ic_ninjaku': ('#2d6f6a', 'Items/Weapons/Ninjaku/Sprite.png', -45), 'ic_fork': ('#3a6a8c', 'Items/Weapons/Fork/Sprite.png', -45),
}


def main():
    for name, (col, rows, cmap) in GLYPHS.items():
        save(name, on_tile(col, glyph(rows, cmap)))
    for name, src in COPY.items():
        save(name, Image.open(A('Ui', 'Icon', src + '.png')).convert('RGBA'))
    for name, (col, src, rot) in ITEMS.items():
        sp = Image.open(A(src)).convert('RGBA')
        if 'Coin2' in src and sp.width >= sp.height * 2:   # animation strip: first frame
            sp = sp.crop((0, 0, sp.height, sp.height))
        if 'LittleTreasureChest' in src:
            sp = sp.crop((0, 0, 16, 16))
        save(name, on_tile(col, sp, rot))
    # charms: the pack amulet in the three slot colours
    am = np.array(Image.open(A('Ui', 'Icon', 'Items&Weapon', 'Amulet.png')).convert('RGBA'))
    bgc = tuple(am[12, 2, :3])
    for k, col in (('atk', '#c0394c'), ('gold', '#c9a23a'), ('guard', '#3f74b8')):
        a = am.copy()
        m = (np.abs(a[:, :, :3].astype(int) - np.array(bgc)).sum(2) < 40) & (a[:, :, 3] > 0)
        c = np.array(rgba(col)[:3])
        a[m, :3] = c
        a[(np.abs(am[:, :, :3].astype(int) - (np.array(bgc) * 0.62).astype(int)).sum(2) < 40) & (am[:, :, 3] > 0), :3] = (c * 0.62).astype(int)
        save('ic_charm_' + k, Image.fromarray(a, 'RGBA'))
    print('icons: %d' % (len(GLYPHS) + len(COPY) + len(ITEMS) + 3))


if __name__ == '__main__':
    main()
