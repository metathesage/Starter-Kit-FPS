"""Static character -> game-ready skinning source. Joins meshes, normalises to height 1 (feet at y=-0.5, centred, facing glTF +Z,
character-left = +X) and exports GLB with textures shrunk. The game skins it at load (js/angel.js).
usage: python3 prep_char.py -- in.(glb|fbx) out.glb [tris=24000] [tex=1024] [facing=-Y] [up=Z]"""
import bpy, sys, math
from mathutils import Vector, Matrix
a = sys.argv[sys.argv.index('--') + 1:]
src, dst = a[0], a[1]; tris = int(a[2]) if len(a) > 2 else 24000; tex = int(a[3]) if len(a) > 3 else 1024
bpy.ops.wm.read_factory_settings(use_empty=True)
(bpy.ops.import_scene.fbx if src.endswith('.fbx') else bpy.ops.import_scene.gltf)(filepath=src)
sc = bpy.context.scene
for o in [o for o in sc.objects if o.type in ('LIGHT', 'CAMERA')]: bpy.data.objects.remove(o, do_unlink=True)
ms = [o for o in sc.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active = ms[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM'); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for o in [o for o in sc.objects if o.type != 'MESH']: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='SELECT'); bpy.context.view_layer.objects.active = [o for o in sc.objects][0]
if len(ms) > 1: bpy.ops.object.join()
o = bpy.context.object
n = sum(len(p.vertices) - 2 for p in o.data.polygons)
if n > tris:
    md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = tris / n; md.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
co = [v.co.copy() for v in o.data.vertices]
mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co))); mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
H = mx.z - mn.z; k = 1.0 / H
# Blender: character faces -Y, up +Z, character-left = +X.  glTF export (y-up) maps (x, y, z) -> (x, z, -y): faces +Z, feet at native y = -0.5
M = Matrix.Translation(Vector((-(mn.x + mx.x) / 2 * k, -(mn.y + mx.y) / 2 * k, -0.5 - mn.z * k))) @ Matrix.Scale(k, 4)
o.data.transform(Matrix.Translation(Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z))))
o.data.transform(Matrix.Scale(k, 4)); o.data.transform(Matrix.Translation(Vector((0, 0, -0.5))))
for img in bpy.data.images:
    if img.size[0] > tex or img.size[1] > tex: img.scale(tex, tex)
print('tris', n, '->', sum(len(p.vertices) - 2 for p in o.data.polygons), 'H', round(H, 3), 'mats', len(o.data.materials))
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=90, export_apply=True, export_yup=True, export_animations=False)
