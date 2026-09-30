"""Bring a downloaded weapon GLB into the game's frame (muzzle +Y, up +Z), drop junk, decimate, shrink textures.
usage: python3 conform.py -- in.glb out.glb MUZZLE(+X|-X|+Y|-Y) [tris=14000] [tex=1024] [del=Name,Name] [minpoly=0]"""
import bpy, sys, math
a = sys.argv[sys.argv.index('--') + 1:]
src, dst, mz = a[0], a[1], a[2]
tris = int(a[3]) if len(a) > 3 else 14000; tex = int(a[4]) if len(a) > 4 else 1024
dels = a[5].split(',') if len(a) > 5 and a[5] else []
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
for o in list(sc.objects):
    if o.name in dels or o.name.split('.')[0] in dels or o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o, do_unlink=True)
for o in sc.objects:
    o.animation_data_clear() if o.animation_data else None
for act in list(bpy.data.actions): bpy.data.actions.remove(act)
ms = [o for o in sc.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
    o.select_set(o.type == 'MESH')
bpy.context.view_layer.objects.active = ms[0]
# bake parent transforms into the meshes, then join
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in sc.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = [o for o in sc.objects][0]
if len(ms) > 1: bpy.ops.object.join()
o = bpy.context.object
rot = {'+Y': 0, '-Y': math.pi, '+X': math.pi / 2, '-X': -math.pi / 2}[mz]
from mathutils import Matrix
o.data.transform(Matrix.Rotation(rot, 4, 'Z')); o.data.update()
n = sum(len(p.vertices) - 2 for p in o.data.polygons)
if n > tris:
    md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = tris / n; md.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
for img in bpy.data.images:
    if img.size[0] > tex or img.size[1] > tex: img.scale(tex, tex)
print('tris', n, '->', sum(len(p.vertices) - 2 for p in o.data.polygons))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=88, export_apply=True, export_animations=False, export_yup=True)
