"""python3 sheet_glb.py -- out.png a.glb b.glb ... : one contact sheet, each model in its own tile (side view along its longest axis)."""
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; out = a[0]; files = a[1:]
TW = 480
sc = bpy.context.scene
res = []
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in ms:
        for c in o.bound_box:
            v = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, v)); mx = Vector(map(max, mx, v))
    ctr = (mn + mx) / 2; d = mx - mn; L = max(d)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=L*0.03, location=(ctr.x, mx.y + L*0.05, ctr.z)); mk = bpy.context.object; mm = bpy.data.materials.new('mk'); mm.diffuse_color=(1,0,0,1); mm.use_nodes=True; mm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(1,0,0,1); mm.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value=(1,0,0,1); mm.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value=5; mk.data.materials.append(mm)
    ax = [d.x, d.y, d.z].index(L)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 10; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
    sc.render.resolution_x = TW; sc.render.resolution_y = TW // 2
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (.35, .37, .42, 1); bg.inputs['Strength'].default_value = 1.4
    bpy.ops.object.light_add(type='SUN'); bpy.context.object.data.energy = 3; bpy.context.object.rotation_euler = (.9, .2, .6)
    bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = L * 1.15
    # camera looks along the axis perpendicular to the longest one
    if ax == 1: cam.location = ctr + Vector((L * 3, 0, 0)); cam.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    elif ax == 0: cam.location = ctr + Vector((0, -L * 3, 0)); cam.rotation_euler = (math.pi / 2, 0, 0)
    else: cam.location = ctr + Vector((0, -L * 3, 0)); cam.rotation_euler = (math.pi / 2, 0, 0)
    sc.render.filepath = f'/tmp/drv/tile_{len(res)}.png'; bpy.ops.render.render(write_still=True); res.append(sc.render.filepath)
    print(f, 'long axis', 'xyz'[ax])
from PIL import Image
ims = [Image.open(p) for p in res]; cols = 2; rows = (len(ims) + 1) // 2
S = Image.new('RGB', (TW * cols, TW // 2 * rows))
for i, im in enumerate(ims): S.paste(im, ((i % cols) * TW, (i // cols) * TW // 2))
S.save(out)
