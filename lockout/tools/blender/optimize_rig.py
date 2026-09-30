"""Shrink an authored, animated character GLB for the web (headless Blender 4.2). Keeps skeleton, weights and every action.
usage: python3 optimize_rig.py -- in.glb out.glb [tris=16000] [tex=512]"""
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
src, dst = a[0], a[1]; target = int(a[2]) if len(a) > 2 else 16000; tex = int(a[3]) if len(a) > 3 else 512
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
count = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
total = sum(count(o) for o in meshes); ratio = min(1.0, target / max(1, total))
for o in meshes:
    if count(o) < 600 or ratio >= 1: continue
    bpy.context.view_layer.objects.active = o
    md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = ratio; md.use_collapse_triangulate = True
    bpy.ops.object.modifier_move_to_index(modifier='dec', index=0)
    try: bpy.ops.object.modifier_apply(modifier='dec')
    except Exception as e: print('decimate failed on', o.name, e); o.modifiers.remove(md)
for img in bpy.data.images:
    if img.size[0] > tex or img.size[1] > tex:
        k = tex / max(img.size); img.scale(max(8, int(img.size[0] * k)), max(8, int(img.size[1] * k)))
print('tris', total, '->', sum(count(o) for o in meshes))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=82, export_apply=False, export_animations=True, export_optimize_animation_size=True, export_skins=True)
