"""Destiny-inspired exotic/legendary weapons, built with the hard-surface kit. usage: python3 exotics.py -- outdir [id ...]
Muzzle +Y, up +Z, barrel axis at z=0, grip near the origin."""
import sys, os, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import *
from kit import _fin

def hexm(name, c, metal=0.0, rough=0.5, emit=0.0): return mat(name, c, metal, rough, emit)

def spike(x, y, z, length, r, m, rot):
    bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=0.0, depth=length, vertices=5, location=(x, y, z), rotation=rot)
    return _fin(C.object, m, 0.0)

def hawkmoon():
    ivory = hexm('ivory', 0xf1ead8, 0.15, 0.32); gold = hexm('gold', 0xe0b04a, 0.9, 0.28); steel = hexm('steel', 0x8b909c, 0.9, 0.3); wood = hexm('walnut', 0x4a2a1a, 0.0, 0.55)
    dark = hexm('dark', 0x16171c, 0.4, 0.5); amber = hexm('amber', 0xffb84a, 0.0, 0.3, 3.2)
    box(0.038, 0.32, 0.052, 0, 0.04, 0.0, ivory, 0.006, seg=3)                       # frame + slide
    box(0.03, 0.30, 0.014, 0, 0.05, 0.036, steel, 0.003)                             # top rib
    cyl(0.019, 0.20, 0, 0.30, 0.004, steel, 'Y', 24, 0.002)                           # barrel
    cyl(0.028, 0.06, 0, 0.415, 0.004, gold, 'Y', 24, 0.004, r2=0.02)                  # muzzle bell
    cyl(0.026, 0.02, 0, 0.365, 0.004, gold, 'Y', 24, 0.002)
    for sg in (-1, 1):
        box(0.005, 0.20, 0.036, sg * 0.0205, 0.07, 0.002, gold, 0.003)               # wing plates
        box(0.005, 0.10, 0.03, sg * 0.0205, -0.06, 0.003, gold, 0.003, rot=(0, 0, 0))
        box(0.004, 0.10, 0.012, sg * 0.0205, 0.18, 0.014, gold, 0.002, rot=(0, 0, 0.0))
    box(0.036, 0.055, 0.17, 0, -0.085, -0.108, wood, 0.008, rot=(0.24, 0, 0))         # grip
    for sg in (-1, 1): box(0.004, 0.03, 0.12, sg * 0.0195, -0.085, -0.108, gold, 0.002, rot=(0.24, 0, 0))
    box(0.038, 0.03, 0.02, 0, -0.118, -0.2, gold, 0.006, rot=(0.24, 0, 0))            # pommel
    box(0.009, 0.006, 0.03, 0, 0.0, -0.06, dark, 0.001, rot=(0.3, 0, 0))              # trigger
    box(0.01, 0.075, 0.008, 0, 0.035, -0.052, steel, 0.002); box(0.01, 0.008, 0.05, 0, 0.075, -0.03, steel, 0.002)
    box(0.012, 0.02, 0.026, 0, -0.115, 0.04, dark, 0.004, rot=(-0.35, 0, 0))          # hammer
    box(0.012, 0.012, 0.014, 0, -0.06, 0.05, steel, 0.002); box(0.006, 0.012, 0.016, 0, 0.38, 0.03, gold, 0.002)
    box(0.005, 0.15, 0.004, 0, 0.1, 0.045, amber, 0.001, seg=1)                       # amber line
    box(0.038, 0.02, 0.012, 0, 0.19, 0.0, gold, 0.002)

