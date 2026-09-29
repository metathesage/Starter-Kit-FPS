"""Clean up an AI-generated weapon GLB for the game (headless Blender 4.2).
usage: python3 optimize.py -- in.glb out.glb [target_tris=9000] [tex=1024] [rotY_deg=0]
Steps: import, join meshes, decimate to the target triangle count, downscale textures, export JPEG textures."""
import bpy, sys, math
a = sys.argv[sys.argv.index('--') + 1:]
src, dst = a[0], a[1]; target = int(a[2]) if len(a) > 2 else 9000; tex = int(a[3]) if len(a) > 3 else 1024
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in meshes:
    bpy.context.view_layer.objects.active = o
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
o = bpy.context.object
tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
if tris > target:
    md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = target / tris; md.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier='dec')
for img in bpy.data.images:
    if img.size[0] > tex or img.size[1] > tex:
        img.scale(tex, tex)
print('tris', tris, '->', sum(len(p.vertices) - 2 for p in o.data.polygons))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=86, export_apply=True)
