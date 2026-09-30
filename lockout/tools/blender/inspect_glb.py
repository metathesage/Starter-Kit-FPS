"""python3 inspect_glb.py -- a.glb [b.glb ...]  : prints tris, bounds, materials, armature and animation info."""
import bpy, sys
from mathutils import Vector
for path in sys.argv[sys.argv.index('--') + 1:]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in ms)
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in ms:
        for c in o.bound_box:
            v = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, v)); mx = Vector(map(max, mx, v))
    arm = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    bones = sum(len(a.data.bones) for a in arm)
    mats = {m.name for o in ms for m in o.data.materials if m}
    print(f'{path.split("/")[-1]}: meshes={len(ms)} tris={tris} dim=({mx.x-mn.x:.2f},{mx.y-mn.y:.2f},{mx.z-mn.z:.2f}) arm={len(arm)} bones={bones} anims={len(bpy.data.actions)} mats={len(mats)} imgs={len(bpy.data.images)}')
