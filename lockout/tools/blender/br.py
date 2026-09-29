import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from kit import *

reset()
S = 0.00097                      # metres per concept-image pixel
Y = lambda px: (px - 380) * S    # forward
Z = lambda py: (300 - py) * S    # up (0 = barrel line)
W = 0.078                        # body width

olive = mat('olive', 0x566447, 0.15, 0.58)
olive2 = mat('olive2', 0x647456, 0.15, 0.55)
gun = mat('gunmetal', 0x2a2e35, 0.85, 0.36)
blk = mat('polymer', 0x14161a, 0.05, 0.75)
tan = mat('tan', 0xb59a68, 0.1, 0.62)
lens = mat('lens', 0x66e6ff, 0.0, 0.15, 3.2)


def pbox(x0, x1, y0, y1, m, w=W, bevel=0.005, dx=0.0, rot=(0, 0, 0), seg=2):
    """box from concept-image pixel bounds (x along barrel, y down), width w across"""
    return box(w, (x1 - x0) * S, (y1 - y0) * S, dx, Y((x0 + x1) / 2), Z((y0 + y1) / 2), m, bevel, rot, seg)


# receiver + handguard
recv = pbox(60, 640, 214, 330, olive, W)
hand = pbox(600, 862, 226, 332, olive2, W * 0.92)
# stock: pad, comb block, lower wedge
pbox(20, 82, 218, 424, blk, W * 0.9, 0.006)
pbox(20, 44, 240, 400, tan, W * 0.92, 0.003)
pbox(80, 340, 330, 424, olive, W * 0.8, 0.008, rot=(0.0, 0, 0))
# pistol grip (raked) + trigger guard
box(W * 0.62, 0.038, 0.15, 0, Y(376), Z(418), blk, 0.006, rot=(0.28, 0, 0))
pbox(430, 536, 336, 346, olive, W * 0.7, 0.003)
pbox(434, 448, 340, 382, olive, W * 0.7, 0.003)
box(0.01, 0.006, 0.034, 0, Y(468), Z(370), tan, 0.001, rot=(0.35, 0, 0))    # trigger
# magazine (ahead of the grip) + floor plate + ribs
pbox(534, 646, 336, 490, blk, W * 0.62, 0.005)
pbox(530, 650, 486, 506, tan, W * 0.66, 0.004)
for i in range(4):
    pbox(548 + i * 26, 556 + i * 26, 350, 480, gun, W * 0.64, 0.001, seg=1)
# top rail with teeth + scope
pbox(340, 706, 202, 216, blk, W * 0.5, 0.002)
for i in range(16):
    pbox(348 + i * 22, 358 + i * 22, 194, 204, gun, W * 0.42, 0.001, seg=1)
pbox(384, 528, 184, 204, tan, W * 0.52, 0.004)
scope = cyl(0.034, 0.27, 0, Y(462), Z(160), olive2, 'Y', 24, 0.003)
cyl(0.038, 0.06, 0, Y(346), Z(160), blk, 'Y', 24, 0.003)
cyl(0.038, 0.05, 0, Y(590), Z(160), blk, 'Y', 24, 0.003)
cyl(0.028, 0.012, 0, Y(606), Z(160), lens, 'Y', 24, 0.0)
cyl(0.014, 0.022, 0, Y(430), Z(122), gun, 'Z', 16, 0.002)
# barrel + brake
cyl(0.0175, 0.14, 0, Y(925), Z(268), gun, 'Y', 20, 0.002)
brake = cyl(0.026, 0.09, 0, Y(962), Z(268), gun, 'Y', 6, 0.003)
for i in range(3):
    cut(brake, cutter_box(0.07, 0.012, 0.018, 0, Y(942 + i * 20), Z(268)))
# panel details: vents and tan plates
for (a, b, c, d) in [(100, 236, 240, 254), (412, 600, 236, 250), (704, 736, 252, 292), (748, 780, 252, 292), (792, 824, 252, 292)]:
    cut(recv if a < 640 and b < 640 else hand, cutter_box(W * 1.2, (b - a) * S, (d - c) * S, 0, Y((a + b) / 2), Z((c + d) / 2)))
pbox(96, 196, 284, 322, tan, W * 1.06, 0.003)
for i in range(3):
    pbox(700 + i * 26, 716 + i * 26, 328, 346, tan, W * 0.9, 0.002, seg=1)

if __name__ == '__main__':
    out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/br'
    print('tris', tri_count())
    preview(out + '_side.png', view='side'); preview(out + '_iso.png', view='iso')
    export(out + '.glb')
