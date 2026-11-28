"""Hand-tuned projectile sprites, rendered from vector shapes (used by build_neo.py).

Each projectile is a list of shapes in a local frame where +x is the flight direction (units = art pixels).
For every direction (16 for flying blades/bolts) or spin step, the shapes are rotated as vectors, rasterised at
8x, lit by one fixed light from the top-left (so a spinning shuriken's glint stays on the lit side), then
downsampled and snapped to a short colour ramp per material, with a 1-px outline. The result is clean pixel art
at every angle instead of a small sprite rotated at run time.

Frames: ppd_<Name>_<dir>_<frame> (dir 0..15, 0 = pointing right, clockwise in screen space) and
        pps_<Name>_<frame> (spinning, no direction). anim['ppd_<Name>'] / anim['pps_<Name>'] = frame count.
"""
import math

import numpy as np
from PIL import Image, ImageDraw

SS = 8
LIGHT = np.array([-0.62, -0.78])           # direction TO the light (screen y down): top-left
INK = (19, 27, 27, 255)


def hx(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


RAMPS = {   # dark -> light
    'steel':  ['#262b3a', '#454f68', '#6f7d99', '#a6b4cc', '#e9f1ff'],
    'dsteel': ['#1c1f2b', '#323a4f', '#535f7a', '#8592ad', '#cfd9ec'],
    'cloth':  ['#4a1c34', '#7d2f48', '#b23a4c', '#e2606a'],
    'wood':   ['#3e2616', '#6b4024', '#9a6436', '#c98e52'],
    'fred':   ['#6b1f2a', '#b8343c', '#e8606a', '#ffb3b3'],
    'fwhite': ['#7d8aa3', '#c9d3e3', '#f2f6ff', '#ffffff'],
    'violet': ['#1e1030', '#3a2066', '#6a3fb0', '#a47ae8', '#efe2ff'],
    'magic':  ['#4a1c5e', '#8f3e8a', '#d36fb8', '#ffb6e6', '#ffffff'],
    'ice':    ['#163c5c', '#2f7aa0', '#6cc6e2', '#bdf2ff', '#ffffff'],
    'fire':   ['#5c1a1a', '#a8302a', '#e05a2c', '#ff9a3c', '#ffd56a', '#fff4cc'],
    'spirit': ['#1a2460', '#3550b8', '#5aa2ff', '#a6e4ff', '#ffffff'],
    'cyan':   ['#0d3552', '#1a6a96', '#33c4e0', '#a2f4ff', '#ffffff'],
    'pink':   ['#40102e', '#771c58', '#d03294', '#ff7cc4', '#ffffff'],
    'gold':   ['#5c3a12', '#9c6a24', '#d9a03c', '#ffd77a', '#fff6d6'],
    'red':    ['#5c1010', '#b0202a', '#ff3b45', '#ffb0b0'],
}
GLOW = {'violet', 'magic', 'ice', 'fire', 'spirit', 'cyan', 'pink'}   # soft outline (darkest ramp tone)


def rot(p, a):
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c)


# ---------------------------------------------------------------- shading models
def shade_facet(lx, ly, spec, a):
    """Two-facet blade with a central ridge along local x: the facet facing the light is bright,
    with a highlight line near the ridge; the other facet is dark."""
    side = np.sign(ly + 1e-6)
    n = np.stack([-math.sin(a) * side, math.cos(a) * side], -1)      # facet normal (world)
    lit = n @ LIGHT
    v = 0.48 + 0.34 * lit
    ridge = np.clip(1 - np.abs(ly) / 0.9, 0, 1)
    v = v + ridge * 0.18 * (lit > 0)
    edge = np.clip((np.abs(ly) - spec['hw'] * 0.6) / (spec['hw'] * 0.4 + 1e-6), 0, 1)
    v = v - edge * 0.12 * (lit < 0)
    return np.clip(v, 0, 1)


