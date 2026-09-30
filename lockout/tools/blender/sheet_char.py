"""python3 sheet_char.py -- out.png a.glb|a.fbx ... : front + side views of each character."""
import bpy, sys, math
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; out = a[0]; files = a[1:]
from PIL import Image
tiles = []
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    (bpy.ops.import_scene.fbx if f.endswith('.fbx') else bpy.ops.import_scene.gltf)(filepath=f)
    sc = bpy.context.scene
    ms = [o for o in sc.objects if o.type == 'MESH']
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in ms:
        for c in o.bound_box:
            v = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, v)); mx = Vector(map(max, mx, v))
    ctr = (mn + mx) / 2; d = mx - mn; L = max(d); up = [d.x, d.y, d.z].index(L)
    print(f, 'dims', tuple(round(x, 2) for x in d), 'tallest axis', 'xyz'[up])
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 12; sc.cycles.device = 'CPU'; sc.cycles.use_denoising = False
    sc.render.resolution_x = 300; sc.render.resolution_y = 420
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (.4, .42, .48, 1); bg.inputs['Strength'].default_value = 1.6
    bpy.ops.object.light_add(type='SUN'); bpy.context.object.data.energy = 3; bpy.context.object.rotation_euler = (.9, .2, .6)
    bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.type = 'ORTHO'; cam.data.ortho_scale = L * 1.12
    for name, loc, rot in (('front', (0, -L * 3, 0), (math.pi / 2, 0, 0)), ('side', (L * 3, 0, 0), (math.pi / 2, 0, math.pi / 2))):
        if up == 1:   # Y-up model imported raw
            loc = {'front': (0, 0, L * 3), 'side': (L * 3, 0, 0)}[name]; rot = {'front': (0, 0, 0), 'side': (0, math.pi / 2, 0)}[name]
        cam.location = ctr + Vector(loc); cam.rotation_euler = rot
        sc.render.filepath = f'/tmp/drv/ch/t_{len(tiles)}.png'; bpy.ops.render.render(write_still=True); tiles.append(sc.render.filepath)
S = Image.new('RGB', (300 * 2 * ((len(files) + 1) // 2), 420 * 2 if len(files) > 1 else 420), (40, 42, 48))
for i, p in enumerate(tiles):
    fi = i // 2; col = (fi % 2) * 2 + (i % 2); row = fi // 2
    S.paste(Image.open(p), (col * 300, row * 420))
S.save(out)