def lastword():
    steel = hexm('steel', 0x2e3138, 0.85, 0.34); gold = hexm('gold', 0xe0b04a, 0.9, 0.28); wood = hexm('walnut', 0x5a3320, 0.0, 0.5); dark = hexm('dark', 0x111216, 0.4, 0.5)
    bronze = hexm('bronze', 0x9a6a30, 0.8, 0.35); red = hexm('red', 0xff4a3a, 0.0, 0.3, 3.0)
    box(0.046, 0.27, 0.066, 0, 0.03, 0.0, steel, 0.007, seg=3)                        # heavy slide
    box(0.052, 0.13, 0.078, 0, 0.19, -0.003, steel, 0.008, seg=3)                     # shroud
    for i in range(4):
        cut(bpy.data.objects[-1] if False else C.object, cutter_box(0.07, 0.012, 0.03, 0, 0.14 + i * 0.03, 0.012)) if False else None
    for i in range(4): box(0.054, 0.008, 0.02, 0, 0.145 + i * 0.03, 0.0375, dark, 0.001, seg=1)   # vents
    cyl(0.022, 0.14, 0, 0.32, 0.0, steel, 'Y', 20, 0.002)                             # barrel
    box(0.05, 0.05, 0.05, 0, 0.395, 0.0, gold, 0.006, seg=2)                          # muzzle brake
    for sg in (-1, 1): box(0.006, 0.032, 0.03, sg * 0.026, 0.395, 0.0, dark, 0.001)
    box(0.04, 0.32, 0.012, 0, 0.05, 0.039, bronze, 0.003)                             # top strap
    box(0.04, 0.24, 0.006, 0, 0.03, 0.0, gold, 0.002)                                 # side inlay (thin center)
    for sg in (-1, 1): box(0.004, 0.14, 0.022, sg * 0.024, 0.02, 0.0, gold, 0.002)
    box(0.042, 0.062, 0.19, 0, -0.09, -0.118, wood, 0.01, rot=(0.22, 0, 0))            # walnut grip
    for sg in (-1, 1): cyl(0.008, 0.004, sg * 0.022, -0.09, -0.09, gold, 'X', 12, 0.001)
    box(0.046, 0.05, 0.03, 0, -0.125, -0.225, bronze, 0.006, rot=(0.22, 0, 0))
    box(0.01, 0.006, 0.034, 0, -0.005, -0.068, dark, 0.001, rot=(0.3, 0, 0))
    box(0.012, 0.09, 0.008, 0, 0.04, -0.06, steel, 0.002); box(0.012, 0.008, 0.06, 0, 0.085, -0.034, steel, 0.002)
    box(0.016, 0.03, 0.03, 0, -0.11, 0.043, dark, 0.004, rot=(-0.3, 0, 0))
    box(0.006, 0.03, 0.006, 0, 0.36, 0.028, red, 0.001, seg=1); box(0.012, 0.014, 0.014, 0, -0.1, 0.048, red, 0.002, seg=1)