def shade_round(lx, ly, spec, a):
    """Rounded body (rod, ring, orb): cylinder/sphere lighting with a specular dot toward the light."""
    cx, cy, r = spec.get('c', (0, 0)) + (spec.get('r', 1),)
    dx, dy = (lx - cx) / r, (ly - cy) / r
    wx, wy = rot((1, 0), a)
    # world-space offset from the centre
    ox = dx * wx - dy * wy
    oy = dx * wy + dy * wx
    d2 = np.clip(ox * ox + oy * oy, 0, 1)
    nz = np.sqrt(1 - d2)
    v = 0.35 + 0.45 * (ox * LIGHT[0] + oy * LIGHT[1]) + 0.25 * nz
    return np.clip(v, 0, 1)


def shade_glow(lx, ly, spec, a):
    """Energy: hot white core fading to the edge, pushed toward the front of the shot."""
    cx, cy = spec.get('c', (0, 0))
    rx, ry = spec.get('rad', (4, 4))
    d = np.sqrt(((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2)
    return np.clip(1.08 - d, 0, 1)


def shade_arc(lx, ly, spec, a):
    """Energy crescent: brightest along its middle line, hot leading edge, soft trailing edge."""
    cx, cy = spec['c']; R, th = spec['R'], spec['th']
    r = np.sqrt((lx - cx) ** 2 + (ly - cy) ** 2)
    d = (r - R) / th                      # -1 inner (trailing) .. +1 outer (leading)
    v = 1.0 - np.abs(d) * 0.55 + np.clip(d, 0, 1) * 0.25
    tip = np.clip(np.abs(ly) / spec.get('span', 11.0), 0, 1)
    return np.clip(v - tip ** 2 * 0.45, 0, 1)


def shade_flat(lx, ly, spec, a):
    return np.full(lx.shape, spec.get('v', 0.5))


SHADE = {'facet': shade_facet, 'round': shade_round, 'glow': shade_glow, 'flat': shade_flat, 'arc': shade_arc}


# ---------------------------------------------------------------- raster
def render(shapes, size, a, t=0.0, outline=True):
    """shapes: dicts with 'poly' (list of points) or 'circle' ((cx, cy), r) or 'ring' ((cx, cy), r_out, r_in),
    'mat' (ramp name), 'shade' (model) and model parameters. a = rotation (radians), t = animation phase 0..1."""
    H = W = size * SS
    val = np.zeros((H, W)); mat = np.full((H, W), -1, int)
    names = []
    ys, xs = np.mgrid[0:H, 0:W]
    # pixel centres -> local frame
    wx = (xs + 0.5) / SS - size / 2
    wy = (ys + 0.5) / SS - size / 2
    c, s = math.cos(-a), math.sin(-a)
    lx = wx * c - wy * s
    ly = wx * s + wy * c
    for sh in shapes:
        if callable(sh):
            sh = sh(t)
        m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
        to = lambda p: ((rot(p, a)[0] + size / 2) * SS, (rot(p, a)[1] + size / 2) * SS)
        if 'poly' in sh:
            d.polygon([to(p) for p in sh['poly']], fill=255)
        elif 'circle' in sh:
            (cx, cy), r = sh['circle']
            X, Y = to((cx, cy)); d.ellipse((X - r * SS, Y - r * SS, X + r * SS, Y + r * SS), fill=255)
        elif 'ring' in sh:
            (cx, cy), ro, ri = sh['ring']
            X, Y = to((cx, cy)); d.ellipse((X - ro * SS, Y - ro * SS, X + ro * SS, Y + ro * SS), fill=255)
            d.ellipse((X - ri * SS, Y - ri * SS, X + ri * SS, Y + ri * SS), fill=0)
        elif 'ellipse' in sh:
            (cx, cy), (rx, ry) = sh['ellipse']
            pts = [(cx + rx * math.cos(k / 24 * math.tau), cy + ry * math.sin(k / 24 * math.tau)) for k in range(24)]
            d.polygon([to(p) for p in pts], fill=255)
        mk = np.array(m) > 127
        if sh.get('cut'):
            mat[mk] = -1; val[mk] = 0; continue
        v = SHADE[sh.get('shade', 'flat')](lx, ly, sh, a) + sh.get('bias', 0)
        if sh.get('noise'):
            v = v + sh['noise'] * np.sin(lx * 1.7 + t * math.tau) * np.cos(ly * 2.3 - t * math.tau * 2)
        if sh['mat'] not in names:
            names.append(sh['mat'])
        mat[mk] = names.index(sh['mat']); val[mk] = np.clip(v, 0, 1)[mk]
    # downsample: coverage -> on/off, majority material, mean value of that material
    out = np.zeros((size, size, 4), np.uint8)
    M = mat.reshape(size, SS, size, SS).transpose(0, 2, 1, 3).reshape(size, size, SS * SS)
    V = val.reshape(size, SS, size, SS).transpose(0, 2, 1, 3).reshape(size, size, SS * SS)
    for j in range(size):
        for i in range(size):
            mm = M[j, i]; cov = (mm >= 0).mean()
            if cov < 0.42:
                continue
            k = np.bincount(mm[mm >= 0]).argmax()
            v = V[j, i][mm == k].mean()
            ramp = RAMPS[names[k]]
            out[j, i] = hx(ramp[min(len(ramp) - 1, int(v * len(ramp)))])
    im = Image.fromarray(out, 'RGBA')
    if outline:
        im = add_outline(im, mat, names, size)
    return im


def add_outline(im, mat, names, size):
    a = np.array(im)
    on = a[:, :, 3] > 0
    p = np.pad(on, 1)
    ring = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~on
    # outline colour: ink for solid things, the darkest ramp tone next to glowing ones
    M = mat.reshape(size, SS, size, SS).transpose(0, 2, 1, 3).reshape(size, size, SS * SS)
    ys, xs = np.nonzero(ring)
    for y, x in zip(ys, xs):
        col = INK
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < size and 0 <= xx < size and on[yy, xx]:
                mm = M[yy, xx]; mm = mm[mm >= 0]
                if len(mm):
                    n = names[np.bincount(mm).argmax()]
                    if n in GLOW:
                        col = hx(RAMPS[n][0])
                break
        a[y, x] = col
    return Image.fromarray(a, 'RGBA')


# ---------------------------------------------------------------- the projectiles (local frame: +x = forward)
def kunai(L=1.0, blade='steel', grip='cloth', edge=None):
    s = L
    sh = [
        {'ring': ((-8.2 * s, 0), 1.9 * s, 0.9 * s), 'mat': blade, 'shade': 'round', 'c': (-8.2 * s, 0), 'r': 1.9 * s},
        {'poly': [(-6.4 * s, -1.0 * s), (-1.2 * s, -1.0 * s), (-1.2 * s, 1.0 * s), (-6.4 * s, 1.0 * s)], 'mat': grip, 'shade': 'round', 'c': (-3.8 * s, 0), 'r': 1.4 * s},
        {'poly': [(-1.4 * s, -2.0 * s), (0.2 * s, -2.0 * s), (0.2 * s, 2.0 * s), (-1.4 * s, 2.0 * s)], 'mat': blade, 'shade': 'round', 'c': (-0.6 * s, 0), 'r': 2.0 * s},
        {'poly': [(0.0, -2.6 * s), (3.0 * s, -2.9 * s), (9.6 * s, 0), (3.0 * s, 2.9 * s), (0.0, 2.6 * s)], 'mat': blade, 'shade': 'facet', 'hw': 2.9 * s},
    ]
    for k in range(3):   # cloth wraps on the grip
        x0 = (-5.8 + k * 1.6) * s
        sh.append({'poly': [(x0, -1.0 * s), (x0 + 0.6 * s, -1.0 * s), (x0 + 0.6 * s, 1.0 * s), (x0, 1.0 * s)], 'mat': grip, 'shade': 'flat', 'v': 0.15})
    if edge:
        sh.append({'poly': [(3.0 * s, -2.9 * s), (9.6 * s, 0), (3.0 * s, -2.2 * s)], 'mat': edge, 'shade': 'flat', 'v': 0.95})
        sh.append({'poly': [(3.0 * s, 2.9 * s), (9.6 * s, 0), (3.0 * s, 2.2 * s)], 'mat': edge, 'shade': 'flat', 'v': 0.7})
    return sh


def arrow():
    return [
        {'poly': [(-9.5, -2.6), (-6.2, -0.4), (-6.2, 0.4), (-9.5, 2.6), (-8.2, 0)], 'mat': 'fred', 'shade': 'facet', 'hw': 2.6},
        {'poly': [(-7.6, -1.6), (-5.4, -0.3), (-5.4, 0.3), (-7.6, 1.6), (-6.8, 0)], 'mat': 'fwhite', 'shade': 'facet', 'hw': 1.6},
        {'poly': [(-8.6, -0.55), (5.6, -0.55), (5.6, 0.55), (-8.6, 0.55)], 'mat': 'wood', 'shade': 'round', 'c': (0, 0), 'r': 0.8},
        {'poly': [(4.8, -2.4), (10.4, 0), (4.8, 2.4), (6.0, 0)], 'mat': 'steel', 'shade': 'facet', 'hw': 2.4},
    ]


def shuriken_frame(n_blades=4, R=7.6, r_in=2.6, mat='steel', hole=1.2, hook=0.55):
    def f(t):
        return None
    shapes = []
    for k in range(n_blades):
        a0 = k / n_blades * math.tau
        tip = rot((R, 0), a0)
        b1 = rot((r_in * 0.9, -r_in * 0.95), a0)
        b2 = rot((r_in * 0.9, r_in * 0.95), a0)
        hk = rot((R * 0.55, R * hook * 0.42), a0)      # curved trailing edge (a hook), so the spin reads
        shapes.append({'poly': [b1, tip, hk, b2], 'mat': mat, 'shade': 'facet', 'hw': 2.6, '_a0': a0})
    shapes.append({'circle': ((0, 0), r_in + 0.4), 'mat': mat, 'shade': 'round', 'c': (0, 0), 'r': r_in + 0.4})
    if hole:
        shapes.append({'circle': ((0, 0), hole), 'mat': 'dsteel', 'shade': 'flat', 'v': 0.05})
    return shapes


def blade_facets(shapes, spin):
    """A spinning blade's facet normal must turn with the blade: bake the blade's own angle into the facet model."""
    out = []
    for sh in shapes:
        if sh.get('shade') == 'facet' and '_a0' in sh:
            a0 = sh['_a0']
            out.append(dict(sh, shade='facet_spin', _spin=spin + a0))
        else:
            out.append(sh)
    return out


def shade_facet_spin(lx, ly, spec, a):
    a0 = spec['_spin']
    # coordinates in the blade's own frame
    c, s = math.cos(-(a0 - a)), math.sin(-(a0 - a))
    bx = lx * c - ly * s
    by = lx * s + ly * c
    return shade_facet(bx, by, spec, a0)


SHADE['facet_spin'] = shade_facet_spin


def star5(R=7.2, r=3.0, mat='magic'):
    pts = []
    for k in range(10):
        rr = R if k % 2 == 0 else r
        pts.append(rot((rr, 0), k / 10 * math.tau - math.pi / 2))
    return [{'poly': pts, 'mat': mat, 'shade': 'glow', 'c': (0, 0), 'rad': (R * 0.95, R * 0.95)},
            {'circle': ((0, 0), 1.6), 'mat': mat, 'shade': 'flat', 'v': 1.0}]


def ice_spike():
    return [
        {'poly': [(-9.0, 0), (-5.6, -1.6), (-6.2, 0), (-5.6, 1.6)], 'mat': 'ice', 'shade': 'facet', 'hw': 1.6, 'bias': -0.1},
        {'poly': [(-6.0, -2.6), (4.0, -2.4), (10.4, 0), (4.0, 2.4), (-6.0, 2.6), (-7.6, 0)], 'mat': 'ice', 'shade': 'facet', 'hw': 2.6, 'bias': 0.08},
        {'poly': [(-3.0, -0.5), (7.0, -0.4), (9.0, 0), (7.0, 0.1), (-3.0, 0.0)], 'mat': 'ice', 'shade': 'flat', 'v': 0.98},
    ]


def fireball(t):
    """Burning ball: a hot core with three flame tongues streaming back, flickering with t."""
    sh = []
    for k, (ang, ln) in enumerate(((0.0, 1.0), (0.55, 0.78), (-0.55, 0.78))):
        wob = 0.35 * math.sin(t * math.tau + k * 2.1)
        L = 9.5 * ln + 1.2 * math.sin(t * math.tau * 2 + k)
        a = math.pi + ang * 0.55 + wob * 0.25
        tip = (L * math.cos(a), L * math.sin(a))
        p1 = rot((0, -3.6), ang * 0.4); p2 = rot((0, 3.6), ang * 0.4)
        sh.append({'poly': [p1, (tip[0] * 0.55 + 1.2 * math.sin(t * 7 + k), tip[1] * 0.55 - 1.4), tip, (tip[0] * 0.55, tip[1] * 0.55 + 1.4), p2],
                   'mat': 'fire', 'shade': 'glow', 'c': (1.0, 0), 'rad': (11.0, 6.0), 'noise': 0.12})
    sh.append({'circle': ((1.0, 0), 4.6), 'mat': 'fire', 'shade': 'glow', 'c': (1.8, 0), 'rad': (5.4, 5.4), 'bias': 0.1})
    return sh


def spirit_orb(t):
    sh = [{'circle': ((0, 0), 7.4), 'mat': 'spirit', 'shade': 'glow', 'c': (0, 0), 'rad': (7.6, 7.6), 'bias': -0.04}]
    for k in range(3):   # swirling bright arcs inside
        a = t * math.tau + k * math.tau / 3
        p = [rot((r, 0), a + r * 0.32) for r in (1.0, 2.6, 4.2, 5.6)]
        q = [rot((r, 0), a + r * 0.32 + 0.42) for r in (5.6, 4.2, 2.6, 1.0)]
        sh.append({'poly': p + q, 'mat': 'spirit', 'shade': 'flat', 'v': 0.82})
    sh.append({'circle': ((-1.8, -1.8), 1.3), 'mat': 'spirit', 'shade': 'flat', 'v': 1.0})
    return sh


def laser():
    return [
        {'poly': [(-9.5, 0), (-2.0, -1.9), (7.0, -1.9), (10.0, 0), (7.0, 1.9), (-2.0, 1.9)], 'mat': 'pink', 'shade': 'glow', 'c': (3.0, 0), 'rad': (8.5, 2.2)},
        {'poly': [(-4.0, -0.5), (8.4, -0.5), (9.4, 0), (8.4, 0.5), (-4.0, 0.5)], 'mat': 'pink', 'shade': 'flat', 'v': 1.0},
    ]


def katana_wave(t):
    pts_o, pts_i = [], []
    for k in range(15):
        ang = -1.2 + k / 14 * 2.4
        pts_o.append((-7.0 + 11.8 * math.cos(ang), 11.8 * math.sin(ang)))
        pts_i.append((-9.8 + 10.6 * math.cos(ang), 9.6 * math.sin(ang)))
    return [{'poly': pts_o + pts_i[::-1], 'mat': 'cyan', 'shade': 'arc', 'c': (-8.4, 0), 'R': 11.0, 'th': 2.2, 'span': 11.5,
             'noise': 0.05 + 0.03 * math.sin(t * math.tau)}]


def rail():
    return [
        {'poly': [(-10.0, -0.6), (4.0, -0.6), (4.0, 0.6), (-10.0, 0.6)], 'mat': 'cyan', 'shade': 'glow', 'c': (2.0, 0), 'rad': (12.0, 1.4)},
        {'poly': [(2.0, -3.2), (10.4, 0), (2.0, 3.2), (4.0, 0)], 'mat': 'cyan', 'shade': 'glow', 'c': (8.0, 0), 'rad': (6.0, 3.6), 'bias': 0.1},
        {'poly': [(-10.0, -2.6), (-6.0, -0.6), (-7.0, 0), (-6.0, 0.6), (-10.0, 2.6), (-8.4, 0)], 'mat': 'pink', 'shade': 'glow', 'c': (-7.0, 0), 'rad': (4.0, 3.0)},
    ]


def drone(t):
    blink = 'red' if t < 0.5 else 'cyan'
    return [
        {'ellipse': ((-1.0, -4.2), (2.6, 0.7)), 'mat': 'fwhite', 'shade': 'flat', 'v': 0.4 + 0.4 * t},
        {'ellipse': ((-1.0, 4.2), (2.6, 0.7)), 'mat': 'fwhite', 'shade': 'flat', 'v': 0.8 - 0.4 * t},
        {'poly': [(-1.6, -3.8), (-0.4, -3.8), (-0.4, 3.8), (-1.6, 3.8)], 'mat': 'dsteel', 'shade': 'flat', 'v': 0.4},
        {'poly': [(-5.0, -2.6), (3.4, -2.6), (5.6, 0), (3.4, 2.6), (-5.0, 2.6), (-6.0, 0)], 'mat': 'steel', 'shade': 'round', 'c': (0, 0), 'r': 4.0},
        {'poly': [(1.0, -1.4), (4.0, -1.0), (4.6, 0), (4.0, 1.0), (1.0, 1.4)], 'mat': 'cyan', 'shade': 'glow', 'c': (3.4, 0), 'rad': (2.6, 1.6)},
        {'circle': ((-2.6, 0), 0.9), 'mat': blink, 'shade': 'flat', 'v': 0.95},
    ]


def plasma_star(spin):
    sh = []
    for k in range(4):
        a0 = spin + k / 4 * math.tau
        tip = rot((7.6, 0), a0); b1 = rot((1.6, -2.4), a0); b2 = rot((1.6, 2.4), a0); hk = rot((4.0, 2.0), a0)
        sh.append({'poly': [b1, tip, hk, b2], 'mat': 'cyan', 'shade': 'glow', 'c': (0, 0), 'rad': (8.0, 8.0), 'bias': 0.05})
    sh.append({'circle': ((0, 0), 2.6), 'mat': 'pink', 'shade': 'glow', 'c': (0, 0), 'rad': (2.8, 2.8), 'bias': 0.25})
    return sh


# name: (kind, size, frames, builder)   kind: 'dir' = 16 directions, 'spin' = spin steps
SPECS = {
    'Kunai':         ('dir', 24, 1, lambda t: kunai(1.08)),
    'Arrow':         ('dir', 22, 1, lambda t: arrow()),
    'BigKunai':      ('dir', 34, 1, lambda t: kunai(1.5, 'violet', 'dsteel', edge='magic')),
    'IceSpike':      ('dir', 24, 1, lambda t: ice_spike()),
    'Fireball':      ('dir', 24, 4, fireball),
    'Laser':         ('dir', 22, 1, lambda t: laser()),
    'Katana':        ('dir', 28, 2, katana_wave),
    'Rail':          ('dir', 24, 1, lambda t: rail()),
    'Drone':         ('dir', 16, 2, drone),
    'Shuriken':      ('spin', 19, 8, None),
    'ShurikenMagic': ('spin', 19, 8, None),
    'BigEnergyBall': ('spin', 19, 6, spirit_orb),
    'Plasma':        ('spin', 19, 8, None),
}


def make(add, anim):
    for name, (kind, size, frames, build) in SPECS.items():
        if kind == 'dir':
            for d in range(16):
                a = d / 16 * math.tau
                for f in range(frames):
                    add(f'ppd_{name}_{d}_{f}', render(build(f / frames), size, a, f / frames))
            anim[f'ppd_{name}'] = frames
        else:
            for f in range(frames):
                t = f / frames
                if name == 'Shuriken':
                    spin = t * math.tau / 4
                    shapes = blade_facets(shuriken_frame(), spin)
                    im = render(shapes, size, spin, t)
                elif name == 'ShurikenMagic':
                    spin = t * math.tau / 5
                    im = render(star5(), size, spin, t)
                elif name == 'Plasma':
                    spin = t * math.tau / 4
                    im = render(plasma_star(0), size, spin, t)
                else:
                    im = render(build(t), size, 0, t)
                add(f'pps_{name}_{f}', im)
            anim[f'pps_{name}'] = frames
