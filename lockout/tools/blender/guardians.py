"""Marble Guardian statues: Genshin elegance x Destiny warlock robes. Female figures, flowing hair and cloth, gold filigree.
Run: python3 guardians.py -- /out/dir [ids] [--preview]
Facing +Y (exports to game forward), feet on z=0, ~2.0m tall. Materials by name so the game swaps in its marble/gold: marble, marble2, gold, glow, dark.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector
sys.path.insert(0, os.path.dirname(__file__))
import kit
from kit import mat, C

def V(*a):
    return Vector(a[0] if len(a) == 1 else a)
PI = math.pi
M = {}


def mats():
    M['marble'] = mat('marble', 0xf0ece6, 0.0, 0.3)
    M['marble2'] = mat('marble2', 0xdcd6cd, 0.0, 0.4)
    M['gold'] = mat('gold', 0xe9bb5c, 1.0, 0.24)
    M['glow'] = mat('glow', 0x9fe8ff, 0.0, 0.3, emit=3.0)
    M['dark'] = mat('dark', 0x16171d, 0.0, 0.5)


def _obj(bm, m, name, sub=1, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); C.collection.objects.link(o)
    o.data.materials.append(m)
    for p in me.polygons:
        p.use_smooth = smooth
    if sub:
        md = o.modifiers.new('s', 'SUBSURF'); md.levels = sub; md.render_levels = sub
    return o


def tube(pts, rad, m, seg=12, cap=True, sub=1, wide=None, flat=1.0, name='tube'):
    """Loft a rounded tube through pts. rad: float | list of float | list of (wide, narrow). wide: preferred wide axis."""
    pts = [V(p) for p in pts]; n = len(pts)
    if not isinstance(rad, (list, tuple)):
        rad = [rad] * n
    bm = bmesh.new(); rings = []
    prev = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        if prev is None:
            ref = V(wide) if wide is not None else (V((1, 0, 0)) if abs(t.x) < 0.9 else V((0, 1, 0)))
            nn = (ref - t * ref.dot(t)).normalized()
        else:
            nn = (prev - t * prev.dot(t)).normalized()
        prev = nn; bn = t.cross(nn)
        r = rad[i]; rw, rn = (r if isinstance(r, (list, tuple)) else (r, r * flat))
        ring = [bm.verts.new(p + nn * math.cos(a) * rw + bn * math.sin(a) * rn) for a in [k * 2 * PI / seg for k in range(seg)]]
        rings.append(ring)
    for i in range(n - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    if cap:
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return _obj(bm, m, name, sub)


def sheet(fn, nu, nv, m, thick=0.006, closed=False, sub=1, name='sheet'):
    """Parametric surface (u,v in 0..1) -> cloth. Solidified."""
    bm = bmesh.new(); g = []
    cols = nu if closed else nu + 1
    for j in range(nv + 1):
        row = []
        for i in range(cols):
            u = i / nu; v = j / nv
            row.append(bm.verts.new(V(fn(u, v))))
        g.append(row)
    for j in range(nv):
        for i in range(nu if closed else nu):
            i2 = (i + 1) % cols
            bm.faces.new((g[j][i], g[j][i2], g[j + 1][i2], g[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _obj(bm, m, name, 0)
    sd = o.modifiers.new('sol', 'SOLIDIFY'); sd.thickness = thick; sd.offset = 0
    if sub:
        md = o.modifiers.new('s', 'SUBSURF'); md.levels = sub; md.render_levels = sub
    return o


def ell(c, r, m, rot=(0, 0, 0), sub=2, name='ell'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=1, location=c, rotation=rot)
    o = C.object; o.scale = r; bpy.ops.object.transform_apply(scale=True, rotation=False)
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def torus(c, R, r, m, rot=(0, 0, 0), maj=28, mnr=8):
    bpy.ops.mesh.primitive_torus_add(location=c, rotation=rot, major_segments=maj, minor_segments=mnr, major_radius=R, minor_radius=r)
    o = C.object; o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def cone(r1, r2, h, c, m, rot=(0, 0, 0), verts=12):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=h, vertices=verts, location=c, rotation=rot)
    o = C.object; o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def edge_trim(fn, v, nu, r, m, closed=False):
    pts = [fn(i / nu, v) for i in range(nu + (0 if closed else 1))]
    if closed:
        pts.append(pts[0])
    return tube(pts, r, m, seg=6, cap=False, sub=0)


# ------------------------------------------------------------------ body parts
def legs(P):
    """P: dict of joint positions per side. Thigh-high boots, greaves, heels."""
    for s in (-1, 1):
        hip, knee, ank, toe = P['hip'][s], P['knee'][s], P['ank'][s], P['toe'][s]
        tube([hip, hip.lerp(knee, .5) + V((0, .01, 0)), knee, knee.lerp(ank, .5) + V((0, -.015, 0)), ank], [.088, .074, .058, .05, .036], M['marble'], seg=14, name='leg')
        # thigh-high boot shaft, flared gold cuff
        top = hip.lerp(knee, .42)
        tube([top, knee, knee.lerp(ank, .5) + V((0, -.015, 0)), ank + V(0, 0, .02)], [.078, .066, .054, .04], M['marble2'], seg=14, name='boot')
        torus(top, .08, .008, M['gold'], maj=24)
        torus(top + V(0, 0, .03), .078, .005, M['gold'], maj=24)
        ell(knee + V(0, .04, .0), (.05, .03, .06), M['gold'], sub=0)          # knee guard
        ell(knee + V(0, .052, .0), (.028, .012, .036), M['marble'], sub=0)
        # foot + heel
        tube([ank + V(0, -.03, .005), ank + V(0, .03, -.02), toe + V(0, -.04, 0), toe], [(.036, .034), (.034, .03), (.028, .022), (.016, .012)], M['marble2'], seg=10, wide=(1, 0, 0), name='foot')
        cone(.014, .006, .06, ank + V(0, -.05, -.03), M['gold'], rot=(PI / 2 + .2, 0, 0), verts=8)


def torso(P):
    pts = [P['hipc'], P['waist'], P['bust'], P['chest']]
    tube(pts, [(.145, .105), (.092, .078), (.125, .092), (.15, .09)], M['marble'], seg=18, name='torso', sub=1)
    tube([P['chest'], P['neck']], [(.15, .09), (.034, .034)], M['marble'], seg=14, name='neck', cap=False)
    # bust, subtle
    for s in (-1, 1):
        ell(P['bust'] + V(s * .05, .06, .03), (.052, .05, .05), M['marble'])
    # corset band + belt
    tube([P['waist'] + V(0, 0, -.03), P['waist'] + V(0, 0, .04)], [(.102, .084), (.098, .082)], M['gold'], seg=20, cap=False, sub=0, name='belt')
    torus(P['waist'] + V(0, 0, -.03), .098, .007, M['gold'], maj=32)
    # chest sunburst emblem
    c = P['bust'] + V(0, .098, .06)
    ell(c, (.02, .01, .02), M['glow'], sub=0)
    for k in range(12):
        a = k * PI / 6
        cone(.007, .0, .05 if k % 2 == 0 else .03, c + V(math.cos(a) * .035, .004, math.sin(a) * .035), M['gold'], rot=(0, PI / 2 - a * 1.0 if False else 0, 0), verts=6)
    torus(c, .05, .003, M['gold'], rot=(PI / 2, 0, 0), maj=28, mnr=6)
    # gorget: high collar + gold ring
    torus(P['neck'] + V(0, 0, -.03), .048, .009, M['gold'], maj=24)
    def collar(u, v):
        a = (u - .5) * PI * 1.5 + PI / 2 + PI; a2 = PI / 2 + (u - .5) * 2.6
        r = .05 + .04 * v
        return (P['neck'].x + r * math.cos(PI / 2 + (u - .5) * 3.8) * 1.0, P['neck'].y + r * math.sin(PI / 2 + (u - .5) * 3.8) * -1.0 - .0, P['neck'].z - .035 + v * .07)
    # pauldrons: layered, asymmetric
    for s, big in ((-1, 1.0), (1, 1.25)):
        sh = P['shoulder'][s]
        for k in range(3):
            ell(sh + V(s * (.018 * k), -.005, .012 - .022 * k), (.075 * big - .008 * k, .07 * big - .006 * k, .034 * big), M['marble'] if k % 2 == 0 else M['marble2'], rot=(0, s * (.35 + .18 * k), s * -.25), sub=1)
        torus(sh + V(s * .036, -.005, -.038), .07 * big, .006, M['gold'], rot=(0, s * .35, s * -.25), maj=28)
        # feathered fins on the big shoulder
        if big > 1:
            for k in range(5):
                tube([sh + V(s * .05, -.03, .0 + k * .012), sh + V(s * (.1 + .018 * k), -.1, .04 + k * .022), sh + V(s * (.14 + .028 * k), -.2, .0 + k * .012)], [(.014, .004), (.011, .003), (.002, .001)], M['gold'], seg=6, wide=(0, 0, 1), sub=1, name='fin')


def arms(P, hands):
    for s in (-1, 1):
        sh, el, wr = P['shoulder'][s], P['elbow'][s], P['wrist'][s]
        tube([sh, sh.lerp(el, .5), el, el.lerp(wr, .5), wr], [.04, .036, .033, .03, .024], M['marble'], seg=12, name='arm')
        # detached wide sleeve with gold hem (Genshin), bond cuff
        d = (wr - el).normalized()
        base = el.lerp(wr, .15)
        def sleeve(u, v, base=base, d=d, wr=wr, s=s):
            a = u * 2 * PI; t = v
            c = base + (wr - base) * t + d * .0
            r = .042 + .062 * t ** 1.5 + .008 * math.sin(a * 4) * t
            ax1 = V((1, 0, 0)); ax1 = (ax1 - d * ax1.dot(d)).normalized(); ax2 = d.cross(ax1)
            return c + ax1 * math.cos(a) * r + ax2 * math.sin(a) * r + V(0, 0, -.075) * t * t
        sh_ = sheet(sleeve, 18, 8, M['marble2'], .007, closed=True, sub=1, name='sleeve')
        edge_trim(sleeve, 1.0, 24, .0055, M['gold'], closed=True)
        torus(wr, .03, .006, M['gold'], rot=(0, 0, 0), maj=16, mnr=6)
    for s, kind in hands.items():
        hand(P['wrist'][s], s, kind, P.get('hd', {}).get(s))


def hand(w, s, kind, dirv=None):
    """Simple hand: palm + 4 fingers + thumb. kind: 'open' | 'fist' | 'point'."""
    d = V(dirv) if dirv is not None else V((0, .6, -.8)).normalized()
    ell(w + d * .03, (.026, .014, .036), M['marble'], sub=1)
    side = V((1, 0, 0)); side = (side - d * side.dot(d)).normalized(); up = d.cross(side)
    for k in range(4):
        off = side * (-.018 + k * .012); base = w + d * .058 + off
        if kind == 'open':
            pts = [base, base + d * .022 + up * .004, base + d * .045 + up * .012]
        elif kind == 'point' and k == 0:
            pts = [base, base + d * .03, base + d * .06]
        else:
            pts = [base, base + d * .018 + up * .015, base + d * .006 + up * .036]
        tube(pts, [.0072, .0062, .0048], M['marble'], seg=6, sub=1, name='finger')
    tube([w + d * .02 + side * .02 * s, w + d * .045 + side * .034 * s + up * .01, w + d * .06 + side * .028 * s + up * .02], [.009, .008, .006], M['marble'], seg=6, sub=1, name='thumb')


def head(P, hair):
    hc = P['head']
    ell(hc, (.088, .098, .112), M['marble'], sub=2)                     # cranium
    ell(hc + V(0, .028, -.052), (.066, .062, .068), M['marble'], sub=2)      # jaw
    ell(hc + V(0, .085, -.032), (.0085, .013, .017), M['marble'], sub=1)     # nose
    ell(hc + V(0, .082, -.06), (.02, .009, .007), M['marble2'], sub=1)       # lips
    for s in (-1, 1):
        ell(hc + V(s * .037, .076, .0), (.019, .008, .009), M['marble2'], rot=(0, 0, s * -.15), sub=1)    # closed eyelids
        tube([hc + V(s * .02, .082, .02), hc + V(s * .04, .08, .026), hc + V(s * .058, .07, .02)], [.0028, .0026, .0018], M['marble2'], seg=5, sub=0, cap=False, name='brow')
        ell(hc + V(s * .09, -.005, -.02), (.008, .014, .022), M['marble'], sub=1)   # ear
    # gold circlet + gem
    torus(hc + V(0, .002, .048), .092, .0045, M['gold'], rot=(0.12, 0, 0), maj=36, mnr=6)
    ell(hc + V(0, .09, .056), (.0075, .006, .012), M['glow'], sub=1)
    hair(P)


def halo(P, R=.24, tilt=.25):
    hc = P['head']
    torus(hc + V(0, -.11, .02), R, .006, M['gold'], rot=(PI / 2 - tilt, 0, 0), maj=60, mnr=8)
    torus(hc + V(0, -.11, .02), R * .82, .003, M['glow'], rot=(PI / 2 - tilt, 0, 0), maj=60, mnr=6)
    for k in range(16):
        a = k * PI / 8
        c = hc + V(math.cos(a) * R * 1.0, -.11 - math.sin(a) * R * math.sin(tilt) * 0, .02 + math.sin(a) * R * math.cos(tilt))
        c = hc + V(0, -.11, .02) + V(math.cos(a) * R, math.sin(a) * R * math.sin(tilt) * -1 * -1, math.sin(a) * R * math.cos(tilt))
        cone(.007, 0, .05, c, M['gold'], rot=(0, 0, 0), verts=5)


def orb(c, r, rings=3):
    ell(c, (r, r, r), M['glow'], sub=2)
    for k in range(rings):
        torus(c, r * 1.55 + k * r * .18, .0045 + k * .0008, M['gold'], rot=(k * .9, k * .5, k * 1.3), maj=48, mnr=6)


def staff(base, top, r=.011):
    tube([base, base.lerp(top, .5), top], [r * 1.3, r, r], M['gold'], seg=10, sub=1, name='staff')
    tube([top, top + V(0, 0, .03)], [r * 2.4, r * 1.6], M['gold'], seg=10, sub=1, name='ferrule')


# ------------------------------------------------------------------ hair
def lock(p0, p1, p2, p3, w, m=None, thick=.7):
    tube([p0, p1, p2, p3], [(w * .7, w * .25), (w, w * .3), (w * .8, w * .22), (w * .04, w * .02)], m or M['marble2'], seg=8, sub=1, wide=(1, 0, 0), flat=1.0, name='lock')


def hair_long(P, twin=False, bob=False, braid=False):
    hc = P['head']
    ell(hc + V(0, -.018, .02), (.096, .104, .112), M['marble2'], sub=2)         # scalp mass
    # bangs: parted at the centre, swept over the brow to each side
    for k in range(10):
        sd = 1 if k >= 5 else -1; j = (k % 5); x = sd * (.006 + j * .017)
        top = hc + V(x * .8, .05 - j * .004, .108 - j * .003)
        lock(top, hc + V(x * 1.1, .085, .084 - j * .002), hc + V(x * 1.5 + sd * .01, .098 - j * .004, .05 - j * .002 - (j % 2) * .008), hc + V(x * 1.9 + sd * .022, .09 - j * .004, .028 - j * .01 - (j % 2) * .012), .012)
    # side locks framing the face, falling to the chest
    for s in (-1, 1):
        lock(hc + V(s * .088, .03, .06), hc + V(s * .102, .04, -.02), hc + V(s * .108, .05, -.14), hc + V(s * .1, .07, -.3), .02)
        lock(hc + V(s * .09, .0, .06), hc + V(s * .11, .0, -.04), hc + V(s * .12, .02, -.18), hc + V(s * .11, .03, -.34), .016)
    if twin:
        for s in (-1, 1):
            hb = hc + V(s * .112, -.005, .05)
            tube([hb, hb + V(s * .08, -.02, -.06), hb + V(s * .16, -.04, -.32), hb + V(s * .15, -.02, -.62), hb + V(s * .21, .0, -.9)], [(.022, .018), (.028, .02), (.026, .018), (.018, .012), (.004, .003)], M['marble2'], seg=10, sub=1, wide=(0, 1, 0), name='tail')
            ell(hb + V(s * .008, 0, 0), (.02, .02, .02), M['gold'], sub=1)      # tie
    else:
        # back mass: many flowing locks to the waist and beyond
        for k in range(13):
            x = (k - 6) * .016; sw = math.sin(k * 1.7) * .03
            lock(hc + V(x, -.07, .08), hc + V(x * 1.4, -.12 - abs(k - 6) * .003, -.04), hc + V(x * 2.2 + sw, -.13, -.32 - (k % 3) * .04), hc + V(x * 2.6 + sw * 2, -.11 + (k % 2) * .02, -.66 - (k % 4) * .09), .028)
    if braid:
        pts = [hc + V(0, -.1, -.02)]
        for i in range(1, 10):
            pts.append(hc + V(math.sin(i * .9) * .012, -.12 - i * .006, -.02 - i * .11))
        tube(pts, [.03, .03, .028, .026, .024, .022, .018, .012, .006, .002][:len(pts)], M['marble2'], seg=10, sub=1, name='braid')


# ------------------------------------------------------------------ cloth
def skirt(z0, z1, r0, r1, folds=7, amp=.018, tilt=.0, twist=0.0, layers=1, gap=.02, slit=.0):
    def mk(z0, z1, r0, r1, phase):
        def f(u, v):
            a = PI / 2 + slit / 2 + u * (2 * PI - slit) + twist * v; t = v
            r = r0 + (r1 - r0) * (t ** .8) + amp * t * math.sin(a * folds + phase)
            z = z0 + (z1 - z0) * t - tilt * math.sin(a) * t + .03 * math.sin(a * 3 + phase) * t * t
            return (r * math.cos(a), r * math.sin(a) * .9 - .005, z)
        return f
    for k in range(layers):
        f = mk(z0 - k * gap, z1 + k * .1, r0 + k * .01, r1 - k * .035, k * 1.3)
        sheet(f, 60, 12, M['marble'] if k % 2 == 0 else M['marble2'], .006, closed=False, sub=1, name='skirt')
        edge_trim(f, 1.0, 60, .006, M['gold'])
        edge_trim(lambda u, v, f=f: f(0, u), 0, 12, .0045, M['gold'])
        edge_trim(lambda u, v, f=f: f(1, u), 0, 12, .0045, M['gold'])
    tabard(z0, z1)


def tabard(z0, z1):
    def f(u, v):
        x = (u - .5) * .2 * (1 + .5 * v); z = z0 + .02 - (z0 - z1 + .02 + .12) * v
        return (x, .175 + .11 * v ** 1.3 + .012 * math.sin(v * 7 + u * 4), z)
    sheet(f, 6, 16, M['marble2'], .007, sub=1, name='tabard')
    for u in (0, 1):
        edge_trim(lambda a, v, u=u: f(u, a), 0, 16, .004, M['gold'])
    edge_trim(f, 1.0, 8, .005, M['gold'])
    ell((0, .19, z0 - .05), (.026, .008, .04), M['gold'], sub=1)


def cape(P, side=0, length=1.45, spread=.5, flow=.4, phase=0):
    sh = P['shoulder']; z0 = P['chest'].z + .02
    def f(u, v):
        x = (u - .5) * 2
        w = .17 + spread * v ** 1.2
        xx = x * w + side * .09 * v
        y = -.075 - .035 * math.cos(x * PI / 2) - flow * v ** 1.6 * (1 + .45 * x * (1 if side >= 0 else -1))
        z = z0 - length * v + .03 * math.sin(x * 5 + phase) * v
        y += .028 * math.sin(x * 6 + phase + v * 3) * v
        return (xx, y, max(z, .02))
    sheet(f, 30, 20, M['marble'], .008, sub=1, name='cape')
    edge_trim(f, 1.0, 40, .007, M['gold'])
    for i in range(2):
        edge_trim(lambda u, v, i=i: f(0 if i == 0 else 1, v), 0, 1, .0, M['gold']) if False else None


def sash(p0, p1, p2, p3, w=.05, m=None):
    """Bond ribbon: flat wavy strip hanging along a path."""
    pts = [V(p) for p in (p0, p1, p2, p3)]
    def cr(t):
        n = len(pts) - 1; t = min(max(t, 0), .9999) * n; i = int(t); f = t - i
        a, b = pts[i], pts[i + 1]; return a.lerp(b, f * f * (3 - 2 * f))
    def f(u, v):
        c = cr(v); tg = (cr(v + .02) - cr(v - .02)).normalized(); side = tg.cross(V((0, 1, 0)))
        if side.length < .1:
            side = V((1, 0, 0))
        side = side.normalized()
        ww = w * (1 - .35 * v)
        return c + side * (u - .5) * ww * 2 + V(0, .012 * math.sin(v * 9 + u * 2), 0)
    sheet(f, 4, 26, m or M['marble2'], .005, sub=1, name='sash')
    edge_trim(f, 1.0, 8, .004, M['gold'])
    edge_trim(lambda u, v: f(0, u), 0, 26, .003, M['gold'])
    edge_trim(lambda u, v: f(1, u), 0, 26, .003, M['gold'])


# ------------------------------------------------------------------ base pose
def base(pose='stand', shift=0.0):
    """Joint dictionary. shift leans the whole figure (contrapposto)."""
    P = {}
    hs = shift
    P['hip'] = {-1: V((-.085, 0, .95)), 1: V((.085, 0, .95))}
    if pose == 'stand':
        P['knee'] = {-1: V((-.09, .01, .52)), 1: V((.09, .07, .51))}
        P['ank'] = {-1: V((-.09, -.02, .1)), 1: V((.10, -.01, .09))}
        P['toe'] = {-1: V((-.10, .11, .03)), 1: V((.115, .12, .028))}
    elif pose == 'step':
        P['knee'] = {-1: V((-.09, -.02, .52)), 1: V((.10, .16, .5))}
        P['ank'] = {-1: V((-.10, -.14, .1)), 1: V((.11, .1, .09))}
        P['toe'] = {-1: V((-.11, -.04, .03)), 1: V((.125, .22, .028))}
    P['hipc'] = V((0, 0, .95)); P['waist'] = V((0, 0, 1.12)); P['bust'] = V((0, 0, 1.31)); P['chest'] = V((0, 0, 1.5)); P['neck'] = V((0, 0, 1.6))
    P['head'] = V((0, .012, 1.75))
    P['shoulder'] = {-1: V((-.185, 0, 1.47)), 1: V((.185, 0, 1.47))}
    P['elbow'] = {-1: V((-.235, .02, 1.2)), 1: V((.235, .02, 1.2))}
    P['wrist'] = {-1: V((-.21, .16, 1.0)), 1: V((.21, .16, 1.0))}
    return P


# ------------------------------------------------------------------ statues
def aurelia():
    """The Dawn Speaker: right arm lifts a radiant orb, great asymmetric cape, twin tails, floating halo."""
    P = base('stand')
    P['elbow'][1] = V((.27, .06, 1.42)); P['wrist'][1] = V((.30, .2, 1.66)); P['hd'] = {1: V((0, .3, .9)), -1: V((0, .5, -.7))}
    P['elbow'][-1] = V((-.22, .05, 1.2)); P['wrist'][-1] = V((-.16, .2, 1.05))
    legs(P); torso(P); arms(P, {1: 'open', -1: 'open'}); head(P, lambda P: hair_long(P, twin=True)); halo(P, .26)
    skirt(1.07, .34, .15, .36, folds=8, amp=.03, tilt=.16, layers=3)
    cape(P, side=1, length=1.35, spread=.55, flow=.42)
    orb(P['wrist'][1] + V(0, .04, .12), .045)
    sash((-.13, .05, 1.08), (-.2, .12, .8), (-.24, .18, .5), (-.22, .1, .05), .035)


def seraph():
    """The Lantern Bearer: hooded, both hands on a tall crescent staff, long layered robes, sash bonds."""
    P = base('stand')
    P['elbow'][1] = V((.25, .06, 1.24)); P['wrist'][1] = V((.2, .24, 1.18)); P['hd'] = {1: V((0, .0, -1)), -1: V((0, .0, -1))}
    P['elbow'][-1] = V((-.24, .06, 1.3)); P['wrist'][-1] = V((-.18, .24, 1.42))
    legs(P); torso(P); arms(P, {1: 'fist', -1: 'fist'}); head(P, lambda P: hair_long(P, braid=True))
    halo(P, .2, .1)
    staff(V(.19, .24, 0.0), V(.19, .24, 1.85))
    hc = P['head']
    for k in range(2):
        torus(V(.19, .24, 1.93 + k * .0), .07 + k * .0, .008, M['gold'], rot=(PI / 2, 0, 0), maj=40)
    ell(V(.19, .24, 1.93), (.03, .03, .03), M['glow'], sub=2)
    skirt(1.07, .1, .15, .4, folds=10, amp=.03, tilt=.06, layers=3)
    # hood: draped sheet behind the head
    def hood(u, v):
        a = PI * (.15 + .7 * u) + PI / 2 + PI / 2 * 0; x = (u - .5) * 2
        r = .13 + .05 * v
        return (hc.x + math.sin(x * 1.5) * r * 1.1, hc.y - .02 - math.cos(x * 1.5) * r * .9 - .09 * v * v, hc.z + .06 - v * .3 + .03 * (1 - abs(x)))
    sheet(hood, 16, 8, M['marble'], .008, sub=1, name='hood')
    cape(P, side=-1, length=1.3, spread=.42, flow=.3, phase=1.4)
    sash((.13, .08, 1.08), (.17, .16, .8), (.22, .22, .5), (.2, .16, .04), .04)


def vesta():
    """The Archivist: holds an open tome and a floating nova orb, side ponytail, layered sleeves, long bond sashes."""
    P = base('step')
    P['elbow'][-1] = V((-.2, .1, 1.2)); P['wrist'][-1] = V((-.06, .27, 1.16)); P['hd'] = {-1: V((0.2, .5, -.7)), 1: V((-.2, .5, -.7))}
    P['elbow'][1] = V((.2, .1, 1.2)); P['wrist'][1] = V((.06, .27, 1.16))
    legs(P); torso(P); arms(P, {-1: 'open', 1: 'open'}); head(P, lambda P: hair_long(P, twin=False))
    # tome
    tb = V(0, .32, 1.19)
    kit.box(.22, .16, .012, tb.x, tb.y, tb.z - .005, M['gold'], .004, rot=(-.5, 0, 0))
    kit.box(.2, .14, .02, tb.x, tb.y + .002, tb.z + .0, M['marble2'], .003, rot=(-.5, 0, 0))
    orb(tb + V(0, .0, .2), .038, rings=2)
    halo(P, .22, .3)
    skirt(1.07, .26, .15, .38, folds=9, amp=.028, tilt=.2, layers=3)
    cape(P, side=0, length=1.2, spread=.5, flow=.3, phase=2.1)
    sash((-.14, .04, 1.1), (-.22, .14, .8), (-.3, .2, .45), (-.36, .3, .06), .04)
    sash((.14, .04, 1.1), (.26, .1, .8), (.3, .16, .45), (.4, .2, .06), .04)


def tempest():
    """The Storm Duelist: mid-stride, one hand lifted with crackling arcs, high cape, blade of light on the hip."""
    P = base('step')
    P['elbow'][1] = V((.3, .08, 1.35)); P['wrist'][1] = V((.4, .24, 1.55)); P['hd'] = {1: V((.2, .3, .9)), -1: V((0, .2, -.8))}
    P['elbow'][-1] = V((-.24, .0, 1.16)); P['wrist'][-1] = V((-.25, .12, .96))
    legs(P); torso(P); arms(P, {1: 'open', -1: 'fist'}); head(P, lambda P: hair_long(P, twin=True, bob=True)); halo(P, .22, .5)
    skirt(1.07, .42, .15, .34, folds=8, amp=.03, tilt=.26, layers=2, twist=.4)
    cape(P, side=-1, length=1.5, spread=.6, flow=.6, phase=.6)
    # arcs of light around the raised hand
    w = P['wrist'][1]
    for k in range(4):
        a = k * PI / 2 + .4
        tube([w + V(0, .06, .1), w + V(math.cos(a) * .08, .08, .14 + math.sin(a) * .06), w + V(math.cos(a) * .16, .06, .1 + math.sin(a) * .16), w + V(math.cos(a) * .2, .04, .28 + math.sin(a) * .08)], [.005, .005, .004, .002], M['glow'], seg=5, sub=1, name='arc')
    # light blade sheath at hip
    tube([V(-.14, .0, 1.0), V(-.2, -.08, .8), V(-.3, -.22, .55)], [.014, .012, .008], M['gold'], seg=8, sub=1, name='blade')
    sash((.12, .05, 1.08), (.2, .1, .8), (.26, .06, .45), (.3, -.05, .08), .035)


BUILDERS = {'aurelia': aurelia, 'seraph': seraph, 'vesta': vesta, 'tempest': tempest}


def render(path, w=900, h=900):
    sc = C.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 28; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
    sc.render.resolution_x = w; sc.render.resolution_y = h; sc.render.filepath = path
    world = bpy.data.worlds.new('w'); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (.5, .55, .7, 1); bg.inputs['Strength'].default_value = 1.0
    bpy.ops.object.light_add(type='SUN'); L = C.object; L.data.energy = 3.5; L.rotation_euler = (math.radians(55), 0, math.radians(-30))
    for (nm, loc) in (('a', (1.6, 3.6, 1.4)), ('b', (-2.6, 2.4, 1.3))):
        bpy.ops.object.camera_add(location=loc); cam = C.object; cam.data.lens = 60
        tgt = V((0, 0, 1.05)); cam.rotation_euler = (tgt - V(loc)).to_track_quat('-Z', 'Y').to_euler(); sc.camera = cam
        sc.render.filepath = path.replace('.png', f'_{nm}.png'); bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = a[0] if a else '/tmp/guard'; ids = [x for x in a[1:] if not x.startswith('--')] or list(BUILDERS)
    os.makedirs(out, exist_ok=True)
    for i in ids:
        kit.reset(); mats(); BUILDERS[i]()
        print(i, 'tris', kit.tri_count())
        if '--preview' in a:
            render(f'{out}/{i}.png')
        else:
            kit.export(f'{out}/{i}.glb')
