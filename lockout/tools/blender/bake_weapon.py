"""Bake a rigged first-person weapon GLB (Apex style: Muzzle / Sight_ADS / Grip_Forehand nodes, Idle/Fire/Reload clips) into a static game weapon.
Rest pose, muzzle -> +Y, sight side -> +Z, joined, decimated, small JPEG textures.
usage: python3 bake_weapon.py -- in.glb out.glb [tris=12000] [tex=1024] [delete,names]"""
import bpy, sys, math
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index('--') + 1:]
src, dst = a[0], a[1]; tris = int(a[2]) if len(a) > 2 else 12000; tex = int(a[3]) if len(a) > 3 else 1024
dels = a[4].split(',') if len(a) > 4 and a[4] else []
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
for act in list(bpy.data.actions): bpy.data.actions.remove(act)
for o in sc.objects:
    if o.animation_data: o.animation_data_clear()
bpy.context.view_layer.update()
def find_point(name):
    for o in sc.objects:
        if o.name.split('.')[0] == name: return o.matrix_world.translation.copy()
        if o.type == 'ARMATURE' and name in o.pose.bones:
            return o.matrix_world @ o.pose.bones[name].head
    return None
muz, ads, grip = find_point('Muzzle'), find_point('Sight_ADS'), find_point('Grip_Forehand')
print('muzzle', muz, 'ads', ads, 'grip', grip)
for o in list(sc.objects):
    if o.name in dels or o.name.split('.')[0] in dels or o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o, do_unlink=True)
dg = bpy.context.evaluated_depsgraph_get()
meshes = [o for o in sc.objects if o.type == 'MESH']
# bake the (rest-posed) deformed meshes to plain meshes in world space
baked = []
for o in meshes:
    ev = o.evaluated_get(dg); me = bpy.data.meshes.new_from_object(ev); me.transform(o.matrix_world)
    n = bpy.data.objects.new(o.name + '_b', me)
    for i, m in enumerate(o.data.materials): me.materials.append(m) if i >= len(me.materials) else None
    sc.collection.objects.link(n); baked.append(n)
for o in meshes + [o for o in sc.objects if o.type not in ('MESH',) ] : 
    try: bpy.data.objects.remove(o, do_unlink=True)
    except Exception: pass
bpy.ops.object.select_all(action='DESELECT')
for o in baked: o.select_set(True)
bpy.context.view_layer.objects.active = baked[0]
if len(baked) > 1: bpy.ops.object.join()
o = bpy.context.object
verts = [v.co for v in o.data.vertices]
cen = sum(verts, Vector()) / len(verts)
bb_lo = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts))); bb_hi = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
dims = bb_hi - bb_lo
# barrel direction: from the mesh centre toward the muzzle node, else along the longest axis
if muz is not None and (muz - cen).length > 1e-6: fwd = (muz - cen)
else: fwd = Vector([1, 0, 0]) if dims.x >= max(dims.y, dims.z) else Vector([0, 1, 0]) if dims.y >= dims.z else Vector([0, 0, 1])
ax = max(range(3), key=lambda i: abs(fwd[i])); f = Vector((0, 0, 0)); f[ax] = 1 if fwd[ax] > 0 else -1
# up: toward the sight node, else the mesh axis with the biggest cross-section flip (assume +Z)
if ads is not None and (ads - cen).length > 1e-6:
    up = (ads - cen) - f * (ads - cen).dot(f)
else: up = Vector((0, 0, 1)) - f * f.z
if up.length < 1e-6: up = Vector((0, 0, 1)) - f * f.z
up.normalize(); up_ax = max(range(3), key=lambda i: abs(up[i])); u = Vector((0, 0, 0)); u[up_ax] = 1 if up[up_ax] > 0 else -1
if abs(f.dot(u)) > 0.5: u = Vector((0, 0, 1)) if abs(f.z) < 0.5 else Vector((0, 1, 0))
x = f.cross(u).normalized(); u = x.cross(f).normalized()
R = Matrix(((x.x, x.y, x.z), (f.x, f.y, f.z), (u.x, u.y, u.z))).to_4x4()   # rows are the new X, Y (muzzle), Z (up)
o.data.transform(R)
# scale so the length is ~1 (the loader rescales per manifest anyway), origin at the centre
verts = [v.co for v in o.data.vertices]
lo = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts))); hi = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
o.data.transform(Matrix.Translation(-(lo + hi) / 2)); L = hi.y - lo.y
o.data.transform(Matrix.Scale(1.0 / max(L, 1e-6), 4)); o.data.update()
n = sum(len(p.vertices) - 2 for p in o.data.polygons)
if n > tris:
    md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = tris / n; md.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
for img in bpy.data.images:
    if img.size[0] > tex or img.size[1] > tex: img.scale(tex, tex)
print('tris', n, '->', sum(len(p.vertices) - 2 for p in o.data.polygons), 'dims(after)', tuple(round(v, 3) for v in (hi - lo)))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=88, export_apply=True, export_animations=False, export_yup=True)