def felwinter():
    dark = hexm('dark', 0x1b1214, 0.6, 0.4); red = hexm('crimson', 0x8a1c26, 0.3, 0.42); gold = hexm('gold', 0xe0b04a, 0.9, 0.28); steel = hexm('steel', 0x4a4d57, 0.9, 0.32)
    wood = hexm('walnut', 0x3a1c14, 0.0, 0.5); ember = hexm('ember', 0xff7a2a, 0.0, 0.3, 3.4)
    box(0.06, 0.36, 0.095, 0, 0.03, 0.0, red, 0.008, seg=3)                            # receiver
    for sg in (-1, 1): box(0.004, 0.24, 0.05, sg * 0.031, 0.04, 0.0, gold, 0.002)
    cyl(0.026, 0.74, 0, 0.55, 0.03, steel, 'Y', 24, 0.002)                             # barrel (0.18 .. 0.92)
    cyl(0.021, 0.5, 0, 0.45, -0.03, steel, 'Y', 20, 0.002)                             # mag tube
    for y in (0.3, 0.55, 0.8):
        cyl(0.031, 0.026, 0, y, 0.03, gold, 'Y', 24, 0.002)
    for y in (0.3, 0.6): cyl(0.026, 0.02, 0, y, -0.03, gold, 'Y', 20, 0.002)
    box(0.064, 0.22, 0.062, 0, 0.42, -0.03, wood, 0.01, seg=3)                         # fore-end
    for sg in (-1, 1): box(0.004, 0.15, 0.02, sg * 0.033, 0.42, -0.03, gold, 0.002)
    cyl(0.031, 0.06, 0, 0.93, 0.03, dark, 'Y', 24, 0.004, r2=0.027); cyl(0.024, 0.008, 0, 0.962, 0.03, ember, 'Y', 24, 0.0)
    box(0.006, 0.05, 0.02, 0, 0.9, 0.068, ember, 0.001, seg=1)                         # front bead
    box(0.052, 0.34, 0.1, 0, -0.29, -0.02, wood, 0.012, rot=(-0.07, 0, 0), seg=3)      # stock
    box(0.056, 0.03, 0.13, 0, -0.465, -0.045, dark, 0.008, rot=(-0.07, 0, 0))          # butt pad
    box(0.036, 0.06, 0.15, 0, -0.03, -0.1, wood, 0.008, rot=(0.3, 0, 0))               # pistol grip
    box(0.01, 0.006, 0.034, 0, 0.06, -0.078, dark, 0.001, rot=(0.3, 0, 0))
    box(0.012, 0.09, 0.008, 0, 0.09, -0.074, steel, 0.002); box(0.012, 0.008, 0.055, 0, 0.13, -0.05, steel, 0.002)
    box(0.052, 0.07, 0.012, 0, 0.0, 0.052, gold, 0.003)
    box(0.006, 0.2, 0.004, 0, 0.45, 0.062, ember, 0.001, seg=1)

def gjallarhorn():
    ivory = hexm('ivory', 0xeae0c4, 0.2, 0.36); gold = hexm('gold', 0xe0b04a, 0.9, 0.28); red = hexm('crimson', 0x7a1620, 0.3, 0.45); dark = hexm('dark', 0x1a1a1e, 0.6, 0.4); glow = hexm('glow', 0xff5a3a, 0.0, 0.3, 3.6)
    cyl(0.078, 0.78, 0, 0.35, 0.0, ivory, 'Y', 32, 0.004)                              # main tube
    cyl(0.145, 0.22, 0, 0.85, 0.0, ivory, 'Y', 32, 0.004, r2=0.078)                    # flared bell (r at +Y)
    cyl(0.152, 0.018, 0, 0.955, 0.0, gold, 'Y', 32, 0.003)                             # bell lip
    cyl(0.11, 0.01, 0, 0.945, 0.0, glow, 'Y', 32, 0.0)                                 # inner glow disc
    for y in (0.0, 0.2, 0.42, 0.62): cyl(0.086, 0.03, 0, y, 0.0, gold, 'Y', 32, 0.002)
    for y in (0.1, 0.3, 0.52): cyl(0.084, 0.05, 0, y, 0.0, red, 'Y', 32, 0.002)
    cyl(0.095, 0.16, 0, -0.06, 0.0, dark, 'Y', 28, 0.004, r2=0.078)                    # breech cone (r at +Y end)
    cyl(0.05, 0.1, 0, -0.17, 0.0, gold, 'Y', 24, 0.004, r2=0.04)
    box(0.05, 0.22, 0.05, 0, 0.3, 0.115, dark, 0.006)                                  # top sight rail
    box(0.03, 0.03, 0.06, 0, 0.18, 0.155, gold, 0.004); box(0.014, 0.014, 0.05, 0, 0.5, 0.15, glow, 0.002, seg=1)
    box(0.04, 0.06, 0.16, 0, 0.12, -0.16, red, 0.008, rot=(0.28, 0, 0)); box(0.046, 0.04, 0.03, 0, 0.1, -0.25, gold, 0.006, rot=(0.28, 0, 0))   # rear grip
    box(0.036, 0.05, 0.14, 0, 0.5, -0.14, red, 0.008, rot=(0.1, 0, 0)); box(0.04, 0.036, 0.024, 0, 0.5, -0.215, gold, 0.005)                      # front grip
    box(0.05, 0.16, 0.05, 0, 0.32, -0.085, dark, 0.008)
    for sg in (-1, 1):                                                                 # wolf brow plates
        box(0.01, 0.16, 0.05, sg * 0.082, 0.7, 0.03, gold, 0.004, rot=(0, 0, sg * 0.25))
        spike(sg * 0.1, 0.78, 0.0, 0.11, 0.022, gold, (-math.pi / 2, 0, 0))

def thorn():
    blk = hexm('black', 0x0c0d10, 0.7, 0.34); steel = hexm('steel', 0x2c2f38, 0.9, 0.3); green = hexm('green', 0x66ff3a, 0.0, 0.3, 3.6); gold = hexm('gold', 0x9aa060, 0.8, 0.35)
    bone = hexm('bone', 0xd8d0b8, 0.1, 0.5)
    box(0.034, 0.30, 0.048, 0, 0.04, 0.0, blk, 0.006, seg=3)                           # frame + slide
    box(0.026, 0.28, 0.012, 0, 0.05, 0.03, steel, 0.003)
    cyl(0.018, 0.22, 0, 0.30, 0.004, steel, 'Y', 20, 0.002)                            # barrel
    cyl(0.026, 0.05, 0, 0.42, 0.004, blk, 'Y', 20, 0.004, r2=0.018)
    cyl(0.014, 0.008, 0, 0.447, 0.004, green, 'Y', 20, 0.0)
    for i, y in enumerate((0.16, 0.22, 0.28, 0.34, 0.40)):                              # thorns along the barrel, alternating sides
        for sg in (-1, 1): spike(sg * (0.03 + i * 0.001), y, 0.006, 0.07 - i * 0.005, 0.011, bone, (0, sg * math.pi / 2, 0) if False else (0, sg * (math.pi / 2), 0))
    for sg in (-1, 1): spike(sg * 0.012, 0.44, 0.03, 0.05, 0.009, bone, (-0.4, 0, sg * 0.2))
    for i in range(6): box(0.037, 0.004, 0.03, 0, 0.0 + i * 0.03, 0.0, green, 0.001, seg=1) if False else None
    for sg in (-1, 1): box(0.004, 0.24, 0.006, sg * 0.0175, 0.06, 0.008, green, 0.001, seg=1)   # glowing veins
    box(0.032, 0.06, 0.17, 0, -0.085, -0.108, blk, 0.008, rot=(0.25, 0, 0))            # grip
    for sg in (-1, 1): box(0.004, 0.036, 0.1, sg * 0.0175, -0.085, -0.108, green, 0.002, rot=(0.25, 0, 0), seg=1)
    box(0.036, 0.03, 0.02, 0, -0.12, -0.205, gold, 0.005, rot=(0.25, 0, 0))
    box(0.009, 0.006, 0.03, 0, 0.0, -0.06, steel, 0.001, rot=(0.3, 0, 0))
    box(0.01, 0.075, 0.008, 0, 0.035, -0.05, steel, 0.002); box(0.01, 0.008, 0.05, 0, 0.075, -0.028, steel, 0.002)
    spike(0, -0.12, 0.04, 0.05, 0.012, bone, (math.pi / 2 + 0.5, 0, 0))                 # hammer spur

BUILD = {'hawkmoon': hawkmoon, 'lastword': lastword, 'felwinter': felwinter, 'gjallarhorn': gjallarhorn, 'thorn': thorn}
if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = a[0] if a else '/tmp/ex'; ids = a[1:] or list(BUILD)
    os.makedirs(out, exist_ok=True)
    for i in ids:
        reset(); BUILD[i]()
        print(i, 'tris', tri_count())
        preview(f'{out}/{i}_side.png', view='side'); preview(f'{out}/{i}_iso.png', view='iso')
        export(f'{out}/{i}.glb')
